// San Amaro — every tuning number and colour in one place.
// Three.js r160, vendored as game/vendor/three.min.js. Runtime: zero network.
export const THREE_VERSION = '0.160.0';

export const WORLD = {
  size: 600, // world spans x,z in [-300, 300]
  roadAt: [-250, -150, -50, 50, 150, 250], // road centre lines (both axes)
  roadHalf: 8, // half width of the road surface (16 m roads)
  walkHalf: 12, // half width including sidewalks
  blockAt: [-200, -100, 0, 100, 200], // block centres
  blockHalf: 38, // buildings must stay inside block centre +/- 38
  seed: 20261119, // one seed: the same seed always builds the same city
};

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 8.5,
  jumpSpeed: 7.5,
  radius: 0.45,
  height: 1.8,
};

export const CAR = {
  accel: 14, // m/s^2
  brake: 26,
  reverseAccel: 8,
  maxSpeed: 32, // ~115 km/h
  maxReverse: 9,
  drag: 0.55, // per second at speed
  steerMax: 0.55, // radians at the front wheels
  steerSpeed: 2.4,
  radius: 1.7, // collision circle
  length: 4.4,
  width: 1.9,
};

export const TRAFFIC_COUNT = 12;
export const PED_COUNT = 24;
export const PARKED_COUNT = 6;

export const POLICE = {
  maxWanted: 3,
  chaseSpeed: 34,
  bustDistance: 4.5,
  bustTime: 1.6, // seconds of contact at low speed before busted
  escapeDistance: 90,
  escapeTime: 6,
};

// Time-of-day presets. The default is golden hour (sunset): the neon
// Miami-sunset mood. Golden hour means a LOW warm sun, long shadows and a
// violet-to-orange sky — never a pale wash. Night stays readable: lamps,
// neon and lit windows carry it, never near-black.
export const TIME_PRESETS = {
  day: {
    sunElev: 62, sunAzim: 205, sunColor: 0xfff2dd, sunIntensity: 3.6,
    hemiSky: 0x8fb8dd, hemiGround: 0x6a5f52, hemiIntensity: 0.85,
    skyTop: 0x2a6fd0, skyHorizon: 0xbfe0ea, fogColor: 0xaec6d2, fogDensity: 0.0007,
    exposure: 1.08, windowGlow: 0.1, lampOn: false, headlightOn: false,
  },
  sunset: {
    sunElev: 9, sunAzim: 252, sunColor: 0xff8a2a, sunIntensity: 4.2,
    hemiSky: 0xd8a080, hemiGround: 0x4a3f36, hemiIntensity: 0.75,
    skyTop: 0x3d2f6e, skyHorizon: 0xff7a3c, fogColor: 0xc97a4a, fogDensity: 0.0011,
    exposure: 1.15, windowGlow: 1.0, lampOn: true, headlightOn: true,
  },
  night: {
    sunElev: 42, sunAzim: 130, sunColor: 0x9ab4ff, sunIntensity: 1.0,
    hemiSky: 0x3a4a70, hemiGround: 0x241c18, hemiIntensity: 0.75,
    skyTop: 0x0d1330, skyHorizon: 0x3a2a55, fogColor: 0x232840, fogDensity: 0.0016,
    exposure: 1.18, windowGlow: 2.0, lampOn: true, headlightOn: true,
  },
};
export const TIME_ORDER = ['day', 'sunset', 'night'];
export const DEFAULT_TIME = 'sunset';

export const PALETTE = {
  asphalt: '#26262b', // dark asphalt: roads read as roads, never pale slabs
  asphaltWet: '#1e1e24',
  sidewalk: '#7d766c', // warm concrete with tile joints (see world.js)
  curb: '#5a544c',
  crosswalk: '#c8c4b8',
  laneYellow: '#e8c832',
  laneWhite: '#c8c8c2',
  stucco: '#c9bfa9',
  glassDark: '#1a2226',
  glassTeal: '#122421',
  neonPink: '#ff2e88',
  neonCyan: '#22e6ff',
  neonOrange: '#ff7a1a',
  neonYellow: '#ffd23e',
  palmGreen: '#2f5d32',
  skin: '#c98d64',
  jacket: '#1f8a8a',
  jeans: '#2c3e63',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'san-amaro-save-v1';

export const CONTROLS = [
  ['W A S D / Arrows', 'Move / drive'],
  ['Mouse', 'Orbit camera (click to lock)'],
  ['Shift', 'Run'],
  ['Space', 'Jump / handbrake'],
  ['E', 'Enter / exit car'],
  ['T', 'Cycle time of day'],
  ['P / Esc', 'Pause'],
  ['M', 'Mute'],
  ['H', 'Help'],
];
