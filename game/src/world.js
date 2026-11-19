// City layout and ground: the 600x600 m downtown grid of San Amaro.
// Roads are drawn into one big canvas texture (asphalt, lane markings,
// crosswalks, sidewalks, plaza tiles) on a single ground plane — one draw call.
// Block kinds: plaza at the centre, glass towers around it, mid-rise / strip
// mall / dingbat rows on the outer ring.
import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';
import { canvasTexture, mulberry32 } from './utils.js';

const TEX = 2048;
const SCALE = TEX / 620; // pixels per metre (texture covers [-310, 310])
const px = (x) => (x + 310) * SCALE; // world x -> canvas x
const py = (z) => (310 - z) * SCALE; // world z -> canvas y (top row = north)

function blockKind(cx, cz) {
  if (cx === 0 && cz === 0) return 'plaza';
  if (Math.abs(cx) <= 100 && Math.abs(cz) <= 100) return 'tower';
  if ((cx === 200 || cx === -200) && cz === 0) return 'strip';
  if (cx === 0 && (cz === 200 || cz === -200)) return 'dingbat';
  return 'mid';
}

function drawGround(ctx, rng) {
  // Base: dark warm ground. The pale base was the prototype look — block
  // interiors now read as city concrete, never empty concrete slabs.
  ctx.fillStyle = '#5c554d';
  ctx.fillRect(0, 0, TEX, TEX);

  // Subtle noise over the whole ground so large areas never read flat.
  for (let i = 0; i < 9000; i += 1) {
    const g = 100 + Math.floor(rng() * 60);
    ctx.fillStyle = `rgba(${g},${g - 8},${g - 18},0.08)`;
    ctx.fillRect(rng() * TEX, rng() * TEX, 2 + rng() * 5, 2 + rng() * 5);
  }

  // Block interiors: warm stucco-ish pavement, slightly varied per block.
  for (const bx of WORLD.blockAt) {
    for (const bz of WORLD.blockAt) {
      const kind = blockKind(bx, bz);
      const x0 = px(bx - WORLD.blockHalf); const z0 = py(bz + WORLD.blockHalf);
      const w = WORLD.blockHalf * 2 * SCALE;
      if (kind === 'plaza') {
        ctx.fillStyle = '#7a6550';
        ctx.fillRect(x0, z0, w, w);
        // Plaza tiles: checker of warm stone (kept muted — the pale
        // checkerboard read as a chessboard in daylight).
        const t = w / 8;
        for (let i = 0; i < 8; i += 1) {
          for (let j = 0; j < 8; j += 1) {
            if ((i + j) % 2 === 0) {
              ctx.fillStyle = '#72604a';
              ctx.fillRect(x0 + i * t, z0 + j * t, t, t);
            }
          }
        }
        // Fountain ring at the centre.
        ctx.strokeStyle = '#5a7a8a'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(px(0), py(0), 14 * SCALE, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#3f6a7a';
        ctx.beginPath(); ctx.arc(px(0), py(0), 11 * SCALE, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'strip') {
        ctx.fillStyle = '#6a655b';
        ctx.fillRect(x0, z0, w, w);
        // Parking-lot stall lines on the front half.
        ctx.strokeStyle = '#d5d5d0'; ctx.lineWidth = 2;
        for (let i = 0; i <= 10; i += 1) {
          const sx = x0 + (i / 10) * w;
          ctx.beginPath(); ctx.moveTo(sx, z0 + w * 0.55); ctx.lineTo(sx, z0 + w * 0.95); ctx.stroke();
        }
      } else {
        const tones = { tower: '#6b6258', mid: '#71695c', dingbat: '#776e60' };
        ctx.fillStyle = tones[kind] || '#6b6258';
        ctx.fillRect(x0, z0, w, w);
      }
    }
  }

  // Roads: asphalt strips along every grid line, both axes.
  ctx.fillStyle = PALETTE.asphalt;
  for (const r of WORLD.roadAt) {
    ctx.fillRect(px(r - WORLD.roadHalf), 0, WORLD.roadHalf * 2 * SCALE, TEX); // N-S
    ctx.fillRect(0, py(r + WORLD.roadHalf), TEX, WORLD.roadHalf * 2 * SCALE); // E-W
  }

  // Sidewalks: lighter bands just outside the asphalt.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const r of WORLD.roadAt) {
    const a = WORLD.roadHalf; const b = WORLD.walkHalf;
    ctx.fillRect(px(r - b), 0, (b - a) * SCALE, TEX);
    ctx.fillRect(px(r + a), 0, (b - a) * SCALE, TEX);
    ctx.fillRect(0, py(r + b), TEX, (b - a) * SCALE);
    ctx.fillRect(0, py(r - a), TEX, (b - a) * SCALE);
  }

  // Curb lines.
  ctx.strokeStyle = PALETTE.curb; ctx.lineWidth = 2;
  for (const r of WORLD.roadAt) {
    for (const e of [-WORLD.walkHalf, WORLD.walkHalf]) {
      ctx.beginPath(); ctx.moveTo(px(r + e), 0); ctx.lineTo(px(r + e), TEX); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, py(r + e)); ctx.lineTo(TEX, py(r + e)); ctx.stroke();
    }
  }

  // Sidewalk tile joints: a joint every 2 m across each sidewalk band so the
  // street edge reads as poured-concrete sidewalk, not flat pale ground.
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5;
  for (const r of WORLD.roadAt) {
    const a = WORLD.roadHalf; const b = WORLD.walkHalf;
    for (let d = -300; d < 300; d += 2) {
      ctx.beginPath(); ctx.moveTo(px(r - b), py(d)); ctx.lineTo(px(r - a), py(d)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(r + a), py(d)); ctx.lineTo(px(r + b), py(d)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(d), py(r - b)); ctx.lineTo(px(d), py(r - a)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(d), py(r + a)); ctx.lineTo(px(d), py(r + b)); ctx.stroke();
    }
  }

  // Tire-wear: darkened lane centres on the asphalt so roads read as
  // driven-on, not fresh black slabs.
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  for (const r of WORLD.roadAt) {
    ctx.fillRect(px(r - 3.4), 0, 1.7 * SCALE, TEX);
    ctx.fillRect(px(r + 1.7), 0, 1.7 * SCALE, TEX);
    ctx.fillRect(0, py(r - 3.4), TEX, 1.7 * SCALE);
    ctx.fillRect(0, py(r + 1.7), TEX, 1.7 * SCALE);
  }

  // Oil stains: a few dark blobs on the asphalt near intersections.
  for (let i = 0; i < 26; i += 1) {
    const r = WORLD.roadAt[Math.floor(rng() * WORLD.roadAt.length)];
    const along = -280 + rng() * 560;
    const x = px(r + (rng() - 0.5) * 8); const y = py(along);
    const rad = (1 + rng() * 2.4) * SCALE;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(8,8,10,0.5)');
    g.addColorStop(1, 'rgba(8,8,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }

  // Lane markings: dashed centre yellow + solid edge white.
  ctx.fillStyle = PALETTE.laneYellow;
  for (const r of WORLD.roadAt) {
    for (let d = -300; d < 300; d += 12) {
      ctx.fillRect(px(r - 0.15), py(d + 4), 0.3 * SCALE, 6 * SCALE);
      ctx.fillRect(px(d - 3), py(r + 0.15), 6 * SCALE, 0.3 * SCALE);
    }
  }
  ctx.fillStyle = PALETTE.laneWhite;
  for (const r of WORLD.roadAt) {
    for (const e of [-6.5, 6.5]) {
      ctx.fillRect(px(r + e - 0.12), 0, 0.24 * SCALE, TEX);
      ctx.fillRect(0, py(r + e + 0.12), TEX, 0.24 * SCALE);
    }
  }

  // Crosswalks at every intersection: zebra stripes across all four arms.
  // Narrow stripes (0.9 m) — wide ones read as white slabs from above.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const rx of WORLD.roadAt) {
    for (const rz of WORLD.roadAt) {
      for (let i = -3; i <= 3; i += 1) {
        const off = i * 2.2;
        // North and south arms (stripes run E-W).
        ctx.fillRect(px(rx + off - 0.45), py(rz - 12), 0.9 * SCALE, 3.4 * SCALE);
        ctx.fillRect(px(rx + off - 0.45), py(rz + 12), 0.9 * SCALE, 3.4 * SCALE);
        // East and west arms (stripes run N-S).
        ctx.fillRect(px(rx - 12), py(rz + off - 0.45), 3.4 * SCALE, 0.9 * SCALE);
        ctx.fillRect(px(rx + 12), py(rz + off - 0.45), 3.4 * SCALE, 0.9 * SCALE);
      }
    }
  }

  // Cracks and patches on the asphalt so it never reads as a flat plane.
  for (let i = 0; i < 260; i += 1) {
    const x = rng() * TEX; const y = rng() * TEX;
    ctx.strokeStyle = `rgba(0,0,0,${0.05 + rng() * 0.1})`;
    ctx.lineWidth = 1 + rng() * 2;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 60); ctx.stroke();
  }
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = `rgba(0,0,0,${0.06 + rng() * 0.08})`;
    ctx.fillRect(rng() * TEX, rng() * TEX, 20 + rng() * 50, 14 + rng() * 30);
  }
}

export function buildWorld(scene) {
  const rng = mulberry32(WORLD.seed);
  const tex = canvasTexture(TEX, TEX, (ctx) => drawGround(ctx, rng));
  tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.4, // wet look: low roughness so the sky and lights sheen on it
    metalness: 0.2, // high metalness mirrored the pink sky across the whole
    envMapIntensity: 0.6, // ground and washed it out — keep the sheen subtle
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Layout data the other systems build from.
  const blocks = [];
  for (const bx of WORLD.blockAt) {
    for (const bz of WORLD.blockAt) {
      blocks.push({ cx: bx, cz: bz, kind: blockKind(bx, bz) });
    }
  }
  return { ground, blocks, groundMat: mat };
}
