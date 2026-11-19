// Small math / RNG / geometry helpers. No dependencies.
import * as THREE from 'three';

// Deterministic RNG (mulberry32): the same seed always builds the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
// Frame-rate independent damping factor.
export function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function rand(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

/**
 * Merge several indexed BufferGeometries (position/normal/uv) into one.
 * Each entry: { geo, matrix?, uvScale?: [su, sv], matIndex? }.
 * uvScale tiles the texture by world size so window density stays uniform.
 * Entries with matIndex produce geometry groups for multi-material meshes.
 */
export function mergeGeoms(entries) {
  let vCount = 0; let iCount = 0;
  for (const e of entries) {
    vCount += e.geo.attributes.position.count;
    iCount += e.geo.index.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const groups = [];
  let vo = 0; let io = 0;
  for (const e of entries) {
    const g = e.geo;
    m.copy(e.matrix || new THREE.Matrix4());
    nm.getNormalMatrix(m);
    const [su, sv] = e.uvScale || [1, 1];
    const p = g.attributes.position; const nn = g.attributes.normal; const u = g.attributes.uv;
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      n.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize();
      nor[(vo + i) * 3] = n.x; nor[(vo + i) * 3 + 1] = n.y; nor[(vo + i) * 3 + 2] = n.z;
      uv[(vo + i) * 2] = u.getX(i) * su; uv[(vo + i) * 2 + 1] = u.getY(i) * sv;
    }
    const ix = g.index;
    for (let i = 0; i < ix.count; i += 1) idx[io + i] = ix.getX(i) + vo;
    if (e.matIndex !== undefined) groups.push({ start: io, count: ix.count, mat: e.matIndex });
    vo += p.count; io += ix.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  if (groups.length > 0) {
    // Fill gaps between grouped runs with material 0 so the index stays covered.
    let cursor = 0;
    for (const g of groups) {
      if (g.start > cursor) out.addGroup(cursor, g.start - cursor, 0);
      out.addGroup(g.start, g.count, g.mat);
      cursor = g.start + g.count;
    }
    if (cursor < iCount) out.addGroup(cursor, iCount - cursor, 0);
  }
  return out;
}

/** Merge several geometries, each tinted one flat colour, into a single
 * vertex-coloured geometry (one material, one draw call). Parts are
 * { geo, matrix?, color }. The character body (torso + head + hair) is
 * 1 call instead of 3 — that is what makes 40 pedestrians affordable;
 * car details (grille, chrome, mirrors) ride in one mesh the same way. */
export function mergeColored(parts) {
  let vCount = 0; let iCount = 0;
  for (const p of parts) {
    vCount += p.geo.attributes.position.count;
    iCount += p.geo.index.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const c = new THREE.Color();
  let vo = 0; let io = 0;
  for (const p of parts) {
    const g = p.geo;
    m.copy(p.matrix || new THREE.Matrix4());
    nm.getNormalMatrix(m);
    c.set(p.color);
    const pa = g.attributes.position; const na = g.attributes.normal; const ua = g.attributes.uv;
    for (let i = 0; i < pa.count; i += 1) {
      v.fromBufferAttribute(pa, i).applyMatrix4(m);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      nor[(vo + i) * 3] = n.x; nor[(vo + i) * 3 + 1] = n.y; nor[(vo + i) * 3 + 2] = n.z;
      uv[(vo + i) * 2] = ua.getX(i); uv[(vo + i) * 2 + 1] = ua.getY(i);
      col[(vo + i) * 3] = c.r; col[(vo + i) * 3 + 1] = c.g; col[(vo + i) * 3 + 2] = c.b;
    }
    const ix = g.index;
    for (let i = 0; i < ix.count; i += 1) idx[io + i] = ix.getX(i) + vo;
    vo += pa.count; io += ix.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

/** A box with its UVs tiled by world size (so facade textures keep density). */
export function texturedBox(w, h, d, tile = 10) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Matrix4();
  return { geo: g, matrix: m, uvScale: [Math.max(w, d) / tile, h / tile] };
}

export function mat4(x, y, z, ry = 0) {
  const m = new THREE.Matrix4();
  m.makeRotationY(ry);
  m.setPosition(x, y, z);
  return m;
}

/** Canvas texture helper: draw with a 2D context, get a Three texture back. */
export function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}

// Sign / billboard canvas texture: bold original text on a coloured band.
// Returns { map, emissive } — emissive is black except the text, so the sign
// glows at night without lighting the whole face during the day.
export function signTexture(text, sub, bg, fg, w = 512, h = 160) {
  const map = canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.font = `900 ${Math.floor(h * 0.42)}px ${'system-ui, sans-serif'}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, sub ? h * 0.38 : h * 0.5, w * 0.94);
    if (sub) {
      ctx.font = `600 ${Math.floor(h * 0.2)}px ${'system-ui, sans-serif'}`;
      ctx.fillText(sub, w / 2, h * 0.78, w * 0.9);
    }
  });
  const emissive = canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.floor(h * 0.42)}px ${'system-ui, sans-serif'}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, sub ? h * 0.38 : h * 0.5, w * 0.94);
    if (sub) {
      ctx.font = `600 ${Math.floor(h * 0.2)}px ${'system-ui, sans-serif'}`;
      ctx.fillText(sub, w / 2, h * 0.78, w * 0.9);
    }
  });
  return { map, emissive };
}

// Axis-aligned box collider in the XZ plane (buildings, walls).
export function aabb(cx, cz, hx, hz) {
  return { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz };
}
// Push a circle (x, z, r) out of an AABB; returns true when a push happened.
export function circleVsAABB(x, z, r, box) {
  const cx = clamp(x, box.minX, box.maxX);
  const cz = clamp(z, box.minZ, box.maxZ);
  const dx = x - cx; const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * r, z: cz + (dz / d) * r };
  }
  // Centre inside the box: push out along the smallest penetration axis.
  const pl = x - box.minX + r; const pr = box.maxX - x + r;
  const pt = z - box.minZ + r; const pb = box.maxZ - z + r;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { x: box.minX - r, z };
  if (m === pr) return { x: box.maxX + r, z };
  if (m === pt) return { x, z: box.minZ - r };
  return { x, z: box.maxZ + r };
}
export function pointInAABB(x, z, box, pad = 0) {
  return x > box.minX - pad && x < box.maxX + pad && z > box.minZ - pad && z < box.maxZ + pad;
}
