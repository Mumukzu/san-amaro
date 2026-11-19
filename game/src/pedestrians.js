// Pedestrians: people walking the sidewalks around blocks, idle chat pairs
// at corners, and fleeing from an active police pursuit. Built from the same
// articulated character as the player, with varied clothing and heights.
import * as THREE from 'three';
import { PED_COUNT, WORLD } from './config.js';
import { clamp, mulberry32, pick, rand } from './utils.js';
import { state } from './state.js';
import { buildCharacter } from './player.js';

const JACKETS = [0xc23a2a, 0x2a6ac2, 0xe8b832, 0x2a7a4a, 0x7a3ab0, 0xd8d4c8, 0x3a3f45, 0xff7a1a];
const SKINS = [0xc98d64, 0x8a5a3a, 0xe8b88a, 0x6a4530, 0xd8a070];
const HAIRS = [0x1a1a1a, 0x4a2a1a, 0x8a8a8a, 0x2a1a0a, 0xb0b0b0];

function sidewalkLoop(bx, bz) {
  return [
    new THREE.Vector3(bx - 40, 0, bz - 40),
    new THREE.Vector3(bx + 40, 0, bz - 40),
    new THREE.Vector3(bx + 40, 0, bz + 40),
    new THREE.Vector3(bx - 40, 0, bz + 40),
  ];
}

export class Pedestrians {
  constructor(scene) {
    this.peds = [];
    const rng = mulberry32(20261119 + 202);
    for (let i = 0; i < PED_COUNT; i += 1) {
      const bx = pick(rng, WORLD.blockAt);
      const bz = pick(rng, WORLD.blockAt);
      const loop = sidewalkLoop(bx, bz);
      const wp = Math.floor(rng() * 4);
      const c = buildCharacter({
        skin: pick(rng, SKINS), jacket: pick(rng, JACKETS),
        pants: pick(rng, [0x2c3e63, 0x3a3f45, 0x6a5a4a, 0x8a8d90]),
        hair: pick(rng, HAIRS),
      });
      const scale = rand(rng, 0.92, 1.08);
      c.group.scale.setScalar(scale);
      scene.add(c.group);
      const chat = i % 8 === 0; // every 8th ped is half of a chat pair
      const ped = {
        parts: c, group: c.group,
        pos: loop[wp].clone(),
        heading: rng() * Math.PI * 2,
        loop, wpIndex: (wp + 1) % 4,
        speed: rand(rng, 1.1, 1.9),
        phase: rng() * Math.PI * 2,
        mode: chat ? 'chat' : 'walk',
        chatTimer: chat ? rand(rng, 4, 10) : 0,
        partner: null,
        down: false, downTimer: 0,
      };
      ped.group.position.copy(ped.pos);
      this.peds.push(ped);
      state.peds.push(ped);
    }
    // Pair chat partners: two chat peds at the same corner face each other.
    const chatters = this.peds.filter((p) => p.mode === 'chat');
    for (let i = 0; i + 1 < chatters.length; i += 2) {
      const a = chatters[i]; const b = chatters[i + 1];
      b.pos.copy(a.pos).add(new THREE.Vector3(1.1, 0, 0.4));
      b.group.position.copy(b.pos);
      a.partner = b; b.partner = a;
    }
  }

  knockDown(pos) {
    // A car hit someone nearby: the nearest ped falls and the crime is noticed.
    let best = null; let bestD = 3;
    for (const p of this.peds) {
      if (p.down) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best) {
      best.down = true;
      best.downTimer = 6;
      best.group.rotation.x = -Math.PI / 2;
      best.group.position.y = 0.3;
      return true;
    }
    return false;
  }

  update(dt) {
    const policePos = state.police ? state.police.car.pos : null;
    for (const p of this.peds) {
      if (p.down) {
        p.downTimer -= dt;
        if (p.downTimer <= 0) {
          p.down = false;
          p.group.rotation.x = 0;
          p.group.position.y = 0;
        }
        continue;
      }
      // Flee an active pursuit.
      let fleeing = false;
      if (policePos) {
        const d = Math.hypot(p.pos.x - policePos.x, p.pos.z - policePos.z);
        if (d < 18) fleeing = true;
      }
      if (p.mode === 'chat' && p.partner && !fleeing) {
        p.chatTimer -= dt;
        // Face the partner, bob gently while talking.
        const dx = p.partner.pos.x - p.pos.x; const dz = p.partner.pos.z - p.pos.z;
        p.heading = Math.atan2(dx, dz);
        p.parts.armR.rotation.x = Math.sin(state.time * 2 + p.phase) * 0.5 - 0.4;
        p.parts.armL.rotation.x = Math.sin(state.time * 1.7 + p.phase) * 0.2;
        if (p.chatTimer <= 0) {
          p.mode = 'walk';
          p.wpIndex = Math.floor(Math.random() * 4);
        }
      } else {
        const target = p.loop[p.wpIndex];
        const dx = target.x - p.pos.x; const dz = target.z - p.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.5) {
          p.wpIndex = (p.wpIndex + 1) % p.loop.length;
          continue;
        }
        let tx = dx / dist; let tz = dz / dist;
        let speed = p.speed;
        if (fleeing && policePos) {
          // Run away from the police car.
          const fx = p.pos.x - policePos.x; const fz = p.pos.z - policePos.z;
          const fd = Math.hypot(fx, fz) || 1;
          tx = fx / fd; tz = fz / fd;
          speed = 3.6;
        }
        const desired = Math.atan2(tx, tz);
        let diff = desired - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += clamp(diff, -4 * dt, 4 * dt);
        p.pos.x += Math.sin(p.heading) * speed * dt;
        p.pos.z += Math.cos(p.heading) * speed * dt;
        p.phase += speed * dt * 3.2;
        const swing = clamp(speed / 3.6, 0.3, 1) * 0.6;
        const s = Math.sin(p.phase);
        p.parts.legL.rotation.x = s * swing;
        p.parts.legR.rotation.x = -s * swing;
        p.parts.armL.rotation.x = -s * swing * 0.8;
        p.parts.armR.rotation.x = s * swing * 0.8;
      }
      p.group.position.set(p.pos.x, p.group.position.y, p.pos.z);
      p.group.rotation.y = p.heading;
    }
  }
}
