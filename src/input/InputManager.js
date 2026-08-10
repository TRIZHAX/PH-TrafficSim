import { bus } from '../core/EventBus.js';

/**
 * InputManager — unified keyboard + touch driving input.
 * Produces { throttle: -1..1, steer: -1..1, handbrake } every frame.
 * Key bindings are customizable (Settings → Driving Controls).
 */
export class InputManager {
  constructor(settings) {
    this.settings = settings;
    this.keys = new Set();
    this.touch = { throttle: 0, steer: 0, handbrake: false };
    this.enabled = true;

    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      this.keys.add(e.code);
      const k = this.settings.keys;
      if (e.code === k.camera) bus.emit('input:camera');
      if (e.code === k.pause) bus.emit('input:pause');
      if (e.code === 'Escape') bus.emit('input:menu');
      if ([k.accel, k.brake, k.left, k.right, k.handbrake, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Set touch control state (from MobileControls). */
  setTouch(partial) { Object.assign(this.touch, partial); }

  read() {
    if (!this.enabled) return { throttle: 0, steer: 0, handbrake: false };
    const k = this.settings.keys;
    let throttle = 0, steer = 0;
    if (this.keys.has(k.accel) || this.keys.has('ArrowUp')) throttle += 1;
    if (this.keys.has(k.brake) || this.keys.has('ArrowDown')) throttle -= 1;
    if (this.keys.has(k.left) || this.keys.has('ArrowLeft')) steer -= 1;
    if (this.keys.has(k.right) || this.keys.has('ArrowRight')) steer += 1;
    const handbrake = this.keys.has(k.handbrake);
    // merge with touch
    throttle = Math.abs(this.touch.throttle) > Math.abs(throttle) ? this.touch.throttle : throttle;
    steer = Math.abs(this.touch.steer) > Math.abs(steer) ? this.touch.steer : steer;
    return { throttle, steer, handbrake: handbrake || this.touch.handbrake };
  }
}
