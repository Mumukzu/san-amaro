// Wanted level + police pursuit (baseline: 0-3 stars, one cruiser).
// Stealing a car or hitting a pedestrian raises heat; the cruiser chases with
// a simple pursuit steer; getting far away for a while cools the heat down.
// Getting caught at low speed means BUSTED.
import * as THREE from 'three';
import { POLICE } from './config.js';
import { clamp } from './utils.js';
import { bus, state } from './state.js';

export class Police {
  constructor(scene, vehicles) {
    this.scene = scene;
    this.vehicles = vehicles;
    this.cruiser = null;
    this.bustTimer = 0;
    this.escapeTimer = 0;
    this.escapeStart = 0;
  }

  setWanted(n) {
    const next = clamp(n, 0, POLICE.maxWanted);
    if (next !== state.wanted) {
      state.wanted = next;
      bus.emit('wanted', next);
      if (next === 0) this.despawn();
    }
  }

  crime(level) {
    if (level > state.wanted) this.setWanted(level);
  }

  spawnCruiserNear(pos) {
    // Spawn on the nearest road, ~55 m away from the player.
    const roads = [-250, -150, -50, 50, 150, 250];
    let best = null; let bestD = 1e9;
    for (const r of roads) {
      for (const along of [-260, 260]) {
        const d = Math.hypot(r - pos.x, along - pos.z);
        if (d > 45 && d < bestD) { bestD = d; best = { x: r, z: along }; }
        const d2 = Math.hypot(along - pos.x, r - pos.z);
        if (d2 > 45 && d2 < bestD) { bestD = d2; best = { x: along, z: r }; }
      }
    }
    const s = best || { x: pos.x + 60, z: pos.z };
    const heading = Math.atan2(pos.x - s.x, pos.z - s.z);
    const car = this.vehicles.spawnPolice(s.x, s.z, heading);
    this.cruiser = { car };
    state.police = this.cruiser;
    return this.cruiser;
  }

  despawn() {
    if (!this.cruiser) return;
    const car = this.cruiser.car;
    this.scene.remove(car.group);
    this.vehicles.cars = this.vehicles.cars.filter((c) => c !== car);
    state.cars = state.cars.filter((c) => c !== car);
    this.cruiser = null;
    state.police = null;
    this.bustTimer = 0;
    this.escapeTimer = 0;
  }

  update(dt, onBusted) {
    if (state.wanted <= 0) return;
    const playerPos = state.inCar && state.vehicle ? state.vehicle.pos : state.player.pos;
    const playerSpeed = state.speed;
    if (!this.cruiser) {
      this.spawnCruiserNear(playerPos);
      return;
    }
    const car = this.cruiser.car;
    // Pursuit: steer toward the player's position with a little lead.
    const lead = 0.4;
    const tx = playerPos.x + Math.sin(state.player?.heading || 0) * playerSpeed * lead * 0.3;
    const tz = playerPos.z + Math.cos(state.player?.heading || 0) * playerSpeed * lead * 0.3;
    const dx = tx - car.pos.x; const dz = tz - car.pos.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    let diff = desired - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = clamp(diff * 1.8, -0.55, 0.55);
    const throttle = dist > 6 ? 1 : 0.4;
    this.vehicles.drive(car, dt, throttle, steer / 0.55, false, false);
    car.speed = Math.min(car.speed, POLICE.chaseSpeed);

    // Busted: caught at close range while slow.
    if (dist < POLICE.bustDistance && playerSpeed < 3) {
      this.bustTimer += dt;
      if (this.bustTimer >= POLICE.bustTime) {
        this.bustTimer = 0;
        onBusted();
        return;
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
    // Escape: far away for long enough cools one star at a time.
    if (dist > POLICE.escapeDistance) {
      this.escapeTimer += dt;
      if (this.escapeTimer >= POLICE.escapeTime) {
        this.escapeTimer = 0;
        const escapedFor = state.wanted;
        this.setWanted(state.wanted - 1);
        if (escapedFor > state.wanted && state.wanted === 0) {
          state.bestEscape = Math.max(state.bestEscape, 1);
        }
      }
    } else {
      this.escapeTimer = 0;
    }
  }
}
