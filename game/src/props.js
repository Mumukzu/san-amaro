// Street props of San Amaro: lamps, palms, hydrants, benches, bins,
// billboards, freestanding mural walls, the SAN AMARO hillside sign,
// power poles with sagging cables, and the plaza fountain.
// Original brand names only; nothing from any commercial game.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { aabb, canvasTexture, mergeGeoms, mulberry32, rand, signTexture, texturedBox } from './utils.js';

function frondTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = '#2f5d32';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(64, 128); ctx.lineTo(64, 10); ctx.stroke();
    ctx.lineWidth = 3;
    for (let i = 0; i < 14; i += 1) {
      const t = i / 14;
      const y = 118 - t * 105;
      const len = 52 * (1 - t * 0.55);
      const droop = 14 + t * 22;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(64, y);
        ctx.quadraticCurveTo(64 + s * len * 0.6, y - 6, 64 + s * len, y + droop);
        ctx.stroke();
      }
    }
  });
}

function muralTexture(seed, style) {
  return canvasTexture(512, 320, (ctx) => {
    const rng = mulberry32(seed);
    if (style === 0) {
      // Sunset gradient + palm silhouettes.
      const g = ctx.createLinearGradient(0, 0, 0, 320);
      g.addColorStop(0, '#ff7a1a'); g.addColorStop(0.55, '#ff2e88'); g.addColorStop(1, '#5a2a8a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 320);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(380, 110, 52, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1d1430';
      for (const [x, h] of [[60, 150], [150, 190], [430, 130]]) {
        ctx.fillRect(x, 320 - h, 8, h);
        for (let a = 0; a < 7; a += 1) {
          const ang = -Math.PI * (0.15 + a * 0.12);
          ctx.beginPath(); ctx.moveTo(x + 4, 320 - h);
          ctx.lineTo(x + 4 + Math.cos(ang) * 55, 320 - h + Math.sin(ang) * 55);
          ctx.lineWidth = 5; ctx.strokeStyle = '#1d1430'; ctx.stroke();
        }
      }
    } else if (style === 1) {
      // Neon skyline at dusk: dark violet, neon-outlined towers with lit
      // windows, a pink sun. (The old rainbow waves read as a cheap poster.)
      ctx.fillStyle = '#1d1430'; ctx.fillRect(0, 0, 512, 320);
      ctx.fillStyle = '#ff2e88';
      ctx.beginPath(); ctx.arc(400, 90, 46, 0, Math.PI * 2); ctx.fill();
      const silhouettes = [[20, 200, 70], [110, 260, 90], [220, 180, 60], [300, 240, 80], [400, 170, 66]];
      const neon = ['#22e6ff', '#ff2e88', '#ffd23e', '#7aff5a'];
      for (let i = 0; i < silhouettes.length; i += 1) {
        const [x, h, w] = silhouettes[i];
        ctx.fillStyle = '#0d0a1a';
        ctx.fillRect(x, 320 - h, w, h);
        ctx.strokeStyle = neon[i % neon.length]; ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, 320 - h + 2, w - 4, h - 4);
        ctx.fillStyle = '#ffd28a';
        for (let wy = 320 - h + 14; wy < 300; wy += 22) {
          for (let wx = x + 10; wx < x + w - 10; wx += 18) {
            if (rng() < 0.4) ctx.fillRect(wx, wy, 8, 10);
          }
        }
      }
    } else {
      // Big sun + city blocks.
      ctx.fillStyle = '#f4e3c2'; ctx.fillRect(0, 0, 512, 320);
      ctx.fillStyle = '#ff5a3c';
      ctx.beginPath(); ctx.arc(256, 150, 90, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1f2a3a';
      const heights = [120, 190, 90, 210, 140, 170, 100];
      let x = 20;
      for (const h of heights) {
        ctx.fillRect(x, 320 - h, 56, h);
        x += 68;
      }
      ctx.fillStyle = '#22e6ff';
      for (let i = 0; i < 24; i += 1) {
        ctx.fillRect(30 + rng() * 450, 40 + rng() * 200, 10 + rng() * 18, 8);
      }
    }
  });
}

export function buildProps(scene) {
  const rng = mulberry32(WORLD.seed + 21);
  const colliders = [];
  const glowMats = []; // materials whose emissiveIntensity follows windowGlow
  const lampHeadMats = [];
  const poolMats = [];

  // ---- Street lamps along every main road (boulevards z = +/-50 and the
  // north-south avenues x = +/-50), plus the plaza. Instanced (pole / head /
  // pool = 3 draw calls total), so more lamps cost nothing per frame. ----
  const lampPos = [];
  for (let x = -240; x <= 240; x += 48) {
    lampPos.push([x, 50 - 11]); lampPos.push([x + 24, 50 + 11]);
    lampPos.push([x, -50 - 11]); lampPos.push([x + 24, -50 + 11]);
  }
  for (let z = -240; z <= 240; z += 48) {
    lampPos.push([50 - 11, z]); lampPos.push([50 + 11, z + 24]);
    lampPos.push([-50 - 11, z]); lampPos.push([-50 + 11, z + 24]);
  }
  for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) lampPos.push([x, z]);
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 7, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.55, metalness: 0.6 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPos.length);
  const headGeo = new THREE.BoxGeometry(0.55, 0.28, 0.9);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 0,
    roughness: 0.4, metalness: 0.3,
  });
  lampHeadMats.push(headMat);
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampPos.length);
  const poolTex = canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,210,150,0.9)');
    g.addColorStop(0.5, 'rgba(255,180,90,0.28)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });
  const poolGeo = new THREE.CircleGeometry(9, 20);
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  poolMats.push(poolMat);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lampPos.length);
  const dummy = new THREE.Object3D();
  lampPos.forEach(([x, z], i) => {
    dummy.position.set(x, 3.5, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 7.05, z); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 0.06, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);
    dummy.rotation.set(0, 0, 0);
  });
  poles.castShadow = true;
  scene.add(poles); scene.add(heads); scene.add(pools);

  // ---- Palm trees: both boulevards, the avenues, the plaza ring,
  // strip-mall fronts. Instanced trunks + fronds (2 draw calls total). ----
  const palmPos = [];
  for (let x = -230; x <= 230; x += 40) {
    palmPos.push([x, 50 - 10.5]); palmPos.push([x + 20, 50 + 10.5]);
    palmPos.push([x, -50 - 10.5]); palmPos.push([x + 20, -50 + 10.5]);
  }
  for (let z = -230; z <= 230; z += 40) {
    palmPos.push([50 - 10.5, z]); palmPos.push([50 + 10.5, z + 20]);
    palmPos.push([-50 - 10.5, z]); palmPos.push([-50 + 10.5, z + 20]);
  }
  for (let a = 0; a < 8; a += 1) {
    const ang = (a / 8) * Math.PI * 2;
    palmPos.push([Math.cos(ang) * 30, Math.sin(ang) * 30]);
  }
  for (const [x, z] of [[-230, 8], [-210, 8], [210, 8], [230, 8], [-230, -8], [210, -8]]) palmPos.push([x, z]);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 9, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 0.9, metalness: 0 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPos.length);
  const frondTex = frondTexture();
  const frondGeo = new THREE.PlaneGeometry(4.2, 1.8);
  const frondMat = new THREE.MeshStandardMaterial({
    map: frondTex, alphaTest: 0.5, side: THREE.DoubleSide,
    roughness: 0.85, metalness: 0, color: 0x9fd4a0,
  });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmPos.length * 10);
  let fi = 0;
  palmPos.forEach(([x, z], i) => {
    const h = rand(rng, 8, 12);
    dummy.position.set(x, h / 2, z);
    dummy.rotation.set(0, rng() * Math.PI, (rng() - 0.5) * 0.06);
    dummy.scale.set(1, h / 9, 1);
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 10; k += 1) {
      const a = (k / 10) * Math.PI * 2 + rng() * 0.3;
      dummy.position.set(x + Math.sin(a) * 1.3, h - 0.4, z + Math.cos(a) * 1.3);
      dummy.rotation.order = 'YXZ';
      dummy.rotation.set(-0.65, a, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix(); fronds.setMatrixAt(fi, dummy.matrix); fi += 1;
      dummy.rotation.order = 'XYZ';
    }
  });
  trunks.castShadow = true;
  scene.add(trunks); scene.add(fronds);

  // ---- Hydrants, benches, bins ----
  const hydGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8);
  const hydMat = new THREE.MeshStandardMaterial({ color: 0xc23a2a, roughness: 0.5, metalness: 0.3 });
  const hydPos = [];
  for (const [x, z] of [
    [-58, 42], [58, 42], [-58, 58], [58, 58], [-158, 42], [158, 58],
    [-42, -58], [42, -58], [-158, -42], [158, -42], [-42, 158], [42, 158],
    [-142, 142], [142, -142], [-242, 42], [242, -58],
  ]) hydPos.push([x, z]);
  const hyds = new THREE.InstancedMesh(hydGeo, hydMat, hydPos.length);
  hydPos.forEach(([x, z], i) => {
    dummy.position.set(x, 0.45, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    hyds.setMatrixAt(i, dummy.matrix);
  });
  scene.add(hyds);

  const benchGeo = new THREE.BoxGeometry(2.4, 0.12, 0.6);
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.85, metalness: 0 });
  const benches = new THREE.InstancedMesh(benchGeo, benchMat, 12);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 22, 0.5, Math.sin(a) * 22);
    dummy.rotation.set(0, -a + Math.PI / 2, 0); dummy.updateMatrix();
    benches.setMatrixAt(i, dummy.matrix);
  }
  // Four more benches along the boulevard sidewalks.
  for (let i = 0; i < 4; i += 1) {
    dummy.position.set(-150 + i * 100, 0.5, 38.5);
    dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    benches.setMatrixAt(8 + i, dummy.matrix);
  }
  scene.add(benches);

  const binGeo = new THREE.CylinderGeometry(0.4, 0.36, 0.9, 10);
  const binMat = new THREE.MeshStandardMaterial({ color: 0x2a4a3a, roughness: 0.7, metalness: 0.4 });
  const bins = new THREE.InstancedMesh(binGeo, binMat, 24);
  for (let i = 0; i < 12; i += 1) {
    const x = -240 + i * 44;
    dummy.position.set(x, 0.45, i % 2 === 0 ? 38.5 : 61.5);
    dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    bins.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 12; i += 1) {
    const z = -240 + i * 44;
    dummy.position.set(i % 2 === 0 ? -38.5 : -61.5, 0.45, z);
    dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    bins.setMatrixAt(12 + i, dummy.matrix);
  }
  scene.add(bins);

  // ---- Billboards (original brands) ----
  const billboards = [
    { x: 150, z: -50, ry: 0, text: 'NEON COLA', sub: 'Taste the Sunset', bg: '#ff2e88', fg: '#ffffff' },
    { x: -150, z: 50, ry: Math.PI, text: 'PALM DRIVE MOTORS', sub: 'Drive San Amaro', bg: '#123a6a', fg: '#ffd23e' },
    { x: -150, z: -50, ry: Math.PI, text: "PALM & PISTON", sub: "Nadia's Garage · Tune · Paint · Nitro", bg: '#1f8a8a', fg: '#ffffff' },
    { x: 150, z: 50, ry: 0, text: "MABEL'S PIE HOUSE", sub: 'Pie All Day · Since 1962', bg: '#c96a1e', fg: '#fff3d0' },
  ];
  for (const b of billboards) {
    const tex = signTexture(b.text, b.sub, b.bg, b.fg, 1024, 320);
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map, emissiveMap: tex.emissive, emissive: 0xffffff, emissiveIntensity: 0.4,
      roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide,
    });
    glowMats.push(mat);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), mat);
    panel.position.set(b.x, 9, b.z);
    panel.rotation.y = b.ry;
    scene.add(panel);
    const poleMat2 = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.6 });
    for (const ox of [-6, 6]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), poleMat2);
      pole.position.set(b.x + ox, 3.5, b.z);
      pole.castShadow = true;
      scene.add(pole);
    }
    colliders.push(aabb(b.x, b.z, 0.5, 0.5));
  }

  // ---- Bus stops: a merged shelter (roof + posts + back panel, 1 call)
  // + a lit BUS sign, on the boulevard sidewalks. ----
  const busStops = [
    { x: -80, z: 38.5, ry: 0 },
    { x: 120, z: 61.5, ry: Math.PI },
  ];
  const shelterMat = new THREE.MeshStandardMaterial({ color: 0x1f5a5a, roughness: 0.6, metalness: 0.3 });
  for (const s of busStops) {
    const roof = texturedBox(4.5, 0.15, 1.8, 10);
    roof.matrix.setPosition(0, 2.6, 0);
    const postL = texturedBox(0.15, 2.6, 0.15, 10);
    postL.matrix.setPosition(-2.1, 1.3, 0.8);
    const postR = texturedBox(0.15, 2.6, 0.15, 10);
    postR.matrix.setPosition(2.1, 1.3, 0.8);
    const back = texturedBox(4.5, 1.2, 0.1, 10);
    back.matrix.setPosition(0, 1.4, -0.85);
    const shelter = new THREE.Mesh(mergeGeoms([roof, postL, postR, back]), shelterMat);
    shelter.position.set(s.x, 0, s.z);
    shelter.rotation.y = s.ry;
    shelter.castShadow = true;
    scene.add(shelter);
    const signTex = signTexture('BUS', 'San Amaro Transit', '#123a6a', '#ffd23e', 512, 160);
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex.map, emissiveMap: signTex.emissive, emissive: 0xffffff, emissiveIntensity: 0.4,
      roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide,
    });
    glowMats.push(signMat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), signMat);
    sign.position.set(s.x, 3.1, s.z);
    sign.rotation.y = s.ry;
    scene.add(sign);
    colliders.push(aabb(s.x, s.z, 2.3, 1));
  }

  // ---- Freestanding mural walls near the boulevard ----
  const murals = [
    { x: -80, z: 36, ry: 0 },
    { x: 60, z: 64, ry: Math.PI },
    { x: -20, z: -36, ry: Math.PI },
  ];
  murals.forEach((m, i) => {
    const tex = muralTexture(WORLD.seed + 31 + i, i);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 });
    // A thin BOX, not a plane + solid backing frame: the old backing box
    // read as a black monolith from behind (the plane was single-sided).
    // A box shows the mural on both faces.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 8.75, 0.3), mat);
    wall.position.set(m.x, 4.6, m.z);
    wall.rotation.y = m.ry;
    wall.castShadow = true;
    scene.add(wall);
    colliders.push(aabb(m.x, m.z, 7.3, 0.4));
  });

  // ---- SAN AMARO hillside sign, north edge ----
  {
    const tex = canvasTexture(1024, 160, (ctx) => {
      ctx.clearRect(0, 0, 1024, 160);
      ctx.fillStyle = '#f4f1e8';
      ctx.font = '900 118px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SAN AMARO', 512, 84);
    });
    const mat = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, emissive: 0xffffff, emissiveMap: tex,
      emissiveIntensity: 0.15, roughness: 0.6, metalness: 0, side: THREE.DoubleSide,
    });
    glowMats.push(mat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(56, 8.75), mat);
    sign.position.set(0, 15, -292);
    scene.add(sign);
    const poleMat2 = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.7, metalness: 0.5 });
    for (const ox of [-24, 24]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 12, 8), poleMat2);
      pole.position.set(ox, 6, -292);
      scene.add(pole);
    }
  }

  // ---- Power poles + sagging cables along the boulevard ----
  {
    const poleGeo2 = new THREE.CylinderGeometry(0.13, 0.17, 8, 8);
    const poleMat2 = new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.85, metalness: 0 });
    const xs = [];
    for (let x = -240; x <= 240; x += 30) xs.push(x);
    const poles2 = new THREE.InstancedMesh(poleGeo2, poleMat2, xs.length);
    xs.forEach((x, i) => {
      dummy.position.set(x, 4, 39); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      poles2.setMatrixAt(i, dummy.matrix);
    });
    scene.add(poles2);
    const pts = [];
    for (let i = 0; i < xs.length - 1; i += 1) {
      const x0 = xs[i]; const x1 = xs[i + 1];
      for (let s = 0; s < 8; s += 1) {
        const t0 = s / 8; const t1 = (s + 1) / 8;
        const sag = (t) => -1.3 * 4 * t * (1 - t);
        pts.push(new THREE.Vector3(x0 + (x1 - x0) * t0, 7.6 + sag(t0), 39));
        pts.push(new THREE.Vector3(x0 + (x1 - x0) * t1, 7.6 + sag(t1), 39));
      }
    }
    const cableGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const cableMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
    scene.add(new THREE.LineSegments(cableGeo, cableMat));
  }

  // ---- Plaza fountain ----
  {
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(12, 12.6, 1.1, 24),
      new THREE.MeshStandardMaterial({ color: 0x7a7268, roughness: 0.85, metalness: 0 }),
    );
    basin.position.set(0, 0.55, 0);
    basin.castShadow = true; basin.receiveShadow = true;
    scene.add(basin);
    // Water sits just ABOVE the basin rim: it was buried under the basin's
    // top face before, so the fountain read as a white disc.
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(11.2, 24),
      new THREE.MeshStandardMaterial({ color: 0x3f7a9a, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.5 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 1.12, 0);
    scene.add(water);
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.5, 3.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x7a7268, roughness: 0.85, metalness: 0 }),
    );
    column.position.set(0, 2.4, 0);
    column.castShadow = true;
    scene.add(column);
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x7a7268, roughness: 0.8, metalness: 0.05 }),
    );
    top.position.set(0, 4.6, 0);
    scene.add(top);
    colliders.push(aabb(0, 0, 12.6, 12.6));
  }

  function setGlow(windowGlow, lampOn) {
    // Night readability: pools are bigger and stronger (0.85), lamp heads
    // burn at 3.2 so bloom catches them — the street must glow, not go black.
    for (const m of glowMats) m.emissiveIntensity = 0.15 + windowGlow * 0.9;
    for (const m of lampHeadMats) m.emissiveIntensity = lampOn ? 3.2 : 0;
    for (const m of poolMats) m.opacity = lampOn ? 0.85 : 0;
  }

  return { colliders, setGlow };
}
