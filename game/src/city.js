// SAN AMARO — city builder (Downtown Core slice + canal + lift bridge).
// Written from scratch from the re-author spec. Every mesh is procedural:
// no textures from files, no imported models. Seeded so the city is identical
// on every load (the screenshots must be reproducible).
//
// The city plan comes from ./city-layout.js — a pure, layout-first module
// (roads first, plots inset from the streets, buildings only inside plots,
// trees/lamps/furniture in the planting strip, and a 10-check validator
// that FIXES violations). buildCity turns that plan into meshes.
const THREE = globalThis.THREE;
import {
  buildLayout, fixLayout, validationSummary, validationBadge,
  roadHalfWidth, streetClass, STREETS,
} from './city-layout.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261119);
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function range(a, b) { return a + rand() * (b - a); }

// ---- canvas texture helpers (all procedural) ----
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Windows: a grid of panes, some lit warm gold (dusk), some dark.
// base = facade tint, lit = fraction of windows lit.
function windowTexture(base, lit) {
  const cols = 8, rows = 14;
  return canvasTex(256, 448, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const isLit = rand() < lit;
        const px = x * cw + 3, py = y * ch + 4;
        if (isLit) {
          // Calm amber: dimmed so lit windows read as warm rooms, not a
          // blazing wall (the old near-white golds blew out under bloom).
          const warm = pick(['#c98a3d', '#b87a2e', '#d9a55a', '#a86a2a', '#6ab8c8', '#d97a9a', '#7ac8a0', '#a88ac8', '#cfd8e8', '#c98a3d']);
          g.fillStyle = warm; g.fillRect(px, py, cw - 6, ch - 8);
          g.fillStyle = 'rgba(255,255,255,.08)';
          g.fillRect(px, py, cw - 6, 3);
        } else {
          g.fillStyle = 'rgba(8,12,26,.85)'; g.fillRect(px, py, cw - 6, ch - 8);
          g.fillStyle = 'rgba(255,255,255,.06)';
          g.fillRect(px, py, cw - 6, 3);
        }
      }
    }
    // subtle vertical grime
    g.fillStyle = 'rgba(0,0,0,.08)';
    for (let i = 0; i < 6; i++) g.fillRect(rand() * w, 0, 6, h);
  });
}

// Asphalt with a faint centre sheen (wet road).
function asphaltTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#23232e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${rand() * 0.05})`;
      g.fillRect(rand() * w, rand() * h, 2, 2);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.08})`;
      g.fillRect(rand() * w, rand() * h, 20 + rand() * 40, 8 + rand() * 20);
    }
  });
}

// Neon sign face: bold text on a dark plate, glowing colour.
function signTexture(text, fg, bg) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.font = '900 64px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = 22;
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function glowTexture(inner, outer) {
  return canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    r.addColorStop(0, inner); r.addColorStop(0.45, outer); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}

// ---- materials (shared) ----
const MAT = {};
function initMaterials() {
  MAT.asphalt = new THREE.MeshStandardMaterial({
    map: asphaltTexture(), roughness: 0.55, metalness: 0.28, envMapIntensity: 0.9,
  });
  MAT.asphalt.map.wrapS = MAT.asphalt.map.wrapT = THREE.RepeatWrapping;
  MAT.sidewalk = new THREE.MeshStandardMaterial({ color: 0x8a8290, roughness: 0.9, metalness: 0.05 });
  MAT.concrete = new THREE.MeshStandardMaterial({ color: 0x6f6a72, roughness: 0.95, metalness: 0.02 });
  MAT.canalWall = new THREE.MeshStandardMaterial({ color: 0x5a5560, roughness: 0.9, metalness: 0.05 });
  MAT.steel = new THREE.MeshStandardMaterial({ color: 0x2e4a3f, roughness: 0.5, metalness: 0.75 });
  MAT.steelDark = new THREE.MeshStandardMaterial({ color: 0x22362e, roughness: 0.55, metalness: 0.7 });
  MAT.trunk = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 });
  MAT.frond = new THREE.MeshStandardMaterial({ color: 0x2f7a3d, roughness: 0.85, side: THREE.DoubleSide });
  // Shade tree: a round leafy canopy (a second tree type, so the streets
  // are not a monoculture of palms). Two canopy tints for variety.
  MAT.canopy = new THREE.MeshStandardMaterial({ color: 0x3f8a4a, roughness: 0.9 });
  MAT.canopy2 = new THREE.MeshStandardMaterial({ color: 0x5a9a3f, roughness: 0.9 });
  MAT.benchWood = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.85 });
  MAT.benchIron = new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.5, metalness: 0.6 });
  MAT.binMetal = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.45, metalness: 0.7 });
  MAT.signalPole = new THREE.MeshStandardMaterial({ color: 0x2e2e34, roughness: 0.5, metalness: 0.6 });
  MAT.signalRed = new THREE.MeshStandardMaterial({ color: 0x3a0d0d, emissive: 0xff2a1a, emissiveIntensity: 1.4 });
  MAT.signalGreen = new THREE.MeshStandardMaterial({ color: 0x0d2a12, emissive: 0x2aff5a, emissiveIntensity: 0.9 });
  MAT.signalAmber = new THREE.MeshStandardMaterial({ color: 0x2a1d08, emissive: 0xffb02a, emissiveIntensity: 0.7 });
  // Puddle: a dark, glossy decal that catches the sunset (wet-road look).
  MAT.puddle = new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.08, metalness: 0.9, envMapIntensity: 1.6 });
  MAT.crosswalk = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.8 });
  MAT.stopLine = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });
  MAT.lampPole = new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.5, metalness: 0.6 });
  MAT.glass = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.12, metalness: 0.9, envMapIntensity: 1.4 });
  MAT.water = new THREE.MeshStandardMaterial({
    color: 0x1b6a7d, roughness: 0.14, metalness: 0.88, envMapIntensity: 1.5,
  });
  MAT.roof = new THREE.MeshStandardMaterial({ color: 0x3a3640, roughness: 0.95 });
  MAT.bridgeDeck = new THREE.MeshStandardMaterial({ color: 0x2e3a4a, roughness: 0.9, metalness: 0.1 });
  MAT.awningPink = new THREE.MeshStandardMaterial({ color: 0xd94f7a, roughness: 0.7 });
  MAT.awningTeal = new THREE.MeshStandardMaterial({ color: 0x2fa8a0, roughness: 0.7 });
  MAT.awningGold = new THREE.MeshStandardMaterial({ color: 0xe8a33d, roughness: 0.7 });
  MAT.awningPurple = new THREE.MeshStandardMaterial({ color: 0x8a5ac8, roughness: 0.7 });
  MAT.awningCyan = new THREE.MeshStandardMaterial({ color: 0x2fa8d8, roughness: 0.7 });
}

// ---- small builders ----
function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  (parent || sceneRoot).add(m);
  return m;
}
let sceneRoot = null;
const glowTexWarm = glowTexture('rgba(255,190,90,1)', 'rgba(255,140,40,.55)');
const glowTexPink = glowTexture('rgba(255,80,160,1)', 'rgba(255,46,136,.5)');
const glowTexCyan = glowTexture('rgba(80,230,255,1)', 'rgba(34,230,255,.45)');

function addGlow(parent, x, y, z, scale, tex) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85,
  }));
  s.position.set(x, y, z); s.scale.set(scale, scale, 1);
  parent.add(s);
  return s;
}

// (Palms and lamps are now instanced from the layout — see the vegetation
// section in buildCity — so the old per-tree/per-lamp group builders are
// gone. The instanced versions use the same shapes: a tapered trunk + 7
// fronds for a palm, a pole + arm + head + bulb for a lamp.)

// A shade tree: a short trunk + a round leafy canopy (two overlapping
// spheres, so the silhouette is not a perfect ball). The second tree type
// — palms line the main avenues, shade trees the side streets and yards.
function makeShadeTree(x, z, s, parent) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 2.2 * s, 6), MAT.trunk);
  trunk.position.y = 1.1 * s; g.add(trunk);
  const canopyMat = rand() < 0.5 ? MAT.canopy : MAT.canopy2;
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(1.5 * s, 10, 8), canopyMat);
  c1.position.y = 3.1 * s; c1.scale.y = 0.85; g.add(c1);
  const c2 = new THREE.Mesh(new THREE.SphereGeometry(1.0 * s, 8, 6), canopyMat);
  c2.position.set(0.7 * s, 3.7 * s, 0.3 * s); g.add(c2);
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

// A street bench: wooden slats on an iron frame, long side parallel to the
// road (axis 'x' = the bench runs east-west). 2.6 m long, 1.0 m deep —
// exactly the footprint the layout validator checks.
function makeBench(x, z, axis, parent) {
  const g = new THREE.Group();
  for (const dz of [-0.35, 0, 0.35]) {
    const slat = box(2.6, 0.08, 0.22, MAT.benchWood, 0, 0.45, dz, g);
    slat.castShadow = false;
  }
  const back = box(2.6, 0.5, 0.08, MAT.benchWood, 0, 0.85, -0.42, g);
  back.rotation.x = -0.15;
  for (const dx of [-1.1, 1.1]) {
    box(0.08, 0.45, 0.9, MAT.benchIron, dx, 0.22, 0, g);
  }
  g.position.set(x, 0, z);
  if (axis === 'z') g.rotation.y = Math.PI / 2;
  parent.add(g);
  return g;
}

// A litter bin: a short cylinder with a domed lid.
function makeBin(x, z, parent) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.34, 0.85, 10), MAT.binMetal);
  body.position.y = 0.43; g.add(body);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.binMetal);
  lid.position.y = 0.85; g.add(lid);
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

// A traffic signal: a pole on the corner + a horizontal arm over the road
// + a 3-light head (red on top, green lit at dusk).
function makeTrafficSignal(x, z, parent) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6), MAT.signalPole);
  pole.position.y = 2.7; g.add(pole);
  const arm = box(2.6, 0.12, 0.12, MAT.signalPole, 1.3, 5.3, 0, g);
  const head = box(0.42, 1.1, 0.42, MAT.signalPole, 2.4, 4.9, 0, g);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.05), MAT.signalRed);
  red.position.set(2.4, 5.25, 0.22); g.add(red);
  const amber = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.05), MAT.signalAmber);
  amber.position.set(2.4, 4.9, 0.22); g.add(amber);
  const green = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.05), MAT.signalGreen);
  green.position.set(2.4, 4.55, 0.22); g.add(green);
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

// A street-name sign: a pole + a plate with the street name in white on green.
function makeStreetSign(x, z, text, parent) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6), MAT.signalPole);
  pole.position.y = 1.7; g.add(pole);
  const tex = canvasTex(512, 96, (gc, w, h) => {
    gc.fillStyle = '#0d5c2e'; gc.fillRect(0, 0, w, h);
    gc.strokeStyle = '#ffffff'; gc.lineWidth = 4; gc.strokeRect(4, 4, w - 8, h - 8);
    gc.fillStyle = '#ffffff'; gc.font = '900 52px system-ui, sans-serif';
    gc.textAlign = 'center'; gc.textBaseline = 'middle';
    gc.fillText(text, w / 2, h / 2 + 2);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
  plate.position.y = 3.2; g.add(plate);
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

// A crosswalk: white stripes across the road at one approach of an
// intersection. axis 'x' = the road being crossed runs east-west (along
// x); the stripes span its width (z, 2*half) and are spaced along x.
// axis 'z' = the road runs north-south; stripes span x, spaced along z.
// (x, z) is the centre of the crossing.
function makeCrosswalk(x, z, axis, half, parent) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const off = (i - 2.5) * 1.6;
    const w = axis === 'x' ? 0.7 : half * 2;
    const d = axis === 'x' ? half * 2 : 0.7;
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(w, d), MAT.crosswalk);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(axis === 'x' ? off : 0, 0.05, axis === 'x' ? 0 : off);
    g.add(stripe);
  }
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

// A stop line: a solid white bar across the road at an intersection
// approach. axis 'x' = the road runs east-west, so the bar is thin in x
// and spans the road width in z.
function makeStopLine(x, z, axis, half, parent) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(
    new THREE.PlaneGeometry(axis === 'x' ? 0.6 : half * 2, axis === 'x' ? half * 2 : 0.6),
    MAT.stopLine);
  bar.rotation.x = -Math.PI / 2;
  bar.position.y = 0.05;
  g.add(bar);
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

// A puddle: a flat, glossy ellipse on the asphalt that catches the sunset.
function makePuddle(x, z, rx, rz, parent) {
  const p = new THREE.Mesh(new THREE.CircleGeometry(1, 18), MAT.puddle);
  p.rotation.x = -Math.PI / 2;
  p.scale.set(rx, rz, 1);
  p.position.set(x, 0.04, z);
  parent.add(p);
  return p;
}

// (Street coordinates now come from the layout module — STREETS — so the
// old fixed STREET_Z / STREET_X / STREET_W constants are gone.)
const CANAL = { z0: -262, z1: -302, x0: -330, x1: 330 }; // water strip (north edge)
const BRIDGE = { x: 0, z: -282 };

export function buildCity(scene) {
  sceneRoot = scene;
  initMaterials();
  // The city plan: roads first, plots inset from the streets, buildings
  // only inside plots, trees/lamps/furniture in the planting strip — all
  // run through the 10-check validator, which FIXES any violation. The
  // plan we build from is therefore guaranteed clean (0 violations). The
  // summary is exposed on refs so the HUD can show it and main.js can
  // report it.
  const rawLayout = buildLayout(20261119);
  const fixed = fixLayout(rawLayout, 3);
  const layout = fixed.layout;
  const cityValidation = fixed.report;
  const citySummary = validationSummary(cityValidation);
  const cityBadge = validationBadge(cityValidation);
  const refs = { water: null, ripples: [], bridge: null, sign: null, palms: [], lamps: [], layout, cityValidation, citySummary, cityBadge };

  // Sky handled in main.js (gradient dome + sun). Here: ground + streets.
  // Base ground (the whole island slab).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760),
    new THREE.MeshStandardMaterial({ color: 0x2e2b33, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0);
  scene.add(ground);

  // Streets (asphalt strips) + sidewalks, driven by the layout: each
  // street gets its own half-width (main avenues 7 m, secondary 6 m,
  // residential 5 m), so the avenues genuinely read wider than the side
  // streets. Sidewalks sit at half-width + 1.6 m on both sides.
  const streetMat = MAT.asphalt;
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.7 });
  for (const road of layout.roads) {
    const half = roadHalfWidth(road.cls);
    const w = half * 2;
    if (road.axis === 'x') {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(560, w), streetMat);
      s.rotation.x = -Math.PI / 2; s.position.set(0, 0.02, road.coord);
      scene.add(s);
      for (const dz of [-half - 1.6, half + 1.6]) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(560, 3.2), MAT.sidewalk);
        sw.rotation.x = -Math.PI / 2; sw.position.set(0, 0.05, road.coord + dz);
        scene.add(sw);
      }
      // centre dashes
      for (let x = -270; x < 270; x += 9) {
        const d = box(3.2, 0.02, 0.35, dashMat, x, 0.04, road.coord, scene);
        d.receiveShadow = false;
      }
    } else {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, 560), streetMat);
      s.rotation.x = -Math.PI / 2; s.position.set(road.coord, 0.02, 0);
      scene.add(s);
      for (const dx of [-half - 1.6, half + 1.6]) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 560), MAT.sidewalk);
        sw.rotation.x = -Math.PI / 2; sw.position.set(road.coord + dx, 0.05, 0);
        scene.add(sw);
      }
      for (let z = -250; z < 250; z += 9) {
        box(0.35, 0.02, 3.2, dashMat, road.coord, 0.04, z, scene);
      }
    }
  }
  // Crosswalks + stop lines at the five main-avenue intersections, and
  // puddle decals on the main avenues (wet-road sunset sheen).
  for (const [xc, zc] of [[0, 0], [120, 0], [-120, 0], [0, 120], [0, -120]]) {
    const hx = roadHalfWidth(streetClass(xc)); // north-south road half-width
    const hz = roadHalfWidth(streetClass(zc)); // east-west road half-width
    // Crosswalks: one on each approach. Crossing the east-west road
    // (axis 'x', half hz) sits just outside the north-south road (offset
    // hx + 2); crossing the north-south road sits just outside the
    // east-west road (offset hz + 2).
    makeCrosswalk(xc - hx - 2, zc, 'x', hz, scene);
    makeCrosswalk(xc + hx + 2, zc, 'x', hz, scene);
    makeCrosswalk(xc, zc - hz - 2, 'z', hx, scene);
    makeCrosswalk(xc, zc + hz + 2, 'z', hx, scene);
    // Stop lines on the east-west approaches, just outside the crossing road.
    makeStopLine(xc - hx - 1.2, zc, 'x', hz, scene);
    makeStopLine(xc + hx + 1.2, zc, 'x', hz, scene);
  }
  for (const px of [-160, -40, 80, 200]) makePuddle(px, 3.5, 2.2, 1.1, scene);
  for (const px of [-200, 20, 140]) makePuddle(px, -3.5, 1.8, 0.9, scene);
  for (const pz of [-100, 60, 180]) makePuddle(3.5, pz, 1.1, 2.0, scene);

  // ---- canal (north edge) ----
  const canalW = CANAL.x1 - CANAL.x0, canalD = CANAL.z1 - CANAL.z0;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(canalW, canalD), MAT.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -1.4, (CANAL.z0 + CANAL.z1) / 2);
  scene.add(water);
  refs.water = water;
  // canal walls
  box(canalW, 2.2, 1.2, MAT.canalWall, 0, -0.6, CANAL.z0 + 0.4, scene);
  box(canalW, 2.2, 1.2, MAT.canalWall, 0, -0.6, CANAL.z1 - 0.4, scene);
  // sun glint streak on the water (warm, additive) — makes the water read.
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(150, 7),
    new THREE.MeshBasicMaterial({ map: glowTexWarm, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75 }));
  glint.rotation.x = -Math.PI / 2; glint.rotation.z = 0.35;
  glint.position.set(-30, -1.25, (CANAL.z0 + CANAL.z1) / 2);
  scene.add(glint);
  // ripple rings (animated in main.js via refs.ripples)
  for (let i = 0; i < 10; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 24),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(range(-140, 140), -1.28, range(CANAL.z0 + 4, CANAL.z1 - 4));
    ring.userData.phase = rand() * Math.PI * 2;
    scene.add(ring);
    refs.ripples.push(ring);
  }
  // moored boats in the canal
  for (const bx of [-90, 70, 150]) {
    const hull = box(9, 1.1, 3, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }), bx, -0.9, -282, scene);
    box(8.2, 0.5, 2.4, new THREE.MeshStandardMaterial({ color: 0x2fa8a0, roughness: 0.5 }), bx, -0.5, -282, scene);
    box(1.2, 1.6, 1.2, new THREE.MeshStandardMaterial({ color: 0x22362e, roughness: 0.6 }), bx + 2, 0.1, -282, scene);
  }

  // ---- lift bridge (signature set-piece, at x=0 crossing the canal) ----
  const bridge = new THREE.Group();
  // deck (the road continues across)
  const deck = box(13, 0.8, canalD + 8, MAT.bridgeDeck, 0, 0.1, BRIDGE.z, bridge);
  // striped gates (yellow/black) at both ends
  const stripeTex = canvasTex(128, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#ffd23e'; g.fillRect(i * 16, 0, 16, h); }
  });
  for (const dz of [-canalD / 2 - 3, canalD / 2 + 3]) {
    const gate = new THREE.Mesh(new THREE.BoxGeometry(12.4, 1.1, 0.4),
      new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 }));
    gate.position.set(0, 1.4, BRIDGE.z + dz); bridge.add(gate);
  }
  // two steel lift towers (A-frame legs + crossbeam)
  for (const sx of [-8.5, 8.5]) {
    for (const sz of [-14, 14]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), MAT.steel);
      leg.position.set(sx, 13, BRIDGE.z + sz); bridge.add(leg);
    }
    const beam = box(2.2, 1.8, 30, MAT.steelDark, sx, 26.5, BRIDGE.z, bridge);
    // red warning light on top
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 2 }));
    lamp.position.set(sx, 28, BRIDGE.z); bridge.add(lamp);
    addGlow(bridge, sx, 28, BRIDGE.z, 3.5, glowTexPink);
  }
  // crossbeam sign: "LIFT BRIDGE" in neon
  const signTex = signTexture('LIFT BRIDGE', '#22e6ff', '#0d1520');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.75),
    new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.1, transparent: true }));
  sign.position.set(0, 24.5, BRIDGE.z + 15.2); bridge.add(sign);
  // cables (thin cylinders, diagonal)
  for (const sx of [-8.5, 8.5]) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 30, 4), MAT.steelDark);
    cable.position.set(sx, 14, BRIDGE.z - 7); cable.rotation.x = 0.5; bridge.add(cable);
    const cable2 = cable.clone(); cable2.position.z = BRIDGE.z + 7; cable2.rotation.x = -0.5; bridge.add(cable2);
  }
  scene.add(bridge);
  refs.bridge = bridge;

  // ---- buildings (blocks) ----
  // Fewer lit windows (was 0.4-0.6): the old density made whole facades
  // blaze. ~1 in 3 windows lit now, so buildings read as dark masses
  // with scattered warm rooms.
  const facades = [
    { base: '#3a6a7a', lit: 0.35 }, { base: '#8a4a5e', lit: 0.3 },
    { base: '#5a7a4e', lit: 0.32 }, { base: '#4a6a9a', lit: 0.38 },
    { base: '#6a5a8a', lit: 0.28 }, { base: '#a85a42', lit: 0.32 },
    { base: '#7a6a3e', lit: 0.35 }, { base: '#5a4a6a', lit: 0.3 },
  ];
  const shopSigns = [
    ['NEON COLA', '#ff2e88'], ['TACO PALACE', '#ff5a3d'], ['DONUT DRIVE', '#ff9a3d'],
    ['SURF SHOP', '#22e6ff'], ['NEON NAILS', '#c86bff'], ['PALM & PISTON', '#2affc8'],
    ['SLICE RUNNER', '#ffd23e'], ['HARBOR RATS', '#c98a5a'], ['THREAD HOUSE', '#f2f2f2'],
    ['MABEL\u2019S PIE', '#ff8a9a'], ['VELVET ROPE', '#ffd23e'], ['K-VIBE 91.1', '#ff2ec8'],
  ];
  const awnMats = [MAT.awningPink, MAT.awningTeal, MAT.awningGold, MAT.awningPurple, MAT.awningCyan];
  let signIdx = 0;
  // Glass Spire (tallest tower, finale heist site) — now on its own plot,
  // block (1,-2), centre (90,-90), inside a block instead of standing on
  // an intersection.
  const spireData = layout.buildings.find((b) => b.landmark);
  const spire = new THREE.Group();
  const spireTex = windowTexture('#2a3a55', 0.4);
  const spireBody = new THREE.Mesh(new THREE.BoxGeometry(spireData.w, spireData.h, spireData.d),
    new THREE.MeshStandardMaterial({ map: spireTex, roughness: 0.25, metalness: 0.6, envMapIntensity: 1.2 }));
  spireBody.position.y = spireData.h / 2; spire.add(spireBody);
  const spireTop = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), MAT.glass);
  spireTop.position.y = spireData.h + 5; spire.add(spireTop);
  const spireTip = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 12, 6),
    new THREE.MeshStandardMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: 1.3 }));
  spireTip.position.y = spireData.h + 16; spire.add(spireTip);
  addGlow(spire, 0, spireData.h + 16, 0, 6, glowTexPink);
  spire.position.set(spireData.x, 0, spireData.z); scene.add(spire);

  // Shopfront helper: builds the storefront (dark front + neon sign +
  // awning) facing +z, then rotates the sub-group to the building's
  // street-facing side. faceW is the width along the face, faceD the
  // building depth measured out from that face.
  function addShopfront(parent, faceW, faceD, front, name, col) {
    const g = new THREE.Group();
    box(faceW * 0.9, 4.2, 0.8,
      new THREE.MeshStandardMaterial({ color: 0x1c1f2a, roughness: 0.4, metalness: 0.3 }),
      0, 2.1, faceD / 2 + 0.2, g);
    const st = signTexture(name, col, '#0d0f18');
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(14, faceW * 0.7), 2.6),
      new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.9, transparent: true }));
    sp.position.set(0, 3.4, faceD / 2 + 0.65); g.add(sp);
    addGlow(g, 0, 3.4, faceD / 2 + 1.2, 3.5, col === '#ff2e88' || col === '#c86bff' || col === '#ff2ec8' ? glowTexPink : glowTexCyan);
    const aw = box(faceW * 0.7, 0.25, 2.4, pick(awnMats), 0, 4.6, faceD / 2 + 1.2, g);
    aw.rotation.x = 0.28;
    if (front === '-z') g.rotation.y = Math.PI;
    else if (front === '+x') g.rotation.y = Math.PI / 2;
    else if (front === '-x') g.rotation.y = -Math.PI / 2;
    parent.add(g);
    return g;
  }

  // Buildings from the layout: each one sits inside its plot (never on a
  // road), with a zone-driven height, a facade variant, and a shopfront on
  // the street-facing side.
  for (const lb of layout.buildings) {
    if (lb.landmark) continue;
    const f = facades[lb.facade % facades.length];
    const tex = windowTexture(f.base, lb.lit);
    const w = lb.w, d = lb.d, h = lb.h;
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.45, envMapIntensity: 0.9 }));
    body.position.y = h / 2; b.add(body);
    // setback: a smaller upper box on taller buildings
    if (h > 30) {
      const up = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h * 0.28, d * 0.6),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.45 }));
      up.position.y = h + h * 0.14; b.add(up);
    }
    // roof props: AC units, water tower, antenna
    const roofY = h + 0.4;
    if (rand() < 0.8) box(range(2, 4), 1.2, range(2, 3.5), MAT.roof, range(-w / 4, w / 4), roofY + 0.6, range(-d / 4, d / 4), b);
    if (rand() < 0.5) {
      const wt = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 8), MAT.roof);
      wt.position.set(range(-w / 4, w / 4), roofY + 1.5, range(-d / 4, d / 4)); b.add(wt);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.6, 8), MAT.roof);
      cone.position.set(wt.position.x, roofY + 3.8, wt.position.z); b.add(cone);
    }
    if (rand() < 0.6) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 6, 4), MAT.steelDark);
      ant.position.set(range(-w / 3, w / 3), roofY + 3, range(-d / 3, d / 3)); b.add(ant);
    }
    // ground-floor shop front on the street-facing side
    if (lb.shop) {
      const [name, col] = shopSigns[signIdx++ % shopSigns.length];
      const faceW = (lb.front === '+x' || lb.front === '-x') ? d : w;
      const faceD = (lb.front === '+x' || lb.front === '-x') ? w : d;
      addShopfront(b, faceW, faceD, lb.front, name, col);
    }
    b.position.set(lb.x, 0, lb.z);
    scene.add(b);
  }

  // ---- Sunset Plaza + fountain (block (-2,0), centre (-90, 30)) ----
  const plaza = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 0.3, 24), MAT.sidewalk);
  slab.position.y = 0.15; plaza.add(slab);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 1.1, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a8290, roughness: 0.8 }));
  basin.position.y = 0.7; plaza.add(basin);
  const fwater = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.2, 20), MAT.water);
  fwater.position.y = 1.25; plaza.add(fwater);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.4, 8), MAT.concrete);
  jet.position.y = 2.2; plaza.add(jet);
  addGlow(plaza, 0, 3.4, 0, 3, glowTexCyan);
  plaza.position.set(-90, 0, 30); scene.add(plaza);

  // ---- SAN AMARO sign (big, glowing, on a frame near the canal) ----
  const signG = new THREE.Group();
  for (const sx of [-14, 14]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.4, 16, 1.4), MAT.steelDark);
    post.position.set(sx, 8, 0); signG.add(post);
  }
  const sanTex = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#0d0f18'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#22e6ff'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#ffffff'; g.font = '900 150px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#22e6ff'; g.shadowBlur = 34;
    g.fillText('SAN AMARO', w / 2, h / 2 + 6);
  });
  const san = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5),
    new THREE.MeshStandardMaterial({ map: sanTex, emissive: 0xffffff, emissiveMap: sanTex, emissiveIntensity: 1.1, transparent: true }));
  san.position.set(0, 13, 0); signG.add(san);
  addGlow(signG, 0, 13, 0, 10, glowTexCyan);
  signG.position.set(-52, 0, -248);
  signG.rotation.y = 0.35;
  scene.add(signG);
  refs.sign = signG;

  // ---- vegetation + street furniture from the layout (instanced) ----
  // Trees and lamps are instanced: one draw call per part instead of one
  // per tree/lamp. A palm is a trunk + 7 fronds; a shade tree is a trunk +
  // two canopy spheres; a lamp is a pole + arm + head + glowing bulb.
  // (673 trees + 368 lamps as individual groups would be ~8,000 draw
  // calls; instanced they are 9.)
  const _m4 = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _v = new THREE.Vector3();
  const _sv = new THREE.Vector3();
  function setInstance(mesh, i, x, y, z, ry, sx, sy, sz, rx = 0, rz = 0) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _v.set(x, y, z);
    _sv.set(sx, sy, sz);
    _m4.compose(_v, _q, _sv);
    mesh.setMatrixAt(i, _m4);
  }
  const palms = layout.trees.filter((t) => t.kind === 'palm');
  const palmTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.22, 4.6, 6), MAT.trunk, palms.length);
  const palmFrond = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.6, 0.7), MAT.frond, palms.length * 7);
  palms.forEach((t, i) => {
    const s = t.scale;
    setInstance(palmTrunk, i, t.x, 2.3 * s, t.z, 0, s, s, s);
    for (let j = 0; j < 7; j++) {
      // deterministic frond angle (no rand() here — the layout is the
      // seed, the mesh must be identical on every load)
      const a = (j / 7) * Math.PI * 2 + ((i * 0.37 + j * 0.13) % 0.4);
      setInstance(palmFrond, i * 7 + j,
        t.x + Math.cos(a) * 1.1 * s, 4.7 * s, t.z + Math.sin(a) * 1.1 * s,
        -a, s, s, s, 0.55, 0.25);
    }
  });
  scene.add(palmTrunk); scene.add(palmFrond);
  palmTrunk.instanceMatrix.needsUpdate = true;
  palmFrond.instanceMatrix.needsUpdate = true;
  refs.palms.push(palms.length);
  const shades = layout.trees.filter((t) => t.kind === 'shade');
  const shadeTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 2.2, 6), MAT.trunk, shades.length);
  const shadeCanopy = new THREE.InstancedMesh(new THREE.SphereGeometry(1.5, 10, 8), MAT.canopy, shades.length);
  const shadeCanopy2 = new THREE.InstancedMesh(new THREE.SphereGeometry(1.0, 8, 6), MAT.canopy2, shades.length);
  shades.forEach((t, i) => {
    const s = t.scale;
    setInstance(shadeTrunk, i, t.x, 1.1 * s, t.z, 0, s, s, s);
    setInstance(shadeCanopy, i, t.x, 3.1 * s, t.z, 0, s, s * 0.85, s);
    setInstance(shadeCanopy2, i, t.x + 0.7 * s, 3.7 * s, t.z + 0.3 * s, 0, s, s, s);
  });
  scene.add(shadeTrunk); scene.add(shadeCanopy); scene.add(shadeCanopy2);
  shadeTrunk.instanceMatrix.needsUpdate = true;
  shadeCanopy.instanceMatrix.needsUpdate = true;
  shadeCanopy2.instanceMatrix.needsUpdate = true;
  // Lamps (instanced pole + arm + head + bulb; the arm points at the road
  // via each lamp's ry from the layout).
  const lampPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6), MAT.lampPole, layout.lamps.length);
  const lampArm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), MAT.lampPole, layout.lamps.length);
  const lampHead = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.14, 0.24), MAT.lampPole, layout.lamps.length);
  const lampBulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc95e, emissiveIntensity: 1.6 });
  const lampBulb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.06, 0.18), lampBulbMat, layout.lamps.length);
  layout.lamps.forEach((l, i) => {
    const ry = l.ry || 0;
    const c = Math.cos(ry), s2 = Math.sin(ry);
    // the arm/head/bulb sit 0.6 / 1.25 m out along the lamp's local +x,
    // which ry rotates toward the road
    setInstance(lampPole, i, l.x, 2.6, l.z, ry, 1, 1, 1);
    setInstance(lampArm, i, l.x + 0.6 * c, 5.1, l.z - 0.6 * s2, ry, 1, 1, 1);
    setInstance(lampHead, i, l.x + 1.25 * c, 5.05, l.z - 1.25 * s2, ry, 1, 1, 1);
    setInstance(lampBulb, i, l.x + 1.25 * c, 4.96, l.z - 1.25 * s2, ry, 1, 1, 1);
  });
  scene.add(lampPole); scene.add(lampArm); scene.add(lampHead); scene.add(lampBulb);
  lampPole.instanceMatrix.needsUpdate = true;
  lampArm.instanceMatrix.needsUpdate = true;
  lampHead.instanceMatrix.needsUpdate = true;
  lampBulb.instanceMatrix.needsUpdate = true;
  refs.lamps.push(layout.lamps.length);
  // Traffic signals at the five main intersections (one pole per corner)
  // and street-name signs.
  for (const s of layout.signals) makeTrafficSignal(s.x, s.z, scene);
  for (const s of layout.signs) makeStreetSign(s.x, s.z, s.text, scene);
  // Benches + bins on commercial sidewalks (individual meshes — only 280
  // of them, and each is a few boxes).
  for (const b of layout.benches) makeBench(b.x, b.z, b.axis, scene);
  for (const b of layout.bins) makeBin(b.x, b.z, scene);
  // Benches + planters on the plaza edge (the old plaza-edge row, moved
  // to the new plaza at (-90, 30)).
  for (let i = 0; i < 8; i++) {
    const bx = -110 + i * 6;
    box(2.6, 0.5, 0.9, new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 }), bx, 0.35, 48, scene);
    box(1.4, 1.1, 1.4, new THREE.MeshStandardMaterial({ color: 0x3d6b4a, roughness: 0.9 }), bx + 4, 0.55, 48, scene);
  }

  // ---- distant skyline (horizon silhouettes, so the city never ends in void) ----
  const skyline = new THREE.Group();
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2;
    const r = 420 + rand() * 130;
    const h = 40 + rand() * 130;
    const w = 26 + rand() * 30;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w),
      new THREE.MeshStandardMaterial({ map: windowTexture('#1c2438', 0.22), roughness: 0.6, metalness: 0.3 }));
    b.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
    skyline.add(b);
  }
  scene.add(skyline);

  return refs;
}
