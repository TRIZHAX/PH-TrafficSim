import { icon, WEATHER_ICON } from './icons.js';

/**
 * DriveHUD — the professional, emoji-free driving overlay (brief §13, §14).
 * It renders live driving telemetry (speed, speed limit, lane/road/signal
 * status, weather, sim time) using the stroke vector-icon set and a tiered,
 * non-blocking, auto-dismissing warning stack fed by the DrivingMonitor.
 *
 * It is a pure VIEW: it only READS engine.driving state (hud(), warnings()) and
 * never mutates the simulation. It owns its own DOM under #viewport and is
 * shown/hidden by the UI when a drive session starts/ends.
 *
 * Warning tiers map to signal-lamp colours: low=cyan, medium=amber,
 * high=orange, critical=red — matching the control-room aesthetic.
 */
export class DriveHUD {
  constructor(ui) {
    this.ui = ui;
    this.engine = ui.engine;
    this.visible = false;
    this._warnSig = '';
    this._build();
    this._bind();
  }

  /* ---- DOM ---- */
  _build() {
    const vp = document.getElementById('viewport');

    // tiered warning stack (top-centre, below the top bar)
    this.warnEl = document.createElement('div');
    this.warnEl.id = 'drive-warnings';
    vp.appendChild(this.warnEl);

    // main telemetry cluster (bottom-centre)
    this.hudEl = document.createElement('div');
    this.hudEl.id = 'drive-hud-pro';
    this.hudEl.innerHTML = this._shell();
    vp.appendChild(this.hudEl);

    // cache nodes
    this.$ = sel => this.hudEl.querySelector(sel);
    this.nodes = {
      speed: this.$('#dh-speed'),
      limit: this.$('#dh-limit'),
      limitWrap: this.$('#dh-limit-wrap'),
      lane: this.$('#dh-lane'),
      signal: this.$('#dh-signal'),
      road: this.$('#dh-road'),
      weather: this.$('#dh-weather'),
      time: this.$('#dh-time'),
      speedWrap: this.$('#dh-speed-wrap')
    };
  }

  _shell() {
    return `
      <div class="dh-cluster">
        <div class="dh-speed-block" id="dh-speed-wrap">
          <div class="dh-speed-val" id="dh-speed">0</div>
          <div class="dh-speed-unit">KM/H</div>
        </div>
        <div class="dh-limit" id="dh-limit-wrap" title="Speed limit">
          <div class="dh-limit-ring"><span id="dh-limit">—</span></div>
          <div class="dh-limit-cap">LIMIT</div>
        </div>
      </div>

      <div class="dh-status">
        <div class="dh-chip" id="dh-lane">
          ${icon('lane', { size: 18 })}<span class="dh-chip-txt">On lane</span>
        </div>
        <div class="dh-chip" id="dh-signal">
          ${icon('signal', { size: 18 })}<span class="dh-chip-txt">—</span>
        </div>
        <div class="dh-chip" id="dh-road">
          ${icon('road', { size: 18 })}<span class="dh-chip-txt">Road</span>
        </div>
        <div class="dh-chip" id="dh-weather">
          ${icon('sun', { size: 18 })}<span class="dh-chip-txt">Clear</span>
        </div>
        <div class="dh-chip dh-chip-mono" id="dh-time">
          ${icon('clock', { size: 18 })}<span class="dh-chip-txt">00:00</span>
        </div>
      </div>

      <button class="dh-exit" id="dh-exit">
        ${icon('steering', { size: 16 })}<span>EXIT VEHICLE</span>
      </button>`;
  }

  _bind() {
    this.hudEl.addEventListener('click', e => {
      if (e.target.closest('#dh-exit')) this.ui.exitDrive();
    });
  }

  /* ---- lifecycle ---- */
  show() {
    this.visible = true;
    this.hudEl.classList.add('active');
    this.warnEl.classList.add('active');
    this.update();
  }

  hide() {
    this.visible = false;
    this.hudEl.classList.remove('active');
    this.warnEl.classList.remove('active');
    this.warnEl.innerHTML = '';
    this._warnSig = '';
  }

  /* ---- per-tick refresh (called from UI.updateHUD) ---- */
  update() {
    if (!this.visible) return;
    const mon = this.engine.driving;
    if (!mon) return;
    const h = mon.hud();
    const n = this.nodes;

    // speed + over-speed emphasis
    n.speed.textContent = h.speed;
    n.speedWrap.classList.toggle('over', h.overSpeed);

    // speed limit ring
    if (h.speedLimit > 0) {
      n.limit.textContent = h.speedLimit;
      n.limitWrap.style.visibility = 'visible';
      n.limitWrap.classList.toggle('over', h.overSpeed);
    } else {
      n.limit.textContent = '—';
      n.limitWrap.classList.remove('over');
    }

    // lane / direction status chip
    this._chip(n.lane, h.laneStatus,
      h.wrongWay ? 'wrongway' : (h.offRoad || h.restricted) ? 'offroad'
        : (h.wrongLane || h.laneDeparture) ? 'lane' : 'lane',
      h.wrongWay ? 'crit' : h.offRoad || h.restricted || h.wrongLane ? 'warn'
        : h.laneDeparture ? 'caut' : 'ok');

    // nearest signal state chip
    const sig = this._nearestSignal();
    this._chip(n.signal, sig.label, 'signal', sig.tone);

    // road surface chip
    const surfLabel = { road: 'On road', grass: 'Grass', building: 'Obstacle', shoulder: 'Shoulder', restricted: 'Restricted' }[h.surface] || 'Road';
    this._chip(n.road, surfLabel, 'road', h.surface === 'road' ? 'ok' : 'warn');

    // weather chip
    const w = this.engine.weather.get();
    const wname = WEATHER_ICON[this.engine.weather.current] || 'sun';
    n.weather.querySelector('svg')?.remove();
    n.weather.insertAdjacentHTML('afterbegin', icon(wname, { size: 18 }));
    n.weather.querySelector('.dh-chip-txt').textContent = w.label;

    // sim time
    const t = this.engine.clock.simTime;
    n.time.querySelector('.dh-chip-txt').textContent =
      `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

    // warnings
    this._renderWarnings(mon.warnings());
  }

  /** Update a status chip's label, leading icon and tone class. */
  _chip(el, text, iconName, tone) {
    el.className = `dh-chip dh-${tone}`;
    const svg = el.querySelector('svg');
    if (svg && el.dataset.icon !== iconName) {
      svg.remove();
      el.insertAdjacentHTML('afterbegin', icon(iconName, { size: 18 }));
      el.dataset.icon = iconName;
    }
    const txt = el.querySelector('.dh-chip-txt');
    if (txt.textContent !== text) txt.textContent = text;
  }

  /** Live phase of the signal nearest to the player, for the HUD chip. */
  _nearestSignal() {
    const mon = this.engine.driving;
    const st = mon.state;
    const lane = st.lane;
    if (lane && lane.signal && st.nearIntersection) {
      const s = this.engine.lights.stateFor(lane.signal.node, lane.signal.phase);
      const map = {
        green: { label: 'Green — go', tone: 'ok' },
        yellow: { label: 'Amber — slow', tone: 'caut' },
        red: { label: 'Red — stop', tone: 'crit' },
        flash: { label: 'Flashing — yield', tone: 'warn' }
      };
      return map[s] || { label: 'Signal', tone: 'ok' };
    }
    return { label: st.nearIntersection ? 'Intersection' : 'No signal', tone: st.nearIntersection ? 'caut' : 'idle' };
  }

  /**
   * Render the tiered warning stack. Each warning is a banner coloured by
   * severity with a vector icon + code + description. Sustained violations
   * persist while active; one-shot flashes auto-dismiss (handled by the
   * monitor's TTL, so we simply re-render the current set). A signature guard
   * avoids rebuilding identical DOM every tick (brief §14 non-blocking HUD).
   */
  _renderWarnings(list) {
    const sig = list.map(w => `${w.key}:${w.severity}`).join('|');
    if (sig === this._warnSig) return;
    this._warnSig = sig;
    if (!list.length) { this.warnEl.innerHTML = ''; return; }
    this.warnEl.innerHTML = list.slice(0, 4).map(w => `
      <div class="dh-warn dh-warn-${w.severity}${w.sustained ? '' : ' dh-warn-flash'}">
        <span class="dh-warn-ico">${icon(w.icon || 'warning', { size: 22 })}</span>
        <span class="dh-warn-body">
          <span class="dh-warn-code">${w.code}</span>
          <span class="dh-warn-detail">${w.detail || ''}</span>
        </span>
      </div>`).join('');
  }

  dispose() {
    this.warnEl?.remove();
    this.hudEl?.remove();
  }
}
