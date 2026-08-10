import { clamp, lerp } from '../core/MathUtils.js';

/**
 * Camera2D — pan/zoom camera for the top-down view.
 * Supports mouse drag, wheel zoom, touch drag + pinch, and follow mode
 * (locks onto the player vehicle while driving).
 */
export class Camera2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 500; this.y = 450;
    this.zoom = 0.8;         // px per meter
    this.minZoom = 0.15; this.maxZoom = 6;
    this.follow = null;
    this._drag = null;
    this._pinch = null;
    this._bind();
  }

  fit(bounds, pad = 80) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const bw = bounds.maxX - bounds.minX + pad * 2, bh = bounds.maxY - bounds.minY + pad * 2;
    this.zoom = clamp(Math.min(w / bw, h / bh), this.minZoom, this.maxZoom);
    this.x = (bounds.minX + bounds.maxX) / 2;
    this.y = (bounds.minY + bounds.maxY) / 2;
    this.follow = null;
  }

  worldToScreen(wx, wy) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    return [(wx - this.x) * this.zoom + w / 2, (wy - this.y) * this.zoom + h / 2];
  }

  screenToWorld(sx, sy) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    return [(sx - w / 2) / this.zoom + this.x, (sy - h / 2) / this.zoom + this.y];
  }

  update(dt) {
    if (this.follow) {
      const t = 1 - Math.pow(0.001, dt);
      this.x = lerp(this.x, this.follow.x, t);
      this.y = lerp(this.y, this.follow.y, t);
    }
  }

  _bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') return; // touch handled below
      this._drag = { sx: e.clientX, sy: e.clientY, cx: this.x, cy: this.y };
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', e => {
      if (!this._drag) return;
      this.follow = null;
      this.x = this._drag.cx - (e.clientX - this._drag.sx) / this.zoom;
      this.y = this._drag.cy - (e.clientY - this._drag.sy) / this.zoom;
    });
    c.addEventListener('pointerup', () => (this._drag = null));
    c.addEventListener('wheel', e => {
      e.preventDefault();
      const [wx, wy] = this.screenToWorld(e.offsetX, e.offsetY);
      const f = Math.pow(1.0015, -e.deltaY);
      this.zoom = clamp(this.zoom * f, this.minZoom, this.maxZoom);
      const [nx, ny] = this.screenToWorld(e.offsetX, e.offsetY);
      this.x += wx - nx; this.y += wy - ny;
    }, { passive: false });

    // Touch: one finger pan, two finger pinch zoom
    let touches = new Map();
    c.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        this._pinch = { d: Math.hypot(b.x - a.x, b.y - a.y), zoom: this.zoom };
      }
    }, { passive: true });
    c.addEventListener('touchmove', e => {
      e.preventDefault();
      if (touches.size === 1 && e.touches.length === 1) {
        const t = e.touches[0];
        const prev = touches.get(t.identifier);
        if (prev) {
          this.follow = null;
          this.x -= (t.clientX - prev.x) / this.zoom;
          this.y -= (t.clientY - prev.y) / this.zoom;
          touches.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      } else if (e.touches.length === 2 && this._pinch) {
        const a = e.touches[0], b = e.touches[1];
        const d = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        this.zoom = clamp(this._pinch.zoom * (d / this._pinch.d), this.minZoom, this.maxZoom);
      }
    }, { passive: false });
    const endTouch = e => { for (const t of e.changedTouches) touches.delete(t.identifier); if (touches.size < 2) this._pinch = null; };
    c.addEventListener('touchend', endTouch);
    c.addEventListener('touchcancel', endTouch);
  }
}
