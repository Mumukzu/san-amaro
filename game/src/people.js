// SAN AMARO — people. Humans built as stylised-realistic 3D characters:
// tapered (not boxy) limbs, a neck, sloped shoulders, a waist, an oval
// head with a jaw, ears and a structured face — readable as PEOPLE, not
// robots or mannequins. Faces are built from the character's own meshes
// (no extra textures). The teal jacket is Jay's visual identity.
//
// Interface (unchanged — main.js / shots.js depend on it):
//   buildPerson(opts) -> { group, head, torso, armL, armR, legL, legR,
//     elbowL, elbowR, kneeL, kneeR, blob }
//   head is a GROUP (so face features are not distorted by the head
//   sphere's scale); it still rotates like the old head mesh.
//   buildJay / buildNadia / buildTheo / buildMara, buildPolice, buildDriver,
//   buildRifle, aimPose(person, rifle), walkCycle(person, phase, speed, running),
//   coverPose(person), idleCycle(person, t), seatPose(person), makePedestrians(...).
// Key heights are preserved from the old rig (hip 0.82, shoulder 1.38,
// head ~1.66) so aim / walk / driving code keeps working.
const THREE = globalThis.THREE;
import { STREETS, streetClass, roadHalfWidth } from './city-layout.js';

function mat(color, rough = 0.75, metal = 0.0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
const SKIN = [0xe8b88a, 0xc98a5e, 0x8a5a3a, 0xf2c9a0];
const HAIR = [0x1c1410, 0x3a2a1a, 0x6b4a2f, 0x8a8a8a, 0xd8b25a, 0x2a2a2e];
const SHIRTS = [0xffd23e, 0x2fa8a0, 0xff5a3d, 0x4a6bff, 0xe8e8e8, 0x7a4a9a, 0x2f7a3d, 0xff8ab5];
const PANTS = [0x1c2a4a, 0x2a2a2e, 0x4a3a2a, 0x5a5a6a];
// Random hairstyle pool for pedestrians (named characters pass their own).
const HAIRSTYLES = ['short', 'short', 'long', 'ponytail', 'buzz', 'bald', 'afro'];

// A tapered limb segment (thigh->calf, upper arm->forearm, chest->waist):
// a cylinder with different end radii reads as a limb, not a plank.
function tapered(rTop, rBottom, h, material, seg = 10) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), material);
}

// Face proportion variants so pedestrians are not clones: eye spacing /
// size, nose length, brow angle and mouth width vary per variant.
const FACE_VARIANTS = [
  { eyeDX: 0.075, eyeDY: 0.030, eyeS: 1.0, noseLen: 0.10, brow: 0.10, mouth: 0.052 },
  { eyeDX: 0.085, eyeDY: 0.025, eyeS: 1.1, noseLen: 0.09, brow: 0.06, mouth: 0.058 },
  { eyeDX: 0.068, eyeDY: 0.035, eyeS: 0.9, noseLen: 0.12, brow: 0.14, mouth: 0.046 },
  { eyeDX: 0.078, eyeDY: 0.020, eyeS: 1.05, noseLen: 0.11, brow: 0.22, mouth: 0.050 },
];
// Hairstyles: 'short' (default cap), 'long' (cap + back panel), 'ponytail'
// (long + tail), 'buzz' (flat cap), 'bald' (none), 'afro' (big sphere).
function addHair(headGroup, hairCol, style) {
  if (style === 'bald') return;
  if (style === 'afro') {
    const afro = new THREE.Mesh(new THREE.SphereGeometry(0.235, 12, 10), mat(hairCol, 0.9));
    afro.position.y = 0.06; afro.scale.set(1, 0.95, 1); headGroup.add(afro);
    return;
  }
  if (style === 'buzz') {
    const buzz = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(hairCol, 0.9));
    buzz.position.y = 0.03; buzz.scale.set(1, 0.8, 1); headGroup.add(buzz);
    return;
  }
  // short / long / ponytail share the cap; long adds a back panel.
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.205, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mat(hairCol, 0.85));
  hair.position.y = 0.045; hair.scale.set(1, 0.92, 1); headGroup.add(hair);
  if (style === 'long' || style === 'ponytail') {
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(hairCol, 0.9));
    back.scale.set(0.95, 1.15, 0.55);
    back.position.set(0, -0.08, -0.12); headGroup.add(back);
  }
  if (style === 'ponytail') {
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.22, 8), mat(hairCol, 0.9));
    tail.position.set(0, -0.16, -0.22); tail.rotation.x = 0.35; headGroup.add(tail);
  }
}

// Build a structured human face on a head group. The face looks along +Z.
// Eyes sit nearly flush in the face (not bulging spheres); the nose is a
// small cone (bridge + tip); the mouth is a smile arc; ears are present.
function addFace(headGroup, opts = {}) {
  const skin = opts.skin || 0xe8b88a;
  const hairCol = opts.hair || 0x1c1410;
  const fv = FACE_VARIANTS[opts.face ?? 0] || FACE_VARIANTS[0];
  // eyes: white ellipsoids set into the face + dark pupils on their surface
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055 * fv.eyeS, 10, 8), mat(0xffffff, 0.35));
    eye.scale.set(1, 1.2, 0.5);
    eye.position.set(sx * fv.eyeDX, fv.eyeDY, 0.155); headGroup.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 6), mat(0x14141a, 0.35));
    pupil.scale.set(1, 1, 0.5);
    pupil.position.set(sx * fv.eyeDX, fv.eyeDY, 0.185); headGroup.add(pupil);
    // eyebrow: thin, angled slightly (inner end lower) — a calm, human angle
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.016, 0.015), mat(0x1c1410, 0.7));
    brow.position.set(sx * fv.eyeDX, 0.13, 0.163);
    brow.rotation.z = -sx * fv.brow; headGroup.add(brow);
  }
  // nose: a small cone pointing forward and slightly down (bridge + tip)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, fv.noseLen, 8), mat(skin, 0.7));
  nose.rotation.x = Math.PI / 2 + 0.35;
  nose.position.set(0, -0.02, 0.175); headGroup.add(nose);
  // mouth: a smile arc (torus, bottom half) — not a straight mannequin slit
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(fv.mouth, 0.011, 6, 12, Math.PI), mat(0x7a3a3a, 0.7));
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.105, 0.155); headGroup.add(mouth);
  // ears (all characters — cheap, and a face without ears reads as a mask)
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), mat(skin, 0.7));
    ear.scale.set(0.35, 0.65, 0.55);
    ear.position.set(sx * 0.185, -0.01, 0); headGroup.add(ear);
  }
  // hair: style-driven (cap / long / ponytail / buzz / bald / afro)
  addHair(headGroup, hairCol, opts.hairstyle || 'short');
  // stubble (Jay): a subtle jaw shadow — a narrow, lighter band low on
  // the jaw only, so it never masks the mouth.
  if (opts.stubble) {
    const st = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 8, 0, Math.PI * 2, Math.PI * 0.68, Math.PI * 0.27),
      mat(0x3a2a20, 0.9));
    st.position.y = -0.015; headGroup.add(st);
  }
  return headGroup;
}

// A hand with fingers: a palm + four curled finger capsules + a thumb.
// Only for detailed characters (Jay, Nadia, Theo, Mara) — pedestrians
// keep the simple rounded hand (same mesh count as before).
function buildHand(skin, side) {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(skin, 0.7));
  palm.scale.set(0.85, 1.05, 0.5); g.add(palm);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.055, 6), mat(skin, 0.7));
    f.position.set(-0.033 + i * 0.022, -0.105, 0.008);
    f.rotation.x = 0.25; // slightly curled, relaxed — not a stiff claw
    g.add(f);
  }
  const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.045, 6), mat(skin, 0.7));
  thumb.position.set(side * 0.055, -0.06, 0.012);
  thumb.rotation.z = -side * 0.7; g.add(thumb);
  return g;
}

// Build one person. opts: { skin, hair, shirt, pants, shoes, cap, capBrim,
// capColor, bandana, chain, police, stubble, detailed, face, hairstyle } —
// returns { group, head, torso, armL, armR, legL, legR, elbowL, elbowR,
// kneeL, kneeR, blob }. Faces +Z. Height ~1.89m. Legs/arms pivot at their
// top for walk swing; elbows/knees are sub-pivots for bending.
export function buildPerson(opts = {}) {
  const skin = opts.skin ?? SKIN[Math.floor(Math.random() * SKIN.length)];
  const hair = opts.hair ?? HAIR[Math.floor(Math.random() * HAIR.length)];
  const shirt = opts.shirt ?? SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const pants = opts.pants ?? PANTS[Math.floor(Math.random() * PANTS.length)];
  const detailed = !!opts.detailed;
  const g = new THREE.Group();
  const parts = {};

  // legs: TWO segments (thigh + calf) with a knee pivot, so legs bend
  // like real legs when walking/running/sitting — not rigid planks.
  // Heights preserved (hip 0.82, ankle 0): thigh 0.44 + calf 0.38.
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.11, 0.82, 0);
    const thigh = tapered(0.095, 0.075, 0.44, mat(pants, 0.85));
    thigh.position.y = -0.22; pivot.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.44; pivot.add(knee);
    const calf = tapered(0.075, 0.058, 0.38, mat(pants, 0.85));
    calf.position.y = -0.19; knee.add(calf);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.10, 0.32),
      mat(opts.shoes ?? 0xf2f2f2, 0.6));
    shoe.position.set(0, -0.33, 0.05); knee.add(shoe);
    g.add(pivot);
    parts[sx < 0 ? 'legL' : 'legR'] = pivot;
    parts[sx < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  // pelvis/hips (detailed): a rounded hip block so the torso meets the
  // legs with a waist instead of a box edge.
  if (detailed) {
    const pelvis = tapered(0.21, 0.19, 0.16, mat(pants, 0.85));
    pelvis.position.y = 0.90; g.add(pelvis);
  }
  // torso: tapered chest -> waist (not a box). Shoulders slope via the
  // shoulder spheres on detailed characters.
  const torso = tapered(0.27, 0.21, 0.56, mat(shirt, 0.8), 12);
  torso.position.y = 1.13; g.add(torso);
  parts.torso = torso;
  if (detailed) {
    for (const sx of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), mat(shirt, 0.8));
      sh.position.set(sx * 0.27, 1.40, 0); g.add(sh);
    }
  }
  // gold chain (Jay): draped low on the upper chest, below the chin —
  // never across the throat.
  if (opts.chain) {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 14),
      mat(0xffd23e, 0.3, 0.9));
    chain.position.set(0, 1.36, 0.22); chain.rotation.x = 0.85; g.add(chain);
  }
  // SAMPD police gear: a duty belt at the waist + a gold chest badge.
  if (opts.police) {
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.07, 12), mat(0x14141a, 0.6));
    belt.position.y = 0.98; g.add(belt);
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10), mat(0xffd23e, 0.3, 0.9));
    badge.rotation.x = Math.PI / 2;
    badge.position.set(-0.12, 1.32, 0.26); g.add(badge);
  }
  // arms: TWO segments (upper arm + forearm) with an elbow pivot, so
  // arms bend at the elbow — reaching, aiming, driving, and the pocket
  // pose all read as human. Reach preserved (hand at -0.64 from shoulder).
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.32, 1.38, 0);
    const upper = tapered(0.075, 0.062, 0.34, mat(shirt, 0.8));
    upper.position.y = -0.17; pivot.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.34; pivot.add(elbow);
    const fore = tapered(0.062, 0.05, 0.30, mat(shirt, 0.8));
    fore.position.y = -0.15; elbow.add(fore);
    if (detailed) {
      const hand = buildHand(skin, sx);
      hand.position.y = -0.30; elbow.add(hand);
    } else {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mat(skin, 0.7));
      hand.position.y = -0.30; elbow.add(hand);
    }
    g.add(pivot);
    parts[sx < 0 ? 'armL' : 'armR'] = pivot;
    parts[sx < 0 ? 'elbowL' : 'elbowR'] = elbow;
  }
  // neck: a real neck, so the head does not sit directly on the torso.
  const neck = tapered(0.078, 0.088, 0.16, mat(skin, 0.7));
  neck.position.y = 1.47; g.add(neck);
  // head: a GROUP at head height (keeps face features undistorted by the
  // head sphere's scale). The skull is an oval, not a ball — taller than
  // wide, with a jaw volume below the cheekbones on every character
  // (a jawless head reads as a mask, even at a distance).
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.66;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.20, 16, 12), mat(skin, 0.65));
  skull.scale.set(0.95, 1.15, 1.0); headGroup.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), mat(skin, 0.65));
  jaw.scale.set(0.88, 0.72, 0.92);
  jaw.position.set(0, -0.055, 0.015); headGroup.add(jaw);
  g.add(headGroup);
  parts.head = headGroup;
  addFace(headGroup, {
    skin, hair, stubble: !!opts.stubble,
    // Named characters keep a FIXED identity (face 0, short hair) unless
    // they pass their own — a random default made Jay's hair/face change
    // on every page load (afro once, long hair the next). Pedestrians get
    // their variety from makePedestrians, which passes explicit randoms.
    face: opts.face ?? 0,
    hairstyle: opts.hairstyle || 'short',
  });
  // cap: a LOW dome hugging the crown — a baseball cap, not a tall hat.
  // The dome's edge (theta 0.35π) sits at y ~0.155, above the brows, so
  // it never covers the eyes; its top (0.245) stays above the hair (0.234).
  // capBrim 'back' (Jay, backwards) puts the brim at -Z; 'front' (police)
  // puts it at +Z with a gold cap badge.
  if (opts.cap) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.35),
      mat(opts.capColor ?? 0x14141a, 0.7));
    cap.position.y = 0.08; cap.scale.set(1, 0.75, 1); headGroup.add(cap);
    const front = opts.capBrim === 'front';
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.18), mat(opts.capColor ?? 0x14141a, 0.7));
    brim.position.set(0, 0.10, front ? 0.26 : -0.26);
    brim.rotation.x = front ? 0.15 : -0.15; headGroup.add(brim);
    if (front) {
      const capBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 10), mat(0xffd23e, 0.3, 0.9));
      capBadge.rotation.x = Math.PI / 2;
      capBadge.position.set(0, 0.14, 0.21); headGroup.add(capBadge);
    }
    // hair shows at the sides and nape under the backwards cap
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.06), mat(hair, 0.85));
      side.position.set(sx * 0.165, -0.04, 0.09); headGroup.add(side);
    }
    const nape = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), mat(hair, 0.85));
    nape.scale.set(1.2, 0.8, 0.6);
    nape.position.set(0, -0.07, -0.13); headGroup.add(nape);
  }
  // red bandana (Nadia)
  if (opts.bandana) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.045, 6, 14), mat(0xd92a3a, 0.8));
    band.position.y = 0.06; band.rotation.x = Math.PI / 2; headGroup.add(band);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(0x3a2a1a, 0.9));
    knot.position.set(0, 0.20, -0.19); headGroup.add(knot); // bun
  }
  // blob shadow
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; g.add(blob);
  parts.blob = blob;
  parts.group = g;
  return parts;
}

// Jay (the player) — spec §3. Teal jacket is his identity; the jacket
// now has a collar, a zipper over a dark inner shirt, cuffs and cloth
// folds, and his sneakers have a sole and a toe cap.
export function buildJay() {
  const p = buildPerson({
    skin: 0xe8b88a, hair: 0x1c1410, shirt: 0x1f8a80, pants: 0x1c2a4a,
    shoes: 0xf2f2f2, cap: true, chain: true, stubble: true, detailed: true,
  });
  // teal jacket: a tapered shell over the shirt, open at the front
  const jacket = tapered(0.295, 0.235, 0.58, mat(0x1f8a80, 0.8), 12);
  jacket.position.y = 1.13; p.group.add(jacket);
  // dark inner shirt showing through the open jacket front + zipper
  const inner = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.50, 0.02), mat(0x14202e, 0.85));
  inner.position.set(0, 1.12, 0.26); p.group.add(inner);
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.50, 0.012), mat(0x2a2a30, 0.5, 0.6));
  zip.position.set(0, 1.12, 0.275); p.group.add(zip);
  // popped collar flaps at the neck
  for (const sx of [-1, 1]) {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.02), mat(0x17706a, 0.8));
    collar.position.set(sx * 0.07, 1.45, 0.20);
    collar.rotation.x = -0.5; collar.rotation.y = -sx * 0.4; p.group.add(collar);
  }
  // cuffs at the wrists (darker teal rings on the jacket sleeves)
  for (const arm of [p.armL, p.armR]) {
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 10), mat(0x17706a, 0.8));
    cuff.position.y = -0.60; arm.add(cuff);
  }
  // cloth folds: thin darker-teal strips on the jacket front, slightly angled
  const foldMat = mat(0x17706a, 0.85);
  for (const [fy, fr] of [[1.02, 0.30], [1.12, -0.25], [1.22, 0.28]]) {
    const fold = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.015, 0.01), foldMat);
    fold.position.set(0.08, fy, 0.27); fold.rotation.z = fr; p.group.add(fold);
  }
  // sneakers: sole + toe cap (the plain white box shoe is underneath)
  for (const leg of [p.legL, p.legR]) {
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.34), mat(0xd8d8d8, 0.7));
    sole.position.set(0, -0.825, 0.05); leg.add(sole);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xf2f2f2, 0.6));
    toe.scale.set(1, 0.7, 1.2); toe.position.set(0, -0.78, 0.17); leg.add(toe);
  }
  return p;
}

// Nadia (ally / mechanic) — for dialogue staging and the garage.
export function buildNadia() {
  const p = buildPerson({
    skin: 0x8a5a3a, hair: 0x1c1410, shirt: 0xd92a3a, pants: 0x2a4a6b,
    shoes: 0x8a5a3a, bandana: true, detailed: true,
  });
  // denim overalls: a front panel over the red tee (sits on the tapered torso)
  const over = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.06), mat(0x2a4a6b, 0.85));
  over.position.set(0, 1.1, 0.25); p.group.add(over);
  return p;
}

// Theo (race driver / street king) — grey hair, stubble, grey jacket.
export function buildTheo() {
  const p = buildPerson({
    skin: 0xe8b88a, hair: 0x8a8a8a, shirt: 0xc8c0b8, pants: 0x2a2a2e,
    shoes: 0xf2f2f2, stubble: true, detailed: true,
  });
  // dark shades: a flat visor across the eyes
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.05), mat(0x14141a, 0.4));
  visor.position.set(0, 1.72, 0.20); p.group.add(visor);
  return p;
}

// Mara (the fixer) — blonde hair, cyan top.
export function buildMara() {
  return buildPerson({
    skin: 0xf2c9a0, hair: 0xe8c85a, shirt: 0x22e6ff, pants: 0x1c2a4a,
    shoes: 0xf2f2f2, detailed: true,
  });
}

// SAMPD police officer — navy uniform, front-brim cap with badge, duty
// belt, chest badge. Detailed (face + ears + jaw + fingered hands) so an
// officer reads as a person up close, not a uniformed mannequin.
export function buildPolice(opts = {}) {
  return buildPerson({
    ...opts,
    shirt: 0x1a2a4a, pants: 0x1c1c22, shoes: 0x14141a,
    cap: true, capBrim: 'front', capColor: 0x1a2a4a,
    police: true, detailed: true,
  });
}

// A seated driver bust: head + face, torso, arms reaching to the wheel.
// No legs and no blob shadow (hidden by the car body). The car cabin is
// only ~0.5 m tall inside, so a full standing-height person cannot fit —
// the caller lowers the group (~-0.45 y) so the head sits in the
// glasshouse and reads as a driver through the windshield.
export function buildDriver(opts = {}) {
  const p = buildPerson({ ...opts, detailed: false });
  p.group.remove(p.legL);
  p.group.remove(p.legR);
  p.group.remove(p.blob);
  // arms forward to the steering wheel, elbows bent
  p.armL.rotation.x = -0.85;
  p.armR.rotation.x = -0.85;
  p.elbowL.rotation.x = -0.45;
  p.elbowR.rotation.x = -0.45;
  return p;
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
// Elbows slightly bent — a straight-armed rifle hold reads as a robot.
export function aimPose(person, rifle) {
  person.armL.rotation.x = -1.35; person.armL.rotation.z = 0.25;
  person.armR.rotation.x = -1.35; person.armR.rotation.z = -0.25;
  person.elbowL.rotation.x = -0.3;
  person.elbowR.rotation.x = -0.3;
  rifle.position.set(0.05, 1.32, 0.45);
  rifle.rotation.set(0, 0, 0);
  person.group.add(rifle);
}

// Reset every limb/head/torso rotation to neutral (used before a staged
// pose so a walk-cycle swing does not leak into it).
export function resetPose(person) {
  person.group.rotation.x = 0;
  person.legL.rotation.set(0, 0, 0);
  person.legR.rotation.set(0, 0, 0);
  person.kneeL.rotation.set(0, 0, 0);
  person.kneeR.rotation.set(0, 0, 0);
  person.armL.rotation.set(0, 0, 0);
  person.armR.rotation.set(0, 0, 0);
  person.elbowL.rotation.set(0, 0, 0);
  person.elbowR.rotation.set(0, 0, 0);
  person.head.rotation.set(0, 0, 0);
  person.torso.rotation.set(0, 0, 0);
  person.torso.scale.set(1, 1, 1);
}

// Cover pose: Jay stands naturally beside the car, body slightly toward
// the camera, head turned to the camera. Feet planted with a small
// natural stagger; left hand rests in the jacket pocket; right arm hangs
// relaxed at his side with a slight bend; a hint of weight shift.
export function coverPose(person) {
  resetPose(person);
  // stance: left foot a touch forward, right foot a touch back, both flat
  person.legL.rotation.x = -0.08;
  person.legR.rotation.x = 0.06;
  person.legL.rotation.z = 0.02;
  person.legR.rotation.z = -0.02;
  // left hand in the jacket pocket: arm swings forward-in toward the hip,
  // elbow bent so the forearm rises into the pocket
  person.armL.rotation.x = 0.35;
  person.armL.rotation.z = 0.30;
  person.elbowL.rotation.x = -0.7;
  // right arm relaxed at the side, slightly back and slightly out
  person.armR.rotation.x = -0.12;
  person.armR.rotation.z = -0.14;
  person.elbowR.rotation.x = -0.15;
  // head turned toward the camera + a hint of tilt; torso eases the same way
  person.head.rotation.y = 0.38;
  person.head.rotation.z = 0.03;
  person.torso.rotation.y = 0.06;
}

// Idle breathing: a subtle chest rise, arm sway and head drift so Jay
// does not stand frozen like a statue when the player is not moving.
export function idleCycle(person, t) {
  resetPose(person);
  const b = Math.sin(t * 1.8);
  person.torso.scale.y = 1 + 0.012 * b;
  person.armL.rotation.x = 0.02 * Math.sin(t * 1.8 + 0.5);
  person.armR.rotation.x = -0.02 * Math.sin(t * 1.8 + 0.5);
  person.head.rotation.y = 0.05 * Math.sin(t * 0.7);
  person.group.position.y = 0.005 * b;
}

// Walk/run cycle: swing limbs, bend knees and elbows, lean forward when
// running. Knees bend as the leg swings forward through the air (heel
// lifts, foot clears the ground) and straighten at foot strike; elbows
// carry a slight bend that swings with the arms.
export function walkCycle(person, phase, speed, running) {
  const amp = running ? 0.7 : 0.45;
  const s = Math.sin(phase);
  person.legL.rotation.x = s * amp;
  person.legR.rotation.x = -s * amp;
  person.armL.rotation.x = -s * amp * 0.8;
  person.armR.rotation.x = s * amp * 0.8;
  person.group.rotation.x = running ? 0.14 : 0.03;
  const kAmp = running ? 0.65 : 0.4;
  person.kneeL.rotation.x = kAmp * Math.max(0, -Math.sin(phase + 0.4));
  person.kneeR.rotation.x = kAmp * Math.max(0, -Math.sin(phase + Math.PI + 0.4));
  const eBase = running ? 0.55 : 0.28;
  person.elbowL.rotation.x = -eBase - s * 0.12;
  person.elbowR.rotation.x = -eBase + s * 0.12;
}

// Seated pose (drivers): thighs forward, calves down, arms forward to
// the wheel with bent elbows. Hips stay at seat height — the caller
// positions the group on the seat.
export function seatPose(person) {
  resetPose(person);
  person.legL.rotation.x = -1.35;
  person.legR.rotation.x = -1.35;
  person.kneeL.rotation.x = 1.35;
  person.kneeR.rotation.x = 1.35;
  person.armL.rotation.x = -0.85;
  person.armR.rotation.x = -0.85;
  person.elbowL.rotation.x = -0.45;
  person.elbowR.rotation.x = -0.45;
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
    // Pedestrians vary per person — random face proportions + hairstyle
    // (and the random skin/hair/shirt/pants inside buildPerson) — so no
    // two walkers are identical clones.
    const p = buildPerson({
      face: Math.floor(Math.random() * FACE_VARIANTS.length),
      hairstyle: HAIRSTYLES[Math.floor(Math.random() * HAIRSTYLES.length)],
    });
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
