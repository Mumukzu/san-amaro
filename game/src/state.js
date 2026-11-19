// Shared game state — the only shared mutable object. Systems read it and
// write through it; the event bus is only for HUD / mission notifications.
export const state = {
  phase: 'menu', // menu | playing | paused | busted
  time: 0, // elapsed simulation time (seconds)
  timePreset: 'sunset', // day | sunset | night
  day: 1, // in-game day counter (rolls over at midnight)
  clockMinutes: 18 * 60 + 24, // in-game clock, starts 18:24 (golden hour)
  money: 250,
  health: 100,
  armor: 0, // 0-100, absorbs damage before health (bible §9)
  wanted: 0,
  rep: 0, // reputation XP (Nobody 0 / Street 200 / Known 600 / ...)
  speed: 0, // current speed of player (on foot) or driven car
  inCar: false,
  vehicle: null, // the driven car object, or null
  player: null, // set by player.js
  cars: [], // all car objects (parked + traffic + police)
  traffic: [],
  peds: [],
  police: null, // active cruiser object, or null
  police2: null, // second cruiser (VICTOR-7) at 2+ stars, or null
  colliders: [], // AABBs from world.js / buildings.js
  objective: 'Explore San Amaro',
  marker: null, // { x, z } world position of the current marker, or null
  markerLabel: '',
  // Mission 1 "First Wheels": 3 stages — 1 find a car, 2 steal it, 3 drive
  // to the marker. missionProgress is the overall 0-1 fraction.
  missionStage: 1,
  missionProgress: 0,
  missionTime: 0, // seconds since the mission started
  missionPar: 161, // par time 2:41 — finish under it for the +$100 bonus
  missionDone: false,
  missionStartDist: 0, // distance to the marker when stage 3 began
  radioStation: 0, // index into the 3 bible stations (Neon Tide default)
  radioTrack: 0,
  shot: null, // '1'..'4' when staging a screenshot, else null
  muted: false,
  bestEscape: 0,
  missionsDone: 0,
  debug: false,
  fps: 0,
  drawCalls: 0,
  triangles: 0,
};

const listeners = {};
export const bus = {
  on(event, fn) {
    (listeners[event] || (listeners[event] = [])).push(fn);
  },
  emit(event, data) {
    const list = listeners[event];
    if (list) for (const fn of list) fn(data);
  },
};

export function setObjective(text, marker = null, label = '') {
  state.objective = text;
  state.marker = marker;
  state.markerLabel = label;
  bus.emit('objective', { text, marker, label });
}
