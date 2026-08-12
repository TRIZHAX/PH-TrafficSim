import { VEHICLE_TYPES, SIM } from '../core/Config.js';
import { clamp } from '../core/MathUtils.js';

let vehicleSeq = 1;
export function resetVehicleIds() { vehicleSeq = 1; }

/**
 * Vehicle — a computational agent integrated with the Intelligent Driver
 * Model (IDM, Treiber et al. 2000):
 *
 *   a = a_max · [ 1 − (v / v0)^4 − (s* / s)^2 ]
 *   s* = s0 + v·T + v·Δv / (2·√(a_max·b))
 *
 * v0 (desired speed), T (time headway), s0 (min gap) and b (comfortable
 * braking) are all modulated by weather, road condition and vehicle type,
 * which is exactly how the environment couples into the mathematics.
 * Position integrates with semi-implicit Euler at a fixed Δt.
 */
export class Vehicle {
  constructor(type, lane, s, rng) {
    const spec = VEHICLE_TYPES[type];
    this.id = vehicleSeq++;
    this.type = type;
    this.spec = spec;
    this.lane = lane;
    this.s = s;                       // arc-length along lane (m)
    this.v = Math.min(spec.maxSpeed * 0.5, lane.speedLimit * 0.5);
    this.a = 0;
    // Driver heterogeneity (deterministic via seeded rng)
    const r = rng ? rng() : 0.5;
    this.aggro = 0.85 + r * 0.3;      // 0.85–1.15 desired-speed multiplier
    this.length = spec.length;
    this.width = spec.width;
    this.x = 0; this.y = 0; this.heading = 0;
    this.braking = false;
    this.waiting = 0;                 // s spent (near-)stopped — queue/delay metric
    this.totalDelay = 0;              // accumulated delay vs free flow (s)
    this.distance = 0;                // odometer (m)
    this.age = 0;
    this.isPlayer = false;
    this.done = false;
    this.turnSignal = null;
    this._laneChangeCooldown = 0;
    this.updatePose();
  }

  get maxSpeed() { return this.spec.maxSpeed; }

  /** Desired speed under current env: min(vehicle cap, lane limit) × factors. */
  desiredSpeed(env, lane = this.lane) {
    const cap = Math.min(this.spec.maxSpeed, lane.speedLimit);
    return Math.max(1.5, cap * env.speedFactor * this.aggro);
  }

  /**
   * IDM acceleration toward a leader at gap `gap` moving at `leadV`.
   * gap = Infinity ⇒ free road.
   */
  idm(env, gap, leadV) {
    const v0 = this.desiredSpeed(env);
    const T = this.spec.headway * env.headwayFactor;
    const s0 = this.spec.minGap * (env.brakingFactor > 1.2 ? 1.25 : 1);
    const aMax = this.spec.accel * env.accelFactor;
    const b = this.spec.brake / env.brakingFactor; // slippery ⇒ weaker usable braking
    const free = 1 - Math.pow(this.v / v0, 4);
    let inter = 0;
    if (gap < Infinity) {
      const dv = this.v - leadV;
      const sStar = s0 + Math.max(0, this.v * T + (this.v * dv) / (2 * Math.sqrt(aMax * b)));
      inter = Math.pow(sStar / Math.max(gap, 0.1), 2);
    }
    return clamp(aMax * (free - inter), -8.5, aMax);
  }

  /** One numerical integration step (semi-implicit Euler, fixed Δt). */
  integrate(accel, dt = SIM.dt) {
    this.a = accel;
    const vPrev = this.v;
    this.v = clamp(this.v + accel * dt, 0, this.spec.maxSpeed * 1.05);
    const ds = this.v * dt;
    this.s += ds;
    this.distance += ds;
    this.age += dt;
    this.braking = accel < -0.8;
    if (this.v < 0.5) this.waiting += dt; else this.waiting = 0;
    // Delay accrual: time lost relative to free-flow traversal of this lane
    const vFree = Math.max(1, this.lane.speedLimit * SIM.freeFlowFactor);
    this.totalDelay += Math.max(0, dt * (1 - this.v / vFree));
    if (this._laneChangeCooldown > 0) this._laneChangeCooldown -= dt;
    return vPrev;
  }

  updatePose() {
    const p = this.lane.at(this.s);
    this.x = p.x; this.y = p.y; this.heading = p.heading;
  }
}
