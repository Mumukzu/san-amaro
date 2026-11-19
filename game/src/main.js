// SAN AMARO boot: renderer, scene, every system, fixed-step loop, menus,
// enter/exit cars, time-of-day, save/load, and ?shot=1..4 staging.
// The game object passed to stageShot is assembled here (shots.js expects
// sky/player/vehicles/camera/hud/police/lights/traffic/peds + applyGlow +
// focusPos/focusHeading + lightIntersections).
import * as THREE from 'three';
import { WORLD, TIME_ORDER, DEFAULT_TIME } from './config.js';
import { mulberry32 } from './utils.js';
import { state } from './state.js';
import { Sky } from './sky.js';
import { buildWorld } from './world.js';
import { buildBuildings } from './buildings.js';
import { buildProps } from './props.js';
import { TrafficLights, LIGHT_INTERSECTIONS } from './roads.js';
import { Vehicles } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { HUD } from './hud.js';
import { Minimap } from './minimap.js';
import { loadSave, saveGame } from './save.js';
import { AudioSys } from './audio.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot'); // '1'..'4' stages a screenshot scene
const debug = params.get('debug') === '1';
if (debug) state.debug = true;

// Baseline-only live values (the full game adds more later).
state.nitro = 100; // 0-100, Shift while driving spends it
state.condition = 100; // 0-100, hard impacts lower it

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const hudEl = document.getElementById('hud');

function announce(message) {
  status.textContent = message;
}

// ---- Renderer (ACES tone mapping, soft shadows, sRGB) ----
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ---- World + systems ----
const scene = new THREE.Scene();
const sky = new Sky(scene, renderer);
const layout = buildWorld(scene);
const buildings = buildBuildings(scene, layout);
const props = buildProps(scene);
state.colliders = [...buildings.colliders, ...props.colliders];
const lights = new TrafficLights(scene);
const vehicles = new Vehicles(scene);
vehicles.spawnParked(mulberry32(WORLD.seed));
const traffic = new Traffic(scene, vehicles, lights);
const peds = new Pedestrians(scene);
const police = new Police(scene, vehicles);
const player = new Player(scene);
state.player = player;
const camera = new Camera();
const hud = new HUD(document);
const minimap = new Minimap(document.getElementById('hud-minimap'));
const audio = new AudioSys();
const input = createInput(canvas);

function applyGlow() {
  buildings.setWindowGlow(sky.windowGlow);
  props.setGlow(sky.windowGlow, sky.lampOn);
}

// Saved progress (money, escapes, missions, time of day).
loadSave();
sky.applyPreset(state.timePreset || DEFAULT_TIME, true);
applyGlow();

const game = {
  sky, player, vehicles, camera, hud, police, lights, traffic, peds,
  lightIntersections: LIGHT_INTERSECTIONS,
  applyGlow,
  focusPos() {
    return state.inCar && state.vehicle ? state.vehicle.pos : player.pos;
  },
  focusHeading() {
    return state.inCar && state.vehicle ? state.vehicle.heading : player.heading;
  },
};
// Testing handle (also handy for later slices): window.__game.state,
// window.__game.player, ... — no secrets, just the live game object.
// window.__pauseLoop = true freezes the render loop (canvas stays put) so
// screenshots can capture a live scene without fighting the compositor.
window.__game = game;
window.__game.state = state;

// ---- Phases: menu | playing | paused | busted ----
let phase = 'menu';
state.phase = 'menu';
let helpVisible = true; // help shows on the title screen
let lastHitToast = 0;
let dialogueTimer = null;

function showDialogue(who, line, ms = 7000) {
  const box = document.getElementById('hud-dialogue');
  document.getElementById('hud-dialogue-who').textContent = who;
  document.getElementById('hud-dialogue-line').textContent = line;
  box.style.display = 'flex';
  clearTimeout(dialogueTimer);
  dialogueTimer = setTimeout(() => { box.style.display = 'none'; }, ms);
}

function updateContinueSub() {
  document.getElementById('continue-sub').textContent =
    `Chapter 1 · $${state.money.toLocaleString('en-US')} · Day 1`;
}

function startGame() {
  audio.init();
  audio.click();
  phase = 'playing';
  state.phase = 'playing';
  hud.hideMenus();
  hudEl.classList.remove('hidden');
  camera.mode = state.inCar ? 'drive' : 'follow';
  updateContinueSub();
  showDialogue('NADIA · PALM & PISTON',
    '\u201CYou break it, you bought it. Get the car to the marker \u2014 and don\u2019t scratch the paint.\u201D');
  announce('Playing. Explore San Amaro.');
}

function newGame() {
  state.money = 250;
  state.missionsDone = 0;
  state.bestEscape = 0;
  state.timePreset = DEFAULT_TIME;
  state.nitro = 100;
  state.condition = 100;
  sky.applyPreset(DEFAULT_TIME, true);
  applyGlow();
  saveGame();
  startGame();
}

function pauseGame() {
  if (phase !== 'playing') return;
  phase = 'paused';
  state.phase = 'paused';
  hud.showMenu('pause');
  saveGame();
  announce('Paused.');
}

function resumeGame() {
  audio.click();
  phase = 'playing';
  state.phase = 'playing';
  hud.hideMenus();
  announce('Playing.');
}

function restartPosition() {
  if (state.inCar && state.vehicle) {
    state.vehicle.parked = true;
    state.inCar = false;
    state.vehicle = null;
    player.group.visible = true;
  }
  player.pos.set(10, 0, 60);
  player.group.position.copy(player.pos);
  player.heading = Math.PI;
  police.setWanted(0);
  camera.mode = 'follow';
  phase = 'playing';
  state.phase = 'playing';
  hud.hideMenus();
  hud.toast('Back at Palm & Piston.');
}

function quitToTitle() {
  phase = 'menu';
  state.phase = 'menu';
  hud.showMenu('menu');
  hudEl.classList.add('hidden');
  input.clearActions();
  updateContinueSub();
  saveGame();
  announce('San Amaro. Press Enter to start.');
}

function bustGame() {
  if (phase !== 'playing') return;
  state.money = Math.max(0, state.money - 100);
  if (state.inCar && state.vehicle) {
    state.vehicle.parked = true;
    state.inCar = false;
    state.vehicle = null;
    player.group.visible = true;
  }
  police.setWanted(0);
  phase = 'busted';
  state.phase = 'busted';
  hud.showMenu('busted');
  saveGame();
  announce('Busted. The SAMPD got you. $100 bail.');
}

function payBail() {
  audio.click();
  player.pos.set(10, 0, 60);
  player.group.position.copy(player.pos);
  player.heading = Math.PI;
  state.health = 100;
  camera.mode = 'follow';
  phase = 'playing';
  state.phase = 'playing';
  hud.hideMenus();
  hud.toast('Bail paid. Stay out of trouble.');
}

function toggleMute() {
  audio.setMuted(!state.muted);
  document.getElementById('mute-sub').textContent = state.muted ? 'Muted — click to unmute' : 'On — click to mute';
  hud.toast(state.muted ? 'Muted' : 'Sound on');
}

function cycleTime() {
  const idx = (TIME_ORDER.indexOf(state.timePreset) + 1) % TIME_ORDER.length;
  state.timePreset = TIME_ORDER[idx];
  sky.applyPreset(state.timePreset);
  applyGlow();
  hud.toast(`Time: ${state.timePreset}`);
}

// ---- Enter / exit cars ----
function tryEnterExit() {
  if (state.inCar) {
    const car = state.vehicle;
    state.inCar = false;
    state.vehicle = null;
    car.parked = true;
    const sx = Math.cos(car.heading);
    const sz = -Math.sin(car.heading);
    player.pos.set(car.pos.x + sx * 2.2, 0, car.pos.z + sz * 2.2);
    player.group.position.copy(player.pos);
    player.group.visible = true;
    camera.mode = 'follow';
    hud.setPrompt('');
    return;
  }
  const car = vehicles.nearestStealable(player.pos, 4);
  if (!car) return;
  const firstSteal = !car.stolen;
  car.parked = false;
  car.stolen = true;
  state.inCar = true;
  state.vehicle = car;
  player.group.visible = false;
  camera.mode = 'drive';
  if (firstSteal) {
    police.crime(1);
    hud.toast('Car stolen — the SAMPD is on you!');
  }
}

// ---- Driving (arcade: throttle/steer, Space handbrake, Shift nitro) ----
function driveCar(dt) {
  const car = state.vehicle;
  const k = input.keys;
  let throttle = 0;
  let steer = 0;
  if (k['KeyW'] || k['ArrowUp']) throttle += 1;
  if (k['KeyS'] || k['ArrowDown']) throttle -= 1;
  if (k['KeyA'] || k['ArrowLeft']) steer -= 1;
  if (k['KeyD'] || k['ArrowRight']) steer += 1;
  const handbrake = !!k['Space'];
  const prevSpeed = car.speed;
  const nitroActive = (k['ShiftLeft'] || k['ShiftRight']) && state.nitro > 0 && throttle > 0;
  vehicles.drive(car, dt, throttle, steer, false, handbrake);
  if (nitroActive) {
    car.speed = Math.min(car.speed + 10 * dt, 40);
    state.nitro = Math.max(0, state.nitro - 30 * dt);
  } else {
    state.nitro = Math.min(100, state.nitro + 8 * dt);
  }
  state.speed = car.speed;
  // Hard impact: sudden speed loss while moving fast damages the car.
  if (Math.abs(prevSpeed) > 6 && prevSpeed - car.speed > 7) {
    state.condition = Math.max(0, state.condition - 4);
    if (performance.now() - lastHitToast > 2000) {
      lastHitToast = performance.now();
      hud.toast('Your car took a hit!');
    }
  }
  // Running over a pedestrian is a crime.
  for (const p of peds.peds) {
    if (p.down) continue;
    if (Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z) < 2.2) {
      if (peds.knockDown(p.pos)) {
        police.crime(1);
        hud.toast('You hit a pedestrian!');
      }
    }
  }
  hud.setPrompt('Press E to exit the car');
}

// ---- One fixed step (1/60 s) ----
function step(dt) {
  state.time += dt;
  if (input.takeAction('pause')) {
    pauseGame();
    return;
  }
  if (input.takeAction('time')) cycleTime();
  if (input.takeAction('mute')) toggleMute();
  if (input.takeAction('help')) {
    helpVisible = !helpVisible;
    hud.toggleHelp(helpVisible);
  }
  if (input.takeAction('enter')) tryEnterExit();
  const o = input.takeOrbit();
  if (o.x || o.y) camera.addOrbit(o.x, o.y);

  if (state.inCar && state.vehicle) {
    driveCar(dt);
  } else {
    player.update(dt, input, camera.yaw);
    // Traffic cars nudge the player aside instead of driving through them.
    for (const t of traffic.cars) {
      const dx = player.pos.x - t.car.pos.x;
      const dz = player.pos.z - t.car.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 1.6) {
        const push = 1.6 - d;
        player.pos.x += (dx / d) * push;
        player.pos.z += (dz / d) * push;
      }
    }
    const near = vehicles.nearestStealable(player.pos, 4);
    hud.setPrompt(near ? 'Press E to enter the car' : '');
  }

  lights.update(dt);
  traffic.update(dt, LIGHT_INTERSECTIONS);
  peds.update(dt);
  if (state.wanted > 0) police.update(dt, bustGame);
  vehicles.updateVisuals(dt);
}

// ---- Menu buttons ----
document.getElementById('btn-continue').addEventListener('click', startGame);
document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-controls').addEventListener('click', () => {
  helpVisible = !helpVisible;
  hud.toggleHelp(helpVisible);
  audio.init();
  audio.click();
});
document.getElementById('btn-mute').addEventListener('click', () => {
  audio.init();
  toggleMute();
});
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-restart').addEventListener('click', restartPosition);
document.getElementById('btn-quit').addEventListener('click', quitToTitle);
document.getElementById('btn-bail').addEventListener('click', payBail);
document.getElementById('btn-busted-quit').addEventListener('click', quitToTitle);

// ---- Per-frame HUD extras (vehicle + police panels) ----
function updatePanels() {
  const veh = document.getElementById('hud-vehicle');
  veh.style.display = state.inCar ? 'block' : 'none';
  if (state.inCar) {
    document.getElementById('hud-cond-fill').style.width = `${state.condition}%`;
    document.getElementById('hud-cond-num').textContent = `${Math.round(state.condition)}%`;
    document.getElementById('hud-nitro-fill').style.width = `${state.nitro}%`;
    document.getElementById('hud-nitro-num').textContent = `${Math.round(state.nitro)}%`;
  }
  const pol = document.getElementById('hud-police');
  pol.style.display = state.wanted > 0 ? 'block' : 'none';
  if (state.wanted > 0 && police.cruiser) {
    const p = state.inCar && state.vehicle ? state.vehicle.pos : player.pos;
    const d = Math.hypot(police.cruiser.car.pos.x - p.x, police.cruiser.car.pos.z - p.z);
    document.getElementById('hud-police-dist').textContent = `${Math.round(d)} m`;
  }
}

// ---- Main loop ----
let last = performance.now();
let acc = 0;
let fpsFrames = 0;
let fpsTime = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  if (window.__pauseLoop) return; // frozen for screenshots: loop idles, canvas stays put
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;

  if (phase === 'menu') {
    // Live title backdrop: slow orbit over the plaza, city alive behind it.
    const a = (now / 1000) * 0.05;
    camera.setCinematic(
      new THREE.Vector3(Math.sin(a) * 90, 32, Math.cos(a) * 90),
      new THREE.Vector3(0, 10, 0),
    );
    state.time += dt;
    lights.update(dt);
    traffic.update(dt, LIGHT_INTERSECTIONS);
    peds.update(dt);
    vehicles.updateVisuals(dt);
  } else if (phase === 'playing') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      step(STEP);
      acc -= STEP;
      n += 1;
    }
    if (n === 5) acc = 0; // drop backlog after a stall
    if (input.takeAction('confirm') && phase === 'playing') {
      // confirm does nothing mid-game; menus consume it instead
    }
  }

  sky.update(dt, game.focusPos());
  applyGlow();
  camera.update(dt, game.focusPos(), game.focusHeading(), state.speed);
  if (phase !== 'menu') {
    hud.update();
    minimap.update();
    audio.update();
    updatePanels();
  }
  renderer.render(scene, camera.camera);

  fpsFrames += 1;
  const ft = performance.now();
  if (ft - fpsTime >= 500) {
    state.fps = Math.round((fpsFrames * 1000) / (ft - fpsTime));
    fpsFrames = 0;
    fpsTime = ft;
    state.drawCalls = renderer.info.render.calls;
    state.triangles = renderer.info.render.triangles;
  }
}

window.addEventListener('resize', () => {
  camera.resize();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && phase === 'playing') pauseGame();
});

updateContinueSub();
announce('San Amaro. Press Enter to start.');
if (!shot) hud.showMenu('menu'); // sync menu state so the help panel shows on the title screen

if (shot) {
  // Screenshot staging: no menu, no input — stage the scene, paint twice,
  // then set window.__shotReady for the screenshot.
  hudEl.classList.remove('hidden');
  stageShot(shot, game);
  hud.update();
  minimap.update();
  updatePanels();
  let painted = 0;
  (function paint() {
    sky.update(0.016, game.focusPos());
    applyGlow();
    camera.update(0.016, game.focusPos(), game.focusHeading(), state.speed);
    renderer.render(scene, camera.camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }());
} else {
  requestAnimationFrame(frame);
}
