// SAN AMARO — entry point. Renderer, sunset sky, lights, game state,
// input, third-person walk/drive, SAMPD pursuit, the First Wheels mission,
// save/load, and the staged screenshot mode (?shot=1..4).
// Written from scratch from the re-author spec.
const THREE = globalThis.THREE;
import { buildCity } from './city.js';
import { zoneFor, STREETS } from './city-layout.js';
import { buildCar, makeTraffic, makeParked, makePolice, setAirPitch } from './vehicles.js';
import { buildJay, buildNadia, buildTheo, buildMara, buildPerson, walkCycle, aimPose, buildRifle, makePedestrians } from './people.js';
import { MISSIONS, rankFor, XP_MAX } from './missions.js';
import * as HUD from './hud.js';
import * as Audio from './audio.js';
import { setupShot } from './shots.js';

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const params = new URLSearchParams(location.search);
const SHOT = params.has('shot') ? clamp(parseInt(params.get('shot') || '1', 10) || 1, 1, 24) : 0;
window.__shotReady = false;
window.__shot = SHOT;

// ---------- lighting moods ----------
// The old look was ONE mood: a hard golden hour whose pink sun, pink fog,
// pink hemisphere and orange CSS grade washed the whole city red — the #1
// visual complaint (every screenshot read as one red wall, details
// drowned). Now four moods, chosen with ?mood=day|golden|bluehour|night
// (default golden, tamed). Each mood sets the sky shader, fog, sun,
// hemisphere, ambient, environment cube and the DOM grade overlay
// (index.html reads documentElement.dataset.mood).
const MOODS = {
  day: {
    sunDir: [0.35, 0.72, 0.45], skyTop: [0.20, 0.42, 0.78], skyMid: [0.55, 0.70, 0.92], skyHor: [0.88, 0.90, 0.96], skyBelow: [0.35, 0.38, 0.42],
    sunTint: [1.0, 0.95, 0.80], sunCore: [1.0, 0.98, 0.90],
    sunColor: 0xfff2d8, sunIntensity: 2.3, hemiSky: 0xbfd8ff, hemiGround: 0x707a68, hemiIntensity: 0.95,
    ambColor: 0xdfe8ff, ambIntensity: 0.45, fog: 0x9ab8d4, exposure: 1.0,
    envSide: ['#5a7ab0', '#a0c0e8', '#7a9ac8'], envTop: ['#3a5a9a', '#5a7ab0', '#7a9ac8'], envBot: ['#3a3a42', '#4a4a52', '#5a5248'],
    spriteColor: 0xfff6d8, spriteOpacity: 0.5, spriteScale: 140,
    dayLabel: 'DAY 1 · 11:40', moodLabel: 'MIDDAY',
  },
  golden: {
    sunDir: [-0.78, 0.20, 0.42], skyTop: [0.14, 0.10, 0.30], skyMid: [0.85, 0.45, 0.52], skyHor: [0.98, 0.52, 0.40], skyBelow: [0.16, 0.10, 0.20],
    sunTint: [1.0, 0.50, 0.36], sunCore: [1.0, 0.75, 0.55],
    sunColor: 0xffb080, sunIntensity: 1.9, hemiSky: 0xffb090, hemiGround: 0x2a2438, hemiIntensity: 0.85,
    ambColor: 0xff8a7a, ambIntensity: 0.30, fog: 0xc98a8e, exposure: 1.05,
    envSide: ['#4a3a6a', '#e86a8a', '#d86a7a'], envTop: ['#2a1a4a', '#3a2a5a', '#5a3a6a'], envBot: ['#1a1218', '#241a20', '#2a1a16'],
    spriteColor: 0xffe0a0, spriteOpacity: 0.7, spriteScale: 180,
    dayLabel: 'DAY 1 · 18:25', moodLabel: 'GOLDEN HOUR',
  },
  bluehour: {
    sunDir: [-0.75, 0.08, 0.45], skyTop: [0.05, 0.08, 0.25], skyMid: [0.28, 0.22, 0.52], skyHor: [0.72, 0.38, 0.52], skyBelow: [0.08, 0.07, 0.16],
    sunTint: [1.0, 0.45, 0.35], sunCore: [1.0, 0.65, 0.45],
    sunColor: 0xff8a50, sunIntensity: 1.1, hemiSky: 0x5a6ab0, hemiGround: 0x1a1a28, hemiIntensity: 0.7,
    ambColor: 0x4a5a8a, ambIntensity: 0.35, fog: 0x50506e, exposure: 1.0,
    envSide: ['#2a2a55', '#4a3a6a', '#5a4a7a'], envTop: ['#1a1a3a', '#2a2a55', '#3a3a6a'], envBot: ['#0e0e18', '#141420', '#1a1620'],
    spriteColor: 0xffb080, spriteOpacity: 0.6, spriteScale: 160,
    dayLabel: 'DAY 1 · 19:40', moodLabel: 'BLUE HOUR',
  },
  night: {
    sunDir: [0.3, 0.55, -0.4], skyTop: [0.01, 0.02, 0.08], skyMid: [0.05, 0.07, 0.18], skyHor: [0.14, 0.11, 0.24], skyBelow: [0.03, 0.03, 0.07],
    sunTint: [0.6, 0.7, 1.0], sunCore: [0.8, 0.85, 1.0],
    sunColor: 0x9ab0ff, sunIntensity: 0.55, hemiSky: 0x2a3a6a, hemiGround: 0x0a0a12, hemiIntensity: 0.65,
    ambColor: 0x1a2038, ambIntensity: 0.4, fog: 0x14142a, exposure: 1.0,
    envSide: ['#14142a', '#1e1e3a', '#2a2a4a'], envTop: ['#0a0a1a', '#14142a', '#1e1e3a'], envBot: ['#08080f', '#0c0c14', '#101018'],
    spriteColor: 0xc8d8ff, spriteOpacity: 0.5, spriteScale: 90,
    dayLabel: 'DAY 1 · 22:15', moodLabel: 'NIGHT',
  },
};
// ?mood= wins (the shot harness), else the saved Settings choice, else golden.
const MOOD = ['day', 'golden', 'bluehour', 'night'].includes(params.get('mood') || '')
  ? params.get('mood')
  : (['day', 'golden', 'bluehour', 'night'].includes(localStorage.getItem('san-amaro-mood') || '') ? localStorage.getItem('san-amaro-mood') : 'golden');
let MOODDEF = MOODS[MOOD];
// Live refs for applyMood (Settings): the sky material + sun sprite are
// created in the block below and reassigned here so the mood can change
// at runtime without a reload.
let skyMat = null;
let sunSprite = null;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = MOODDEF.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(MOODDEF.fog, 90, 780);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 4, -12);

// ---------- sunset sky (gradient dome + sun glow) + environment ----------
const SUN_DIR = new THREE.Vector3(...MOODDEF.sunDir).normalize();
{
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      sunDir: { value: SUN_DIR },
      skyTop: { value: new THREE.Vector3(...MOODDEF.skyTop) },
      skyMid: { value: new THREE.Vector3(...MOODDEF.skyMid) },
      skyHor: { value: new THREE.Vector3(...MOODDEF.skyHor) },
      skyBelow: { value: new THREE.Vector3(...MOODDEF.skyBelow) },
      sunTint: { value: new THREE.Vector3(...MOODDEF.sunTint) },
      sunCore: { value: new THREE.Vector3(...MOODDEF.sunCore) },
    },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
      uniform vec3 skyTop; uniform vec3 skyMid; uniform vec3 skyHor; uniform vec3 skyBelow;
      uniform vec3 sunTint; uniform vec3 sunCore;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(skyHor, skyMid, smoothstep(0.02, 0.28, h));
        col = mix(col, skyTop, smoothstep(0.22, 0.68, h));
        col = mix(skyBelow, col, smoothstep(-0.08, 0.02, h));
        float s = max(dot(d, sunDir), 0.0);
        col += sunTint * pow(s, 18.0) * 0.45;
        col += sunCore * pow(s, 220.0) * 1.3;
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
  grad.addColorStop(0.35, 'rgba(255,120,90,.7)');
  grad.addColorStop(1, 'rgba(255,80,80,0)');
  gg.fillStyle = grad; gg.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(gc);
  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: MOODDEF.spriteOpacity, color: MOODDEF.spriteColor }));
  sunSprite.position.copy(SUN_DIR).multiplyScalar(820);
  sunSprite.scale.set(MOODDEF.spriteScale, MOODDEF.spriteScale, 1);
  scene.add(sunSprite);
}
// environment (warm gradient cube) so water + car paint reflect the mood.
// Factored out so applyMood can rebuild it live.
function makeEnvCube(def) {
  const mk = (top, mid, bot) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    return c;
  };
  const side = mk(...def.envSide);
  const topF = mk(...def.envTop);
  const botF = mk(...def.envBot);
  const cube = new THREE.CubeTexture([side, side, topF, botF, side, side]);
  cube.needsUpdate = true;
  return cube;
}
scene.environment = makeEnvCube(MOODDEF);

// ---------- lights ----------
const sun = new THREE.DirectionalLight(MOODDEF.sunColor, MOODDEF.sunIntensity);
sun.position.copy(SUN_DIR).multiplyScalar(320);
scene.add(sun);
const hemi = new THREE.HemisphereLight(MOODDEF.hemiSky, MOODDEF.hemiGround, MOODDEF.hemiIntensity);
scene.add(hemi);
const amb = new THREE.AmbientLight(MOODDEF.ambColor, MOODDEF.ambIntensity);
scene.add(amb);

// Apply a mood live (Settings menu): sky, fog, sun, lights, env, grade.
// The env cube is rebuilt so reflections follow the mood too. The choice
// is saved, so the mood persists across reloads (until ?mood= overrides).
function applyMood(mood) {
  if (!MOODS[mood]) return;
  const def = MOODS[mood];
  MOODDEF = def;
  renderer.toneMappingExposure = def.exposure;
  scene.fog.color.set(def.fog);
  const dir = new THREE.Vector3(...def.sunDir).normalize();
  if (skyMat) {
    const u = skyMat.uniforms;
    u.sunDir.value.copy(dir);
    u.skyTop.value.set(...def.skyTop);
    u.skyMid.value.set(...def.skyMid);
    u.skyHor.value.set(...def.skyHor);
    u.skyBelow.value.set(...def.skyBelow);
    u.sunTint.value.set(...def.sunTint);
    u.sunCore.value.set(...def.sunCore);
  }
  if (sunSprite) {
    sunSprite.position.copy(dir).multiplyScalar(820);
    sunSprite.material.opacity = def.spriteOpacity;
    sunSprite.material.color.set(def.spriteColor);
    sunSprite.scale.set(def.spriteScale, def.spriteScale, 1);
  }
  sun.color.set(def.sunColor);
  sun.intensity = def.sunIntensity;
  sun.position.copy(dir).multiplyScalar(320);
  hemi.color.set(def.hemiSky);
  hemi.groundColor.set(def.hemiGround);
  hemi.intensity = def.hemiIntensity;
  amb.color.set(def.ambColor);
  amb.intensity = def.ambIntensity;
  scene.environment = makeEnvCube(def);
  document.documentElement.dataset.mood = mood;
  window.__mood = mood;
  const dayLine = document.getElementById('day-line');
  const goldenLine = document.getElementById('golden-line');
  if (dayLine) dayLine.textContent = def.dayLabel;
  if (goldenLine) goldenLine.textContent = def.moodLabel;
  try { localStorage.setItem('san-amaro-mood', mood); } catch {}
}

// HUD time-of-day label + DOM mood class (drives the CSS grade overlay in
// index.html) + the mood handle the capture harness reads.
document.documentElement.dataset.mood = MOOD;
window.__mood = MOOD;
{
  const dayLine = document.getElementById('day-line');
  const goldenLine = document.getElementById('golden-line');
  if (dayLine) dayLine.textContent = MOODDEF.dayLabel;
  if (goldenLine) goldenLine.textContent = MOODDEF.moodLabel;
}

// ---------- bloom (real, via the vendored bundle) — falls back to direct render ----------
let composer = null;
try {
  const { EffectComposer, RenderPass, UnrealBloomPass, OutputPass } = THREE;
  if (EffectComposer && UnrealBloomPass) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Calm bloom: the old threshold (0.5) let every lit window bloom into
    // a glowing wall. 0.8 keeps the bloom on the sun / muzzle flash /
    // police lights only, so the buildings stay readable at golden hour.
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2)),
      0.22, 0.55, 0.8);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
} catch (e) {
  composer = null;
}
let bloomOn = true; // Settings toggle: bloom on/off
function renderFrame() {
  if (composer && bloomOn) composer.render();
  else renderer.render(scene, camera);
}
function setBloom(on) { bloomOn = !!on; }

// ---------- build the world ----------
const cityRefs = buildCity(scene);
// The city validation result (0 violations) — exposed for the HUD badge,
// the shot harness, and the kit check.
window.__cityValidation = cityRefs.cityValidation;
window.__citySummary = cityRefs.citySummary;
HUD.setCityBadge(cityRefs.cityBadge, cityRefs.cityValidation.passed);
const traffic = makeTraffic(scene, 30);
const parked = makeParked(scene, cityRefs.layout.parking, 18);
const pedestrians = makePedestrians(scene, 60, cityRefs.layout);
pedestrians.setFleeing(false);
const police = makePolice(scene);
// Extra pursuit units (hidden until wanted >= 3) and the roadblock pair
// (hidden until wanted >= 4). Real police cars, not HUD props — they use
// the same chase/ram code as BAY-12 and VICTOR-7.
const extraCruisers = [];
for (let i = 0; i < 2; i++) {
  const c = buildCar('police');
  c.group.visible = false;
  scene.add(c.group);
  extraCruisers.push({ call: i === 0 ? 'DELTA-5' : 'ECHO-9', kind: 'cruiser', group: c.group, speed: 0 });
}
const roadblockCars = [];
for (let i = 0; i < 2; i++) {
  const c = buildCar('police');
  c.group.visible = false;
  scene.add(c.group);
  roadblockCars.push(c);
}
let roadblockActive = false;
let roadblockT = 0;

// Jay (player on foot) + Nadia (at the garage, for staging)
const jay = buildJay();
jay.group.position.set(0, 0, 12);
scene.add(jay.group);
const nadia = buildNadia();
nadia.group.position.set(-14, 0, 26);
nadia.group.rotation.y = 0.6;
scene.add(nadia.group);
// Theo (race driver) and Mara (the fixer) — real crew with 3D presence,
// not just HUD portraits. Theo waits near the race gates in Commercial;
// Mara waits at the Glass Spire (job 5 picks her up there).
const theo = buildTheo();
theo.group.position.set(60, 0, -60);
theo.group.rotation.y = -0.8;
scene.add(theo.group);
const mara = buildMara();
mara.group.position.set(90, 0, -90);
mara.group.rotation.y = 2.4;
scene.add(mara.group);

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
// Live enemies (real combat targets in normal play — spawned by shootout
// missions, never by the staged screenshot mode).
const enemies = [];
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
  playerCar, sedanCar, prizeCar, jay, nadia, theo, mara,
  police, traffic, pedestrians, parked,
  stagedPeds, stagedEnemies, midTraffic, midPeds,
  shotProps: [], minimapState: null,
};

// ---------- game state ----------
// Save slots: three independent slots, all on the same v2 format.
// The old v1 key is read once for migration and never written again.
const SAVE_KEY_BASE = 'san-amaro-save-v2';
const SAVE_KEY_V1 = 'san-amaro-save-v1';
let saveSlot = 0; // 0..2 — the active slot (the menu lets the player pick)
function saveKey(slot = saveSlot) { return `${SAVE_KEY_BASE}-slot${slot + 1}`; }
const state = {
  mode: 'start', // 'start' | 'play' | 'shot'
  driving: false,
  car: null, // the car the player is driving (playerCar or sedanCar)
  speed: 0, // m/s
  nitro: 100, // 0-100: the boost bar (hold Shift while driving to burn it)
  steer: 0,
  wanted: 0,
  money: 250,
  xp: 0, rank: 'NOBODY', xpMax: XP_MAX,
  hp: 100, armor: 0,
  mission: { job: 0, stage: 0, done: false, gate: 0 }, // job = index into MISSIONS, stage = stage within the job, gate = race gate index
  weapon: 0,
  carId: null, // 'comet' | 'sedan' | 'prize' — which car is being driven
  // ammo: [fists (no ammo), pistol, smg, scattergun, longshot] — {mag, reserve}
  ammo: [null, { mag: 12, res: 48 }, { mag: 32, res: 128 }, { mag: 6, res: 18 }, { mag: 24, res: 96 }],
  unlocked: 2, // weapon slots 0..unlocked-1 are usable (FISTS + P9 PISTOL)
  fireCd: 0, reloadUntil: 0,
  heatT: 0, // sustained-pursuit timer: feeds wanted escalation
  lastDamageT: -99, // when Jay last took damage (health regen grace)
  missionT: 0, // elapsed seconds in the current job (par timer)
  radio: 0,
  busted: false,
  time: 0,
};
// Live debug handle (read-only snapshot): lets a test harness — or the
// player in the console — inspect the running game without touching it.
// Used by the kit check and by the rebuild's gameplay test.
window.__game = {
  get state() { return state; },
  get mode() { return state.mode; },
  get missionJob() { return state.mission.job; },
  get missionStage() { return state.mission.stage; },
  get missionDone() { return state.mission.done; },
  get jobTitle() { const j = MISSIONS[state.mission.job]; return j ? j.title : null; },
  get nitro() { return Math.round(state.nitro); },
  get speedKmh() { return Math.round(Math.abs(state.speed) * 3.6); },
  get driving() { return state.driving; },
  get wanted() { return state.wanted; },
  get money() { return state.money; },
  get xp() { return state.xp; },
  get xpMax() { return state.xpMax; },
  get rank() { return state.rank; },
  get hp() { return state.hp; },
  get armor() { return state.armor; },
  get unlocked() { return state.unlocked; },
  get ammo() { const a = state.ammo[state.weapon]; return a ? `${a.mag}/${a.res}` : '—'; },
  get condition() { return state.car ? (state.car.group.userData.condition ?? 100) : null; },
  get enemiesAlive() { return enemies.filter((e) => e.alive).length; },
  get cruisersActive() { return activeCruisers().length; },
  get roadblock() { return roadblockActive; },
  get player() { return { x: +jay.group.position.x.toFixed(1), z: +jay.group.position.z.toFixed(1) }; },
  get car() { return state.car ? { x: +state.car.group.position.x.toFixed(1), z: +state.car.group.position.z.toFixed(1) } : null; },
  get district() { const el = document.getElementById('district'); return el ? el.textContent : null; },
  get street() { const el = document.getElementById('street'); return el ? el.textContent : null; },
  // Police distance (min of the two cruisers) + the evade timer, for the
  // mission test: confirms the evade is actually accumulating.
  get policeDist() {
    const t = state.driving && state.car ? state.car.group.position : jay.group.position;
    const ds = activeCruisers().map((u) => u.group.position.distanceTo(t));
    return ds.length ? +Math.min(...ds).toFixed(1) : null;
  },
  get clearT() { return +(state._clearT || 0).toFixed(2); },
  set clearT(v) { state._clearT = v; },
  // Test/debug teleport: puts the driven car (or Jay on foot) at (x, z).
  // Used by the rebuild's gameplay test to reach the mission marker
  // without a 6-minute drive at headless SwiftShader frame rates.
  teleport(x, z) {
    const target = state.car ? state.car.group : jay.group;
    target.position.x = x; target.position.z = z;
    return { x, z };
  },
  // Test/debug aim: rotate the driven car (or Jay on foot) to face (x, z),
  // so the camera looks at the point — used to test shooting at enemies.
  face(x, z) {
    const target = state.car ? state.car.group : jay.group;
    target.rotation.y = Math.atan2(x - target.position.x, z - target.position.z);
    return +target.rotation.y.toFixed(3);
  },
};
let markerMesh = null;
{
  markerMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.1),
    new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xffd23e, emissiveIntensity: 2.2 }));
  markerMesh.position.set(120, 6, 0); // default; setStageMarker repositions it
  scene.add(markerMesh);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 40, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(120, 20, 0);
  scene.add(beam);
  markerMesh.userData.beam = beam;
}

function saveGame(slot = saveSlot) {
  try {
    localStorage.setItem(saveKey(slot), JSON.stringify({
      money: state.money, xp: state.xp, rank: state.rank,
      mission: state.mission,
      pos: [jay.group.position.x, jay.group.position.z],
      driving: state.driving,
      car: state.car ? {
        type: state.carId,
        x: state.car.group.position.x, z: state.car.group.position.z,
        rot: state.car.group.rotation.y,
        condition: state.car.group.userData.condition ?? 100,
      } : null,
      wanted: state.wanted, hp: state.hp, armor: state.armor,
      ammo: state.ammo, unlocked: state.unlocked,
      slot,
    }));
  } catch {}
}
function loadGame(slot = saveSlot) {
  try {
    let raw = localStorage.getItem(saveKey(slot));
    let d = raw ? JSON.parse(raw) : null;
    if (!d) {
      // one-time migration from the v1 single-slot save
      raw = localStorage.getItem(SAVE_KEY_V1);
      if (!raw) return false;
      d = JSON.parse(raw);
      d.mission = { job: 0, stage: d.mission?.stage ?? 0, done: d.mission?.done ?? false };
    }
    state.money = d.money ?? 250; state.xp = d.xp ?? 0;
    state.rank = d.rank ?? rankFor(state.xp);
    state.mission = d.mission ?? { job: 0, stage: 0, done: false };
    state.hp = d.hp ?? 100; state.armor = d.armor ?? 0;
    state.wanted = d.wanted ?? 0;
    if (d.ammo) state.ammo = d.ammo;
    if (d.unlocked !== undefined) state.unlocked = d.unlocked;
    if (d.pos) jay.group.position.set(d.pos[0], 0, d.pos[1]);
    // restore the car + driving state: a loaded game resumes the drive
    if (d.driving && d.car) {
      const car = d.car.type === 'prize' ? prizeCar : d.car.type === 'sedan' ? sedanCar : playerCar;
      car.group.visible = true;
      car.group.position.set(d.car.x, 0, d.car.z);
      car.group.rotation.y = d.car.rot ?? 0;
      car.group.userData.condition = d.car.condition ?? 100;
      state.driving = true; state.car = car; state.carId = d.car.type;
      jay.group.visible = false;
    } else {
      state.driving = false; state.car = null; state.carId = null;
      jay.group.visible = true;
    }
    state.speed = 0;
    return true;
  } catch { return false; }
}

// ---------- progression / damage helpers ----------
function wantedLabel() {
  return state.wanted === 0 ? 'CLEAR' : `IN PURSUIT · ${Math.max(1, state.wanted)} UNIT${state.wanted > 1 ? 'S' : ''}`;
}
function refreshStatsHUD() {
  HUD.setWanted(state.wanted, wantedLabel(), state.wanted === 0 ? 'clear' : '', `$${state.money}`, state.rank, state.xp, state.xpMax);
}
function addXP(n) {
  state.xp = Math.min(state.xpMax, state.xp + n);
  const r = rankFor(state.xp);
  if (r !== state.rank) { state.rank = r; HUD.showToast('RANK UP', r, 3000); }
  refreshStatsHUD();
}
function addMoney(n) {
  state.money = Math.max(0, state.money + n);
  refreshStatsHUD();
}
// Car damage: condition lives on the car (userData.condition, 0-100).
// Returns the new condition. A wrecked car still drives, slowly.
function damageCar(car, amount) {
  const cur = car.group.userData.condition ?? 100;
  const next = clamp(cur - amount, 0, 100);
  car.group.userData.condition = next;
  if (state.car === car) HUD.setVehicle({ condition: Math.round(next) });
  return next;
}
// Player damage: armor absorbs first, then health. HP 0 = busted.
function damagePlayer(amount) {
  if (state.mode !== 'play') return;
  let rest = amount;
  if (state.armor > 0) {
    const absorbed = Math.min(state.armor, rest);
    state.armor -= absorbed; rest -= absorbed;
  }
  if (rest > 0) state.hp = Math.max(0, state.hp - rest);
  state.lastDamageT = state.time;
  HUD.setHealth(Math.round(state.hp), Math.round(state.armor));
  if (state.hp <= 0) busted();
}
function busted() {
  if (state.mode !== 'play') return;
  state.money = Math.max(0, state.money - 100);
  setWanted(0);
  state.hp = 100;
  HUD.setHealth(100, Math.round(state.armor));
  // respawn at the garage, on foot (carId stays: it is the last car driven)
  if (state.driving) { state.driving = false; state.car = null; state.speed = 0; }
  jay.group.visible = true;
  jay.group.position.set(0, 0, 12);
  jay.group.rotation.y = 0;
  HUD.showToast('BUSTED', 'The SAMPD got you. $100 bail.', 3000);
  refreshStatsHUD();
  if (!state.mission.done) failJob('Busted by the SAMPD');
  saveGame();
}

// ---------- HUD init ----------
HUD.buildStars(); HUD.buildWeapons();
HUD.setWeapon(0); HUD.lockWeapons(state.unlocked);
refreshAmmoHUD();
HUD.setCrew([
  { name: 'NADIA', style: 'nadia', skin: '#8a5a3a', hair: '#1c1410' },
  { name: 'THEO', style: 'theo', skin: '#e8b88a', hair: '#8a8a8a' },
  { name: 'MARA', style: 'mara', skin: '#f2c9a0', hair: '#e8c85a' },
]);
updateMissionHUD();
refreshStatsHUD();
setPoliceInitial();
HUD.setVehicle({ name: 'COMET GT · SPORTS', speed: 0, condition: 100, nitro: 100 });
HUD.setDialogue('NADIA · PALM & PISTON', '“You break it, you bought it. Now go get us a car.”', 'nadia', '#8a5a3a', '#1c1410');
HUD.setHealth(100, 0);

// ---------- input ----------
const keys = {};
let mouseDown = false;
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  Audio.initAudio(); Audio.resumeAudio();
  if (e.code === 'Enter' && state.mode === 'start') newGame();
  if (e.code === 'Escape') {
    // close an open overlay first, then toggle the pause menu
    if (!$('controls-page').classList.contains('hidden')) { closeControls(); return; }
    if (!$('settings-page').classList.contains('hidden')) { closeSettings(); return; }
    if (state.mode === 'play' || state.mode === 'pause') { togglePause(); return; }
  }
  if (state.mode !== 'play') return;
  if (e.code === 'KeyE') tryEnterExitCar();
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= 5) {
      if (n - 1 >= state.unlocked) {
        HUD.showToast('LOCKED', 'Complete more jobs to unlock this weapon.', 2000);
        return;
      }
      state.weapon = n - 1; HUD.setWeapon(state.weapon); Audio.blip(660 + n * 90);
    }
  }
  if (e.code === 'KeyR') {
    state.radio = (state.radio + 1) % 3;
    const [track, genre] = Audio.radioTracks(state.radio);
    HUD.setVehicle({ station: Audio.radioStationName(state.radio), track, genre });
    Audio.radioStart(state.radio); Audio.blip(990);
  }
  if (e.code === 'KeyM') saveGame();
  // Palm & Piston garage services (on foot, near Nadia only)
  if (e.code === 'KeyF' && nearGarage()) garageRepair();
  if (e.code === 'KeyG' && nearGarage()) garageArmor();
  if (e.code === 'KeyH' && nearGarage()) garageAmmo();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('mousedown', () => {
  mouseDown = true;
  Audio.initAudio(); Audio.resumeAudio();
  if (state.mode === 'play' && !state.driving) fireWeapon();
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
  Audio.initAudio(); Audio.resumeAudio(); Audio.engineStart(); Audio.radioStart(0); Audio.ambienceStart();
  startEl.style.display = 'none';
  HUD.showHUD();
  state.mode = 'play';
  if (!continued) {
    // fresh game: reset progression + mission, car at the lot
    state.money = 250; state.xp = 0; state.rank = 'NOBODY';
    state.mission = { job: 0, stage: 0, done: false, gate: 0 };
    state.missionT = 0; state.hp = 100; state.armor = 0;
    state.wanted = 0; state.unlocked = 2;
    state.ammo = [null, { mag: 12, res: 48 }, { mag: 32, res: 128 }, { mag: 6, res: 18 }, { mag: 24, res: 96 }];
    state.driving = false; state.car = null; state.carId = null; state.speed = 0;
    jay.group.visible = true;
    jay.group.position.set(0, 0, 12);
    jay.group.rotation.y = 0;
    playerCar.group.userData.condition = 100;
    sedanCar.group.userData.condition = 100;
    prizeCar.group.visible = false;
    setWanted(0);
    setPoliceInitial();
    HUD.setWeapon(0); HUD.lockWeapons(state.unlocked);
    refreshAmmoHUD();
    refreshStatsHUD();
    saveGame(); // New Game overwrites the selected slot right away
  } else {
    // continued: the save already restored money/xp/mission/car/wanted.
    setPoliceInitial();
    refreshStatsHUD();
    refreshAmmoHUD();
    HUD.setWeapon(state.weapon);
    HUD.lockWeapons(state.unlocked);
    HUD.setHealth(Math.round(state.hp), Math.round(state.armor));
    if (state.driving && state.car) {
      HUD.setVehicle({ name: `${state.car.group.userData.spec.name} · ${state.car.group.userData.spec.kind}`, condition: Math.round(state.car.group.userData.condition ?? 100), nitro: Math.round(state.nitro) });
    }
    // if the save had a wanted level, put the cruisers near the player
    if (state.wanted > 0) {
      const p = state.driving && state.car ? state.car.group.position : jay.group.position;
      activeCruisers().forEach((u, i) => {
        u.group.visible = true;
        u.group.position.set(p.x + (i % 2 ? 30 : -30), 0, p.z + (i < 2 ? -30 : 30));
      });
    }
  }
  // (re-)enter the current stage so its marker / enemies / person are live
  enterStage();
  updateMissionHUD();
  setStageMarker();
  refreshSlotTexts();
}
// Refresh the start-screen save-slot labels from localStorage.
function refreshSlotTexts() {
  document.querySelectorAll('#start .slot-save').forEach((s, i) => {
    let d = null;
    try { const raw = localStorage.getItem(saveKey(i)); d = raw ? JSON.parse(raw) : null; } catch {}
    if (d) {
      const job = d.mission && !d.mission.done ? (d.mission.job + 1) : 7;
      s.innerHTML = `<b>SLOT ${i + 1} · SAN AMARO</b>Job ${job}/7 · $${d.money} · ${d.rank || 'NOBODY'}`;
    } else {
      s.innerHTML = `<b>SLOT ${i + 1} · EMPTY</b>No save yet`;
    }
  });
}
refreshSlotTexts();
// ---------- menus: main-menu slots, pause menu, controls, settings ----------
// Save-slot selection: click a slot to select it (the slot New Game /
// Continue uses). Slot 1 is the default.
let selectedSlot = 0;
function hasSave(slot) {
  try { return !!localStorage.getItem(saveKey(slot)); } catch { return false; }
}
function selectSlot(i) {
  selectedSlot = i;
  saveSlot = i;
  document.querySelectorAll('#start .slot-save').forEach((s, k) => s.classList.toggle('sel', k === i));
}
document.querySelectorAll('#start .slot-save').forEach((s, i) => {
  s.addEventListener('click', () => selectSlot(i));
});
selectSlot(0);

// Confirm dialog (New Game over an existing save). The old save is never
// deleted without the player's explicit yes.
let confirmAction = null;
function showConfirm(title, text, onYes) {
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  confirmAction = onYes;
  $('confirm-box').classList.remove('hidden');
}
function hideConfirm() {
  $('confirm-box').classList.add('hidden');
  confirmAction = null;
}
document.getElementById('btn-confirm-yes').addEventListener('click', () => {
  const fn = confirmAction;
  hideConfirm();
  if (fn) fn();
});
document.getElementById('btn-confirm-no').addEventListener('click', hideConfirm);

function newGame() {
  if (hasSave(selectedSlot)) {
    showConfirm('Overwrite save?', `Slot ${selectedSlot + 1} already has a save. Starting a new game erases it.`, () => startGame(false));
  } else startGame(false);
}
document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-continue').addEventListener('click', () => {
  if (!hasSave(selectedSlot)) {
    HUD.showToast('NO SAVE YET', `Slot ${selectedSlot + 1} is empty — start a new game first.`, 2500);
    return;
  }
  saveSlot = selectedSlot;
  const ok = loadGame(selectedSlot);
  startGame(true);
  if (!ok) HUD.showToast('NO SAVE YET', 'Start a new game first.', 2000);
});

// Controls page (real page, not a toast). Back returns to wherever it
// was opened from (main menu or pause menu).
function openControls() { $('controls-page').classList.remove('hidden'); }
function closeControls() { $('controls-page').classList.add('hidden'); }
document.getElementById('btn-controls').addEventListener('click', openControls);
document.getElementById('btn-controls-back').addEventListener('click', closeControls);
document.getElementById('btn-pause-controls').addEventListener('click', openControls);

// Settings page: time of day (live), sound, bloom. Mood + sound persist.
function syncSettingsUI() {
  document.querySelectorAll('#set-mood button').forEach((b) => b.classList.toggle('on', b.dataset.mood === window.__mood));
  document.querySelectorAll('#set-sound button').forEach((b) => b.classList.toggle('on', (b.dataset.sound === 'off') === Audio.isMuted()));
  document.querySelectorAll('#set-bloom button').forEach((b) => b.classList.toggle('on', (b.dataset.bloom === 'off') === !bloomOn));
}
function openSettings() { syncSettingsUI(); $('settings-page').classList.remove('hidden'); }
function closeSettings() { $('settings-page').classList.add('hidden'); }
document.querySelectorAll('#set-mood button').forEach((b) => {
  b.addEventListener('click', () => { applyMood(b.dataset.mood); syncSettingsUI(); });
});
document.querySelectorAll('#set-sound button').forEach((b) => {
  b.addEventListener('click', () => {
    const off = b.dataset.sound === 'off';
    Audio.setMuted(off);
    try { localStorage.setItem('san-amaro-muted', off ? '1' : '0'); } catch {}
    syncSettingsUI();
  });
});
document.querySelectorAll('#set-bloom button').forEach((b) => {
  b.addEventListener('click', () => {
    setBloom(b.dataset.bloom === 'on');
    try { localStorage.setItem('san-amaro-bloom', b.dataset.bloom === 'on' ? '1' : '0'); } catch {}
    syncSettingsUI();
  });
});
document.getElementById('btn-settings').addEventListener('click', openSettings);
document.getElementById('btn-settings-back').addEventListener('click', closeSettings);
// restore saved sound / bloom choices at boot
try { if (localStorage.getItem('san-amaro-muted') === '1') Audio.setMuted(true); } catch {}
try { if (localStorage.getItem('san-amaro-bloom') === '0') setBloom(false); } catch {}

// Pause menu (ESC): city map + player profile, all buttons working.
function togglePause() {
  if (state.mode === 'play') {
    state.mode = 'pause';
    populatePauseMenu();
    $('pause-menu').classList.remove('hidden');
  } else if (state.mode === 'pause') {
    resumeGame();
  }
}
function resumeGame() {
  $('pause-menu').classList.add('hidden');
  $('controls-page').classList.add('hidden');
  $('settings-page').classList.add('hidden');
  state.mode = 'play';
}
function populatePauseMenu() {
  const target = state.driving && state.car ? state.car.group.position : jay.group.position;
  const heading = state.driving && state.car ? state.car.group.rotation.y : jay.group.rotation.y;
  HUD.drawPauseMap({
    player: { x: target.x, z: target.z, heading },
    police: activeCruisers().filter((u) => u.group.visible).map((u) => ({ x: u.group.position.x, z: u.group.position.z, color: '#ff2a1a' })),
    marker: !state.mission.done ? currentMarker() : null,
    garage: { x: -14, z: 26 },
  });
  // profile: real data only — no invented stats
  const j = currentJob();
  const completed = state.mission.done ? 7 : state.mission.job;
  const carName = state.car ? `${state.car.group.userData.spec.name} · ${state.car.group.userData.spec.kind}` : 'On foot';
  const cond = state.car ? Math.round(state.car.group.userData.condition ?? 100) : null;
  const crew = ['NADIA · Palm & Piston (garage)', 'THEO · Driver (races)', 'MARA · Fixer (intel)'];
  $('profile-body').innerHTML = `
    <div class="prof-row"><span>NAME</span><b>JACE “JAY” MORENO</b></div>
    <div class="prof-row"><span>RANK</span><b>${state.rank}</b></div>
    <div class="prof-row"><span>XP</span><b>${state.xp} / ${state.xpMax}</b></div>
    <div class="prof-row"><span>MONEY</span><b>$${state.money}</b></div>
    <div class="prof-row"><span>MISSION</span><b>${j ? `${j.title} · Stage ${state.mission.stage + 1}/${j.stages.length}` : 'Story complete'}</b></div>
    <div class="prof-row"><span>JOBS DONE</span><b>${completed} / 7</b></div>
    <div class="prof-row"><span>VEHICLE</span><b>${carName}${cond !== null ? ` · ${cond}%` : ''}</b></div>
    <div class="prof-row"><span>HEALTH / ARMOR</span><b>${Math.round(state.hp)} / ${Math.round(state.armor)}</b></div>
    <div class="prof-row"><span>WANTED</span><b>${state.wanted === 0 ? 'Clear' : `${state.wanted} star${state.wanted > 1 ? 's' : ''}`}</b></div>
    <div class="prof-row"><span>CREW</span><span class="crew-list">${crew.join('<br>')}</span></div>`;
}
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-save').addEventListener('click', () => {
  saveGame();
  HUD.showToast('SAVED', `Progress saved to slot ${saveSlot + 1}.`, 2000);
});
document.getElementById('btn-mainmenu').addEventListener('click', () => {
  saveGame();
  $('pause-menu').classList.add('hidden');
  $('controls-page').classList.add('hidden');
  $('settings-page').classList.add('hidden');
  HUD.hideHUD();
  startEl.style.display = 'flex';
  state.mode = 'start';
  refreshSlotTexts();
});

// ---------- mission chain (7 jobs, one framework) ----------
// Refresh every weapon slot's ammo text from live state (does not
// touch the active-slot highlight — that is setWeapon's job).
function refreshAmmoHUD() {
  for (let i = 0; i < 5; i++) {
    const el = $(`slot${i}`);
    if (!el) continue;
    const a = state.ammo[i];
    el.querySelector('.am').textContent = a ? `${a.mag}/${a.res}` : '—';
  }
}
function currentJob() { return state.mission.done ? null : MISSIONS[state.mission.job]; }
function currentStage() { const j = currentJob(); return j ? j.stages[state.mission.stage] : null; }
function currentMarker() {
  const s = currentStage();
  if (!s) return null;
  if (s.gates) return s.gates[state.mission.gate || 0];
  return s.marker || null;
}
// Move the 3D marker + beam to the current stage's marker (or hide it).
function setStageMarker() {
  const m = currentMarker();
  const show = !!m && state.mode === 'play' && !state.mission.done;
  markerMesh.visible = show;
  if (markerMesh.userData.beam) markerMesh.userData.beam.visible = show;
  if (m) {
    markerMesh.position.set(m.x, 6, m.z);
    markerMesh.userData.beam.position.set(m.x, 20, m.z);
  }
}
function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function updateMissionHUD() {
  const j = currentJob();
  if (!j) {
    HUD.setMission({ chapter: 'STORY COMPLETE', title: 'SAN AMARO', objective: 'Free roam', desc: 'The debt is paid. The city is yours.', fill: 1, stage: '7 / 7 jobs', par: '', time: fmtTime(state.missionT) });
    return;
  }
  const s = j.stages[state.mission.stage];
  const stageLabel = s.gates ? `Gate ${(state.mission.gate || 0) + 1} / ${s.gates.length}` : `Stage ${state.mission.stage + 1} / ${j.stages.length}`;
  HUD.setMission({
    chapter: j.chapter, title: j.title,
    objective: s.objective, desc: s.desc,
    fill: state.mission.stage / j.stages.length,
    stage: stageLabel,
    par: `+$${j.reward.money}`,
    time: `${fmtTime(state.missionT)} / ${fmtTime(j.par)}`,
  });
}
function setWanted(n) {
  state.wanted = clamp(n, 0, 5);
  refreshStatsHUD();
  if (state.wanted > 0) { Audio.sirenStart(); pedestrians.setFleeing(true); }
  else { Audio.sirenStop(); pedestrians.setFleeing(false); }
  return state.wanted;
}
// (Re)enter the current stage: marker, dialogue, stage-specific setup.
// Idempotent — re-running it resets the stage's transient state, which is
// what a Continue-after-load needs.
function enterStage() {
  const j = currentJob();
  if (!j) { setStageMarker(); updateMissionHUD(); return; }
  const s = j.stages[state.mission.stage];
  const sp = s.speaker || j.speaker;
  if (s.line) HUD.setDialogue(sp.name, s.line, sp.style, sp.skin, sp.hair);
  // stage-specific setup
  if (s.type === 'shootout') {
    spawnEnemies(s.enemies || []);
    // a shootout draws the SAMPD — the evade stage that follows needs
    // a wanted level to lose, or it could never complete.
    setWanted(Math.max(state.wanted, 2));
  }
  if (s.type === 'steal' && s.car === 'prize') {
    // the prize Comet appears in the Downtown showroom for the finale
    prizeCar.group.visible = true;
    prizeCar.group.position.set(60, 0, 60);
    prizeCar.group.rotation.y = Math.PI / 2;
    prizeCar.group.userData.condition = 100;
  }
  if (s.type === 'pickup' && s.person === 'mara') {
    mara.group.visible = true;
    mara.group.position.set(90, 0, -90);
  }
  setStageMarker();
  updateMissionHUD();
}
function enterJob(jobIdx) {
  state.mission.job = jobIdx; state.mission.stage = 0; state.missionT = 0; state.mission.gate = 0;
  const j = MISSIONS[jobIdx];
  const sp = j.speaker;
  HUD.setDialogue(sp.name, j.brief, sp.style, sp.skin, sp.hair);
  enterStage();
}
function advanceStage() {
  const j = currentJob();
  if (!j) return;
  state.mission.stage++;
  if (state.mission.stage >= j.stages.length) completeJob();
  else enterStage();
}
function completeJob() {
  const j = currentJob();
  if (!j) return;
  addMoney(j.reward.money);
  addXP(j.reward.xp);
  HUD.showToast('MISSION COMPLETE', `${j.title} — $${j.reward.money} banked.`, 3500);
  Audio.cashChime();
  if (j.unlockWeapon !== null && j.unlockWeapon !== undefined && j.unlockWeapon >= state.unlocked) {
    state.unlocked = j.unlockWeapon + 1;
    HUD.lockWeapons(state.unlocked);
    const names = ['FISTS', 'P9 PISTOL', 'VIPER SMG', 'SCATTERGUN', 'LONGSHOT'];
    HUD.showToast('WEAPON UNLOCKED', names[state.unlocked - 1] || '', 3000);
  }
  clearEnemies();
  if (state.mission.job >= MISSIONS.length - 1) {
    state.mission.done = true;
    state.mission.stage = 0;
    HUD.showToast('STORY COMPLETE', 'The debt is paid. San Amaro is yours.', 5000);
    updateMissionHUD(); setStageMarker(); saveGame();
    return;
  }
  enterJob(state.mission.job + 1);
  saveGame();
}
function failJob(reason) {
  const j = currentJob();
  if (!j) return;
  clearEnemies();
  state.mission.stage = 0; state.missionT = 0; state.mission.gate = 0;
  HUD.showToast('MISSION FAILED', `${reason} — restarting ${j.title}.`, 3500);
  enterStage();
  saveGame();
}
function tryEnterExitCar() {
  if (state.driving) {
    state.driving = false;
    const c = state.car;
    jay.group.visible = true;
    jay.group.position.set(c.group.position.x - 2.2, 0, c.group.position.z + 1.5);
    jay.group.rotation.y = c.group.rotation.y;
    state.car = null; state.speed = 0;
    Audio.blip(420);
    return;
  }
  // on foot: an 'interact' stage (clue / envelope) comes first
  const s = currentStage();
  if (s && s.type === 'interact' && s.marker) {
    const d = Math.hypot(jay.group.position.x - s.marker.x, jay.group.position.z - s.marker.z);
    if (d < s.marker.r) {
      Audio.blip(880);
      advanceStage();
      return;
    }
  }
  // near a car? steal / enter it.
  const cars = [
    { car: playerCar, id: 'comet' },
    { car: sedanCar, id: 'sedan' },
    { car: prizeCar, id: 'prize' },
  ];
  for (const { car, id } of cars) {
    if (!car.group.visible) continue;
    const d = jay.group.position.distanceTo(car.group.position);
    if (d < 4.5) {
      state.driving = true; state.car = car; state.carId = id;
      jay.group.visible = false;
      Audio.blip(520);
      // stealing a car is a crime — wanted 1, or 3 for the prize Comet
      setWanted(id === 'prize' ? 3 : 1);
      HUD.setVehicle({ name: `${car.group.userData.spec.name} · ${car.group.userData.spec.kind}`, condition: Math.round(car.group.userData.condition ?? 100), nitro: Math.round(state.nitro) });
      // a 'steal' stage for this exact car advances the mission
      if (s && s.type === 'steal' && s.car === id) advanceStage();
      return;
    }
  }
}

// ---------- Palm & Piston garage economy ----------
// Nadia's garage is the money sink: repair the car, buy armor, restock
// ammo. Only on foot, near Nadia — F/G/H do nothing anywhere else.
function nearGarage() {
  if (state.driving) return false;
  return jay.group.position.distanceTo(nadia.group.position) < 7;
}
function lastDrivenCar() {
  return state.carId === 'sedan' ? sedanCar : state.carId === 'prize' ? prizeCar : playerCar;
}
function garageRepair() {
  const car = lastDrivenCar();
  const cond = car.group.userData.condition ?? 100;
  if (cond >= 100) { HUD.showToast('PALM & PISTON', 'Car is already in top condition.', 2000); return; }
  if (state.money < 150) { HUD.showToast('PALM & PISTON', 'Repair costs $150 — not enough cash.', 2500); return; }
  addMoney(-150);
  car.group.userData.condition = 100;
  if (state.car === car) HUD.setVehicle({ condition: 100 });
  HUD.showToast('PALM & PISTON', 'Repaired — condition 100%.', 2500);
  Audio.cashChime();
}
function garageArmor() {
  if (state.armor >= 100) { HUD.showToast('PALM & PISTON', 'Armor is already full.', 2000); return; }
  if (state.money < 200) { HUD.showToast('PALM & PISTON', 'Armor costs $200 — not enough cash.', 2500); return; }
  addMoney(-200);
  state.armor = Math.min(100, state.armor + 50);
  HUD.setHealth(Math.round(state.hp), Math.round(state.armor));
  HUD.showToast('PALM & PISTON', 'Armor +50.', 2500);
  Audio.cashChime();
}
function garageAmmo() {
  if (state.money < 100) { HUD.showToast('PALM & PISTON', 'Ammo restock costs $100 — not enough cash.', 2500); return; }
  const max = [null, { mag: 12, res: 48 }, { mag: 32, res: 128 }, { mag: 6, res: 18 }, { mag: 24, res: 96 }];
  let needed = false;
  for (let i = 1; i < 5; i++) {
    if (state.ammo[i].mag < max[i].mag || state.ammo[i].res < max[i].res) needed = true;
    state.ammo[i] = { mag: max[i].mag, res: max[i].res };
  }
  if (!needed) { HUD.showToast('PALM & PISTON', 'Ammo is already full.', 2000); return; }
  addMoney(-100);
  refreshAmmoHUD();
  HUD.showToast('PALM & PISTON', 'Ammo restocked.', 2500);
  Audio.cashChime();
}

// ---------- combat (real weapons, real targets) ----------
// Weapon table: damage, range (m), fire interval (s), auto (hold to fire).
// FISTS (slot 0) is melee — no ammo, no tracer.
const WEAPON_STATS = [
  { name: 'FISTS', dmg: 20, range: 2.2, cd: 0.45, auto: false },
  { name: 'P9 PISTOL', dmg: 34, range: 40, cd: 0.35, auto: false },
  { name: 'VIPER SMG', dmg: 18, range: 35, cd: 0.12, auto: true },
  { name: 'SCATTERGUN', dmg: 45, range: 18, cd: 0.9, auto: false },
  { name: 'LONGSHOT', dmg: 100, range: 80, cd: 1.2, auto: false },
];
const AMMO_MAX = [null, { mag: 12, res: 48 }, { mag: 32, res: 128 }, { mag: 6, res: 18 }, { mag: 24, res: 96 }];
let rifleMesh = null;
let tracerMesh = null;
// One tracer at a time; the timeout removes only the mesh it created.
function spawnTracer(from, dir, length, color) {
  if (tracerMesh) scene.remove(tracerMesh);
  const tm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, length, 4),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
  tm.position.copy(from).addScaledVector(dir, length / 2);
  tm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(tm);
  tracerMesh = tm;
  setTimeout(() => { scene.remove(tm); if (tracerMesh === tm) tracerMesh = null; }, 120);
}
function spawnEnemies(spots) {
  clearEnemies();
  for (const s of spots) {
    const p = buildPerson({ shirt: 0xf2f2f2, pants: 0x2a2a2e });
    p.group.position.set(s.x, 0, s.z);
    p.group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(p.group);
    enemies.push({ person: p, hp: 100, alive: true, shootCd: 1 + Math.random() * 1.5 });
  }
}
function clearEnemies() {
  for (const e of enemies) scene.remove(e.person.group);
  enemies.length = 0;
}
// Nearest hittable target in front of the camera within range.
// Live enemies first; in staged-shot mode, the staged enemies too.
function findTarget(range) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  let best = null, bestD = range;
  const consider = (pos, ref) => {
    const d = pos.distanceTo(jay.group.position);
    if (d >= bestD) return;
    const to = new THREE.Vector3().subVectors(pos, jay.group.position).normalize();
    if (to.dot(dir) < 0.3) return; // must be roughly where the camera looks
    bestD = d; best = ref;
  };
  for (const e of enemies) if (e.alive) consider(e.person.group.position, { kind: 'live', e });
  if (SHOT) {
    for (const p of stagedEnemies) {
      if (!p.group.visible) continue;
      consider(p.group.position, { kind: 'staged', p });
    }
  }
  return best;
}
function fireWeapon() {
  if (state.mode !== 'play' || state.driving) return;
  if (state.time < state.reloadUntil) return;
  if (state.fireCd > 0) return;
  const w = WEAPON_STATS[state.weapon];
  // fists: melee, no ammo
  if (state.weapon === 0) {
    state.fireCd = w.cd;
    const t = findTarget(w.range);
    if (t) hitTarget(t, w.dmg);
    else Audio.blip(300);
    return;
  }
  const a = state.ammo[state.weapon];
  if (a.mag <= 0) {
    if (a.res > 0) {
      // auto-reload from reserve
      const take = Math.min(AMMO_MAX[state.weapon].mag, a.res);
      a.mag = take; a.res -= take;
      state.reloadUntil = state.time + 0.9;
      refreshAmmoHUD();
      Audio.blip(440);
      return;
    }
    HUD.showToast('NO AMMO', 'Buy ammo at Palm & Piston (H).', 2000);
    state.fireCd = 0.5;
    return;
  }
  a.mag--;
  state.fireCd = w.cd;
  refreshAmmoHUD();
  if (!rifleMesh) { rifleMesh = buildRifle(); aimPose(jay, rifleMesh); }
  Audio.gunshot();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const from = new THREE.Vector3();
  jay.group.localToWorld(from.set(0.05, 1.35, 0.6));
  spawnTracer(from, dir, 30, 0xffe9a8);
  const t = findTarget(w.range);
  if (t) hitTarget(t, w.dmg);
}
function hitTarget(t, dmg) {
  if (t.kind === 'live') {
    const e = t.e;
    e.hp -= dmg;
    if (e.hp <= 0 && e.alive) {
      e.alive = false;
      e.person.group.rotation.x = -1.2; // falls back
      e.person.group.position.y = 0.3;
      addXP(40);
      addMoney(50);
      Audio.blip(1200);
      // shootout stage: all enemies down?
      const s = currentStage();
      if (s && s.type === 'shootout' && enemies.every((x) => !x.alive)) advanceStage();
    }
  } else {
    // staged enemy (screenshot mode): falls, +40 XP like the old rifle
    t.p.group.rotation.x = -1.2;
    t.p.group.position.y = 0.3;
    addXP(40);
    Audio.blip(1200);
  }
}
// Enemies shoot back: each alive enemy fires at Jay every ~2.5 s when he
// is on foot and within 35 m. 40% hit chance, 8 damage (armor absorbs).
function updateEnemies(dt) {
  if (state.mode !== 'play' || state.driving) return;
  const jayPos = jay.group.position;
  for (const e of enemies) {
    if (!e.alive) continue;
    e.shootCd -= dt;
    const d = e.person.group.position.distanceTo(jayPos);
    if (d > 35) continue;
    if (e.shootCd > 0) continue;
    e.shootCd = 2.5;
    const from = e.person.group.position.clone(); from.y = 1.4;
    const dir = new THREE.Vector3().subVectors(jayPos, from).normalize();
    spawnTracer(from, dir, Math.max(1, d), 0xff9a8a);
    Audio.gunshot();
    if (Math.random() < 0.4) damagePlayer(8);
  }
}
function $(id) { return document.getElementById(id); }

// ---------- per-frame updates ----------
// Manual clock (THREE.Clock is deprecated in r186).
let lastT = performance.now();
let shotFrames = 0;
let walkPhase = 0;
let minimapTimer = 0;
let missionHudT = 0; // throttle for the mission-timer HUD refresh (2 Hz)
let hpShown = 100; // last HP value written to the HUD (regen throttle)
let garageToastShown = false; // garage hint shown once per visit
let camPos = new THREE.Vector3(0, 4, -12);
let camLook = new THREE.Vector3(0, 1, 0);
let heliAngle = 0;

function updatePlayer(dt) {
  const fwd = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
  const strafe = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
  if (state.driving && state.car) {
    const car = state.car;
    // Nitro boost: hold Shift while driving (and moving forward). Burns
    // the nitro bar — the bar the HUD already showed at 100% with no
    // mechanic behind it — for x1.35 top speed. The bar refills slowly
    // when not boosting, so it is a resource to spend, not a permanent
    // buff. (Shift on foot is still sprint; see below.)
    const boosting = (keys['ShiftLeft'] || keys['ShiftRight']) && state.nitro > 0.5 && fwd > 0;
    if (boosting) {
      state.nitro = Math.max(0, state.nitro - 28 * dt);
      Audio.nitroBoost();
    } else {
      state.nitro = Math.min(100, state.nitro + 6 * dt);
    }
    // a wrecked car is slower: condition scales top speed 0.75–1.0
    const cond = (car.group.userData.condition ?? 100) / 100;
    const top = (car.group.userData.spec.top / 3.6) * (boosting ? 1.35 : 1) * (0.75 + 0.25 * cond);
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
    HUD.setVehicle({ speed: Math.round(Math.abs(state.speed) * 3.6), nitro: Math.round(state.nitro) });
    // mission progress (drive / pickup arrival, race gates) is handled by
    // tickMission in the main loop — it works driving or on foot.
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

// ---------- police (cruisers + heli + roadblocks) ----------
// The units actually chasing right now: BAY-12 + VICTOR-7 always;
// DELTA-5 + ECHO-9 join at wanted >= 3.
function activeCruisers() {
  const units = [police[0], police[1]];
  if (state.wanted >= 3) units.push(extraCruisers[0], extraCruisers[1]);
  return units;
}
// Live police panel: real distances + statuses, refreshed from the
// police update (throttled to 4 Hz so it doesn't churn the DOM).
let policePanelT = 0;
function refreshPolicePanel() {
  if (state.mode !== 'play') return;
  const target = state.driving && state.car ? state.car.group.position : jay.group.position;
  const rows = [];
  for (const u of [police[0], police[1], extraCruisers[0], extraCruisers[1]]) {
    const active = activeCruisers().includes(u);
    if (!active) { rows.push({ call: u.call, dist: '—', status: 'STANDBY' }); continue; }
    const d = u.group.position.distanceTo(target);
    rows.push({ call: u.call, dist: `${Math.round(d)} m`, status: d < 60 ? 'PURSUIT' : 'EN ROUTE' });
  }
  const heli = police[2];
  const heliD = Math.round(Math.hypot(heli.group.position.x - target.x, heli.group.position.z - target.z));
  rows.push({ call: 'AIR-1', dist: state.wanted >= 1 ? `${heliD} m` : '—', status: state.wanted >= 3 ? 'PURSUIT' : state.wanted >= 1 ? 'EN ROUTE' : 'STANDBY' });
  HUD.setPolice(rows);
}
function setPoliceInitial() {
  HUD.setPolice([
    { call: 'BAY-12', dist: '—', status: 'STANDBY' },
    { call: 'VICTOR-7', dist: '—', status: 'STANDBY' },
    { call: 'DELTA-5', dist: '—', status: 'STANDBY' },
    { call: 'ECHO-9', dist: '—', status: 'STANDBY' },
    { call: 'AIR-1', dist: '—', status: 'STANDBY' },
  ]);
}
function updatePolice(dt) {
  if (state.mode !== 'play') return;
  const target = state.driving && state.car ? state.car.group.position : jay.group.position;
  if (state.wanted === 0) {
    // park the cruisers out of the way when clear
    for (const u of [police[0], police[1], extraCruisers[0], extraCruisers[1]]) { u.group.visible = false; u.speed = 0; }
    police[2].group.visible = false;
    if (roadblockActive) { roadblockActive = false; for (const c of roadblockCars) c.group.visible = false; }
    return;
  }
  // During an evade stage the cruisers ease off a little, so a good
  // driver can actually open a gap — at their full speed the car only
  // gains ~1.9 m/s and the 55 m evade requirement was unreachable.
  const evade = currentStage() && currentStage().type === 'evade';
  const speed = evade ? 10.5 : 11 + state.wanted * 1.5;
  activeCruisers().forEach((u, i) => {
    if (!u.group.visible) u.group.visible = true;
    u._ramCd = Math.max(0, (u._ramCd || 0) - dt);
    const p = u.group.position;
    const dx = target.x - p.x, dz = target.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3.5) {
      // ram: a bounded one-off shove, not a per-frame drain. One ram
      // costs 4 m/s, then that cruiser cannot ram again for 1.5 s, and
      // it is shoved back so it must re-approach — the player can
      // always accelerate away.
      if (state.driving && state.car && u._ramCd <= 0) {
        state.speed = Math.max(0, state.speed - 4);
        u._ramCd = 1.5;
        damageCar(state.car, 8);
        p.x -= Math.sin(u.group.rotation.y) * 5;
        p.z -= Math.cos(u.group.rotation.y) * 5;
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
  // heli circles overhead (visible at 1+ stars)
  const heli = police[2];
  heli.group.visible = state.wanted >= 1;
  if (state.wanted >= 1) {
    heliAngle += dt * 0.25;
    heli.group.position.set(
      target.x + Math.cos(heliAngle) * 26,
      26,
      target.z + Math.sin(heliAngle) * 26);
    heli.rotor.rotation.y += dt * 22;
  }
  // roadblock: at wanted >= 4 two cruisers block the road ahead of the
  // player; they reposition every 12 s, and stand down below wanted 4.
  if (state.wanted >= 4) {
    if (!roadblockActive) {
      roadblockActive = true;
      roadblockT = 12;
      placeRoadblock();
      HUD.showToast('ROADBLOCK', 'The SAMPD has sealed the road ahead.', 3000);
    } else {
      roadblockT -= dt;
      if (roadblockT <= 0) { roadblockT = 12; placeRoadblock(); }
    }
  } else if (roadblockActive) {
    roadblockActive = false;
    for (const c of roadblockCars) c.group.visible = false;
  }
  // wanted escalation: sustained close pursuit raises the heat — +1 star
  // per 25 s while a cruiser is within 40 m (cap 5).
  if (state.wanted > 0 && state.wanted < 5) {
    let minDist = Infinity;
    for (const u of activeCruisers()) minDist = Math.min(minDist, u.group.position.distanceTo(target));
    if (minDist < 40) {
      state.heatT += dt;
      if (state.heatT >= 25) {
        state.heatT = 0;
        setWanted(state.wanted + 1);
        HUD.showToast('HEAT RISING', `Wanted level ${state.wanted}.`, 2500);
      }
    } else state.heatT = 0;
  } else state.heatT = 0;
  // wanted decays if the player is far from all cruisers: 55 m for 4 s.
  // Completing an evade stage advances the mission.
  const EVADE_DIST = 55, EVADE_HOLD = 4;
  {
    let minDist = Infinity;
    for (const u of activeCruisers()) minDist = Math.min(minDist, u.group.position.distanceTo(target));
    if (minDist > EVADE_DIST) {
      state._clearT = (state._clearT || 0) + dt;
      if (state._clearT > EVADE_HOLD) {
        state._clearT = 0;
        const s = currentStage();
        if (s && s.type === 'evade' && !state.mission.done) advanceStage();
        setWanted(0);
      }
    } else state._clearT = 0;
  }
  // live police panel (4 Hz)
  policePanelT -= dt;
  if (policePanelT <= 0) { policePanelT = 0.25; refreshPolicePanel(); }
}
// Park two cruisers across the road ~40 m ahead of the player, side by side.
function placeRoadblock() {
  const p = state.driving && state.car ? state.car.group.position : jay.group.position;
  const fwd = state.driving && state.car
    ? new THREE.Vector3(Math.sin(state.car.group.rotation.y), 0, Math.cos(state.car.group.rotation.y))
    : new THREE.Vector3(Math.sin(jay.group.rotation.y), 0, Math.cos(jay.group.rotation.y));
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
  for (let i = 0; i < 2; i++) {
    const c = roadblockCars[i];
    const off = i === 0 ? -1.5 : 1.5;
    c.group.position.set(p.x + fwd.x * 40 + right.x * off * 3, 0, p.z + fwd.z * 40 + right.z * off * 3);
    c.group.rotation.y = Math.atan2(fwd.x, fwd.z) + Math.PI / 2;
    c.group.visible = true;
  }
}

// ---------- collision ----------
// Obstacles are built once from the real city layout: building footprints
// (AABBs), the fountain (circle), parked cars (circles). Traffic,
// pedestrians and roadblocks are dynamic and checked live.
let buildingAABBs = null;
let parkedCircles = null;
function getBuildingAABBs() {
  if (buildingAABBs) return buildingAABBs;
  buildingAABBs = [];
  for (const b of cityRefs.layout.buildings) {
    buildingAABBs.push({
      minX: b.x - b.w / 2 - 0.4, maxX: b.x + b.w / 2 + 0.4,
      minZ: b.z - b.d / 2 - 0.4, maxZ: b.z + b.d / 2 + 0.4,
    });
  }
  return buildingAABBs;
}
function getParkedCircles() {
  if (parkedCircles) return parkedCircles;
  parkedCircles = [];
  if (Array.isArray(parked)) {
    for (const g of parked) parkedCircles.push({ x: g.position.x, z: g.position.z, r: 2.2 });
  }
  return parkedCircles;
}
const FOUNTAIN = { x: -90, z: 30, r: 7.5 };
// Circle vs AABB push-out. Returns the push vector (or null if no overlap).
function circleAABB(px, pz, r, box) {
  const cx = clamp(px, box.minX, box.maxX);
  const cz = clamp(pz, box.minZ, box.maxZ);
  const dx = px - cx, dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    return { x: (dx / d) * (r - d), z: (dz / d) * (r - d) };
  }
  // center inside the box: push out along the smallest penetration axis
  const left = px - box.minX, right = box.maxX - px;
  const top = pz - box.minZ, bottom = box.maxZ - pz;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: -(left + r), z: 0 };
  if (m === right) return { x: right + r, z: 0 };
  if (m === top) return { x: 0, z: -(top + r) };
  return { x: 0, z: bottom + r };
}
// Circle vs circle push-out. Returns the push vector (or null).
function circleCircle(px, pz, r, ox, oz, orr) {
  const dx = px - ox, dz = pz - oz;
  const d = Math.hypot(dx, dz);
  const min = r + orr;
  if (d >= min || d < 1e-6) return null;
  return { x: (dx / d) * (min - d), z: (dz / d) * (min - d) };
}
// Player car vs the world: push out, damp speed, chip condition.
let carHitCd = 0;
function collidePlayerCar(dt) {
  if (!state.driving || !state.car) return;
  const car = state.car;
  const p = car.group.position;
  carHitCd = Math.max(0, carHitCd - dt);
  let hit = false;
  for (const box of getBuildingAABBs()) {
    const push = circleAABB(p.x, p.z, 2.0, box);
    if (push) { p.x += push.x; p.z += push.z; hit = true; }
  }
  const fp = circleCircle(p.x, p.z, 2.0, FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r);
  if (fp) { p.x += fp.x; p.z += fp.z; hit = true; }
  for (const c of getParkedCircles()) {
    const push = circleCircle(p.x, p.z, 2.0, c.x, c.z, c.r);
    if (push) { p.x += push.x; p.z += push.z; hit = true; }
  }
  for (const t of traffic.cars) {
    const push = circleCircle(p.x, p.z, 2.0, t.group.position.x, t.group.position.z, 2.2);
    if (push) { p.x += push.x; p.z += push.z; traffic.slowCar(t, 0.8); hit = true; }
  }
  if (roadblockActive) {
    for (const c of roadblockCars) {
      if (!c.group.visible) continue;
      const push = circleCircle(p.x, p.z, 2.0, c.group.position.x, c.group.position.z, 2.2);
      if (push) { p.x += push.x; p.z += push.z; hit = true; }
    }
  }
  if (hit) {
    state.speed *= 0.55;
    if (carHitCd <= 0) { carHitCd = 0.5; damageCar(car, 2); Audio.blip(180); }
  }
}
// Jay on foot vs the world: push out of buildings, hurt by traffic.
function collideJay(dt) {
  if (state.driving) return;
  const p = jay.group.position;
  for (const box of getBuildingAABBs()) {
    const push = circleAABB(p.x, p.z, 0.9, box);
    if (push) { p.x += push.x; p.z += push.z; }
  }
  const fp = circleCircle(p.x, p.z, 0.9, FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r);
  if (fp) { p.x += fp.x; p.z += fp.z; }
  // traffic: a moving car hurts (10 HP + knockback), once per car per 1 s
  for (const t of traffic.cars) {
    t._hitCd = Math.max(0, (t._hitCd || 0) - dt);
    if (t._hitCd > 0) continue;
    const d = Math.hypot(p.x - t.group.position.x, p.z - t.group.position.z);
    if (d < 2.4) {
      t._hitCd = 1;
      traffic.slowCar(t, 0.8);
      damagePlayer(10);
      const dx = p.x - t.group.position.x, dz = p.z - t.group.position.z;
      const len = Math.hypot(dx, dz) || 1;
      p.x += (dx / len) * 3; p.z += (dz / len) * 3;
      Audio.blip(140);
    }
  }
  // pedestrians: gentle push-out both ways
  for (const w of pedestrians.walkers) {
    if (w.downT > 0) continue;
    const wp = w.p.group.position;
    const d = Math.hypot(p.x - wp.x, p.z - wp.z);
    if (d < 1.4 && d > 1e-6) {
      const push = (1.4 - d) / 2;
      const dx = (p.x - wp.x) / d, dz = (p.z - wp.z) / d;
      p.x += dx * push; p.z += dz * push;
      wp.x -= dx * push; wp.z -= dz * push;
    }
  }
}
// Player car vs pedestrians: knock them down, +1 wanted star.
function collideCarPedestrians(dt) {
  if (!state.driving || !state.car) return;
  const p = state.car.group.position;
  for (const w of pedestrians.walkers) {
    if (w.downT > 0) continue;
    const wp = w.p.group.position;
    const d = Math.hypot(p.x - wp.x, p.z - wp.z);
    if (d < 2.4) {
      pedestrians.knockDown(w);
      if (state.wanted < 5) setWanted(state.wanted + 1);
      HUD.showToast('HIT AND RUN', 'A pedestrian is down — the SAMPD noticed.', 2500);
      state.speed *= 0.7;
    }
  }
}

// ---------- mission tick ----------
// Drive / pickup stages complete by arriving at the marker; a race stage
// advances through its gates. Called every frame from the main loop —
// it works driving or on foot.
function tickMission(dt) {
  const s = currentStage();
  if (!s || state.mode !== 'play') return;
  // par time: only the race fails on time (other jobs are untimed targets)
  if (s.gates && state.missionT > currentJob().par) {
    failJob('Out of time — the race is lost');
    return;
  }
  if (s.type !== 'drive' && s.type !== 'pickup') return;
  const m = currentMarker();
  if (!m) return;
  const pos = state.driving && state.car ? state.car.group.position : jay.group.position;
  const d = Math.hypot(pos.x - m.x, pos.z - m.z);
  if (d >= (m.r || 16)) return;
  // race: a drive stage with a gate list — advance through the gates
  if (s.gates) {
    const gate = state.mission.gate || 0;
    if (gate < s.gates.length - 1) {
      state.mission.gate = gate + 1;
      HUD.showToast(`GATE ${gate + 1} / ${s.gates.length}`, 'Next gate — keep it flat.', 1500);
      Audio.blip(880);
      setStageMarker();
      updateMissionHUD();
      return;
    }
    advanceStage();
    Audio.cashChime();
    return;
  }
  if (s.type === 'pickup') {
    mara.group.visible = false;
    HUD.showToast('MARA', 'Mara’s in — drive her to the garage.', 2500);
  }
  advanceStage();
  Audio.cashChime();
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
    police: activeCruisers().filter((u) => u.group.visible).map((u) => ({ x: u.group.position.x, z: u.group.position.z, color: '#ff2a1a' })),
    marker: !state.mission.done ? currentMarker() : null,
  });
}

// ---------- main loop ----------
// Street names (the layout roads are keyed by axis:coord — axis 'x' is an
// east-west street whose coordinate is its z, axis 'z' a north-south
// street whose coordinate is its x).
const STREET_NAMES = {
  'x:0': 'Lantern Blvd', 'x:60': 'Palm Row', 'x:-60': 'Marina Way',
  'x:120': 'Coral Ave', 'x:-120': 'Harbor Blvd', 'x:180': 'Crescent Ave',
  'x:-180': 'Dockside Ave', 'x:240': 'Northgate Ave', 'x:-240': 'Southgate Ave',
  'z:0': 'Sunset Ave', 'z:60': 'Vesper St', 'z:-60': 'Mirage St',
  'z:120': 'Solana St', 'z:-120': 'Bayside St', 'z:180': 'Onyx St',
  'z:-180': 'Topaz St', 'z:240': 'Eastgate Ave', 'z:-240': 'Westgate Ave',
};
// District + street from the player's actual position (zone from the
// block they are in, street from the nearest road). Called with the
// minimap tick; setDistrict only touches the DOM when a label changes.
function updateDistrict() {
  const p = state.driving && state.car ? state.car.group.position : jay.group.position;
  const bx = Math.max(-4, Math.min(3, Math.floor(p.x / 60)));
  const bz = Math.max(-4, Math.min(3, Math.floor(p.z / 60)));
  const zone = zoneFor(bx, bz);
  let best = null, bestD = 1e9;
  for (const c of STREETS) {
    const dEW = Math.abs(p.z - c);
    const dNS = Math.abs(p.x - c);
    if (dEW < bestD) { bestD = dEW; best = STREET_NAMES[`x:${c}`]; }
    if (dNS < bestD) { bestD = dNS; best = STREET_NAMES[`z:${c}`]; }
  }
  HUD.setDistrict(zone, bestD < 14 ? best : 'San Amaro');
}

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
    if (!SHOT && state.mode === 'play') {
      // mission clock (par timer) — the HUD time refreshes at 2 Hz
      if (!state.mission.done) state.missionT += dt;
      missionHudT += dt;
      if (missionHudT > 0.5) { missionHudT = 0; updateMissionHUD(); }
      // weapon cooldowns + hold-to-fire for auto weapons (SMG)
      state.fireCd = Math.max(0, state.fireCd - dt);
      if (mouseDown && WEAPON_STATS[state.weapon].auto && !state.driving) fireWeapon();
      // health regen: +3/s when clear and 5 s after the last hit
      if (state.wanted === 0 && state.hp < 100 && state.time - state.lastDamageT > 5) {
        state.hp = Math.min(100, state.hp + 3 * dt);
        if (Math.round(state.hp) !== hpShown) { hpShown = Math.round(state.hp); HUD.setHealth(hpShown, Math.round(state.armor)); }
      }
      tickMission(dt);
      updateEnemies(dt);
      collidePlayerCar(dt);
      collideJay(dt);
      collideCarPedestrians(dt);
      // garage services hint (once per visit, on foot near Nadia)
      const gNear = nearGarage();
      if (gNear && !garageToastShown) {
        garageToastShown = true;
        HUD.showToast('PALM & PISTON', 'F repair $150 · G armor $200 · H ammo $100', 3500);
      } else if (!gNear) garageToastShown = false;
    }
    // water ripples breathe
    for (const r of cityRefs.ripples) {
      const s = 1 + 0.6 * Math.sin(state.time * 0.9 + r.userData.phase);
      r.scale.setScalar(s);
      r.material.opacity = 0.32 - 0.12 * Math.sin(state.time * 0.9 + r.userData.phase);
    }
    // mission marker bobs
    markerMesh.position.y = 6 + Math.sin(state.time * 2) * 0.6;
    markerMesh.rotation.y += dt * 1.2;
    markerMesh.visible = !!currentMarker() && !state.mission.done && state.mode === 'play';
    if (markerMesh.userData.beam) markerMesh.userData.beam.visible = markerMesh.visible;
    Audio.sirenUpdate(dt);
    minimapTimer += dt;
    if (minimapTimer > 0.12) { minimapTimer = 0; updateMinimap(); updateDistrict(); }
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
