// HUD: health, money, wanted stars, objective banner, prompts, speed,
// time-of-day label, and the menu overlays (start / pause / busted).
// The DOM lives in index.html; this module only drives it.
import { state } from './state.js';

// Reputation ladder (bible §9): level name + XP needed to reach the next.
const REP_LEVELS = [
  { name: 'NOBODY', at: 0 },
  { name: 'STREET', at: 200 },
  { name: 'KNOWN', at: 600 },
  { name: 'RESPECTED', at: 1200 },
  { name: 'FEARED', at: 2500 },
  { name: 'LEGEND', at: 5000 },
];

// Radio (bible §10): 3 stations, 4 original tracks each. The station
// follows the time of day; the track advances every 40 s of game time.
const RADIO = [
  {
    name: 'NEON TIDE 102.5', genre: 'Synthwave · Golden-hour driving',
    tracks: ['“Neon Horizon” — Midnight Palms', '“Golden Hour Drive” — Cassia Blue', '“Palm Shadows” — The Vultures', '“Glass Spire (Reprise)” — Mara Q'],
  },
  {
    name: '107.3 THE DOCK', genre: 'Garage rock · Rust and diesel',
    tracks: ['“Rust and Chrome” — Harbor Rats', '“Anchor Down” — Salty Dogs', '“Night Shift” — The Breakers', '“Diesel Heart” — Crane Wife'],
  },
  {
    name: 'K-VIBE 91.1', genre: 'Hip-hop / funk · Night cruising',
    tracks: ['“Chrome Dreams” — Lil Vex', '“Neon Mile” — Mara Q', '“Low and Slow” — DJ Tropic', '“Kings Fall” — The Vultures'],
  },
];

const WANTED_STATUS = [
  { text: 'CLEAN', cls: 'grey' },
  { text: 'SPOTTED', cls: 'gold' },
  { text: 'IN PURSUIT', cls: 'red' },
  { text: 'HEAVY PURSUIT', cls: 'red' },
];

function fmtClock(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = Math.floor(totalMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class HUD {
  constructor(doc) {
    this.el = {
      money: doc.getElementById('hud-money'),
      healthFill: doc.getElementById('hud-health-fill'),
      healthNum: doc.getElementById('hud-health-num'),
      armorFill: doc.getElementById('hud-armor-fill'),
      armorNum: doc.getElementById('hud-armor-num'),
      stars: doc.getElementById('hud-stars'),
      wantedStatus: doc.getElementById('hud-wanted-status'),
      objective: doc.getElementById('hud-objective'),
      missionHint: doc.getElementById('hud-mission-hint'),
      missionBar: doc.getElementById('hud-mission-bar'),
      missionStage: doc.getElementById('hud-mission-stage'),
      missionTime: doc.getElementById('hud-mission-time'),
      prompt: doc.getElementById('hud-prompt'),
      speed: doc.getElementById('hud-speed'),
      clock: doc.getElementById('hud-clock'),
      clockSub: doc.getElementById('hud-clock-sub'),
      repLevel: doc.getElementById('hud-rep-level'),
      repXp: doc.getElementById('hud-rep-xp'),
      repFill: doc.getElementById('hud-rep-fill'),
      vehName: doc.getElementById('hud-vehicle-name'),
      vehClass: doc.getElementById('hud-vehicle-class'),
      radioStation: doc.getElementById('hud-radio-station'),
      radioTrack: doc.getElementById('hud-radio-track'),
      radioGenre: doc.getElementById('hud-radio-genre'),
      toast: doc.getElementById('hud-toast'),
      menu: doc.getElementById('menu'),
      pauseMenu: doc.getElementById('pause-menu'),
      bustedMenu: doc.getElementById('busted-menu'),
      help: doc.getElementById('help-panel'),
      fps: doc.getElementById('hud-fps'),
    };
    this.toastTimer = null;
    this.lastStars = -1;
  }

  update() {
    this.el.money.textContent = `$${state.money.toLocaleString('en-US')}`;
    // Health + armour: both the bar AND the number are live.
    this.el.healthFill.style.width = `${state.health}%`;
    this.el.healthNum.textContent = Math.round(state.health);
    this.el.armorFill.style.width = `${state.armor}%`;
    this.el.armorNum.textContent = Math.round(state.armor);
    // Wanted: 5 star slots (the GTA scale; this slice caps at 3) + a
    // status badge that names what the SAMPD is doing.
    if (state.wanted !== this.lastStars) {
      this.lastStars = state.wanted;
      const filled = '★'.repeat(state.wanted);
      const empty = '☆'.repeat(5 - state.wanted);
      this.el.stars.innerHTML = `${filled}<span class="off">${empty}</span>`;
      this.el.stars.classList.toggle('hot', state.wanted > 0);
      const st = WANTED_STATUS[state.wanted] || WANTED_STATUS[0];
      this.el.wantedStatus.style.display = state.wanted > 0 ? 'inline-block' : 'none';
      this.el.wantedStatus.textContent = st.text;
      this.el.wantedStatus.className = `badge ${st.cls} wanted-status`;
    }
    // Mission panel: stage, overall progress bar, elapsed vs par time.
    this.el.objective.textContent = state.objective;
    this.el.missionStage.textContent = state.missionDone
      ? 'COMPLETE'
      : `Stage ${state.missionStage} / 3`;
    this.el.missionBar.style.width = `${Math.round(state.missionProgress * 100)}%`;
    this.el.missionTime.textContent = state.missionDone
      ? `DONE · ${fmtDuration(state.missionTime)}`
      : `+$100 · ${fmtDuration(state.missionTime)} / ${fmtDuration(state.missionPar)}`;
    if (state.inCar) {
      const kmh = Math.round(Math.abs(state.speed) * 3.6);
      this.el.speed.textContent = `${kmh} km/h`;
      this.el.speed.style.display = 'block';
      // Vehicle readout: the driven car's real name + class.
      if (state.vehicle) {
        this.el.vehName.textContent = state.vehicle.name || 'MARINA SEDAN';
        this.el.vehClass.textContent = `· ${state.vehicle.classLabel || 'SEDAN'}`;
      }
    } else {
      this.el.speed.style.display = 'none';
    }
    // Radio: station follows the time of day, track advances every 40 s.
    const stationIdx = state.timePreset === 'night' ? 2 : state.timePreset === 'day' ? 1 : 0;
    const stn = RADIO[stationIdx];
    const trackIdx = Math.floor(state.time / 40) % stn.tracks.length;
    this.el.radioStation.textContent = stn.name;
    this.el.radioTrack.textContent = stn.tracks[trackIdx];
    this.el.radioGenre.textContent = stn.genre;
    // Clock: day + in-game time, with the period label underneath
    // (GOLDEN HOUR at sunset, not just "SUNSET").
    this.el.clock.textContent = `DAY ${state.day} · ${fmtClock(state.clockMinutes)}`;
    const period = { day: 'DAY', sunset: 'GOLDEN HOUR', night: 'NIGHT' };
    this.el.clockSub.textContent = period[state.timePreset] || state.timePreset.toUpperCase();
    // Reputation: level name + XP to the next level + bar.
    let lvl = REP_LEVELS[0];
    let next = REP_LEVELS[1];
    for (let i = 0; i < REP_LEVELS.length; i += 1) {
      if (state.rep >= REP_LEVELS[i].at) {
        lvl = REP_LEVELS[i];
        next = REP_LEVELS[i + 1] || null;
      }
    }
    this.el.repLevel.textContent = lvl.name;
    this.el.repXp.textContent = next
      ? `${state.rep} / ${next.at} XP`
      : `${state.rep} XP · MAX`;
    const span = next ? next.at - lvl.at : 1;
    this.el.repFill.style.width = `${Math.min(100, ((state.rep - lvl.at) / span) * 100)}%`;
    if (state.debug) {
      this.el.fps.style.display = 'block';
      this.el.fps.textContent = `${state.fps} FPS · ${state.drawCalls} calls · ${(state.triangles / 1000).toFixed(0)}k tris`;
    } else {
      this.el.fps.style.display = 'none';
    }
  }

  setPrompt(text) {
    this.el.prompt.textContent = text || '';
    this.el.prompt.style.display = text ? 'block' : 'none';
  }

  toast(text, ms = 2600) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), ms);
  }

  showMenu(name) {
    for (const [key, el] of [['menu', this.el.menu], ['pause', this.el.pauseMenu], ['busted', this.el.bustedMenu]]) {
      el.classList.toggle('visible', key === name);
    }
    this.el.help.classList.toggle('visible', name === 'menu');
  }

  hideMenus() {
    this.showMenu('none');
  }

  toggleHelp(show) {
    this.el.help.classList.toggle('visible', show);
  }
}
