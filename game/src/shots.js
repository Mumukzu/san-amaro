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
    // 1 — Police chase at golden hour: a LIVING chase, not a diorama. The
    // player car slides east with BAY-12 on its tail and VICTOR-7 pulling
    // alongside, AIR-1's searchlight overhead, and six pedestrians
    // RUNNING for the sidewalks — mid-stride, some glancing back at the
    // cruisers, one close to the camera so its cartoon face reads.
    // (Slice 3, Mu's order: if an NPC reads as a static statue, the cover
    // fails. The chase must look like a real moment caught mid-action.)
    sky.applyPreset('sunset', true);
    game.applyGlow();
    const car = vehicles.cars.find((c) => c.parked && Math.abs(c.pos.x - 20) < 1 && Math.abs(c.pos.z - 38.5) < 1)
      || vehicles.cars.find((c) => c.parked);
    car.pos.set(10, 0, 50);
    car.heading = Math.PI / 2;
    enterCarForShot(game, car, 16);
    police.setWanted(2); // also spawns VICTOR-7 (auto, ~55 m out on a road)
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
    document.getElementById('hud-mission-hint').textContent = 'Two cruisers on you — lose them, then get to the marker.';
    // The chase formation, frozen mid-moment: the player car slides a
    // touch sideways (a handbrake burst lays tyre smoke behind it),
    // BAY-12 tucked 14 m behind, VICTOR-7 pulling alongside in the next
    // lane, both light bars flashing.
    for (let i = 0; i < 10; i += 1) {
      game.vehicles.drive(car, STEP, 1, 0.25, false, true);
      state.speed = car.speed;
      state.time += STEP;
      game.vehicles.updateVisuals(STEP);
    }
    car.pos.set(10, 0, 50);
    car.heading = Math.PI / 2 + 0.18;
    car.speed = 16;
    state.speed = 16;
    // The cruisers sit a lane over from the player car (BAY-12 one lane
    // south, VICTOR-7 in the far lane) so they read BESIDE it, not hidden
    // directly behind it from the rear camera (round 2 hid BAY-12
    // behind the Comet GT). Close in, too: at 9–13 m ahead their light
    // bars were too small to read as police (round 3), so BAY-12 sits
    // 6 m ahead and VICTOR-7 11 m ahead.
    police.cruiser.car.pos.set(car.pos.x + 6, 0, car.pos.z + 3);
    police.cruiser.car.heading = Math.PI / 2;
    police.cruiser.car.speed = 18;
    if (police.cruiser2) {
      police.cruiser2.car.pos.set(car.pos.x + 11, 0, car.pos.z + 6.5);
      police.cruiser2.car.heading = Math.PI / 2;
      police.cruiser2.car.speed = 20;
    }
    game.vehicles.updateVisuals(0.016); // sync the cruisers + smoke to the pose
    // Fleeing pedestrians: six of them, spread across the frame, all
    // mid-stride. Two on each sidewalk running away from the chase, one
    // darting across the road ahead of the player car, and one on the near
    // sidewalk close to the camera, glancing back over its shoulder so
    // its face reads. (Picked from the live crowd, not spawned — the cover
    // is a moment of the running game, not a diorama built for the camera.)
    const fleeSpots = [
      { x: car.pos.x + 10, z: 40.5, heading: Math.PI / 2, phase: 0.4, twist: 0.45 }, // near sidewalk, east, glancing back
      { x: car.pos.x + 6, z: 40.5, heading: -Math.PI / 2, phase: 2.1, twist: -0.5 }, // near sidewalk, west, glancing back
      { x: car.pos.x + 14, z: 59.5, heading: Math.PI / 2, phase: 1.3, twist: 0 }, // far sidewalk, east
      { x: car.pos.x - 4, z: 59.5, heading: -Math.PI / 2, phase: 3.6, twist: 0.4 }, // far sidewalk, west, glancing back
      { x: car.pos.x + 20, z: 47, heading: Math.PI, phase: 5.0, twist: -0.3 }, // crossing the road ahead, north
      { x: car.pos.x + 4, z: 45, heading: Math.PI / 2, phase: 4.2, twist: 0.5 }, // near camera, on the road edge, glancing back at the lens
    ];
    const crowd = game.peds.peds.filter((p) => !p.down);
    fleeSpots.forEach((spot, i) => {
      const ped = crowd[i];
      if (!ped) return;
      ped.pos.set(spot.x, 0, spot.z);
      ped.heading = spot.heading;
      ped.down = false;
      game.peds.poseFlee(ped, spot.phase, spot.twist);
    });
    // AIR-1 overhead: a police helicopter with its searchlight on the
    // chase. A staging prop for the cover only (the live game has no
    // helicopter yet) — built from primitives, no network, four meshes.
    const heli = new THREE.Group();
    const heliMat = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.5, metalness: 0.4 });
    const heliBody = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.6, 2.2), heliMat);
    heli.add(heliBody);
    const heliTail = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.7, 0.7), heliMat);
    heliTail.position.set(-3.6, 0.3, 0);
    heli.add(heliTail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.6 }));
    rotor.position.y = 1.1;
    rotor.rotation.y = 0.6;
    heli.add(rotor);
    // The searchlight cone: apex at the heli, base pooling on the road.
    // The heli flies low enough to sit in the upper frame (at 30 m it was
    // above the frame and only the cone showed). At 15 m it sat behind
    // the top HUD panels — at 12 m it clears them and reads as a
    // helicopter, not a dark shape cut by the frame edge.
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(6, 13, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.y = -6.5;
    heli.add(beam);
    heli.position.set(car.pos.x + 16, 12, car.pos.z - 5);
    game.scene.add(heli);
    // CLOSE behind-car framing (Mu 19 Nov ~16:26): the Comet GT is the
    // hero — BIG in the lower frame, the city towers behind it, not a
    // wide distant shot. Low 3/4 rear view from just behind the car, a
    // touch to the north so the car sits centre-frame (not at the edge):
    // the car dominates, BAY-12 peeks out beside it, VICTOR-7 in the
    // next lane, AIR-1 above, the near-sidewalk peds at the frame edges.
    // (The old 11 m distant framing made the car small; and the palm
    // that stood dead-centre in the road is gone at the root — props.js
    // now drops any palm or lamp the rows plant on the asphalt. Round 1
    // put the camera too close and too far north: the car landed at the
    // bottom-right edge, half cut by the vehicle panel, and the cruisers
    // were out of frame. Round 2 centred the car but BAY-12 hid directly
    // behind it and the heli sat behind the top HUD panels. Round 3 made
    // the car big and the heli readable, but the cruisers' light bars
    // were too small to read as police and the car's nose sat behind the
    // vehicle panel — so round 4 pulls the cruisers closer and centres
    // the car a touch more.)
    camera.shake = 0.08;
    camera.setCinematic(new THREE.Vector3(car.pos.x - 8, 3.2, car.pos.z - 2.5), new THREE.Vector3(car.pos.x + 20, 2.4, car.pos.z + 1));
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
    // plaza and towers, the driven car on-axis in the lower centre. The
    // look target is shifted east so the Glass Spire tower moves off the
    // top-centre axis (it used to sit behind the wanted stars), and the
    // camera is a little closer so the Marina reads bigger (slice 3).
    camera.setCinematic(new THREE.Vector3(car.pos.x - 24, 15, car.pos.z + 22), new THREE.Vector3(car.pos.x + 70, 4, car.pos.z - 20));
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
    // Higher and further back than the old angle: the canal water reads
    // as a deep-teal strip beyond the deck (a low angle hides it behind
    // the road), the towers + sign clear the topmid HUD, and the SAN
    // AMARO sign drops to the frame edge instead of the centre.
    camera.setCinematic(new THREE.Vector3(54, 10, -205), new THREE.Vector3(52, 1, -255));
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
    // Foreground life (slice 3): the old frame's lower half was an empty
    // road. Two pedestrians strolling on the near sidewalk, a parked car
    // on the south curb and a traffic car on the road, all just ahead of
    // the camera — the street reads as inhabited, not deserted.
    const nearPeds = game.peds.peds.filter((p) => !p.down).slice(0, 2);
    const walkSpots = [
      { x: -88, z: 40, heading: Math.PI / 2, phase: 0.8 },
      { x: -70, z: 41, heading: Math.PI / 2, phase: 2.6 },
    ];
    nearPeds.forEach((ped, i) => {
      const spot = walkSpots[i];
      if (!spot) return;
      ped.pos.set(spot.x, 0, spot.z);
      ped.heading = spot.heading;
      ped.down = false;
      game.peds.poseStride(ped, spot.phase, false);
    });
    const parked = vehicles.cars.find((c) => c.parked && c !== state.vehicle);
    if (parked) {
      parked.pos.set(-95, 0, 38.5);
      parked.heading = Math.PI / 2;
    }
    const mover = vehicles.cars.find((c) => !c.parked && !c.isPolice && c !== state.vehicle);
    if (mover) {
      mover.pos.set(-55, 0, 47);
      mover.heading = Math.PI / 2;
      mover.speed = 8;
    }
    game.vehicles.updateVisuals(0.016);
  }
  game.camera.update(0.016, game.focusPos(), game.focusHeading(), state.speed);
}
