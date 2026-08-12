import { bus } from '../core/EventBus.js';
import { WEATHER, ROAD_CONDITIONS, INCIDENT_TYPES, VEHICLE_TYPES, KMH, SCENARIOS, DEFAULT_MIX } from '../core/Config.js';
import { Pages } from './Pages.js';
import { MobileControls } from './MobileControls.js';
import { DriveHUD } from './DriveHUD.js';
import { icon } from './icons.js';

/**
 * UI — builds the whole shell (nav rail, top bar, dashboards, drawer,
 * status strip, modals, touch controls) and binds it to the engine.
 * The developer credit "Designed & Created by TRIZHAX" is rendered
 * persistently in the nav rail (desktop) and as a floating tag (all views).
 */
export class UI {
  constructor(app) {
    this.app = app;           // { engine, settings, renderer2d, input, ... }
    this.engine = app.engine;
    this.mode = '2d';
    this.driveMode = false;
    this._buildShell();
    this.pages = new Pages(this);
    this.mobile = new MobileControls(this);
    this.driveHud = new DriveHUD(this);
    this._bindEvents();
    this._bindOrientation();
    this._toastTimer = null;
  }

  $(sel) { return document.querySelector(sel); }
  el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  toast(msg) {
    const t = this.$('#toast');
    t.textContent = msg;
    t.classList.add('show', 'glass');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---- shell construction ---- */
  _buildShell() {
    const app = document.getElementById('app');
    const shell = this.el('div', null, '');
    shell.id = 'shell';
    shell.innerHTML = `
      <nav id="nav-rail">
        <div class="rail-logo">PH</div>
        <button class="rail-btn active" data-nav="simulate">${icon('signal', { size: 22 })}<span>Simulate</span></button>
        <button class="rail-btn" data-nav="explore">${icon('compass', { size: 22 })}<span>Explore</span></button>
        <button class="rail-btn" data-nav="maps">${icon('map', { size: 22 })}<span>Maps</span></button>
        <button class="rail-btn" data-nav="lab">${icon('flask', { size: 22 })}<span>Lab</span></button>
        <button class="rail-btn" data-nav="analytics">${icon('chart', { size: 22 })}<span>Analytics</span></button>
        <button class="rail-btn" data-nav="settings">${icon('gear', { size: 22 })}<span>Settings</span></button>
        <div class="rail-spacer"></div>
        <div class="rail-credit">Designed &amp; Created by TRIZHAX</div>
      </nav>
      <main id="viewport">
        <canvas id="canvas2d"></canvas>
        <canvas id="canvas3d"></canvas>

        <div id="topbar">
          <div class="brand-chip">
            <h1>PH <em>TRAFFICSIM</em></h1>
            <span class="brand-loc" id="brand-loc">${icon('pin', { size: 13, cls: 'inline-ico' })}<span id="brand-loc-txt">San Miguel, Bulacan</span></span>
          </div>
          <div class="mode-switch" role="tablist" aria-label="View mode">
            <button id="btn-2d" class="active">2D</button>
            <button id="btn-3d">3D</button>
          </div>
          <div class="topbar-spacer"></div>
          <div class="tb-group desktop-only" id="speed-group">
            <button class="tb-btn" id="btn-play" title="Play / Pause (P)">${icon('pause', { size: 16 })}</button>
            <button class="tb-btn speed active" data-speed="1">1×</button>
            <button class="tb-btn speed" data-speed="2">2×</button>
            <button class="tb-btn speed" data-speed="5">5×</button>
            <button class="tb-btn speed" data-speed="10">10×</button>
          </div>
          <div class="tb-group">
            <button class="tb-btn" id="btn-drive" title="Drive a vehicle">${icon('steering', { size: 17 })}</button>
            <button class="tb-btn" id="btn-camera" title="Camera (C)">${icon('camera', { size: 17 })}</button>
            <button class="tb-btn" id="btn-drawer" title="Control panel">${icon('sliders', { size: 17 })}</button>
          </div>
        </div>

        <section id="dash" class="glass">
          <div class="panel-title">Traffic Status <button class="collapse-btn" data-collapse="dash">—</button></div>
          <div class="congestion-badge"><span class="congestion-dot" id="cg-dot" style="color:#38e07d;background:#38e07d"></span><span id="cg-label">LOW</span></div>
          <div class="dash-body">
            <div class="stat-row"><span class="k">Vehicles</span><span class="v" id="st-veh">0</span></div>
            <div class="stat-row"><span class="k">Avg Speed</span><span class="v" id="st-speed">0<small>km/h</small></span></div>
            <div class="stat-row"><span class="k">Density</span><span class="v" id="st-density">0<small>%</small></span></div>
            <div class="stat-bar"><i id="bar-density" style="width:0%"></i></div>
            <div class="stat-row"><span class="k">Flow</span><span class="v" id="st-flow">0<small>veh/hr</small></span></div>
            <div class="stat-row"><span class="k">Avg Delay</span><span class="v" id="st-delay">0<small>sec</small></span></div>
            <div class="stat-row"><span class="k">Queue</span><span class="v" id="st-queue">0<small>veh</small></span></div>
            <div class="stat-row"><span class="k">Road Capacity</span><span class="v" id="st-cap">100<small>%</small></span></div>
            <div class="stat-bar"><i id="bar-cap" style="width:100%;background:var(--green)"></i></div>
          </div>
        </section>

        <section id="conditions" class="glass">
          <div class="panel-title">Conditions <button class="collapse-btn" data-collapse="conditions">—</button></div>
          <div class="cond-body">
            <div class="cond-row"><span class="k">Weather</span><span class="v cond-v" id="cd-weather">${icon('sun', { size: 15, cls: 'inline-ico' })}<span>Clear</span></span></div>
            <div class="cond-row"><span class="k">Visibility</span><span class="v" id="cd-vis">100%</span></div>
            <div class="cond-row"><span class="k">Road</span><span class="v cond-v" id="cd-road">${icon('check', { size: 15, cls: 'inline-ico' })}<span>Good</span></span></div>
            <div class="cond-row"><span class="k">Road Quality</span><span class="v" id="cd-quality">100%</span></div>
            <div class="cond-row"><span class="k">Incidents</span><span class="v" id="cd-inc">None</span></div>
            <div class="cond-row"><span class="k">Signal Green</span><span class="v" id="cd-green">25s</span></div>
          </div>
        </section>

        <aside id="drawer" class="hidden">
          <div class="drawer-tabs glass">
            <button class="active" data-tab="traffic">Traffic</button>
            <button data-tab="nature">Nature</button>
            <button data-tab="roads">Roads</button>
            <button data-tab="signals">Signals</button>
          </div>
          <div class="drawer-body glass" id="drawer-body"></div>
        </aside>

        <div id="status-strip" class="glass">
          <span id="ss-cong" class="ss-item">${icon('dot', { size: 13, cls: 'inline-ico' })}<b>LOW</b></span><span class="sep"></span>
          <span class="ss-item">${icon('car', { size: 15, cls: 'inline-ico' })}<b id="ss-veh">0</b></span><span class="sep"></span>
          <span class="ss-item">${icon('gauge', { size: 15, cls: 'inline-ico' })}<b id="ss-speed">0</b> km/h</span><span class="sep"></span>
          <span class="ss-item">${icon('density', { size: 15, cls: 'inline-ico' })}<b id="ss-density">0</b>%</span><span class="sep"></span>
          <span class="ss-item">${icon('clock', { size: 15, cls: 'inline-ico' })}<b id="ss-delay">0</b>s</span><span class="sep"></span>
          <span class="ss-item">${icon('clock', { size: 15, cls: 'inline-ico' })}<b id="ss-time">00:00</b></span>
        </div>

        <div id="drive-hud" class="glass">
          <div><div class="speed" id="hud-speed">0</div><small class="speed">KM/H</small></div>
          <button class="exit" id="hud-exit">EXIT VEHICLE</button>
        </div>

        <div id="touch-controls">
          <button class="tc-btn" id="tc-left">${icon('arrowLeft', { size: 26 })}</button>
          <button class="tc-btn" id="tc-right">${icon('arrowRight', { size: 26 })}</button>
          <button class="tc-btn" id="tc-accel">${icon('arrowUp', { size: 26 })}</button>
          <button class="tc-btn" id="tc-brake">BRAKE</button>
        </div>

        <div id="fab-stack">
          <button class="fab" id="fab-menu">${icon('menu', { size: 20 })}</button>
          <button class="fab" id="fab-stats">${icon('chart', { size: 20 })}</button>
          <button class="fab" id="fab-cam">${icon('camera', { size: 20 })}</button>
          <button class="fab" id="fab-drive">${icon('steering', { size: 20 })}</button>
        </div>

        <nav id="mobile-nav">
          <button class="active" data-nav="simulate">${icon('signal', { size: 20 })}<span>Simulate</span></button>
          <button data-nav="maps">${icon('map', { size: 20 })}<span>Maps</span></button>
          <button data-nav="lab">${icon('flask', { size: 20 })}<span>Lab</span></button>
          <button data-nav="analytics">${icon('chart', { size: 20 })}<span>Charts</span></button>
          <button data-nav="settings">${icon('gear', { size: 20 })}<span>More</span></button>
        </nav>

        <p class="desktop-hint" id="desktop-hint">W/A/S/D drive · drag to pan · scroll to zoom · C camera · P pause</p>
        <div id="credit">Designed &amp; Created by TRIZHAX</div>
        <div id="toast"></div>

        <div id="vehicle-modal">
          <div class="vm-card glass">
            <h3>SELECT VEHICLE</h3>
            <div class="vm-options">
              <button class="vm-opt" data-vehicle="car"><div class="ico">${icon('car', { size: 40 })}</div><h4>CAR</h4><p>max 50 km/h</p></button>
              <button class="vm-opt" data-vehicle="motorcycle"><div class="ico">${icon('motorcycle', { size: 40 })}</div><h4>MOTORCYCLE</h4><p>max 60 km/h</p></button>
            </div>
            <button class="vm-cancel" id="vm-cancel">Cancel</button>
          </div>
        </div>

        <div id="results-modal">
          <div class="results-card glass">
            <h3>SIMULATION SNAPSHOT</h3>
            <p class="loc" id="rs-loc">${icon('pin', { size: 13, cls: 'inline-ico' })}<span id="rs-loc-txt">San Miguel, Bulacan</span></p>
            <div class="results-grid" id="rs-grid"></div>
            <div class="btn-row">
              <button class="btn btn-ghost" id="rs-analytics">VIEW ANALYTICS</button>
              <button class="btn btn-ghost" id="rs-export">EXPORT CSV</button>
            </div>
            <div class="btn-row" style="margin-top:8px">
              <button class="btn btn-primary" id="rs-again">RUN AGAIN</button>
              <button class="btn btn-ghost" id="rs-close">CLOSE</button>
            </div>
          </div>
        </div>

        <div id="rotate-overlay">
          <div class="ro-inner">
            <svg class="ro-phone" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="7" y="2" width="10" height="20" rx="2.4"/>
              <path d="M11 18h2"/>
            </svg>
            <div class="ro-title">Rotate your phone</div>
            <p class="ro-text">3D driving works best in landscape. Turn your device sideways to take the wheel with full-width controls.</p>
            <button class="ro-exit" id="ro-exit">Exit vehicle</button>
          </div>
        </div>

        <div id="page"><div class="page-inner" id="page-inner"></div></div>
      </main>`;
    app.appendChild(shell);
    this._renderDrawerTab('traffic');
  }

  /* ---- drawer tabs: live control panels ---- */
  _renderDrawerTab(tab) {
    const body = this.$('#drawer-body');
    const e = this.engine;
    if (tab === 'traffic') {
      const mix = e.traffic.mix;
      body.innerHTML = `
        <div class="ctl-group">
          <div class="ctl-label">Traffic Volume <span class="val" id="vol-val">${e.traffic.targetCount} vehicles</span></div>
          <input type="range" id="ctl-volume" min="10" max="350" step="5" value="${e.traffic.targetCount}">
        </div>
        <div class="ctl-group">
          <div class="ctl-label">Fleet Mix</div>
          ${Object.entries(VEHICLE_TYPES).map(([id, t]) => `
            <div class="ctl-label ctl-label-ico" style="text-transform:none;font-size:11.5px">${icon(t.icon, { size: 16, cls: 'inline-ico' })}<span>${t.label}</span> <span class="val" id="mix-val-${id}">${Math.round((mix[id] || 0) * 100)}%</span></div>
            <input type="range" class="ctl-mix" data-type="${id}" min="0" max="100" value="${Math.round((mix[id] || 0) * 100)}">
          `).join('')}
        </div>
        <div class="ctl-group">
          <div class="ctl-label">Speed Limit Scale <span class="val" id="sls-val">${Math.round((e.scenarios.speedLimitScale || 1) * 100)}%</span></div>
          <input type="range" id="ctl-sls" min="50" max="120" step="5" value="${Math.round((e.scenarios.speedLimitScale || 1) * 100)}">
        </div>
        <button class="btn btn-primary" id="ctl-apply-traffic">APPLY &amp; RESEED</button>
        <button class="btn btn-ghost btn-ico" id="ctl-results">${icon('clipboard', { size: 15 })}<span>SIMULATION SNAPSHOT</span></button>`;
      body.querySelector('#ctl-volume').addEventListener('input', ev => {
        this.$('#vol-val').textContent = `${ev.target.value} vehicles`;
        e.traffic.setTarget(+ev.target.value);
      });
      body.querySelectorAll('.ctl-mix').forEach(sl => sl.addEventListener('input', () => {
        const newMix = {};
        body.querySelectorAll('.ctl-mix').forEach(s => newMix[s.dataset.type] = +s.value / 100);
        const total = Object.values(newMix).reduce((a, b) => a + b, 0) || 1;
        Object.keys(newMix).forEach(k => newMix[k] /= total);
        e.traffic.setMix(newMix);
        body.querySelectorAll('.ctl-mix').forEach(s => {
          body.querySelector(`#mix-val-${s.dataset.type}`).textContent = `${Math.round(newMix[s.dataset.type] * 100)}%`;
        });
      }));
      body.querySelector('#ctl-sls').addEventListener('input', ev => {
        this.$('#sls-val').textContent = `${ev.target.value}%`;
        e.scenarios._applySpeedScale(+ev.target.value / 100);
      });
      body.querySelector('#ctl-apply-traffic').addEventListener('click', () => {
        e.start(true); this.toast('Traffic reseeded with new configuration');
      });
      body.querySelector('#ctl-results').addEventListener('click', () => this.showResults());
    } else if (tab === 'nature') {
      body.innerHTML = `
        <div class="ctl-group">
          <div class="ctl-label">Nature Conditions</div>
          <div class="chip-row">
            ${Object.entries(WEATHER).map(([id, w]) => `<button class="chip chip-ico ${e.weather.current === id ? 'active' : ''}" data-weather="${id}">${icon(w.icon, { size: 15, cls: 'inline-ico' })}<span>${w.label}</span></button>`).join('')}
          </div>
        </div>
        <div class="ctl-group" id="weather-info"></div>`;
      const info = () => {
        const w = e.weather.get();
        body.querySelector('#weather-info').innerHTML = `
          <div class="ctl-label">Effects on Model</div>
          <div class="cond-row"><span class="k">Speed factor</span><span class="v">${Math.round(w.speedFactor * 100)}%</span></div>
          <div class="cond-row"><span class="k">Visibility</span><span class="v">${Math.round(w.visibility * 100)}%</span></div>
          <div class="cond-row"><span class="k">Braking distance</span><span class="v">${w.brakingFactor > 1 ? '+' : ''}${Math.round((w.brakingFactor - 1) * 100)}%</span></div>
          <div class="cond-row"><span class="k">Following headway</span><span class="v">${w.headwayFactor > 1 ? '+' : ''}${Math.round((w.headwayFactor - 1) * 100)}%</span></div>
          <div class="cond-row"><span class="k">Capacity</span><span class="v">${Math.round(w.capacityFactor * 100)}%</span></div>`;
      };
      info();
      body.querySelectorAll('[data-weather]').forEach(b => b.addEventListener('click', () => {
        e.weather.set(b.dataset.weather);
        body.querySelectorAll('[data-weather]').forEach(x => x.classList.toggle('active', x.dataset.weather === b.dataset.weather));
        info();
        this.toast(`Weather: ${WEATHER[b.dataset.weather].label}`);
      }));
    } else if (tab === 'roads') {
      body.innerHTML = `
        <div class="ctl-group">
          <div class="ctl-label">Road Surface</div>
          <div class="chip-row">
            ${Object.entries(ROAD_CONDITIONS).map(([id, r]) => `<button class="chip chip-ico ${e.roadCond.condition === id ? 'active' : ''}" data-road="${id}">${icon(r.icon, { size: 15, cls: 'inline-ico' })}<span>${r.label}</span></button>`).join('')}
          </div>
        </div>
        <div class="ctl-group">
          <div class="ctl-label">Road Quality <span class="val" id="rq-val">${e.roadCond.quality}%</span></div>
          <input type="range" id="ctl-quality" min="20" max="100" step="5" value="${e.roadCond.quality}">
        </div>
        <div class="ctl-group">
          <div class="ctl-label">Incidents &amp; Works</div>
          <div class="chip-row">
            ${Object.entries(INCIDENT_TYPES).map(([id, t]) => `<button class="chip chip-ico danger" data-incident="${id}">${icon(t.icon, { size: 15, cls: 'inline-ico' })}<span>${t.label}</span></button>`).join('')}
          </div>
          <button class="btn btn-danger" id="ctl-clear-inc">CLEAR ALL INCIDENTS</button>
          <div class="ctl-label" style="margin-top:4px">Active <span class="val" id="inc-list">none</span></div>
        </div>`;
      body.querySelectorAll('[data-road]').forEach(b => b.addEventListener('click', () => {
        e.roadCond.set(b.dataset.road);
        body.querySelectorAll('[data-road]').forEach(x => x.classList.toggle('active', x.dataset.road === b.dataset.road));
        this.$('#rq-val').textContent = `${e.roadCond.quality}%`;
        body.querySelector('#ctl-quality').value = e.roadCond.quality;
        this.app.renderer2d.invalidate();
        this.toast(`Road condition: ${ROAD_CONDITIONS[b.dataset.road].label}`);
      }));
      body.querySelector('#ctl-quality').addEventListener('input', ev => {
        e.roadCond.setQuality(+ev.target.value);
        this.$('#rq-val').textContent = `${ev.target.value}%`;
        body.querySelectorAll('[data-road]').forEach(x => x.classList.toggle('active', x.dataset.road === e.roadCond.condition));
      });
      const updateIncList = () => {
        const list = e.incidents.incidents;
        body.querySelector('#inc-list').textContent = list.length ? list.map(i => i.spec.label).join(', ') : 'none';
      };
      body.querySelectorAll('[data-incident]').forEach(b => b.addEventListener('click', () => {
        const inc = e.incidents.create(b.dataset.incident);
        if (inc) this.toast(`${inc.spec.label} created${inc.duration !== Infinity ? ` (${inc.duration}s)` : ''}`);
        updateIncList();
      }));
      body.querySelector('#ctl-clear-inc').addEventListener('click', () => { e.incidents.clearAll(); updateIncList(); this.toast('All incidents cleared'); });
      updateIncList();
    } else if (tab === 'signals') {
      const t = e.lights.getTiming();
      body.innerHTML = `
        <div class="ctl-group">
          <div class="ctl-label ctl-label-ico"><span class="sig-dot" style="background:var(--green)"></span><span>Green Time</span> <span class="val" id="g-val">${t.green}s</span></div>
          <input type="range" id="ctl-green" min="10" max="60" value="${t.green}">
          <div class="ctl-label ctl-label-ico"><span class="sig-dot" style="background:var(--amber)"></span><span>Yellow Time</span> <span class="val" id="y-val">${t.yellow}s</span></div>
          <input type="range" id="ctl-yellow" min="3" max="10" value="${t.yellow}">
          <div class="ctl-label ctl-label-ico"><span class="sig-dot" style="background:var(--red)"></span><span>Red Time</span> <span class="val" id="r-val">${t.red}s</span></div>
          <input type="range" id="ctl-red" min="10" max="60" value="${t.red}">
        </div>
        <p style="font-size:11px;color:var(--text-dim);line-height:1.5">Timing applies to all ${e.lights.controllers.size} signalized intersections on this map. Red time controls the opposing phase's green.</p>`;
      const apply = () => {
        e.lights.setTiming({
          green: +body.querySelector('#ctl-green').value,
          yellow: +body.querySelector('#ctl-yellow').value,
          red: +body.querySelector('#ctl-red').value
        });
        const nt = e.lights.getTiming();
        this.$('#g-val').textContent = `${nt.green}s`;
        this.$('#y-val').textContent = `${nt.yellow}s`;
        this.$('#r-val').textContent = `${nt.red}s`;
      };
      ['#ctl-green', '#ctl-yellow', '#ctl-red'].forEach(s => body.querySelector(s).addEventListener('input', apply));
    }
  }
  _bindEvents() {
    const e = this.engine;
    // Nav (rail + mobile)
    document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
      const nav = b.dataset.nav;
      document.querySelectorAll('[data-nav]').forEach(x => x.classList.toggle('active', x.dataset.nav === nav));
      if (nav === 'simulate') { this.pages.close(); }
      else if (nav === 'explore') { this.pages.close(); this.exitDrive(); this.app.renderer2d.fitMap(); this.toast('Explore: drag to pan, scroll/pinch to zoom'); }
      else this.pages.open(nav);
    }));

    // Mode switch 2D/3D
    this.$('#btn-2d').addEventListener('click', () => this.setMode('2d'));
    this.$('#btn-3d').addEventListener('click', () => this.setMode('3d'));

    // Play / pause / speed
    this.$('#btn-play').addEventListener('click', () => this.togglePause());
    document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
      e.clock.speed = +b.dataset.speed;
      e.clock.paused = false;
      this.$('#btn-play').innerHTML = icon('pause', { size: 16 });
      document.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('active', x === b));
    }));

    // Drawer
    this.$('#btn-drawer').addEventListener('click', () => this.$('#drawer').classList.toggle('hidden'));
    document.querySelectorAll('.drawer-tabs button').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.drawer-tabs button').forEach(x => x.classList.toggle('active', x === b));
      this._renderDrawerTab(b.dataset.tab);
    }));

    // Collapsible panels
    document.querySelectorAll('[data-collapse]').forEach(b => b.addEventListener('click', () => {
      const p = this.$(`#${b.dataset.collapse}`);
      p.classList.toggle('collapsed');
      b.textContent = p.classList.contains('collapsed') ? '+' : '—';
    }));

    // Drive
    this.$('#btn-drive').addEventListener('click', () => this.openVehicleSelect());
    this.$('#fab-drive').addEventListener('click', () => this.openVehicleSelect());
    this.$('#vm-cancel').addEventListener('click', () => this.$('#vehicle-modal').classList.remove('open'));
    document.querySelectorAll('[data-vehicle]').forEach(b => b.addEventListener('click', () => this.startDrive(b.dataset.vehicle)));
    this.$('#hud-exit').addEventListener('click', () => this.exitDrive());

    // Camera
    this.$('#btn-camera').addEventListener('click', () => this.cycleCamera());
    this.$('#fab-cam').addEventListener('click', () => this.cycleCamera());
    bus.on('input:camera', () => this.cycleCamera());
    bus.on('input:pause', () => this.togglePause());
    bus.on('input:menu', () => { this.pages.close(); this.$('#vehicle-modal').classList.remove('open'); this.$('#results-modal').classList.remove('open'); });

    // Mobile FABs
    this.$('#fab-menu').addEventListener('click', () => this.$('#drawer').classList.toggle('hidden'));
    this.$('#fab-stats').addEventListener('click', () => {
      const d = this.$('#dash');
      d.style.display = d.style.display === 'none' ? '' : 'none';
    });

    // Results modal
    this.$('#rs-close').addEventListener('click', () => this.$('#results-modal').classList.remove('open'));
    this.$('#rs-again').addEventListener('click', () => { this.$('#results-modal').classList.remove('open'); e.start(true); this.toast('Simulation restarted'); });
    this.$('#rs-export').addEventListener('click', () => { e.recorder.download(); this.toast('CSV exported'); });
    this.$('#rs-analytics').addEventListener('click', () => { this.$('#results-modal').classList.remove('open'); this.pages.open('analytics'); });

    // Engine events
    bus.on('map:loaded', () => {
      this.$('#brand-loc-txt').textContent = e.maps.current.name;
      this.$('#rs-loc-txt').textContent = e.maps.current.name;
    });
    bus.on('weather:changed', () => this._updateConditions());
    bus.on('road:changed', () => { this._updateConditions(); this.app.renderer2d.invalidate(); });
    bus.on('incident:created', () => this._updateConditions());
    bus.on('incident:removed', () => this._updateConditions());

    // hide desktop hint after a while
    setTimeout(() => { const h = this.$('#desktop-hint'); if (h) h.style.opacity = '0'; }, 12000);
  }

  /**
   * Orientation gate (mobile 3D driving). On a touch phone held in portrait,
   * 3D driving is cramped and the road ahead is hidden behind the HUD, so we
   * show a blocking "rotate your phone" overlay that pauses driving input and
   * auto-clears the instant the device is turned to landscape. Both renderers
   * already listen to window 'resize' (which fires on rotation), so the canvas
   * follows the new aspect automatically. */
  _bindOrientation() {
    this.$('#ro-exit')?.addEventListener('click', () => this.exitDrive());
    this._onOrient = () => this._syncOrientationGate();
    window.addEventListener('resize', this._onOrient);
    window.addEventListener('orientationchange', this._onOrient);
  }

  /** True when running on a phone-sized screen (matches the CSS mobile bp). */
  _isMobileViewport() {
    return this.mobile.isTouch && window.matchMedia('(max-width: 860px)').matches;
  }

  /** True when the phone is currently held upright (portrait). */
  _isPortrait() {
    return window.matchMedia('(orientation: portrait)').matches;
  }

  /**
   * Show/hide the rotate gate based on current mode + orientation. The gate is
   * only required for 3D driving on a portrait phone (per product decision).
   * While gated, we freeze driving input so the parked car doesn't drift.
   */
  _syncOrientationGate() {
    const gate = this.driveMode && this.mode === '3d' && this._isMobileViewport() && this._isPortrait();
    const overlay = this.$('#rotate-overlay');
    if (!overlay) return;
    overlay.classList.toggle('show', gate);
    document.body.classList.toggle('drive-gated', gate);
    // Freeze/thaw driving input so the vehicle holds still behind the overlay.
    if (this.app.input) this.app.input.enabled = !gate;
    if (gate) this.app.input?.setTouch({ throttle: 0, steer: 0, handbrake: false });
  }

  togglePause() {
    const e = this.engine;
    e.clock.paused = !e.clock.paused;
    this.$('#btn-play').innerHTML = icon(e.clock.paused ? 'play' : 'pause', { size: 16 });
    this.toast(e.clock.paused ? 'Paused' : 'Running');
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    document.body.classList.toggle('mode-3d', mode === '3d');
    this.$('#btn-2d').classList.toggle('active', mode === '2d');
    this.$('#btn-3d').classList.toggle('active', mode === '3d');
    if (mode === '3d') this.app.enter3D();
    else this.app.exit2D?.();
    this._syncOrientationGate();
    this.toast(mode === '3d' ? '3D visualization — same simulation state' : '2D simulation view');
  }

  openVehicleSelect() { this.$('#vehicle-modal').classList.add('open'); }

  startDrive(type) {
    this.$('#vehicle-modal').classList.remove('open');
    const cam = this.app.renderer2d.camera;
    this.engine.spawnPlayer(type, cam.x, cam.y);
    this.driveMode = true;
    document.body.classList.add('driving');
    this.app.renderer2d._followPlayer = true;
    cam.follow = this.engine.player;
    if (cam.zoom < 2) cam.zoom = 3.2;
    this.driveHud.show();
    if (this.mobile.isTouch) this.$('#touch-controls').classList.add('active');
    this.app.renderer3d?.setCameraMode?.('third');
    this._syncOrientationGate();
    this.toast(`Driving ${VEHICLE_TYPES[type].label} — ${this.mobile.isTouch ? 'use touch controls' : 'W/A/S/D to drive'}`);
  }

  exitDrive() {
    if (!this.driveMode) return;
    this.driveMode = false;
    document.body.classList.remove('driving');
    const summary = this.engine.driving?.summary?.();
    this.engine.removePlayer();
    this.app.renderer2d._followPlayer = false;
    this.app.renderer2d.camera.follow = null;
    this.driveHud.hide();
    this.$('#touch-controls').classList.remove('active');
    this.app.renderer3d?.setCameraMode?.('overview');
    this._syncOrientationGate();
    if (summary && summary.distance > 5) this.showDriveResults(summary);
  }

  cycleCamera() {
    if (this.mode === '3d' && this.app.renderer3d) {
      const next = this.app.renderer3d.cycleCameraMode(this.driveMode);
      this.toast(`Camera: ${next}`);
    } else {
      const cam = this.app.renderer2d.camera;
      if (this.driveMode && cam.follow) { cam.follow = null; this.app.renderer2d._followPlayer = false; this.toast('Camera: free pan'); }
      else if (this.driveMode) { cam.follow = this.engine.player; this.app.renderer2d._followPlayer = true; this.toast('Camera: follow vehicle'); }
      else { this.app.renderer2d.fitMap(); this.toast('Camera: overview'); }
    }
  }

  showResults() {
    const s = this.engine.stats.snapshot;
    const mins = Math.floor(s.time / 60), secs = Math.floor(s.time % 60);
    this.$('#rs-grid').innerHTML = `
      <div class="result-stat"><div class="k">Duration</div><div class="v">${mins}m ${secs}s</div></div>
      <div class="result-stat"><div class="k">Vehicles Simulated</div><div class="v">${this.engine.traffic.spawnedTotal}</div></div>
      <div class="result-stat"><div class="k">Average Speed</div><div class="v">${s.avgSpeed} km/h</div></div>
      <div class="result-stat"><div class="k">Traffic Density</div><div class="v">${s.density}%</div></div>
      <div class="result-stat"><div class="k">Traffic Flow</div><div class="v">${s.flow} veh/hr</div></div>
      <div class="result-stat"><div class="k">Average Delay</div><div class="v">${s.delay} sec</div></div>
      <div class="result-stat"><div class="k">Max Queue</div><div class="v">${s.maxQueue} veh</div></div>
      <div class="result-stat"><div class="k">Utilization</div><div class="v">${s.utilization}%</div></div>
      <div class="result-stat" style="grid-column:1/-1"><div class="k">Traffic Status</div><div class="v v-ico" style="color:${s.congestion.color}">${icon('dot', { size: 13, cls: 'inline-ico' })}<span>${s.congestion.label}</span></div></div>`;
    this.$('#results-modal').classList.add('open');
  }

  _updateConditions() {
    if (!this.app.settingsObj?.showConditions) return;
    const e = this.engine;
    const w = e.weather.get();
    const r = e.roadCond.get();
    this.$('#cd-weather').innerHTML = `${icon(w.icon, { size: 15, cls: 'inline-ico' })}<span>${w.label}</span>`;
    this.$('#cd-vis').textContent = `${Math.round(w.visibility * 100)}%`;
    this.$('#cd-road').innerHTML = `${icon(r.icon, { size: 15, cls: 'inline-ico' })}<span style="color:${r.color || 'inherit'}">${r.label}</span>`;
    this.$('#cd-quality').textContent = `${e.roadCond.quality}%`;
    const incs = e.incidents.incidents;
    this.$('#cd-inc').textContent = incs.length ? `${incs.length} active` : 'None';
    this.$('#cd-green').textContent = `${e.lights.getTiming().green}s`;
  }

  /** Called every ~250ms by the app loop. */
  updateHUD() {
    const s = this.engine.stats.snapshot;
    const c = s.congestion;
    this.$('#cg-label').textContent = c.label;
    const dot = this.$('#cg-dot');
    dot.style.color = c.color; dot.style.background = c.color;
    this.$('#cg-label').style.color = c.color;
    this.$('#st-veh').textContent = s.vehicles;
    this.$('#st-speed').innerHTML = `${s.avgSpeed}<small>km/h</small>`;
    this.$('#st-density').innerHTML = `${s.density}<small>%</small>`;
    this.$('#bar-density').style.width = `${Math.min(100, s.density)}%`;
    this.$('#bar-density').style.background = c.color;
    this.$('#st-flow').innerHTML = `${s.flow}<small>veh/hr</small>`;
    this.$('#st-delay').innerHTML = `${s.delay}<small>sec</small>`;
    this.$('#st-queue').innerHTML = `${s.queue}<small>veh</small>`;
    this.$('#st-cap').innerHTML = `${s.capacity}<small>%</small>`;
    this.$('#bar-cap').style.width = `${s.capacity}%`;
    // strip
    this.$('#ss-cong').innerHTML = `${icon('dot', { size: 13, cls: 'inline-ico' })}<b style="color:${c.color}">${c.label}</b>`;
    this.$('#ss-cong').style.color = c.color;
    this.$('#ss-veh').textContent = s.vehicles;
    this.$('#ss-speed').textContent = s.avgSpeed;
    this.$('#ss-density').textContent = s.density;
    this.$('#ss-delay').textContent = s.delay;
    const t = this.engine.clock.simTime;
    this.$('#ss-time').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    this._updateConditions();
    // professional drive HUD (speed, limit, lane/signal/road/weather, warnings)
    if (this.driveMode) this.driveHud.update();
  }

  /**
   * Driving debrief modal shown after exiting a vehicle (brief §15). Reuses the
   * results modal shell; injects the DrivingMonitor summary + a score.
   */
  showDriveResults(s) {
    const grid = this.$('#rs-grid');
    const scoreColor = s.score >= 80 ? 'var(--green)' : s.score >= 55 ? 'var(--amber)' : 'var(--red)';
    const fmtTime = sec => `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
    const totalCollisions = s.collisions;
    grid.innerHTML = `
      <div class="result-stat" style="grid-column:1/-1;text-align:center">
        <div class="k">Driving Score</div>
        <div class="v" style="font-size:34px;color:${scoreColor}">${s.score}<small style="font-size:13px;color:var(--text-dim)"> / 100</small></div>
      </div>
      <div class="result-stat"><div class="k">Distance</div><div class="v">${s.distanceKm} km</div></div>
      <div class="result-stat"><div class="k">Drive Time</div><div class="v">${fmtTime(s.driveTime)}</div></div>
      <div class="result-stat"><div class="k">Avg Speed</div><div class="v">${s.avgSpeed} km/h</div></div>
      <div class="result-stat"><div class="k">Max Speed</div><div class="v">${s.maxSpeed} km/h</div></div>
      <div class="result-stat"><div class="k">Collisions</div><div class="v" style="color:${totalCollisions ? 'var(--red)' : 'var(--green)'}">${totalCollisions}</div></div>
      <div class="result-stat"><div class="k">Near Misses</div><div class="v">${s.nearMisses}</div></div>
      <div class="result-stat"><div class="k">Off-Road Events</div><div class="v">${s.offRoadEvents}</div></div>
      <div class="result-stat"><div class="k">Wrong Lane</div><div class="v">${s.wrongLaneEvents}</div></div>
      <div class="result-stat"><div class="k">Wrong Way</div><div class="v">${s.wrongWayEvents}</div></div>
      <div class="result-stat"><div class="k">Red-Light Runs</div><div class="v">${s.redLightViolations}</div></div>
      <div class="result-stat"><div class="k">Lane Departures</div><div class="v">${s.laneDepartureEvents}</div></div>
      <div class="result-stat"><div class="k">Hard Braking</div><div class="v">${s.hardBrakes}</div></div>
      <div class="result-stat"><div class="k">Rapid Accel</div><div class="v">${s.suddenAccels}</div></div>
      <div class="result-stat"><div class="k">Lane Changes</div><div class="v">${s.laneChanges}</div></div>
      <div class="result-stat"><div class="k">Intersections</div><div class="v">${s.intersectionsEntered}</div></div>
      <div class="result-stat" style="grid-column:1/-1"><div class="k">Collision Breakdown</div><div class="v" style="font-size:13px">vehicle ${s.collisionsVehicle} · object ${s.collisionsObject} · violations/km ${s.violationsPerKm}</div></div>`;
    this.$('#results-modal .results-card h3').textContent = 'DRIVING SUMMARY';
    this.$('#results-modal').classList.add('open');
  }
}
