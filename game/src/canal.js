// Canal + Canal Lift Bridge (Old Canal District's edge, at the north of the
// Downtown slice): a water strip along the north edge (z -300..-262, beyond
// the last road and the last block row, so it floods nothing) and a lift
// bridge carrying the x=50 road across it. The bridge is the set-piece for
// the drift screenshot (?shot=3): two steel lift towers, a low deck, gates
// and warning lights. All procedural, no network.
import * as THREE from 'three';
import { canvasTexture, mergeGeoms, signTexture } from './utils.js';
import { state } from './state.js';

const CANAL = { z0: -300, z1: -262, x: 50 }; // water strip + bridge road

function waterTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0e2a3a';
    ctx.fillRect(0, 0, w, h);
    // Long horizontal streaks: canal water catching the sky. Cool tones
    // only — the old warm orange streaks are what made the canal read as
    // a pink sunset band instead of water (slice 3).
    for (let i = 0; i < 90; i += 1) {
      const y = Math.random() * h;
      const len = 20 + Math.random() * 80;
      const x = Math.random() * w;
      ctx.fillStyle = Math.random() < 0.7 ? 'rgba(120,180,210,0.16)' : 'rgba(200,230,245,0.12)';
      ctx.fillRect(x, y, len, 1.5);
    }
  }, { repeat: [8, 1] });
}

export class Canal {
  constructor(scene) {
    this.scene = scene;
    // Water: a reflective plane over the canal strip. The texture scrolls
    // slowly (see update) so the water reads as moving, not painted.
    this.waterMat = new THREE.MeshStandardMaterial({
      map: waterTexture(), color: 0x4a7a8a, roughness: 0.12, metalness: 0.85,
      envMapIntensity: 1.2, // lighter teal + stronger sky reflection, so the
      // canal reads as a luminous water strip beyond the bridge — the
      // deep-teal fix killed the pink band but left the water nearly
      // invisible against the dark road (slice 3, round 2).
    });
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(600, CANAL.z1 - CANAL.z0),
      this.waterMat,
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.06, (CANAL.z0 + CANAL.z1) / 2);
    water.receiveShadow = true;
    scene.add(water);
    this.water = water;

    // Seawalls: low concrete walls along both canal edges, with a gap at
    // the bridge road (x 42..58) on the south side.
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.9, metalness: 0 });
    const wallParts = [];
    const addWall = (w, x, z) => {
      const g = new THREE.BoxGeometry(w, 1.1, 1);
      const m = new THREE.Matrix4().setPosition(x, 0.55, z);
      wallParts.push({ geo: g, matrix: m, uvScale: [1, 1] });
    };
    // South wall in two runs (gap for the bridge).
    addWall(342, -300 + 171, CANAL.z1); // x -300..42
    addWall(242, 58 + 121, CANAL.z1); // x 58..300
    // North wall (the world edge).
    addWall(600, 0, CANAL.z0);
    const walls = new THREE.Mesh(mergeGeoms(wallParts), wallMat);
    walls.castShadow = true;
    walls.receiveShadow = true;
    scene.add(walls);
    state.colliders.push({ x0: -300, z0: CANAL.z1 - 0.5, x1: 42, z1: CANAL.z1 + 0.5 });
    state.colliders.push({ x0: 58, z0: CANAL.z1 - 0.5, x1: 300, z1: CANAL.z1 + 0.5 });
    state.colliders.push({ x0: -300, z0: CANAL.z0 - 0.5, x1: 300, z1: CANAL.z0 + 0.5 });

    // Lift bridge at x=50: a low deck (flush with the road) + two steel
    // lift towers flanking the channel + striped gates + warning lights.
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.85, metalness: 0.2 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, CANAL.z1 - CANAL.z0 + 2), deckMat);
    deck.position.set(CANAL.x, 0.15, (CANAL.z0 + CANAL.z1) / 2);
    deck.receiveShadow = true;
    scene.add(deck);

    // Towers: two vertical truss posts + a top crossbeam + an operator
    // house, one tower on each canal edge. Steel teal, like the city.
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x2a6a72, roughness: 0.5, metalness: 0.7 });
    const towerParts = [];
    const addTower = (z) => {
      for (const sx of [-9, 9]) {
        const g = new THREE.BoxGeometry(1.2, 19, 1.2);
        const m = new THREE.Matrix4().setPosition(CANAL.x + sx, 9.5, z);
        towerParts.push({ geo: g, matrix: m, uvScale: [1, 1] });
        // Cross-bracing: diagonal bars between the posts.
        const brace = new THREE.BoxGeometry(0.5, 13, 0.5);
        const bm = new THREE.Matrix4().setPosition(CANAL.x + sx * 0.4, 9.5, z);
        bm.multiply(new THREE.Matrix4().makeRotationZ(sx > 0 ? 0.5 : -0.5));
        towerParts.push({ geo: brace, matrix: bm, uvScale: [1, 1] });
      }
      const beam = new THREE.BoxGeometry(20, 1.4, 1.6);
      const beamM = new THREE.Matrix4().setPosition(CANAL.x, 18.5, z);
      towerParts.push({ geo: beam, matrix: beamM, uvScale: [1, 1] });
      const house = new THREE.BoxGeometry(4, 2.4, 3);
      const houseM = new THREE.Matrix4().setPosition(CANAL.x + 6, 20, z);
      towerParts.push({ geo: house, matrix: houseM, uvScale: [1, 1] });
    };
    addTower(CANAL.z1);
    addTower(CANAL.z0);
    const towers = new THREE.Mesh(mergeGeoms(towerParts), steelMat);
    towers.castShadow = true;
    scene.add(towers);
    // Tower colliders (the posts flank the road, so cars pass between them).
    for (const z of [CANAL.z1, CANAL.z0]) {
      for (const sx of [-9, 9]) {
        state.colliders.push({
          x0: CANAL.x + sx - 0.8, z0: z - 0.8,
          x1: CANAL.x + sx + 0.8, z1: z + 0.8,
        });
      }
    }

    // Gates: red-white striped arms, raised (open) so traffic crosses.
    const gateTex = canvasTexture(128, 16, (ctx, w, h) => {
      for (let i = 0; i < 8; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? '#e8e8e8' : '#d81e1e';
        ctx.fillRect(i * 16, 0, 16, h);
      }
    });
    const gateMat = new THREE.MeshStandardMaterial({ map: gateTex, roughness: 0.6, metalness: 0.1 });
    for (const z of [CANAL.z1 - 4, CANAL.z0 + 4]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 7, 0.25), gateMat);
      arm.position.set(CANAL.x - 8.5, 3.5, z);
      arm.rotation.z = 0.12; // nearly vertical = raised/open
      scene.add(arm);
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 1.4, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.5, metalness: 0.4 }),
      );
      post.position.set(CANAL.x - 8.5, 0.7, z);
      scene.add(post);
    }

    // Warning lights: red beacons on the tower tops (pulse in update).
    this.beaconMat = new THREE.MeshStandardMaterial({
      color: 0x330000, emissive: 0xff2020, emissiveIntensity: 1.5,
    });
    const beaconGeo = new THREE.SphereGeometry(0.35, 10, 8);
    for (const z of [CANAL.z1, CANAL.z0]) {
      const b = new THREE.Mesh(beaconGeo, this.beaconMat);
      b.position.set(CANAL.x, 19.6, z);
      scene.add(b);
    }
    // A "CANAL LIFT BRIDGE" sign on the south tower (canvas texture).
    const signTex = signTexture('CANAL LIFT BRIDGE', '', '#10121a', '#22e6ff', 512, 96);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 1.9),
      new THREE.MeshStandardMaterial({ map: signTex.map, emissiveMap: signTex.emissive, emissive: 0xffffff, emissiveIntensity: 0.5, side: THREE.DoubleSide }),
    );
    sign.position.set(CANAL.x, 13.5, CANAL.z1 + 0.9);
    scene.add(sign);
  }

  update() {
    // Water scrolls slowly; the tower beacons pulse.
    if (this.waterMat.map) this.waterMat.map.offset.x = (state.time * 0.008) % 1;
    this.beaconMat.emissiveIntensity = 1.0 + 1.2 * (0.5 + 0.5 * Math.sin(state.time * 3));
  }
}
