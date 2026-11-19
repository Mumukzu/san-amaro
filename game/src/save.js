// Save / load: money, best escape and missions completed, kept in
// localStorage (offline, this browser only). Never throws.
import { SAVE_KEY } from './config.js';
import { state } from './state.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.money === 'number') state.money = data.money;
    if (typeof data.bestEscape === 'number') state.bestEscape = data.bestEscape;
    if (typeof data.missionsDone === 'number') state.missionsDone = data.missionsDone;
    if (typeof data.timePreset === 'string') state.timePreset = data.timePreset;
    // HUD state carried across sessions: reputation, day/clock, armour.
    if (typeof data.rep === 'number') state.rep = data.rep;
    if (typeof data.day === 'number') state.day = data.day;
    if (typeof data.clockMinutes === 'number') state.clockMinutes = data.clockMinutes;
    if (typeof data.armor === 'number') state.armor = data.armor;
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
