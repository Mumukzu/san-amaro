// Shared game state — the only shared mutable object. Systems read it and
// write through it; the event bus is only for HUD / mission notifications.
export const state = {
  phase: 'menu', // menu | playing | paused | busted
  time: 0, // elapsed simulation time (seconds)
  timePreset: 'sunset', // day | sunset | night
  money: 250,
  health: 100,
  wanted: 0,
  speed: 0, // current speed of player (on foot) or driven car
  inCar: false,
  vehicle: null, // the driven car object, or null
  player: null, // set by player.js
  cars: [], // all car objects (parked + traffic + police)
  traffic: [],
  peds: [],
  police: null, // active cruiser object, or null
  colliders: [], // AABBs from world.js / buildings.js
  objective: 'Explore San Amaro',
  marker: null, // { x, z } world position of the current marker, or null
  markerLabel: '',
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
