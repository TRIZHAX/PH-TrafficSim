import { INCIDENT_TYPES } from '../core/Config.js';
import { bus } from '../core/EventBus.js';

let incidentSeq = 1;

/**
 * IncidentManager — construction zones, breakdowns, accidents, lane closures
 * and signal failures. Lane-blocking incidents set `lane.blockedFrom`, which
 * vehicles treat as a stationary obstacle (they brake and merge away).
 * Signal failures flip the node controller into flashing mode.
 */
export class IncidentManager {
  constructor(network, lights) {
    this.network = network;
    this.lights = lights;
    this.incidents = [];
  }

  /**
   * Place an incident of `type` on a link (defaults to the busiest main link,
   * outermost lane, mid-block).
   */
  create(type, opts = {}) {
    const spec = INCIDENT_TYPES[type];
    if (!spec) return null;

    if (type === 'signalFail') {
      const nodes = [...this.lights.controllers.keys()];
      if (!nodes.length) return null;
      const node = opts.node || nodes[0];
      this.lights.setFailed(node, true);
      const c = this.lights.controllers.get(node);
      const inc = { id: incidentSeq++, type, spec, node, x: c.x, y: c.y, t: 0, duration: opts.duration ?? spec.duration };
      this.incidents.push(inc);
      bus.emit('incident:created', inc);
      return inc;
    }

    const links = this.network.mainLinks.length ? this.network.mainLinks : this.network.links;
    const link = opts.link || links[Math.floor(links.length / 2)] || this.network.links[0];
    if (!link) return null;
    const lane = link.lanes[link.lanes.length - 1]; // outermost lane
    const at = opts.at ?? lane.length * 0.55;
    const zone = Math.max(18, (opts.zone ?? 30));
    lane.blockedFrom = Math.min(lane.blockedFrom, at);
    const p = lane.at(at);
    const inc = {
      id: incidentSeq++, type, spec, lane, link,
      at, zone, x: p.x, y: p.y, heading: p.heading,
      t: 0, duration: opts.duration ?? spec.duration
    };
    this.incidents.push(inc);
    bus.emit('incident:created', inc);
    return inc;
  }

  remove(id) {
    const i = this.incidents.findIndex(x => x.id === id);
    if (i < 0) return;
    this._clear(this.incidents[i]);
    this.incidents.splice(i, 1);
    bus.emit('incident:removed', id);
  }

  clearAll() {
    for (const inc of this.incidents) this._clear(inc);
    this.incidents = [];
    bus.emit('incident:removed', 'all');
  }

  _clear(inc) {
    if (inc.type === 'signalFail') this.lights.setFailed(inc.node, false);
    else if (inc.lane) {
      // reopen the lane unless another incident still blocks it
      const others = this.incidents.filter(o => o !== inc && o.lane === inc.lane);
      inc.lane.blockedFrom = others.length ? Math.min(...others.map(o => o.at)) : Infinity;
    }
  }

  step(dt) {
    for (const inc of [...this.incidents]) {
      inc.t += dt;
      if (inc.duration !== Infinity && inc.t >= inc.duration) this.remove(inc.id);
    }
  }

  /** Fraction of network capacity lost to blocked lanes (for capacity calc). */
  capacityLoss() {
    let lost = 0;
    for (const inc of this.incidents) {
      if (!inc.lane || !inc.link) continue;
      const linkLanes = inc.link.lanes.length;
      lost += (inc.link.length * 1) / Math.max(1, this.network.totalLaneLength) * (1 / linkLanes) * linkLanes;
    }
    return Math.min(0.5, lost);
  }
}
