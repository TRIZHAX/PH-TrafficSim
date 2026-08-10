import { WEATHER, ROAD_CONDITIONS, INCIDENT_TYPES, VEHICLE_TYPES, SCENARIOS, DEFAULT_MIX, DEFAULT_SETTINGS, SETTINGS_KEY } from '../core/Config.js';
import { ExperimentManager } from '../analytics/ExperimentManager.js';
import { drawLineChart } from './Charts.js';

const CHART_DEFS = [
  { key: 'vehicles', label: 'Vehicle Count', color: '#5ec8f2' },
  { key: 'avgSpeed', label: 'Average Speed (km/h)', color: '#38e07d' },
  { key: 'density', label: 'Traffic Density (%)', color: '#ff8a3d', max: 100, min: 0 },
  { key: 'flow', label: 'Traffic Flow (veh/hr)', color: '#b28dff' },
  { key: 'delay', label: 'Average Delay (s)', color: '#ff4d4d' },
  { key: 'queue', label: 'Queue Length (veh)', color: '#ffc14d' },
  { key: 'capacity', label: 'Road Capacity (%)', color: '#7ee8a2', min: 0, max: 100 },
  { key: 'utilization', label: 'Road Utilization (%)', color: '#f2a3c2', min: 0, max: 100 }
];

/**
 * Pages — full-screen sections: MAPS, TRAFFIC LAB, ANALYTICS, SETTINGS.
 * Rendered into the #page overlay; the simulation keeps running behind it.
 */
export class Pages {
  constructor(ui) {
    this.ui = ui;
    this.engine = ui.engine;
    this.current = null;
    this.lab = new ExperimentManager(this.engine.maps.currentId);
    this.analyticsRange = 'live';
    this._chartTimer = null;
    document.getElementById('page').addEventListener('click', e => {
      if (e.target.id === 'page') this.close();
    });
  }

  open(name) {
    this.current = name;
    const inner = document.getElementById('page-inner');
    inner.innerHTML = '';
    if (name === 'maps') this._renderMaps(inner);
    else if (name === 'lab') this._renderLab(inner);
    else if (name === 'analytics') this._renderAnalytics(inner);
    else if (name === 'settings') this._renderSettings(inner);
    document.getElementById('page').classList.add('open');
  }

  close() {
    document.getElementById('page').classList.remove('open');
    this.current = null;
    clearInterval(this._chartTimer);
    document.querySelectorAll('[data-nav]').forEach(x => x.classList.toggle('active', x.dataset.nav === 'simulate'));
  }

  _head(inner, title, sub) {
    const h = this.ui.el('div', 'page-head', `
      <h2>${title}<small>${sub}</small></h2>
      <button class="page-close">✕</button>`);
    h.querySelector('.page-close').addEventListener('click', () => this.close());
    inner.appendChild(h);
  }

  /* ================= MAPS ================= */
  _renderMaps(inner) {
    this._head(inner, 'MAPS', '🇵🇭 Philippine Locations');
    const e = this.engine;
    const grid = this.ui.el('div', 'map-grid');
    for (const m of e.maps.list()) {
      const card = this.ui.el('button', `map-card ${m.id === e.maps.currentId ? 'active' : ''}`, `
        ${m.id === 'san-miguel-bulacan' ? '<span class="tag tag-default">Default</span>' : ''}
        <span class="flag">🇵🇭</span>
        <h4>${m.name}</h4>
        <p>${m.region}</p>
        <p style="margin-top:4px;opacity:.8">${m.description}</p>`);
      card.addEventListener('click', () => {
        e.loadMap(m.id);
        e.scenarios.apply(e.scenarios.activeId === 'custom' ? 'normalDay' : e.scenarios.activeId, true);
        this.ui.app.renderer2d.invalidate();
        this.ui.app.renderer2d.fitMap();
        this.ui.app.renderer3d?.rebuild?.();
        this.lab = new ExperimentManager(m.id);
        this.close();
        this.ui.toast(`Map loaded: ${m.name}`);
      });
      grid.appendChild(card);
    }
    for (const name of e.maps.comingSoon) {
      grid.appendChild(this.ui.el('div', 'map-card locked', `
        <span class="tag tag-soon">Planned</span>
        <span class="flag">🇵🇭</span><h4>${name}</h4>
        <p>Add via src/maps/data/ — see README §Adding Maps</p>`));
    }
    inner.appendChild(grid);

    // Scenario presets
    const card = this.ui.el('div', 'card glass', `<h3>Simulation Scenarios</h3>`);
    const sg = this.ui.el('div', 'scenario-grid');
    for (const [id, s] of Object.entries(SCENARIOS)) {
      const b = this.ui.el('button', `scenario-card ${this.engine.scenarios.activeId === id ? 'active' : ''}`, `
        <div class="ico">${s.icon}</div><h4>${s.label}</h4>
        <p>${s.vehicles} veh · ${WEATHER[s.weather].label} · G${s.green}s</p>`);
      b.addEventListener('click', () => {
        this.engine.scenarios.apply(id, true);
        this.ui.app.renderer2d.invalidate();
        sg.querySelectorAll('.scenario-card').forEach(x => x.classList.toggle('active', x === b));
        this.ui.toast(`Scenario: ${s.label}`);
      });
      sg.appendChild(b);
    }
    // custom scenario tile → opens Traffic Lab
    const cust = this.ui.el('button', 'scenario-card', `<div class="ico">🧪</div><h4>Custom</h4><p>Configure in Traffic Lab</p>`);
    cust.addEventListener('click', () => this.open('lab'));
    sg.appendChild(cust);
    card.appendChild(sg);
    inner.appendChild(card);
  }
  /* ================= TRAFFIC LAB ================= */
  _renderLab(inner) {
    this._head(inner, 'TRAFFIC LAB', 'Controlled Experiments & Scenario Comparison');
    const e = this.engine;

    const form = this.ui.el('div', 'card glass', `
      <h3>Experiment Configuration</h3>
      <div class="ctl-group" style="gap:12px">
        <div class="ctl-label">Run Label <span class="val" id="lab-label-val"></span></div>
        <input type="text" id="lab-label" placeholder="Scenario ${String.fromCharCode(65 + this.lab.results.length)}" style="background:var(--panel-solid);border:1px solid var(--glass-border);border-radius:9px;padding:9px 12px;color:var(--text);font-size:13px;outline:none">
        <div class="ctl-label">Vehicle Count <span class="val" id="lab-veh-val">150</span></div>
        <input type="range" id="lab-veh" min="20" max="350" step="10" value="150">
        <div class="ctl-label">Weather</div>
        <div class="chip-row" id="lab-weather">${Object.entries(WEATHER).map(([id, w], i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-v="${id}">${w.icon} ${w.label}</button>`).join('')}</div>
        <div class="ctl-label">Road Condition</div>
        <div class="chip-row" id="lab-road">${Object.entries(ROAD_CONDITIONS).map(([id, r], i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-v="${id}">${r.icon} ${r.label}</button>`).join('')}</div>
        <div class="ctl-label">Green Time <span class="val" id="lab-green-val">30s</span></div>
        <input type="range" id="lab-green" min="10" max="60" value="30">
        <div class="ctl-label">Incident</div>
        <div class="chip-row" id="lab-inc">
          <button class="chip active" data-v="">None</button>
          ${Object.entries(INCIDENT_TYPES).filter(([id]) => id !== 'signalFail').map(([id, t]) => `<button class="chip danger" data-v="${id}">${t.icon} ${t.label}</button>`).join('')}
        </div>
        <div class="ctl-label">Simulated Duration <span class="val" id="lab-dur-val">5 min</span></div>
        <input type="range" id="lab-dur" min="2" max="15" value="5">
        <div class="progress-line" id="lab-progress" style="display:none"><i style="width:0%"></i></div>
        <div class="btn-row">
          <button class="btn btn-primary" id="lab-run">▶ RUN SCENARIO</button>
          <button class="btn btn-ghost" id="lab-apply-live">APPLY TO LIVE SIM</button>
        </div>
        <p style="font-size:10.5px;color:var(--text-dim);line-height:1.5">Experiments run headless on a separate engine instance with a fixed random seed — change one variable at a time for a controlled comparison. The live simulation is not affected.</p>
      </div>`);
    inner.appendChild(form);

    const pickChip = (containerId) => {
      const c = form.querySelector(containerId);
      c.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
        c.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === b));
      }));
    };
    pickChip('#lab-weather'); pickChip('#lab-road'); pickChip('#lab-inc');
    form.querySelector('#lab-veh').addEventListener('input', ev => form.querySelector('#lab-veh-val').textContent = ev.target.value);
    form.querySelector('#lab-green').addEventListener('input', ev => form.querySelector('#lab-green-val').textContent = `${ev.target.value}s`);
    form.querySelector('#lab-dur').addEventListener('input', ev => form.querySelector('#lab-dur-val').textContent = `${ev.target.value} min`);

    const readCfg = () => ({
      label: form.querySelector('#lab-label').value.trim() || `Scenario ${String.fromCharCode(65 + this.lab.results.length)}`,
      vehicles: +form.querySelector('#lab-veh').value,
      weather: form.querySelector('#lab-weather .chip.active').dataset.v,
      roadCondition: form.querySelector('#lab-road .chip.active').dataset.v,
      green: +form.querySelector('#lab-green').value,
      incident: form.querySelector('#lab-inc .chip.active').dataset.v || null,
      duration: +form.querySelector('#lab-dur').value * 60,
      mix: DEFAULT_MIX
    });

    form.querySelector('#lab-run').addEventListener('click', async () => {
      const btn = form.querySelector('#lab-run');
      const prog = form.querySelector('#lab-progress');
      btn.disabled = true; btn.textContent = 'RUNNING…'; prog.style.display = 'block';
      try {
        await this.lab.run(readCfg(), p => { prog.firstElementChild.style.width = `${Math.round(p * 100)}%`; });
        this.ui.toast('Experiment complete');
        this._renderResults();
      } finally {
        btn.disabled = false; btn.textContent = '▶ RUN SCENARIO'; prog.style.display = 'none';
        form.querySelector('#lab-label').value = '';
        form.querySelector('#lab-label').placeholder = `Scenario ${String.fromCharCode(65 + this.lab.results.length)}`;
      }
    });

    form.querySelector('#lab-apply-live').addEventListener('click', () => {
      const cfg = readCfg();
      e.scenarios.applyCustom({ ...cfg, seed: 1337 }, true);
      this.ui.app.renderer2d.invalidate();
      this.close();
      this.ui.toast(`Custom scenario applied: ${cfg.vehicles} veh, ${WEATHER[cfg.weather].label}`);
    });

    this.resultsHost = this.ui.el('div');
    inner.appendChild(this.resultsHost);
    this._renderResults();
  }

  _renderResults() {
    const host = this.resultsHost;
    if (!host) return;
    host.innerHTML = '';
    const rs = this.lab.results;
    if (!rs.length) {
      host.appendChild(this.ui.el('div', 'card glass', `<h3>Results</h3><p style="font-size:12px;color:var(--text-dim)">No experiments yet. Configure conditions and press RUN SCENARIO. Run at least two to compare.</p>`));
      return;
    }
    const card = this.ui.el('div', 'card glass', `<h3>Results (${rs.length})</h3>`);
    const grid = this.ui.el('div', 'lab-grid');
    rs.forEach((r, i) => {
      const el = this.ui.el('div', 'lab-result', `
        <h4>${r.label} <span class="del" data-i="${i}" title="Remove">✕</span></h4>
        <div class="lab-metrics">
          <span class="k">Avg Speed</span><span class="v">${r.avgSpeed} km/h</span>
          <span class="k">Density</span><span class="v">${r.density}%</span>
          <span class="k">Flow</span><span class="v">${r.flow} veh/hr</span>
          <span class="k">Avg Delay</span><span class="v">${r.delay} s</span>
          <span class="k">Avg Queue</span><span class="v">${r.queue} veh</span>
          <span class="k">Max Queue</span><span class="v">${r.maxQueue} veh</span>
          <span class="k">Capacity</span><span class="v">${r.capacity}%</span>
          <span class="k">Status</span><span class="v" style="color:${r.congestion.color}">${r.congestion.label}</span>
        </div>
        <div class="lab-config">${r.config.vehicles} veh · ${WEATHER[r.config.weather].label} · ${ROAD_CONDITIONS[r.config.roadCondition].label} road · G${r.config.green}s${r.config.incident ? ` · ${INCIDENT_TYPES[r.config.incident].label}` : ''} · ${Math.round(r.duration / 60)} min · ${r.map}</div>
        <div class="btn-row" style="margin-top:9px"><button class="btn btn-ghost" style="font-size:10px;padding:7px" data-csv="${i}">EXPORT CSV</button></div>`);
      el.querySelector('.del').addEventListener('click', () => { rs.splice(i, 1); this._renderResults(); });
      el.querySelector('[data-csv]').addEventListener('click', () => {
        const blob = new Blob([r.csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ph-trafficsim_${r.label.replace(/\s+/g, '-')}.csv`;
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
      grid.appendChild(el);
    });
    card.appendChild(grid);
    host.appendChild(card);

    // Comparison table (baseline = first result)
    if (rs.length >= 2) {
      const base = rs[0];
      const cmp = this.ui.el('div', 'card glass', `<h3>Comparison vs "${base.label}"</h3>`);
      const rows = rs.slice(1).map(r => {
        const d = ExperimentManager.compare(base, r);
        const cell = (v, invert = false) => {
          const good = invert ? v < 0 : v > 0;
          const cls = Math.abs(v) < 1 ? '' : good ? 'delta-good' : 'delta-bad';
          return `<td class="${cls}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</td>`;
        };
        return `<tr><td>${r.label}</td>${cell(d.avgSpeed)}${cell(d.flow)}${cell(d.density, true)}${cell(d.delay, true)}${cell(d.queue, true)}</tr>`;
      }).join('');
      cmp.insertAdjacentHTML('beforeend', `
        <table class="compare-table">
          <thead><tr><th>Run</th><th>Δ Speed</th><th>Δ Flow</th><th>Δ Density</th><th>Δ Delay</th><th>Δ Queue</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:10px;color:var(--text-faint);margin-top:8px">Green = improvement, red = degradation relative to the baseline run.</p>`);
      host.appendChild(cmp);
    }
  }
  /* ================= ANALYTICS ================= */
  _renderAnalytics(inner) {
    this._head(inner, 'ANALYTICS', 'Live Time-Series of Simulation Metrics');
    const ranges = [['live', 'Live (60s)'], ['5m', 'Last 5 Min'], ['10m', 'Last 10 Min'], ['all', 'Entire Simulation']];
    const pills = this.ui.el('div', 'range-pills',
      ranges.map(([id, l]) => `<button class="chip ${this.analyticsRange === id ? 'active' : ''}" data-r="${id}">${l}</button>`).join(''));
    pills.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      this.analyticsRange = b.dataset.r;
      pills.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === b));
      this._updateCharts();
    }));
    inner.appendChild(pills);

    const grid = this.ui.el('div', 'chart-grid');
    for (const def of CHART_DEFS) {
      const card = this.ui.el('div', 'chart-card glass', `
        <h4>${def.label} <span class="now" id="ch-now-${def.key}">—</span></h4>
        <canvas id="ch-${def.key}"></canvas>`);
      grid.appendChild(card);
    }
    inner.appendChild(grid);

    const foot = this.ui.el('div', 'card glass', `
      <h3>Data Export</h3>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">
        <span id="an-rows">0</span> samples recorded (1 per simulated second) · scenario: <b id="an-scn"></b> · map: <b id="an-map"></b></p>
      <div class="btn-row">
        <button class="btn btn-primary" id="an-export">⬇ EXPORT CSV</button>
        <button class="btn btn-ghost" id="an-snapshot">📋 SNAPSHOT</button>
      </div>`);
    foot.querySelector('#an-export').addEventListener('click', () => { this.engine.recorder.download(); this.ui.toast('CSV exported'); });
    foot.querySelector('#an-snapshot').addEventListener('click', () => { this.close(); this.ui.showResults(); });
    inner.appendChild(foot);

    this._updateCharts();
    clearInterval(this._chartTimer);
    this._chartTimer = setInterval(() => { if (this.current === 'analytics') this._updateCharts(); }, 1000);
  }

  _updateCharts() {
    const hist = this.engine.stats.history;
    const n = { live: 60, '5m': 300, '10m': 600, all: Infinity }[this.analyticsRange];
    const slice = n === Infinity ? hist : hist.slice(-n);
    // downsample for long ranges
    const maxPts = 240;
    const stride = Math.max(1, Math.floor(slice.length / maxPts));
    const data = stride > 1 ? slice.filter((_, i) => i % stride === 0) : slice;
    for (const def of CHART_DEFS) {
      const cv = document.getElementById(`ch-${def.key}`);
      if (!cv) return;
      const series = data.map(r => r[def.key] ?? 0);
      drawLineChart(cv, series, { color: def.color, min: def.min ?? null, max: def.max ?? null });
      const now = document.getElementById(`ch-now-${def.key}`);
      if (now && series.length) now.textContent = series[series.length - 1];
    }
    const cond = this.engine.scenarios.conditions();
    const rowsEl = document.getElementById('an-rows');
    if (rowsEl) {
      rowsEl.textContent = this.engine.recorder.rows.length;
      document.getElementById('an-scn').textContent = cond.scenario;
      document.getElementById('an-map').textContent = cond.map;
    }
  }

  /* ================= SETTINGS ================= */
  _renderSettings(inner) {
    this._head(inner, 'SETTINGS', 'Preferences are saved locally');
    const S = this.ui.app.settingsObj;
    const save = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(S));

    const card = this.ui.el('div', 'card glass', `<h3>General</h3>`);
    const row = (label, sub, control) => {
      const r = this.ui.el('div', 'settings-row', `<div class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</div>`);
      r.appendChild(control);
      return r;
    };
    const select = (opts, value, onchange) => {
      const s = document.createElement('select');
      s.innerHTML = opts.map(o => `<option value="${o[0]}" ${o[0] === value ? 'selected' : ''}>${o[1]}</option>`).join('');
      s.addEventListener('change', () => { onchange(s.value); save(); });
      return s;
    };
    const toggle = (value, onchange) => {
      const t = this.ui.el('button', `toggle ${value ? 'on' : ''}`);
      t.addEventListener('click', () => { t.classList.toggle('on'); onchange(t.classList.contains('on')); save(); });
      return t;
    };
    const slider = (min, max, step, value, onchange) => {
      const i = document.createElement('input');
      i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = value;
      i.style.width = '140px';
      i.addEventListener('input', () => { onchange(+i.value); save(); });
      return i;
    };

    card.appendChild(row('Graphics Quality', '3D detail & effects', select(
      [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']],
      S.quality, v => { S.quality = v; this.ui.app.renderer3d?.setQuality?.(v); })));
    card.appendChild(row('Camera Sensitivity', null, slider(0.3, 2.5, 0.1, S.cameraSensitivity, v => S.cameraSensitivity = v)));
    card.appendChild(row('Weather Effects', 'Rain / fog visuals', toggle(S.weatherFx, v => S.weatherFx = v)));
    card.appendChild(row('Sound', 'Ambient traffic hum', toggle(S.sound, v => { S.sound = v; this.ui.app.setSound?.(v); })));
    card.appendChild(row('Show Statistics', 'Dashboard & sensors', toggle(S.showStats, v => {
      S.showStats = v;
      document.getElementById('dash').style.display = v ? '' : 'none';
      document.getElementById('status-strip').style.display = v ? '' : 'none';
    })));
    card.appendChild(row('Show Traffic Labels', 'Road & landmark names', toggle(S.showLabels, v => { S.showLabels = v; this.ui.app.renderer2d.invalidate(); })));
    card.appendChild(row('Show Road Conditions', 'Conditions panel', toggle(S.showConditions, v => {
      S.showConditions = v;
      document.getElementById('conditions').style.display = v ? '' : 'none';
    })));
    inner.appendChild(card);

    // Key bindings
    const keys = this.ui.el('div', 'card glass', `<h3>Driving Controls</h3>`);
    const keyLabels = { accel: 'Accelerate', brake: 'Brake / Reverse', left: 'Steer Left', right: 'Steer Right', handbrake: 'Handbrake', camera: 'Change Camera', pause: 'Pause' };
    for (const [action, label] of Object.entries(keyLabels)) {
      const kb = this.ui.el('button', 'keybind', S.keys[action].replace('Key', '').replace('Arrow', '').replace('Space', 'SPACE'));
      kb.addEventListener('click', () => {
        kb.classList.add('listening'); kb.textContent = 'press key…';
        const onKey = ev => {
          ev.preventDefault();
          S.keys[action] = ev.code; save();
          kb.classList.remove('listening');
          kb.textContent = ev.code.replace('Key', '').replace('Arrow', '').replace('Space', 'SPACE');
          window.removeEventListener('keydown', onKey, true);
        };
        window.addEventListener('keydown', onKey, true);
      });
      keys.appendChild(row(label, null, kb));
    }
    inner.appendChild(keys);

    // About
    const about = this.ui.el('div', 'card glass about-block', `
      <div class="load-signal" style="justify-content:center;display:flex;margin-bottom:10px">
        <span class="ls-lamp ls-red"></span><span class="ls-lamp ls-amber"></span><span class="ls-lamp ls-green"></span>
      </div>
      <div class="t">PH TRAFFICSIM</div>
      <p>Philippine Traffic Flow Simulation &amp; Analysis</p>
      <p>A Computational Science project — mathematical traffic modeling,<br>numerical simulation, data collection and controlled experimentation.</p>
      <p class="credit-line">Designed &amp; Created by TRIZHAX</p>
      <p style="margin-top:4px;font-family:var(--font-mono);font-size:10px">Version 1.0.0</p>`);
    inner.appendChild(about);
  }
}
