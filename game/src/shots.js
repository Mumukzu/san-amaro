// Screenshot staging behind ?shot=1..4. Each scene stages a real moment of
// the running game (fixed time of day, fixed camera, the city simulated
// forward a few seconds first) so the same URL always gives the same frame.
// 1 = daytime open-world view, 2 = night neon street,
// 3 = police chase with wanted stars, 4 = mission HUD + minimap.
// In shot mode the game starts playing immediately (no menu) and the driven
// car keeps its autopilot, so the frame stays alive for the screenshot.
import * as THREE from 'three';
import { state, setObjective } from './state.js';

const STEP = 1 / 60;

function simulate(game, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.lights.update(STEP);
    game.traffic.update(STEP, game.lightIntersections);
    game.peds.update(STEP);
    if (state.inCar && state.vehicle) {
      game.vehicles.drive(state.vehicle, STEP, 1, 0, false, false);
      state.speed = state.vehicle.speed;
    }
    if (state.wanted > 0) game.police.update(STEP, () => {});
    game.vehicles.updateVisuals(STEP);
    state.time += STEP;
    // The live step() advances these too — the staged seconds must count,
    // or the HUD clock and mission timer read 18:24 / 00:00 in every shot.
    state.clockMinutes += STEP * 0.5;
    state.missionTime += STEP;
  }
}

// Mission panel must match the staged moment (updateMission in main.js
// does not run during staging). Stage 1 = on foot finding a car;
// stage 3 = in a car driving to the marker. The objective line is the
// shot's staged moment; the stage/progress/timer are the mission truth.
function syncMission(stage, progress) {
  state.missionStage = stage;
  state.missionProgress = progress;
}

function stageProgressToMarker(startDist) {
  if (!state.marker || startDist <= 0) return 2 / 3;
  const p = state.inCar && state.vehicle ? state.vehicle.pos : state.player.pos;
  const d = Math.hypot(state.marker.x - p.x, state.marker.z - p.z);
  return 2 / 3 + (1 - Math.min(1, d / startDist)) / 3;
}

function enterCarForShot(game, car, speed) {
  car.parked = false;
  car.stolen = true;
  state.inCar = true;
  state.vehicle = car;
  state.player.group.visible = false;
  car.speed = speed;
  game.camera.mode = 'drive';
  game.camera.yaw = car.heading + Math.PI;
}

export function stageShot(n, game) {
  const { sky, player, vehicles, camera, hud, police } = game;
  state.shot = String(n);
  state.phase = 'playing';
  // Mu's four moments (19 Nov ~14:14): 1 chase at golden hour, 2 mission
  // in progress, 3 drift near the lift bridge, 4 neon street at night.
  // Each shows a different feature set, each with the full HUD.
  state.timePreset = ({ '1': 'sunset', '2': 'day', '3': 'sunset', '4': 'night' })[n] || 'sunset';
  // The in-game clock matches the preset (day 11:30, sunset 18:24, night 21:45).
  state.clockMinutes = { '1': 18 * 60 + 24, '2': 11 * 60 + 30, '3': 18 * 60 + 24, '4': 21 * 60 + 45 }[n] || 18 * 60 + 24;
  state.day = 1;
  hud.hideMenus();
  sky.applyPreset('sunset', true);
  game.applyGlow();

  if (n === '1') {
    // 1 — Police chase at golden hour: player driving east, cruiser
    // behind, 2 stars. The chase reads: palm crowns, lamp pools, neon.
    sky.applyPreset('sunset', true);
    game.applyGlow();
    const car = vehicles.cars.find((c) => c.parked && Math.abs(c.pos.x - 20) < 1 && Math.abs(c.pos.z - 38.5) < 1)
      || vehicles.cars.find((c) => c.parked);
    car.pos.set(10, 0, 50);
    car.heading = Math.PI / 2;
    enterCarForShot(game, car, 16);
    police.setWanted(2);
    police.spawnCruiserNear(car.pos);
    police.cruiser.car.pos.set(-30, 0, 50);
    police.cruiser.car.heading = Math.PI / 2;
    police.cruiser.car.speed = 20;
    setObjective('Lose the police');
    state.marker = { x: 150, z: 50 };
    state.markerLabel = 'Drop-off';
    state.missionStartDist = Math.hypot(150 - 10, 50 - 50);
    simulate(game, 2);
    syncMission(3, stageProgressToMarker(state.missionStartDist));
    document.getElementById('hud-mission-hint').textContent = 'Lose the cruiser, then get to the marker.';
    // Pull the cruiser in close for the frame, then shoot from a high 3/4
    // angle so the palm crowns read as trees (side view), not a grey wedge.
    police.cruiser.car.pos.set(car.pos.x - 14, 0, car.pos.z + 1);
    police.cruiser.car.heading = Math.PI / 2;
    game.vehicles.updateVisuals(0.016); // sync the cruiser mesh to its new pos
    camera.setCinematic(new THREE.Vector3(car.pos.x - 22, 16, car.pos.z - 20), new THREE.Vector3(car.pos.x + 4, 2, car.pos.z));
  } else if (n === '2') {
    // 2 — Mission in progress: driving to the marker in daylight, the
    // pink Marina Sedan on the boulevard, plaza and towers ahead.
    sky.applyPreset('day', true);
    game.applyGlow();
    const car = vehicles.cars.find((c) => c.parked && Math.abs(c.pos.x + 40) < 1 && Math.abs(c.pos.z - 38.5) < 1)
      || vehicles.cars.find((c) => c.parked);
    car.pos.set(-40, 0, 50);
    car.heading = Math.PI / 2;
    enterCarForShot(game, car, 12);
    setObjective('Drive to the marker', { x: 150, z: 50 }, 'Drop-off');
    state.missionStartDist = Math.hypot(150 - -40, 50 - 50);
    simulate(game, 2);
    syncMission(3, stageProgressToMarker(state.missionStartDist));
    document.getElementById('hud-mission-hint').textContent = 'Don’t scratch the paint — the SAMPD is watching.';
    // Mission framing: diagonal high view across the boulevard toward the
    // plaza and towers, the driven car on-axis in the lower centre.
    camera.setCinematic(new THREE.Vector3(car.pos.x - 30, 18, car.pos.z + 26), new THREE.Vector3(car.pos.x + 30, 4, car.pos.z - 20));
  } else if (n === '3') {
    // 3 — Drift near the lift bridge: the car slides sideways on the
    // x=50 approach road, tire smoke at the rear wheels, the lift towers
    // and canal water behind it at golden hour.
    sky.applyPreset('sunset', true);
    game.applyGlow();
    // The pink Marina Sedan (the player's car) — the hero car, not a
    // random traffic colour.
    const car = vehicles.cars.find((c) => c.parked && Math.abs(c.pos.x + 40) < 1 && Math.abs(c.pos.z - 38.5) < 1)
      || vehicles.cars.find((c) => c.parked);
    car.pos.set(50, 0, -228);
    car.heading = Math.PI; // north, toward the bridge
    enterCarForShot(game, car, 18);
    setObjective('Drift the bridge approach');
    state.marker = { x: 150, z: 50 };
    state.markerLabel = 'Drop-off';
    state.missionStartDist = 190;
    // The drift: full throttle + hard left + handbrake for half a second.
    // drive() sets car.drifting, and updateVisuals puffs smoke at the
    // rear wheels while it lasts. The final pose is frozen explicitly
    // (the loop is only there to lay the smoke trail).
    for (let i = 0; i < 30; i += 1) {
      game.vehicles.drive(car, STEP, 1, -0.6, false, true);
      state.speed = car.speed;
      state.time += STEP;
      state.clockMinutes += STEP * 0.5;
      state.missionTime += STEP;
      game.vehicles.updateVisuals(STEP);
    }
    // Freeze the pose mid-slide: on the approach road, angled ~35° to it,
    // still fast. The smoke trail sits behind the rear wheels.
    car.pos.set(50, 0, -238);
    car.heading = Math.PI + 0.6;
    car.speed = 14;
    state.speed = 14;
    game.vehicles.updateVisuals(0.016);
    syncMission(3, 0.72);
    document.getElementById('hud-mission-hint').textContent = 'Handbrake through the turn — smoke the rears.';
    // Higher, further back: the canal water reads (a low angle hides it
    // behind the deck), the towers + sign clear the topmid HUD, and the
    // SAN AMARO sign drops to the frame edge instead of the centre.
    camera.setCinematic(new THREE.Vector3(50, 6, -215), new THREE.Vector3(50, 1, -255));
  } else {
    // 4 — Neon street at night: low street-level view down the boulevard,
    // lit windows, lamp pools, neon signs. The camera sits BETWEEN two
    // power poles (x=-105, poles are every 30 m at z=39) and on the road
    // centre, so no pole lands dead-centre and no block wall crowds the
    // left edge.
    sky.applyPreset('night', true);
    game.applyGlow();
    player.pos.set(-128, 0, 42);
    player.heading = Math.PI / 2; // face east, down the boulevard
    player.group.position.copy(player.pos);
    player.group.rotation.y = player.heading;
    camera.setCinematic(new THREE.Vector3(-105, 4.5, 44), new THREE.Vector3(0, 2.5, 52));
    setObjective('Explore San Amaro');
    simulate(game, 4);
    syncMission(1, 0.1);
  }
  game.camera.update(0.016, game.focusPos(), game.focusHeading(), state.speed);
}
