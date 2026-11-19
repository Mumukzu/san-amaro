// Procedural audio: everything is synthesized with WebAudio, no audio files.
// Engine hum follows speed, a soft pad plays under the city, the police
// siren wails during a pursuit, and UI actions blip. Starts on the first
// user gesture; fully guarded so a missing AudioContext never breaks the game.
import { state } from './state.js';

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
    this.padGain = null;
    this.sirenOsc = null; this.sirenGain = null;
    this.started = false;
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = state.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
      // Ambient pad: two detuned triangles, slow breathing gain.
      this.padGain = this.ctx.createGain();
      this.padGain.gain.value = 0.045;
      const padFilter = this.ctx.createBiquadFilter();
      padFilter.type = 'lowpass'; padFilter.frequency.value = 520;
      for (const [freq, detune] of [[110, 0], [164.8, 4], [220, -3]]) {
        const o = this.ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = freq; o.detune.value = detune;
        o.connect(padFilter); o.start();
      }
      padFilter.connect(this.padGain).connect(this.master);
      // Siren: square wave, frequency alternates in update().
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      this.started = true;
    } catch {
      this.ctx = null;
    }
  }

  update() {
    if (!this.ctx || !this.started) return;
    try {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      const t = this.ctx.currentTime;
      const driving = state.inCar && state.phase === 'playing';
      const speed = Math.abs(state.speed);
      this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speed * 0.0022 : 0, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(52 + speed * 3.4, t, 0.1);
      this.engineFilter.frequency.setTargetAtTime(320 + speed * 22, t, 0.1);
      // The pad breathes: a slow sine swells its gain so the city hum
      // never sits dead-flat under the engine and the siren.
      const breathe = 0.045 + 0.02 * Math.sin(state.time * 0.5);
      this.padGain.gain.setTargetAtTime(breathe, t, 0.4);
      const siren = state.wanted > 0 && state.phase === 'playing';
      this.sirenGain.gain.setTargetAtTime(siren ? 0.035 : 0, t, 0.2);
      if (siren) {
        // The wail climbs with the heat: 2 stars wails higher than 1, 3
        // stars higher still — the player hears the pursuit escalate
        // (slice 3).
        const heat = 1 + (state.wanted - 1) * 0.12;
        this.sirenOsc.frequency.setTargetAtTime(Math.floor(state.time * 2.2) % 2 === 0 ? 720 * heat : 940 * heat, t, 0.05);
      }
    } catch {
      // Audio must never break the game.
    }
  }

  click() {
    if (!this.ctx || !this.started) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'square'; o.frequency.value = 660;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.1);
    } catch {
      // ignore
    }
  }

  setMuted(muted) {
    state.muted = muted;
    if (this.master) {
      try { this.master.gain.value = muted ? 0 : 0.9; } catch { /* ignore */ }
    }
  }
}
