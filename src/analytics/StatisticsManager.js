import { SIM, CONGESTION_LEVELS, KMH } from '../core/Config.js';
import { TrafficSensor } from './TrafficSensor.js';

/**
 * StatisticsManager — computes the dependent variables of the study:
 *
 *   density    ρ = N / (Σ lane length × jam density)      [normalized 0–1]
 *   flow       q = vehicles past sensors / time            [veh/hr]
 *   avg speed  v̄ = Σ vᵢ / N                                [km/h]
 *   queue      vehicles with v < 0.5 m/s for > 2 s
 *   delay      mean accumulated (1 − v/v_free)·dt per vehicle [s]
 *   capacity   base lanes × weather × road × incident losses [%]
 *   congestion classified from density, speed ratio and utilization
 */
export class StatisticsManager {
  constructor(engine) {
    this.engine = engine;
    this._t = 0;
    this.sensors = this._placeSensors();
    this.reset();
  }

  _placeSensors() {
    const net = this.engine.network;
    const links = net.mainLinks.length ? net.mainLinks : net.links.slice(0, 4);
    return links.slice(0, 6).map(l => new TrafficSensor(l, l.length * 0.5));
  }

  reset() {
    this._t = 0;
    this.sensors.forEach(s => s.reset());
    this.snapshot = this._emptySnapshot();
    this.maxQueue = 0;
    this.history = []; // [{t, ...metrics}] sampled every recordInterval by DataRecorder
  }

  _emptySnapshot() {
    return {
      time: 0, vehicles: 0, avgSpeed: 0, density: 0, flow: 0,
      delay: 0, queue: 0, capacity: 100, utilization: 0,
      congestion: CONGESTION_LEVELS[0]
    };
  }

  step(dt) {
    this._t += dt;
    for (const s of this.sensors) s.step(dt);
    if (this._t >= 0.5) { this._t = 0; this._compute(); }
  }

  _compute() {
    const e = this.engine;
    const vehicles = e.traffic.vehicles;
    const N = vehicles.length;
    const env = e.traffic.env();

    // Average speed (km/h)
    let vSum = 0, delaySum = 0, queue = 0;
    for (const v of vehicles) {
      vSum += v.v;
      delaySum += v.totalDelay / Math.max(1, v.age) * 60; // delay seconds per minute travelled → scaled
      if (v.waiting > 2) queue++;
    }
    const avgSpeed = N ? (vSum / N) * KMH : 0;

    // Mean accumulated delay per vehicle (s) — direct definition
    const meanDelay = N ? vehicles.reduce((s, v) => s + v.totalDelay, 0) / N : 0;

    // Density: vehicles per available lane-meter, normalized by jam density
    const totalLaneLen = Math.max(1, e.network.totalLaneLength);
    const density = Math.min(1, N / (totalLaneLen * SIM.jamDensity));

    // Flow from sensors (veh/hr, averaged across sensors)
    const flows = this.sensors.map(s => s.flowPerHour());
    const flow = flows.length ? Math.round(flows.reduce((a, b) => a + b, 0) / flows.length) : 0;

    // Road capacity (%): environment × incident lane losses
    const incLoss = e.incidents.incidents.filter(i => i.lane).length * 0.14;
    const capacity = Math.max(20, Math.round(env.capacityFactor * (1 - Math.min(0.5, incLoss)) * 100));

    // Utilization: demand vs available capacity
    const utilization = Math.min(1, density / (capacity / 100));

    this.maxQueue = Math.max(this.maxQueue, queue);

    // Congestion classification — combines density, speed ratio & utilization
    const freeSpeed = e.network.lanes.length
      ? (e.network.links.reduce((s, l) => s + l.lanes[0].speedLimit, 0) / e.network.links.length) * KMH
      : 50;
    const speedRatio = freeSpeed ? avgSpeed / (freeSpeed * env.speedFactor) : 1;
    const score = 0.5 * density + 0.3 * (1 - Math.min(1, speedRatio)) + 0.2 * utilization;
    const congestion = CONGESTION_LEVELS.find(l => score <= l.max) || CONGESTION_LEVELS[3];

    this.snapshot = {
      time: e.clock.simTime,
      vehicles: N,
      avgSpeed: +avgSpeed.toFixed(1),
      density: +(density * 100).toFixed(1),
      flow: Math.round(flows.length ? flows.reduce((a, b) => a + b, 0) / flows.length : 0),
      delay: +meanDelay.toFixed(1),
      queue,
      maxQueue: this.maxQueue,
      capacity,
      utilization: +(utilization * 100).toFixed(1),
      congestion,
      score: +score.toFixed(3)
    };
  }
}
