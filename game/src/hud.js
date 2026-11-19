// HUD: health, money, wanted stars, objective banner, prompts, speed,
// time-of-day label, and the menu overlays (start / pause / busted).
// The DOM lives in index.html; this module only drives it.
import { state } from './state.js';

export class HUD {
  constructor(doc) {
    this.el = {
      money: doc.getElementById('hud-money'),
      healthFill: doc.getElementById('hud-health-fill'),
      stars: doc.getElementById('hud-stars'),
      objective: doc.getElementById('hud-objective'),
      prompt: doc.getElementById('hud-prompt'),
      speed: doc.getElementById('hud-speed'),
      clock: doc.getElementById('hud-clock'),
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
    this.el.healthFill.style.width = `${state.health}%`;
    if (state.wanted !== this.lastStars) {
      this.lastStars = state.wanted;
      this.el.stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(3 - state.wanted);
      this.el.stars.classList.toggle('hot', state.wanted > 0);
    }
    this.el.objective.textContent = state.objective;
    if (state.inCar) {
      const kmh = Math.round(Math.abs(state.speed) * 3.6);
      this.el.speed.textContent = `${kmh} km/h`;
      this.el.speed.style.display = 'block';
    } else {
      this.el.speed.style.display = 'none';
    }
    const labels = { day: 'DAY', sunset: 'SUNSET', night: 'NIGHT' };
    this.el.clock.textContent = labels[state.timePreset] || state.timePreset.toUpperCase();
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
