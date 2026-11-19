// Vehicles of San Amaro: a parametric sedan builder (layered body, glass
// cabin, bumpers, rotating/steering wheels), arcade driving physics, and
// enter/exit. Wheels, headlights and taillights are shared InstancedMeshes
// so 18+ cars cost only a few draw calls. All cars are original designs.
import * as THREE from 'three';
import { CAR, PARKED_COUNT } from './config.js';
import { angleLerp, circleVsAABB, clamp, mergeColored, mergeGeoms, mulberry32, pick, rand } from './utils.js';
import { state } from './state.js';

const SEDAN_COLORS = [0xc23a2a, 0x2a6ac2, 0xe8b832, 0x3a3f45, 0x2a7a4a, 0xd8d4c8, 0xff7a1a, 0x7a3ab0];

// Per-class silhouettes (bible §6: 9 vehicles). Each class has its own
// body/cabin/details geometry, built once and shared by every car of the
// class — so 34 cars still cost ~2-3 meshes each, not a mesh per detail.
const CAR_CLASSES = {
  sedan: { len: 4.4, w: 1.9, bodyH: 0.55, bodyY: 0.55, hood: 1.3, trunk: 1.1, cabinLen: 2.2, cabinH: 0.46, cabinY: 1.05, cabinZ: -0.25, wheelZ: 1.45 },
  sports: { len: 4.6, w: 2.0, bodyH: 0.45, bodyY: 0.48, hood: 1.6, trunk: 0.9, cabinLen: 1.9, cabinH: 0.38, cabinY: 0.93, cabinZ: -0.45, wheelZ: 1.55, spoiler: true },
  muscle: { len: 4.8, w: 2.0, bodyH: 0.6, bodyY: 0.58, hood: 1.9, trunk: 1.0, cabinLen: 2.0, cabinH: 0.44, cabinY: 1.07, cabinZ: -0.5, wheelZ: 1.6 },
  van: { len: 4.6, w: 2.0, bodyH: 1.0, bodyY: 0.8, hood: 0.8, trunk: 0, cabinLen: 0, cabinH: 0, cabinY: 0, cabinZ: 0, wheelZ: 1.5, van: true },
  truck: { len: 5.2, w: 2.0, bodyH: 0.55, bodyY: 0.55, hood: 1.0, trunk: 0, cabinLen: 1.6, cabinH: 0.5, cabinY: 1.075, cabinZ: 0.9, wheelZ: 1.7, bed: true },
  police: { len: 4.4, w: 1.9, bodyH: 0.55, bodyY: 0.55, hood: 1.3, trunk: 1.1, cabinLen: 2.2, cabinH: 0.46, cabinY: 1.05, cabinZ: -0.25, wheelZ: 1.45 },
};

function classGeos(cls) {
  const c = CAR_CLASSES[cls];
  const parts = [];
  const add = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Matrix4().setPosition(x, y, z);
    parts.push({ geo: g, matrix: m, uvScale: [1, 1] });
  };
  const half = c.len / 2;
  add(c.w, c.bodyH, c.len, 0, c.bodyY, 0); // lower body
  if (c.hood > 0) add(c.w - 0.2, 0.32, c.hood, 0, c.bodyY + 0.33, half - c.hood / 2 - 0.1); // hood bevel
  if (c.trunk > 0) add(c.w - 0.2, 0.32, c.trunk, 0, c.bodyY + 0.33, -half + c.trunk / 2 + 0.1); // trunk bevel
  add(c.w + 0.02, 0.22, 0.35, 0, 0.42, half - 0.15); // front bumper
  add(c.w + 0.02, 0.22, 0.35, 0, 0.42, -half + 0.15); // rear bumper
  add(c.w + 0.02, 0.1, c.len - 0.8, 0, 0.3, 0); // side skirts
  if (c.bed) {
    // Longhaul flat bed: low walls around an open load area.
    add(c.w - 0.1, 0.5, 2.2, 0, 0.85, -1.2); // bed floor + walls (one low box)
    add(0.08, 0.5, 2.2, -c.w / 2 + 0.04, 1.05, -1.2); // bed side wall L
    add(0.08, 0.5, 2.2, c.w / 2 - 0.04, 1.05, -1.2); // bed side wall R
  }
  if (c.cabinLen > 0) {
    // Roof panel is BODY-COLOURED (paint), not glass: a glass roof read as
    // a separate light-grey slab. It caps the glasshouse.
    add(c.w - 0.4, 0.1, c.cabinLen * 0.55, 0, c.cabinY + c.cabinH / 2 + 0.03, c.cabinZ);
  }
  const bodyGeo = mergeGeoms(parts);
  // Cabin: the glasshouse only (dark glass sides + windshield).
  let cabinGeo = null;
  if (c.cabinLen > 0) {
    const cp = [];
    const cadd = (w, h, d, x, y, z) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Matrix4().setPosition(x, y, z);
      cp.push({ geo: g, matrix: m, uvScale: [1, 1] });
    };
    cadd(c.w - 0.24, c.cabinH, c.cabinLen, 0, c.cabinY, c.cabinZ);
    cabinGeo = mergeGeoms(cp);
  }
  // Details: one vertex-coloured mesh per car — grille, chrome bumper
  // strips, side mirrors, spoiler, van window band. One call per car.
  const dp = [];
  const dadd = (w, h, d, x, y, z, color) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Matrix4().setPosition(x, y, z);
    dp.push({ geo: g, matrix: m, uvScale: [1, 1], color });
  };
  const grille = 0x111417; const chrome = 0xb8c0c8; const dark = 0x1a1d20;
  dadd(c.w - 0.5, 0.22, 0.08, 0, 0.62, half + 0.01, grille); // front grille
  dadd(c.w - 0.3, 0.06, 0.06, 0, 0.55, half + 0.02, chrome); // front chrome strip
  dadd(c.w - 0.3, 0.06, 0.06, 0, 0.55, -half - 0.02, chrome); // rear chrome strip
  dadd(0.16, 0.12, 0.3, -c.w / 2 - 0.06, 0.95, 0.9, dark); // mirror L (dark on any colour)
  dadd(0.16, 0.12, 0.3, c.w / 2 + 0.06, 0.95, 0.9, dark); // mirror R
  if (c.spoiler) {
    dadd(c.w - 0.2, 0.06, 0.5, 0, c.bodyY + c.bodyH / 2 + 0.35, -half + 0.3, 0x1a1d20); // spoiler blade
    dadd(0.08, 0.3, 0.08, -c.w / 2 + 0.3, c.bodyY + c.bodyH / 2 + 0.2, -half + 0.3, 0x1a1d20);
    dadd(0.08, 0.3, 0.08, c.w / 2 - 0.3, c.bodyY + c.bodyH / 2 + 0.2, -half + 0.3, 0x1a1d20);
  }
  if (c.van) {
    // Van window band: dark glass strip along both flanks.
    dadd(0.04, 0.4, 3.4, -c.w / 2 - 0.01, 1.15, -0.2, grille);
    dadd(0.04, 0.4, 3.4, c.w / 2 + 0.01, 1.15, -0.2, grille);
    dadd(c.w - 0.2, 0.4, 0.06, 0, 1.15, half + 0.01, grille); // windshield band
  }
  const detailsGeo = mergeColored(dp);
  return { bodyGeo, cabinGeo, detailsGeo };
}

export class Vehicles {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.nextId = 1;
    this.classGeos = new Map(); // class name -> { bodyGeo, cabinGeo, detailsGeo }
    this.bodyMats = new Map();
    // Glass cabin: dark tinted glass that reflects the sky and lets a
    // driver silhouette show through — a solid black box read as a toy.
    // envMap kept modest (1.2): at 2.0 the roof reflected the bright sky
    // and read as a separate light-grey slab on top of the car.
    this.cabinMat = new THREE.MeshStandardMaterial({
      color: 0x1a2836, roughness: 0.15, metalness: 0.9, envMapIntensity: 1.2,
      transparent: true, opacity: 0.85,
    });
    this.detailsMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.35, metalness: 0.5,
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
    // Hubcaps: a silver disc on each wheel (same matrix as the wheel) so
    // the wheels read as wheels, not black blobs. 1 call for all cars.
    const hubGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.3, 10);
    hubGeo.rotateZ(Math.PI / 2);
    this.hubMesh = new THREE.InstancedMesh(
      hubGeo,
      new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 0.9 }),
      120,
    );
    this.hubMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.hubMesh);
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

  geosFor(cls) {
    if (!this.classGeos.has(cls)) this.classGeos.set(cls, classGeos(cls));
    return this.classGeos.get(cls);
  }

  addCar(opts) {
    const id = this.nextId;
    this.nextId += 1;
    const cls = opts.class || (opts.kind === 'police' ? 'police' : 'sedan');
    const cdef = CAR_CLASSES[cls];
    const geos = this.geosFor(cls);
    const group = new THREE.Group();
    const body = new THREE.Mesh(geos.bodyGeo, this.bodyMat(opts.color));
    body.castShadow = true;
    group.add(body);
    if (geos.cabinGeo) {
      const cabin = new THREE.Mesh(geos.cabinGeo, this.cabinMat);
      // Cabin skips the shadow pass: the body already gives the car its
      // ground shadow, and 1 fewer shadow call per car keeps traffic cheap.
      cabin.castShadow = false;
      group.add(cabin);
    }
    // Details (grille, chrome strips, mirrors, spoiler): 1 call per car.
    const details = new THREE.Mesh(geos.detailsGeo, this.detailsMat);
    details.castShadow = false;
    group.add(details);
    // Police light bar: two small boxes that flash red/blue.
    let barR = null; let barB = null;
    if (opts.kind === 'police') {
      barR = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.14, 0.28),
        new THREE.MeshBasicMaterial({ color: 0xff2020 }),
      );
      barR.position.set(-0.32, 1.38, -0.25);
      barB = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.14, 0.28),
        new THREE.MeshBasicMaterial({ color: 0x2040ff }),
      );
      barB.position.set(0.32, 1.38, -0.25);
      group.add(barR, barB);
    }
    group.position.set(opts.x, 0, opts.z);
    group.rotation.y = opts.heading;
    this.scene.add(group);
    const wheelX = cdef.w / 2 - 0.12;
    const car = {
      id, kind: opts.kind || 'sedan', class: cls, color: opts.color,
      group, pos: new THREE.Vector3(opts.x, 0, opts.z),
      heading: opts.heading, speed: 0, steer: 0,
      parked: !!opts.parked, stolen: false, isPolice: opts.kind === 'police',
      isTraffic: !!opts.isTraffic, autopilot: false,
      wheelSlots: [0, 0, 0, 0], headSlots: [0, 0], tailSlots: [0, 0],
      wheelBase: (id - 1) * 4, brake: false, barR, barB,
      // Per-class wheel + light positions (longer cars spread them out).
      wheelPos: [
        [-wheelX, 0.36, cdef.wheelZ], [wheelX, 0.36, cdef.wheelZ],
        [-wheelX, 0.36, -cdef.wheelZ], [wheelX, 0.36, -cdef.wheelZ],
      ],
      lightZ: cdef.len / 2,
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
    // 14 distinct spots (one per parked car — no two cars share a spot).
    const spots = [
      { x: -40, z: 38.5, heading: Math.PI / 2 },
      { x: 20, z: 38.5, heading: Math.PI / 2 },
      { x: 90, z: 61.5, heading: -Math.PI / 2 },
      { x: -120, z: 61.5, heading: -Math.PI / 2 },
      { x: -58.5, z: -20, heading: 0 },
      { x: 41.5, z: 120, heading: Math.PI },
      { x: -40, z: -38.5, heading: Math.PI / 2 },
      { x: 60, z: -38.5, heading: Math.PI / 2 },
      { x: -120, z: -61.5, heading: -Math.PI / 2 },
      { x: 140, z: -61.5, heading: -Math.PI / 2 },
      { x: 38.5, z: -80, heading: 0 },
      { x: 61.5, z: 100, heading: Math.PI },
      { x: -61.5, z: 60, heading: Math.PI },
      { x: -38.5, z: -140, heading: 0 },
    ];
    for (let i = 0; i < PARKED_COUNT; i += 1) {
      const s = spots[i % spots.length];
      // First spot: the pink Marina Sedan by the spawn (the player's car).
      // The rest: a mix of classes so the curb reads as a real street.
      const cls = i === 0 ? 'sedan' : pick(rng, ['sedan', 'sedan', 'sports', 'muscle', 'van', 'truck', 'sedan']);
      this.addCar({
        x: s.x, z: s.z, heading: s.heading + (rng() - 0.5) * 0.06,
        color: i === 0 ? 0xff2e88 : pick(rng, SEDAN_COLORS), parked: true, class: cls,
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
      // Wheels: steer the fronts, spin them all (hubcaps ride the same matrix).
      const spin = (this.wheelSpin.get(car.id) || 0) + (car.speed / 0.36) * dt;
      this.wheelSpin.set(car.id, spin);
      for (let k = 0; k < 4; k += 1) {
        const [wx, wy, wz] = car.wheelPos[k];
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
        this.hubMesh.setMatrixAt(car.wheelSlots[k], m);
      }
      // Headlights / taillights follow the car.
      const fwdX = Math.sin(car.heading); const fwdZ = Math.cos(car.heading);
      const rightX = Math.cos(car.heading); const rightZ = -Math.sin(car.heading);
      for (let k = 0; k < 2; k += 1) {
        const s = k === 0 ? -0.65 : 0.65;
        dummy.position.set(
          car.pos.x + fwdX * car.lightZ + rightX * s,
          0.62, car.pos.z + fwdZ * car.lightZ + rightZ * s,
        );
        dummy.rotation.set(0, car.heading, 0);
        dummy.updateMatrix();
        this.headMesh.setMatrixAt(car.headSlots[k], dummy.matrix);
        dummy.position.set(
          car.pos.x - fwdX * car.lightZ + rightX * s,
          0.62, car.pos.z - fwdZ * car.lightZ + rightZ * s,
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
    this.hubMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.tailMesh.instanceMatrix.needsUpdate = true;
    if (this.tailMesh.instanceColor) this.tailMesh.instanceColor.needsUpdate = true;
  }
}
