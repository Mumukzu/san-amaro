// SAN AMARO — city builder (Downtown Core slice + canal + lift bridge).
// Written from scratch from the re-author spec. Every mesh is procedural:
// no textures from files, no imported models. Seeded so the city is identical
// on every load (the screenshots must be reproducible).
const THREE = globalThis.THREE;

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

// A palm: tapered trunk + 7 drooping fronds.
function makePalm(x, z, s, parent) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.22 * s, 4.6 * s, 6), MAT.trunk);
  trunk.position.y = 2.3 * s; g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.4;
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(2.6 * s, 0.7 * s), MAT.frond);
    frond.position.set(Math.cos(a) * 1.1 * s, 4.7 * s, Math.sin(a) * 1.1 * s);
    frond.rotation.set(0.5 + rand() * 0.3, -a + Math.PI / 2, 0);
    frond.rotation.x = 0.55;
    frond.rotation.y = -a;
    frond.rotation.z = 0.25;
    g.add(frond);
  }
  // coconuts
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 }));
  nut.position.set(0.2 * s, 4.4 * s, 0.1 * s); g.add(nut);
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

// A street lamp: pole + arm + head + warm glow + light pool on the ground.
function makeLamp(x, z, parent) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6), MAT.lampPole);
  pole.position.y = 2.6; g.add(pole);
  const arm = box(1.4, 0.1, 0.1, MAT.lampPole, 0.6, 5.1, 0, g);
  const head = box(0.5, 0.14, 0.24, MAT.lampPole, 1.25, 5.05, 0, g);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc95e, emissiveIntensity: 1.6 }));
  bulb.position.set(1.25, 4.96, 0); g.add(bulb);
  addGlow(g, 1.25, 4.9, 0, 2, glowTexWarm);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20),
    new THREE.MeshBasicMaterial({ map: glowTexWarm, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(1.25, 0.06, 0); g.add(pool);
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

// ---- the city ----
const STREET_Z = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
const STREET_X = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
const STREET_W = 12;
const CANAL = { z0: -262, z1: -302, x0: -330, x1: 330 }; // water strip (north edge)
const BRIDGE = { x: 0, z: -282 };

export function buildCity(scene) {
  sceneRoot = scene;
  initMaterials();
  const refs = { water: null, ripples: [], bridge: null, sign: null, palms: [], lamps: [] };

  // Sky handled in main.js (gradient dome + sun). Here: ground + streets.
  // Base ground (the whole island slab).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760),
    new THREE.MeshStandardMaterial({ color: 0x2e2b33, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0);
  scene.add(ground);

  // Streets (asphalt strips) + sidewalks.
  const streetMat = MAT.asphalt;
  for (const z of STREET_Z) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(560, STREET_W), streetMat);
    s.rotation.x = -Math.PI / 2; s.position.set(0, 0.02, z);
    scene.add(s);
    // sidewalks
    for (const dz of [-STREET_W / 2 - 1.6, STREET_W / 2 + 1.6]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(560, 3.2), MAT.sidewalk);
      sw.rotation.x = -Math.PI / 2; sw.position.set(0, 0.05, z + dz);
      scene.add(sw);
    }
    // centre dashes
    for (let x = -270; x < 270; x += 9) {
      const d = box(3.2, 0.02, 0.35,
        new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.7 }), x, 0.04, z, scene);
      d.receiveShadow = false;
    }
  }
  for (const x of STREET_X) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(STREET_W, 560), streetMat);
    s.rotation.x = -Math.PI / 2; s.position.set(x, 0.02, 0);
    scene.add(s);
    for (const dx of [-STREET_W / 2 - 1.6, STREET_W / 2 + 1.6]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 560), MAT.sidewalk);
      sw.rotation.x = -Math.PI / 2; sw.position.set(x + dx, 0.05, 0);
      scene.add(sw);
    }
    for (let z = -250; z < 250; z += 9) {
      box(0.35, 0.02, 3.2,
        new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.7 }), x, 0.04, z, scene);
    }
  }
  // Crosswalk stripes at the main intersections.
  for (const x of [-120, 0, 120]) {
    for (const z of [-120, 0, 120]) {
      for (let i = -2; i <= 2; i++) {
        box(0.7, 0.02, 2.6,
          new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.8 }),
          x + i * 1.6, 0.05, z - STREET_W / 2 - 0.4, scene);
        box(0.7, 0.02, 2.6,
          new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.8 }),
          x + i * 1.6, 0.05, z + STREET_W / 2 + 0.4, scene);
      }
    }
  }

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
  // Glass Spire (tallest tower, finale heist site) at (120,-120)
  const spire = new THREE.Group();
  const spireTex = windowTexture('#2a3a55', 0.4);
  const spireBody = new THREE.Mesh(new THREE.BoxGeometry(34, 88, 34),
    new THREE.MeshStandardMaterial({ map: spireTex, roughness: 0.25, metalness: 0.6, envMapIntensity: 1.2 }));
  spireBody.position.y = 44; spire.add(spireBody);
  const spireTop = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), MAT.glass);
  spireTop.position.y = 93; spire.add(spireTop);
  const spireTip = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 12, 6),
    new THREE.MeshStandardMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: 1.3 }));
  spireTip.position.y = 104; spire.add(spireTip);
  addGlow(spire, 0, 104, 0, 6, glowTexPink);
  spire.position.set(120, 0, -120); scene.add(spire);

  // Regular blocks: one building per block, with facade variety.
  for (let bx = -4; bx <= 4; bx++) {
    for (let bz = -4; bz <= 4; bz++) {
      const cx = bx * 60, cz = bz * 60;
      // skip the plaza, the bridge approach and the spire plot
      if (bx === -1 && bz === 1) continue; // plaza
      if (bx === 0 && bz <= -4) continue; // bridge approach road
      if (bx === 2 && bz === -2) continue; // spire plot
      if (Math.abs(cx) > 250 || Math.abs(cz) > 250) continue;
      const h = pick([14, 18, 22, 26, 34, 44, 58]);
      const f = pick(facades);
      const tex = windowTexture(f.base, f.lit);
      const w = range(30, 44), d = range(30, 44);
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
      // ground-floor shop front (on the street-facing side) with awning + sign
      if (rand() < 0.75) {
        const [name, col] = shopSigns[signIdx++ % shopSigns.length];
        const front = box(w * 0.9, 4.2, 0.8,
          new THREE.MeshStandardMaterial({ color: 0x1c1f2a, roughness: 0.4, metalness: 0.3 }),
          0, 2.1, d / 2 + 0.2, b);
        const st = signTexture(name, col, '#0d0f18');
        const sp = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(14, w * 0.7), 2.6),
          new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.9, transparent: true }));
        sp.position.set(0, 3.4, d / 2 + 0.65); b.add(sp);
        addGlow(b, 0, 3.4, d / 2 + 1.2, 3.5, col === '#ff2e88' || col === '#c86bff' || col === '#ff2ec8' ? glowTexPink : glowTexCyan);
        // awning (sloped, striped by colour)
        const aw = box(w * 0.7, 0.25, 2.4, pick(awnMats), 0, 4.6, d / 2 + 1.2, b);
        aw.rotation.x = 0.28;
      }
      b.position.set(cx + range(-4, 4), 0, cz + range(-4, 4));
      b.rotation.y = (rand() < 0.5 ? 0 : Math.PI / 2) * 0; // keep facades street-aligned
      scene.add(b);
    }
  }

  // ---- Sunset Plaza + fountain (at -60, 60) ----
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
  plaza.position.set(-60, 0, 60); scene.add(plaza);

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

  // ---- palms, lamps, benches along the boulevards ----
  for (const z of [0, 60, -60, 120]) {
    for (let x = -260; x <= 260; x += 42) {
      if (Math.abs(x) < 14) continue;
      makePalm(x + range(-3, 3), z + 9.5, range(0.9, 1.25), scene);
      refs.palms.push(1);
    }
  }
  for (const x of [-180, -60, 60, 180]) {
    for (let z = -220; z <= 220; z += 55) {
      if (Math.abs(z) < 14) continue;
      makePalm(x + 9.5, z + range(-3, 3), range(0.9, 1.2), scene);
      refs.palms.push(1);
    }
  }
  for (let x = -260; x <= 260; x += 52) {
    makeLamp(x, 8.2, scene); refs.lamps.push(1);
    makeLamp(x + 26, -8.2, scene); refs.lamps.push(1);
  }
  // benches + planters on the plaza edge
  for (let i = 0; i < 8; i++) {
    const bx = -80 + i * 6;
    box(2.6, 0.5, 0.9, new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 }), bx, 0.35, 78, scene);
    box(1.4, 1.1, 1.4, new THREE.MeshStandardMaterial({ color: 0x3d6b4a, roughness: 0.9 }), bx + 4, 0.55, 78, scene);
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
