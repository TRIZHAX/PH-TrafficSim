import { SimulationEngine } from '../core/SimulationEngine.js';
import { DEFAULT_MIX } from '../core/Config.js';

/**
 * ExperimentManager — the Traffic Lab back end.
 * Runs controlled experiments headless on a FRESH engine instance (so the
 * on-screen simulation is untouched), holding all variables constant except
 * those the user changes. Same RNG seed ⇒ same fleet ⇒ fair A/B comparison.
 */
export class ExperimentManager {
  constructor(mapId) {
    this.mapId = mapId;
    this.results = [];
  }

  /**
   * cfg: { label, vehicles, mix?, weather, roadCondition, roadQuality?, green,
   *        yellow?, red?, incident?, speedLimitScale?, duration? , seed? }
   * Returns aggregate metrics over the run (after a warm-up period).
   */
  async run(cfg, onProgress) {
    const engine = new SimulationEngine();
    engine.loadMap(this.mapId);
    engine.scenarios.applyCustom({
      vehicles: cfg.vehicles ?? 150,
      mix: cfg.mix || DEFAULT_MIX,
      weather: cfg.weather || 'clear',
      roadCondition: cfg.roadCondition || 'good',
      roadQuality: cfg.roadQuality,
      green: cfg.green ?? 25,
      yellow: cfg.yellow ?? 4,
      red: cfg.red ?? cfg.green ?? 25,
      incident: cfg.incident || null,
      speedLimitScale: cfg.speedLimitScale ?? 1,
      seed: cfg.seed ?? 1337
    }, true);

    const duration = cfg.duration ?? 300;   // 5 simulated minutes default
    const warmup = Math.min(60, duration * 0.2);

    // Yield to UI between chunks so the page stays responsive
    const totalSteps = duration;
    let done = 0;
    const samples = [];
    while (done < totalSteps) {
      const chunk = Math.min(20, totalSteps - done);
      engine.runHeadless(chunk);
      done += chunk;
      const s = engine.stats.snapshot;
      if (engine.clock.simTime > warmup) samples.push({ ...s });
      onProgress?.(done / totalSteps);
      await new Promise(r => setTimeout(r, 0));
    }

    const avg = key => samples.length ? samples.reduce((a, b) => a + (b[key] ?? 0), 0) / samples.length : 0;
    const result = {
      label: cfg.label || `Run ${this.results.length + 1}`,
      config: { ...cfg, duration },
      map: engine.maps.current.name,
      duration,
      vehiclesSimulated: engine.traffic.spawnedTotal,
      avgSpeed: +avg('avgSpeed').toFixed(1),
      density: +avg('density').toFixed(1),
      flow: Math.round(avg('flow')),
      delay: +avg('delay').toFixed(1),
      queue: +avg('queue').toFixed(1),
      maxQueue: engine.stats.maxQueue,
      capacity: Math.round(avg('capacity')),
      utilization: +avg('utilization').toFixed(1),
      congestion: engine.stats.snapshot.congestion,
      csv: engine.recorder.toCSV()
    };
    this.results.push(result);
    return result;
  }

  /** Pairwise % change between two results for each dependent variable. */
  static compare(a, b) {
    const pct = (x, y) => x === 0 ? (y === 0 ? 0 : 100) : ((y - x) / x) * 100;
    return {
      avgSpeed: pct(a.avgSpeed, b.avgSpeed),
      density: pct(a.density, b.density),
      flow: pct(a.flow, b.flow),
      delay: pct(a.delay, b.delay),
      queue: pct(a.queue, b.queue),
      capacity: pct(a.capacity, b.capacity)
    };
  }

  clear() { this.results = []; }
}
