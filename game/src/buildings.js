// Buildings of San Amaro: glass towers with randomized silhouettes, mid-rise
// stucco blocks, strip malls and dingbat apartments. Facades are canvas
// textures (window grids with random lit windows + a black emissive canvas so
// only the lit windows glow at night). Each building is ONE merged mesh with
// a dark roof slab as a second material group. Rooftop props (AC boxes, water
// tanks, antennas) are InstancedMeshes shared across all roofs.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { aabb, canvasTexture, mergeGeoms, mulberry32, pick, rand, signTexture, texturedBox } from './utils.js';

// ---- Facade textures (256x256 = one 10x10 m tile) ----
function facadeCanvases(drawWindows) {
  const map = canvasTexture(256, 256, drawWindows.map);
  const emissive = canvasTexture(256, 256, drawWindows.emissive);
  return { map, emissive };
}

function windowGrid(ctx, cols, rows, litChance, rng, litColors, fillW = 0.64, fillH = 0.6) {
  const cw = 256 / cols; const rh = 256 / rows;
  const lit = [];
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const x = c * cw + cw * (1 - fillW) / 2; const y = r * rh + rh * (1 - fillH) / 2;
      const w = cw * fillW; const h = rh * fillH;
      const isLit = rng() < litChance;
      lit.push({ x, y, w, h, isLit, warm: pick(rng, litColors) });
    }
  }
  return lit;
}

function glassFacade(rng) {
  // Big glass panes (fill 0.78 x 0.72): the mullion grid must not dominate,
  // or the tower reads as a dark monolith from the street.
  const lit = windowGrid(null, 4, 5, 0.42, rng, ['#ffd28a', '#ffbe6e', '#ffe9b0'], 0.78, 0.72);
  return facadeCanvases({
    map: (ctx) => {
      // Glass towers read as a dark mullion grid with BRIGHT reflective
      // panes — a flat blue gradient was a giant blue slab. The panes are
      // light sky-blue with a white highlight streak; the grid is dark.
      ctx.fillStyle = '#3a4a58'; ctx.fillRect(0, 0, 256, 256);
      for (const w of lit) {
        const g = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
        if (w.isLit) {
          g.addColorStop(0, w.warm); g.addColorStop(1, '#c98a3a');
        } else {
          g.addColorStop(0, '#a8c8dc'); g.addColorStop(1, '#6a8aa8');
        }
        ctx.fillStyle = g;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        // Highlight streak on each pane so the glass catches the light.
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(w.x + 2, w.y + 2, w.w * 0.35, w.h * 0.5);
      }
      // Floor bands between rows (strong, so the tower reads as floors).
      ctx.fillStyle = 'rgba(10,14,18,0.85)';
      for (let r = 0; r < 5; r += 1) ctx.fillRect(0, r * (256 / 5) + 46, 256, 5);
    },
    emissive: (ctx) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 256);
      for (const w of lit) {
        if (!w.isLit) continue;
        ctx.fillStyle = w.warm;
        ctx.fillRect(w.x, w.y, w.w, w.h);
      }
    },
  });
}

function stuccoFacade(rng, base = '#c9bfa9') {
  // Art-deco pastels: each stucco material gets one warm pastel base so
  // mid-rise blocks read as a Miami street, not grey slabs.
  const lit = windowGrid(null, 5, 5, 0.3, rng, ['#ffd28a', '#ffce9a']);
  return facadeCanvases({
    map: (ctx) => {
      ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 500; i += 1) {
        ctx.fillStyle = `rgba(90,80,60,${0.04 + rng() * 0.06})`;
        ctx.fillRect(rng() * 256, rng() * 256, 2, 2);
      }
      // Grime near the base.
      const g = ctx.createLinearGradient(0, 200, 0, 256);
      g.addColorStop(0, 'rgba(107,101,88,0)'); g.addColorStop(1, 'rgba(107,101,88,0.55)');
      ctx.fillStyle = g; ctx.fillRect(0, 200, 256, 56);
      for (const w of lit) {
        ctx.fillStyle = '#3a3f45'; ctx.fillRect(w.x - 3, w.y - 3, w.w + 6, w.h + 6);
        ctx.fillStyle = w.isLit ? w.warm : '#232c36';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        // Balcony slab under every other row.
        if (Math.floor(w.y / (256 / 5)) % 2 === 0) {
          ctx.fillStyle = 'rgba(60,52,44,0.8)';
          ctx.fillRect(w.x - 4, w.y + w.h + 1, w.w + 8, 4);
        }
      }
    },
    emissive: (ctx) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 256);
      for (const w of lit) {
        if (!w.isLit) continue;
        ctx.fillStyle = w.warm;
        ctx.fillRect(w.x, w.y, w.w, w.h);
      }
    },
  });
}

function shopFacade(rng) {
  const lit = windowGrid(null, 5, 3, 0.5, rng, ['#ffe9b0', '#ffd28a']);
  return facadeCanvases({
    map: (ctx) => {
      ctx.fillStyle = '#8a7a62'; ctx.fillRect(0, 0, 256, 256);
      // Awning band.
      ctx.fillStyle = pick(rng, ['#b03a5a', '#2a7a6a', '#c96a1e', '#3a5ab0']);
      ctx.fillRect(0, 0, 256, 44);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 44, 16, 6);
      for (const w of lit) {
        ctx.fillStyle = '#20262c'; ctx.fillRect(w.x - 3, 60 + w.y * 0.6 - 3, w.w + 6, w.h + 6);
        ctx.fillStyle = w.isLit ? w.warm : '#1c2a33';
        ctx.fillRect(w.x, 60 + w.y * 0.6, w.w, w.h);
      }
    },
    emissive: (ctx) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 256);
      for (const w of lit) {
        if (!w.isLit) continue;
        ctx.fillStyle = w.warm;
        ctx.fillRect(w.x, 60 + w.y * 0.6, w.w, w.h);
      }
    },
  });
}

function brickFacade(rng) {
  // Red-brick apartments (dingbat blocks): mortar courses + small windows.
  const lit = windowGrid(null, 5, 4, 0.3, rng, ['#ffd28a', '#ffce9a']);
  return facadeCanvases({
    map: (ctx) => {
      ctx.fillStyle = '#8a4a3a'; ctx.fillRect(0, 0, 256, 256);
      // Mortar courses.
      ctx.strokeStyle = 'rgba(220,190,170,0.28)'; ctx.lineWidth = 1;
      for (let y = 0; y < 256; y += 10) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
      }
      for (let y = 0; y < 256; y += 10) {
        const off = (y / 10) % 2 === 0 ? 0 : 12;
        for (let x = off; x < 256; x += 24) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 10); ctx.stroke();
        }
      }
      // Brick tone variation.
      for (let i = 0; i < 300; i += 1) {
        ctx.fillStyle = `rgba(${rng() < 0.5 ? '60,20,10' : '200,120,90'},${0.05 + rng() * 0.07})`;
        ctx.fillRect(rng() * 256, rng() * 256, 4 + rng() * 8, 2 + rng() * 3);
      }
      for (const w of lit) {
        ctx.fillStyle = '#2c2622'; ctx.fillRect(w.x - 3, w.y - 3, w.w + 6, w.h + 6);
        ctx.fillStyle = w.isLit ? w.warm : '#1e2830';
        ctx.fillRect(w.x, w.y, w.w, w.h);
      }
    },
    emissive: (ctx) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 256);
      for (const w of lit) {
        if (!w.isLit) continue;
        ctx.fillStyle = w.warm;
        ctx.fillRect(w.x, w.y, w.w, w.h);
      }
    },
  });
}

// ---- Building construction ----
const PROFILES = ['taper', 'step', 'crown', 'spire', 'chamfer', 'split'];

function towerParts(rng, w, d, h, forceProfile = null) {
  const profile = forceProfile || pick(rng, PROFILES);
  const parts = [];
  const h1 = h * 0.62;
  parts.push(texturedBox(w, h1, d, 20));
  parts[0].matrix.setPosition(0, h1 / 2, 0);
  // top = { w, d, y }: footprint and height of the highest tier (for the roof slab).
  let top = { w, d, y: h1 };
  if (profile === 'taper') {
    const topTier = new THREE.CylinderGeometry(w * 0.32, w * 0.48, h * 0.38, 4, 1);
    topTier.rotateY(Math.PI / 4);
    parts.push({ geo: topTier, matrix: new THREE.Matrix4().setPosition(0, h1 + h * 0.19, 0), uvScale: [w / 10, h * 0.38 / 10] });
    top = { w: w * 0.64, d: d * 0.64, y: h };
  } else if (profile === 'step') {
    parts.push(texturedBox(w * 0.68, h * 0.24, d * 0.68, 20));
    parts[1].matrix.setPosition(0, h1 + h * 0.12, 0);
    parts.push(texturedBox(w * 0.42, h * 0.14, d * 0.42, 20));
    parts[2].matrix.setPosition(0, h1 + h * 0.24 + h * 0.07, 0);
    top = { w: w * 0.42, d: d * 0.42, y: h };
  } else if (profile === 'crown') {
    parts.push(texturedBox(w * 0.7, h * 0.2, d * 0.7, 20));
    parts[1].matrix.setPosition(0, h1 + h * 0.1, 0);
    const crown = new THREE.BoxGeometry(w * 0.5, h * 0.1, d * 0.5);
    crown.rotateY(0.5);
    parts.push({ geo: crown, matrix: new THREE.Matrix4().setPosition(0, h1 + h * 0.25, 0), uvScale: [w / 10, h * 0.1 / 10] });
    top = { w: w * 0.5, d: d * 0.5, y: h1 + h * 0.3 };
  } else if (profile === 'spire') {
    parts.push(texturedBox(w * 0.55, h * 0.22, d * 0.55, 20));
    parts[1].matrix.setPosition(0, h1 + h * 0.11, 0);
    const spire = new THREE.ConeGeometry(Math.min(w, d) * 0.16, h * 0.22, 4);
    parts.push({ geo: spire, matrix: new THREE.Matrix4().setPosition(0, h1 + h * 0.22 + h * 0.11, 0), uvScale: [1, 1] });
    top = { w: w * 0.55, d: d * 0.55, y: h1 + h * 0.22 };
  } else if (profile === 'chamfer') {
    const dia = new THREE.BoxGeometry(w * 0.62, h * 0.3, d * 0.62);
    dia.rotateY(Math.PI / 4);
    parts.push({ geo: dia, matrix: new THREE.Matrix4().setPosition(0, h1 + h * 0.15, 0), uvScale: [w / 10, h * 0.3 / 10] });
    top = { w: w * 0.62, d: d * 0.62, y: h1 + h * 0.3 };
  } else { // split: two slabs with a gap
    parts.push(texturedBox(w * 0.42, h * 0.36, d * 0.9, 20));
    parts[1].matrix.setPosition(-w * 0.26, h1 + h * 0.18, 0);
    parts.push(texturedBox(w * 0.42, h * 0.3, d * 0.9, 20));
    parts[2].matrix.setPosition(w * 0.26, h1 + h * 0.15, 0);
    top = { w, d: d * 0.9, y: h1 + h * 0.36 };
  }
  return { parts, top };
}

const SHOP_SIGNS = [
  ['TACO PALACE', 'Tacos · Burritos · Open Late', '#b03a5a', '#ffe9b0'],
  ['DONUT DRIVE', 'Fresh 24 Hours', '#c96a1e', '#fff3d0'],
  ['SURF SHOP', 'Boards · Wax · Beach Gear', '#2a7a6a', '#e8fff4'],
  ['NEON NAILS', 'Salon & Spa', '#8a3ab0', '#ffd6ff'],
];

export function buildBuildings(scene, layout) {
  const rng = mulberry32(WORLD.seed + 7);
  const glass = glassFacade(rng);
  const stuccoA = stuccoFacade(rng, '#d8b8a0'); // terracotta pastel
  const stuccoB = stuccoFacade(rng, '#b8c8b0'); // sage pastel
  const brick = brickFacade(rng);
  const shop = shopFacade(rng);
  const mats = {
    glass: new THREE.MeshStandardMaterial({
      map: glass.map, emissiveMap: glass.emissive, emissive: 0xffffff, emissiveIntensity: 0.55,
      roughness: 0.3, metalness: 0.5, envMapIntensity: 1.1,
    }),
    stuccoA: new THREE.MeshStandardMaterial({
      map: stuccoA.map, emissiveMap: stuccoA.emissive, emissive: 0xffffff, emissiveIntensity: 0.55,
      roughness: 0.9, metalness: 0, envMapIntensity: 0.25,
    }),
    stuccoB: new THREE.MeshStandardMaterial({
      map: stuccoB.map, emissiveMap: stuccoB.emissive, emissive: 0xffffff, emissiveIntensity: 0.55,
      roughness: 0.9, metalness: 0, envMapIntensity: 0.25,
    }),
    brick: new THREE.MeshStandardMaterial({
      map: brick.map, emissiveMap: brick.emissive, emissive: 0xffffff, emissiveIntensity: 0.55,
      roughness: 0.85, metalness: 0, envMapIntensity: 0.3,
    }),
    shop: new THREE.MeshStandardMaterial({
      map: shop.map, emissiveMap: shop.emissive, emissive: 0xffffff, emissiveIntensity: 0.55,
      roughness: 0.55, metalness: 0.15, envMapIntensity: 0.5,
    }),
  };
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.95, metalness: 0 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.85, metalness: 0.05 });
  const colliders = [];
  const roofSpots = []; // { x, y, z } for rooftop props
  const signMats = [];
  let signIndex = 0;

  function addBuilding(parts, mat, cx, cz, hx, hz, slab, plinth = null) {
    // Dark roof slab on top of the highest tier so tower tops read as roofs.
    const s = texturedBox(slab.w + 0.6, 0.5, slab.d + 0.6, 10);
    s.matrix.setPosition(0, slab.y + 0.25, 0);
    s.matIndex = 1;
    const entries = [...parts, s];
    let materials = [mat, roofMat];
    if (plinth) {
      // Dark stone plinth at street level: towers sit on a real base instead
      // of glass running straight into the pavement.
      const p = texturedBox(plinth.w + 1, 3, plinth.d + 1, 10);
      p.matrix.setPosition(0, 1.5, 0);
      p.matIndex = 2;
      entries.push(p);
      materials = [mat, roofMat, plinthMat];
    }
    const geo = mergeGeoms(entries);
    const mesh = new THREE.Mesh(geo, materials);
    mesh.position.set(cx, 0, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push(aabb(cx, cz, hx, hz));
    roofSpots.push({ x: cx, y: slab.y + 0.5, z: cz, hw: hx, hd: hz });
  }

  for (const block of layout.blocks) {
    const { cx, cz, kind } = block;
    if (kind === 'plaza') continue;
    if (kind === 'tower') {
      const w = rand(rng, 30, 42); const d = rand(rng, 30, 42);
      // Landmark: the Glass Spire north of the plaza is the tallest tower
      // in the slice (the story's finale heist target).
      const landmark = cx === 0 && cz === -100;
      const h = landmark ? rand(rng, 105, 120) : rand(rng, 40, 110);
      const { parts, top } = towerParts(rng, w, d, h, landmark ? 'spire' : null);
      addBuilding(parts, mats.glass, cx, cz, w / 2, d / 2, top, { w, d });
    } else if (kind === 'mid') {
      for (const [ox, oz, w, d, h] of [
        [-14, -8, 30, 22, rand(rng, 13, 22)],
        [14, 10, 28, 20, rand(rng, 12, 20)],
      ]) {
        const parts = [texturedBox(w, h, d, 10)];
        parts[0].matrix.setPosition(0, h / 2, 0);
        parts.push(texturedBox(w * 0.7, 2.5, d * 0.7, 10));
        parts[1].matrix.setPosition(0, h + 1.25, 0);
        const mat = (ox < 0) ? mats.stuccoA : mats.stuccoB;
        addBuilding(parts, mat, cx + ox, cz + oz, w / 2, d / 2, { w: w * 0.7, d: d * 0.7, y: h + 2.5 });
      }
    } else if (kind === 'strip') {
      const w = 62; const d = 18; const h = 7;
      const parts = [texturedBox(w, h, d, 10)];
      parts[0].matrix.setPosition(0, h / 2, 0);
      addBuilding(parts, mats.shop, cx, cz, w / 2, d / 2, { w, d, y: h });
      // Fascia sign on the front face (facing the boulevard, z+ side).
      const [text, sub, bg, fg] = SHOP_SIGNS[signIndex % SHOP_SIGNS.length];
      signIndex += 1;
      const tex = signTexture(text, sub, bg, fg, 1024, 200);
      const sm = new THREE.MeshStandardMaterial({
        map: tex.map, emissiveMap: tex.emissive, emissive: 0xffffff, emissiveIntensity: 0.4,
        roughness: 0.5, metalness: 0.1,
      });
      signMats.push(sm);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(44, 3.4), sm);
      sign.position.set(cx, 5.2, cz + d / 2 + 0.15);
      scene.add(sign);
    } else if (kind === 'dingbat') {
      for (const oz of [-14, 14]) {
        const w = 46; const d = 12; const h = 9;
        const parts = [];
        // Pilotis (stilts) holding the block up over the carport.
        for (const pxo of [-20, -7, 7, 20]) {
          parts.push(texturedBox(1.2, 3, 1.2, 10));
          parts[parts.length - 1].matrix.setPosition(pxo, 1.5, 0);
        }
        parts.push(texturedBox(w, h - 3, d, 10));
        parts[parts.length - 1].matrix.setPosition(0, 3 + (h - 3) / 2, 0);
        addBuilding(parts, mats.brick, cx, cz + oz, w / 2, d / 2, { w, d, y: h });
      }
    }
  }

  // Rooftop props: AC boxes + water tanks + antennas, two InstancedMeshes.
  const acGeo = new THREE.BoxGeometry(2.2, 1.2, 2.2);
  const acMat = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.8, metalness: 0.4 });
  const tankGeo = new THREE.CylinderGeometry(1.4, 1.4, 3, 10);
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x7a6a52, roughness: 0.85, metalness: 0.1 });
  const acCount = roofSpots.length * 3;
  const tankCount = roofSpots.length;
  const acMesh = new THREE.InstancedMesh(acGeo, acMat, acCount);
  const tankMesh = new THREE.InstancedMesh(tankGeo, tankMat, tankCount);
  const m4 = new THREE.Matrix4();
  let ai = 0; let ti = 0;
  for (const spot of roofSpots) {
    for (let k = 0; k < 3; k += 1) {
      const ox = (rng() - 0.5) * (spot.hw * 1.4);
      const oz = (rng() - 0.5) * (spot.hd * 1.4);
      m4.makeRotationY(rng() * Math.PI);
      m4.setPosition(spot.x + ox, spot.y + 0.6, spot.z + oz);
      acMesh.setMatrixAt(ai, m4); ai += 1;
    }
    m4.makeRotationY(0);
    m4.setPosition(spot.x + (rng() - 0.5) * spot.hw, spot.y + 1.5, spot.z + (rng() - 0.5) * spot.hd);
    tankMesh.setMatrixAt(ti, m4); ti += 1;
  }
  acMesh.castShadow = true; tankMesh.castShadow = true;
  scene.add(acMesh); scene.add(tankMesh);

  function setWindowGlow(v) {
    for (const m of Object.values(mats)) m.emissiveIntensity = v;
    for (const m of signMats) m.emissiveIntensity = 0.15 + v * 0.9;
  }

  return { colliders, setWindowGlow };
}
