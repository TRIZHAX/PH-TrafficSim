import { SIGNAL_DEFAULTS, SIGNAL_LIMITS } from '../core/Config.js';
import { clamp } from '../core/MathUtils.js';

/**
 * TrafficLightManager — two-phase fixed-time signal controller per node.
 * Phase 0 serves ~E-W approaches, phase 1 serves ~N-S. Cycle:
 *   [P0 green][P0 yellow][all-red 1s][P1 green][P1 yellow][all-red 1s]
 * Timing (green/yellow/red) is user-configurable within Config limits.
 * A 'signalFail' incident turns a node to flashing (treated as unsignalized).
 */
export class TrafficLightManager {
  constructor(network) {
    this.network = network;
    this.controllers = new Map();
    for (const sig of network.signals) {
      this.controllers.set(sig.node, {
        node: sig.node, x: sig.x, y: sig.y,
        green: sig.timing.green ?? SIGNAL_DEFAULTS.green,
        yellow: sig.timing.yellow ?? SIGNAL_DEFAULTS.yellow,
        red: sig.timing.red ?? SIGNAL_DEFAULTS.red,
        t: 0, failed: false,
        approaches: sig.approaches
      });
    }
  }

  /** Set timing on all (or one) controller, clamped to configured limits. */
  setTiming({ green, yellow, red }, node = null) {
    for (const c of this.controllers.values()) {
      if (node && c.node !== node) continue;
      if (green != null) c.green = clamp(green, ...SIGNAL_LIMITS.green);
      if (yellow != null) c.yellow = clamp(yellow, ...SIGNAL_LIMITS.yellow);
      if (red != null) c.red = clamp(red, ...SIGNAL_LIMITS.red);
    }
  }

  getTiming() {
    const first = this.controllers.values().next().value;
    return first ? { green: first.green, yellow: first.yellow, red: first.red } : { ...SIGNAL_DEFAULTS };
  }

  setFailed(node, failed) { const c = this.controllers.get(node); if (c) c.failed = failed; }

  step(dt) { for (const c of this.controllers.values()) c.t += dt; }

  /**
   * Phase state for approach phase p at a node: 'green' | 'yellow' | 'red' | 'flash'.
   * The opposing phase's green time uses this controller's `red` setting so the
   * user's red duration is honored (red for P0 = green+yellow of P1).
   */
  stateFor(node, phase) {
    const c = this.controllers.get(node);
    if (!c) return 'green';
    if (c.failed) return 'flash';
    const AR = 1; // all-red clearance
    const g0 = c.green, y = c.yellow, g1 = c.red;
    const cycle = g0 + y + AR + g1 + y + AR;
    const t = c.t % cycle;
    let s;
    if (t < g0) s = phase === 0 ? 'green' : 'red';
    else if (t < g0 + y) s = phase === 0 ? 'yellow' : 'red';
    else if (t < g0 + y + AR) s = 'red';
    else if (t < g0 + y + AR + g1) s = phase === 1 ? 'green' : 'red';
    else if (t < g0 + y + AR + g1 + y) s = phase === 1 ? 'yellow' : 'red';
    else s = 'red';
    return s;
  }

  /** Snapshot for renderers: per node, state of each phase. */
  snapshot() {
    const out = [];
    for (const c of this.controllers.values()) {
      out.push({
        node: c.node, x: c.x, y: c.y, failed: c.failed,
        phase0: this.stateFor(c.node, 0),
        phase1: this.stateFor(c.node, 1),
        approaches: c.approaches
      });
    }
    return out;
  }

  reset() { for (const c of this.controllers.values()) { c.t = 0; c.failed = false; } }
}
