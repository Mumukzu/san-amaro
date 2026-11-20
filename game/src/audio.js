// SAN AMARO — procedural sound. No audio files: every sound is synthesized
// with WebAudio (engine hum, siren, gunshots, UI blips, cash chime, and a
// tiny radio melody loop per station). Created lazily on the first user
// gesture so autoplay rules never throw. Written from scratch.
let ctx = null;
let master = null;
let engineOsc = null, engineFilter = null, engineGain = null;
let sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHi = false;
let radioTimer = null, radioStep = 0, radioStation = 0;

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
  ambNodes = { src, lfo };
}
export function ambienceStop() {
  if (!ambNodes) return;
  try { ambNodes.src.stop(); ambNodes.lfo.stop(); } catch {}
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
