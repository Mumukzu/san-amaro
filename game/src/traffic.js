// Traffic: AI cars on rectangular loops around blocks, driving on the right
// side of the road, stopping at red lights and behind the car ahead.
// Loops run around the four tower-ring blocks so the boulevard stays busy.
import * as THREE from 'three';
import { TRAFFIC_COUNT } from './config.js';
import { angleLerp, clamp, mulberry32, pick, rand } from './utils.js';
import { state } from './state.js';

const LOOP_BLOCKS = [
  [-100, -100], [100, -100], [-100, 100], [100, 100],
];

function loopWaypoints(bx, bz) {
  // Clockwise around the block, 4 m off the road centre on the block side.
  return [
    new THREE.Vector3(bx - 46, 0, bz - 46),
    new THREE.Vector3(bx + 46, 0, bz - 46),
    new THREE.Vector3(bx + 46, 0, bz + 46),
    new THREE.Vector3(bx - 46, 0, bz + 46),
  ];
}

export class Traffic {
  constructor(scene, vehicles, lights) {
    this.vehicles = vehicles;
    this.lights = lights;
    this.cars = [];
    const rng = mulberry32(20261119 + 101);
    const colors = [0x3a6ac2, 0xd8d4c8, 0x2a7a4a, 0x8a8d90, 0xc26a2a, 0x5a3ab0];
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const [bx, bz] = LOOP_BLOCKS[i % LOOP_BLOCKS.length];
      const loop = loopWaypoints(bx, bz);
      const wp = Math.floor(i / LOOP_BLOCKS.length); // stagger along the loop
      const start = loop[wp % 4];
      const car = vehicles.addCar({
        x: start.x + (rng() - 0.5) * 4, z: start.z + (rng() - 0.5) * 4,
        heading: Math.atan2(1, 0), color: pick(rng, colors), isTraffic: true,
        // Traffic mixes classes too — vans and trucks on the road, not
        // only sedans, so the moving traffic reads as a real street.
        class: pick(rng, ['sedan', 'sedan', 'sedan', 'sports', 'muscle', 'van', 'truck']),
      });
      car.autopilot = true;
      car.parked = false;
      this.cars.push({
        car, loop, wpIndex: (wp + 1) % 4,
        cruise: rand(rng, 8, 12),
      });
      state.traffic.push(car);
    }
  }

  // Is a red/yellow light ahead of this car on its current heading?
  lightAhead(t, intersections) {
    const car = t.car;
    const fwdX = Math.sin(car.heading); const fwdZ = Math.cos(car.heading);
    for (const inter of intersections) {
      const dx = inter.x - car.pos.x; const dz = inter.z - car.pos.z;
      const along = dx * fwdX + dz * fwdZ;
      if (along < 2 || along > 12) continue;
      const across = Math.abs(dx * fwdZ - dz * fwdX);
      if (across > 6) continue;
      const axis = Math.abs(fwdX) > Math.abs(fwdZ) ? 'ew' : 'ns';
      if (this.lights.stateFor(axis) !== 'green') return true;
    }
    return false;
  }

  // Is another car close ahead?
  carAhead(t) {
    const car = t.car;
    const fwdX = Math.sin(car.heading); const fwdZ = Math.cos(car.heading);
    for (const other of this.vehicles.cars) {
      if (other === car) continue;
      const dx = other.pos.x - car.pos.x; const dz = other.pos.z - car.pos.z;
      const along = dx * fwdX + dz * fwdZ;
      if (along < 1 || along > 8) continue;
      const across = Math.abs(dx * fwdZ - dz * fwdX);
      if (across < 3) return true;
    }
    return false;
  }

  update(dt, intersections) {
    for (const t of this.cars) {
      const car = t.car;
      const target = t.loop[t.wpIndex];
      const dx = target.x - car.pos.x; const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        t.wpIndex = (t.wpIndex + 1) % t.loop.length;
        continue;
      }
      const desired = Math.atan2(dx, dz);
      let diff = desired - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = 2.2;
      car.heading += clamp(diff, -turnRate * dt, turnRate * dt);
      // Slow for corners, stop for lights and traffic ahead.
      let targetSpeed = t.cruise * clamp(1 - Math.abs(diff) * 0.4, 0.35, 1);
      if (this.lightAhead(t, intersections) || this.carAhead(t)) targetSpeed = 0;
      const accel = targetSpeed > car.speed ? 6 : 14;
      car.speed += clamp(targetSpeed - car.speed, -accel * dt, accel * dt);
      const fwdX = Math.sin(car.heading); const fwdZ = Math.cos(car.heading);
      car.pos.x += fwdX * car.speed * dt;
      car.pos.z += fwdZ * car.speed * dt;
      car.steer = clamp(diff * 1.5, -0.5, 0.5);
      this.vehicles.collideCar(car, dt);
    }
  }
}
