// SAN AMARO — procedural sound. No audio files: every sound is synthesized
// with WebAudio (engine hum, siren, gunshots, UI blips, cash chime, and a
// tiny radio melody loop per station). Created lazily on the first user
// gesture so autoplay rules never throw. Written from scratch.
let ctx = null;
let master = null;
let engineOsc = null, engineOsc2 = null, engineFilter = null, engineGain = null, engineGain2 = null, engineProfile = null;
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

// ---- vehicle sound identity (AUDIO-03) ----
// Each vehicle family gets a distinct procedural engine voice (two
// oscillators through a lowpass, so the character is audible at idle
// and follows speed). profileFor() normalizes both car ids and spec
// kinds: 'comet'/'prize'/'Sports'/'Police' -> sports, 'Muscle' ->
// muscle, 'Truck'/'Van' -> truck, everything else (sedan, Sedan, Taxi,
// Pickup, Lowrider, unknown) -> car. No motorcycle exists in the game
// (no SPECS entry, no traffic/parked/player bike), so no motorcycle
// voice is wired — inventing one would mean a new vehicle model.
const ENGINE_PROFILES = {
  car:    { wave: 'sawtooth', base: 55, slope: 1.4, wave2: 'triangle', detune2: 0, oct2: 2,   gain2: 0.35, filterBase: 420, filterSlope: 8,  gainBase: 0.05,  gainSlope: 0.0006, gainMax: 0.09 },
  muscle: { wave: 'sawtooth', base: 42, slope: 1.5, wave2: 'sawtooth', detune2: 6, oct2: 1,   gain2: 0.6,  filterBase: 380, filterSlope: 7,  gainBase: 0.06,  gainSlope: 0.0006, gainMax: 0.09 },
  truck:  { wave: 'square',   base: 34, slope: 0.9, wave2: 'sine',     detune2: 0, oct2: 0.5, gain2: 0.8,  filterBase: 240, filterSlope: 5,  gainBase: 0.07,  gainSlope: 0.0005, gainMax: 0.08 },
  sports: { wave: 'sawtooth', base: 72, slope: 2.0, wave2: 'sawtooth', detune2: 8, oct2: 1,   gain2: 0.5,  filterBase: 650, filterSlope: 12, gainBase: 0.055, gainSlope: 0.0008, gainMax: 0.10 },
};
function profileFor(key) {
  switch (key) {
    case 'comet': case 'prize': case 'sports': case 'Sports': case 'Police': return 'sports';
    case 'muscle': case 'Muscle': return 'muscle';
    case 'truck': case 'Truck': case 'van': case 'Van': return 'truck';
    default: return 'car';
  }
}

// ---- engine hum (per-type voice: osc pair + lowpass, pitch follows speed) ----
export function engineStart(type) {
  // re-entering a car cancels a pending fade-out stop from engineFadeOut()
  clearTimeout(engineStopTimer); engineStopTimer = null;
  if (!ensure()) return;
  const prof = profileFor(type);
  if (engineOsc) {
    if (engineProfile === prof) return; // same voice, just cancelled a fade-out
    engineStop(); // different vehicle: rebuild the voice with the new profile
  }
  engineProfile = prof;
  const P = ENGINE_PROFILES[prof];
  engineOsc = ctx.createOscillator();
  engineOsc.type = P.wave;
  engineOsc.frequency.value = P.base;
  engineOsc2 = ctx.createOscillator();
  engineOsc2.type = P.wave2;
  engineOsc2.frequency.value = P.base * P.oct2 + P.detune2;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass'; engineFilter.frequency.value = P.filterBase;
  engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
  engineGain2 = ctx.createGain(); engineGain2.gain.value = P.gain2;
  engineOsc.connect(engineFilter);
  engineOsc2.connect(engineGain2).connect(engineFilter);
  engineFilter.connect(engineGain).connect(master);
  engineOsc.start(); engineOsc2.start();
}
export function engineSet(speedKmh, on) {
  if (!engineOsc) return;
  const P = ENGINE_PROFILES[engineProfile || 'car'];
  const t = ctx.currentTime;
  const f1 = P.base + speedKmh * P.slope;
  engineOsc.frequency.setTargetAtTime(f1, t, 0.08);
  if (engineOsc2) engineOsc2.frequency.setTargetAtTime(f1 * P.oct2 + P.detune2, t, 0.08);
  engineFilter.frequency.setTargetAtTime(P.filterBase + speedKmh * P.filterSlope, t, 0.1);
  engineGain.gain.setTargetAtTime(on ? P.gainBase + Math.min(P.gainMax, speedKmh * P.gainSlope) : 0.0, t, 0.12);
}
export function engineStop() {
  if (engineOsc) { try { engineOsc.stop(); } catch {} engineOsc = null; }
  if (engineOsc2) { try { engineOsc2.stop(); } catch {} engineOsc2 = null; }
  // disconnect the filter/gain so repeated start/stop cycles don't leave
  // orphaned nodes connected to master
  if (engineGain) { try { engineGain.disconnect(); } catch {} engineGain = null; }
  if (engineGain2) { try { engineGain2.disconnect(); } catch {} engineGain2 = null; }
  if (engineFilter) { try { engineFilter.disconnect(); } catch {} engineFilter = null; }
  engineProfile = null;
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
// One voice only: sirenStart() is a no-op while a siren is already live,
// so overlapping cruisers can never stack sirens. sirenFadeOut() is the
// pursuit-end stop: it fades the gain out first, then stops the voice,
// so the siren never cuts dead mid-wail. If wanted comes back during
// the fade, sirenStart() cancels the pending stop and ramps the gain
// back up instead of building a second voice.
let sirenFadeTimer = null;
export function sirenStart() {
  if (!ensure()) return;
  if (sirenOsc) {
    // a fade-out was in progress: cancel it, bring the gain back
    clearTimeout(sirenFadeTimer); sirenFadeTimer = null;
    if (sirenGain) sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.08);
    return;
  }
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'square'; sirenOsc.frequency.value = 720;
  sirenGain = ctx.createGain(); sirenGain.gain.value = 0.035;
  sirenOsc.connect(sirenGain).connect(master);
  sirenOsc.start();
}
export function sirenUpdate(dt) {
  if (!sirenOsc) return;
  sirenTimer += dt;
  if (sirenTimer > 0.45) {
    sirenTimer = 0; sirenHi = !sirenHi;
    sirenOsc.frequency.value = sirenHi ? 940 : 720;
  }
}
export function sirenFadeOut() {
  if (!sirenOsc || !ctx) return;
  if (sirenGain) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
  clearTimeout(sirenFadeTimer);
  sirenFadeTimer = setTimeout(() => { sirenFadeTimer = null; sirenStop(); }, 200);
}
export function sirenStop() {
  clearTimeout(sirenFadeTimer); sirenFadeTimer = null;
  if (sirenOsc) { try { sirenOsc.stop(); } catch {} sirenOsc = null; }
  if (sirenGain) { try { sirenGain.disconnect(); } catch {} sirenGain = null; }
}

// ---- police radio chatter (AUDIO-05) ----
// Procedural dispatch radio, heard only while the police are pursuing
// (wanted > 0). Each transmission is: a short static squelch burst, a
// burst of synthetic voice blips (square-wave syllables at radio
// frequencies — garbled chatter, NOT a recording and NOT speech), then
// a closing squelch burst. Four patterns (short / medium / long /
// double) are picked at random and never repeat twice in a row, so the
// chatter doesn't sound looped. Transmissions are spaced by wanted:
// low heat = occasional, high heat = frequent, with jitter so the
// rhythm never sounds mechanical. The scheduler is frame-driven
// (policeRadioUpdate, called from the animate loop next to
// sirenUpdate) and stops itself the moment wanted hits 0 — nothing
// keeps transmitting after the pursuit ends. All nodes run through one
// per-transmission gain into master (mute respected), and every node
// disconnects on ended, so repeated transmissions can't accumulate.
const RADIO_PATTERNS = [
  // short: 3 blips
  { blips: [[520, 0.07], [440, 0.06], [610, 0.08]], gaps: [0.04, 0.05] },
  // medium: 5 blips
  { blips: [[480, 0.06], [620, 0.07], [380, 0.05], [540, 0.08], [460, 0.06]], gaps: [0.03, 0.05, 0.04, 0.03] },
  // long: 8 blips in two groups of 4
  { blips: [[560, 0.06], [420, 0.05], [680, 0.07], [500, 0.06], [440, 0.06], [600, 0.05], [380, 0.07], [520, 0.08]], gaps: [0.03, 0.04, 0.03, 0.18, 0.04, 0.03, 0.05] },
  // double: 2 blips, pause, 3 blips (call + response feel)
  { blips: [[640, 0.07], [480, 0.06], [560, 0.06], [420, 0.07], [660, 0.08]], gaps: [0.04, 0.22, 0.05, 0.04] },
];
const RADIO_INTERVAL = { 1: 14, 2: 9, 3: 6, 4: 4.5, 5: 3.5 }; // game-seconds between transmissions
const RADIO_COOLDOWN = 2.0; // minimum game-seconds between transmission starts
const RADIO_STATIC_DUR = 0.12;
let radioTx = null; // in-flight transmission { gain } or null
let radioGameT = 0; // scheduler clock (game seconds, advanced by policeRadioUpdate)
let radioTxLastGame = -10;
let dispatchTimer = 0; // scheduler accumulator (game seconds)
let dispatchNextIn = RADIO_INTERVAL[1];
let radioLastPattern = -1;
let radioLastWanted = 0;

function radioIntervalFor(wanted) {
  const base = RADIO_INTERVAL[Math.max(1, Math.min(5, wanted || 1))] || RADIO_INTERVAL[1];
  return base * (0.75 + Math.random() * 0.5); // +-25% jitter
}
// One transmission: static squelch in, voice blips, static squelch out.
// pattern: optional 0-3 to force a pattern (tests); otherwise random,
// never the same pattern twice in a row. Returns true when a
// transmission started, false when one is already in flight.
export function policeRadioTransmit(pattern) {
  if (!ensure() || paused) return false;
  if (radioTx) return false; // one transmission at a time, never overlap
  let p = pattern;
  if (p === undefined || p === null || p < 0 || p >= RADIO_PATTERNS.length) {
    do { p = Math.floor(Math.random() * RADIO_PATTERNS.length); } while (p === radioLastPattern);
  }
  radioLastPattern = p;
  const P = RADIO_PATTERNS[p];
  const t = ctx.currentTime;
  const nodes = [];
  // one gain for the whole transmission: policeRadioStop() fades it out,
  // and it disconnects itself when the last node ends
  const txGain = ctx.createGain(); txGain.gain.value = 1;
  txGain.connect(master);
  nodes.push(txGain);
  let cursor = t;
  const staticBurst = (start) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.2);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.05, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + RADIO_STATIC_DUR);
    src.connect(f).connect(g).connect(txGain);
    src.start(start); src.stop(start + RADIO_STATIC_DUR + 0.05);
    nodes.push(src, f, g);
    return src;
  };
  staticBurst(cursor); // opening squelch
  cursor += RADIO_STATIC_DUR;
  P.blips.forEach(([freq, dur], i) => {
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.value = freq * (0.95 + Math.random() * 0.1); // +-5% jitter
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, cursor);
    g.gain.exponentialRampToValueAtTime(0.07, cursor + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, cursor + dur);
    o.connect(g).connect(txGain);
    o.start(cursor); o.stop(cursor + dur + 0.02);
    nodes.push(o, g);
    cursor += dur + (P.gaps[i] || 0);
  });
  const lastSrc = staticBurst(cursor);
  const done = (() => {
    let cleaned = false;
    return () => {
      if (cleaned) return; cleaned = true;
      for (const n of nodes) { try { n.disconnect(); } catch {} }
      if (radioTx && radioTx.gain === txGain) radioTx = null;
    };
  })();
  // the closing static is the last node to end, so it alone triggers
  // cleanup — disconnecting on an earlier onended would cut the voice
  // blips off mid-transmission
  lastSrc.onended = done;
  radioTx = { gain: txGain };
  return true;
}
// Frame scheduler: call every play frame with the current wanted level.
// wanted 0 = silence (any in-flight transmission fades out); wanted > 0
// = a transmission every radioIntervalFor(wanted) game-seconds, never
// more often than RADIO_COOLDOWN.
export function policeRadioUpdate(dt, wanted) {
  if (!ensure() || paused) return;
  radioGameT += dt;
  if (!wanted || wanted <= 0) { policeRadioStop(); return; }
  if (wanted !== radioLastWanted) {
    radioLastWanted = wanted;
    dispatchTimer = 0;
    dispatchNextIn = radioIntervalFor(wanted);
  }
  if (radioTx) return; // a transmission is in flight; wait for it
  dispatchTimer += dt;
  if (dispatchTimer >= dispatchNextIn && radioGameT - radioTxLastGame >= RADIO_COOLDOWN) {
    if (policeRadioTransmit()) {
      dispatchTimer = 0;
      radioTxLastGame = radioGameT;
      dispatchNextIn = radioIntervalFor(wanted);
    }
  }
}
// Stop now: fade any in-flight transmission out and reset the scheduler.
// The scheduled stops + onended cleanup still disconnect every node.
export function policeRadioStop() {
  dispatchTimer = 0;
  radioLastWanted = 0;
  if (!radioTx) return;
  const tx = radioTx; radioTx = null;
  if (ctx && tx.gain) tx.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
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

// ---- collision & impact sounds (noise burst + low thump) ----
// crash(severity, kind): one-shot impact. Severity drives loudness and
// length (light = parking nudge, medium = street hit, hard = high-speed
// crash); kind tunes the noise filter (car = metallic bandpass, building
// = dull lowpass thud, object = in-between). Every envelope starts from
// ~silence with a 6–8 ms attack ramp, so it never clicks, and the peaks
// are budgeted so noise + thump stay well under 1.0 before the 0.5
// master gain — no clipping. Nodes disconnect themselves on ended, so
// repeated crashes can't leave orphans on master.
// An audio-level throttle (0.12 s) backs up the gameplay cooldowns:
// if two sources fire in the same frame (car + ram), the second is
// dropped instead of piling up. Returns true when a sound was played.
let crashLast = -1;
export function crash(severity = 'medium', kind = 'car') {
  if (!ensure()) return false;
  const now = ctx.currentTime;
  if (now - crashLast < 0.12) return false;
  crashLast = now;
  let sev = severity;
  if (typeof sev === 'number') sev = sev < 0.34 ? 'light' : sev < 0.67 ? 'medium' : 'hard';
  const P = {
    light:  { noise: 0.10, thump: 0.14, dur: 0.12, thumpF: 110, noiseF: 1400 },
    medium: { noise: 0.18, thump: 0.24, dur: 0.22, thumpF: 95,  noiseF: 1000 },
    hard:   { noise: 0.28, thump: 0.34, dur: 0.35, thumpF: 80,  noiseF: 700 },
  }[sev] || { noise: 0.18, thump: 0.24, dur: 0.22, thumpF: 95, noiseF: 1000 };
  const t = now;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.4);
  const f = ctx.createBiquadFilter();
  if (kind === 'car') { f.type = 'bandpass'; f.frequency.value = P.noiseF; f.Q.value = 0.9; }
  else { f.type = 'lowpass'; f.frequency.value = kind === 'building' ? 500 : 800; }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(P.noise, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, t + P.dur);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + P.dur + 0.05);
  const th = ctx.createOscillator(); th.type = 'sine';
  th.frequency.setValueAtTime(P.thumpF, t);
  th.frequency.exponentialRampToValueAtTime(32, t + P.dur * 0.7);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(P.thump, t + 0.008);
  tg.gain.exponentialRampToValueAtTime(0.001, t + P.dur);
  th.connect(tg).connect(master); th.start(t); th.stop(t + P.dur + 0.05);
  const done = (() => {
    let cleaned = false;
    return () => {
      if (cleaned) return; cleaned = true;
      try { src.disconnect(); f.disconnect(); g.disconnect(); } catch {}
      try { th.disconnect(); tg.disconnect(); } catch {}
    };
  })();
  src.onended = done; th.onended = done;
  return true;
}

// ---- brake hiss (filtered noise + high squeak, one-shot) ----
// brakeTick() is called every frame while the brake input is held;
// the 0.7 s cooldown means a long brake gives a periodic hiss, never
// a stack of overlapping bursts. Only fires while actually moving
// (speedKmh >= 10), so stationary pedal presses stay silent.
let brakeLast = -1;
export function brakeTick(speedKmh) {
  if (!ensure()) return false;
  if (speedKmh < 10) return false;
  const now = ctx.currentTime;
  if (now - brakeLast < 0.7) return false;
  brakeLast = now;
  const t = now;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.35);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 1.0;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.10, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 0.35);
  const sq = ctx.createOscillator(); sq.type = 'sine'; sq.frequency.value = 2400;
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(0.035, t + 0.04);
  sg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  sq.connect(sg).connect(master); sq.start(t); sq.stop(t + 0.3);
  const done = (() => {
    let cleaned = false;
    return () => {
      if (cleaned) return; cleaned = true;
      try { src.disconnect(); f.disconnect(); g.disconnect(); } catch {}
      try { sq.disconnect(); sg.disconnect(); } catch {}
    };
  })();
  src.onended = done; sq.onended = done;
  return true;
}

// ---- horn (dual-tone, held while the key is down) ----
// Two detuned sawtooths through a lowpass — the classic car-horn
// interval. The pair is tuned per vehicle family (truck low, sports
// high) so the horn itself identifies the car. hornStart is a no-op
// while a horn is already sounding (key repeat can't stack it), and a
// 2.5 s safety timer stops it even if keyup is missed.
const HORN_PROFILES = {
  car:    { f1: 370, f2: 466, gain: 0.12 },
  muscle: { f1: 330, f2: 415, gain: 0.13 },
  truck:  { f1: 220, f2: 277, gain: 0.16 },
  sports: { f1: 440, f2: 554, gain: 0.12 },
};
let hornNodes = null; // { o1, o2, f, g, timer }
export function hornStart(type) {
  if (!ensure() || hornNodes) return false;
  const P = HORN_PROFILES[profileFor(type)] || HORN_PROFILES.car;
  const t = ctx.currentTime;
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = P.f1;
  const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = P.f2;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(P.gain, t + 0.03);
  o1.connect(f); o2.connect(f); f.connect(g).connect(master);
  o1.start(t); o2.start(t);
  const timer = setTimeout(() => hornStop(), 2500);
  hornNodes = { o1, o2, f, g, timer };
  return true;
}
export function hornStop() {
  if (!hornNodes) return;
  const h = hornNodes; hornNodes = null;
  clearTimeout(h.timer);
  if (ctx && h.g) h.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  setTimeout(() => {
    try { h.o1.stop(); h.o2.stop(); } catch {}
    try { h.g.disconnect(); h.f.disconnect(); } catch {}
  }, 150);
}

// ---- tire squeal (looped filtered noise, one shared voice) ----
// squealSet(intensity) is called every driving frame: 0 = no squeal,
// up to 1 = full slide. The voice is created lazily on the first
// squeal and faded out + stopped when the car stops sliding, so it
// can never stack or drone on when not drifting. A slow LFO wobbles
// the bandpass frequencies so the screech shimmers instead of
// sitting on one flat tone.
let squealNodes = null; // { src, f1, f2, g, lfo, lfoGain, stopTimer }
export function squealSet(intensity) {
  if (!ensure()) return;
  intensity = Math.max(0, Math.min(1, intensity || 0));
  if (intensity <= 0) {
    if (squealNodes) {
      const s = squealNodes; squealNodes = null;
      if (s.g) s.g.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      clearTimeout(s.stopTimer);
      s.stopTimer = setTimeout(() => {
        try { s.src.stop(); s.lfo.stop(); } catch {}
        try { s.g.disconnect(); s.f1.disconnect(); s.f2.disconnect(); s.lfoGain.disconnect(); } catch {}
      }, 350);
    }
    return;
  }
  if (!squealNodes) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(1); src.loop = true;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1100; f1.Q.value = 2.5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1650; f2.Q.value = 2.5;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 7;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 150;
    lfo.connect(lfoGain); lfoGain.connect(f1.frequency); lfoGain.connect(f2.frequency);
    src.connect(f1).connect(g); src.connect(f2).connect(g); g.connect(master);
    src.start(); lfo.start();
    squealNodes = { src, f1, f2, g, lfo, lfoGain, stopTimer: null };
  }
  const s = squealNodes;
  clearTimeout(s.stopTimer); s.stopTimer = null;
  s.g.gain.setTargetAtTime(0.09 * intensity, ctx.currentTime, 0.1);
}
// ---- distant traffic engines (heard from outside) ----
// A small pool (max 3) of quiet engine voices follows the nearest
// traffic cars. Each voice uses the car's own profile, with gain by
// distance and pitch by the car's speed. Reassignment is driven by
// main.js every 0.5 s; voices for cars that left the set fade out and
// stop, so the pool can never grow or stack. Traffic voices are NOT
// restored by resumePausedAudio — the next trafficUpdate (<= 0.5 s
// after resume) recreates exactly the ones still nearby.
const TRAFFIC_MAX = 3, TRAFFIC_RANGE = 40;
let trafficVoices = []; // { id, profile, osc1, osc2, g2, filter, gain }
export function trafficUpdate(cars) {
  if (!ensure() || paused) return;
  const keep = new Set();
  for (const c of (cars || []).slice(0, TRAFFIC_MAX)) {
    keep.add(c.id);
    const prof = profileFor(c.kind);
    const P = ENGINE_PROFILES[prof];
    const t = ctx.currentTime;
    const speedKmh = c.speedKmh || 0;
    const f1 = P.base + speedKmh * P.slope;
    // gain: 0 at the range edge, up to 0.03 up close
    const target = 0.03 * Math.max(0, 1 - (c.dist || TRAFFIC_RANGE) / TRAFFIC_RANGE);
    let v = trafficVoices.find((x) => x.id === c.id);
    if (!v) {
      const osc1 = ctx.createOscillator(); osc1.type = P.wave; osc1.frequency.value = f1;
      const osc2 = ctx.createOscillator(); osc2.type = P.wave2; osc2.frequency.value = f1 * P.oct2 + P.detune2;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = P.filterBase + speedKmh * P.filterSlope;
      const g2 = ctx.createGain(); g2.gain.value = P.gain2;
      const gain = ctx.createGain(); gain.gain.value = 0.0001;
      osc1.connect(filter); osc2.connect(g2).connect(filter); filter.connect(gain).connect(master);
      osc1.start(); osc2.start();
      v = { id: c.id, profile: prof, osc1, osc2, g2, filter, gain };
      trafficVoices.push(v);
    } else if (v.profile !== prof) {
      v.profile = prof;
      v.osc1.type = P.wave; v.osc2.type = P.wave2; v.g2.gain.value = P.gain2;
    }
    v.osc1.frequency.setTargetAtTime(f1, t, 0.15);
    v.osc2.frequency.setTargetAtTime(f1 * P.oct2 + P.detune2, t, 0.15);
    v.filter.frequency.setTargetAtTime(P.filterBase + speedKmh * P.filterSlope, t, 0.15);
    v.gain.gain.setTargetAtTime(target, t, 0.2);
  }
  // fade out + stop voices whose car left the set
  trafficVoices = trafficVoices.filter((v) => {
    if (keep.has(v.id)) return true;
    if (v.gain) v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    setTimeout(() => {
      try { v.osc1.stop(); v.osc2.stop(); } catch {}
      try { v.gain.disconnect(); v.g2.disconnect(); v.filter.disconnect(); } catch {}
    }, 300);
    return false;
  });
}
function trafficStopAll() {
  for (const v of trafficVoices) {
    try { v.osc1.stop(); v.osc2.stop(); } catch {}
    try { v.gain.disconnect(); v.g2.disconnect(); v.filter.disconnect(); } catch {}
  }
  trafficVoices = [];
}

// ---- character sounds (AUDIO-04) ----
// All one-shots through master (mute respected). No loops, so pause /
// resume need nothing added: a step or punch in flight finishes in
// < 0.3 s, exactly like the existing blip / gunshot / crash one-shots,
// and no new step can start while paused (the walk cycles that drive
// them only advance while state.mode === 'play').
// Footsteps are driven by the EXISTING walk-cycle phase: one step per
// half-cycle (phase crossing a multiple of PI), so tempo follows the
// animation exactly — walk and run differ because the phase advances
// faster when running. Each step varies gain/filter slightly and
// alternates left/right foot, so it never sounds mechanical.
// Police + enemy profiles exist in the table for when their events
// exist; right now no police officer walks/runs in the game (they
// stand/idle) and no enemy walks (they stand and shoot), so nothing
// calls footstep() with those kinds yet.
const STEP_PROFILES = {
  jay:    { filter: 520, gainWalk: 0.10,  gainRun: 0.15,  dur: 0.09, thumpF: 95 },
  npc:    { filter: 420, gainWalk: 0.055, gainRun: 0.09,  dur: 0.08, thumpF: 85 },
  police: { filter: 600, gainWalk: 0.11,  gainRun: 0.16,  dur: 0.09, thumpF: 100 },
  enemy:  { filter: 480, gainWalk: 0.09,  gainRun: 0.14,  dur: 0.09, thumpF: 90 },
};
let stepLast = -1; // global safety throttle: two callers in one frame can't stack
let stepAlt = 0;   // alternates left/right foot
function cleanOneShot(nodes) {
  // nodes: [src, ...] — disconnect each on the first onended that fires
  let cleaned = false;
  return () => {
    if (cleaned) return; cleaned = true;
    for (const n of nodes) { try { n.disconnect(); } catch {} }
  };
}
export function footstep(kind = 'jay', running = false) {
  if (!ensure()) return false;
  const now = ctx.currentTime;
  if (now - stepLast < 0.05) return false; // never stack steps
  stepLast = now;
  const P = STEP_PROFILES[kind] || STEP_PROFILES.jay;
  const t = now;
  stepAlt ^= 1;
  const varF = 0.9 + Math.random() * 0.2;  // +-10% filter variation
  const varG = 0.85 + Math.random() * 0.3; // +-15% gain variation
  const altF = stepAlt ? 1.06 : 0.94;       // left/right foot slightly different
  const peak = (running ? P.gainRun : P.gainWalk) * varG;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.12);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = P.filter * varF * altF;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + P.dur);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + P.dur + 0.05);
  const th = ctx.createOscillator(); th.type = 'sine';
  th.frequency.setValueAtTime(P.thumpF * altF, t);
  th.frequency.exponentialRampToValueAtTime(40, t + P.dur * 0.7);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(peak * 0.6, t + 0.006);
  tg.gain.exponentialRampToValueAtTime(0.001, t + P.dur);
  th.connect(tg).connect(master); th.start(t); th.stop(t + P.dur + 0.05);
  const done = cleanOneShot([src, f, g, th, tg]);
  src.onended = done; th.onended = done;
  return true;
}
// Punch landing: impact snap (bandpass noise) + body thump (low sine).
export function punchHit() {
  if (!ensure()) return false;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.15);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.28, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 0.16);
  const th = ctx.createOscillator(); th.type = 'sine';
  th.frequency.setValueAtTime(110, t); th.frequency.exponentialRampToValueAtTime(45, t + 0.1);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(0.30, t + 0.007);
  tg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  th.connect(tg).connect(master); th.start(t); th.stop(t + 0.19);
  const done = cleanOneShot([src, f, g, th, tg]);
  src.onended = done; th.onended = done;
  return true;
}
// Punch missing: a short whoosh (noise sweeping down), no impact.
export function punchMiss() {
  if (!ensure()) return false;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.25);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5;
  f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(280, t + 0.16);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 0.23);
  src.onended = cleanOneShot([src, f, g]);
  return true;
}
// Body impact on Jay (enemy bullet connects): dull, heavier than a punch.
export function bodyImpact() {
  if (!ensure()) return false;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.18);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.20, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 0.2);
  const th = ctx.createOscillator(); th.type = 'sine';
  th.frequency.setValueAtTime(75, t); th.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(0.22, t + 0.007);
  tg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  th.connect(tg).connect(master); th.start(t); th.stop(t + 0.21);
  const done = cleanOneShot([src, f, g, th, tg]);
  src.onended = done; th.onended = done;
  return true;
}
// Body hitting the ground (enemy killed, pedestrian knocked down).
export function fallThud() {
  if (!ensure()) return false;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.3);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.30, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 0.3);
  const th = ctx.createOscillator(); th.type = 'sine';
  th.frequency.setValueAtTime(65, t); th.frequency.exponentialRampToValueAtTime(35, t + 0.18);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(0.28, t + 0.01);
  tg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  th.connect(tg).connect(master); th.start(t); th.stop(t + 0.3);
  const done = cleanOneShot([src, f, g, th, tg]);
  src.onended = done; th.onended = done;
  return true;
}
// Picking up an item / clue / envelope: two-note chime (was a generic blip).
export function interactSound() {
  if (!ensure()) return false;
  const t = ctx.currentTime;
  [880, 1318.5].forEach((fr, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
    const g = ctx.createGain();
    const t0 = t + i * 0.09;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.14);
    o.onended = cleanOneShot([o, g]);
  });
  return true;
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
    horn: !!hornNodes,
    squeal: !!squealNodes,
    traffic: trafficVoices.length > 0,
  };
  const t = ctx.currentTime;
  if (engineGain) engineGain.gain.setTargetAtTime(0, t, 0.05);
  if (sirenGain) sirenGain.gain.setTargetAtTime(0, t, 0.05);
  if (ambNodes && ambNodes.g) ambNodes.g.gain.setTargetAtTime(0, t, 0.05);
  if (squealNodes && squealNodes.g) squealNodes.g.gain.setTargetAtTime(0, t, 0.05);
  for (const v of trafficVoices) if (v.gain) v.gain.gain.setTargetAtTime(0, t, 0.05);
  hornStop(); // fades its own gain, stops after 150 ms
  squealSet(0); // fades out, stops after 350 ms
  radioStop();
  policeRadioStop(); // AUDIO-05: fade any in-flight dispatch, reset its scheduler
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => { stopTimer = null; engineStop(); sirenStop(); ambienceStop(); trafficStopAll(); }, 200);
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
  // recreates it via engineStart(). engineStart(type) rebuilds the voice
  // when the driven car's type changed, and is a no-op when it matches.
  // Horn / squeal / traffic are NOT restored here: the horn is a
  // momentary key-held sound (re-press J), while squeal and traffic
  // come back from the game's per-frame calls (squealSet / trafficUpdate)
  // within a frame / 0.5 s of resume if their conditions still hold.
  if (driving) { engineStart(want.type); }
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
