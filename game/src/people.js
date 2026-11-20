// SAN AMARO — people. Every human is CARTOON-style with a CLEAR, VISIBLE
// FACE: white eyes with dark pupils, eyebrows, a nose, a mouth, and a hair
// cap, readable at gameplay distance. Faces are built from the character's
// own meshes (no extra textures). Written from scratch from the spec.
//
// Pedestrians walk the layout's pedestrian paths (see ./city-layout.js):
// the inner sidewalk band, with crowds weighted by street class.
const THREE = globalThis.THREE;
import { STREETS, streetClass, roadHalfWidth } from './city-layout.js';

function mat(color, rough = 0.75, metal = 0.0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
const SKIN = [0xe8b88a, 0xc98a5e, 0x8a5a3a, 0xf2c9a0];
const HAIR = [0x1c1410, 0x3a2a1a, 0x6b4a2f, 0x8a8a8a, 0xd8b25a, 0x2a2a2e];
const SHIRTS = [0xffd23e, 0x2fa8a0, 0xff5a3d, 0x4a6bff, 0xe8e8e8, 0x7a4a9a, 0x2f7a3d, 0xff8ab5];
const PANTS = [0x1c2a4a, 0x2a2a2e, 0x4a3a2a, 0x5a5a6a];

// Build a cartoon face on a head mesh. head is a sphere (r~0.26) centred at
// headY. The face looks along +Z (the character's forward).
function addFace(head, opts = {}) {
  const g = head.parent || head;
  const skin = opts.skin || 0xe8b88a;
  const hairCol = opts.hair || 0x1c1410;
  const z = 0.20; // face plane (front of the head sphere)
  // eyes: white spheres + dark pupils
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mat(0xffffff, 0.4));
    eye.position.set(sx * 0.09, 0.05, z); head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), mat(0x14141a, 0.4));
    pupil.position.set(sx * 0.09, 0.05, z + 0.045); head.add(pupil);
    // eyebrow: thin dark box above the eye
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.02), mat(0x1c1410, 0.7));
    brow.position.set(sx * 0.09, 0.14, z + 0.01); head.add(brow);
  }
  // nose: small box
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.06), mat(skin, 0.7));
  nose.position.set(0, -0.03, z + 0.02); head.add(nose);
  // mouth: thin dark box (a slight smile = two segments)
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.022, 0.02), mat(0x5a2a2a, 0.7));
  mouth.position.set(0, -0.13, z + 0.01); head.add(mouth);
  // hair cap: a hemisphere on top of the head
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mat(hairCol, 0.85));
  hair.position.y = 0.03; hair.scale.set(1, 0.9, 1); head.add(hair);
  // stubble (Jay): a slightly darker lower-face band
  if (opts.stubble) {
    const st = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45),
      mat(0x2a2018, 0.9));
    st.position.y = -0.02; head.add(st);
  }
  return head;
}

// Build one person. opts: { skin, hair, shirt, pants, shoes, cap, bandana,
// chain, jacket } — returns { group, head, torso, armL, armR, legL, legR }.
// Faces +Z. Height ~1.75m. Legs/arms pivot at their top for walk swing.
export function buildPerson(opts = {}) {
  const skin = opts.skin ?? SKIN[Math.floor(Math.random() * SKIN.length)];
  const hair = opts.hair ?? HAIR[Math.floor(Math.random() * HAIR.length)];
  const shirt = opts.shirt ?? SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const pants = opts.pants ?? PANTS[Math.floor(Math.random() * PANTS.length)];
  const g = new THREE.Group();
  const parts = {};

  // legs (pivot groups at hip height so they swing)
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.11, 0.82, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.82, 0.2), mat(pants, 0.85));
    leg.position.y = -0.41; pivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.1, 0.32),
      mat(opts.shoes ?? 0xf2f2f2, 0.6));
    shoe.position.set(0, -0.78, 0.05); pivot.add(shoe);
    g.add(pivot);
    parts[sx < 0 ? 'legL' : 'legR'] = pivot;
  }
  // torso (jacket / shirt)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), mat(shirt, 0.8));
  torso.position.y = 1.13; g.add(torso);
  parts.torso = torso;
  // gold chain (Jay)
  if (opts.chain) {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 14),
      mat(0xffd23e, 0.3, 0.9));
    chain.position.set(0, 1.38, 0.14); chain.rotation.x = 0.5; g.add(chain);
  }
  // arms (pivot groups at shoulder height)
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.32, 1.38, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.17), mat(shirt, 0.8));
    arm.position.y = -0.31; pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(skin, 0.7));
    hand.position.y = -0.64; pivot.add(hand);
    g.add(pivot);
    parts[sx < 0 ? 'armL' : 'armR'] = pivot;
  }
  // head (sphere) + face + hair + extras
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), mat(skin, 0.65));
  head.position.y = 1.68; g.add(head);
  parts.head = head;
  addFace(head, { skin, hair, stubble: !!opts.stubble });
  // cap worn backwards (Jay)
  if (opts.cap) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.12, 12), mat(0x14141a, 0.7));
    cap.position.y = 0.2; head.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.22), mat(0x14141a, 0.7));
    brim.position.set(0, 0.18, -0.3); head.add(brim); // backwards = brim at the back (-Z)
  }
  // red bandana (Nadia)
  if (opts.bandana) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 14), mat(0xd92a3a, 0.8));
    band.position.y = 0.08; band.rotation.x = Math.PI / 2; head.add(band);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0x3a2a1a, 0.9));
    knot.position.set(0, 0.22, -0.22); head.add(knot); // bun
  }
  // blob shadow
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; g.add(blob);
  parts.group = g;
  return parts;
}

// Jay (the player) — spec §3.
export function buildJay() {
  const p = buildPerson({
    skin: 0xe8b88a, hair: 0x1c1410, shirt: 0x1f8a80, pants: 0x1c2a4a,
    shoes: 0xf2f2f2, cap: true, chain: true, stubble: true,
  });
  // teal jacket: a slightly larger torso shell
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.6, 0.34), mat(0x1f8a80, 0.8));
  jacket.position.y = 1.13; p.group.add(jacket);
  return p;
}

// Nadia (ally / mechanic) — for dialogue staging and the garage.
export function buildNadia() {
  const p = buildPerson({
    skin: 0x8a5a3a, hair: 0x1c1410, shirt: 0xd92a3a, pants: 0x2a4a6b,
    shoes: 0x8a5a3a, bandana: true,
  });
  // denim overalls: a front panel over the red tee
  const over = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.06), mat(0x2a4a6b, 0.85));
  over.position.set(0, 1.1, 0.18); p.group.add(over);
  return p;
}

// Theo (race driver / street king) — grey hair, stubble, grey jacket.
export function buildTheo() {
  const p = buildPerson({
    skin: 0xe8b88a, hair: 0x8a8a8a, shirt: 0xc8c0b8, pants: 0x2a2a2e,
    shoes: 0xf2f2f2, stubble: true,
  });
  // dark shades: a flat visor across the eyes
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.06), mat(0x14141a, 0.4));
  visor.position.set(0, 1.72, 0.22); p.group.add(visor);
  return p;
}

// Mara (the fixer) — blonde hair, cyan top.
export function buildMara() {
  return buildPerson({
    skin: 0xf2c9a0, hair: 0xe8c85a, shirt: 0x22e6ff, pants: 0x1c2a4a,
    shoes: 0xf2f2f2,
  });
}

// The Longshot rifle (matte grey, long barrel, scope). Held by Jay when aiming.
export function buildRifle() {
  const g = new THREE.Group();
  const grey = mat(0x4a4a52, 0.45, 0.7);
  const dark = mat(0x22222a, 0.5, 0.6);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.15, 8), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, 0.55); g.add(barrel);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.75), grey);
  body.position.set(0, 0, 0); g.add(body);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.4), dark);
  stock.position.set(0, -0.03, -0.5); g.add(stock);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), dark);
  scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.12, 0.1); g.add(scope);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.09), dark);
  grip.position.set(0, -0.14, -0.1); g.add(grip);
  return g;
}

// Aim pose: both arms forward, rifle in the hands, pointing +Z.
export function aimPose(person, rifle) {
  person.armL.rotation.x = -1.35; person.armL.rotation.z = 0.25;
  person.armR.rotation.x = -1.35; person.armR.rotation.z = -0.25;
  rifle.position.set(0.05, 1.32, 0.45);
  rifle.rotation.set(0, 0, 0);
  person.group.add(rifle);
}

// Walk/run cycle: swing limbs, lean forward when running.
export function walkCycle(person, phase, speed, running) {
  const amp = running ? 0.7 : 0.45;
  const s = Math.sin(phase);
  person.legL.rotation.x = s * amp;
  person.legR.rotation.x = -s * amp;
  person.armL.rotation.x = -s * amp * 0.8;
  person.armR.rotation.x = s * amp * 0.8;
  person.group.rotation.x = running ? 0.14 : 0.03;
}

// ---- pedestrians ----
// Pedestrians walk the inner sidewalk band (the pedestrian path) of the
// layout's streets, with crowds weighted by street class — the main
// avenues carry 3x the foot traffic of a residential street — so the
// busy parts of the city feel busy and the quiet parts feel quiet.
// `layout` is accepted for future zone-based placement; the street list
// and path offset already come from the layout module.
export function makePedestrians(scene, count = 60, layout = null) {
  const walkers = [];
  const streets = [];
  for (const c of STREETS) {
    const w = streetClass(c) === 'main' ? 3 : streetClass(c) === 'secondary' ? 2 : 1;
    for (let k = 0; k < w; k++) streets.push(c);
  }
  for (let i = 0; i < count; i++) {
    const p = buildPerson({});
    const alongZ = i % 2 === 0;
    const street = streets[i % streets.length];
    // Walk on the pedestrian path: the inner sidewalk band, whose centre
    // is roadHalf + 1.0 m from the street centre. (The old fixed 8.2 m
    // put walkers at the outer edge — in the planting strip, next to the
    // trees — on the narrower residential streets.)
    const half = roadHalfWidth(streetClass(street));
    const side = (i % 3 === 0) ? half + 1.0 : -(half + 1.0);
    const pos = -270 + ((i * 41) % 540);
    const dir = (i % 4 < 2) ? 1 : -1;
    if (alongZ) {
      p.group.position.set(pos, 0, street + side);
      p.group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      p.group.position.set(street + side, 0, pos);
      p.group.rotation.y = dir > 0 ? Math.PI : 0;
    }
    scene.add(p.group);
    walkers.push({
      p, alongZ, street, side, dir, pos,
      speed: 1.1 + (i % 4) * 0.25, phase: (i * 1.7) % (Math.PI * 2),
      fleeing: false, downT: 0,
    });
  }
  return {
    walkers,
    setFleeing(on) { for (const w of walkers) w.fleeing = on; },
    // Knock a walker down (hit by a car): they fall, stay down ~3 s,
    // then get up and flee. Returns false if already down.
    knockDown(w) {
      if (w.downT > 0) return false;
      w.downT = 3;
      w.p.group.rotation.x = -1.2;
      w.p.group.position.y = 0.3;
      return true;
    },
    update(dt) {
      for (const w of walkers) {
        // down: count down, stay put; get up and flee when the timer ends
        if (w.downT > 0) {
          w.downT -= dt;
          if (w.downT <= 0) {
            w.downT = 0;
            w.p.group.rotation.x = 0;
            w.p.group.position.y = 0;
            w.fleeing = true;
          }
          continue;
        }
        const sp = w.fleeing ? w.speed * 3.4 : w.speed;
        w.pos += w.dir * sp * dt;
        if (w.pos > 280) w.pos = -280;
        if (w.pos < -280) w.pos = 280;
        if (w.alongZ) w.p.group.position.x = w.pos;
        else w.p.group.position.z = w.pos;
        w.phase += dt * sp * 2.4;
        walkCycle(w.p, w.phase, sp, w.fleeing);
        // fleeing pedestrians glance back (torso twist)
        w.p.torso.rotation.y = w.fleeing ? 0.5 : 0;
        w.p.head.rotation.y = w.fleeing ? 0.6 : 0;
      }
    },
  };
}
