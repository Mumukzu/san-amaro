// Traffic lights at the two boulevard intersections, plus the light state
// the traffic AI reads. Cycle: NS green 7 s, yellow 1.5 s, EW green 7 s,
// yellow 1.5 s. Boulevard is the east-west street at z = 50.
import * as THREE from 'three';

export const LIGHT_INTERSECTIONS = [
  { x: -50, z: 50 },
  { x: 50, z: 50 },
];

const CYCLE = 17;
const NS_GREEN = 7;
const NS_YELLOW = 1.5;
const EW_GREEN = 7;

function makeLamp(color) {
  return new THREE.MeshStandardMaterial({
    color: 0x111111, emissive: color, emissiveIntensity: 0.15,
    roughness: 0.4, metalness: 0.2,
  });
}

function makeHead(mats) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 5.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.6 }),
  );
  pole.position.y = 2.8;
  pole.castShadow = true;
  group.add(pole);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 1.3, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.5, metalness: 0.5 }),
  );
  box.position.y = 5.4;
  box.castShadow = true;
  group.add(box);
  const lampGeo = new THREE.SphereGeometry(0.17, 10, 8);
  const offsets = [5.85, 5.4, 4.95]; // red, yellow, green (top to bottom)
  const colors = [0xff2a1a, 0xffc21a, 0x2aff5a];
  const lamps = [];
  for (let i = 0; i < 3; i += 1) {
    const mat = makeLamp(colors[i]);
    mats.push(mat);
    const lamp = new THREE.Mesh(lampGeo, mat);
    lamp.position.set(0, offsets[i], 0.26);
    group.add(lamp);
    lamps.push(mat);
  }
  return { group, lamps };
}

export class TrafficLights {
  constructor(scene) {
    this.time = 0;
    this.heads = []; // { lamps, axis }
    const mats = [];
    for (const inter of LIGHT_INTERSECTIONS) {
      // One pole per intersection, two heads: one facing the NS traffic,
      // one facing the EW traffic.
      const ns = makeHead(mats);
      ns.group.position.set(inter.x + 9, 0, inter.z + 9);
      ns.group.rotation.y = Math.PI; // face north (toward southbound traffic)
      scene.add(ns.group);
      this.heads.push({ lamps: ns.lamps, axis: 'ns' });
      const ew = makeHead(mats);
      ew.group.position.set(inter.x + 9, 0, inter.z + 9);
      ew.group.rotation.y = -Math.PI / 2; // face east
      ew.group.position.y = 0;
      scene.add(ew.group);
      this.heads.push({ lamps: ew.lamps, axis: 'ew' });
    }
    this.mats = mats;
  }

  stateFor(axis) {
    const t = this.time % CYCLE;
    if (axis === 'ns') {
      if (t < NS_GREEN) return 'green';
      if (t < NS_GREEN + NS_YELLOW) return 'yellow';
      return 'red';
    }
    const e = NS_GREEN + NS_YELLOW;
    if (t >= e && t < e + EW_GREEN) return 'green';
    if (t >= e + EW_GREEN) return 'yellow';
    return 'red';
  }

  update(dt) {
    this.time += dt;
    for (const head of this.heads) {
      const s = this.stateFor(head.axis);
      const [red, yellow, green] = head.lamps;
      red.emissiveIntensity = s === 'red' ? 2.4 : 0.12;
      yellow.emissiveIntensity = s === 'yellow' ? 2.4 : 0.12;
      green.emissiveIntensity = s === 'green' ? 2.4 : 0.12;
    }
  }
}
