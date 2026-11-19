// The player character on foot: an articulated low-poly person (not a blocky
// toy) with a procedural walk/run animation, jump, and AABB collision.
// buildCharacter is shared with pedestrians.js for visual variety.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { angleLerp, circleVsAABB, clamp, mergeColored } from './utils.js';
import { state } from './state.js';

function limb(w, h, d, color, px, py, pz, pivotY, castsShadow = true) {
  const geo = new THREE.BoxGeometry(w, h, d);
  // The limb hangs DOWN from its pivot (shoulder/hip): the box spans
  // [-h, 0] so the mesh origin is the top joint. (The old sign put the box
  // above the pivot — arms stuck straight up past the head, legs hidden
  // inside the torso. Caught by the slice-3 face close-up.)
  geo.translate(0, h / 2 - pivotY, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 }));
  mesh.position.set(px, py, pz);
  // Arms skip the shadow pass (thin, negligible silhouette) — 2 fewer
  // shadow calls per pedestrian, which is what keeps 40 peds affordable.
  // Legs keep their shadows: they define the person's ground silhouette.
  mesh.castShadow = castsShadow;
  return mesh;
}

// Legs: vertex-coloured (dark shoes on the bottom 0.14 m, pants above), so
// a character reads as a person with shoes instead of two coloured sticks.
// One shared vertex-colours material for every leg — the pants colour rides
// in the vertex colours, not the material.
const LEG_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
function legMesh(w, h, d, pants, px, py, pz, pivotY) {
  const geo = new THREE.BoxGeometry(w, h, d);
  // Same hang-down pivot as limb(): the box spans [-h, 0], the mesh origin
  // (hip) is the top joint, so the leg reaches the ground.
  geo.translate(0, h / 2 - pivotY, 0);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const pantsC = new THREE.Color(pants);
  const shoeC = new THREE.Color(0x1a1a1a);
  for (let i = 0; i < pos.count; i += 1) {
    // Shoes are the bottom 0.14 m of the hanging leg.
    const c = pos.getY(i) < -h + 0.14 ? shoeC : pantsC;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, LEG_MAT);
  mesh.position.set(px, py, pz);
  mesh.castShadow = true; // legs define the person's ground silhouette
  return mesh;
}

export function buildCharacter(opts = {}) {
  const skin = opts.skin ?? 0xc98d64;
  const jacket = opts.jacket ?? 0x1f8a8a;
  const pants = opts.pants ?? 0x2c3e63;
  const hair = opts.hair ?? 0x1a1a1a;
  const group = new THREE.Group();
  const legL = legMesh(0.22, 0.85, 0.24, pants, -0.14, 0.88, 0, 0.85);
  const legR = legMesh(0.22, 0.85, 0.24, pants, 0.14, 0.88, 0, 0.85);
  // One vertex-coloured body mesh: torso + head + hair (+ cap + badge).
  // The cap and badge are merged in — 0 extra draw calls.
  const bodyParts = [
    { geo: new THREE.BoxGeometry(0.58, 0.62, 0.32), matrix: new THREE.Matrix4().setPosition(0, 1.2, 0), color: jacket },
    { geo: new THREE.SphereGeometry(0.21, 14, 12), matrix: new THREE.Matrix4().setPosition(0, 1.68, 0), color: skin },
    { geo: new THREE.SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), matrix: new THREE.Matrix4().setPosition(0, 1.71, -0.01), color: hair },
  ];
  // Cartoon face (slice 3, Mu's order): every character — Jay and every NPC —
  // has a clear, visible face: big white eyes + dark pupils, brows, nose,
  // mouth. Merged into the same vertex-coloured body mesh, so a face costs
  // 0 extra draw calls. The face sits on the front (+Z) of the head sphere
  // (centre 1.68, radius 0.21); the hair is a clean hemisphere (0.5π) so the
  // forehead stays clear of the brows.
  const noseC = new THREE.Color(skin).multiplyScalar(0.8).getHex();
  const eyeParts = (sx) => [
    { geo: new THREE.SphereGeometry(0.05, 10, 8), matrix: new THREE.Matrix4().setPosition(sx * 0.075, 1.63, 0.185), color: 0xffffff },
    { geo: new THREE.SphereGeometry(0.026, 8, 6), matrix: new THREE.Matrix4().setPosition(sx * 0.075, 1.63, 0.228), color: 0x141414 },
  ];
  bodyParts.push(
    ...eyeParts(-1), ...eyeParts(1),
    { geo: new THREE.BoxGeometry(0.1, 0.025, 0.03), matrix: new THREE.Matrix4().setPosition(-0.075, 1.665, 0.19), color: hair },
    { geo: new THREE.BoxGeometry(0.1, 0.025, 0.03), matrix: new THREE.Matrix4().setPosition(0.075, 1.665, 0.19), color: hair },
    { geo: new THREE.BoxGeometry(0.05, 0.08, 0.05), matrix: new THREE.Matrix4().setPosition(0, 1.585, 0.2), color: noseC },
    { geo: new THREE.BoxGeometry(0.11, 0.022, 0.03), matrix: new THREE.Matrix4().setPosition(0, 1.52, 0.15), color: 0x7a2a20 },
  );
  if (opts.cap) {
    // Cap crown + brim. Jay wears his backwards; peds wear theirs forward.
    bodyParts.push(
      { geo: new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), matrix: new THREE.Matrix4().setPosition(0, 1.72, -0.01), color: opts.cap },
      { geo: new THREE.BoxGeometry(0.3, 0.04, 0.22), matrix: new THREE.Matrix4().setPosition(0, 1.68, opts.backwards ? -0.24 : 0.24), color: opts.cap },
    );
  }
  if (opts.police) {
    // Gold SAMPD badge on the chest (front-left).
    bodyParts.push(
      { geo: new THREE.BoxGeometry(0.09, 0.09, 0.02), matrix: new THREE.Matrix4().setPosition(0.13, 1.36, 0.17), color: 0xd8b83a },
    );
  }
  const bodyGeo = mergeColored(bodyParts);
  const body = new THREE.Mesh(
    bodyGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }),
  );
  body.castShadow = true;
  const armL = limb(0.17, 0.62, 0.18, jacket, -0.38, 1.44, 0, 0.62, false);
  const armR = limb(0.17, 0.62, 0.18, jacket, 0.38, 1.44, 0, 0.62, false);
  group.add(legL, legR, body, armL, armR);
  // torso/head both point at the merged body (the walk bob moves it as one).
  return { group, legL, legR, armL, armR, torso: body, head: body };
}

export class Player {
  constructor(scene) {
    // Jay Moreno: teal jacket, dark pants, backwards red cap (bible §3).
    const c = buildCharacter({
      skin: 0xc98d64, jacket: 0x1f8a8a, pants: 0x2c3e63, hair: 0x1a1a1a,
      cap: 0xc23a2a, backwards: true,
    });
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
    // Walk bob: the merged body (torso+head+hair) bobs as one piece; the
    // 1.2 m torso height is baked into its geometry, so only the bob offset
    // is applied here. Running leans the torso forward (a runner's lean) —
    // the same lean the fleeing pedestrians use in the cover chase.
    this.parts.torso.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.04 * swing;
    this.parts.torso.rotation.x = clamp(this.speed / PLAYER.runSpeed, 0, 1) * 0.12;
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
