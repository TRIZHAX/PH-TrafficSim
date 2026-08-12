import { VEHICLE_TYPES, SIM } from '../core/Config.js';
import { clamp } from '../core/MathUtils.js';

/**
 * PlayerVehicle — kinematic bicycle model driven by user input.
 * Unlike AI vehicles it moves freely in x/y, but it still lives inside the
 * computational model: weather scales grip and top speed, road condition
 * scales acceleration, and AI vehicles perceive it as an obstacle.
 */
export class PlayerVehicle {
  constructor(type = 'car') {
    this.setType(type);
    this.id = 'PLAYER';
    this.isPlayer = true;
    this.x = 0; this.y = 0;
    this.heading = 0;
    this.v = 0;
    this.steer = 0;
    this.braking = false;
    this.active = false;
    this.distance = 0;
    this.crashCooldown = 0;
  }

  setType(type) {
    this.type = type;
    this.spec = VEHICLE_TYPES[type];
    this.length = this.spec.length;
    this.width = this.spec.width;
    this.wheelbase = this.length * 0.6;
  }

  placeAt(x, y, heading) {
    this.x = x; this.y = y; this.heading = heading;
    this.v = 0; this.steer = 0; this.active = true;
  }

  /**
   * input: { throttle: -1..1, steer: -1..1, handbrake: bool }
   * env:   effective environment factors from WeatherManager/RoadConditionManager
   */
  step(input, env, dt = SIM.dt) {
    if (!this.active) return;
    const grip = 1 / env.brakingFactor;                       // wet ⇒ less grip
    const vMax = this.spec.maxSpeed * env.speedFactor * 1.1;
    const aFwd = this.spec.accel * env.accelFactor * 1.35;
    const aBrk = this.spec.brake * grip * 1.4;

    let a = 0;
    if (input.throttle > 0) a = aFwd * input.throttle;
    else if (input.throttle < 0) a = (this.v > 0.4 ? -aBrk : -aFwd * 0.5) * -input.throttle * (this.v > 0.4 ? 1 : -1);
    if (input.handbrake) a = this.v > 0 ? -aBrk * 1.3 : 0;
    // rolling resistance
    a -= Math.sign(this.v) * (0.35 + 0.012 * this.v * this.v * (env.windDrag || 0));

    this.v = clamp(this.v + a * dt, -vMax * 0.3, vMax);
    if (Math.abs(this.v) < 0.05 && input.throttle === 0) this.v = 0;
    this.braking = input.handbrake || input.throttle < 0;

    // Steering — angle limited by speed (harder to turn sharply when fast)
    const maxSteer = 0.55 / (1 + Math.abs(this.v) * 0.045);
    const target = input.steer * maxSteer;
    this.steer += clamp(target - this.steer, -3.2 * dt, 3.2 * dt);
    if (Math.abs(this.v) > 0.05) {
      const omega = (this.v / this.wheelbase) * Math.tan(this.steer) * grip;
      this.heading += omega * dt;
    }
    const ds = this.v * dt;
    this.x += Math.cos(this.heading) * ds;
    this.y += Math.sin(this.heading) * ds;
    this.distance += Math.abs(ds);
    if (this.crashCooldown > 0) this.crashCooldown -= dt;
  }
}
