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
  roadHalfWidth, streetClass, STREETS, GRID_PITCH,
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

// Facade texture: a parametrised window grid so different building types
// read differently — glass curtain walls (many small panes + floor bands),
// concrete (fewer, larger inset windows + spandrel bands), houses (few big
// windows), warehouses (a high strip of small windows). The old single
// windowTexture painted every building with the same 8x14 grid, which is
// why the whole city read as one repeated box.
function facadeTexture(base, lit, opts = {}) {
  const cols = opts.cols || 8, rows = opts.rows || 14;
  const inset = opts.inset ?? 3;
  const bandEvery = opts.bandEvery || 0;
  const bandColor = opts.bandColor || 'rgba(0,0,0,.25)';
  const litPalette = opts.litPalette || ['#c98a3d', '#b87a2e', '#d9a55a', '#a86a2a', '#cfe8ff', '#ffd9a0'];
  return canvasTex(256, 448, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) {
      if (bandEvery && y % bandEvery === 0) { g.fillStyle = bandColor; g.fillRect(0, y * ch, w, 3); }
      for (let x = 0; x < cols; x++) {
        const px = x * cw + inset, py = y * ch + inset * 1.2;
        if (rand() < lit) {
          g.fillStyle = pick(litPalette);
          g.fillRect(px, py, cw - inset * 2, ch - inset * 2.4);
          g.fillStyle = 'rgba(255,255,255,.08)';
          g.fillRect(px, py, cw - inset * 2, 3);
        } else {
          // Unlit panes: a lighter blue-grey now (was near-black) so glass
          // towers read as blue glass in daylight instead of black slabs.
          g.fillStyle = opts.unlit || 'rgba(16,26,44,.8)'; g.fillRect(px, py, cw - inset * 2, ch - inset * 2.4);
          g.fillStyle = 'rgba(255,255,255,.06)';
          g.fillRect(px, py, cw - inset * 2, 3);
        }
      }
    }
    g.fillStyle = 'rgba(0,0,0,.08)';
    for (let i = 0; i < 6; i++) g.fillRect(rand() * w, 0, 6, h);
  });
}
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
  // ---- visual-upgrade materials ----
  // Bridge: the old dark-green steel read as black in every shot. Painted
  // teal-blue steel + a lighter deck, so the structure holds its shape.
  MAT.bridgeSteel = new THREE.MeshStandardMaterial({ color: 0x4a7a8a, roughness: 0.42, metalness: 0.7, emissive: 0x2a4a5a, emissiveIntensity: 0.5 });
  MAT.bridgeSteelLight = new THREE.MeshStandardMaterial({ color: 0x6a9aaa, roughness: 0.4, metalness: 0.65, emissive: 0x3a5a6a, emissiveIntensity: 0.5 });
  MAT.bridgeDeckLight = new THREE.MeshStandardMaterial({ color: 0x5a6a7c, roughness: 0.85, metalness: 0.15, emissive: 0x1a2030, emissiveIntensity: 0.3 });
  MAT.edgeWhite = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
  MAT.edgeYellow = new THREE.MeshStandardMaterial({ color: 0xffd23e, roughness: 0.5 });
  // Fountain + plaza: light stone and white marble so the fountain reads as
  // architecture, not a dark cone; pale paving so the plaza is not a red void.
  MAT.stoneLight = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.75 });
  MAT.marble = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.35, metalness: 0.05 });
  MAT.pavingLight = new THREE.MeshStandardMaterial({ color: 0xa89e8c, roughness: 0.9 });
  MAT.pavingDark = new THREE.MeshStandardMaterial({ color: 0x7a7268, roughness: 0.9 });
  MAT.jetWater = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.75 });
  MAT.spray = new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.22, depthWrite: false });
  MAT.hedge = new THREE.MeshStandardMaterial({ color: 0x2a5a34, roughness: 0.95 });
  // Second palm frond tint + third shade-canopy tint: the streets were a
  // monoculture of one green. Fronds/canopies are split across the tints
  // by index in the instanced section below.
  MAT.frond2 = new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.85, side: THREE.DoubleSide });
  MAT.canopy3 = new THREE.MeshStandardMaterial({ color: 0x7a8a3f, roughness: 0.9 });
  // House roofs: slate, terracotta, brown.
  MAT.roofTile = new THREE.MeshStandardMaterial({ color: 0x5a4a42, roughness: 0.9 });
  MAT.roofSlate = new THREE.MeshStandardMaterial({ color: 0x4a5a6a, roughness: 0.9 });
  MAT.roofTerra = new THREE.MeshStandardMaterial({ color: 0x8a5a42, roughness: 0.9 });
  // Spire: bright blue glass + cyan edge light strips.
  MAT.spireGlass = new THREE.MeshStandardMaterial({ color: 0x7ab8d8, roughness: 0.15, metalness: 0.85, envMapIntensity: 1.5 });
  MAT.edgeCyan = new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x22e6ff, emissiveIntensity: 1.6 });
  MAT.lobbyGlow = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc95e, emissiveIntensity: 1.4 });
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
  // Visual upgrade: the old dark-green steel read as a black silhouette in
  // every shot and the LIFT BRIDGE sign sat so high (y=24.5) it was cut off
  // by the frame. Now: painted teal-blue steel, white edge stripes, a mid
  // crossbeam, floodlights on the deck, counterweights + pulley sheaves so
  // the lifting mechanism reads as real machinery, thicker cables, a
  // lighter deck with edge lines, and the sign lowered to y=20, enlarged,
  // hung from the crossbeam — plus a second sign on the north face.
  const bridge = new THREE.Group();
  // deck (the road continues across) — lighter, with edge lines
  const deck = box(13, 0.8, canalD + 8, MAT.bridgeDeckLight, 0, 0.1, BRIDGE.z, bridge);
  for (const ex of [-6.2, 6.2]) box(0.3, 0.06, canalD + 8, MAT.edgeYellow, ex, 0.55, BRIDGE.z, bridge);
  for (let i = 0; i < 5; i++) box(0.35, 0.06, 2.4, MAT.edgeWhite, 0, 0.55, BRIDGE.z - 16 + i * 8, bridge);
  // striped gates (yellow/black) at both ends
  const stripeTex = canvasTex(128, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#ffd23e'; g.fillRect(i * 16, 0, 16, h); }
  });
  for (const dz of [-canalD / 2 - 3, canalD / 2 + 3]) {
    const gate = new THREE.Mesh(new THREE.BoxGeometry(12.4, 1.1, 0.4),
      new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 }));
    gate.position.set(0, 1.4, BRIDGE.z + dz); bridge.add(gate);
  }
  // two steel lift towers (A-frame legs + crossbeams), painted steel
  for (const sx of [-8.5, 8.5]) {
    for (const sz of [-14, 14]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), MAT.bridgeSteel);
      leg.position.set(sx, 13, BRIDGE.z + sz); bridge.add(leg);
      // white edge stripe on the road-facing side of the leg
      const stripe = box(0.18, 26, 0.3, MAT.edgeWhite, sx, 13, BRIDGE.z + sz + (sz < 0 ? 0.85 : -0.85), bridge);
      stripe.castShadow = false;
      // floodlight head on the inner face, aimed at the deck — fixture big
      // enough to read, glow small enough not to float as a free orb
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6), MAT.lobbyGlow);
      fl.position.set(sx + (sx < 0 ? 1.0 : -1.0), 10, BRIDGE.z + sz); bridge.add(fl);
      addGlow(bridge, sx + (sx < 0 ? 1.6 : -1.6), 10, BRIDGE.z + sz, 2.5, glowTexWarm);
      // pulley sheave on top of the leg
      const sheave = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.6, 12), MAT.bridgeSteelLight);
      sheave.rotation.z = Math.PI / 2;
      sheave.position.set(sx, 26.5, BRIDGE.z + sz); bridge.add(sheave);
      // counterweight block hanging inside the tower frame
      box(2.5, 6, 1.8, MAT.steelDark, sx, 9, BRIDGE.z + sz * 0.5, bridge);
    }
    const beam = box(2.2, 1.8, 30, MAT.bridgeSteelLight, sx, 26.5, BRIDGE.z, bridge);
    // mid crossbeam — ties the legs together, gives the tower a real frame
    box(2.0, 1.4, 30, MAT.bridgeSteel, sx, 13, BRIDGE.z, bridge);
    // red warning light on top
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 2 }));
    lamp.position.set(sx, 28, BRIDGE.z); bridge.add(lamp);
    addGlow(bridge, sx, 28, BRIDGE.z, 3.5, glowTexPink);
  }
  // LIFT BRIDGE signs, hung from the crossbeam on BOTH faces, low enough
  // (y=16) to sit below the top-centre HUD block in bridge shots — the
  // old y=20 put the sign right where the XP bar lives and the bar
  // clipped the middle of the text.
  const signTex = signTexture('LIFT BRIDGE', '#22e6ff', '#0d1520');
  for (const [sz, ry] of [[15.2, 0], [-15.2, Math.PI]]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.25),
      new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.1, transparent: true }));
    sign.position.set(0, 16, BRIDGE.z + sz); sign.rotation.y = ry; bridge.add(sign);
    for (const hx of [-5, 5]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7.3, 4), MAT.steelDark);
      rod.position.set(hx, 21.25, BRIDGE.z + sz); bridge.add(rod);
    }
  }
  // cables: thicker now, diagonal to the deck ends + vertical to the
  // counterweights, so the lift mechanism reads.
  for (const sx of [-8.5, 8.5]) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 30, 4), MAT.steelDark);
    cable.position.set(sx, 14, BRIDGE.z - 7); cable.rotation.x = 0.5; bridge.add(cable);
    const cable2 = cable.clone(); cable2.position.z = BRIDGE.z + 7; cable2.rotation.x = -0.5; bridge.add(cable2);
    for (const sz of [-7, 7]) {
      const vc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 17, 4), MAT.steelDark);
      vc.position.set(sx, 17.5, BRIDGE.z + sz); bridge.add(vc);
    }
  }
  scene.add(bridge);
  refs.bridge = bridge;

  // ---- buildings (blocks) ----
  // Visual upgrade: the old 8 saturated bases (#3a6a7a teal, #8a4a5e pink,
  // #5a7a4e green...) painted every building one flat colour with the same
  // 8x14 window grid — the city read as repeated coloured boxes. Now each
  // ZONE has its own architectural identity, with material-based,
  // desaturated palettes and a different facade texture per kind:
  //   downtown  — blue-glass curtain walls + grey concrete towers
  //   commercial — brick / warm concrete with balconies and cornices
  //   residential — pastel houses with pitched roofs, porches, chimneys
  //   industrial — muted warehouses with monitor roofs + roller doors
  const FACADES = {
    downtown: [
      { kind: 'glass', base: '#2a4a6a', lit: 0.22 }, { kind: 'glass', base: '#1e3a55', lit: 0.18 },
      { kind: 'glass', base: '#3a5a7a', lit: 0.25 }, { kind: 'concrete', base: '#8a8578', lit: 0.3 },
      { kind: 'concrete', base: '#6a6a72', lit: 0.28 }, { kind: 'concrete', base: '#9a8a7a', lit: 0.3 },
      { kind: 'glass', base: '#4a6a7a', lit: 0.2 }, { kind: 'concrete', base: '#7a7468', lit: 0.26 },
    ],
    commercial: [
      { kind: 'concrete', base: '#7a6a5e', lit: 0.32 }, { kind: 'concrete', base: '#8a7a6a', lit: 0.3 },
      { kind: 'concrete', base: '#5a6a6e', lit: 0.3 }, { kind: 'brick', base: '#8a5a48', lit: 0.3 },
      { kind: 'concrete', base: '#9a8a7a', lit: 0.32 }, { kind: 'glass', base: '#3a5a6a', lit: 0.25 },
    ],
    residential: [
      { kind: 'house', base: '#c8b8a0', lit: 0.4 }, { kind: 'house', base: '#a8b8c8', lit: 0.4 },
      { kind: 'house', base: '#d8c8b8', lit: 0.4 }, { kind: 'house', base: '#b8c8b0', lit: 0.4 },
      { kind: 'house', base: '#c8a8a8', lit: 0.4 },
    ],
    industrial: [
      { kind: 'industrial', base: '#6a6a60', lit: 0.15 }, { kind: 'industrial', base: '#7a5a44', lit: 0.15 },
      { kind: 'industrial', base: '#5a6a5a', lit: 0.15 }, { kind: 'industrial', base: '#5a5a6a', lit: 0.15 },
    ],
  };
  // Placement on a building's street-facing side: `along` is the distance
  // along the front face from its centre (positive = right when facing the
  // front from the street), `out` the distance out from the face. Returns
  // the local position + the y-rotation a front attachment needs.
  function frontPlacement(front, w, d, along, out) {
    if (front === '+z') return { x: along, z: d / 2 + out, ry: 0 };
    if (front === '-z') return { x: -along, z: -d / 2 - out, ry: Math.PI };
    if (front === '+x') return { x: w / 2 + out, z: -along, ry: Math.PI / 2 };
    return { x: -w / 2 - out, z: along, ry: -Math.PI / 2 };
  }
  // Is this block bounded by two non-residential streets on adjacent sides?
  // Those buildings sit on a real corner and get a glass corner column +
  // an entrance canopy, so intersections read as designed corners.
  function isCornerBuilding(lb) {
    const w = streetClass(lb.bx * GRID_PITCH) !== 'residential';
    const e = streetClass((lb.bx + 1) * GRID_PITCH) !== 'residential';
    const s = streetClass(lb.bz * GRID_PITCH) !== 'residential';
    const n = streetClass((lb.bz + 1) * GRID_PITCH) !== 'residential';
    return (w || e) && (s || n);
  }
  const shopSigns = [
    ['NEON COLA', '#ff2e88'], ['TACO PALACE', '#ff5a3d'], ['DONUT DRIVE', '#ff9a3d'],
    ['SURF SHOP', '#22e6ff'], ['NEON NAILS', '#c86bff'], ['PALM & PISTON', '#2affc8'],
    ['SLICE RUNNER', '#ffd23e'], ['HARBOR RATS', '#c98a5a'], ['THREAD HOUSE', '#f2f2f2'],
    ['MABEL\u2019S PIE', '#ff8a9a'], ['VELVET ROPE', '#ffd23e'], ['K-VIBE 91.1', '#ff2ec8'],
  ];
  const awnMats = [MAT.awningPink, MAT.awningTeal, MAT.awningGold, MAT.awningPurple, MAT.awningCyan];
  let signIdx = 0;
  // Glass Spire (tallest tower, finale heist site) — on its own plot,
  // block (1,-2), centre (90,-90). Visual upgrade: the old spire was a
  // dark box whose neon ring only existed when a shot added it, so in most
  // frames it read as nothing special. Now it is a permanent landmark in
  // every shot: blue glass curtain wall, a three-step crown, a permanent
  // green halo ring + a vertical face ring, cyan edge-light strips up all
  // four corners, a glowing beacon, a stone podium and a lit entrance.
  const spireData = layout.buildings.find((b) => b.landmark);
  const spire = new THREE.Group();
  const spireTex = facadeTexture('#35608a', 0.18, { cols: 10, rows: 22, inset: 2, bandEvery: 4, bandColor: 'rgba(0,0,0,.35)', litPalette: ['#ffd9a0', '#cfe8ff'] });
  const spireBody = new THREE.Mesh(new THREE.BoxGeometry(spireData.w, spireData.h, spireData.d),
    new THREE.MeshStandardMaterial({ map: spireTex, roughness: 0.18, metalness: 0.7, envMapIntensity: 1.5 }));
  spireBody.position.y = spireData.h / 2; spire.add(spireBody);
  // three-step crown
  const crown1 = new THREE.Mesh(new THREE.BoxGeometry(26, 5, 26), MAT.spireGlass);
  crown1.position.y = spireData.h + 2.5; spire.add(crown1);
  const crown2 = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 18), MAT.spireGlass);
  crown2.position.y = spireData.h + 7.5; spire.add(crown2);
  const crown3 = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), MAT.spireGlass);
  crown3.position.y = spireData.h + 13; spire.add(crown3);
  const spireTip = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 12, 6),
    new THREE.MeshStandardMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: 1.3 }));
  spireTip.position.y = spireData.h + 22; spire.add(spireTip);
  addGlow(spire, 0, spireData.h + 22, 0, 6, glowTexPink);
  // permanent neon rings: a horizontal halo around the tower + a vertical
  // ring on the south face (the old shots added a ring per-shot; now the
  // landmark carries its own)
  const halo = new THREE.Mesh(new THREE.TorusGeometry(20, 0.35, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0x2aff5a, emissive: 0x2aff5a, emissiveIntensity: 2.4 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 52; spire.add(halo);
  const faceRing = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x2aff5a, emissive: 0x2aff5a, emissiveIntensity: 2.4 }));
  faceRing.position.set(0, 68, spireData.d / 2 + 1); spire.add(faceRing);
  // cyan edge-light strips up all four vertical corners
  for (const ex of [-17, 17]) for (const ez of [-17, 17]) {
    box(0.35, spireData.h, 0.35, MAT.edgeCyan, ex, spireData.h / 2, ez, spire);
  }
  // stone podium + lit entrance on the south face
  box(40, 4, 40, MAT.stoneLight, 0, 2, 0, spire);
  box(10, 0.3, 3, MAT.marble, 0, 3.4, spireData.d / 2 + 1.5, spire);
  const lobby = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), MAT.lobbyGlow);
  lobby.position.set(0, 1.8, spireData.d / 2 + 0.15); spire.add(lobby);
  addGlow(spire, 0, 2, spireData.d / 2 + 2, 6, glowTexWarm);
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
  // road), with a zone-driven height, a zone facade, and a shopfront on the
  // street-facing side. The SHAPE is zone-specific now, not just the colour:
  // downtown towers get stepped crowns and corner fins, commercial blocks
  // get cornices and balconies, houses get pitched roofs + porches +
  // chimneys, warehouses get monitor roofs + roller doors.
  for (const lb of layout.buildings) {
    if (lb.landmark) continue;
    const zoneFacades = FACADES[lb.zone] || FACADES.commercial;
    const f = zoneFacades[lb.facade % zoneFacades.length];
    const litJ = Math.min(0.45, f.lit + (lb.lit - 0.3));
    let tex, mat;
    if (f.kind === 'glass') {
      tex = facadeTexture(f.base, litJ, { cols: 10, rows: 18, inset: 2, bandEvery: 3, bandColor: 'rgba(0,0,0,.35)', litPalette: ['#ffd9a0', '#cfe8ff', '#fff2cc', '#d9a55a'] });
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.22, metalness: 0.65, envMapIntensity: 1.3 });
    } else if (f.kind === 'house') {
      tex = facadeTexture(f.base, litJ, { cols: 3, rows: 3, inset: 6, litPalette: ['#ffd9a0', '#fff2cc'] });
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
    } else if (f.kind === 'industrial') {
      tex = facadeTexture(f.base, litJ, { cols: 6, rows: 4, inset: 4, litPalette: ['#ffd9a0'] });
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.2 });
    } else {
      tex = facadeTexture(f.base, litJ, { cols: 7, rows: 12, inset: 4, bandEvery: 4, litPalette: ['#c98a3d', '#d9a55a', '#ffd9a0', '#cfe8ff'] });
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.1 });
    }
    const w = lb.w, d = lb.d, h = lb.h;
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2; b.add(body);
    const faceW = (lb.front === '+x' || lb.front === '-x') ? d : w;
    const roofY = h + 0.4;
    if (lb.zone === 'downtown') {
      // Stepped crown: two shrinking boxes, so the skyline steps instead of
      // ending in one flat slab. The tallest towers get a beacon.
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, h * 0.10, d * 0.62), mat);
      c1.position.y = h + h * 0.05; b.add(c1);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, h * 0.08, d * 0.4), mat);
      c2.position.y = h + h * 0.10 + h * 0.04; b.add(c2);
      if (h >= 44) {
        const fin = box(0.5, h * 0.92, 1.6, MAT.spireGlass, -w / 2 + 0.4, h * 0.46, d / 2 + 0.4, b);
        fin.castShadow = false;
        if (h >= 58) {
          const bc = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 2 }));
          bc.position.y = h + h * 0.18 + 1; b.add(bc);
          addGlow(b, 0, h + h * 0.18 + 1, 0, 5, glowTexPink);
        }
      }
      // cornice lip on concrete towers
      if (f.kind !== 'glass') box(w + 0.8, 0.6, d + 0.8, MAT.concrete, 0, h + 0.3, 0, b);
    } else if (lb.zone === 'commercial') {
      // cornice + balconies on the front face + a small setback if tall
      box(w + 0.6, 0.5, d + 0.6, MAT.concrete, 0, h + 0.25, 0, b);
      if (h > 16) {
        for (const by of [8, 13]) {
          if (by > h - 3) continue;
          const p = frontPlacement(lb.front, w, d, 0, 0.7);
          const slab = box(faceW * 0.5, 0.25, 1.4, MAT.concrete, p.x, by, p.z, b);
          slab.rotation.y = p.ry;
          const rail = box(faceW * 0.5, 0.8, 0.1, MAT.benchIron, p.x, by + 0.5, p.z + (p.ry === 0 ? 0.65 : p.ry === Math.PI ? -0.65 : 0), b);
          rail.rotation.y = p.ry;
          if (p.ry === Math.PI / 2 || p.ry === -Math.PI / 2) {
            rail.position.set(p.x + (p.ry === Math.PI / 2 ? 0.65 : -0.65), by + 0.5, p.z);
          }
        }
      }
      if (h > 30) {
        const up = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h * 0.2, d * 0.6), mat);
        up.position.y = h + h * 0.1; b.add(up);
      }
    } else if (lb.zone === 'residential') {
      // Pitched roof: a triangular prism (extruded triangle) + chimney +
      // porch + door. This is the single biggest silhouette change in the
      // upgrade — houses stop being small grey boxes.
      const roofH = d * 0.35;
      const roofMat = pick([MAT.roofTile, MAT.roofSlate, MAT.roofTerra]);
      const tri = new THREE.Shape();
      tri.moveTo(-d / 2 - 0.4, 0); tri.lineTo(d / 2 + 0.4, 0); tri.lineTo(0, roofH); tri.closePath();
      const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: w + 0.8, bevelEnabled: false });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.rotation.y = -Math.PI / 2;
      roof.position.set((w + 0.8) / 2, h, 0);
      b.add(roof);
      box(1.2, 2.2, 1.2, MAT.roofTile, w * 0.25, h + roofH * 0.6, d * 0.15, b);
      const doorP = frontPlacement(lb.front, w, d, 0, 0.1);
      const door = box(1.3, 2.4, 0.15, new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.8 }), doorP.x, 1.2, doorP.z, b);
      door.rotation.y = doorP.ry;
      const porchP = frontPlacement(lb.front, w, d, 0, 1.2);
      const porch = box(3.2, 0.25, 2.0, MAT.pavingLight, porchP.x, 0.35, porchP.z, b);
      porch.rotation.y = porchP.ry;
      const porchRoof = box(3.4, 0.2, 2.2, roofMat, porchP.x, 2.7, porchP.z, b);
      porchRoof.rotation.y = porchP.ry;
      for (const pa of [-1.3, 1.3]) {
        const pp = frontPlacement(lb.front, w, d, pa, 2.0);
        box(0.15, 2.6, 0.15, MAT.benchWood, pp.x, 1.3, pp.z, b);
      }
    } else if (lb.zone === 'industrial') {
      // Monitor roof (raised centre strip with a warm strip window) +
      // roller door + loading dock on the front.
      box(w * 0.7, 2, d * 0.4, MAT.roof, 0, h + 1, 0, b);
      box(w * 0.7, 0.5, 0.12, MAT.lobbyGlow, 0, h + 1, d * 0.2 + 0.06, b);
      const doorP = frontPlacement(lb.front, w, d, 0, 0.15);
      const roller = box(6, 4, 0.3, new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.6, metalness: 0.5 }), doorP.x, 2, doorP.z, b);
      roller.rotation.y = doorP.ry;
      const dockP = frontPlacement(lb.front, w, d, 0, 1.6);
      const dock = box(7, 0.4, 3, MAT.concrete, dockP.x, 0.2, dockP.z, b);
      dock.rotation.y = dockP.ry;
      if (rand() < 0.7) {
        const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.4, 8), MAT.steelDark);
        vent.position.set(range(-w / 4, w / 4), h + 1.2, range(-d / 4, d / 4)); b.add(vent);
      }
    }
    // Corner buildings (downtown/commercial): a glass corner column + an
    // entrance canopy, so intersections read as designed corners.
    if ((lb.zone === 'downtown' || lb.zone === 'commercial') && h > 14 && isCornerBuilding(lb)) {
      const cp = frontPlacement(lb.front, w, d, -(faceW / 2 - 1), 0.6);
      box(1.8, h * 0.9, 1.8, MAT.spireGlass, cp.x, h * 0.45, cp.z, b);
      const cn = frontPlacement(lb.front, w, d, 0, 1.2);
      const canopy = box(faceW * 0.3, 0.2, 2.2, MAT.awningTeal, cn.x, 2.8, cn.z, b);
      canopy.rotation.y = cn.ry;
    }
    // roof props: AC units, water tower, antenna (downtown/commercial only —
    // houses have chimneys, warehouses have vents)
    if (lb.zone === 'downtown' || lb.zone === 'commercial') {
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
    }
    // ground-floor shop front on the street-facing side
    if (lb.shop) {
      const [name, col] = shopSigns[signIdx++ % shopSigns.length];
      const faceD = (lb.front === '+x' || lb.front === '-x') ? w : d;
      addShopfront(b, faceW, faceD, lb.front, name, col);
    }
    b.position.set(lb.x, 0, lb.z);
    scene.add(b);
  }

  // ---- Sunset Plaza + fountain (block (-2,0), centre (-90, 30)) ----
  // Visual upgrade: the old fountain was a grey basin + a concrete post —
  // it read as a dark cone, and the plaza was one big empty red slab. Now
  // it is a real piece of civic architecture: concentric paving rings, a
  // light-stone basin with a marble rim and rim lights, a two-tier
  // pedestal + upper bowl, a central jet with a spray cone, four angled
  // side jets with splash spheres, and a hedge ring so the plaza reads as
  // a designed public square, not empty ground.
  const plaza = new THREE.Group();
  for (const [r, y, m] of [[20, 0.06, MAT.pavingLight], [16, 0.10, MAT.pavingDark], [12, 0.14, MAT.pavingLight]]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 32), m);
    disc.position.y = y; plaza.add(disc);
  }
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.0, 1.3, 24), MAT.stoneLight);
  basin.position.y = 0.65; plaza.add(basin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.25, 8, 32), MAT.marble);
  rim.rotation.x = Math.PI / 2; rim.position.y = 1.3; plaza.add(rim);
  const fwater = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.2, 24), MAT.water);
  fwater.position.y = 1.15; plaza.add(fwater);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 3.2, 12), MAT.marble);
  pedestal.position.y = 2.75; plaza.add(pedestal);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1.8, 0.7, 16), MAT.stoneLight);
  bowl.position.y = 4.5; plaza.add(bowl);
  const bowlWater = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.15, 16), MAT.water);
  bowlWater.position.y = 4.8; plaza.add(bowlWater);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.6, 6), MAT.jetWater);
  jet.position.y = 6.0; plaza.add(jet);
  // Spray cone: small and faint now — the old big pale cone read as a
  // lampshade floating over the bowl, not water.
  const spray = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.0, 12), MAT.spray);
  spray.rotation.x = Math.PI; spray.position.y = 7.5; plaza.add(spray);
  // four angled side jets arcing out over the basin, with small splash puffs
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const dir = new THREE.Vector3(Math.sin(a) * 0.55, 0.84, Math.cos(a) * 0.55).normalize();
    const sj = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.4, 6), MAT.jetWater);
    sj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    sj.position.set(Math.sin(a) * 1.6, 4.6, Math.cos(a) * 1.6);
    plaza.add(sj);
    const splash = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), MAT.spray);
    splash.position.set(Math.sin(a) * 2.3, 5.6, Math.cos(a) * 2.3);
    plaza.add(splash);
  }
  // rim lights + a soft cyan glow over the water
  const rimLightMat = new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x22e6ff, emissiveIntensity: 1.5 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const rl = new THREE.Mesh(new THREE.CircleGeometry(0.25, 10), rimLightMat);
    rl.rotation.x = -Math.PI / 2;
    rl.position.set(Math.cos(a) * 6.5, 1.32, Math.sin(a) * 6.5);
    plaza.add(rl);
  }
  addGlow(plaza, 0, 1.6, 0, 7, glowTexCyan);
  addGlow(plaza, 0, 7.8, 0, 4, glowTexCyan);
  // hedge ring around the plaza edge
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const hg = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), MAT.hedge);
    hg.position.set(Math.cos(a) * 18, 1.1, Math.sin(a) * 18);
    plaza.add(hg);
  }
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
  // Fronds split across two tints (every 3rd palm is yellow-green) so the
  // avenues are not one flat green.
  const palmGroups = [[], []];
  palms.forEach((t, i) => palmGroups[i % 3 === 0 ? 1 : 0].push(i));
  const palmFronds = palmGroups.map((idxs, g) => new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2.6, 0.7), g === 0 ? MAT.frond : MAT.frond2, idxs.length * 7));
  palms.forEach((t, i) => {
    const s = t.scale;
    setInstance(palmTrunk, i, t.x, 2.3 * s, t.z, 0, s, s, s);
    const g = i % 3 === 0 ? 1 : 0;
    const slot = palmGroups[g].indexOf(i);
    for (let j = 0; j < 7; j++) {
      // deterministic frond angle (no rand() here — the layout is the
      // seed, the mesh must be identical on every load)
      const a = (j / 7) * Math.PI * 2 + ((i * 0.37 + j * 0.13) % 0.4);
      setInstance(palmFronds[g], slot * 7 + j,
        t.x + Math.cos(a) * 1.1 * s, 4.7 * s, t.z + Math.sin(a) * 1.1 * s,
        -a, s, s, s, 0.55, 0.25);
    }
  });
  scene.add(palmTrunk);
  palmFronds.forEach((m) => { scene.add(m); m.instanceMatrix.needsUpdate = true; });
  palmTrunk.instanceMatrix.needsUpdate = true;
  refs.palms.push(palms.length);
  const shades = layout.trees.filter((t) => t.kind === 'shade');
  const shadeTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 2.2, 6), MAT.trunk, shades.length);
  // Canopies split across three tints (green / yellow-green / olive).
  const shadeMats = [MAT.canopy, MAT.canopy2, MAT.canopy3];
  const shadeGroups = [[], [], []];
  shades.forEach((t, i) => shadeGroups[i % 3].push(i));
  const shadeCanopies = shadeGroups.map((idxs, g) => new THREE.InstancedMesh(new THREE.SphereGeometry(1.5, 10, 8), shadeMats[g], idxs.length));
  const shadeCanopies2 = shadeGroups.map((idxs, g) => new THREE.InstancedMesh(new THREE.SphereGeometry(1.0, 8, 6), shadeMats[g], idxs.length));
  shades.forEach((t, i) => {
    const s = t.scale;
    const g = i % 3;
    const slot = shadeGroups[g].indexOf(i);
    setInstance(shadeTrunk, i, t.x, 1.1 * s, t.z, 0, s, s, s);
    setInstance(shadeCanopies[g], slot, t.x, 3.1 * s, t.z, 0, s, s * 0.85, s);
    setInstance(shadeCanopies2[g], slot, t.x + 0.7 * s, 3.7 * s, t.z + 0.3 * s, 0, s, s, s);
  });
  scene.add(shadeTrunk);
  shadeCanopies.forEach((m) => { scene.add(m); m.instanceMatrix.needsUpdate = true; });
  shadeCanopies2.forEach((m) => { scene.add(m); m.instanceMatrix.needsUpdate = true; });
  shadeTrunk.instanceMatrix.needsUpdate = true;
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
  // Planters with shrubs beside every 3rd bench — small green accents in
  // the planting strip, next to furniture that is already validated, so
  // they can never block a path.
  layout.benches.forEach((b, i) => {
    if (i % 3 !== 0) return;
    const px = b.axis === 'x' ? b.x + 2.0 : b.x;
    const pz = b.axis === 'x' ? b.z : b.z + 2.0;
    box(1.4, 1.1, 1.4, new THREE.MeshStandardMaterial({ color: 0x3d6b4a, roughness: 0.9 }), px, 0.55, pz, scene);
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), MAT.canopy);
    shrub.position.set(px, 1.4, pz); scene.add(shrub);
  });
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
    const skyBase = pick(['#1c2438', '#2a3448', '#3a4048']);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w),
      new THREE.MeshStandardMaterial({ map: windowTexture(skyBase, 0.22), roughness: 0.6, metalness: 0.3 }));
    b.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
    skyline.add(b);
  }
  scene.add(skyline);

  return refs;
}
