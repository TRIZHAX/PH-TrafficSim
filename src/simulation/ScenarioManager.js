import { SCENARIOS, DEFAULT_MIX } from '../core/Config.js';
import { bus } from '../core/EventBus.js';

/**
 * ScenarioManager — applies preset or custom experiment configurations to the
 * engine: traffic volume, fleet mix, weather, road condition, signal timing,
 * speed-limit scaling, and optional incidents. Also records the active config
 * so analytics/CSV exports are labelled with their conditions.
 */
export class ScenarioManager {
  constructor(engine) {
    this.engine = engine;
    this.activeId = 'normalDay';
    this.custom = null;
    this.speedLimitScale = 1;
    this._baseLimits = null;
  }

  list() { return Object.entries(SCENARIOS).map(([id, s]) => ({ id, ...s })); }

  get active() {
    if (this.activeId === 'custom') return { id: 'custom', label: 'Custom', icon: '🧪', ...this.custom };
    return { id: this.activeId, ...SCENARIOS[this.activeId] };
  }

  /** Apply a preset scenario and (re)start the simulation. */
  apply(id, restart = true) {
    const s = SCENARIOS[id];
    if (!s) return;
    this.activeId = id;
    this._configure({
      vehicles: s.vehicles, mix: s.mix || DEFAULT_MIX,
      weather: s.weather, roadCondition: s.roadCondition,
      green: s.green, incident: s.incident || null, speedLimitScale: 1
    }, restart);
  }

  /** Apply a fully custom configuration (Traffic Lab / Custom scenario). */
  applyCustom(cfg, restart = true) {
    this.activeId = 'custom';
    this.custom = { ...cfg };
    this._configure(cfg, restart);
  }

  _configure(cfg, restart) {
    const e = this.engine;
    e.incidents.clearAll();
    e.traffic.setTarget(cfg.vehicles ?? 90);
    e.traffic.setMix(cfg.mix || DEFAULT_MIX);
    e.traffic.setSeed(cfg.seed ?? 1337);
    e.weather.set(cfg.weather || 'clear');
    e.roadCond.set(cfg.roadCondition || 'good');
    if (cfg.roadQuality != null) e.roadCond.setQuality(cfg.roadQuality);
    e.lights.setTiming({ green: cfg.green ?? 25, yellow: cfg.yellow ?? 4, red: cfg.red ?? cfg.green ?? 25 });
    this._applySpeedScale(cfg.speedLimitScale ?? 1);
    if (cfg.incident) e.incidents.create(cfg.incident);
    if (restart) e.start(true);
    bus.emit('scenario:applied', this.active);
  }

  _applySpeedScale(scale) {
    const net = this.engine.network;
    if (!this._baseLimits || this._baseLimits.net !== net) {
      this._baseLimits = { net, map: new Map(net.lanes.map(l => [l.id, l.speedLimit])) };
    }
    for (const lane of net.lanes) lane.speedLimit = (this._baseLimits.map.get(lane.id) || lane.speedLimit) * scale;
    this.speedLimitScale = scale;
  }

  /** Snapshot of active conditions for labelling data exports. */
  conditions() {
    const e = this.engine;
    return {
      scenario: this.active.label,
      weather: e.weather.current,
      roadCondition: e.roadCond.condition,
      roadQuality: e.roadCond.quality,
      signalGreen: e.lights.getTiming().green,
      vehiclesTarget: e.traffic.targetCount,
      incidents: e.incidents.incidents.map(i => i.spec.label).join('+') || 'none',
      map: e.maps.current.name
    };
  }
}
