/** Math helpers shared across engine and renderers. */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/** Shortest signed angle difference (rad). */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Deterministic PRNG (mulberry32) so experiments are repeatable. */
export function makeRng(seed = 1337) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted(rng, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

/** Sampled polyline with arc-length lookup — the geometric backbone of every lane. */
export class Polyline {
  constructor(points) {
    this.pts = points;
    this.cum = [0];
    for (let i = 1; i < points.length; i++) {
      this.cum.push(this.cum[i - 1] + dist(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]));
    }
    this.length = this.cum[this.cum.length - 1];
  }
  /** Position + heading at arc length s. */
  at(s) {
    const { pts, cum } = this;
    if (s <= 0) { const [x, y] = pts[0]; return { x, y, heading: this.headingAt(0) }; }
    if (s >= this.length) { const [x, y] = pts[pts.length - 1]; return { x, y, heading: this.headingAt(this.length) }; }
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
    const [x1, y1] = pts[lo], [x2, y2] = pts[hi];
    return { x: lerp(x1, x2, t), y: lerp(y1, y2, t), heading: Math.atan2(y2 - y1, x2 - x1) };
  }
  headingAt(s) {
    const i = Math.max(1, Math.min(this.pts.length - 1, this.cum.findIndex(c => c >= Math.min(s, this.length)) || 1));
    const [x1, y1] = this.pts[i - 1], [x2, y2] = this.pts[i];
    return Math.atan2(y2 - y1, x2 - x1);
  }
  /** Offset a polyline sideways (for generating lane centerlines from road spines). */
  static offset(points, off) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      out.push([p[0] + (-dy / len) * off, p[1] + (dx / len) * off]);
    }
    return out;
  }
}
