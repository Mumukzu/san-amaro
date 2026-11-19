// The player character on foot: an articulated low-poly person (not a blocky
// toy) with a procedural walk/run animation, jump, and AABB collision.
// buildCharacter is shared with pedestrians.js for visual variety.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { angleLerp, circleVsAABB, clamp } from './utils.js';
import { state } from './state.js';

function limb(w, h, d, color, px, py, pz, pivotY) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, -h / 2 + pivotY, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 }));
  mesh.position.set(px, py, pz);
  mesh.castShadow = true;
  return mesh;
}

export function buildCharacter(opts = {}) {
  const skin = opts.skin ?? 0xc98d64;
  const jacket = opts.jacket ?? 0x1f8a8a;
  const pants = opts.pants ?? 0x2c3e63;
  const hair = opts.hair ?? 0x1a1a1a;
  const group = new THREE.Group();
  const legL = limb(0.22, 0.85, 0.24, pants, -0.14, 0.88, 0, 0.85);
  const legR = limb(0.22, 0.85, 0.24, pants, 0.14, 0.88, 0, 0.85);
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.62, 0.32),
    new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.8, metalness: 0 }),
  );
  torso.position.set(0, 1.2, 0);
  torso.castShadow = true;
  const armL = limb(0.17, 0.62, 0.18, jacket, -0.38, 1.44, 0, 0.62);
  const armR = limb(0.17, 0.62, 0.18, jacket, 0.38, 1.44, 0, 0.62);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 14, 12),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7, metalness: 0 }),
  );
  head.position.set(0, 1.68, 0);
  head.castShadow = true;
  const hairMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: hair, roughness: 0.95, metalness: 0 }),
  );
  hairMesh.position.set(0, 1.71, -0.01);
  group.add(legL, legR, torso, armL, armR, head, hairMesh);
  return { group, legL, legR, armL, armR, torso, head };
}

export class Player {
  constructor(scene) {
    const c = buildCharacter({});
    this.parts = c;
    this.group = c.group;
    scene.add(this.group);
    this.pos = new THREE.Vector3(10, 0, 60); // spawn on the boulevard sidewalk
    this.vel = new THREE.Vector3();
    this.heading = Math.PI; // face north, down the boulevard
    this.vy = 0;
    this.grounded = true;
    this.walkPhase = 0;
    this.speed = 0;
  }

  update(dt, input, cameraYaw) {
    const run = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    const maxSpeed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let ix = 0; let iz = 0;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) iz -= 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) iz += 1;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) ix -= 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) ix += 1;
    const len = Math.hypot(ix, iz);
    let targetVx = 0; let targetVz = 0;
    if (len > 0) {
      ix /= len; iz /= len;
      // Input is relative to the camera: W moves away from the camera.
      // Camera forward on the ground is (-sin yaw, -cos yaw); right is (cos yaw, -sin yaw).
      const sin = Math.sin(cameraYaw); const cos = Math.cos(cameraYaw);
      const wx = ix * cos + iz * sin;
      const wz = -ix * sin + iz * cos;
      targetVx = wx * maxSpeed;
      targetVz = wz * maxSpeed;
      const targetHeading = Math.atan2(wx, wz);
      this.heading = angleLerp(this.heading, targetHeading, 1 - Math.exp(-12 * dt));
    }
    const accel = this.grounded ? 14 : 6;
    this.vel.x += (targetVx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (targetVz - this.vel.z) * Math.min(1, accel * dt);

    // Jump.
    if (input.keys['Space'] && this.grounded) {
      this.vy = PLAYER.jumpSpeed;
      this.grounded = false;
    }
    this.vy -= 22 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.grounded = true; }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    // Collision: push out of every building AABB, and stay inside the world.
    for (const box of state.colliders) {
      const p = circleVsAABB(this.pos.x, this.pos.z, PLAYER.radius, box);
      if (p) { this.pos.x = p.x; this.pos.z = p.z; }
    }
    this.pos.x = clamp(this.pos.x, -305, 305);
    this.pos.z = clamp(this.pos.z, -305, 305);

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    // Walk animation: limbs swing with speed, torso bobs.
    this.walkPhase += this.speed * dt * 1.9;
    const swing = clamp(this.speed / PLAYER.runSpeed, 0, 1) * 0.75;
    const s = Math.sin(this.walkPhase);
    this.parts.legL.rotation.x = s * swing;
    this.parts.legR.rotation.x = -s * swing;
    this.parts.armL.rotation.x = -s * swing * 0.8;
    this.parts.armR.rotation.x = s * swing * 0.8;
    this.parts.torso.position.y = 1.2 + Math.abs(Math.cos(this.walkPhase)) * 0.04 * swing;
    if (this.speed < 0.2) {
      this.parts.legL.rotation.x *= 0.2;
      this.parts.legR.rotation.x *= 0.2;
      this.parts.armL.rotation.x = Math.sin(state.time * 1.2) * 0.05;
      this.parts.armR.rotation.x = -Math.sin(state.time * 1.2) * 0.05;
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    state.speed = this.speed;
  }
}
