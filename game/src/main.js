// SAN AMARO — entry point. Renderer, sunset sky, lights, game state,
// input, third-person walk/drive, SAMPD pursuit, the First Wheels mission,
// save/load, and the staged screenshot mode (?shot=1..4).
// Written from scratch from the re-author spec.
const THREE = globalThis.THREE;
import { buildCity } from './city.js';
import { buildCar, makeTraffic, makeParked, makePolice, setAirPitch } from './vehicles.js';
import { buildJay, buildNadia, buildPerson, walkCycle, aimPose, buildRifle, makePedestrians } from './people.js';
import * as HUD from './hud.js';
import * as Audio from './audio.js';
import { setupShot } from './shots.js';

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const params = new URLSearchParams(location.search);
const SHOT = params.has('shot') ? clamp(parseInt(params.get('shot') || '1', 10) || 1, 1, 4) : 0;
window.__shotReady = false;
window.__shot = SHOT;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe88a5a, 90, 780);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 4, -12);

// ---------- sunset sky (gradient dome + sun glow) + environment ----------
const SUN_DIR = new THREE.Vector3(-0.78, 0.20, 0.42).normalize();
{
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 top = vec3(0.11, 0.07, 0.26);
        vec3 mid = vec3(0.96, 0.36, 0.52);
        vec3 hor = vec3(1.0, 0.52, 0.13);
        vec3 col = mix(hor, mid, smoothstep(0.02, 0.28, h));
        col = mix(col, top, smoothstep(0.22, 0.68, h));
        col = mix(vec3(0.16,0.10,0.20), col, smoothstep(-0.08, 0.02, h));
        float s = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.55, 0.18) * pow(s, 18.0) * 0.45;
        col += vec3(1.0, 0.78, 0.42) * pow(s, 220.0) * 1.3;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 18), skyMat);
  scene.add(sky);
  // sun glow sprite (feeds the bloom pass)
  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  const gg = gc.getContext('2d');
  const grad = gg.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,230,160,1)');
  grad.addColorStop(0.35, 'rgba(255,150,60,.7)');
  grad.addColorStop(1, 'rgba(255,120,0,0)');
  gg.fillStyle = grad; gg.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(gc);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
  sunSprite.position.copy(SUN_DIR).multiplyScalar(820);
  sunSprite.scale.set(180, 180, 1);
  scene.add(sunSprite);
}
// environment (warm gradient cube) so water + car paint reflect the sunset
{
  const faces = [];
  const mk = (top, mid, bot) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    return c;
  };
  const side = mk('#3a2a5a', '#ff6a8a', '#ff8a2a');
  const topF = mk('#2a1a4a', '#3a2a5a', '#5a3a6a');
  const botF = mk('#1a1218', '#241a20', '#2a1a16');
  faces.push(side, side, topF, botF, side, side);
  const cube = new THREE.CubeTexture(faces);
  cube.needsUpdate = true;
  scene.environment = cube;
}

// ---------- lights ----------
const sun = new THREE.DirectionalLight(0xffb36b, 1.9);
sun.position.copy(SUN_DIR).multiplyScalar(320);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xff9a6a, 0x2a2438, 0.85));
scene.add(new THREE.AmbientLight(0xff8a5a, 0.35));

// ---------- bloom (real, via the vendored bundle) — falls back to direct render ----------
let composer = null;
try {
  const { EffectComposer, RenderPass, UnrealBloomPass, OutputPass } = THREE;
  if (EffectComposer && UnrealBloomPass) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2)),
      0.32, 0.72, 0.5);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
} catch (e) {
  composer = null;
}
function renderFrame() {
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

// ---------- build the world ----------
const cityRefs = buildCity(scene);
const traffic = makeTraffic(scene, 30);
const parked = makeParked(scene, 18);
const pedestrians = makePedestrians(scene, 60);
pedestrians.setFleeing(false);
const police = makePolice(scene);

// Jay (player on foot) + Nadia (at the garage, for staging)
const jay = buildJay();
jay.group.position.set(0, 0, 12);
scene.add(jay.group);
const nadia = buildNadia();
nadia.group.position.set(-14, 0, 26);
nadia.group.rotation.y = 0.6;
scene.add(nadia.group);

// Player cars: Comet GT (the player's car) + Marina Sedan + the prize Comet GT.
const playerCar = buildCar('comet');
playerCar.group.position.set(4, 0, 12);
playerCar.group.rotation.y = Math.PI / 2;
scene.add(playerCar.group);
const sedanCar = buildCar('sedan');
sedanCar.group.visible = false;
scene.add(sedanCar.group);
const prizeCar = buildCar('comet');
prizeCar.group.visible = false;
scene.add(prizeCar.group);

// Staged actors (hidden until a shot uses them)
const stagedPeds = [];
for (let i = 0; i < 6; i++) {
  const p = buildPerson({});
  p.group.visible = false;
  scene.add(p.group);
  stagedPeds.push({ p, fleeing: false, phase: i * 1.1 });
}
const stagedEnemies = [];
for (let i = 0; i < 3; i++) {
  const p = buildPerson({ shirt: 0xf2f2f2, pants: 0x2a2a2e });
  p.group.visible = false;
  scene.add(p.group);
  stagedEnemies.push(p);
}
const midTraffic = [];
for (let i = 0; i < 5; i++) {
  const c = buildCar(i % 2 === 0 ? 'sedan' : 'muscle');
  c.group.visible = false;
  scene.add(c.group);
  midTraffic.push(c);
}
const midPeds = [];
for (let i = 0; i < 6; i++) {
  const p = buildPerson({});
  p.group.visible = false;
  scene.add(p.group);
  midPeds.push({ p, fleeing: false, phase: i * 0.8 });
}

// ---------- game context (shared with shots.js) ----------
const G = {
  scene, camera, renderer, cityRefs,
  playerCar, sedanCar, prizeCar, jay, nadia,
  police, traffic, pedestrians, parked,
  stagedPeds, stagedEnemies, midTraffic, midPeds,
  shotProps: [], minimapState: null,
};

// ---------- game state ----------
const SAVE_KEY = 'san-amaro-save-v1';
const state = {
  mode: 'start', // 'start' | 'play' | 'shot'
  driving: false,
  car: null, // the car the player is driving (playerCar or sedanCar)
  speed: 0, // m/s
  steer: 0,
  wanted: 0,
  money: 250,
  xp: 0, rank: 'NOBODY', xpMax: 200,
  hp: 100, armor: 0,
  mission: { stage: 0, done: false }, // 0 = steal the car, 1 = drive to marker, 2 = lose the police
  weapon: 0,
  radio: 0,
  busted: false,
  time: 0,
};
const MISSION_MARKER = { x: 120, z: 0 }; // Sunset Plaza marker for stage 2
let markerMesh = null;
{
  markerMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.1),
    new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xffd23e, emissiveIntensity: 2.2 }));
  markerMesh.position.set(MISSION_MARKER.x, 6, MISSION_MARKER.z);
  scene.add(markerMesh);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 40, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(MISSION_MARKER.x, 20, MISSION_MARKER.z);
  scene.add(beam);
  markerMesh.userData.beam = beam;
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money, xp: state.xp, mission: state.mission,
      pos: [jay.group.position.x, jay.group.position.z],
      driving: state.driving,
    }));
  } catch {}
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    state.money = d.money ?? 250; state.xp = d.xp ?? 0;
    state.mission = d.mission ?? { stage: 0, done: false };
    if (d.pos) jay.group.position.set(d.pos[0], 0, d.pos[1]);
    return true;
  } catch { return false; }
}

// ---------- HUD init ----------
HUD.buildStars(); HUD.buildWeapons();
HUD.setWeapon(0); HUD.lockWeapons(1);
HUD.setCrew([
  { name: 'NADIA', style: 'nadia', skin: '#8a5a3a', hair: '#1c1410' },
  { name: 'THEO', style: 'theo', skin: '#e8b88a', hair: '#8a8a8a' },
  { name: 'MARA', style: 'mara', skin: '#f2c9a0', hair: '#e8c85a' },
]);
HUD.setMission({
  chapter: 'CHAPTER 1 · MISSION 1', title: 'FIRST WHEELS',
  objective: 'Steal the Comet GT',
  desc: 'Nadia’s garage is $50,000 in debt. Start with a car.',
  fill: 0, stage: 'Stage 1 / 3', par: '+$100', time: '00:00 / 02:41',
});
HUD.setWanted(0, 'CLEAR', 'clear', '$250', 'NOBODY', 0, 200);
HUD.setPolice([
  { dist: '—', status: 'STANDBY' },
  { dist: '—', status: 'STANDBY' },
  { dist: '—', status: 'STANDBY' },
]);
HUD.setVehicle({ name: 'COMET GT · SPORTS', speed: 0, condition: 100, nitro: 100 });
HUD.setDialogue('NADIA · PALM & PISTON', '“You break it, you bought it. Now go get us a car.”', 'nadia', '#8a5a3a', '#1c1410');
HUD.setHealth(100, 0);

// ---------- input ----------
const keys = {};
let mouseDown = false;
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  Audio.initAudio(); Audio.resumeAudio();
  if (e.code === 'Enter' && state.mode === 'start') startGame(false);
  if (state.mode !== 'play') return;
  if (e.code === 'KeyE') tryEnterExitCar();
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= 5) { state.weapon = n - 1; HUD.setWeapon(state.weapon); Audio.blip(660 + n * 90); }
  }
  if (e.code === 'KeyR') {
    state.radio = (state.radio + 1) % 3;
    const [track, genre] = Audio.radioTracks(state.radio);
    HUD.setVehicle({ station: Audio.radioStationName(state.radio), track, genre });
    Audio.radioStart(state.radio); Audio.blip(990);
  }
  if (e.code === 'KeyM') saveGame();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('mousedown', () => {
  mouseDown = true;
  Audio.initAudio(); Audio.resumeAudio();
  if (state.mode === 'play' && state.weapon === 4 && !state.driving) shootRifle();
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- start screen ----------
const startEl = document.getElementById('start');
function startGame(continued) {
  Audio.initAudio(); Audio.resumeAudio(); Audio.engineStart(); Audio.radioStart(0);
  startEl.style.display = 'none';
  HUD.showHUD();
  state.mode = 'play';
  updateMissionHUD();
  // refresh the save slots
  const has = !!localStorage.getItem(SAVE_KEY);
  document.querySelectorAll('#start .slot-save').forEach((s, i) => {
    if (i === 0 && has) s.innerHTML = '<b>SLOT 1 · SAN AMARO</b>Day 1 · $' + state.money + ' · Mission ' + (state.mission.stage + 1) + '/3';
  });
}
document.getElementById('btn-new').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => {
  const ok = loadGame();
  startGame(true);
  if (!ok) HUD.showToast('NO SAVE YET', 'Start a new game first.', 2000);
});
document.getElementById('btn-controls').addEventListener('click', () => {
  HUD.showToast('CONTROLS', 'WASD move / drive · E steal car · 1-5 weapons · Click shoot · R radio · M save', 4200);
});

// ---------- mission (First Wheels, 3 stages) ----------
function updateMissionHUD() {
  const s = state.mission.stage;
  if (state.mission.done) {
    HUD.setMission({ objective: 'Mission complete', desc: 'The garage lives another day. $500 banked.', fill: 1, stage: 'Stage 3 / 3' });
    return;
  }
  if (s === 0) HUD.setMission({ objective: 'Steal the Comet GT', desc: 'Nadia’s garage is $50,000 in debt. Start with a car.', fill: 0, stage: 'Stage 1 / 3' });
  if (s === 1) HUD.setMission({ objective: 'Drive to the marker', desc: 'Don’t scratch the paint — the SAMPD is watching.', fill: 0.5, stage: 'Stage 2 / 3' });
  if (s === 2) HUD.setMission({ objective: 'Lose the police', desc: 'Two cruisers on you — lose them, then get to the marker.', fill: 1, stage: 'Stage 3 / 3' });
}
function setWanted(n) {
  state.wanted = clamp(n, 0, 5);
  const label = state.wanted === 0 ? 'CLEAR'
    : state.wanted === 1 ? 'IN PURSIT · 1 UNIT'
    : `IN PURSUIT · ${state.wanted} UNITS`;
  HUD.setWanted(state.wanted, state.wanted === 0 ? 'CLEAR' : `IN PURSUIT · ${Math.max(1, state.wanted)} UNIT${state.wanted > 1 ? 'S' : ''}`,
    state.wanted === 0 ? 'clear' : '', `$${state.money}`, state.rank, state.xp, state.xpMax);
  if (state.wanted > 0) { Audio.sirenStart(); pedestrians.setFleeing(true); }
  else { Audio.sirenStop(); pedestrians.setFleeing(false); }
}
function tryEnterExitCar() {
  if (!state.driving) {
    // near the Comet GT? steal it.
    const d = jay.group.position.distanceTo(playerCar.group.position);
    if (d < 4.5) {
      state.driving = true; state.car = playerCar;
      jay.group.visible = false;
      setWanted(1);
      Audio.blip(520);
      if (state.mission.stage === 0) {
        state.mission.stage = 1; updateMissionHUD();
        HUD.setDialogue('NADIA · PALM & PISTON', '“That’s my car now — get it to the marker.”', 'nadia', '#8a5a3a', '#1c1410');
      }
      return;
    }
    const d2 = jay.group.position.distanceTo(sedanCar.group.position);
    if (d2 < 4.5 && sedanCar.group.visible) {
      state.driving = true; state.car = sedanCar;
      jay.group.visible = false; setWanted(1); Audio.blip(520);
    }
  } else {
    state.driving = false;
    const c = state.car;
    jay.group.visible = true;
    jay.group.position.set(c.group.position.x - 2.2, 0, c.group.position.z + 1.5);
    jay.group.rotation.y = c.group.rotation.y;
    state.car = null; state.speed = 0;
    Audio.blip(420);
  }
}

// ---------- combat (Longshot rifle) ----------
let rifleMesh = null;
let tracerMesh = null;
function shootRifle() {
  if (!rifleMesh) {
    rifleMesh = buildRifle();
    aimPose(jay, rifleMesh);
  }
  Audio.gunshot();
  // tracer from the barrel toward the camera forward
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const from = new THREE.Vector3();
  jay.group.localToWorld(from.set(0.05, 1.35, 0.6));
  if (tracerMesh) scene.remove(tracerMesh);
  tracerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 30, 4),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 }));
  tracerMesh.position.copy(from).addScaledVector(dir, 15);
  tracerMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(tracerMesh);
  setTimeout(() => { if (tracerMesh) { scene.remove(tracerMesh); tracerMesh = null; } }, 120);
  // hit the nearest staged enemy in front of Jay (simple distance check)
  let best = null, bestD = 14;
  for (const e of stagedEnemies) {
    if (!e.group.visible) continue;
    const d = e.group.position.distanceTo(jay.group.position);
    if (d < bestD) { bestD = d; best = e; }
  }
  if (best) {
    best.group.rotation.x = -1.2; // falls back
    best.group.position.y = 0.3;
    state.xp = Math.min(state.xpMax, state.xp + 40);
    HUD.setWanted(state.wanted, $('status-badge').textContent, '', `$${state.money}`, state.rank, state.xp, state.xpMax);
    Audio.blip(1200);
  }
}
function $(id) { return document.getElementById(id); }

// ---------- per-frame updates ----------
// Manual clock (THREE.Clock is deprecated in r186).
let lastT = performance.now();
let shotFrames = 0;
let walkPhase = 0;
let minimapTimer = 0;
let camPos = new THREE.Vector3(0, 4, -12);
let camLook = new THREE.Vector3(0, 1, 0);
let heliAngle = 0;

function updatePlayer(dt) {
  const fwd = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
  const strafe = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
  if (state.driving && state.car) {
    const car = state.car;
    const top = car.group.userData.spec.top / 3.6; // km/h -> m/s
    const accel = fwd > 0 ? 14 : fwd < 0 ? -20 : 0;
    state.speed += accel * dt;
    if (fwd === 0) state.speed = lerp(state.speed, 0, dt * 1.4);
    if (keys['Space']) state.speed = lerp(state.speed, 0, dt * 4); // handbrake
    state.speed = clamp(state.speed, -top * 0.45, top);
    const turn = strafe * 1.9 * clamp(Math.abs(state.speed) / 8, 0.25, 1) * Math.sign(state.speed || 1);
    car.group.rotation.y += turn * dt * (state.speed >= 0 ? 1 : -1);
    // drift: a little lateral slide when steering hard at speed
    const heading = car.group.rotation.y;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    car.group.position.x += fx * state.speed * dt;
    car.group.position.z += fz * state.speed * dt;
    // keep inside the island
    car.group.position.x = clamp(car.group.position.x, -295, 295);
    car.group.position.z = clamp(car.group.position.z, -295, 295);
    // spin wheels
    for (const w of car.group.userData.wheels) w.rotation.x += (state.speed * dt) / 0.34;
    // front wheels steer visually
    car.group.userData.wheels[0].rotation.y = strafe * 0.32;
    car.group.userData.wheels[1].rotation.y = strafe * 0.32;
    Audio.engineSet(Math.abs(state.speed) * 3.6, true);
    HUD.setVehicle({ speed: Math.round(Math.abs(state.speed) * 3.6) });
    // mission: reached the marker?
    if (state.mission.stage === 1) {
      const d = Math.hypot(car.group.position.x - MISSION_MARKER.x, car.group.position.z - MISSION_MARKER.z);
      if (d < 9) {
        state.mission.stage = 2; updateMissionHUD();
        HUD.setDialogue('NADIA · PALM & PISTON', '“Marker reached. Now lose them — full throttle.”', 'nadia', '#8a5a3a', '#1c1410');
        Audio.cashChime();
      }
    }
  } else {
    const sp = (keys['ShiftLeft'] || keys['ShiftRight']) ? 7 : 4;
    const moving = fwd !== 0 || strafe !== 0;
    if (moving) {
      const heading = jay.group.rotation.y;
      const mx = Math.sin(heading) * fwd + Math.cos(heading) * strafe;
      const mz = Math.cos(heading) * fwd - Math.sin(heading) * strafe;
      jay.group.position.x += mx * sp * dt;
      jay.group.position.z += mz * sp * dt;
      jay.group.position.x = clamp(jay.group.position.x, -295, 295);
      jay.group.position.z = clamp(jay.group.position.z, -295, 295);
      walkPhase += dt * sp * 2.2;
      walkCycle(jay, walkPhase, sp, sp > 5);
      // turn Jay with A/D when not strafing? keep heading fixed; camera follows.
      if (strafe !== 0 && fwd === 0) jay.group.rotation.y += strafe * 1.6 * dt;
    } else {
      walkCycle(jay, 0, 0, false);
    }
    Audio.engineSet(0, false);
  }
}

function updatePolice(dt) {
  if (state.wanted === 0 || state.mode !== 'play') {
    // park the cruisers out of the way when clear
    return;
  }
  const target = state.driving && state.car ? state.car.group.position : jay.group.position;
  const speed = 11 + state.wanted * 1.5;
  police.slice(0, 2).forEach((u, i) => {
    if (!u.group.visible) u.group.visible = true;
    const p = u.group.position;
    const dx = target.x - p.x, dz = target.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3.5) {
      // ram: shove the player and chip the car's condition
      if (state.driving && state.car) {
        state.speed = Math.max(0, state.speed - 6);
        HUD.setVehicle({ condition: 96 });
      }
      return;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - u.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    u.group.rotation.y += clamp(diff, -2.2 * dt, 2.2 * dt);
    p.x += Math.sin(u.group.rotation.y) * speed * dt;
    p.z += Math.cos(u.group.rotation.y) * speed * dt;
    // flashing light bar
    const t = state.time * 6 + i * 2;
    const on = Math.sin(t) > 0;
    if (u.group.userData.lightRed) {
      u.group.userData.lightRed.material.emissiveIntensity = on ? 3.5 : 0.4;
      u.group.userData.lightBlue.material.emissiveIntensity = on ? 0.4 : 3.5;
    }
  });
  // heli circles overhead at 3+ stars (kept visible at 1 star for the shot staging)
  const heli = police[2];
  if (state.wanted >= 1 && heli.group.visible) {
    heliAngle += dt * 0.25;
    heli.group.position.set(
      target.x + Math.cos(heliAngle) * 26,
      26,
      target.z + Math.sin(heliAngle) * 26);
    heli.rotor.rotation.y += dt * 22;
  }
  // wanted decays if the player is far from all cruisers
  if (state.mode === 'play') {
    const d0 = police[0].group.position.distanceTo(target);
    const d1 = police[1].group.position.distanceTo(target);
    if (Math.min(d0, d1) > 90) {
      state._clearT = (state._clearT || 0) + dt;
      if (state._clearT > 6) {
        state._clearT = 0;
        if (state.mission.stage === 2) {
          state.mission.done = true; state.money += 500; state.xp = Math.min(state.xpMax, state.xp + 200);
          updateMissionHUD();
          HUD.showToast('MISSION COMPLETE', 'First Wheels — $500 banked. The garage lives another day.');
          Audio.cashChime(); saveGame();
        }
        setWanted(0);
      }
    } else state._clearT = 0;
  }
}

function updateCamera(dt) {
  if (SHOT) return; // staged shots set the camera explicitly
  const target = state.driving && state.car ? state.car.group : jay.group;
  const heading = target.rotation.y;
  const back = state.driving ? 10.5 : 4.6;
  const up = state.driving ? 4.4 : 2.4;
  const desired = new THREE.Vector3(
    target.position.x - Math.sin(heading) * back,
    up,
    target.position.z - Math.cos(heading) * back);
  camPos.lerp(desired, 1 - Math.pow(0.001, dt));
  const look = new THREE.Vector3(
    target.position.x + Math.sin(heading) * 6,
    state.driving ? 1.4 : 1.5,
    target.position.z + Math.cos(heading) * 6);
  camLook.lerp(look, 1 - Math.pow(0.0005, dt));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

function updateMinimap() {
  const target = state.driving && state.car ? state.car.group.position : jay.group.position;
  const heading = state.driving && state.car ? state.car.group.rotation.y : jay.group.rotation.y;
  HUD.drawMinimap({
    player: { x: target.x, z: target.z, heading },
    police: police.slice(0, 2).filter((u) => u.group.visible).map((u) => ({ x: u.group.position.x, z: u.group.position.z, color: '#ff2a1a' })),
    marker: state.mission.stage === 1 && !state.mission.done ? MISSION_MARKER : null,
  });
}

// ---------- main loop ----------
function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  state.time += dt;
  if (state.mode === 'play' || SHOT) {
    if (!SHOT) updatePlayer(dt);
    traffic.update(dt);
    pedestrians.update(dt);
    // staged pedestrians / mid actors idle-sway (only in shot mode)
    if (SHOT) {
      for (const w of stagedPeds) if (w.p.group.visible) { w.phase += dt * 2; walkCycle(w.p, w.phase, 3, w.fleeing); }
      for (const w of midPeds) if (w.p.group.visible) { w.phase += dt * 2; walkCycle(w.p, w.phase, 1.5, false); }
    }
    updatePolice(dt);
    // water ripples breathe
    for (const r of cityRefs.ripples) {
      const s = 1 + 0.6 * Math.sin(state.time * 0.9 + r.userData.phase);
      r.scale.setScalar(s);
      r.material.opacity = 0.32 - 0.12 * Math.sin(state.time * 0.9 + r.userData.phase);
    }
    // mission marker bobs
    markerMesh.position.y = 6 + Math.sin(state.time * 2) * 0.6;
    markerMesh.rotation.y += dt * 1.2;
    markerMesh.visible = state.mission.stage === 1 && !state.mission.done && state.mode === 'play';
    if (markerMesh.userData.beam) markerMesh.userData.beam.visible = markerMesh.visible;
    Audio.sirenUpdate(dt);
    minimapTimer += dt;
    if (minimapTimer > 0.12) { minimapTimer = 0; updateMinimap(); }
  }
  if (!SHOT) updateCamera(dt);
  renderFrame();
  if (SHOT) {
    if (!window.__shotReady) window.__shotReady = true;
    shotFrames++;
    if (shotFrames >= 3) return; // frame is stable; stop so the capture tool is not starved
  }
  requestAnimationFrame(animate);
}

// ---------- boot ----------
if (SHOT) {
  state.mode = 'shot';
  setupShot(SHOT, G);
  animate();
} else {
  // start screen: keep the world visible behind it (a slow orbit for the backdrop)
  camera.position.set(30, 14, -30);
  camera.lookAt(0, 4, 0);
  animate();
}
