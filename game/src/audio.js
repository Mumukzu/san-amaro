// SAN AMARO — procedural sound. No audio files: every sound is synthesized
// with WebAudio (engine hum, siren, gunshots, UI blips, cash chime, and a
// tiny radio melody loop per station). Created lazily on the first user
// gesture so autoplay rules never throw. Written from scratch.
let ctx = null;
let master = null;
let engineOsc = null, engineFilter = null, engineGain = null;
let sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHi = false;
let radioTimer = null, radioStep = 0, radioStation = 0;

// ---- pause / resume state ----
// Snapshot of which loops were live when the game was paused, so resume
// restores exactly those (radio at its last station, siren only if wanted,
// engine only if driving, ambience if it was on). Every start has a guard
// and every stop nulls its handle, so no duplicate oscillator/node can
// accumulate across pause/resume cycles.
let paused = false;
let pauseSnap = null;
let stopTimer = null;
let engineStopTimer = null;

const STATIONS = [
  { name: 'NEON TIDE 102.5', bpm: 96, scale: [0, 3, 5, 7, 10, 12, 15], wave: 'triangle', base: 220 },
  { name: '107.3 THE DOCK', bpm: 128, scale: [0, 2, 5, 7, 9, 12], wave: 'sawtooth', base: 165 },
  { name: 'K-VIBE 91.1', bpm: 104, scale: [0, 3, 5, 8, 10, 12], wave: 'square', base: 196 },
];

function ensure() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return true;
  } catch { return false; }
}
export function initAudio() { return ensure(); }
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
// Mute the master gain (Settings). Persists only for this session; the
// Settings menu stores the choice in localStorage and re-applies it.
let muted = false;
export function setMuted(m) {
  muted = !!m;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
  return muted;
}
export function isMuted() { return muted; }

function noiseBuffer(dur = 0.3) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// ---- engine hum (sawtooth + lowpass, pitch follows speed) ----
export function engineStart() {
  // re-entering a car cancels a pending fade-out stop from engineFadeOut()
  clearTimeout(engineStopTimer); engineStopTimer = null;
  if (!ensure() || engineOsc) return;
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
  engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
  engineOsc.connect(engineFilter).connect(engineGain).connect(master);
  engineOsc.start();
}
export function engineSet(speedKmh, on) {
  if (!engineOsc) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(48 + speedKmh * 1.6, t, 0.08);
  engineFilter.frequency.setTargetAtTime(320 + speedKmh * 9, t, 0.1);
  engineGain.gain.setTargetAtTime(on ? 0.05 + Math.min(0.09, speedKmh * 0.0006) : 0.0, t, 0.12);
}
export function engineStop() {
  if (engineOsc) { try { engineOsc.stop(); } catch {} engineOsc = null; }
  // disconnect the filter/gain so repeated start/stop cycles don't leave
  // orphaned nodes connected to master
  if (engineGain) { try { engineGain.disconnect(); } catch {} engineGain = null; }
  engineFilter = null;
}

// Fade the engine hum out, then stop the oscillator (used when leaving a
// car, so no silent engine node is left running). Re-entering a car
// cancels the pending stop via engineStart().
export function engineFadeOut() {
  if (!engineOsc || !ctx) return;
  if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
  clearTimeout(engineStopTimer);
  engineStopTimer = setTimeout(() => { engineStopTimer = null; engineStop(); }, 220);
}

// ---- nitro boost whoosh (filtered noise sweeping up) ----
// Called every frame while boosting; throttled to one whoosh per 0.45 s.
let nitroLast = 0;
export function nitroBoost() {
  if (!ensure()) return;
  const now = ctx.currentTime;
  if (now - nitroLast < 0.45) return;
  nitroLast = now;
  const t = now;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.5);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(2400, t + 0.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 0.5);
}

// ---- city ambience (distant traffic hum + faint wind, looped) ----
// A looped noise bed through a lowpass, with a slow LFO on the filter so
// the hum breathes. Starts with the game; quiet enough to sit under the
// radio and engine.
let ambNodes = null;
export function ambienceStart() {
  if (!ensure() || ambNodes) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(2); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
  const g = ctx.createGain(); g.gain.value = 0.02;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 90;
  lfo.connect(lfoGain).connect(f.frequency);
  src.connect(f).connect(g).connect(master);
  src.start(); lfo.start();
  ambNodes = { src, lfo, g };
}
export function ambienceStop() {
  if (!ambNodes) return;
  try { ambNodes.src.stop(); ambNodes.lfo.stop(); } catch {}
  try { if (ambNodes.g) ambNodes.g.disconnect(); } catch {}
  ambNodes = null;
}

// ---- siren (square wave alternating 720 / 940 Hz) ----
export function sirenStart() {
  if (!ensure() || sirenOsc) return;
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'square'; sirenOsc.frequency.value = 720;
  sirenGain = ctx.createGain(); sirenGain.gain.value = 0.035;
  sirenOsc.connect(sireneGainSafe()).connect(master);
  sirenOsc.start();
}
function sireneGainSafe() { return sirenGain; }
export function sirenUpdate(dt) {
  if (!sirenOsc) return;
  sirenTimer += dt;
  if (sirenTimer > 0.45) {
    sirenTimer = 0; sirenHi = !sirenHi;
    sirenOsc.frequency.value = sirenHi ? 940 : 720;
  }
}
export function sirenStop() {
  if (sirenOsc) { try { sirenOsc.stop(); } catch {} sirenOsc = null; }
  if (sirenGain) { try { sirenGain.disconnect(); } catch {} sirenGain = null; }
}

// ---- gunshot (noise burst + low thump) ----
export function gunshot() {
  if (!ensure()) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.18);
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  src.connect(f).connect(g).connect(master); src.start(t);
  const th = ctx.createOscillator(); th.type = 'sine';
  th.frequency.setValueAtTime(160, t); th.frequency.exponentialRampToValueAtTime(45, t + 0.14);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.5, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  th.connect(tg).connect(master); th.start(t); th.stop(t + 0.16);
}

// ---- UI blip + cash chime ----
export function blip(freq = 880) {
  if (!ensure()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.1);
}
export function cashChime() {
  if (!ensure()) return;
  const t = ctx.currentTime;
  [1318, 1760].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain();
    const s = t + i * 0.09;
    g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.16, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.35);
    o.connect(g).connect(master); o.start(s); o.stop(s + 0.4);
  });
}

// ---- radio: a tiny step-sequenced melody per station ----
export function radioStart(station = 0) {
  if (!ensure()) return;
  radioStop();
  radioStation = station % STATIONS.length;
  radioStep = 0;
  const st = STATIONS[radioStation];
  const stepDur = 60 / st.bpm / 2;
  radioTimer = setInterval(() => {
    if (!ctx) return;
    const scale = st.scale;
    const idx = [0, 2, 4, 3, 5, 4, 6, 3][radioStep % 8];
    const semis = scale[idx % scale.length] + 12 * Math.floor(idx / scale.length);
    const f = st.base * Math.pow(2, semis / 12);
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = st.wave; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
    o.connect(g).connect(master); o.start(t); o.stop(t + stepDur);
    radioStep++;
  }, stepDur * 1000);
}
export function radioStop() {
  if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
}
export function radioStationName(i) { return STATIONS[i % STATIONS.length].name; }
export function radioTracks(i) {
  const t = [
    ['“Neon Horizon” — Midnight Palms', 'Synthwave · Golden-hour driving'],
    ['“Rust and Chrome” — Harbor Rats', 'Garage rock · Dockside'],
    ['“Chrome Dreams” — Lil Vex', 'Hip-hop · All vibe'],
  ];
  return t[i % t.length];
}

// ---- pause / resume ----
// pauseAudio() snapshots which loops are live, fades their gains to 0
// (smooth, no harsh cut), stops the radio interval (the current note
// decays on its own), then stops the faded sources so no silent
// oscillator/node keeps running. resumePausedAudio() restores only what
// should be live now, using the caller's current game state (driving /
// wanted / station) over the snapshot, and is idempotent.
export function pauseAudio() {
  if (!ctx || paused) return;
  paused = true;
  pauseSnap = {
    engine: !!engineOsc,
    siren: !!sirenOsc,
    radio: !!radioTimer,
    station: radioStation,
    amb: !!ambNodes,
  };
  const t = ctx.currentTime;
  if (engineGain) engineGain.gain.setTargetAtTime(0, t, 0.05);
  if (sirenGain) sirenGain.gain.setTargetAtTime(0, t, 0.05);
  if (ambNodes && ambNodes.g) ambNodes.g.gain.setTargetAtTime(0, t, 0.05);
  radioStop();
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => { stopTimer = null; engineStop(); sirenStop(); ambienceStop(); }, 200);
}
export function resumePausedAudio(want = {}) {
  if (!ctx) return;
  if (!paused) { resumeAudio(); return; }
  paused = false;
  clearTimeout(stopTimer); stopTimer = null;
  resumeAudio();
  const snap = pauseSnap || {};
  pauseSnap = null;
  const driving = want.driving !== undefined ? want.driving : !!snap.engine;
  const wanted = want.wanted !== undefined ? want.wanted : (snap.siren ? 1 : 0);
  const station = want.station !== undefined ? want.station : (snap.station ?? 0);
  // engine: recreate only if driving (the driving loop's engineSet ramps
  // the gain back up); if not driving, leave it stopped — entering a car
  // recreates it via engineStart()
  if (driving) { if (!engineOsc) engineStart(); }
  else if (engineOsc) engineStop();
  // siren: recreate only if wanted; if the osc survived the pause (stop
  // was cancelled), ramp its gain back instead of duplicating it
  if (wanted > 0) {
    if (!sirenOsc) sirenStart();
    else if (sirenGain) sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.08);
  }
  // ambience: recreate if it was on; if the nodes survived, ramp the gain back
  if (snap.amb) {
    if (!ambNodes) ambienceStart();
    else if (ambNodes.g) ambNodes.g.gain.setTargetAtTime(0.02, ctx.currentTime, 0.08);
  }
  // radio: restart at the last station if it was playing (radioStart
  // stops any existing interval first, so no duplicate sequencer)
  if (snap.radio) radioStart(station);
}
