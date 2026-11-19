// SAN AMARO — staged screenshot setups (?shot=1..4). Each shot places the
// camera, the actors and the HUD for one golden-hour action moment, matching
// the reference screenshots (benchmark only — San Amaro's own names, from
// the spec). After each setup the scene renders once and sets
// window.__shotReady so the capture script knows when to shoot.
// Written from scratch from the re-author spec.
const THREE = globalThis.THREE;
import * as HUD from './hud.js';
import { buildPerson, buildJay, buildNadia, buildRifle, aimPose } from './people.js';
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
  // a green neon ring on the Glass Spire (a landmark that reads at dusk).
  // The Spire is on its own plot at (90,-90); the ring sits on its south
  // face (z=-72), facing the boulevard.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x2aff5a, emissive: 0x2aff5a, emissiveIntensity: 2.4 }));
  ring.position.set(90, 52, -72);
  scene.add(ring);
  G.shotProps.push(ring);
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
  // On the x=120 street (a real street), facing north — the Spire is
  // north-west at (90,-90). (The earlier take parked the car at (90,-30),
  // mid-block inside a building, so the frame was a wall.)
  // Camera 10 m behind the car, mirroring the main shot's geometry, so
  // the Comet GT is big in the lower centre with the Spire beyond it.
  car.group.position.set(120, 0, -6);
  car.group.rotation.set(0, Math.PI, 0); // facing north (-Z), toward the Spire
  car.group.visible = true;
  setAirPitch(car, 0, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x2aff5a, emissive: 0x2aff5a, emissiveIntensity: 2.4 }));
  ring.position.set(90, 52, -72);
  scene.add(ring);
  G.shotProps.push(ring);
  G.police[0].group.position.set(120, 0, -45);
  G.police[0].group.rotation.set(0, Math.PI, 0);
  G.police[0].group.visible = true;
  G.police[1].group.visible = false;
  G.police[2].group.visible = false;
  // low and pulled back: the Comet GT is in the lower foreground, the
  // Spire towers ahead with its neon ring. Camera 10 m behind the car
  // (main-shot geometry) so the car is big, centre-frame, above the HUD.
  camera.position.set(120, 2.0, 4);
  camera.lookAt(100, 15, -90);
  camera.fov = 55; camera.updateProjectionMatrix();
  newShotHUD(G, 'FIRST WHEELS', 'Lose the police', 'The Spire job starts here — but first, lose the tail.', 'COMET GT · SPORTS', 41);
  G.minimapState = { player: { x: 120, z: -6, heading: Math.PI }, police: [{ x: 120, z: -45, color: '#ff2a1a' }], marker: { x: 90, z: -90 } };
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
  // raised and pulled back: the Comet GT + Jay in the foreground, the
  // fountain and the plaza ring behind them
  camera.position.set(-102, 3.2, 18);
  camera.lookAt(-86, 2, 30);
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
  // lookAt y=8 (not 12): a shallower up-angle keeps the Comet GT above
  // the bottom-centre HUD while the LIFT BRIDGE sign stays in frame.
  camera.position.set(-6, 2.5, -230);
  camera.lookAt(0, 8, -282);
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

export const SHOTS = { 1: shotChase, 2: shotShootout, 3: shotMission, 4: shotJump, 5: shotCineChase, 6: shotCineSpire, 7: shotCinePlaza, 8: shotCineNeon, 9: shotCineBridge, 10: shotReviewAerial, 11: shotReviewDowntown, 12: shotReviewCommercial, 13: shotReviewResidential, 14: shotReviewIntersection, 15: shotReviewStreet, 16: shotReviewDriving };
export function setupShot(n, G) {
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
