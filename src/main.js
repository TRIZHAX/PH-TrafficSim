import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/main.css';

import { SimulationEngine } from './core/SimulationEngine.js';
import { InputManager } from './input/InputManager.js';
import { Renderer2D } from './rendering/Renderer2D.js';
import { UI } from './ui/UI.js';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from './core/Config.js';

/**
 * PH TrafficSim — application bootstrap.
 * 2D is ALWAYS the default view; the 3D renderer (three.js) is lazy-loaded
 * only when the user switches modes, keeping first load fast on mobile.
 */
class App {
  constructor() {
    this.settingsObj = this._loadSettings();
    this.engine = new SimulationEngine();
    this.renderer3d = null;
    this._last = performance.now();
    this._hudTimer = 0;
    this._audio = null;
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...s, keys: { ...DEFAULT_SETTINGS.keys, ...(s.keys || {}) } };
      }
    } catch (e) { /* corrupted settings — fall through to defaults */ }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  async boot() {
    const setStatus = (pct, msg) => {
      const bar = document.getElementById('load-bar-fill');
      const st = document.getElementById('load-status');
      if (bar) bar.style.width = `${pct}%`;
      if (st) st.textContent = msg;
    };

    setStatus(20, 'Building San Miguel road network…');
    await frame();
    this.input = new InputManager(this.settingsObj);

    setStatus(45, 'Preparing interface…');
    await frame();
    this.ui = new UI(this);

    setStatus(65, 'Seeding vehicles…');
    await frame();
    this.renderer2d = new Renderer2D(document.getElementById('canvas2d'), this.engine, this.settingsObj);
    this.engine.scenarios.apply('normalDay', true);
    this.renderer2d.fitMap();

    setStatus(90, 'Starting simulation clock…');
    await frame();
    this.engine.clock.speed = this.settingsObj.simSpeed || 1;
    this._applyInitialSettings();

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);

    setStatus(100, 'Ready');
    setTimeout(() => document.getElementById('loading-screen')?.classList.add('hidden'), 350);
  }

  _applyInitialSettings() {
    const S = this.settingsObj;
    if (!S.showStats) {
      document.getElementById('dash').style.display = 'none';
      document.getElementById('status-strip').style.display = 'none';
    }
    if (!S.showConditions) document.getElementById('conditions').style.display = 'none';
    if (S.sound) this.setSound(true);
  }

  /** Lazy-load the 3D renderer the first time the user switches to 3D. */
  async enter3D() {
    if (!this.renderer3d) {
      this.ui.toast('Loading 3D environment…');
      const { Renderer3D } = await import('./rendering/Renderer3D.js');
      this.renderer3d = new Renderer3D(document.getElementById('canvas3d'), this.engine, this.settingsObj);
    }
    this.renderer3d._resize();
    this.renderer3d.setCameraMode(this.ui.driveMode ? 'third' : 'overview');
  }

  setSound(on) {
    if (on && !this._audio) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const noise = ctx.createBufferSource();
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        let lp = 0;
        for (let i = 0; i < len; i++) { lp = lp * 0.97 + (Math.random() * 2 - 1) * 0.03; data[i] = lp; }
        noise.buffer = buf; noise.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = 0.05;
        noise.connect(gain).connect(ctx.destination);
        noise.start();
        this._audio = { ctx, gain };
      } catch (e) { /* audio unavailable */ }
    } else if (!on && this._audio) {
      this._audio.ctx.close();
      this._audio = null;
    }
  }

  _loop(now) {
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;

    const driveInput = this.ui.driveMode ? this.input.read() : { throttle: 0, steer: 0, handbrake: false };
    this.engine.update(dt, driveInput);

    // ambient sound follows traffic volume
    if (this._audio) {
      const s = this.engine.stats.snapshot;
      this._audio.gain.gain.value = 0.02 + Math.min(0.08, s.vehicles / 3000);
    }

    if (this.ui.mode === '3d' && this.renderer3d) {
      if (!this.ui.driveMode) this.renderer3d.freeMove(this.input.read(), dt);
      this.renderer3d.render(dt);
    } else {
      this.renderer2d.render(dt);
    }

    this._hudTimer += dt;
    if (this._hudTimer > 0.25) { this._hudTimer = 0; this.ui.updateHUD(); }

    requestAnimationFrame(this._loop);
  }
}

const frame = () => new Promise(r => requestAnimationFrame(r));

const app = new App();
app.boot();
