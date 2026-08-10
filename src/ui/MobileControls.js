/**
 * MobileControls — large touch buttons for driving (accelerate, brake,
 * steer left/right). Uses pointer events with multi-touch support so the
 * user can steer and accelerate simultaneously.
 */
export class MobileControls {
  constructor(ui) {
    this.ui = ui;
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.state = { accel: false, brake: false, left: false, right: false };
    this._bind('tc-accel', 'accel');
    this._bind('tc-brake', 'brake');
    this._bind('tc-left', 'left');
    this._bind('tc-right', 'right');
  }

  _bind(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = e => { e.preventDefault(); this.state[key] = true; el.classList.add('pressed'); this._push(); };
    const up = e => { e.preventDefault(); this.state[key] = false; el.classList.remove('pressed'); this._push(); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }

  _push() {
    const s = this.state;
    this.ui.app.input.setTouch({
      throttle: s.accel ? 1 : (s.brake ? -1 : 0),
      steer: (s.right ? 1 : 0) - (s.left ? 1 : 0),
      handbrake: false
    });
  }
}
