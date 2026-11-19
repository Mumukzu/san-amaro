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
  }
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
  // Keep the HUD clock honest: the preset applied below is the time of day.
  state.timePreset = ({ '1': 'day', '2': 'night', '3': 'sunset', '4': 'day' })[n] || 'sunset';
  hud.hideMenus();
  sky.applyPreset('sunset', true);
  game.applyGlow();

  if (n === '1') {
    // Daytime open-world view: on foot on the boulevard, towers ahead.
    sky.applyPreset('day', true);
    game.applyGlow();
    player.pos.set(0, 0, 20);
    player.heading = Math.PI; // face north, toward the plaza and towers
    player.group.position.copy(player.pos);
    player.group.rotation.y = player.heading;
    camera.setCinematic(new THREE.Vector3(0, 26, 62), new THREE.Vector3(0, 12, -160));
    setObjective('Explore San Amaro');
    simulate(game, 4);
  } else if (n === '2') {
    // Night neon street: low street-level view down the boulevard.
    sky.applyPreset('night', true);
    game.applyGlow();
    player.pos.set(-128, 0, 42);
    player.heading = Math.PI / 2; // face east, down the boulevard
    player.group.position.copy(player.pos);
    player.group.rotation.y = player.heading;
    camera.setCinematic(new THREE.Vector3(-118, 2.4, 44), new THREE.Vector3(-30, 4, 50));
    setObjective('Explore San Amaro');
    simulate(game, 4);
  } else if (n === '3') {
    // Police chase at sunset: player driving east, cruiser behind, 2 stars.
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
    simulate(game, 2);
    // Pull the cruiser in close for the frame, then shoot from a high 3/4
    // angle so the palm crowns read as trees (side view), not a grey wedge.
    police.cruiser.car.pos.set(car.pos.x - 14, 0, car.pos.z + 1);
    police.cruiser.car.heading = Math.PI / 2;
    game.vehicles.updateVisuals(0.016); // sync the cruiser mesh to its new pos
    camera.setCinematic(new THREE.Vector3(car.pos.x - 22, 16, car.pos.z - 20), new THREE.Vector3(car.pos.x + 4, 2, car.pos.z));
  } else {
    // Mission HUD + minimap: driving to a marker in daylight.
    sky.applyPreset('day', true);
    game.applyGlow();
    const car = vehicles.cars.find((c) => c.parked && Math.abs(c.pos.x + 40) < 1 && Math.abs(c.pos.z - 38.5) < 1)
      || vehicles.cars.find((c) => c.parked);
    car.pos.set(-40, 0, 50);
    car.heading = Math.PI / 2;
    enterCarForShot(game, car, 12);
    setObjective('Drive to the marker', { x: 150, z: 50 }, 'Drop-off');
    simulate(game, 2);
    // Mission framing: diagonal high view across the boulevard toward the
    // plaza and towers, the driven car on-axis in the lower centre.
    camera.setCinematic(new THREE.Vector3(car.pos.x - 30, 18, car.pos.z + 26), new THREE.Vector3(car.pos.x + 30, 4, car.pos.z - 20));
  }
  game.camera.update(0.016, game.focusPos(), game.focusHeading(), state.speed);
}
