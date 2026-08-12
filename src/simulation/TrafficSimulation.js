import { Vehicle, resetVehicleIds } from '../vehicles/Vehicle.js';
import { SIM, DEFAULT_MIX } from '../core/Config.js';
import { makeRng, pickWeighted, dist } from '../core/MathUtils.js';

/**
 * TrafficSimulation — the agent layer of the engine.
 * Every fixed timestep, for each vehicle:
 *   1. find the binding constraint (leader gap, red light, incident blockage,
 *      connector conflict, or the player vehicle) — the *minimum* of the
 *      IDM accelerations toward each constraint wins;
 *   2. integrate v and s with semi-implicit Euler;
 *   3. advance across lane graph edges, applying route choice;
 *   4. opportunistic MOBIL-style lane change on multilane links.
 * Renderer-agnostic: it never touches canvas or three.js.
 */
export class TrafficSimulation {
  constructor(network, lights, weather, roadCond, incidents) {
    this.network = network;
    this.lights = lights;
    this.weather = weather;
    this.roadCond = roadCond;
    this.incidents = incidents;
    this.vehicles = [];
    this.targetCount = 90;
    this.mix = { ...DEFAULT_MIX };
    this.rng = makeRng(1337);
    this.player = null;
    this._spawnTimer = 0;
    this.spawnedTotal = 0;
  }

  setSeed(seed) { this.rng = makeRng(seed); }
  setTarget(n) { this.targetCount = Math.max(0, Math.min(400, Math.round(n))); }
  setMix(mix) { this.mix = { ...mix }; }
  setPlayer(p) { this.player = p; }

  /** Combined environment factors from weather × road condition. */
  env() {
    const w = this.weather.get();
    const r = this.roadCond.get();
    return {
      speedFactor: w.speedFactor * r.speedFactor,
      accelFactor: r.accelFactor,
      brakingFactor: w.brakingFactor,
      headwayFactor: w.headwayFactor * (2 - r.accelFactor) * 0.9 + 0.1,
      visibility: w.visibility,
      capacityFactor: w.capacityFactor * r.capacityFactor,
      windDrag: w.id === 'wind' ? 1 : 0
    };
  }

  reset() {
    this.vehicles = [];
    for (const lane of this.network.lanes) lane.vehicles.length = 0;
    resetVehicleIds();
    this.spawnedTotal = 0;
    this._spawnTimer = 0;
  }

  /** Instantly populate the network to ~target count (used on scenario start). */
  seedVehicles() {
    this.reset();
    const lanes = this.network.links.flatMap(l => l.lanes);
    let guard = 0;
    while (this.vehicles.length < this.targetCount && guard++ < this.targetCount * 30) {
      const lane = lanes[Math.floor(this.rng() * lanes.length)];
      const s = 8 + this.rng() * Math.max(8, lane.length - 20);
      if (this._spaceFree(lane, s, 9)) this._spawn(lane, s);
    }
    this._rebuildLaneIndex();
  }

  _spawn(lane, s) {
    const type = pickWeighted(this.rng, this.mix);
    const v = new Vehicle(type, lane, s, this.rng);
    this.vehicles.push(v);
    this.spawnedTotal++;
    return v;
  }

  _spaceFree(lane, s, margin) {
    for (const v of lane.vehicles) if (Math.abs(v.s - s) < margin + v.length) return false;
    // also check freshly-spawned not yet indexed
    for (const v of this.vehicles) if (v.lane === lane && Math.abs(v.s - s) < margin + v.length) return false;
    return true;
  }

  _rebuildLaneIndex() {
    for (const lane of this.network.lanes) lane.vehicles.length = 0;
    for (const v of this.vehicles) lane_push(v.lane, v);
    for (const lane of this.network.lanes) lane.vehicles.sort((a, b) => a.s - b.s);
    function lane_push(lane, v) { lane.vehicles.push(v); }
  }

  /** ---- Perception ------------------------------------------------------ */

  /** Leader gap/speed for vehicle v looking ahead up to `range` meters. */
  _lookAhead(v, range = 120) {
    let gap = Infinity, leadV = 0;
    // 1. leader on same lane
    const arr = v.lane.vehicles;
    const i = arr.indexOf(v);
    if (i >= 0 && i < arr.length - 1) {
      const lead = arr[i + 1];
      gap = lead.s - lead.length / 2 - (v.s + v.length / 2);
      leadV = lead.v;
    }
    // 2. incident blockage on this lane
    if (v.lane.blockedFrom < Infinity && v.s < v.lane.blockedFrom) {
      const g = v.lane.blockedFrom - 6 - (v.s + v.length / 2);
      if (g < gap) { gap = g; leadV = 0; }
    }
    // 3. across the edge into next lanes (nearest occupant of chosen next lane)
    const remaining = v.lane.length - v.s;
    if (remaining < range && v._next) {
      const nl = v._next;
      if (nl.vehicles.length) {
        const first = nl.vehicles[0];
        const g = remaining + first.s - first.length / 2 - v.length / 2;
        if (g < gap) { gap = g; leadV = first.v; }
      } else if (nl.next[0]?.vehicles.length) {
        const nn = nl.next[0];
        const first = nn.vehicles[0];
        const g = remaining + nl.length + first.s - first.length / 2 - v.length / 2;
        if (g < gap) { gap = g; leadV = first.v; }
      }
      if (nl.blockedFrom < Infinity) {
        const g = remaining + nl.blockedFrom - 6 - v.length / 2;
        if (g < gap) { gap = g; leadV = 0; }
      }
    }
    return { gap, leadV };
  }

  /** Distance to a stop line if the signal ahead demands stopping. */
  _signalStop(v, env) {
    const lane = v.lane;
    if (!lane.signal) return Infinity;
    const state = this.lights.stateFor(lane.signal.node, lane.signal.phase);
    const d = lane.length - v.s;
    if (state === 'green') return Infinity;
    if (state === 'flash') {
      // treat as yield: slow near the node
      return d < 26 ? d + 4 : Infinity;
    }
    if (state === 'yellow') {
      // stop only if we can comfortably stop before the line
      const stopDist = (v.v * v.v) / (2 * v.spec.brake / env.brakingFactor) + v.v * 0.8;
      if (d > stopDist) return Infinity; // committed — go through
    }
    return d;
  }

  /**
   * Connector conflict check: yield if a crossing connector is occupied.
   * Anti-gridlock rules: never yield to traffic held at a red light, break
   * symmetric conflicts by id, and creep through after losing patience.
   */
  _mustYield(v) {
    if (v.waiting > 7) return false; // patience exhausted — creep through
    const lane = v.lane;
    if (lane.kind === 'connector') {
      if (v.s > 4) return false; // already committed
      for (const c of lane.conflicts) {
        // yield only to vehicles further through the box (tie-break by progress, then id)
        for (const o of c.vehicles) {
          if (o.s <= 1) continue;
          if (o.s / c.length > v.s / lane.length + 0.05 || o.id < v.id) return true;
        }
      }
      return false;
    }
    // entering a connector soon?
    if (v._next?.kind === 'connector' && lane.length - v.s < 10 && !lane.signal) {
      const c = v._next;
      for (const o of c.conflicts) {
        if (o.vehicles.length) return true;
        // approaching priority (straight) traffic — but ignore it if it is held at red
        if (c.turn === 'left' && o.turn === 'straight' && o._fromLink) {
          const held = o._fromLink.lanes[0].signal &&
            this.lights.stateFor(o._fromLink.lanes[0].signal.node, o._fromLink.lanes[0].signal.phase) === 'red';
          if (held) continue;
          for (const l of o._fromLink.lanes) {
            const lastV = l.vehicles[l.vehicles.length - 1];
            if (lastV && lastV.v > 1 && l.length - lastV.s < Math.max(14, lastV.v * 2.2)) return true;
          }
        }
      }
    }
    return false;
  }

  /** Player as an obstacle: project onto vehicle's lane frame if nearby & ahead. */
  _playerGap(v) {
    const p = this.player;
    if (!p || !p.active) return { gap: Infinity, leadV: 0 };
    const dx = p.x - v.x, dy = p.y - v.y;
    const d = Math.hypot(dx, dy);
    if (d > 60) return { gap: Infinity, leadV: 0 };
    const ang = Math.atan2(dy, dx);
    let rel = ang - v.heading;
    while (rel > Math.PI) rel -= 2 * Math.PI;
    while (rel < -Math.PI) rel += 2 * Math.PI;
    if (Math.abs(rel) > 0.55) return { gap: Infinity, leadV: 0 };
    // lateral distance from v's path
    const lat = Math.abs(d * Math.sin(rel));
    if (lat > (v.width + p.width) / 2 + 1.2) return { gap: Infinity, leadV: 0 };
    const lon = d * Math.cos(rel) - v.length / 2 - p.length / 2;
    const pv = Math.abs(p.v) * Math.cos(p.heading - v.heading);
    return { gap: Math.max(0.05, lon), leadV: Math.max(0, pv) };
  }

  /** ---- Route choice ---------------------------------------------------- */
  _chooseNext(v) {
    const options = v.lane.next;
    if (!options.length) { v._next = null; return; }
    // weight straight > right > left, seeded rng for reproducibility
    const weights = options.map(o => o.turn === 'straight' ? 4 : o.turn === 'right' ? 2 : 1);
    let r = this.rng() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < options.length; i++) { r -= weights[i]; if (r <= 0) { v._next = options[i]; return; } }
    v._next = options[options.length - 1];
  }

  /** ---- Lane changing (simplified MOBIL) --------------------------------- */
  _maybeChangeLane(v, env) {
    if (v._laneChangeCooldown > 0 || v.lane.kind === 'connector') return;
    const lane = v.lane;
    // Mandatory: escape a blocked lane
    const blockedAhead = lane.blockedFrom < Infinity && lane.blockedFrom - v.s < 90 && v.s < lane.blockedFrom;
    // Discretionary: leader much slower than desired
    const { gap, leadV } = this._lookAhead(v, 60);
    const wantFaster = gap < 40 && leadV < v.desiredSpeed(env) * 0.6;
    if (!blockedAhead && !wantFaster) return;
    for (const target of [lane.left, lane.right]) {
      if (!target) continue;
      if (target.blockedFrom < Infinity && target.blockedFrom - v.s < 60) continue;
      // gap acceptance in target lane
      let front = Infinity, back = Infinity, backV = 0;
      for (const o of target.vehicles) {
        const ds = o.s - v.s;
        if (ds >= 0) front = Math.min(front, ds - o.length / 2 - v.length / 2);
        else { const b = -ds - o.length / 2 - v.length / 2; if (b < back) { back = b; backV = o.v; } }
      }
      const needFront = v.v * 0.9 + 6;
      const needBack = backV * 1.1 + 5;
      if (front > needFront && back > needBack) {
        // move over
        const idx = lane.vehicles.indexOf(v);
        if (idx >= 0) lane.vehicles.splice(idx, 1);
        v.lane = target;
        target.vehicles.push(v);
        target.vehicles.sort((a, b) => a.s - b.s);
        v._laneChangeCooldown = blockedAhead ? 2.5 : 6;
        v._next = null;
        this._chooseNext(v);
        return;
      }
    }
  }

  /** ---- Main step -------------------------------------------------------- */
  step() {
    const env = this.env();
    const dt = SIM.dt;

    // Spawn to maintain target volume
    this._spawnTimer += dt;
    if (this._spawnTimer >= SIM.spawnRetry) {
      this._spawnTimer = 0;
      const deficit = this.targetCount - this.vehicles.length;
      const tries = Math.min(4, Math.max(0, deficit));
      for (let k = 0; k < tries; k++) {
        const entries = this.network.entryLanes;
        const lane = entries[Math.floor(this.rng() * entries.length)];
        if (lane && this._spaceFree(lane, 6, 14)) {
          const v = this._spawn(lane, 6);
          lane.vehicles.push(v);
          lane.vehicles.sort((a, b) => a.s - b.s);
        }
      }
    }

    // Decide accelerations first (synchronous update), then integrate
    for (const v of this.vehicles) {
      if (!v._next && v.lane.next.length) this._chooseNext(v);
      const look = this._lookAhead(v);
      const pGap = this._playerGap(v);
      let accel = v.idm(env, Math.min(look.gap, pGap.gap), look.gap <= pGap.gap ? look.leadV : pGap.leadV);
      // signal
      const sd = this._signalStop(v, env);
      if (sd < Infinity) {
        const stopGap = Math.max(0.05, sd - 2.0);
        accel = Math.min(accel, v.idm(env, stopGap, 0));
      }
      // connector conflicts (yield)
      if (this._mustYield(v)) {
        const d = v.lane.kind === 'connector' ? 2 : v.lane.length - v.s;
        accel = Math.min(accel, v.idm(env, Math.max(0.05, d - 1.5), 0));
      }
      v._accel = accel;
    }

    // Integrate + advance across the lane graph
    const finished = [];
    for (const v of this.vehicles) {
      v.integrate(v._accel, dt);
      while (v.s >= v.lane.length) {
        const overshoot = v.s - v.lane.length;
        const nxt = v._next || v.lane.next[0];
        if (!nxt) { v.done = true; finished.push(v); break; }
        const idx = v.lane.vehicles.indexOf(v);
        if (idx >= 0) v.lane.vehicles.splice(idx, 1);
        v.lane = nxt;
        v.s = overshoot;
        nxt.vehicles.push(v);
        v._next = null;
        if (v.lane.next.length) this._chooseNext(v);
      }
      if (!v.done) v.updatePose();
    }

    // Remove vehicles that exited the network
    if (finished.length) {
      for (const v of finished) {
        const idx = v.lane.vehicles.indexOf(v);
        if (idx >= 0) v.lane.vehicles.splice(idx, 1);
        this.vehicles.splice(this.vehicles.indexOf(v), 1);
      }
    }

    // Keep per-lane order correct
    for (const lane of this.network.lanes) if (lane.vehicles.length > 1) lane.vehicles.sort((a, b) => a.s - b.s);

    // Lane changes (cheap, after ordering)
    for (const v of this.vehicles) this._maybeChangeLane(v, env);
  }

  /** Nearest lane position to a world point — used to spawn the player. */
  nearestLanePoint(x, y) {
    let best = null, bestD = Infinity;
    for (const link of this.network.links) {
      for (const lane of link.lanes) {
        for (let s = 0; s < lane.length; s += 10) {
          const p = lane.at(s);
          const d = dist(x, y, p.x, p.y);
          if (d < bestD) { bestD = d; best = { lane, s, ...p }; }
        }
      }
    }
    return best;
  }
}
