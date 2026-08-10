import { SIM } from '../core/Config.js';

/**
 * DataRecorder — time-series recording of every study variable + CSV export.
 * One row per SIM.recordInterval seconds of simulated time.
 */
export class DataRecorder {
  constructor(engine) {
    this.engine = engine;
    this.reset();
  }

  reset() {
    this.rows = [];
    this._t = 0;
  }

  step(dt) {
    this._t += dt;
    if (this._t < SIM.recordInterval) return;
    this._t = 0;
    const e = this.engine;
    const s = e.stats.snapshot;
    const cond = e.scenarios ? e.scenarios.conditions() : {};
    const lightState = e.lights.snapshot()[0];
    this.rows.push({
      timestamp: +e.clock.simTime.toFixed(1),
      vehicle_count: s.vehicles,
      average_speed: s.avgSpeed,
      traffic_density: s.density,
      flow_rate: s.flow,
      average_delay: s.delay,
      queue_length: s.queue,
      road_capacity: s.capacity,
      weather: e.weather.current,
      road_condition: e.roadCond.condition,
      traffic_light_state: lightState ? `P0:${lightState.phase0}|P1:${lightState.phase1}` : 'none',
      congestion: s.congestion.id,
      scenario: cond.scenario || '',
      map: cond.map || ''
    });
    // keep memory bounded on very long runs
    if (this.rows.length > 14400) this.rows.splice(0, this.rows.length - 14400);
    // mirror into stats history for charts
    e.stats.history.push({ t: s.time, ...s });
    if (e.stats.history.length > 14400) e.stats.history.splice(0, e.stats.history.length - 14400);
  }

  toCSV() {
    if (!this.rows.length) return 'no data';
    const cols = Object.keys(this.rows[0]);
    const esc = v => typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    return [cols.join(','), ...this.rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
  }

  download(filename = null) {
    const name = filename || `ph-trafficsim_${this.engine.maps.currentId}_${Date.now()}.csv`;
    const blob = new Blob([this.toCSV()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
