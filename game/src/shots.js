// SAN AMARO — staged screenshot setups (?shot=1..4). Each shot places the
// camera, the actors and the HUD for one golden-hour action moment, matching
// the reference screenshots (benchmark only — San Amaro's own names, from
// the spec). After each setup the scene renders once and sets
// window.__shotReady so the capture script knows when to shoot.
// Written from scratch from the re-author spec.
const THREE = globalThis.THREE;
import * as HUD from './hud.js';
import { buildPerson, buildJay, buildNadia, buildRifle, aimPose, walkCycle } from './people.js';
import { buildCar, setAirPitch } from './vehicles.js';

const GOLDEN = { day: 'DAY 1 · 18:25', money: '$250', rank: 'NOBODY', xp: 0, xpMax: 200 };

function baseHUD() {
  HUD.setWanted(1, 'IN PURSUIT · 2 UNITS', '', GOLDEN.money, GOLDEN.rank, GOLDEN.xp, GOLDEN.xpMax);
  HUD.setHealth(100, 0);
  HUD.setCrew([
    { name: 'NADIA', style: 'nadia', skin: '#8a5a3a', hair: '#1c1410' },
    { name: 'THEO', style: 'theo', skin: '#e8b88a', hair: '#8a8a8a' },
    { name: 'MARA', style: 'mara', skin: '#f2c9a0', hair: '#e8c85a' },
  ]);
  HUD.buildStars(); HUD.buildWeapons();
  HUD.setWeapon(0); HUD.lockWeapons(1);
  HUD.setVehicle({ station: 'NEON TIDE 102.5', track: '“Neon Horizon” — Midnight Palms', genre: 'Synthwave · Golden-hour driving' });
  HUD.showVehicle();
}

// A small, brief muzzle flash (fix: the old giant glow hid the rifle).
function smallMuzzleFlash(scene, pos, dir) {
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,240,180,1)'); r.addColorStop(0.4, 'rgba(255,170,60,.8)'); r.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); return t;
  })();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
  s.position.copy(pos).addScaledVector(dir, 1.25);
  s.scale.set(0.9, 0.9, 1);
  scene.add(s);
  return s;
}

// ---- Shot 1: police chase (cover) ----
function shotChase(G) {
  const { scene, camera } = G;
  // Comet GT, rear three-quarter, big in frame, heading east on Lantern Blvd.
  const car = G.playerCar;
  car.group.position.set(0, 0, 0);
  car.group.rotation.set(0, Math.PI / 2, 0); // facing +X (east)
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  // police cruisers ahead, closing in
  G.police[0].group.position.set(16, 0, 2.5);
  G.police[0].group.rotation.set(0, -Math.PI / 2, 0);
  G.police[0].group.visible = true;
  G.police[1].group.position.set(24, 0, -3.5);
  G.police[1].group.rotation.set(0, -Math.PI / 2, 0);
  G.police[1].group.visible = true;
  // AIR-1 above, searchlight subtle (a faint cone, not a white wedge)
  const heli = G.police[2];
  heli.group.position.set(14, 12, -8);
  heli.group.rotation.set(0, 0.6, 0);
  heli.group.visible = true;
  // fleeing pedestrians mid-stride on both sidewalks
  const flee = [
    [-4, 9.5, 1], [6, -9.5, -1], [12, 9.5, 1], [-10, -9.5, -1], [18, -9.5, 1], [-16, 9.5, -1],
  ];
  G.stagedPeds.forEach((w, i) => {
    const f = flee[i % flee.length];
    w.p.group.position.set(f[0], 0, f[1]);
    w.p.group.rotation.y = f[2] > 0 ? Math.PI / 2 : -Math.PI / 2;
    w.p.group.visible = true;
    w.fleeing = true; w.phase = i * 1.3;
  });
  // camera: low, behind and to the side — the car is big, the boulevard runs ahead
  camera.position.set(-9.5, 3.6, -4.0);
  camera.lookAt(14, 1.2, 0);
  camera.fov = 55; camera.updateProjectionMatrix();
  // HUD
  baseHUD();
  HUD.setMission({
    chapter: 'CHAPTER 1 · MISSION 1', title: 'FIRST WHEELS',
    objective: 'Lose the police',
    desc: 'Two cruisers on you — lose them, then get to the marker.',
    fill: 1, stage: 'Stage 3 / 3', par: '+$100', time: '00:01 / 02:41',
  });
  HUD.setWanted(1, 'IN PURSUIT · 2 UNITS', '', '$250', 'NOBODY', 0, 200);
  HUD.setPolice([
    { dist: '7 m', status: 'PURSUIT' },
    { dist: '13 m', status: 'EN ROUTE' },
    { dist: '—', status: 'STANDBY' },
  ]);
  HUD.setVehicle({ name: 'COMET GT · SPORTS', speed: 58, condition: 100, nitro: 100 });
  HUD.setDialogue('NADIA · PALM & PISTON',
    '“BAY-12 is on your tail — lose them before the bridge, or you’re done.”', 'nadia', '#8a5a3a', '#1c1410');
  HUD.setWeapon(0);
  G.minimapState = { player: { x: 0, z: 0, heading: Math.PI / 2 }, police: [{ x: 16, z: 2.5, color: '#ff2a1a' }, { x: 24, z: -3.5, color: '#ff2a1a' }], marker: { x: 120, z: 0 } };
}

// ---- Shot 2: shoot-out (Jay on foot, Longshot rifle) ----
function shotShootout(G) {
  const { scene, camera } = G;
  // Jay on foot at the bridge approach, aiming north at the dock.
  const jay = G.jay;
  jay.group.position.set(0, 0, -208);
  jay.group.rotation.set(0, Math.PI, 0); // facing -Z (north, toward the bridge)
  jay.group.visible = true;
  // rifle in the aim pose
  const rifle = buildRifle();
  aimPose(jay, rifle);
  G.playerCar.group.visible = false;
  // Enemies — FIX 1: BIGGER and closer, clearly readable as a threat.
  // Two Saltjacks at ~9-11 m, scaled up, one in a white shirt, one in yellow.
  const enemies = [
    { x: -5.5, z: -219, shirt: 0xf2f2f2, scale: 1.18 },
    { x: 4.5, z: -221, shirt: 0x22e6ff, scale: 1.18 },
    { x: 0.5, z: -228, shirt: 0x2f7a3d, scale: 1.1 },
  ];
  G.stagedEnemies.forEach((e, i) => {
    const d = enemies[i % enemies.length];
    e.group.position.set(d.x, 0, d.z);
    e.group.rotation.set(0, 0, 0); // facing Jay (south, +Z) — their faces are visible
    e.group.scale.setScalar(d.scale);
    e.group.visible = true;
    // recolour the shirt for readability
    e.torso.material = new THREE.MeshStandardMaterial({ color: d.shirt, roughness: 0.8 });
  });
  // Red Comet GT parked to the left (the prize)
  const prize = G.prizeCar;
  prize.group.position.set(-12, 0, -214);
  prize.group.rotation.set(0, Math.PI / 2 + 0.3, 0);
  prize.group.visible = true;
  // police: BAY-12 close behind (the heat is on), others standby
  G.police[0].group.position.set(-10, 0, -196);
  G.police[0].group.rotation.set(0, Math.PI, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  // small muzzle flash at the barrel tip (FIX 1: small, does not hide the rifle)
  const dir = new THREE.Vector3(0, 0, -1);
  smallMuzzleFlash(scene, new THREE.Vector3(0.05, 1.32, -207.4), dir);
  // a thin tracer line to the nearest enemy
  const tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 11, 4),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.8 }));
  tracer.rotation.x = Math.PI / 2;
  tracer.position.set(0.05, 1.32, -213.5);
  scene.add(tracer);
  G.shotProps.push(tracer);
  // camera: over-the-shoulder, tight — Jay big and centred, enemies readable
  camera.position.set(1.2, 2.3, -204.5);
  camera.lookAt(-0.5, 1.2, -222);
  camera.fov = 55; camera.updateProjectionMatrix();
  // HUD (no vehicle readout — Jay is on foot; the rifle + ammo take its place)
  baseHUD();
  HUD.hideVehicle();
  HUD.setMission({
    chapter: 'CHAPTER 1 · MISSION 1', title: 'FIRST WHEELS',
    objective: 'Take the Comet GT',
    desc: 'Rico’s crew guards the dock — clear them out.',
    fill: 0.66, stage: 'Stage 2 / 3', par: '+$100', time: '00:01 / 02:41',
  });
  HUD.setWanted(1, 'SPOTTED', 'spotted', '$250', 'NOBODY', 0, 200);
  HUD.setPolice([
    { dist: '7 m', status: 'PURSUIT' },
    { dist: '—', status: 'STANDBY' },
    { dist: '—', status: 'STANDBY' },
  ]);
  HUD.setDialogue('NADIA · PALM & PISTON',
    '“Rico’s crew holds that dock. Keep your head down and make every shot count.”', 'nadia', '#8a5a3a', '#1c1410');
  HUD.setWeapon(4, '24 / 96');
  HUD.lockWeapons(1);
  G.minimapState = { player: { x: 0, z: -208, heading: Math.PI }, police: [{ x: -10, z: -196, color: '#ff2a1a' }], marker: { x: -13, z: -216 } };
}

// ---- Shot 3: mission (dense boulevard at golden hour) ----
function shotMission(G) {
  const { scene, camera } = G;
  // Marina Sedan driving east on Lantern Blvd.
  const car = G.playerCar;
  // swap the player car to the sedan for this shot
  car.group.visible = false;
  const sedan = G.sedanCar;
  sedan.group.position.set(0, 0, 0);
  sedan.group.rotation.set(0, Math.PI / 2, 0);
  sedan.group.visible = true;
  setAirPitch(sedan, 0, 0);
  // FIX 2: density in the middle distance — extra traffic + pedestrians + props ahead.
  G.midTraffic.forEach((c, i) => {
    const x = 14 + (i % 5) * 16;
    const z = (i % 2 === 0 ? 3 : -3) + (i % 3 === 0 ? 2.5 : 0);
    c.group.position.set(x, 0, z);
    c.group.rotation.set(0, Math.PI / 2, 0);
    c.group.visible = true;
  });
  G.midPeds.forEach((w, i) => {
    const x = 8 + (i % 6) * 11;
    const z = (i % 2 === 0 ? 9.5 : -9.5);
    w.p.group.position.set(x, 0, z);
    w.p.group.rotation.y = (i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
    w.p.group.visible = true;
    w.fleeing = false; w.phase = i * 0.9;
  });
  // (The Spire's neon rings are permanent now — built into city.js — so
  // this shot no longer adds its own.)
  // mission marker: a green neon ring flat on the road in the mid-distance
  const roadRing = new THREE.Mesh(new THREE.TorusGeometry(5, 0.22, 12, 48),
    new THREE.MeshStandardMaterial({ color: 0x2aff5a, emissive: 0x2aff5a, emissiveIntensity: 2.4 }));
  roadRing.rotation.x = -Math.PI / 2;
  roadRing.position.set(40, 0.25, 0);
  scene.add(roadRing);
  G.shotProps.push(roadRing);
  // police: BAY-12 trailing
  G.police[0].group.position.set(-24, 0, 4);
  G.police[0].group.rotation.set(0, Math.PI / 2, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  // camera: chase view, the boulevard runs ahead to the Glass Spire
  camera.position.set(-10, 4.0, -3.0);
  camera.lookAt(40, 1.5, 0);
  camera.fov = 55; camera.updateProjectionMatrix();
  // HUD
  baseHUD();
  HUD.setMission({
    chapter: 'CHAPTER 1 · MISSION 1', title: 'FIRST WHEELS',
    objective: 'Drive to the marker',
    desc: 'Don’t scratch the paint — the SAMPD is watching.',
    fill: 1, stage: 'Stage 3 / 3', par: '+$100', time: '00:01 / 02:41',
  });
  HUD.setWanted(1, 'SPOTTED', 'spotted', '$250', 'NOBODY', 0, 200);
  HUD.setPolice([
    { dist: '14 m', status: 'PURSUIT' },
    { dist: '—', status: 'STANDBY' },
    { dist: '—', status: 'STANDBY' },
  ]);
  HUD.setVehicle({ name: 'MARINA SEDAN · SEDAN', speed: 75, condition: 100, nitro: 100 });
  HUD.setDialogue('NADIA · PALM & PISTON',
    '“You break it, you bought it. Get the car to the marker — and don’t scratch the paint.”', 'nadia', '#8a5a3a', '#1c1410');
  HUD.setWeapon(0);
  G.minimapState = { player: { x: 0, z: 0, heading: Math.PI / 2 }, police: [{ x: -24, z: 4, color: '#ff2a1a' }], marker: { x: 40, z: 0 } };
}

// ---- Shot 4: bridge jump (car airborne over the canal) ----
function shotJump(G) {
  const { scene, camera } = G;
  // Marina Sedan airborne, nose-up, over the canal at the lift bridge.
  const sedan = G.sedanCar;
  sedan.group.visible = true;
  sedan.group.position.set(0, 5.2, -282);
  sedan.group.rotation.set(0, Math.PI, 0); // facing north, jumping toward the camera
  setAirPitch(sedan, 0.32, 5.2); // nose-up, lifted
  G.playerCar.group.visible = false;
  // NOTE: the wide warm "reflection streak" under the jump was removed —
  // it read as a pale-yellow wash across the whole foreground. The canal
  // water already reads via its shiny material + sun glint + ripple rings.
  // police: BAY-12 at the bridge approach, boxed in
  G.police[0].group.position.set(-18, 0, -252);
  G.police[0].group.rotation.set(0, Math.PI, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  // camera: side-front three-quarter — the car is big, nose-up, airborne,
  // the lift towers frame it and the SAN AMARO sign is on the left.
  camera.position.set(0, 5, -296);
  camera.lookAt(0, 4, -282);
  camera.fov = 55; camera.updateProjectionMatrix();
  // HUD
  baseHUD();
  HUD.setMission({
    chapter: 'CHAPTER 1 · MISSION 1', title: 'FIRST WHEELS',
    objective: 'Lose the police',
    desc: 'Full throttle off the deck — land it clean.',
    fill: 1, stage: 'Stage 3 / 3', par: '+$100', time: '00:01 / 02:41',
  });
  HUD.setWanted(1, 'SPOTTED', 'spotted', '$250', 'NOBODY', 0, 200);
  HUD.setPolice([
    { dist: '24 m', status: 'PURSUIT' },
    { dist: '—', status: 'STANDBY' },
    { dist: '—', status: 'STANDBY' },
  ]);
  HUD.setVehicle({ name: 'MARINA SEDAN · SEDAN', speed: 79, condition: 100, nitro: 100 });
  HUD.setDialogue('NADIA · PALM & PISTON',
    '“The bridge is up — take the jump or the SAMPD boxes you in. Go!”', 'nadia', '#8a5a3a', '#1c1410');
  HUD.setWeapon(0);
  G.minimapState = { player: { x: 0, z: -282, heading: Math.PI }, police: [{ x: -18, z: -252, color: '#ff2a1a' }], marker: { x: 0, z: -300 } };
}

// ---- shared HUD for the new shots (cinematic + review) ----
function newShotHUD(G, title, objective, desc, vehicleName, speed) {
  baseHUD();
  HUD.setMission({
    chapter: 'CHAPTER 1 · MISSION 1', title,
    objective, desc,
    fill: 1, stage: 'Stage 3 / 3', par: '+$100', time: '00:01 / 02:41',
  });
  HUD.setWanted(1, 'IN PURSUIT · 2 UNITS', '', '$250', 'NOBODY', 0, 200);
  HUD.setPolice([
    { dist: '7 m', status: 'PURSUIT' },
    { dist: '13 m', status: 'EN ROUTE' },
    { dist: '—', status: 'STANDBY' },
  ]);
  HUD.setVehicle({ name: vehicleName, speed, condition: 100, nitro: 100 });
  HUD.setDialogue('NADIA · PALM & PISTON',
    '“BAY-12 is on your tail — lose them before the bridge, or you’re done.”', 'nadia', '#8a5a3a', '#1c1410');
  HUD.setWeapon(0);
}

// ---- Shot 5: cinematic candidate — low golden chase ----
// Camera near the road surface, behind and low beside the Comet GT: the
// car is big, the boulevard runs ahead into the sunset, palms + towers
// frame both sides. The AAA low-angle main-shot candidate.
function shotCineChase(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  car.group.position.set(0, 0, 0);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.police[0].group.position.set(18, 0, 2.5);
  G.police[0].group.rotation.set(0, -Math.PI / 2, 0);
  G.police[0].group.visible = true;
  G.police[1].group.position.set(28, 0, -3.5);
  G.police[1].group.rotation.set(0, -Math.PI / 2, 0);
  G.police[1].group.visible = true;
  const heli = G.police[2];
  heli.group.position.set(16, 12, -8);
  heli.group.rotation.set(0, 0.6, 0);
  heli.group.visible = true;
  const flee = [[-4, 9.5, 1], [8, -9.5, -1], [14, 9.5, 1], [-12, -9.5, -1]];
  G.stagedPeds.forEach((w, i) => {
    const f = flee[i % flee.length];
    w.p.group.position.set(f[0], 0, f[1]);
    w.p.group.rotation.y = f[2] > 0 ? Math.PI / 2 : -Math.PI / 2;
    w.p.group.visible = true;
    w.fleeing = true; w.phase = i * 1.3;
  });
  // low: 2.0 m above the asphalt, behind the car's rear quarter — the car
  // is big and fully in frame, the boulevard runs ahead into the sunset
  camera.position.set(-12, 2.0, -3.0);
  camera.lookAt(16, 1.5, 0);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'Two cruisers on you — lose them, then get to the marker.', 'COMET GT · SPORTS', 58);
  G.minimapState = { player: { x: 0, z: 0, heading: Math.PI / 2 }, police: [{ x: 18, z: 2.5, color: '#ff2a1a' }, { x: 28, z: -3.5, color: '#ff2a1a' }], marker: { x: 120, z: 0 } };
}

// ---- Shot 6: cinematic candidate — the Spire at dusk ----
// Low angle from behind the Comet GT, looking north up Sunset Ave at the
// Glass Spire towering ahead, its neon ring glowing.
function shotCineSpire(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  // (The Spire's neon rings are permanent now — built into city.js.)
  // v2: the spire stands ALONE in its block (no neighbours within 35 m),
  // so the right framing is from the west road looking up-north-east —
  // the diagonal view from the east let a neighbouring tower occlude it,
  // and the straight-up view from the south was too tight (no city
  // context). Now the camera sits on the x=60 road: the spire is centre
  // with its halo ring at ~30% height and the crown rising out of the
  // top, the street and the downtown towers frame it on both sides. The
  // car and cruiser are hidden here — in an upward-looking shot they
  // would sit behind the bottom-centre dialogue panel; the shot is the
  // spire and the skyline.
  G.playerCar.group.visible = false;
  G.police.forEach((u) => { u.group.visible = false; });
  camera.position.set(60, 3, -30);
  camera.lookAt(95, 25, -90);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'The Spire job starts here — but first, lose the tail.', 'COMET GT · SPORTS', 41);
  G.minimapState = { player: { x: 60, z: -30, heading: Math.PI }, police: [], marker: { x: 90, z: -90 } };
}

// ---- Shot 7: cinematic candidate — Sunset Plaza ----
// Low angle at the plaza: the fountain in the mid-ground, Jay standing by
// the Comet GT in the foreground, palms ringing the square.
function shotCinePlaza(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  car.group.position.set(-90, 0, 8);
  car.group.rotation.set(0, Math.PI * 0.75, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  const jay = G.jay;
  jay.group.position.set(-84, 0, 14);
  jay.group.rotation.set(0, -Math.PI * 0.25, 0);
  jay.group.visible = true;
  G.police[0].group.visible = false;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  // v2: the old camera (from the south-east, looking north-east) put the
  // car and Jay ~70 degrees off-axis — out of frame entirely. Now the
  // camera sits south of the plaza looking north-east, so the car + Jay
  // are in the right foreground and the fountain is centre-frame.
  camera.position.set(-108, 3.5, -2);
  camera.lookAt(-88, 3, 24);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Meet Nadia', 'The plaza at golden hour — the city is yours to take.', 'COMET GT · SPORTS', 0);
  G.minimapState = { player: { x: -90, z: 8, heading: Math.PI * 0.75 }, police: [], marker: { x: -90, z: 30 } };
}

// ---- Shot 8: cinematic candidate — Neon Row ----
// Low angle on a commercial avenue at dusk: neon shop signs, a taxi and a
// pickup in traffic, the Comet GT threading through.
function shotCineNeon(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  car.group.position.set(0, 0, 60);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  // a taxi and a pickup as mid-traffic (the two new models)
  const { group: taxiG } = buildCar('taxi');
  taxiG.position.set(16, 0, 63.5);
  taxiG.rotation.set(0, Math.PI / 2, 0);
  taxiG.visible = true;
  scene.add(taxiG);
  G.shotProps.push(taxiG);
  const { group: pkG } = buildCar('pickup');
  pkG.position.set(30, 0, 56.5);
  pkG.rotation.set(0, Math.PI / 2, 0);
  pkG.visible = true;
  scene.add(pkG);
  G.shotProps.push(pkG);
  G.police[0].group.position.set(-14, 0, 63);
  G.police[0].group.rotation.set(0, Math.PI / 2, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  camera.position.set(-9, 1.3, 52);
  camera.lookAt(24, 2, 62);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'Neon Row at dusk — every shopfront lit, every lane full.', 'COMET GT · SPORTS', 52);
  G.minimapState = { player: { x: 0, z: 60, heading: Math.PI / 2 }, police: [{ x: -14, z: 63, color: '#ff2a1a' }], marker: { x: 120, z: 60 } };
}

// ---- Shot 9: cinematic candidate — Bridge silhouette ----
// Low angle on the lift bridge deck: the Comet GT framed by the steel
// towers, the SAN AMARO sign glowing, the canal below.
function shotCineBridge(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  // On the road south of the bridge (not on the deck — the low deck shots
  // hid the car behind the barrier). The Comet GT sits on the approach,
  // the lift towers and LIFT BRIDGE sign frame the way out beyond it.
  car.group.position.set(0, 0, -245);
  car.group.rotation.set(0, Math.PI, 0); // facing north, onto the bridge
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.police[0].group.position.set(-8, 0, -258);
  G.police[0].group.rotation.set(0, Math.PI, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  // v2: pulled back and looking right of the sign, so the LIFT BRIDGE sign
  // sits in the left third — clear of the top-centre HUD block that used
  // to clip it — while the Comet GT stays big in the lower foreground.
  camera.position.set(-7, 3, -215);
  camera.lookAt(12, 6, -282);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'The bridge is the only way out — and it is up.', 'COMET GT · SPORTS', 63);
  G.minimapState = { player: { x: 0, z: -245, heading: Math.PI }, police: [{ x: -8, z: -258, color: '#ff2a1a' }], marker: { x: 0, z: -300 } };
}

// ---- Shot 10: review — aerial overview ----
// High oblique view of the whole island: the street grid, the zone
// heights (tall downtown, low residential), the canal and bridge.
function shotReviewAerial(G) {
  const { camera } = G;
  G.playerCar.group.visible = false;
  G.police.forEach((u) => { u.group.visible = false; });
  camera.position.set(0, 230, 150);
  camera.lookAt(0, 0, -10);
  camera.fov = 50; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'City review', 'Aerial: grid, zones, plots, trees.', 'COMET GT · SPORTS', 0);
  G.minimapState = { player: { x: 0, z: 0, heading: 0 }, police: [], marker: null };
}

// ---- Shot 11: review — downtown street ----
// Street level on Lantern Blvd looking east into the downtown core: a
// canyon of tall towers on both sides, set back from the road, with the
// Comet GT in the foreground.
function shotReviewDowntown(G) {
  const { camera } = G;
  const car = G.playerCar;
  car.group.position.set(-10, 0, 0);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.police.forEach((u) => { u.group.visible = false; });
  camera.position.set(-32, 3, -4);
  camera.lookAt(60, 15, 0);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'City review', 'Downtown: tall towers, setbacks, shopfronts.', 'COMET GT · SPORTS', 0);
  G.minimapState = { player: { x: -10, z: 0, heading: Math.PI / 2 }, police: [], marker: null };
}

// ---- Shot 12: review — commercial area ----
// A commercial avenue: shopfronts with awnings and neon, benches and bins
// on the sidewalk, a taxi parked at the curb.
function shotReviewCommercial(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  car.group.position.set(60, 0, 0);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  const { group: taxiG } = buildCar('taxi');
  taxiG.position.set(84, 0, 4.8);
  taxiG.rotation.set(0, Math.PI / 2, 0);
  taxiG.visible = true;
  scene.add(taxiG);
  G.shotProps.push(taxiG);
  G.police.forEach((u) => { u.group.visible = false; });
  camera.position.set(30, 2.2, -8);
  camera.lookAt(100, 4, 0);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'City review', 'Commercial: shops, benches, bins, parked taxi.', 'COMET GT · SPORTS', 0);
  G.minimapState = { player: { x: 60, z: 0, heading: Math.PI / 2 }, police: [], marker: null };
}

// ---- Shot 13: review — residential area ----
// A residential street on the southern edge (z=-240): low houses with
// yards and shade trees on the north side, the island edge to the south.
// (The earlier framing pointed east into the commercial inner ring, so
// it showed tall blocks — this one stays on a genuinely residential street.)
function shotReviewResidential(G) {
  const { camera } = G;
  const car = G.playerCar;
  car.group.position.set(-200, 0, -240);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.police.forEach((u) => { u.group.visible = false; });
  camera.position.set(-222, 2.5, -235);
  camera.lookAt(-140, 3, -242);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'City review', 'Residential: low houses, yards, shade trees.', 'COMET GT · SPORTS', 0);
  G.minimapState = { player: { x: -200, z: -240, heading: Math.PI / 2 }, police: [], marker: null };
}

// ---- Shot 14: review — main intersection ----
// The (0,0) crossing of the two main avenues: traffic signals on all four
// corners, crosswalks, stop lines, street-name signs.
function shotReviewIntersection(G) {
  const { camera } = G;
  const car = G.playerCar;
  car.group.position.set(-14, 0, -2);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.police.forEach((u) => { u.group.visible = false; });
  camera.position.set(-28, 6, -28);
  camera.lookAt(2, 1, 0);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'City review', 'Main intersection: signals, crosswalks, stop lines.', 'COMET GT · SPORTS', 0);
  G.minimapState = { player: { x: -14, z: -2, heading: Math.PI / 2 }, police: [], marker: null };
}

// ---- Shot 15: review — street with trees + sidewalk ----
// Close street-level view of the sidewalk infrastructure: planting strip
// with palms, lamps, a bench and a bin, and a clear pedestrian path.
function shotReviewStreet(G) {
  const { camera } = G;
  const car = G.playerCar;
  car.group.position.set(0, 0, 0);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.police.forEach((u) => { u.group.visible = false; });
  camera.position.set(-30, 1.8, 9.5);
  camera.lookAt(30, 2, 0);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'City review', 'Sidewalk: planting strip, palms, lamps, bench, bin.', 'COMET GT · SPORTS', 0);
  G.minimapState = { player: { x: 0, z: 0, heading: Math.PI / 2 }, police: [], marker: null };
}

// ---- Shot 16: review — driving view ----
// The driving view: from behind the Comet GT on Lantern Blvd, the road
// ahead, traffic, and the downtown skyline.
function shotReviewDriving(G) {
  const { camera } = G;
  const car = G.playerCar;
  car.group.position.set(0, 0, 0);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.midTraffic.forEach((c, i) => {
    const x = 20 + i * 18;
    const z = (i % 2 === 0 ? 3 : -3);
    c.group.position.set(x, 0, z);
    c.group.rotation.set(0, Math.PI / 2, 0);
    c.group.visible = true;
  });
  G.police[0].group.position.set(34, 0, 2.5);
  G.police[0].group.rotation.set(0, -Math.PI / 2, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  camera.position.set(-9, 3.2, -3.5);
  camera.lookAt(30, 1.5, 0);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'Driving view: the boulevard, traffic, skyline.', 'COMET GT · SPORTS', 58);
  G.minimapState = { player: { x: 0, z: 0, heading: Math.PI / 2 }, police: [{ x: 34, z: 2.5, color: '#ff2a1a' }], marker: { x: 120, z: 0 } };
}

// ---- Shot 17: MAIN CANDIDATE — key art, Jay + Comet GT, Neon Row ----
// Very low camera on Palm Row at blue hour: Jay stands in the street in
// the foreground facing the camera, the Comet GT behind him, a cruiser
// closing in, neon shopfronts on both sides. The AAA key-art composition:
// character + car + chase + city, with real depth.
// v2: traffic is HIDDEN for this shot — a random traffic pickup drove
// straight through the frame in the first take and blocked Jay. The
// composition is fully staged here (Jay + car + one cruiser), and Jay
// and the car are repositioned so Jay is big in the left foreground,
// the car centre, the cruiser right.
function shotKeyArtJay(G) {
  const { scene, camera } = G;
  // Traffic AND parked cars are hidden for this shot: a random traffic
  // pickup drove through the frame in the first take, and a parked car
  // in the bay at (-10, 55.2) sat right between the camera and Jay and
  // hid him completely in the second take. The composition is fully
  // staged here (Jay + car + one cruiser).
  G.traffic.cars.forEach((c) => { c.group.visible = false; });
  G.parked.forEach((g) => { g.visible = false; });
  const car = G.playerCar;
  car.group.position.set(4, 0, 59);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  const jay = G.jay;
  // Jay stands on the road just west of the car, facing the camera —
  // the old spot (-5, 57) was behind the parked car in bay (-10, 55.2).
  jay.group.position.set(0, 0, 56.5);
  jay.group.rotation.set(0, -1.94, 0); // facing the camera (south-west)
  jay.group.visible = true;
  G.police[0].group.position.set(22, 0, 63);
  G.police[0].group.rotation.set(0, -Math.PI / 2, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  camera.position.set(-11, 1.5, 52);
  camera.lookAt(14, 2, 60);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'Neon Row at blue hour — Jay, the Comet GT, and the SAMPD closing in.', 'COMET GT · SPORTS', 0);
  G.minimapState = { player: { x: 4, z: 59, heading: Math.PI / 2 }, police: [{ x: 22, z: 63, color: '#ff2a1a' }], marker: { x: 120, z: 60 } };
}

// ---- Shot 18: MAIN CANDIDATE — night chase, Lantern Blvd ----
// The chase composition at night: headlights on, lamp bulbs glowing, wet
// road, the cruisers' light bars flashing. Same staging as shot 5, camera
// lower (1.4 m) for a stronger low-angle read.
function shotNightChase(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  car.group.position.set(0, 0, 0);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.police[0].group.position.set(18, 0, 2.5);
  G.police[0].group.rotation.set(0, -Math.PI / 2, 0);
  G.police[0].group.visible = true;
  G.police[1].group.position.set(28, 0, -3.5);
  G.police[1].group.rotation.set(0, -Math.PI / 2, 0);
  G.police[1].group.visible = true;
  const heli = G.police[2];
  heli.group.position.set(16, 12, -8);
  heli.group.rotation.set(0, 0.6, 0);
  heli.group.visible = true;
  const flee = [[-4, 9.5, 1], [8, -9.5, -1], [14, 9.5, 1], [-12, -9.5, -1]];
  G.stagedPeds.forEach((w, i) => {
    const f = flee[i % flee.length];
    w.p.group.position.set(f[0], 0, f[1]);
    w.p.group.rotation.y = f[2] > 0 ? Math.PI / 2 : -Math.PI / 2;
    w.p.group.visible = true;
    w.fleeing = true; w.phase = i * 1.3;
  });
  camera.position.set(-12, 1.4, -3.0);
  camera.lookAt(16, 1.5, 0);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'Lantern Blvd at night — headlights on, the SAMPD closing in.', 'COMET GT · SPORTS', 58);
  G.minimapState = { player: { x: 0, z: 0, heading: Math.PI / 2 }, police: [{ x: 18, z: 2.5, color: '#ff2a1a' }, { x: 28, z: -3.5, color: '#ff2a1a' }], marker: { x: 120, z: 0 } };
}

// ---- Shot 19: MAIN CANDIDATE — bridge approach + SAN AMARO sign ----
// Low camera south-east of the bridge approach, looking north-west: the
// Comet GT on the approach road in the centre, the lift towers beyond it,
// and the big SAN AMARO sign on the left — bridge + city identity in one
// frame, at golden hour.
function shotBridgeSign(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  car.group.position.set(0, 0, -245);
  car.group.rotation.set(0, Math.PI, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.police[0].group.position.set(-8, 0, -258);
  G.police[0].group.rotation.set(0, Math.PI, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  // v2: the old camera sat INSIDE a block (x=18 is not a road) next to a
  // building that filled half the frame black, and the car was hidden.
  // Now the camera is ON the approach road (x=6) looking north-west, so
  // the car is right-centre, the towers centre-left, and the SAN AMARO
  // sign on the far left — bridge + city identity in one frame.
  camera.position.set(6, 3, -212);
  camera.lookAt(-20, 8, -270);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'The bridge is the only way out — and it is up.', 'COMET GT · SPORTS', 63);
  G.minimapState = { player: { x: 0, z: -245, heading: Math.PI }, police: [{ x: -8, z: -258, color: '#ff2a1a' }], marker: { x: 0, z: -300 } };
}

// ---- Shot 20: MAIN CANDIDATE — plaza at midday, Jay + car + fountain ----
// The rebuilt fountain as the centrepiece: Jay and the Comet GT in the
// foreground, the two-tier fountain with its jets behind them, palms and
// varied facades ringing the square, blue sky. Day mood.
function shotPlazaDay(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  car.group.position.set(-90, 0, 8);
  car.group.rotation.set(0, Math.PI * 0.75, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  const jay = G.jay;
  jay.group.position.set(-84, 0, 14);
  jay.group.rotation.set(0, -Math.PI * 0.25, 0);
  jay.group.visible = true;
  G.police[0].group.visible = false;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  // v2: same fix as shot 7 — the old camera put the car and Jay out of
  // frame. Now they are in the right foreground with the fountain centre.
  camera.position.set(-108, 3.5, -2);
  camera.lookAt(-88, 3, 24);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Meet Nadia', 'The plaza at midday — the fountain, the palms, the whole city.', 'COMET GT · SPORTS', 0);
  G.minimapState = { player: { x: -90, z: 8, heading: Math.PI * 0.75 }, police: [], marker: { x: -90, z: 30 } };
}

// ---- Shot 21: MAIN CANDIDATE — downtown canyon at midday ----
// Very low, slightly wide: the Comet GT threading the downtown canyon,
// varied glass + concrete towers on both sides, traffic ahead, a cruiser
// trailing, the street running long into the skyline. Day mood.
function shotDowntownCanyon(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  car.group.position.set(-10, 0, 0);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.midTraffic.forEach((c, i) => {
    const x = 20 + i * 18;
    const z = (i % 2 === 0 ? 3 : -3);
    c.group.position.set(x, 0, z);
    c.group.rotation.set(0, Math.PI / 2, 0);
    c.group.visible = true;
  });
  G.police[0].group.position.set(-24, 0, 4);
  G.police[0].group.rotation.set(0, Math.PI / 2, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  // v2: the old camera sat 20 m behind the car, so the player car was
  // BEHIND the camera and invisible — the red car in frame was traffic.
  // Now the camera is 10 m behind the Comet GT: the car is big in the
  // lower centre with the canyon running ahead.
  camera.position.set(-20, 1.8, -4);
  camera.lookAt(60, 10, 0);
  camera.fov = 58; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'Downtown canyon — the towers close in, the SAMPD closes faster.', 'COMET GT · SPORTS', 52);
  G.minimapState = { player: { x: -10, z: 0, heading: Math.PI / 2 }, police: [{ x: -24, z: 4, color: '#ff2a1a' }], marker: { x: 120, z: 0 } };
}

// ---- Shot 22: PROOF — on-foot gameplay ----
// Jay walking east on the Lantern Blvd sidewalk, frozen mid-stride, with
// pedestrians walking both sidewalks around him and the downtown canyon
// behind. Day mood. (Reference: GTA-style third-person on-foot shot —
// character + NPCs + city, camera behind the character.)
function shotProofOnFoot(G) {
  const { scene, camera } = G;
  const jay = G.jay;
  jay.group.position.set(0, 0, -9.5);
  jay.group.rotation.set(0, Math.PI / 2, 0); // facing east, walking away
  jay.group.visible = true;
  walkCycle(jay, 1.2, 4, false); // freeze mid-stride
  const peds = [
    [-8, -9.5, 1], [7, -9.5, -1], [14, 9.5, 1], [-14, 9.5, -1], [22, -9.5, 1], [-22, 9.5, -1],
  ];
  G.stagedPeds.forEach((w, i) => {
    const f = peds[i % peds.length];
    w.p.group.position.set(f[0], 0, f[1]);
    w.p.group.rotation.y = f[2] > 0 ? Math.PI / 2 : -Math.PI / 2;
    w.p.group.visible = true;
    w.fleeing = false; w.phase = i * 1.1;
  });
  G.midPeds.forEach((w, i) => {
    const x = -18 + i * 8;
    const z = (i % 2 === 0 ? 9.5 : -9.5);
    w.p.group.position.set(x, 0, z);
    w.p.group.rotation.y = (i % 2 === 0 ? -Math.PI / 2 : Math.PI / 2);
    w.p.group.visible = true;
    w.fleeing = false; w.phase = i * 0.9;
  });
  G.police.forEach((u) => { u.group.visible = false; });
  G.playerCar.group.visible = false;
  // a parked taxi at the curb ahead, for street life
  const { group: taxiG } = buildCar('taxi');
  taxiG.position.set(18, 0, 4.8);
  taxiG.rotation.set(0, Math.PI / 2, 0);
  taxiG.visible = true;
  scene.add(taxiG);
  G.shotProps.push(taxiG);
  // camera behind and to the side of Jay — he walks away down the street
  camera.position.set(-8, 2.2, -12);
  camera.lookAt(10, 1.2, -9);
  camera.fov = 55; camera.updateProjectionMatrix();
  baseHUD();
  HUD.hideVehicle();
  HUD.setMission({
    chapter: 'CHAPTER 1 · MISSION 1', title: 'FIRST WHEELS',
    objective: 'Explore San Amaro',
    desc: 'On foot in Downtown Core — the city is alive.',
    fill: 0.33, stage: 'Stage 1 / 3', par: '+$100', time: '00:01 / 02:41',
  });
  HUD.setWanted(0, 'CLEAR', 'clear', '$250', 'NOBODY', 0, 200);
  HUD.setPolice([
    { dist: '—', status: 'STANDBY' },
    { dist: '—', status: 'STANDBY' },
    { dist: '—', status: 'STANDBY' },
  ]);
  HUD.setDialogue('NADIA · PALM & PISTON',
    '“The city never sleeps, Jay. Neither do we.”', 'nadia', '#8a5a3a', '#1c1410');
  HUD.setWeapon(0);
  G.minimapState = { player: { x: 0, z: -9.5, heading: Math.PI / 2 }, police: [], marker: null };
}

// ---- Shot 23: PROOF — driving gameplay ----
// The Comet GT driving east on Lantern Blvd, dense traffic ahead (sedans,
// a taxi, a pickup), the downtown skyline ahead, palms and shopfronts on
// both sides. Day mood. (Reference: GTA-style chase-cam driving shot —
// car + road + traffic + city.)
function shotProofDriving(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  car.group.position.set(0, 0, 0);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.midTraffic.forEach((c, i) => {
    const x = 16 + i * 15;
    const z = (i % 2 === 0 ? 3 : -3);
    c.group.position.set(x, 0, z);
    c.group.rotation.set(0, Math.PI / 2, 0);
    c.group.visible = true;
  });
  const { group: taxiG } = buildCar('taxi');
  taxiG.position.set(54, 0, 3);
  taxiG.rotation.set(0, Math.PI / 2, 0);
  taxiG.visible = true;
  scene.add(taxiG);
  G.shotProps.push(taxiG);
  const { group: pkG } = buildCar('pickup');
  pkG.position.set(70, 0, -3);
  pkG.rotation.set(0, Math.PI / 2, 0);
  pkG.visible = true;
  scene.add(pkG);
  G.shotProps.push(pkG);
  G.police.forEach((u) => { u.group.visible = false; });
  camera.position.set(-8, 2.6, -3.0);
  camera.lookAt(24, 1.5, 0);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Drive to the marker', 'Lantern Blvd — traffic, palms, the downtown skyline.', 'COMET GT · SPORTS', 58);
  // v2: a plain driving shot — no wanted level (the template HUD sets 2
  // stars, which belongs to a pursuit, not a drive).
  HUD.setWanted(0, 'CLEAR', 'clear', '$250', 'NOBODY', 0, 200);
  HUD.setPolice([
    { dist: '—', status: 'STANDBY' },
    { dist: '—', status: 'STANDBY' },
    { dist: '—', status: 'STANDBY' },
  ]);
  G.minimapState = { player: { x: 0, z: 0, heading: Math.PI / 2 }, police: [], marker: { x: 120, z: 0 } };
}

// ---- Shot 24: PROOF (staged backup) — police pursuit ----
// The Comet GT fleeing east with TWO cruisers right on its tail (4 m and
// 9 m back, closing in — not parked ahead) and AIR-1 overhead: the pursuit
// actually happening, two wanted stars on the HUD. This is the staged
// backup for the live play-mode pursuit capture (proof-pursuit), which
// triggers a real wanted level in the running game.
// (Reference: GTA-style pursuit shot — wanted stars, cruisers, chase.)
function shotProofPursuit(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  car.group.position.set(0, 0, 0);
  car.group.rotation.set(0, Math.PI / 2, 0);
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.police[0].group.position.set(-5, 0, -2.5);
  G.police[0].group.rotation.set(0, Math.PI / 2, 0);
  G.police[0].group.visible = true;
  G.police[1].group.position.set(-11, 0, -3.5);
  G.police[1].group.rotation.set(0, Math.PI / 2, 0);
  G.police[1].group.visible = true;
  const heli = G.police[2];
  heli.group.position.set(10, 12, -6);
  heli.group.rotation.set(0, 0.6, 0);
  heli.group.visible = true;
  const flee = [[-4, 9.5, 1], [6, -9.5, -1], [12, 9.5, 1], [-10, -9.5, -1]];
  G.stagedPeds.forEach((w, i) => {
    const f = flee[i % flee.length];
    w.p.group.position.set(f[0], 0, f[1]);
    w.p.group.rotation.y = f[2] > 0 ? Math.PI / 2 : -Math.PI / 2;
    w.p.group.visible = true;
    w.fleeing = true; w.phase = i * 1.3;
  });
  // v2: pulled further back and higher, looking north-east — the old
  // camera put both cruisers outside the frame (one left of the fov, one
  // behind the camera) and the heli above the top edge. Now the car is
  // centre, both cruisers are visible on its tail (left), and AIR-1 is
  // in the top of the frame.
  camera.position.set(-16, 3, -7);
  camera.lookAt(12, 1.5, 0);
  camera.fov = 55; camera.updateProjectionMatrix();
  baseHUD();
  HUD.setMission({
    chapter: 'CHAPTER 1 · MISSION 1', title: 'FIRST WHEELS',
    objective: 'Lose the police',
    desc: 'Two cruisers on you — lose them, then get to the marker.',
    fill: 1, stage: 'Stage 3 / 3', par: '+$100', time: '00:01 / 02:41',
  });
  HUD.setWanted(2, 'IN PURSUIT · 2 UNITS', '', '$250', 'NOBODY', 0, 200);
  HUD.setPolice([
    { dist: '4 m', status: 'PURSUIT' },
    { dist: '9 m', status: 'PURSUIT' },
    { dist: '—', status: 'AIR-1' },
  ]);
  HUD.setVehicle({ name: 'COMET GT · SPORTS', speed: 71, condition: 96, nitro: 100 });
  HUD.setDialogue('NADIA · PALM & PISTON',
    '“BAY-12 is right on you — lose them before the bridge, or you’re done.”', 'nadia', '#8a5a3a', '#1c1410');
  HUD.setWeapon(0);
  G.minimapState = { player: { x: 0, z: 0, heading: Math.PI / 2 }, police: [{ x: -5, z: 2.5, color: '#ff2a1a' }, { x: -11, z: -3.5, color: '#ff2a1a' }], marker: { x: 120, z: 0 } };
}

export const SHOTS = { 1: shotChase, 2: shotShootout, 3: shotMission, 4: shotJump, 5: shotCineChase, 6: shotCineSpire, 7: shotCinePlaza, 8: shotCineNeon, 9: shotCineBridge, 10: shotReviewAerial, 11: shotReviewDowntown, 12: shotReviewCommercial, 13: shotReviewResidential, 14: shotReviewIntersection, 15: shotReviewStreet, 16: shotReviewDriving, 17: shotKeyArtJay, 18: shotNightChase, 19: shotBridgeSign, 20: shotPlazaDay, 21: shotDowntownCanyon, 22: shotProofOnFoot, 23: shotProofDriving, 24: shotProofPursuit, 25: shotMainCoverV3, 26: shotSpireBluehour, 27: shotBridgeNight, 28: shotMainCoverV4 };

// Highest valid shot number, derived from SHOTS so it stays correct when
// shots are added or removed. main.js clamps the ?shot= URL parameter to
// this; setupShot clamps again as a safety net. (The old hard-coded clamp
// of 30 let ?shot=29/30 through, and SHOTS[29] is undefined — setupShot
// threw. Now out-of-range numbers land on the nearest valid shot.)
export const MAX_SHOT = Math.max(...Object.keys(SHOTS).map(Number));

// ---- Shot 28: MAIN COVER v4 — Jay readable, car dominant, cruiser visible ----
// v3-25 failed the cover test: Jay sat at the frame edge (~44 deg off the
// camera axis) and read as a dark smudge, not a person. v4 candidate 1
// (diagonal camera) put Jay on the wrong side, facing away, cut off by
// the SAMPD panel. Candidate 2 (straight-north camera) hid Jay behind
// the car. Candidate 3 returns to the v3-25 camera (proven skyline +
// dominant car) and moves ONLY Jay: he now stands east of the car,
// closer to the camera, facing it, so he reads large on the left while
// the Comet GT stays big on the right and the cruiser stays visible.
// Golden hour, low camera.
function shotMainCoverV4(G) {
  const { scene, camera } = G;
  // Hide traffic + parked cars: a random pickup drove through the v2-17
  // frame and a parked car hid Jay. The composition is fully staged
  // (Jay + car + one cruiser), and it is labelled as such.
  G.traffic.cars.forEach((c) => { c.group.visible = false; });
  G.parked.forEach((g) => { g.visible = false; });
  const car = G.playerCar;
  // The Comet GT big on the right, flank to the camera (as in v3-25).
  car.group.position.set(0, 0, 58);
  car.group.rotation.set(0, Math.PI / 2, 0); // facing east, flank to camera
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  const jay = G.jay;
  // Jay on the left, closer to the camera so he reads larger (~23% of
  // the frame tall), facing the camera so his face is visible.
  jay.group.position.set(3, 0, 54);
  jay.group.rotation.set(0, -1.8, 0); // facing the camera (west-northwest)
  jay.group.visible = true;
  // One cruiser behind the car, close enough to read (as in v3-25).
  G.police[0].group.position.set(12, 0, 60);
  G.police[0].group.rotation.set(0, Math.PI / 2, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  G.stagedPeds.forEach((w) => { w.p.group.visible = false; });
  // Low camera (v3-25 framing): Jay on the left, the car big on the
  // right, the skyline running behind them.
  camera.position.set(-4, 1.6, 52);
  camera.lookAt(4, 2, 59);
  camera.fov = 58; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'Jay, the Comet GT, and the SAMPD closing in — San Amaro behind them.', 'COMET GT · SPORTS', 0);
  HUD.setPolice([
    { dist: '8 m', status: 'PURSUIT' },
    { dist: '—', status: 'STANDBY' },
    { dist: '—', status: 'STANDBY' },
  ]);
  G.minimapState = { player: { x: 0, z: 58, heading: Math.PI / 2 }, police: [{ x: 12, z: 60, color: '#ff2a1a' }], marker: { x: 120, z: 60 } };
}

// ---- Shot 25: MAIN COVER v3 — Jay + Comet GT + cruiser + skyline ----
// The v2-17 key art failed as a cover: Jay tiny, the car not dominant,
// the cruiser unclear, too much empty foreground. This is the fix: the
// camera is CLOSE (6 m from Jay) and LOW (1.4 m, near road level), so
// Jay fills a third of the frame, the Comet GT is big right behind him,
// and the cruiser is clearly visible on its tail — with the downtown
// skyline and the Spire behind them. Golden hour. Palm Row, like v2-17,
// but everything pulled in tight.
function shotMainCoverV3(G) {
  const { scene, camera } = G;
  // Hide traffic + parked cars: a random pickup drove through the v2-17
  // frame and a parked car hid Jay. The composition is fully staged
  // (Jay + car + one cruiser), and it is labelled as such.
  G.traffic.cars.forEach((c) => { c.group.visible = false; });
  G.parked.forEach((g) => { g.visible = false; });
  const car = G.playerCar;
  // v3: Jay stands BESIDE the car's rear (not in front of it) — v2 put
  // him on the car's bearing, so only his head showed above the roof.
  // Jay is on the camera side of the car, 3.5 m clear of it, facing us.
  car.group.position.set(0, 0, 58);
  car.group.rotation.set(0, Math.PI / 2, 0); // facing east, flank to camera
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  const jay = G.jay;
  jay.group.position.set(-3.5, 0, 58);
  jay.group.rotation.set(0, -3.06, 0); // facing the camera (south)
  jay.group.visible = true;
  // One cruiser on the car's tail, close enough to read (12 m back)
  G.police[0].group.position.set(12, 0, 60);
  G.police[0].group.rotation.set(0, Math.PI / 2, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  G.stagedPeds.forEach((w) => { w.p.group.visible = false; });
  // Low and close: Jay is ~6 m away, the car ~7 m — both dominate,
  // the skyline runs behind them.
  camera.position.set(-4, 1.6, 52);
  camera.lookAt(4, 2, 59);
  camera.fov = 58; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'Jay, the Comet GT, and the SAMPD closing in — San Amaro behind them.', 'COMET GT · SPORTS', 0);
  HUD.setPolice([
    { dist: '8 m', status: 'PURSUIT' },
    { dist: '—', status: 'STANDBY' },
    { dist: '—', status: 'STANDBY' },
  ]);
  G.minimapState = { player: { x: 0, z: 58, heading: Math.PI / 2 }, police: [{ x: 12, z: 60, color: '#ff2a1a' }], marker: { x: 120, z: 60 } };
}

// ---- Shot 26: the Spire at blue hour, Jay + Comet GT in frame ----
// Shot 6 hid the car and Jay (they would sit behind the dialogue panel
// in an upward shot). Here the camera is lower and further back, so the
// Comet GT and Jay stand in the foreground on Sunset Ave with the Spire
// towering behind them — character + car + landmark in one frame.
function shotSpireBluehour(G) {
  const { scene, camera } = G;
  // v1/v2 tried to put the car + Jay in the foreground — the camera
  // pitches up to the Spire's crown, so any foreground subject lands
  // at the bottom edge behind the HUD (dialogue / weapon wheel), and
  // the street east of the camera is walled by towers. So this is a
  // CLEAN landmark shot (like shot 6): the Spire, the halo, the blue
  // hour. Jay + the car star in the main cover instead. Hide them so
  // no invisible subject is implied.
  G.playerCar.group.visible = false;
  G.jay.group.visible = false;
  G.police.forEach((u) => { u.group.visible = false; });
  camera.position.set(64, 2.2, -20);
  camera.lookAt(88, 26, -90);
  camera.fov = 55; camera.updateProjectionMatrix();
  baseHUD();
  HUD.setMission({
    chapter: 'CHAPTER 3 · MISSION 5', title: 'THE PICKUP',
    objective: 'Pick up Mara',
    desc: 'The Spire at blue hour — Mara is waiting.',
    fill: 0.5, stage: 'Stage 1 / 2', par: '+$500', time: '00:00 / 04:00',
  });
  HUD.setWanted(0, 'CLEAR', 'clear', '$2,600', 'HUSTLER', 770, 1000);
  HUD.setPolice([
    { dist: '—', status: 'STANDBY' },
    { dist: '—', status: 'STANDBY' },
    { dist: '—', status: 'STANDBY' },
  ]);
  HUD.setVehicle({ name: 'COMET GT · SPORTS', speed: 0, condition: 100, nitro: 100 });
  HUD.setDialogue('MARA · THE FIXER',
    '“The Spire job starts here. Don’t keep me waiting, Jay.”', 'mara', '#f2c9a0', '#e8c85a');
  HUD.setWeapon(0);
  G.minimapState = { player: { x: 64, z: -20, heading: Math.PI }, police: [], marker: { x: 90, z: -90 } };
}

// ---- Shot 27: the Lift Bridge at night, Comet GT + cruiser ----
// The bridge at night: the Comet GT on the approach road, a cruiser
// closing in behind it, the lift towers and the SAN AMARO sign ahead.
// Night mood — headlights, lamp glow, and the towers' floodlights.
function shotBridgeNight(G) {
  const { scene, camera } = G;
  const car = G.playerCar;
  // v6: v4 (31 m) cleared the sign but the car was invisible at night;
  // v5 (11 m) showed the car but pushed the sign under the mission
  // panel. v6 is the middle ground — camera 20 m back on the approach,
  // looking right of the sign and slightly up, so the sign sits in the
  // left third BELOW the mission panel while the Comet GT stays big
  // enough in the foreground for its cyan strip to read.
  car.group.position.set(0, 0, -245);
  car.group.rotation.set(0, Math.PI * 0.75, 0); // three-quarter, side to camera
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  G.police[0].group.position.set(-6, 0, -252);
  G.police[0].group.rotation.set(0, Math.PI, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  camera.position.set(0, 3, -225);
  camera.lookAt(10, 8, -280);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'The bridge at night — the only way out is up.', 'COMET GT · SPORTS', 63);
  G.minimapState = { player: { x: 0, z: -245, heading: Math.PI }, police: [{ x: -6, z: -252, color: '#ff2a1a' }], marker: { x: 0, z: -300 } };
}
export function setupShot(n, G) {
  // Guard: clamp to a valid shot. Out-of-range numbers (e.g. ?shot=29/30
  // from the old clamp) used to throw on SHOTS[n](G) because SHOTS[n] was
  // undefined. Now they land on the nearest valid shot instead of
  // crashing the page.
  n = Math.max(1, Math.min(MAX_SHOT, Math.floor(n) || 1));
  // clear per-shot props from the previous shot
  for (const p of G.shotProps) G.scene.remove(p);
  G.shotProps.length = 0;
  // hide the staged actors; each shot re-shows the ones it needs
  G.playerCar.group.visible = false;
  G.sedanCar.group.visible = false;
  G.prizeCar.group.visible = false;
  G.jay.group.visible = false;
  for (const u of G.police) u.group.visible = false;
  for (const w of G.stagedPeds) w.p.group.visible = false;
  for (const e of G.stagedEnemies) e.group.visible = false;
  for (const c of G.midTraffic) c.group.visible = false;
  for (const w of G.midPeds) w.p.group.visible = false;
  SHOTS[n](G);
  // draw the minimap for this shot
  HUD.drawMinimap(G.minimapState || { player: { x: 0, z: 0, heading: 0 }, police: [], marker: null });
  HUD.showHUD();
  document.getElementById('start').style.display = 'none';
}
