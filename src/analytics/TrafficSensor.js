import { SIM } from '../core/Config.js';

/**
 * TrafficSensor — a virtual loop detector placed at arc-length `at` on every
 * lane of a link. Counts crossings within a rolling window to estimate flow:
 *   q = vehicles passed / time  →  veh/hour
 */
export class TrafficSensor {
  constructor(link, at) {
    this.link = link;
    this.at = at;
    const p = link.lanes[Math.floor(link.lanes.length / 2)].at(at);
    this.x = p.x; this.y = p.y; this.heading = p.heading;
    this.reset();
  }

  reset() {
    this.crossings = [];   // timestamps of crossings
    this.t = 0;
    this._lastPos = new Map(); // vehicle id -> last s
  }

  step(dt) {
    this.t += dt;
    const seen = new Set();
    for (const lane of this.link.lanes) {
      for (const v of lane.vehicles) {
        seen.add(v.id);
        const prev = this._lastPos.get(v.id);
        if (prev != null && prev < this.at && v.s >= this.at) this.crossings.push(this.t);
        this._lastPos.set(v.id, v.s);
      }
    }
    // prune stale vehicle entries & old crossings outside the window
    if (this._lastPos.size > seen.size + 40) {
      for (const id of this._lastPos.keys()) if (!seen.has(id)) this._lastPos.delete(id);
    }
    const cutoff = this.t - SIM.sensorWindow;
    while (this.crossings.length && this.crossings[0] < cutoff) this.crossings.shift();
  }

  flowPerHour() {
    const window = Math.min(this.t, SIM.sensorWindow);
    if (window < 5) return 0;
    return Math.round((this.crossings.length / window) * 3600);
  }
}
