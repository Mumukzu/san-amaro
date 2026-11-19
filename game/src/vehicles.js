// Vehicles of San Amaro: a parametric sedan builder (layered body, glass
// cabin, bumpers, rotating/steering wheels), arcade driving physics, and
// enter/exit. Wheels, headlights and taillights are shared InstancedMeshes
// so 18+ cars cost only a few draw calls. All cars are original designs.
import * as THREE from 'three';
import { CAR, PARKED_COUNT } from './config.js';
import { angleLerp, circleVsAABB, clamp, mergeGeoms, mulberry32, pick, rand } from './utils.js';
import { state } from './state.js';

const SEDAN_COLORS = [0xc23a2a, 0x2a6ac2, 0xe8b832, 0x3a3f45, 0x2a7a4a, 0xd8d4c8, 0xff7a1a, 0x7a3ab0];
const WHEEL_POS = [
  [-0.85, 0.36, 1.45], [0.85, 0.36, 1.45],
  [-0.85, 0.36, -1.45], [0.85, 0.36, -1.45],
];

function carBodyGeo() {
  const parts = [];
  const add = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Matrix4().setPosition(x, y, z);
    parts.push({ geo: g, matrix: m, uvScale: [1, 1] });
  };
  add(1.9, 0.55, 4.4, 0, 0.55, 0); // lower body
  add(1.7, 0.32, 1.3, 0, 0.88, 1.55); // hood bevel
  add(1.7, 0.32, 1.1, 0, 0.88, -1.6); // trunk bevel
  add(1.92, 0.22, 0.35, 0, 0.42, 2.1); // front bumper
  add(1.92, 0.22, 0.35, 0, 0.42, -2.1); // rear bumper
  add(1.92, 0.1, 3.6, 0, 0.3, 0); // side skirts
  return mergeGeoms(parts);
}

function carCabinGeo() {
  const parts = [];
  const add = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Matrix4().setPosition(x, y, z);
    parts.push({ geo: g, matrix: m, uvScale: [1, 1] });
  };
  add(1.66, 0.52, 2.2, 0, 1.08, -0.25); // cabin
  add(1.5, 0.1, 0.5, 0, 1.38, -0.3); // roof panel
  return mergeGeoms(parts);
}

export class Vehicles {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.nextId = 1;
    this.bodyGeo = carBodyGeo();
    this.cabinGeo = carCabinGeo();
    this.bodyMats = new Map();
    this.cabinMat = new THREE.MeshStandardMaterial({
      color: 0x141c22, roughness: 0.08, metalness: 0.9, envMapIntensity: 1.6,
    });
    // Wheels: one InstancedMesh for every car (4 slots each).
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    this.wheelMesh = new THREE.InstancedMesh(
      wheelGeo,
      new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.9, metalness: 0.2 }),
      120,
    );
    this.wheelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.wheelMesh);
    // Headlights (white) and taillights (red): unlit basic materials, bright
    // by themselves; taillight colour flips brighter when braking.
    this.headMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.38, 0.16, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xfff6d8 }),
      60,
    );
    this.headMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.headMesh);
    this.tailMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
      60,
    );
    this.tailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tailMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(60 * 3), 3);
    scene.add(this.tailMesh);
    this.wheelSpin = new Map(); // carId -> spin angle
  }

  bodyMat(color) {
    if (!this.bodyMats.has(color)) {
      this.bodyMats.set(color, new THREE.MeshStandardMaterial({
        color, roughness: 0.28, metalness: 0.65, envMapIntensity: 1.1,
      }));
    }
    return this.bodyMats.get(color);
  }

  addCar(opts) {
    const id = this.nextId;
    this.nextId += 1;
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.bodyGeo, this.bodyMat(opts.color));
    body.castShadow = true;
    group.add(body);
    const cabin = new THREE.Mesh(this.cabinGeo, this.cabinMat);
    cabin.castShadow = true;
    group.add(cabin);
    // Police light bar: two small boxes that flash red/blue.
    let barR = null; let barB = null;
    if (opts.kind === 'police') {
      barR = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.14, 0.28),
        new THREE.MeshBasicMaterial({ color: 0xff2020 }),
      );
      barR.position.set(-0.32, 1.44, -0.25);
      barB = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.14, 0.28),
        new THREE.MeshBasicMaterial({ color: 0x2040ff }),
      );
      barB.position.set(0.32, 1.44, -0.25);
      group.add(barR, barB);
    }
    group.position.set(opts.x, 0, opts.z);
    group.rotation.y = opts.heading;
    this.scene.add(group);
    const car = {
      id, kind: opts.kind || 'sedan', color: opts.color,
      group, pos: new THREE.Vector3(opts.x, 0, opts.z),
      heading: opts.heading, speed: 0, steer: 0,
      parked: !!opts.parked, stolen: false, isPolice: opts.kind === 'police',
      isTraffic: !!opts.isTraffic, autopilot: false,
      wheelSlots: [0, 0, 0, 0], headSlots: [0, 0], tailSlots: [0, 0],
      wheelBase: (id - 1) * 4, brake: false, barR, barB,
    };
    car.wheelSlots = [0, 1, 2, 3].map((k) => car.wheelBase + k);
    car.headSlots = [0, 1].map((k) => (id - 1) * 2 + k);
    car.tailSlots = [0, 1].map((k) => (id - 1) * 2 + k);
    this.cars.push(car);
    state.cars.push(car);
    return car;
  }

  spawnParked(rng) {
    // Parked along the boulevard curbs and side streets, ready to steal.
    const spots = [
      { x: -40, z: 38.5, heading: Math.PI / 2 },
      { x: 20, z: 38.5, heading: Math.PI / 2 },
      { x: 90, z: 61.5, heading: -Math.PI / 2 },
      { x: -120, z: 61.5, heading: -Math.PI / 2 },
      { x: -58.5, z: -20, heading: 0 },
      { x: 41.5, z: 120, heading: Math.PI },
    ];
    for (let i = 0; i < PARKED_COUNT; i += 1) {
      const s = spots[i % spots.length];
      this.addCar({
        x: s.x, z: s.z, heading: s.heading + (rng() - 0.5) * 0.06,
        color: pick(rng, SEDAN_COLORS), parked: true,
      });
    }
  }

  spawnPolice(x, z, heading) {
    const car = this.addCar({ x, z, heading, color: 0xf2f2f2, kind: 'police' });
    car.parked = false;
    return car;
  }

  nearestStealable(pos, maxDist = 4) {
    let best = null; let bestD = maxDist;
    for (const car of this.cars) {
      if (!car.parked || car.isTraffic) continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  // Arcade driving: throttle/brake/steer in [-1, 1]; handbrake locks the rear.
  drive(car, dt, throttle, steerInput, brake, handbrake) {
    const forward = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
    if (throttle > 0) car.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= CAR.brake * dt;
      else car.speed += CAR.reverseAccel * throttle * dt;
    }
    if (brake) car.speed -= CAR.brake * 0.8 * dt * Math.sign(car.speed || 1);
    if (handbrake) car.speed -= car.speed * 2.2 * dt;
    car.speed -= car.speed * CAR.drag * dt;
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
    // Steering: stronger at low speed, reversed when reversing.
    const steerTarget = steerInput * CAR.steerMax * clamp(1 - Math.abs(car.speed) / 40, 0.35, 1);
    car.steer += (steerTarget - car.steer) * Math.min(1, CAR.steerSpeed * 3 * dt);
    const dirSign = car.speed >= 0 ? 1 : -1;
    car.heading += (car.speed / 2.6) * Math.tan(car.steer) * dt * dirSign * 0.9;
    car.pos.addScaledVector(forward, car.speed * dt);
    this.collideCar(car, dt);
    car.brake = brake || (throttle < 0 && car.speed > 0.5) || handbrake;
  }

  collideCar(car, dt) {
    // Buildings.
    for (const box of state.colliders) {
      const p = circleVsAABB(car.pos.x, car.pos.z, CAR.radius, box);
      if (p) {
        const nx = p.x - car.pos.x; const nz = p.z - car.pos.z;
        car.pos.x = p.x; car.pos.z = p.z;
        // Kill the velocity component into the wall.
        const fwdX = Math.sin(car.heading); const fwdZ = Math.cos(car.heading);
        const into = nx * fwdX + nz * fwdZ;
        if (into < 0) car.speed *= 0.4;
        void dt;
      }
    }
    // Other cars: soft circle push.
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = car.pos.x - other.pos.x; const dz = car.pos.z - other.pos.z;
      const d = Math.hypot(dx, dz);
      const min = CAR.radius * 2;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d; const nz = dz / d;
        car.pos.x += nx * push; car.pos.z += nz * push;
        if (!other.parked && !other.isTraffic) { other.pos.x -= nx * push; other.pos.z -= nz * push; }
        car.speed *= 0.7;
      }
    }
    car.pos.x = clamp(car.pos.x, -305, 305);
    car.pos.z = clamp(car.pos.z, -305, 305);
  }

  updateVisuals(dt) {
    const dummy = new THREE.Object3D();
    const m = new THREE.Matrix4();
    for (const car of this.cars) {
      car.group.position.copy(car.pos);
      car.group.rotation.y = car.heading;
      // Body roll and pitch: lean into turns, dive under braking.
      car.group.rotation.z = clamp(-car.steer * car.speed * 0.006, -0.06, 0.06);
      car.group.rotation.x = clamp(-car.speed * 0.0004 * (car.brake ? 3 : 0), -0.03, 0.02);
      // Wheels: steer the fronts, spin them all.
      const spin = (this.wheelSpin.get(car.id) || 0) + (car.speed / 0.36) * dt;
      this.wheelSpin.set(car.id, spin);
      for (let k = 0; k < 4; k += 1) {
        const [wx, wy, wz] = WHEEL_POS[k];
        dummy.position.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        // Wheel local transform relative to the car.
        const local = new THREE.Matrix4();
        const steer = k < 2 ? car.steer : 0;
        local.makeRotationY(steer);
        const spinM = new THREE.Matrix4().makeRotationX(spin);
        const trans = new THREE.Matrix4().makeTranslation(wx, wy, wz);
        const carM = new THREE.Matrix4().makeRotationY(car.heading);
        carM.setPosition(car.pos.x, 0, car.pos.z);
        m.copy(carM).multiply(trans).multiply(local).multiply(spinM);
        this.wheelMesh.setMatrixAt(car.wheelSlots[k], m);
      }
      // Headlights / taillights follow the car.
      const fwdX = Math.sin(car.heading); const fwdZ = Math.cos(car.heading);
      const rightX = Math.cos(car.heading); const rightZ = -Math.sin(car.heading);
      for (let k = 0; k < 2; k += 1) {
        const s = k === 0 ? -0.65 : 0.65;
        dummy.position.set(
          car.pos.x + fwdX * 2.2 + rightX * s,
          0.62, car.pos.z + fwdZ * 2.2 + rightZ * s,
        );
        dummy.rotation.set(0, car.heading, 0);
        dummy.updateMatrix();
        this.headMesh.setMatrixAt(car.headSlots[k], dummy.matrix);
        dummy.position.set(
          car.pos.x - fwdX * 2.2 + rightX * s,
          0.62, car.pos.z - fwdZ * 2.2 + rightZ * s,
        );
        dummy.updateMatrix();
        this.tailMesh.setMatrixAt(car.tailSlots[k], dummy.matrix);
        const c = new THREE.Color(car.brake ? 0xff6a3a : 0xc21410);
        this.tailMesh.setColorAt(car.tailSlots[k], c);
      }
      // Police light bar flash.
      if (car.isPolice && car.barR && car.barB) {
        const on = Math.floor(state.time * 4) % 2 === 0;
        car.barR.visible = on;
        car.barB.visible = !on;
      }
    }
    this.wheelMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.tailMesh.instanceMatrix.needsUpdate = true;
    if (this.tailMesh.instanceColor) this.tailMesh.instanceColor.needsUpdate = true;
  }
}
