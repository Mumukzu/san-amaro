// Third-person camera: mouse orbit with pull-in on walls, a lower chase
// camera while driving, and a fixed cinematic mode for screenshot staging.
import * as THREE from 'three';
import { clamp, damp, pointInAABB } from './utils.js';
import { state } from './state.js';

export class Camera {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.yaw = 0;
    this.pitch = 0.32;
    this.dist = 7.5;
    this.mode = 'follow'; // follow | drive | cinematic
    this.cinePos = new THREE.Vector3(0, 25, 90);
    this.cineTarget = new THREE.Vector3(0, 5, -100);
    this.fov = 62;
    this.shake = 0; // cinematic handheld shake (metres) — the cover chase
    // uses a touch of it so the frame feels caught live, not tripod-still.
  }

  addOrbit(dx, dy) {
    this.yaw -= dx * 0.0032;
    this.pitch = clamp(this.pitch + dy * 0.0028, -0.1, 1.1);
  }

  setCinematic(pos, target) {
    this.mode = 'cinematic';
    this.cinePos.copy(pos);
    this.cineTarget.copy(target);
    // Staged shots are framed at the base FOV: the drive camera widens it
    // with speed, and a wide FOV would carry over into the next shot.
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
  }

  update(dt, focusPos, focusHeading, speed) {
    const cam = this.camera;
    if (this.mode === 'cinematic') {
      cam.position.copy(this.cinePos);
      if (this.shake > 0) {
        // Handheld micro-jitter: a few centimetres, different every frame,
        // so a staged shot reads as caught live. Kept tiny — the framing
        // is staged, only the feel is handheld.
        cam.position.x += (Math.random() - 0.5) * this.shake;
        cam.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      }
      cam.lookAt(this.cineTarget);
      return;
    }
    const driving = this.mode === 'drive';
    const dist = driving ? 9.5 : this.dist;
    const height = driving ? 3.2 : 2.6;
    const pitch = driving ? 0.24 : this.pitch;
    // Driving camera sits behind the car; on foot it orbits freely.
    const yaw = driving ? focusHeading + Math.PI : this.yaw;
    const cx = Math.sin(yaw) * Math.cos(pitch);
    const cz = Math.cos(yaw) * Math.cos(pitch);
    const cy = Math.sin(pitch);
    // Pull-in: shorten the boom if the camera would sit inside a building.
    let useDist = dist;
    for (let d = dist; d > 2; d -= 1) {
      const px = focusPos.x + cx * d;
      const pz = focusPos.z + cz * d;
      const py = focusPos.y + height + cy * d;
      let inside = false;
      for (const box of state.colliders) {
        if (pointInAABB(px, pz, box, 0.6)) { inside = true; break; }
      }
      if (!inside && py > 0.6) { useDist = d; break; }
      useDist = d;
    }
    const tx = focusPos.x + cx * useDist;
    const tz = focusPos.z + cz * useDist;
    const ty = focusPos.y + height + cy * useDist;
    const k = damp(driving ? 10 : 14, dt);
    cam.position.x += (tx - cam.position.x) * k;
    cam.position.y += (ty - cam.position.y) * k;
    cam.position.z += (tz - cam.position.z) * k;
    cam.lookAt(focusPos.x, focusPos.y + 1.6, focusPos.z);
    // Speed-based FOV while driving.
    const targetFov = driving ? 62 + clamp(speed / 32, 0, 1) * 10 : 62;
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov += (targetFov - cam.fov) * damp(4, dt);
      cam.updateProjectionMatrix();
    }
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
