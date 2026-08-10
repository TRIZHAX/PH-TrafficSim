import { SIM } from './Config.js';

/**
 * Fixed-timestep simulation clock with adjustable speed multiplier.
 * Numerical integration always uses the same Δt regardless of frame rate,
 * so results are reproducible at 1×, 2×, 5× and 10×.
 */
export class SimulationClock {
  constructor() {
    this.simTime = 0;        // accumulated simulated seconds
    this.speed = 1;          // 0 (paused), 1, 2, 5, 10
    this.paused = false;
    this._acc = 0;
  }

  /** Convert real elapsed seconds into a number of fixed steps to run. */
  steps(realDt) {
    if (this.paused || this.speed === 0) return 0;
    this._acc += Math.min(realDt, 0.25) * this.speed;
    let n = 0;
    while (this._acc >= SIM.dt && n < SIM.maxSubSteps * this.speed) {
      this._acc -= SIM.dt; n++;
    }
    if (this._acc > SIM.dt * 4) this._acc = 0; // drop backlog on slow devices
    return n;
  }

  advance() { this.simTime += SIM.dt; }
  reset() { this.simTime = 0; this._acc = 0; }
}
