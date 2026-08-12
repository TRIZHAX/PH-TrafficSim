import { ROAD_CONDITIONS } from '../core/Config.js';
import { bus } from '../core/EventBus.js';

/**
 * RoadConditionManager — global surface condition + per-road quality (%).
 * Quality maps continuously onto speed/accel/capacity factors:
 *   100% good · 80% minor damage · 60% damaged · 40% severe.
 */
export class RoadConditionManager {
  constructor() {
    this.condition = 'good';
    this.quality = 100; // %
  }
  set(id) {
    if (!ROAD_CONDITIONS[id]) return;
    this.condition = id;
    this.quality = { good: 100, wet: 100, damaged: 60, severe: 40 }[id];
    bus.emit('road:changed', this.get());
  }
  setQuality(q) {
    this.quality = Math.max(20, Math.min(100, q));
    if (this.condition === 'damaged' || this.condition === 'severe' || this.condition === 'good') {
      this.condition = this.quality >= 90 ? 'good' : this.quality >= 50 ? 'damaged' : 'severe';
    }
    bus.emit('road:changed', this.get());
  }
  get() {
    const base = ROAD_CONDITIONS[this.condition];
    // blend the discrete condition with continuous quality
    const q = this.quality / 100;
    const qSpeed = 0.35 + 0.65 * q;
    return {
      id: this.condition, ...base,
      quality: this.quality,
      speedFactor: Math.min(base.speedFactor, qSpeed),
      accelFactor: Math.min(base.accelFactor, 0.5 + 0.5 * q),
      capacityFactor: Math.min(base.capacityFactor, 0.4 + 0.6 * q)
    };
  }
}
