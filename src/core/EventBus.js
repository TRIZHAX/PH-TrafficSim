/** Minimal pub/sub event bus decoupling engine, renderers and UI. */
export class EventBus {
  constructor() { this.listeners = new Map(); }
  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) { this.listeners.get(event)?.delete(fn); }
  emit(event, payload) {
    this.listeners.get(event)?.forEach(fn => { try { fn(payload); } catch (e) { console.error(`[EventBus:${event}]`, e); } });
  }
}
export const bus = new EventBus();
