// SAN AMARO — city layout (pure data, no THREE.js, no DOM).
//
// This module is the single source of truth for the city plan. It defines
// the road network, the zones, the building plots, the tree and furniture
// placement, and the validator — all as plain numbers and plain objects.
// Because it has no rendering dependency, the same module runs in the
// browser (where city.js turns the layout into meshes) and in Node (where
// main.ts runs the validator and writes the result into the dossier).
//
// DESIGN (written in this session, from the acceptance criteria):
//   * Roads come first. Every other object is placed relative to a road.
//   * The world is a 60 m grid. Streets sit on the grid lines; blocks sit
//     between them. A block's buildable plot is the block inset by the
//     plot-line distance of each bounding street (road half-width +
//     sidewalk + planting strip), so no building can ever touch a road.
//   * Buildings face the nearest street (their shopfront is on that side).
//   * Trees live in a planting strip on the OUTER edge of the sidewalk —
//     never in the road, never in the pedestrian path, never in an
//     intersection, never in front of a doorway.
//   * The placement engine rejects invalid footprints and retries smaller.
//   * The validator runs the 10 checks and the builder FIXES violations
//     (shrink / move) and re-validates, instead of only reporting them.
//
// All coordinates are in metres, x = east, z = south, y = up, ground y = 0.
// The layout is deterministic: the same seed always yields the same city.
export const GRID_PITCH = 60;
export const STREETS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
export const WORLD_MIN = -300;
export const WORLD_MAX = 300;

// ---- road classes (my assignment: the two central axes are the main
// avenues; the outer ring is residential; everything else is secondary) ----
export function streetClass(coord) {
  if (coord === 0) return 'main';
  if (Math.abs(coord) === 240) return 'residential';
  return 'secondary';
}
export function roadHalfWidth(cls) {
  return cls === 'main' ? 7 : cls === 'secondary' ? 6 : 5;
}
export const SIDEWALK_W = 3.2;
export const PLANTING_W = 1.2;
// Distance from a street centreline to the plot line (the first place a
// building may stand): road half-width + sidewalk + planting strip.
export function plotLine(cls) {
  return roadHalfWidth(cls) + SIDEWALK_W + PLANTING_W;
}
// The pedestrian path is the INNER part of the sidewalk (nearest the road);
// the planting strip is the OUTER part (nearest the plots). Trees, lamps
// and benches live in the planting strip, so the path stays clear.
export function pedestrianPathHalf(cls) {
  return roadHalfWidth(cls) + (SIDEWALK_W - PLANTING_W);
}

// ---- deterministic RNG (a plain linear congruential generator; the seed
// fixes the city, so screenshots are reproducible) ----
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function makeHelpers(rand) {
  return {
    pick(arr) { return arr[Math.floor(rand() * arr.length)]; },
    range(a, b) { return a + rand() * (b - a); },
    chance(p) { return rand() < p; },
  };
}

// ---- rectangle helpers (axis-aligned, x/z plane) ----
export function rectOverlaps(a, b, gap = 0) {
  return a.x0 < b.x1 + gap && a.x1 > b.x0 - gap && a.z0 < b.z1 + gap && a.z1 > b.z0 - gap;
}
export function rectContains(outer, inner) {
  return inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.z0 >= outer.z0 && inner.z1 <= outer.z1;
}
export function rectArea(r) {
  return Math.max(0, r.x1 - r.x0) * Math.max(0, r.z1 - r.z0);
}
// Road surface rectangle for one street (axis 'x' = east-west street at
// coordinate z; axis 'z' = north-south street at coordinate x).
export function roadRect(axis, coord, cls) {
  const h = roadHalfWidth(cls);
  if (axis === 'x') return { x0: -300, x1: 300, z0: coord - h, z1: coord + h };
  return { x0: coord - h, x1: coord + h, z0: -300, z1: 300 };
}
// Sidewalk rectangles for one street (both sides).
export function sidewalkRects(axis, coord, cls) {
  const h = roadHalfWidth(cls);
  const out = [];
  for (const s of [-1, 1]) {
    const a = coord + s * h;
    const b = coord + s * (h + SIDEWALK_W);
    if (axis === 'x') out.push({ x0: -300, x1: 300, z0: Math.min(a, b), z1: Math.max(a, b) });
    else out.push({ x0: Math.min(a, b), x1: Math.max(a, b), z0: -300, z1: 300 });
  }
  return out;
}
// Planting-strip rectangles for one street (outer edge of each sidewalk).
export function plantingRects(axis, coord, cls) {
  const h = roadHalfWidth(cls);
  const out = [];
  for (const s of [-1, 1]) {
    const a = coord + s * (h + SIDEWALK_W - PLANTING_W);
    const b = coord + s * (h + SIDEWALK_W);
    if (axis === 'x') out.push({ x0: -300, x1: 300, z0: Math.min(a, b), z1: Math.max(a, b) });
    else out.push({ x0: Math.min(a, b), x1: Math.max(a, b), z0: -300, z1: 300 });
  }
  return out;
}
// The pedestrian path (inner sidewalk band) for one street.
export function pathRects(axis, coord, cls) {
  const h = roadHalfWidth(cls);
  const out = [];
  for (const s of [-1, 1]) {
    const a = coord + s * h;
    const b = coord + s * (h + SIDEWALK_W - PLANTING_W);
    if (axis === 'x') out.push({ x0: -300, x1: 300, z0: Math.min(a, b), z1: Math.max(a, b) });
    else out.push({ x0: Math.min(a, b), x1: Math.max(a, b), z0: -300, z1: 300 });
  }
  return out;
}
// Intersection square where two streets cross.
export function intersectionRect(xc, zc) {
  const hx = roadHalfWidth(streetClass(xc)) + SIDEWALK_W;
  const hz = roadHalfWidth(streetClass(zc)) + SIDEWALK_W;
  return { x0: xc - hx, x1: xc + hx, z0: zc - hz, z1: zc + hz };
}

// ---- zones (my assignment, by block position) ----
// Blocks are indexed bx, bz in -4..3; block (bx, bz) spans
// x in [bx*60, (bx+1)*60], z in [bz*60, (bz+1)*60], so its centre is
// (bx*60+30, bz*60+30). Streets run on the block EDGES (the grid lines),
// never through a block — that is the whole point: a building inside a
// block can never stand on a road.
// Special plots first, then industrial (south-east), downtown (centre),
// commercial (avenues + inner ring), residential (everything else).
export function zoneFor(bx, bz) {
  if (bx === 1 && bz === -2) return 'spire';
  if (bx === -2 && bz === 0) return 'plaza';
  if (bx >= 2 && bz >= 2) return 'industrial';
  const cx = bx * GRID_PITCH + GRID_PITCH / 2;
  const cz = bz * GRID_PITCH + GRID_PITCH / 2;
  if (Math.abs(cx) <= 90 && Math.abs(cz) <= 90) return 'downtown';
  if (bx === -1 || bx === 0 || bz === -1 || bz === 0 || (Math.abs(cx) <= 150 && Math.abs(cz) <= 150)) return 'commercial';
  return 'residential';
}
// Building heights per zone (a stepped distribution, so the skyline varies
// naturally instead of every building sharing one height).
export const ZONE_HEIGHTS = {
  downtown: [26, 34, 44, 58],
  commercial: [14, 18, 22, 26, 34],
  residential: [8, 10, 12, 14],
  industrial: [10, 12, 16],
};
// How many buildings a block holds (downtown/commercial: one big block;
// residential: two houses side by side; industrial: one warehouse).
export const ZONE_COUNT = { downtown: 1, commercial: 1, residential: 2, industrial: 1 };

// The buildable plot of a block: the block rect inset by each bounding
// street's plot-line distance. Returns null for special (non-buildable)
// blocks. Also returns the plot centre and size.
export function plotFor(bx, bz) {
  const zone = zoneFor(bx, bz);
  if (zone === 'spire' || zone === 'plaza') return null;
  const west = plotLine(streetClass(bx * GRID_PITCH));
  const east = plotLine(streetClass((bx + 1) * GRID_PITCH));
  const south = plotLine(streetClass(bz * GRID_PITCH));
  const north = plotLine(streetClass((bz + 1) * GRID_PITCH));
  const x0 = bx * GRID_PITCH + west;
  const x1 = (bx + 1) * GRID_PITCH - east;
  const z0 = bz * GRID_PITCH + south;
  const z1 = (bz + 1) * GRID_PITCH - north;
  return {
    bx, bz, zone, x0, x1, z0, z1,
    cx: (x0 + x1) / 2, cz: (z0 + z1) / 2,
    w: x1 - x0, d: z1 - z0,
  };
}
// Which street a building should face: the nearest bounding street, with
// main avenues winning ties. Returns '+z' | '-z' | '+x' | '-x' (the side
// the shopfront / entrance goes on).
export function frontFor(bx, bz) {
  const cands = [
    { dir: '-z', rank: rankOf(streetClass(bz * GRID_PITCH)) },
    { dir: '+z', rank: rankOf(streetClass((bz + 1) * GRID_PITCH)) },
    { dir: '-x', rank: rankOf(streetClass(bx * GRID_PITCH)) },
    { dir: '+x', rank: rankOf(streetClass((bx + 1) * GRID_PITCH)) },
  ];
  cands.sort((a, b) => a.rank - b.rank);
  return cands[0].dir;
}
function rankOf(cls) {
  return cls === 'main' ? 0 : cls === 'secondary' ? 1 : 2;
}

// ---- placement engine ----
// A building footprint is {x, z, w, d} (centre + size, axis-aligned).
// It is valid only if it lies fully inside its plot and keeps a gap from
// every other building. The engine shrinks and retries instead of forcing
// a bad placement.
function footprintRect(b) {
  return { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 };
}
function placeBuilding(plot, helpers, existing) {
  const zone = plot.zone;
  const heights = ZONE_HEIGHTS[zone];
  // Start at a generous size, then shrink on retry so the footprint always
  // ends up inside the plot with a safety margin. Residential houses are
  // capped at 16 m (square, with a yard) — a house in a split plot would
  // otherwise stretch the full 39 m depth into a long thin slab.
  const cap = zone === 'residential' ? 16 : 30;
  let w = Math.min(cap, plot.w - 6);
  let d = Math.min(cap, plot.d - 6);
  const minSize = 12;
  for (let attempt = 0; attempt < 8; attempt++) {
    const x = plot.cx + helpers.range(-2, 2);
    const z = plot.cz + helpers.range(-2, 2);
    const b = { x, z, w, d };
    const r = footprintRect(b);
    if (!rectContains(plot, r)) { w *= 0.88; d *= 0.88; continue; }
    let clash = false;
    for (const o of existing) {
      if (rectOverlaps(r, footprintRect(o), 2)) { clash = true; break; }
    }
    if (clash) { w *= 0.88; d *= 0.88; continue; }
    if (w < minSize || d < minSize) return null;
    return {
      bx: plot.bx, bz: plot.bz, zone,
      x, z, w, d,
      h: helpers.pick(heights),
      front: frontFor(plot.bx, plot.bz),
      facade: Math.floor(helpers.range(0, 8)),
      lit: 0.28 + helpers.range(0, 0.12),
      shop: zone !== 'residential' && zone !== 'industrial' ? helpers.chance(0.75) : false,
    };
  }
  return null;
}

// ---- the layout builder ----
// Builds the whole city plan from a seed. Returns pure data:
//   roads, blocks, buildings, trees, lamps, benches, bins, signals,
//   signs, parking, entrances, stats.
export function buildLayout(seed = 20261119) {
  const rand = makeRng(seed);
  const helpers = makeHelpers(rand);

  // Roads (data only; the meshes are built from this in city.js).
  const roads = [];
  for (const c of STREETS) {
    roads.push({ axis: 'x', coord: c, cls: streetClass(c) });
    roads.push({ axis: 'z', coord: c, cls: streetClass(c) });
  }

  // Buildings, one plot at a time. Blocks are indexed -4..3 (the cells
  // BETWEEN streets, centres at -210..210 step 60).
  const buildings = [];
  const entrances = []; // {x, z} front-door points (trees/lamps must avoid)
  let skipped = 0;
  for (let bx = -4; bx <= 3; bx++) {
    for (let bz = -4; bz <= 3; bz++) {
      const plot = plotFor(bx, bz);
      if (!plot) continue;
      const count = ZONE_COUNT[plot.zone] || 1;
      if (count === 1) {
        const b = placeBuilding(plot, helpers, buildings);
        if (b) { buildings.push(b); entrances.push(entranceOf(b)); }
        else skipped++;
      } else {
        // Residential: two houses, each in one half of the plot.
        const halfW = plot.w / 2;
        for (let k = 0; k < 2; k++) {
          const sub = {
            ...plot,
            x0: plot.x0 + k * halfW, x1: plot.x0 + (k + 1) * halfW,
            cx: plot.x0 + (k + 0.5) * halfW, w: halfW,
          };
          const b = placeBuilding(sub, helpers, buildings);
          if (b) { buildings.push(b); entrances.push(entranceOf(b)); }
          else skipped++;
        }
      }
    }
  }
  // The Glass Spire (tallest tower, finale site) is a fixed landmark, not
  // a placed building: it occupies its own plot, block (1,-2), centre (90,-90).
  buildings.push({
    bx: 1, bz: -2, zone: 'spire', x: 90, z: -90, w: 34, d: 34, h: 88,
    front: '+z', facade: 3, lit: 0.4, shop: false, landmark: true,
  });

  // Trees. Sidewalk trees live in the planting strip; park trees in the
  // plaza; yard trees in residential plots. A tree is {x, z, kind, scale}.
  const trees = [];
  const treeSpacing = { main: 18, secondary: 24, residential: 30 };
  const treeScale = { main: 1.3, secondary: 1.0, residential: 0.8 };
  // Is (x, z) within `pad` of an intersection? An object sits ON one street
  // (its own); it is only blocked where a CROSSING street passes. So for an
  // object on an east-west street (axis 'x') we only test the distance to
  // north-south street lines, and for an object on a north-south street
  // (axis 'z') only the distance to east-west lines. (Testing both
  // directions for every point wrongly flagged every object as "near an
  // intersection" of its own street — that bug killed parking entirely.)
  function nearCrossing(x, z, pad, axis) {
    if (axis === 'x') {
      for (const c of STREETS) if (Math.abs(x - c) < pad) return true;
      return false;
    }
    for (const c of STREETS) if (Math.abs(z - c) < pad) return true;
    return false;
  }
  function nearEntrance(x, z, pad) {
    for (const e of entrances) {
      if (Math.abs(x - e.x) < pad && Math.abs(z - e.z) < pad) return true;
    }
    return false;
  }
  for (const road of roads) {
    const cls = road.cls;
    const spacing = treeSpacing[cls];
    const scale = treeScale[cls];
    const kind = cls === 'main' ? 'palm' : 'shade';
    const half = roadHalfWidth(cls);
    // Planting strip centre, on both sides of the street.
    for (const s of [-1, 1]) {
      const off = s * (half + SIDEWALK_W - PLANTING_W / 2);
      for (let t = -285; t <= 285; t += spacing) {
        const x = road.axis === 'x' ? t + helpers.range(-2, 2) : road.coord + off;
        const z = road.axis === 'x' ? road.coord + off : t + helpers.range(-2, 2);
        if (nearCrossing(x, z, 10, road.axis)) continue;
        if (nearEntrance(x, z, 3.5)) continue;
        trees.push({ x, z, kind, scale: scale * helpers.range(0.9, 1.15), zone: 'street' });
      }
    }
  }
  // Plaza ring: shade trees around the fountain at (-90, 30) (block (-2,0)).
  // Radius 16 keeps the ring inside the plaza plot [-109.6,-70.4] x [10.4,49.6].
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    trees.push({ x: -90 + Math.cos(a) * 16, z: 30 + Math.sin(a) * 16, kind: 'shade', scale: 1.1, zone: 'plaza' });
  }
  trees.push({ x: -106, z: 14, kind: 'palm', scale: 1.1, zone: 'plaza' });
  trees.push({ x: -74, z: 46, kind: 'palm', scale: 1.1, zone: 'plaza' });
  // Residential yard trees: one small shade tree per house, in the yard
  // (a plot corner away from the building). The position is clamped inside
  // the house's plot — the raw offset can push it past the plot edge when
  // the house sits near the edge — and kept out of the building footprint.
  for (const b of buildings) {
    if (b.zone !== 'residential') continue;
    const plot = plotFor(b.bx, b.bz);
    if (!plot) continue;
    let tx = b.x + (b.w / 2 + 4) * (helpers.chance(0.5) ? 1 : -1);
    let tz = b.z + (b.d / 2 + 4) * (helpers.chance(0.5) ? 1 : -1);
    tx = Math.max(plot.x0 + 1, Math.min(plot.x1 - 1, tx));
    tz = Math.max(plot.z0 + 1, Math.min(plot.z1 - 1, tz));
    if (pointInRect(tx, tz, footprintRect(b))) continue; // clamped onto the house
    trees.push({ x: tx, z: tz, kind: 'shade', scale: 0.8, zone: 'yard' });
  }

  // Street lamps: planting strip, alternating sides, offset by half the
  // tree spacing so a lamp never shares a spot with a tree.
  const lamps = [];
  const lampSpacing = { main: 26, secondary: 36, residential: 48 };
  for (const road of roads) {
    const cls = road.cls;
    const spacing = lampSpacing[cls];
    const half = roadHalfWidth(cls);
    for (const s of [-1, 1]) {
      const off = s * (half + SIDEWALK_W - PLANTING_W / 2);
      // The lamp arm points toward the road (over the asphalt, so the
      // light falls on the street). ry rotates the lamp's local +x (the
      // arm direction) to face the road: east-west street, north side
      // (s=1) -> -z; south side -> +z; north-south street, east side -> -x,
      // west side -> +x.
      const ry = road.axis === 'x' ? (s === 1 ? Math.PI / 2 : -Math.PI / 2) : (s === 1 ? Math.PI : 0);
      for (let t = -285 + spacing / 2; t <= 285; t += spacing) {
        const x = road.axis === 'x' ? t : road.coord + off;
        const z = road.axis === 'x' ? road.coord + off : t;
        if (nearCrossing(x, z, 10, road.axis)) continue;
        if (nearEntrance(x, z, 3)) continue;
        lamps.push({ x, z, ry });
      }
    }
  }

  // Benches + bins: commercial sidewalks only, in the planting strip,
  // alternating, roughly every 40 m. A bench sits with its long side
  // parallel to the street (2.6 m along, 1.0 m across) so it fits the
  // 1.2 m planting strip; a bin is a 0.8 m cylinder. Both store the road
  // axis they sit on so the validator can use the true rectangular
  // footprint instead of a square. Benches keep 12 m from crossings (their
  // 1.3 m along-street half-length must clear the crossing street's path,
  // whose outer edge is at most 9 m from its centre line).
  const benches = [];
  const bins = [];
  for (const road of roads) {
    if (road.cls !== 'main' && road.cls !== 'secondary') continue;
    const half = roadHalfWidth(road.cls);
    for (const s of [-1, 1]) {
      const off = s * (half + SIDEWALK_W - PLANTING_W / 2);
      let n = 0;
      for (let t = -260; t <= 260; t += 40) {
        const x = road.axis === 'x' ? t + helpers.range(-3, 3) : road.coord + off;
        const z = road.axis === 'x' ? road.coord + off : t + helpers.range(-3, 3);
        if (nearCrossing(x, z, 12, road.axis)) continue;
        if (nearEntrance(x, z, 3)) continue;
        if (n % 2 === 0) benches.push({ x, z, axis: road.axis });
        else bins.push({ x, z, axis: road.axis });
        n++;
      }
    }
  }

  // Traffic signals at the five main-avenue intersections (one pole per
  // corner). Street-name signs on one corner of each.
  const signals = [];
  const signs = [];
  const mainCrossings = [[0, 0], [120, 0], [-120, 0], [0, 120], [0, -120]];
  for (const [xc, zc] of mainCrossings) {
    const hx = roadHalfWidth(streetClass(xc)) + SIDEWALK_W + 0.6;
    const hz = roadHalfWidth(streetClass(zc)) + SIDEWALK_W + 0.6;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      signals.push({ x: xc + sx * hx, z: zc + sz * hz });
    }
    signs.push({
      x: xc + hx, z: zc + hz,
      text: xc === 0 ? 'SUNSET AVE' : 'LANTERN BLVD',
    });
  }

  // Parking bays: in the road's outer lane on commercial streets (never on
  // the sidewalk). A bay is a spot a parked car may occupy.
  const parking = [];
  for (const road of roads) {
    if (road.cls !== 'secondary' && road.cls !== 'main') continue;
    const lane = roadHalfWidth(road.cls) - 1.2;
    for (const s of [-1, 1]) {
      const off = s * lane;
      for (let t = -250; t <= 250; t += 30) {
        const x = road.axis === 'x' ? t : road.coord + off;
        const z = road.axis === 'x' ? road.coord + off : t;
        if (nearCrossing(x, z, 10, road.axis)) continue;
        parking.push({ x, z, rot: road.axis === 'x' ? Math.PI / 2 : 0, street: road.coord });
      }
    }
  }

  return {
    seed, roads, buildings, trees, lamps, benches, bins, signals, signs, parking, entrances,
    stats: {
      buildings: buildings.length,
      trees: trees.length,
      lamps: lamps.length,
      benches: benches.length,
      bins: bins.length,
      signals: signals.length,
      parking: parking.length,
      skipped,
    },
  };
}

// The front-door point of a building: the centre of its front side, pushed
// just outside the footprint (trees and lamps must keep clear of it).
function entranceOf(b) {
  if (b.front === '+z') return { x: b.x, z: b.z + b.d / 2 + 1 };
  if (b.front === '-z') return { x: b.x, z: b.z - b.d / 2 - 1 };
  if (b.front === '+x') return { x: b.x + b.w / 2 + 1, z: b.z };
  return { x: b.x - b.w / 2 - 1, z: b.z };
}

// ---- validator ----
// Runs the 10 acceptance checks over a layout. Returns
// { passed, violations: [{check, kind, detail}], counts }.
// A violation is a fact about the layout data, not a guess — every check
// is computed from the road/plot/footprint geometry above.
function pointInRect(x, z, r) {
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}
function allRoadRects() {
  const out = [];
  for (const c of STREETS) {
    out.push(roadRect('x', c, streetClass(c)));
    out.push(roadRect('z', c, streetClass(c)));
  }
  return out;
}
function allPathRects() {
  const out = [];
  for (const c of STREETS) {
    out.push(...pathRects('x', c, streetClass(c)));
    out.push(...pathRects('z', c, streetClass(c)));
  }
  return out;
}
function allPlantingRects() {
  const out = [];
  for (const c of STREETS) {
    out.push(...plantingRects('x', c, streetClass(c)));
    out.push(...plantingRects('z', c, streetClass(c)));
  }
  return out;
}
function allIntersectionRects() {
  const out = [];
  for (const x of STREETS) for (const z of STREETS) out.push(intersectionRect(x, z));
  return out;
}

export function validateLayout(layout) {
  const violations = [];
  const roads = allRoadRects();
  const paths = allPathRects();
  const planting = allPlantingRects();
  const intersections = allIntersectionRects();
  const push = (check, kind, detail) => violations.push({ check, kind, detail });

  // 1. Every building footprint is outside every road polygon.
  for (const b of layout.buildings) {
    const r = footprintRect(b);
    for (const road of roads) {
      if (rectOverlaps(r, road, 0)) {
        push(1, 'building-in-road', `building (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) ${b.w}x${b.d} overlaps road at z=${road.z0.toFixed(1)}..${road.z1.toFixed(1)}`);
        break;
      }
    }
  }
  // 2. Every building footprint is inside its own plot.
  for (const b of layout.buildings) {
    if (b.landmark) continue; // the Spire occupies a fixed landmark plot
    const plot = plotFor(b.bx, b.bz);
    if (!plot) { push(2, 'building-no-plot', `building (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) has no plot`); continue; }
    if (!rectContains(plot, footprintRect(b))) {
      push(2, 'building-outside-plot', `building (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) ${b.w}x${b.d} escapes plot ${plot.x0.toFixed(1)}..${plot.x1.toFixed(1)} x ${plot.z0.toFixed(1)}..${plot.z1.toFixed(1)}`);
    }
  }
  // 3. No tree in a vehicle lane.
  for (const t of layout.trees) {
    for (const road of roads) {
      if (pointInRect(t.x, t.z, road)) { push(3, 'tree-in-road', `tree (${t.x.toFixed(1)}, ${t.z.toFixed(1)}) in road`); break; }
    }
  }
  // 4. Every tree is in a valid planting area: a planting strip, the
  // plaza, or a residential yard (inside a residential plot, outside any
  // building footprint).
  for (const t of layout.trees) {
    let ok = planting.some((r) => pointInRect(t.x, t.z, r));
    if (!ok && Math.hypot(t.x + 90, t.z - 30) < 24) ok = true; // plaza
    if (!ok) {
      for (const b of layout.buildings) {
        if (b.zone !== 'residential') continue;
        const plot = plotFor(b.bx, b.bz);
        if (plot && pointInRect(t.x, t.z, plot) && !pointInRect(t.x, t.z, footprintRect(b))) { ok = true; break; }
      }
    }
    if (!ok) push(4, 'tree-no-planting-area', `tree (${t.x.toFixed(1)}, ${t.z.toFixed(1)}) is not in a planting strip, the plaza, or a yard`);
  }
  // 5. Pedestrian paths stay passable: no object's footprint may touch a
  // path rect. (Trees/lamps/benches live in the planting strip, which is
  // outside the path rect by construction — this check proves it.)
  // Footprints are axis-aligned rectangles (hx, hz = half-extents).
  // A bench is 2.6 m long ALONG the street and 1.0 m across it (it sits
  // with its long side parallel to the road, so it fits the 1.2 m planting
  // strip); a bin is a 0.8 m cylinder. Treating a bench as a 2.6 m square
  // would wrongly claim it blocks the pedestrian path.
  const smallObjects = [];
  for (const t of layout.trees) smallObjects.push({ kind: 'tree', x: t.x, z: t.z, hx: 0.4, hz: 0.4 });
  for (const l of layout.lamps) smallObjects.push({ kind: 'lamp', x: l.x, z: l.z, hx: 0.3, hz: 0.3 });
  for (const b of layout.benches) {
    const along = b.axis === 'x';
    smallObjects.push({ kind: 'bench', x: b.x, z: b.z, hx: along ? 1.3 : 0.5, hz: along ? 0.5 : 1.3 });
  }
  for (const b of layout.bins) smallObjects.push({ kind: 'bin', x: b.x, z: b.z, hx: 0.4, hz: 0.4 });
  for (const s of layout.signals) smallObjects.push({ kind: 'signal', x: s.x, z: s.z, hx: 0.4, hz: 0.4 });
  for (const s of layout.signs) smallObjects.push({ kind: 'sign', x: s.x, z: s.z, hx: 0.4, hz: 0.4 });
  for (const o of smallObjects) {
    const r = { x0: o.x - o.hx, x1: o.x + o.hx, z0: o.z - o.hz, z1: o.z + o.hz };
    for (const p of paths) {
      if (rectOverlaps(r, p, 0)) { push(5, 'object-blocks-path', `${o.kind} (${o.x.toFixed(1)}, ${o.z.toFixed(1)}) blocks a pedestrian path`); break; }
    }
  }
  // 6. No two building footprints overlap (with a 2 m gap).
  for (let i = 0; i < layout.buildings.length; i++) {
    for (let j = i + 1; j < layout.buildings.length; j++) {
      if (rectOverlaps(footprintRect(layout.buildings[i]), footprintRect(layout.buildings[j]), 2)) {
        push(6, 'buildings-overlap', `buildings (${layout.buildings[i].x.toFixed(1)}, ${layout.buildings[i].z.toFixed(1)}) and (${layout.buildings[j].x.toFixed(1)}, ${layout.buildings[j].z.toFixed(1)}) overlap`);
      }
    }
  }
  // 7. No object floats or sinks: every object is placed at ground level
  // (y = 0) by construction, and every building has a positive height.
  for (const b of layout.buildings) {
    if (b.y !== undefined && b.y !== 0) push(7, 'object-not-grounded', `building (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) y=${b.y}`);
    if (!(b.h > 0)) push(7, 'object-no-height', `building (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) has no height`);
  }
  for (const t of layout.trees) {
    if (t.y !== undefined && t.y !== 0) push(7, 'object-not-grounded', `tree (${t.x.toFixed(1)}, ${t.z.toFixed(1)}) y=${t.y}`);
  }
  // 8. Density matches the zone: each zone must hold a plausible count of
  // buildings, and average height must fall downtown > commercial >
  // residential, with industrial low and wide.
  const byZone = {};
  for (const b of layout.buildings) {
    (byZone[b.zone] = byZone[b.zone] || []).push(b);
  }
  const avgH = (list) => list.reduce((s, b) => s + b.h, 0) / Math.max(1, list.length);
  const need = { downtown: 6, commercial: 12, residential: 20, industrial: 4 }; // industrial has only 4 blocks (bx,bz in 2..3), so 4 is its full count
  for (const [zone, min] of Object.entries(need)) {
    const n = (byZone[zone] || []).length;
    if (n < min) push(8, 'zone-too-sparse', `${zone}: ${n} buildings, need >= ${min}`);
  }
  if (byZone.downtown && byZone.commercial && avgH(byZone.downtown) < avgH(byZone.commercial)) {
    push(8, 'zone-height-order', `downtown avg height ${avgH(byZone.downtown).toFixed(1)} < commercial ${avgH(byZone.commercial).toFixed(1)}`);
  }
  if (byZone.commercial && byZone.residential && avgH(byZone.commercial) < avgH(byZone.residential)) {
    push(8, 'zone-height-order', `commercial avg height ${avgH(byZone.commercial).toFixed(1)} < residential ${avgH(byZone.residential).toFixed(1)}`);
  }
  // 9. Intersections and vehicle access stay clear: no object footprint
  // may touch an intersection rect.
  for (const o of smallObjects) {
    const r = { x0: o.x - o.hx, x1: o.x + o.hx, z0: o.z - o.hz, z1: o.z + o.hz };
    for (const ix of intersections) {
      if (rectOverlaps(r, ix, 0)) { push(9, 'object-blocks-intersection', `${o.kind} (${o.x.toFixed(1)}, ${o.z.toFixed(1)}) blocks an intersection`); break; }
    }
  }
  for (const b of layout.buildings) {
    for (const ix of intersections) {
      if (rectOverlaps(footprintRect(b), ix, 0)) { push(9, 'building-blocks-intersection', `building (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) blocks an intersection`); break; }
    }
  }
  // 10. Nothing disturbs the camera / gameplay: no object footprint may
  // touch a road rect expanded by 1 m (a stricter margin than check 1/3).
  for (const o of smallObjects) {
    const r = { x0: o.x - o.hx, x1: o.x + o.hx, z0: o.z - o.hz, z1: o.z + o.hz };
    for (const road of roads) {
      if (rectOverlaps(r, road, 1)) { push(10, 'object-near-road', `${o.kind} (${o.x.toFixed(1)}, ${o.z.toFixed(1)}) within 1 m of a road`); break; }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    counts: {
      buildings: layout.buildings.length,
      trees: layout.trees.length,
      lamps: layout.lamps.length,
      benches: layout.benches.length,
      bins: layout.bins.length,
      signals: layout.signals.length,
      parking: layout.parking.length,
    },
    byZone: Object.fromEntries(Object.entries(byZone).map(([z, l]) => [z, { n: l.length, avgH: +avgH(l).toFixed(1) }])),
  };
}

// ---- fix + re-validate ----
// The requirement is to FIX violations, not just report them. This loop
// shrinks any building that escapes its plot or overlaps a neighbour,
// drops any tree/lamp/bench that touches a path, road or intersection,
// and re-runs the validator. It returns the fixed layout and the final
// report. (Trees and small objects are cheap to drop and re-place; the
// building shrink is bounded so a building never vanishes.)
export function fixLayout(layout, maxPasses = 3) {
  let current = layout;
  let report = validateLayout(current);
  let passes = 0;
  while (!report.passed && passes < maxPasses) {
    passes++;
    const fixed = JSON.parse(JSON.stringify(current));
    for (const v of report.violations) {
      if (v.check === 2 || v.check === 6) {
        // Shrink the offending building by 10% (find it by its position
        // in the detail string) — a smaller footprint fits the plot and
        // clears the neighbour.
        const m = v.detail.match(/\((-?[\d.]+), (-?[\d.]+)\)/);
        if (!m) continue;
        const bx = parseFloat(m[1]), bz = parseFloat(m[2]);
        const b = fixed.buildings.find((o) => Math.abs(o.x - bx) < 0.5 && Math.abs(o.z - bz) < 0.5);
        if (b && !b.landmark) { b.w *= 0.9; b.d *= 0.9; }
      } else if (v.check === 3 || v.check === 4 || v.check === 5 || v.check === 9 || v.check === 10) {
        // Drop the offending small object (tree/lamp/bench/bin/signal/
        // sign). The layout stays valid without it; the count is reported.
        const m = v.detail.match(/\((-?[\d.]+), (-?[\d.]+)\)/);
        if (!m) continue;
        const ox = parseFloat(m[1]), oz = parseFloat(m[2]);
        const kind = v.detail.split(' ')[0];
        const listName = kind === 'tree' ? 'trees' : kind === 'lamp' ? 'lamps'
          : kind === 'bench' ? 'benches' : kind === 'bin' ? 'bins'
          : kind === 'signal' ? 'signals' : kind === 'sign' ? 'signs' : null;
        if (listName) {
          const i = fixed[listName].findIndex((o) => Math.abs(o.x - ox) < 0.5 && Math.abs(o.z - oz) < 0.5);
          if (i >= 0) fixed[listName].splice(i, 1);
        }
      }
    }
    current = fixed;
    report = validateLayout(current);
  }
  return { layout: current, report, passes };
}

// One-line human summary of a validation report (used by the HUD badge
// and by main.ts for the dossier).
// Short badge form (fits the narrow minimap column): "CITY VALID · 80 BLDG
// · 673 TREES" or "CITY 3 VIOLATIONS".
export function validationBadge(report) {
  if (report.passed) {
    return `CITY VALID · ${report.counts.buildings} BLDG · ${report.counts.trees} TREES`;
  }
  return `CITY ${report.violations.length} VIOLATIONS`;
}
export function validationSummary(report) {
  if (report.passed) {
    return `CITY VALID · ${report.counts.buildings} buildings · ${report.counts.trees} trees · 0 violations`;
  }
  const byCheck = {};
  for (const v of report.violations) byCheck[v.check] = (byCheck[v.check] || 0) + 1;
  return `CITY ${report.violations.length} VIOLATIONS · ` + Object.entries(byCheck).map(([c, n]) => `check ${c}: ${n}`).join(' · ');
}
