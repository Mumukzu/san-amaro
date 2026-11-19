// Minimap: a 2D canvas in the HUD corner. Roads are pre-rendered once to an
// offscreen canvas; each frame draws the player arrow, cars, police and the
// objective marker on top. North is up.
import { WORLD } from './config.js';
import { state } from './state.js';

const SIZE = 200;
const SCALE = SIZE / 640; // world [-320, 320] -> canvas
const toX = (x) => (x + 320) * SCALE;
const toY = (z) => (z + 320) * SCALE;

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.staticLayer = document.createElement('canvas');
    this.staticLayer.width = SIZE;
    this.staticLayer.height = SIZE;
    const c = this.staticLayer.getContext('2d');
    c.fillStyle = 'rgba(16,18,26,0.85)';
    c.fillRect(0, 0, SIZE, SIZE);
    // Blocks.
    c.fillStyle = '#3a3f4a';
    for (const bx of WORLD.blockAt) {
      for (const bz of WORLD.blockAt) {
        c.fillRect(toX(bx - 38), toY(bz - 38), 76 * SCALE, 76 * SCALE);
      }
    }
    // Roads.
    c.strokeStyle = '#7a7f8a';
    c.lineWidth = 16 * SCALE;
    for (const r of WORLD.roadAt) {
      c.beginPath(); c.moveTo(toX(r), 0); c.lineTo(toX(r), SIZE); c.stroke();
      c.beginPath(); c.moveTo(0, toY(r)); c.lineTo(SIZE, toY(r)); c.stroke();
    }
    // Plaza.
    c.fillStyle = '#5a6a7a';
    c.beginPath(); c.arc(toX(0), toY(0), 12 * SCALE, 0, Math.PI * 2); c.fill();
    // Cardinal letters at the four edges (N top, S bottom, E right, W
    // left) — north is up, so they are fixed, not rotated.
    c.fillStyle = '#e8e8e8';
    c.font = 'bold 13px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('N', SIZE / 2, 14);
    c.fillText('S', SIZE / 2, SIZE - 6);
    c.fillText('E', SIZE - 8, SIZE / 2 + 5);
    c.fillText('W', 8, SIZE / 2 + 5);
  }

  update() {
    const c = this.ctx;
    c.clearRect(0, 0, SIZE, SIZE);
    c.drawImage(this.staticLayer, 0, 0);
    // Objective marker (pulsing pink diamond).
    if (state.marker) {
      const pulse = 5 + Math.sin(state.time * 4) * 1.5;
      c.fillStyle = '#ff2e88';
      c.beginPath();
      c.moveTo(toX(state.marker.x), toY(state.marker.z) - pulse - 3);
      c.lineTo(toX(state.marker.x) + pulse, toY(state.marker.z));
      c.lineTo(toX(state.marker.x), toY(state.marker.z) + pulse + 3);
      c.lineTo(toX(state.marker.x) - pulse, toY(state.marker.z));
      c.closePath(); c.fill();
    }
    // Traffic (yellow) and parked cars (grey).
    for (const car of state.cars) {
      if (car.isPolice) continue;
      c.fillStyle = car.parked ? '#9a9a9a' : '#ffd23e';
      c.beginPath();
      c.arc(toX(car.pos.x), toY(car.pos.z), car.parked ? 2.5 : 3, 0, Math.PI * 2);
      c.fill();
    }
    // Police (flashing red/blue). VICTOR-7 is a second dot when it exists.
    if (state.police) {
      c.fillStyle = Math.floor(state.time * 4) % 2 === 0 ? '#ff2020' : '#2040ff';
      c.beginPath();
      c.arc(toX(state.police.car.pos.x), toY(state.police.car.pos.z), 4.5, 0, Math.PI * 2);
      c.fill();
    }
    if (state.police2) {
      c.fillStyle = Math.floor(state.time * 4 + 1) % 2 === 0 ? '#ff2020' : '#2040ff';
      c.beginPath();
      c.arc(toX(state.police2.car.pos.x), toY(state.police2.car.pos.z), 4, 0, Math.PI * 2);
      c.fill();
    }
    // Player arrow (white, rotated by heading).
    const p = state.player ? state.player.pos : { x: 0, z: 0 };
    const heading = state.inCar && state.vehicle ? state.vehicle.heading : (state.player ? state.player.heading : 0);
    c.save();
    c.translate(toX(p.x), toY(p.z));
    // Arrow is drawn pointing up; rotate it to the heading (map: x right, z down).
    c.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)));
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2.5); c.lineTo(-5, 5); c.closePath();
    c.fill();
    c.restore();
  }
}
