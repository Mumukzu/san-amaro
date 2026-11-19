// Save / load: money, best escape and missions completed, kept in
// localStorage (offline, this browser only). Never throws.
import { SAVE_KEY } from './config.js';
import { state } from './state.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    // Clamp every loaded value: a hand-edited or corrupt save with a
    // negative money, a NaN rep or a day of 10^9 would break the HUD
    // (NaN money renders as "NaN" and never recovers). Slice 3.
    const num = (v, lo, hi, fallback) => (typeof v === 'number' && Number.isFinite(v)
      ? Math.max(lo, Math.min(hi, v)) : fallback);
    state.money = num(data.money, 0, 99999999, state.money);
    state.bestEscape = num(data.bestEscape, 0, 9999, state.bestEscape);
    state.missionsDone = num(data.missionsDone, 0, 999, state.missionsDone);
    state.rep = num(data.rep, 0, 10000, state.rep);
    state.day = num(data.day, 1, 999, state.day);
    state.clockMinutes = num(data.clockMinutes, 0, 1439, state.clockMinutes);
    state.armor = num(data.armor, 0, 100, state.armor);
    if (typeof data.timePreset === 'string') state.timePreset = data.timePreset;
  } catch {
    // Corrupt or unavailable storage: play fresh.
  }
}

export function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money,
      bestEscape: state.bestEscape,
      missionsDone: state.missionsDone,
      timePreset: state.timePreset,
      rep: state.rep,
      day: state.day,
      clockMinutes: state.clockMinutes,
      armor: state.armor,
    }));
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
}
