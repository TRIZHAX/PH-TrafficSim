import { WEATHER } from '../core/Config.js';
import { bus } from '../core/EventBus.js';

/** WeatherManager — holds the active nature condition and exposes its factors. */
export class WeatherManager {
  constructor() { this.current = 'clear'; }
  set(id) {
    if (!WEATHER[id]) return;
    this.current = id;
    bus.emit('weather:changed', this.get());
  }
  get() { return { id: this.current, ...WEATHER[this.current] }; }
}
