// SAN AMARO — vehicles. Low-poly cars built from boxes + cylinders, all
// procedural. Arcade driving, traffic that loops the street grid, and SAMPD
// pursuit units. Written from scratch from the re-author spec.
const THREE = globalThis.THREE;

function mat(color, rough = 0.35, metal = 0.55, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}
const GLASS = mat(0x101826, 0.12, 0.9, { envMapIntensity: 1.5 });
const TYRE = mat(0x14141a, 0.95, 0.0);
const RIM = mat(0xd8d8e0, 0.25, 0.9);
const CHROME = mat(0xe8ecf2, 0.15, 1.0);
const HEADLIGHT = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9a8, emissiveIntensity: 2.6 });
const TAILLIGHT = new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 2.2 });
const LED = new THREE.MeshStandardMaterial({ color: 0x22e6ff, emissive: 0x22e6ff, emissiveIntensity: 2.4 });

// Car specs (from the spec §7; colours matched to the reference screenshots).
const SPECS = {
  comet:    { name: 'Comet GT',     kind: 'Sports',  top: 52, color: 0xff2e6a, wing: true,  led: true },
  sedan:    { name: 'Marina Sedan', kind: 'Sedan',   top: 42, color: 0x4a7ab5, wing: false, led: false },
  muscle:   { name: 'Bruiser',      kind: 'Muscle',  top: 46, color: 0x1c1c22, wing: false, led: false },
  van:      { name: 'Hopper Van',   kind: 'Van',     top: 36, color: 0xe8dcc0, wing: false, led: false },
  truck:    { name: 'Longhaul',     kind: 'Truck',   top: 33, color: 0xc96a2e, wing: false, led: false },
  police:   { name: 'Interceptor',  kind: 'Police',  top: 50, color: 0xf2f2f2, wing: false, led: false, police: true },
  lowrider: { name: 'Flamingo',     kind: 'Lowrider',top: 39, color: 0xff6fb5, wing: false, led: true },
};

function wheel(r = 0.34, w = 0.24) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 12), TYRE);
  tyre.rotation.z = Math.PI / 2;
  g.add(tyre);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 8), RIM);
  rim.rotation.z = Math.PI / 2;
  g.add(rim);
  return g;
}

// Build one car. Returns { group, wheels:[FL,FR,RL,RR], body, spec }.
// The car faces +Z (forward). Length ~4.4m, width ~1.9m.
export function buildCar(type) {
  const spec = SPECS[type] || SPECS.sedan;
  const g = new THREE.Group();
  const paint = mat(spec.color, 0.3, 0.6, { envMapIntensity: 1.2 });
  const isVan = type === 'van', isTruck = type === 'truck';
  const L = isTruck ? 5.6 : isVan ? 4.8 : 4.4;
  const W = isTruck || isVan ? 2.1 : 1.9;

  // main body (lower slab)
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.62, L), paint);
  body.position.y = 0.55; g.add(body);
  // cabin / upper body
  if (isVan) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 1.0, L * 0.62), paint);
    cab.position.set(0, 1.3, -L * 0.12); g.add(cab);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.55, 0.1), GLASS);
    windshield.position.set(0, 1.35, L * 0.2); g.add(windshield);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.1, L * 0.4), mat(0x3a3a42, 0.6, 0.5));
    rack.position.set(0, 1.86, -L * 0.12); g.add(rack);
  } else if (isTruck) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W, 1.5, 1.6), paint);
    cab.position.set(0, 1.4, L * 0.28); g.add(cab);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.7, 0.1), GLASS);
    shield.position.set(0, 1.55, L * 0.28 + 0.82); g.add(shield);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.5, 0.3), CHROME);
    bar.position.set(0, 0.6, L / 2 + 0.1); g.add(bar);
  } else {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W - 0.35, 0.55, L * 0.48), GLASS);
    cab.position.set(0, 1.05, -L * 0.06); g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.1, L * 0.42), paint);
    roof.position.set(0, 1.36, -L * 0.06); g.add(roof);
    // hood scoop for muscle
    if (type === 'muscle') {
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 1.0), mat(0x111116, 0.4, 0.6));
      scoop.position.set(0, 0.95, L * 0.22); g.add(scoop);
    }
  }
  // chrome trim strip
  const trim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.08, L * 0.96), CHROME);
  trim.position.y = 0.72; g.add(trim);
  // headlights + taillights
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), HEADLIGHT);
    hl.position.set(sx * (W / 2 - 0.28), 0.72, L / 2 + 0.02); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), TAILLIGHT);
    tl.position.set(sx * (W / 2 - 0.28), 0.72, -L / 2 - 0.02); g.add(tl);
  }
  // spoiler wing (Comet GT)
  if (spec.wing) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(W + 0.15, 0.07, 0.5), mat(0x14141a, 0.4, 0.6));
    wing.position.set(0, 1.18, -L / 2 + 0.15); g.add(wing);
    for (const sx of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), mat(0x14141a, 0.4, 0.6));
      strut.position.set(sx * (W / 2 - 0.15), 1.0, -L / 2 + 0.15); g.add(strut);
    }
  }
  // LED strips (Comet GT / Flamingo)
  if (spec.led) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.06, L * 0.9), LED);
    strip.position.y = 0.42; g.add(strip);
  }
  // police livery + light bar
  if (spec.police) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 1.6),
      mat(0x1c2a5a, 0.4, 0.5));
    for (const sx of [-1, 1]) { const d = door.clone(); d.position.set(sx * (W / 2 + 0.01), 0.62, 0.1); g.add(d); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.3), mat(0x22222a, 0.4, 0.6));
    bar.position.set(0, 1.42, -L * 0.06); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 3 }));
    red.position.set(-0.28, 1.54, -L * 0.06); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x2266ff, emissiveIntensity: 3 }));
    blue.position.set(0.28, 1.54, -L * 0.06); g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
    const push = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.4, 0.15), mat(0x22222a, 0.4, 0.7));
    push.position.set(0, 0.5, L / 2 + 0.12); g.add(push);
  }
  // wheels
  const wheels = [];
  const wy = 0.34, wx = W / 2 - 0.05, wzF = L / 2 - 0.85, wzR = -L / 2 + 0.85;
  for (const [x, z] of [[-wx, wzF], [wx, wzF], [-wx, wzR], [wx, wzR]]) {
    const w = wheel();
    w.position.set(x, wy, z);
    g.add(w); wheels.push(w);
  }
  // blob shadow (cheap contact shadow)
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.6, L + 0.6),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03;
  g.add(blob);

  g.userData = { ...g.userData, spec, wheels, body, L, W, speed: 0, steer: 0, airPitch: 0 };
  return { group: g, wheels, body, spec };
}

// Pitch the whole car (bridge jump: nose-up while airborne).
export function setAirPitch(car, pitch, lift) {
  car.group.rotation.x = -pitch; // nose up
  car.group.position.y = lift;
  car.group.userData.airPitch = pitch;
}

// ---- traffic: cars looping the street grid ----
export function makeTraffic(scene, count = 30) {
  const cars = [];
  const types = ['sedan', 'sedan', 'muscle', 'van', 'truck', 'lowrider', 'sedan'];
  const streetsZ = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
  const streetsX = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const { group } = buildCar(type);
    const alongZ = i % 2 === 0;
    const street = alongZ ? streetsZ[i % streetsZ.length] : streetsX[i % streetsX.length];
    const dir = (i % 4 < 2) ? 1 : -1;
    const lane = (i % 3 - 1) * 2.6;
    const pos = -280 + ((i * 37) % 560);
    if (alongZ) {
      group.position.set(pos, 0, street + lane);
      group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      group.position.set(street + lane, 0, pos);
      group.rotation.y = dir > 0 ? Math.PI : 0;
    }
    scene.add(group);
    cars.push({ group, alongZ, street, dir, lane, speed: 7 + (i % 5) * 1.6, pos });
  }
  return {
    cars,
    update(dt) {
      for (const c of cars) {
        c.pos += c.dir * c.speed * dt;
        if (c.pos > 285) c.pos = -285;
        if (c.pos < -285) c.pos = 285;
        if (c.alongZ) c.group.position.x = c.pos;
        else c.group.position.z = c.pos;
        // spin wheels
        const w = c.group.userData.wheels;
        for (const wh of w) wh.rotation.x += (c.speed * dt) / 0.34;
      }
    },
  };
}

// ---- parked cars along curbs ----
export function makeParked(scene, count = 18) {
  const spots = [];
  const types = ['sedan', 'muscle', 'van', 'lowrider', 'sedan'];
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const { group } = buildCar(type);
    const alongZ = i % 2 === 0;
    const streets = [-180, -60, 60, 180];
    const s = streets[i % streets.length];
    const pos = -230 + ((i * 53) % 460);
    const side = (i % 2 === 0) ? 1 : -1;
    if (alongZ) {
      group.position.set(pos, 0, s + side * 8.6);
      group.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      group.position.set(s + side * 8.6, 0, pos);
      group.rotation.y = side > 0 ? Math.PI : 0;
    }
    scene.add(group);
    spots.push(group);
  }
  return spots;
}

// ---- SAMPD pursuit units ----
export function makePolice(scene) {
  const units = [];
  const defs = [
    { call: 'BAY-12', kind: 'cruiser' },
    { call: 'VICTOR-7', kind: 'interceptor' },
    { call: 'AIR-1', kind: 'heli' },
  ];
  for (const d of defs) {
    if (d.kind === 'heli') {
      const heli = buildHelicopter();
      scene.add(heli.group);
      units.push({ call: d.call, kind: 'heli', group: heli.group, rotor: heli.rotor, light: heli.light });
    } else {
      const { group } = buildCar('police');
      scene.add(group);
      units.push({ call: d.call, kind: d.kind, group, speed: 0 });
    }
  }
  return units;
}

function buildHelicopter() {
  const g = new THREE.Group();
  const bodyMat = mat(0xf2f2f2, 0.4, 0.4);
  const navy = mat(0x1c2a5a, 0.4, 0.5);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 4.6), bodyMat);
  body.position.y = 0; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 1.2), navy);
  nose.position.set(0, -0.1, 2.6); g.add(nose);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 0.9), GLASS);
  glass.position.set(0, 0.35, 2.4); g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), bodyMat);
  tail.position.set(0, 0.3, -4.0); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.0), navy);
  fin.position.set(0, 0.8, -5.8); g.add(fin);
  const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4.4), mat(0x22222a, 0.5, 0.6));
  skidL.position.set(-0.9, -1.1, 0.4); g.add(skidL);
  const skidR = skidL.clone(); skidR.position.x = 0.9; g.add(skidR);
  const rotor = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 5.4), mat(0x22222a, 0.4, 0.6));
    blade.position.z = (i % 2 === 0 ? 2.7 : -2.7);
    if (i >= 2) blade.rotation.y = Math.PI / 2;
    rotor.add(blade);
  }
  rotor.position.y = 1.1; g.add(rotor);
  // searchlight (a cone of light, subtle)
  const coneGeo = new THREE.ConeGeometry(2.2, 20, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(0, -14, 1.2); cone.rotation.x = Math.PI; g.add(cone);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9a8, emissiveIntensity: 3 }));
  light.position.set(0, -0.9, 1.6); g.add(light);
  return { group: g, rotor, light };
}
