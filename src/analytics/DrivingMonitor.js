import { dist, angleDiff } from '../core/MathUtils.js';
import { bus } from '../core/EventBus.js';

/**
 * DrivingMonitor — analyses the player vehicle every simulation step and
 * derives driving-quality signals for the HUD, the warning system and the
 * analytics/CSV layer (brief §2, §3, §4, §15). It reads engine + network state
 * only and NEVER mutates the simulation, preserving the engine/renderer
 * separation. Collision *response* is applied to the PlayerVehicle's kinematic
 * fields only (it is a controllable body, not a simulation agent).
 *
 * Detection outputs (this.state):
 *   onRoad, lane (nearest lane + lateral offset), wrongLane, wrongWay,
 *   laneDeparture, offRoad, nearIntersection, speedLimit, overSpeed.
 *
 * Events (deduplicated with cooldown/debounce so one continuous violation is a
 * single logged event, brief §14): off_road, wrong_lane, wrong_way,
 * lane_departure, collision, near_miss, red_light_violation, hard_brake,
 * sudden_accel.
 *
 * Session metrics (this.metrics) feed the results screen, analytics page and
 * CSV export columns.
 */

const KMH = 3.6;

/* violation severity tiers used by the HUD warning system */
export const SEVERITY = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' };

/* severity -> sort rank (higher wins the top HUD slot) */
const RANK = { low: 1, medium: 2, high: 3, critical: 4 };

/* per-continuous-violation config: which vector icon, which analytics counters
 * to bump, and which cumulative-time bucket to fill (brief §14/§15). */
const VIOL_CFG = {
  off_road:       { icon: 'offroad',    event: 'off_road',        count: 'offRoadEvents',       time: 'offRoadTime' },
  restricted:     { icon: 'restricted', event: 'restricted_area', count: 'offRoadEvents',       time: 'offRoadTime' },
  wrong_way:      { icon: 'wrongway',   event: 'wrong_way',       count: 'wrongWayEvents',      time: 'wrongWayTime' },
  wrong_lane:     { icon: 'lane',       event: 'wrong_lane',      count: 'wrongLaneEvents',     time: 'wrongLaneTime' },
  lane_departure: { icon: 'departure',  event: 'lane_departure',  count: 'laneDepartureEvents', time: null },
  over_speed:     { icon: 'gauge',      event: 'over_speed',      count: null,                  time: null }
};

/* vector icon for one-shot (auto-dismissing) warning flashes */
const FLASH_ICON = {
  collision: 'collision', near_miss: 'warning', hard_brake: 'warning',
  sudden_accel: 'gauge', red_light: 'signal'
};

export class DrivingMonitor {
  constructor(engine) {
    this.engine = engine;
    this.reset();
  }

  reset() {
    this.state = this._emptyState();
    this.metrics = this._emptyMetrics();
    this.events = [];                 // rolling recent log (bounded)
    this.activeWarnings = new Map();   // key -> warning object (for HUD)
    this._viol = {};                   // key -> { active, since, lastLog }
    this._flash = new Map();           // one-shot warnings: key -> {expires,...}
    this._prevV = 0;
    this._lastLaneCheck = null;
    this._t = 0;
    this._collisionCooldown = 0;
    this._nearMissCooldown = 0;
    this._redLightCooldown = 0;
    this._hardBrakeCd = 0;
    this._accelCd = 0;
    this._prevNodeDist = null;
    this._laneSampleStep = 6;          // m along lanes for nearest-lane search
    this._lastPos = null;
    this._wasAtIntersection = false;
    this._seenIncidents = new Set();
  }

  _emptyState() {
    return {
      active: false, onRoad: false, offRoad: false,
      lane: null, laneOffset: 0, wrongLane: false, wrongWay: false,
      laneDeparture: false, nearIntersection: false, atIntersection: false,
      restricted: false, speed: 0, speedLimit: 0, overSpeed: false,
      surface: 'road', headingError: 0
    };
  }

  _emptyMetrics() {
    return {
      distance: 0, driveTime: 0, movingTime: 0,
      avgSpeed: 0, maxSpeed: 0, _speedSum: 0, _speedSamples: 0,
      offRoadEvents: 0, offRoadTime: 0,
      wrongLaneEvents: 0, wrongLaneTime: 0,
      wrongWayEvents: 0, wrongWayTime: 0,
      laneDepartureEvents: 0,
      collisions: 0, collisionsVehicle: 0, collisionsObject: 0,
      nearMisses: 0,
      redLightViolations: 0,
      hardBrakes: 0, suddenAccels: 0,
      laneChanges: 0, intersectionsEntered: 0,
      constructionEncounters: 0
    };
  }

  /* ---- main per-step update ------------------------------------------- */
  step(dt) {
    const p = this.engine.player;
    if (!p || !p.active) {
      if (this.state.active) this._endSession();
      return;
    }
    if (!this.state.active) this._beginSession();
    this._t += dt;
    this._lastDt = dt;
    if (this._collisionCooldown > 0) this._collisionCooldown -= dt;
    if (this._nearMissCooldown > 0) this._nearMissCooldown -= dt;
    if (this._redLightCooldown > 0) this._redLightCooldown -= dt;
    this._expireFlash();

    this._locate(p);
    this._classify(p, dt);
    this._collisions(p, dt);
    this._dynamics(p, dt);
    this._updateMetrics(p, dt);
    this._prevV = p.v;
  }

  _beginSession() {
    this.state.active = true;
    this.metrics = this._emptyMetrics();
    this.events = [];
    this._prevV = 0;
    this._lastPos = { x: this.engine.player.x, y: this.engine.player.y };
    bus.emit('drive:session-start');
  }

  _endSession() {
    this._clearAllWarnings();
    this.state = this._emptyState();
    bus.emit('drive:session-end', this.summary());
  }

  /* ---- road / lane localisation --------------------------------------- */
  _locate(p) {
    const net = this.engine.network;
    const lanes = net.lanes;
    let best = null, bestD = Infinity;         // nearest lane overall
    let bestFwd = null, bestFwdD = Infinity;   // nearest lane roughly matching heading
    for (const lane of lanes) {
      // cheap cull using lane midpoint
      const mid = lane.at(lane.length * 0.5);
      if (dist(p.x, p.y, mid.x, mid.y) > lane.length * 0.5 + 45) continue;
      // sample for nearest point
      const step = Math.max(3, this._laneSampleStep);
      let d = Infinity, hp = null;
      for (let s = 0; s <= lane.length; s += step) {
        const q = lane.at(s);
        const dd = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y);
        if (dd < d) { d = dd; hp = q; }
      }
      d = Math.sqrt(d);
      if (d < bestD) { bestD = d; best = { lane, dist: d, heading: hp.heading }; }
      const he = Math.abs(angleDiff(p.heading, hp.heading));
      if (he < 1.05 && d < bestFwdD) { bestFwdD = d; bestFwd = { lane, dist: d, heading: hp.heading }; }
    }
    this._loc = { best, bestFwd };
  }

  /* ---- classification: on-road / wrong-lane / wrong-way / departure --- */
  _classify(p, dt) {
    const net = this.engine.network;
    const lw = net.laneWidth;
    const st = this.state;
    const { best, bestFwd } = this._loc;

    st.speed = Math.abs(p.v) * KMH;

    // On-road test: within a lane-half + small margin of the nearest centerline.
    const onRoad = !!best && best.dist <= lw * 0.5 + 1.1;
    const moving = Math.abs(p.v) > 1.4;

    st.onRoad = onRoad;
    st.lane = best ? best.lane : null;
    st.laneOffset = best ? +best.dist.toFixed(2) : 0;
    st.speedLimit = best ? Math.round(best.lane.speedLimit * KMH) : 0;
    st.overSpeed = st.speedLimit > 0 && st.speed > st.speedLimit + 6;

    const headingErr = best ? Math.abs(angleDiff(p.heading, best.heading)) : 0;
    st.headingError = +headingErr.toFixed(2);

    // Restricted zones: plazas, parks (greens), water footprints.
    st.restricted = this._inRestricted(p);

    // Intersection proximity.
    let nearNode = null, nd = Infinity;
    for (const node of net.nodes.values()) {
      if (node.roads.length < 2) continue;
      const d = dist(p.x, p.y, node.x, node.y);
      if (d < nd) { nd = d; nearNode = node; }
    }
    st.nearIntersection = nearNode && nd < nearNode.radius + 26;
    st.atIntersection = nearNode && nd < nearNode.radius + 6;
    this._nearNode = nearNode; this._nodeDist = nd;

    // Wrong-way: physically in a lane but facing against its flow.
    const wrongWay = onRoad && moving && headingErr > 2.1;
    // Wrong-lane: on road, facing forward-ish, but the nearest correct-direction
    // lane is more than a lane away (drifted into the oncoming side).
    const wrongLane = onRoad && !wrongWay && moving && !st.restricted &&
      (!bestFwd || bestFwd.dist > lw * 1.15) && headingErr < 1.4;
    // Lane departure: mild straddle across a boundary while otherwise fine.
    const laneDeparture = onRoad && !wrongWay && !wrongLane && moving &&
      best.dist > lw * 0.42;

    st.wrongWay = wrongWay;
    st.wrongLane = wrongLane;
    st.laneDeparture = laneDeparture;
    st.offRoad = !onRoad && !st.atIntersection && moving;
    st.surface = st.restricted ? 'restricted' : st.offRoad ? this._surfaceAt(p) : 'road';

    // ---- feed the violation state-machine (debounced logging) ----
    this._setViolation('off_road', st.offRoad && !st.restricted, {
      severity: SEVERITY.HIGH, code: 'OFF ROAD',
      detail: 'Vehicle has left the carriageway. Return to the road.'
    });
    this._setViolation('restricted', st.restricted && moving, {
      severity: SEVERITY.HIGH, code: 'RESTRICTED AREA',
      detail: 'This area is not open to vehicles.'
    });
    this._setViolation('wrong_way', wrongWay, {
      severity: SEVERITY.CRITICAL, code: 'WRONG WAY',
      detail: 'You are driving against the flow of traffic.'
    });
    this._setViolation('wrong_lane', wrongLane, {
      severity: SEVERITY.MEDIUM, code: 'WRONG LANE',
      detail: 'You have drifted into an oncoming lane.'
    });
    this._setViolation('lane_departure', laneDeparture, {
      severity: SEVERITY.LOW, code: 'LANE DEPARTURE',
      detail: 'Vehicle is drifting from the lane centre.'
    });
    this._setViolation('over_speed', st.overSpeed, {
      severity: SEVERITY.LOW, code: 'OVER SPEED LIMIT',
      detail: `Speed limit is ${st.speedLimit} km/h.`
    });

    // lane-change counter (same-direction lane switch)
    if (best && this._lastLaneCheck && best.lane !== this._lastLaneCheck) {
      const a = best.lane, b = this._lastLaneCheck;
      if (a.link && b.link && a.link === b.link) this.metrics.laneChanges++;
    }
    if (best) this._lastLaneCheck = best.lane;

    // intersection entry counter
    if (st.atIntersection && !this._wasAtIntersection) this.metrics.intersectionsEntered++;
    this._wasAtIntersection = st.atIntersection;

    // construction encounter counter
    this._trackConstruction(p);
  }

  _inRestricted(p) {
    const def = this.engine.maps.current;
    const hit = (x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
    for (const lm of def.landmarks || []) if (lm.kind === 'plaza' && hit(lm.x, lm.y, lm.w, lm.h)) return true;
    for (const g of def.greens || []) if (hit(g[0], g[1], g[2], g[3])) return true;
    for (const w of def.water || []) if (hit(w.x, w.y, w.w, w.h)) return true;
    return false;
  }

  _surfaceAt(p) {
    const def = this.engine.maps.current;
    const hit = (x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
    for (const g of def.greens || []) if (hit(g[0], g[1], g[2], g[3])) return 'grass';
    for (const bl of def.blocks || []) if (hit(bl[0], bl[1], bl[2], bl[3])) return 'building';
    return 'shoulder';
  }

  _trackConstruction(p) {
    this._seenIncidents = this._seenIncidents || new Set();
    for (const inc of this.engine.incidents.incidents) {
      if (inc.type !== 'construction' && inc.type !== 'laneClosure' && inc.type !== 'accident') continue;
      if (inc.x == null) continue;
      if (dist(p.x, p.y, inc.x, inc.y) < 32 && !this._seenIncidents.has(inc.id)) {
        this._seenIncidents.add(inc.id);
        this.metrics.constructionEncounters++;
      }
    }
  }

  /* ---- collision detection + response --------------------------------- */
  /**
   * Real distance/bounds-based collision detection (brief §4). Broad-phase by
   * centre distance, narrow-phase by oriented-bounding-box overlap (SAT). On a
   * hit we push the player out of penetration and damp the velocity along the
   * contact normal — this only ever touches the *player's* kinematic fields
   * (it is a controllable body, never a simulation agent), so the engine's
   * renderer-agnostic agent model is untouched. Near-misses (close pass, no
   * contact) are logged separately.
   */
  _collisions(p, dt) {
    const pc = this._obb(p.x, p.y, p.heading, p.length, p.width);
    const pr = (p.length + p.width) * 0.5;   // broad-phase radius

    let hit = null, hitPen = 0, minClear = Infinity;

    // ---- vehicle vs vehicle ----
    for (const o of this.engine.traffic.vehicles) {
      const dx = o.x - p.x, dy = o.y - p.y;
      const d = Math.hypot(dx, dy);
      const reach = pr + (o.length + o.width) * 0.5;
      if (d > reach) continue;
      const oc = this._obb(o.x, o.y, o.heading, o.length, o.width);
      const sat = this._satOverlap(pc, oc);
      if (sat) {
        if (sat.depth > hitPen) { hitPen = sat.depth; hit = { kind: 'vehicle', o, mtv: sat }; }
      } else {
        const clear = d - (o.length + o.width) * 0.25 - (p.length + p.width) * 0.25;
        if (clear < minClear) minClear = clear;
      }
    }

    // ---- vehicle vs static object (buildings + incident barriers) ----
    if (!hit) {
      const obj = this._objectHit(p, pc);
      if (obj) hit = obj;
    }

    // ---- near-miss: fast close pass with no contact ----
    if (!hit && minClear < 1.4 && Math.abs(p.v) > 5 && this._nearMissCooldown <= 0) {
      this._nearMissCooldown = 2.5;
      this.metrics.nearMisses++;
      this._logEvent('near_miss', SEVERITY.MEDIUM, {
        code: 'NEAR MISS', speed: +(Math.abs(p.v) * KMH).toFixed(1),
        detail: 'A collision was narrowly avoided.'
      });
      this._pushFlash('near_miss', SEVERITY.MEDIUM, 'NEAR MISS', 'A collision was narrowly avoided.', 2.2);
    }

    if (hit) this._resolveCollision(p, hit);
  }

  /** Oriented bounding box as {cx,cy, ax:{x,y}, ay:{x,y}, hl, hw} (unit axes). */
  _obb(cx, cy, heading, L, W) {
    const ax = { x: Math.cos(heading), y: Math.sin(heading) };
    const ay = { x: -Math.sin(heading), y: Math.cos(heading) };
    return { cx, cy, ax, ay, hl: L / 2, hw: W / 2 };
  }

  /** Separating-Axis overlap of two OBBs. Returns {nx,ny,depth} MTV or null. */
  _satOverlap(a, b) {
    const axes = [a.ax, a.ay, b.ax, b.ay];
    let best = Infinity, bnx = 0, bny = 0;
    const dcx = b.cx - a.cx, dcy = b.cy - a.cy;
    for (const ax of axes) {
      const ra = a.hl * Math.abs(a.ax.x * ax.x + a.ax.y * ax.y) + a.hw * Math.abs(a.ay.x * ax.x + a.ay.y * ax.y);
      const rb = b.hl * Math.abs(b.ax.x * ax.x + b.ax.y * ax.y) + b.hw * Math.abs(b.ay.x * ax.x + b.ay.y * ax.y);
      const sep = Math.abs(dcx * ax.x + dcy * ax.y);
      const overlap = ra + rb - sep;
      if (overlap <= 0) return null;                 // separating axis found
      if (overlap < best) { best = overlap; bnx = ax.x; bny = ax.y; }
    }
    // orient normal from a -> b
    if (dcx * bnx + dcy * bny < 0) { bnx = -bnx; bny = -bny; }
    return { nx: bnx, ny: bny, depth: best };
  }

  /** Player OBB vs static objects: solid buildings and incident barriers. */
  _objectHit(p, pc) {
    const def = this.engine.maps.current;
    // buildings (axis-aligned rectangles) — approximate as AABB overlap of the
    // player's circumscribed circle then confirm with corner-in-rect.
    for (const bl of def.blocks || []) {
      const [bx, by, bw, bh] = bl;
      if (p.x < bx - 6 || p.x > bx + bw + 6 || p.y < by - 6 || p.y > by + bh + 6) continue;
      const corners = this._corners(pc);
      for (const c of corners) {
        if (c.x >= bx && c.x <= bx + bw && c.y >= by && c.y <= by + bh) {
          const nx = c.x - (bx + bw / 2), ny = c.y - (by + bh / 2);
          const m = Math.hypot(nx, ny) || 1;
          return { kind: 'object', label: 'building', mtv: { nx: nx / m, ny: ny / m, depth: 0.6 } };
        }
      }
    }
    // incident barriers (construction / accident / lane closure)
    for (const inc of this.engine.incidents.incidents) {
      if (inc.x == null || !inc.lane) continue;
      const d = Math.hypot(inc.x - p.x, inc.y - p.y);
      if (d < (p.length + p.width) * 0.5 + 1.4) {
        const m = d || 1;
        return { kind: 'object', label: 'barrier', mtv: { nx: (p.x - inc.x) / m, ny: (p.y - inc.y) / m, depth: 0.5 } };
      }
    }
    return null;
  }

  _corners(o) {
    const { cx, cy, ax, ay, hl, hw } = o;
    return [
      { x: cx + ax.x * hl + ay.x * hw, y: cy + ax.y * hl + ay.y * hw },
      { x: cx + ax.x * hl - ay.x * hw, y: cy + ax.y * hl - ay.y * hw },
      { x: cx - ax.x * hl + ay.x * hw, y: cy - ax.y * hl + ay.y * hw },
      { x: cx - ax.x * hl - ay.x * hw, y: cy - ax.y * hl - ay.y * hw }
    ];
  }

  /** Apply penetration push + velocity damping to the player; log once/cooldown. */
  _resolveCollision(p, hit) {
    const { nx, ny, depth } = hit.mtv;         // normal points player -> other
    // 1. positional correction: push the player back out of the object/vehicle
    p.x -= nx * (depth + 0.02);
    p.y -= ny * (depth + 0.02);
    // 2. kill the velocity component driving into the contact + damp
    const fwd = { x: Math.cos(p.heading), y: Math.sin(p.heading) };
    const closing = fwd.x * nx + fwd.y * ny;   // >0 means moving into contact
    if (closing > 0) p.v *= hit.kind === 'object' ? 0.15 : 0.45;
    else p.v *= 0.8;
    if (Math.abs(p.v) < 0.4) p.v = 0;

    if (this._collisionCooldown > 0) return;   // already counted this contact
    this._collisionCooldown = 1.2;
    if (p.crashCooldown != null) p.crashCooldown = Math.max(p.crashCooldown, 0.8);

    this.metrics.collisions++;
    let type = 'object', detail;
    if (hit.kind === 'vehicle') {
      this.metrics.collisionsVehicle++;
      type = this._collisionType(p, hit.o);
      detail = {
        'rear-end': 'Rear-end collision with the vehicle ahead.',
        'head-on': 'Head-on collision with oncoming traffic.',
        'side': 'Side collision with another vehicle.'
      }[type];
    } else {
      this.metrics.collisionsObject++;
      detail = hit.label === 'building'
        ? 'Collision with a roadside structure.'
        : 'Collision with a road barrier.';
    }
    const payload = {
      code: 'COLLISION DETECTED', collisionType: type,
      speed: +(Math.abs(p.v) * KMH).toFixed(1), detail
    };
    this._logEvent('collision', SEVERITY.CRITICAL, payload);
    this._pushFlash('collision', SEVERITY.CRITICAL, 'COLLISION DETECTED', detail, 3.0);
  }

  /** Classify a vehicle-vehicle contact by relative geometry. */
  _collisionType(p, o) {
    const rel = Math.abs(angleDiff(p.heading, o.heading));
    if (rel > 2.4) return 'head-on';
    if (rel < 0.7) {
      // aligned headings — decide rear-end by who is in front
      const fwd = { x: Math.cos(p.heading), y: Math.sin(p.heading) };
      const ahead = (o.x - p.x) * fwd.x + (o.y - p.y) * fwd.y;
      return Math.abs(ahead) > (p.length + o.length) * 0.25 ? 'rear-end' : 'side';
    }
    return 'side';
  }

  /* ---- dynamics: hard brake, sudden accel, red-light violation -------- */
  _dynamics(p, dt) {
    // longitudinal acceleration from the change in speed this step
    const a = (Math.abs(p.v) - Math.abs(this._prevV)) / Math.max(dt, 1e-3);

    // Hard braking: strong deceleration while actually moving (brief §15).
    if (a < -6.5 && Math.abs(this._prevV) > 4 && this._hardBrakeCd == null) this._hardBrakeCd = 0;
    if (this._hardBrakeCd > 0) this._hardBrakeCd -= dt;
    if (a < -6.5 && Math.abs(this._prevV) > 4 && (this._hardBrakeCd || 0) <= 0) {
      this._hardBrakeCd = 1.0;
      this.metrics.hardBrakes++;
      this._logEvent('hard_brake', SEVERITY.LOW, {
        code: 'HARD BRAKING', decel: +(-a).toFixed(1),
        detail: 'Abrupt braking detected.'
      });
      this._pushFlash('hard_brake', SEVERITY.LOW, 'HARD BRAKING', 'Abrupt braking detected.', 1.6);
    }

    // Sudden acceleration.
    if (this._accelCd > 0) this._accelCd -= dt;
    if (a > 5.0 && (this._accelCd || 0) <= 0) {
      this._accelCd = 1.0;
      this.metrics.suddenAccels++;
      this._logEvent('sudden_accel', SEVERITY.LOW, {
        code: 'RAPID ACCELERATION', accel: +a.toFixed(1),
        detail: 'Sudden acceleration detected.'
      });
      this._pushFlash('sudden_accel', SEVERITY.LOW, 'RAPID ACCELERATION', 'Sudden acceleration detected.', 1.6);
    }

    // Red-light running: crossing the nearest signal's stop line on a red.
    this._redLight(p, dt);
  }

  /**
   * Red-light violation: find the nearest signalized approach lane, read its
   * live phase from the engine's TrafficLightManager, and fire once when the
   * player passes through the stop region while moving on red.
   */
  _redLight(p, dt) {
    if (this._redLightCooldown > 0) return;
    if (Math.abs(p.v) < 2) return;
    const node = this._nearNode;
    if (!node || this._nodeDist > node.radius + 12) return;

    // which approach phase am I on? use the lane I'm nearest to that carries a signal
    const lane = this.state.lane;
    let phase = null, sigNode = null;
    if (lane && lane.signal) { phase = lane.signal.phase; sigNode = lane.signal.node; }
    if (sigNode == null) return;

    const st = this.engine.lights.stateFor(sigNode, phase);
    // moving toward and into the node region while the light is red
    if (st === 'red' && this._nodeDist < node.radius + 6 && this._prevNodeDist != null &&
        this._nodeDist < this._prevNodeDist - 0.02) {
      this._redLightCooldown = 4.0;
      this.metrics.redLightViolations++;
      this._logEvent('red_light_violation', SEVERITY.HIGH, {
        code: 'RED LIGHT', detail: 'You entered the intersection on a red signal.'
      });
      this._pushFlash('red_light', SEVERITY.HIGH, 'RED LIGHT', 'You ran a red signal.', 2.4);
    }
    this._prevNodeDist = this._nodeDist;
  }

  /* ---- metrics accumulation ------------------------------------------- */
  _updateMetrics(p, dt) {
    const m = this.metrics;
    const spd = Math.abs(p.v);          // m/s
    const kmh = spd * KMH;

    // distance travelled this step (world displacement, robust to collision push)
    if (this._lastPos) {
      const d = dist(this._lastPos.x, this._lastPos.y, p.x, p.y);
      // ignore large jumps from collision correction
      if (d < 12) m.distance += d;
    }
    this._lastPos = { x: p.x, y: p.y };

    m.driveTime += dt;
    if (spd > 0.6) m.movingTime += dt;

    m._speedSum += kmh; m._speedSamples++;
    m.avgSpeed = m._speedSamples ? +(m._speedSum / m._speedSamples).toFixed(1) : 0;
    if (kmh > m.maxSpeed) m.maxSpeed = +kmh.toFixed(1);
  }

  /* ---- violation state-machine + event log --------------------------- */
  /**
   * Debounced, sustained-violation state machine (brief §14): a continuous
   * violation is ONE logged analytics event, while the HUD warning stays active
   * for as long as the condition holds and clears when it ends. `payload`
   * carries severity + display text for the HUD banner.
   */
  _setViolation(key, on, payload) {
    const cfg = VIOL_CFG[key] || {};
    let v = this._viol[key];
    if (!v) v = this._viol[key] = { active: false, since: 0, dur: 0 };

    if (on) {
      if (!v.active) {
        // rising edge — start of a new continuous violation
        v.active = true;
        v.since = this._t;
        v.dur = 0;
        if (cfg.count && this.metrics[cfg.count] != null) this.metrics[cfg.count]++;
        if (cfg.event) this._logEvent(cfg.event, payload.severity, {
          code: payload.code, detail: payload.detail, speed: +this.state.speed.toFixed(1)
        });
      } else {
        v.dur = this._t - v.since;
        if (cfg.time) this.metrics[cfg.time] += this._lastDt || 0;
      }
      // keep the HUD banner live
      this.activeWarnings.set(key, {
        key, severity: payload.severity, rank: RANK[payload.severity] || 1,
        icon: cfg.icon || 'warning', code: payload.code, detail: payload.detail,
        sustained: true, since: v.since
      });
    } else if (v.active) {
      // falling edge — violation ended
      v.active = false;
      this.activeWarnings.delete(key);
    }
  }

  /** Append to the bounded rolling event log and notify the UI via the bus. */
  _logEvent(type, severity, payload) {
    const ev = {
      type, severity,
      t: +this.engine.clock.simTime.toFixed(1),
      ...payload
    };
    this.events.push(ev);
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
    bus.emit('drive:event', ev);
  }

  /* one-shot auto-dismissing HUD warning (collision, near-miss, hard brake…) */
  _pushFlash(key, severity, code, detail, ttl = 2.0) {
    this._flash.set(key, {
      key, severity, rank: RANK[severity] || 1,
      icon: FLASH_ICON[key] || 'warning', code, detail,
      sustained: false, expires: this._t + ttl
    });
  }

  _expireFlash() {
    for (const [k, f] of this._flash) if (this._t >= f.expires) this._flash.delete(k);
  }

  _clearAllWarnings() {
    this.activeWarnings.clear();
    this._flash.clear();
    for (const k in this._viol) this._viol[k].active = false;
  }

  /* ---- public accessors ----------------------------------------------- */
  /** All live HUD warnings: sustained violations + active one-shot flashes,
   *  highest severity first (brief §14). */
  warnings() {
    return [...this.activeWarnings.values(), ...this._flash.values()]
      .sort((a, b) => b.rank - a.rank);
  }
  topWarning() { return this.warnings()[0] || null; }

  /** Compact live HUD state (speed, limit, lane/light status, road, etc.). */
  hud() {
    const st = this.state;
    let laneStatus = 'On lane';
    if (st.wrongWay) laneStatus = 'Wrong way';
    else if (st.wrongLane) laneStatus = 'Wrong lane';
    else if (st.offRoad) laneStatus = st.restricted ? 'Restricted' : 'Off road';
    else if (st.laneDeparture) laneStatus = 'Lane departure';
    else if (st.restricted) laneStatus = 'Restricted';
    return {
      speed: Math.round(st.speed),
      speedLimit: st.speedLimit,
      overSpeed: st.overSpeed,
      onRoad: st.onRoad,
      laneStatus,
      wrongWay: st.wrongWay,
      wrongLane: st.wrongLane,
      offRoad: st.offRoad,
      laneDeparture: st.laneDeparture,
      restricted: st.restricted,
      nearIntersection: st.nearIntersection,
      atIntersection: st.atIntersection,
      surface: st.surface
    };
  }

  /** Full session metrics for the results screen + analytics page (brief §15). */
  summary() {
    const m = this.metrics;
    return {
      distance: +m.distance.toFixed(1),          // m
      distanceKm: +(m.distance / 1000).toFixed(3),
      driveTime: +m.driveTime.toFixed(1),         // s
      movingTime: +m.movingTime.toFixed(1),
      avgSpeed: m.avgSpeed,                        // km/h
      maxSpeed: m.maxSpeed,
      offRoadEvents: m.offRoadEvents,
      offRoadTime: +m.offRoadTime.toFixed(1),
      wrongLaneEvents: m.wrongLaneEvents,
      wrongLaneTime: +m.wrongLaneTime.toFixed(1),
      wrongWayEvents: m.wrongWayEvents,
      wrongWayTime: +m.wrongWayTime.toFixed(1),
      laneDepartureEvents: m.laneDepartureEvents,
      collisions: m.collisions,
      collisionsVehicle: m.collisionsVehicle,
      collisionsObject: m.collisionsObject,
      nearMisses: m.nearMisses,
      redLightViolations: m.redLightViolations,
      hardBrakes: m.hardBrakes,
      suddenAccels: m.suddenAccels,
      laneChanges: m.laneChanges,
      intersectionsEntered: m.intersectionsEntered,
      constructionEncounters: m.constructionEncounters,
      violationsPerKm: +(( (m.offRoadEvents + m.wrongLaneEvents + m.wrongWayEvents +
        m.laneDepartureEvents + m.redLightViolations) / Math.max(0.001, m.distance / 1000) )).toFixed(2),
      score: this._score(),
      recentEvents: this.events.slice(-12).reverse()
    };
  }

  /** 0–100 driving-quality score derived from violation counts vs distance. */
  _score() {
    const m = this.metrics;
    const km = Math.max(0.05, m.distance / 1000);
    let penalty = 0;
    penalty += m.collisions * 25;
    penalty += m.wrongWayEvents * 15;
    penalty += m.redLightViolations * 12;
    penalty += m.offRoadEvents * 8;
    penalty += m.wrongLaneEvents * 6;
    penalty += m.nearMisses * 4;
    penalty += m.laneDepartureEvents * 2;
    penalty += (m.hardBrakes + m.suddenAccels) * 1.5;
    // normalise mildly by distance so short drives are not over-penalised
    const score = 100 - penalty / Math.sqrt(km + 0.6);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /** Columns appended to the DataRecorder CSV (existing 14 columns untouched). */
  csvFields() {
    const s = this.summary();
    return {
      driver_active: this.state.active ? 1 : 0,
      driver_speed_kmh: Math.round(this.state.speed),
      driver_distance_m: s.distance,
      driver_on_road: this.state.onRoad ? 1 : 0,
      driver_lane_status: this.state.wrongWay ? 'wrong_way'
        : this.state.wrongLane ? 'wrong_lane'
        : this.state.offRoad ? (this.state.restricted ? 'restricted' : 'off_road')
        : this.state.laneDeparture ? 'lane_departure' : 'on_lane',
      driver_over_speed: this.state.overSpeed ? 1 : 0,
      driver_off_road_events: s.offRoadEvents,
      driver_wrong_lane_events: s.wrongLaneEvents,
      driver_wrong_way_events: s.wrongWayEvents,
      driver_lane_departures: s.laneDepartureEvents,
      driver_collisions: s.collisions,
      driver_near_misses: s.nearMisses,
      driver_red_light_violations: s.redLightViolations,
      driver_hard_brakes: s.hardBrakes,
      driver_sudden_accels: s.suddenAccels,
      driver_lane_changes: s.laneChanges,
      driver_intersections: s.intersectionsEntered,
      driver_avg_speed_kmh: s.avgSpeed,
      driver_max_speed_kmh: s.maxSpeed,
      driver_score: s.score
    };
  }
}
