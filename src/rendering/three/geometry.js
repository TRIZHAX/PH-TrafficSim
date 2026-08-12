import * as THREE from 'three';

/**
 * geometry.js — flat-geometry builders for the 3D road layer.
 * All output lies in the XZ plane (normals +Y) so markings, ribbons, arrows,
 * crosswalks and stop lines can be merged into a handful of draw calls.
 *
 * Coordinate mapping is injected as W(simX)→worldX and Z(simY)→worldZ, matching
 * the renderer's sim→three convention (three.x = simx-cx, three.z = simy-cz).
 */

/** Accumulates flat quads/ribbons and produces one BufferGeometry. */
export class FlatAccum {
  constructor() { this.pos = []; this.uv = []; this.idx = []; this.n = 0; }

  /** Add a quad from four world points (each [x,z]); winding CCW when viewed from +Y. */
  quad(a, b, c, d, y, uv) {
    const base = this.n;
    this.pos.push(a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], d[0], y, d[1]);
    if (uv) this.uv.push(...uv);
    else this.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.n += 4;
  }

  isEmpty() { return this.n === 0; }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

/** Per-point tangent/normal frames along a sim polyline (array of [x,y]). */
function frames(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
    const dx = c[0] - a[0], dy = c[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    out.push({ x: pts[i][0], y: pts[i][1], tx: dx / len, ty: dy / len, nx: -dy / len, ny: dx / len });
  }
  return out;
}

/**
 * Ribbon along `pts` with a constant `width`, laterally shifted by `off`.
 * Writes into accum with UVs tiled every `uvEvery` metres along length.
 */
export function ribbon(accum, pts, width, off, y, W, Z, uvEvery = 6) {
  const f = frames(pts);
  const hw = width / 2;
  let run = 0;
  for (let i = 1; i < f.length; i++) {
    const p0 = f[i - 1], p1 = f[i];
    const seg = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const a = [W(p0.x + p0.nx * (off - hw)), Z(p0.y + p0.ny * (off - hw))];
    const b = [W(p0.x + p0.nx * (off + hw)), Z(p0.y + p0.ny * (off + hw))];
    const c = [W(p1.x + p1.nx * (off + hw)), Z(p1.y + p1.ny * (off + hw))];
    const d = [W(p1.x + p1.nx * (off - hw)), Z(p1.y + p1.ny * (off - hw))];
    const v0 = run / uvEvery, v1 = (run + seg) / uvEvery;
    accum.quad(a, b, c, d, y, [0, v0, 1, v0, 1, v1, 0, v1]);
    run += seg;
  }
}

/** Continuous thin line strip offset laterally (solid lane edge / centre line). */
export function solidLine(accum, pts, lineW, off, y, W, Z) {
  ribbon(accum, pts, lineW, off, y, W, Z, 1);
}

/** Dashed line: dash/gap in metres, offset laterally. */
export function dashedLine(accum, poly, lineW, off, y, W, Z, dash = 3, gap = 4) {
  const L = poly.length;
  const hw = lineW / 2;
  let s = 0;
  while (s < L) {
    const e = Math.min(L, s + dash);
    const p0 = poly.at(s), p1 = poly.at(e);
    const nx0 = -Math.sin(p0.heading), ny0 = Math.cos(p0.heading);
    const nx1 = -Math.sin(p1.heading), ny1 = Math.cos(p1.heading);
    // lateral offset applied via normal (heading normal = (-sin,cos))
    const ox0 = p0.x + nx0 * off, oy0 = p0.y + ny0 * off;
    const ox1 = p1.x + nx1 * off, oy1 = p1.y + ny1 * off;
    accum.quad(
      [W(ox0 - nx0 * hw), Z(oy0 - ny0 * hw)],
      [W(ox0 + nx0 * hw), Z(oy0 + ny0 * hw)],
      [W(ox1 + nx1 * hw), Z(oy1 + ny1 * hw)],
      [W(ox1 - nx1 * hw), Z(oy1 - ny1 * hw)],
      y
    );
    s += dash + gap;
  }
}

/** A single rectangle centred at sim (cx,cy) with heading, length (along heading) × width. */
export function rect(accum, cx, cy, heading, length, width, y, W, Z) {
  const tx = Math.cos(heading), ty = Math.sin(heading);
  const nx = -ty, ny = tx;
  const hl = length / 2, hw = width / 2;
  const corner = (sl, sw) => [W(cx + tx * hl * sl + nx * hw * sw), Z(cy + ty * hl * sl + ny * hw * sw)];
  accum.quad(corner(-1, -1), corner(-1, 1), corner(1, 1), corner(1, -1), y);
}

/**
 * Crosswalk (zebra) across a road: `stripes` bars perpendicular to heading,
 * spanning `span` metres wide, centred at sim (cx,cy).
 */
export function crosswalk(accum, cx, cy, heading, span, depth, y, W, Z, stripes = 6) {
  const tx = Math.cos(heading), ty = Math.sin(heading); // along road
  const nx = -ty, ny = tx;                               // across road
  const barW = depth / (stripes * 2 - 1);
  for (let i = 0; i < stripes; i++) {
    const along = -depth / 2 + i * barW * 2 + barW / 2;
    const bx = cx + tx * along, by = cy + ty * along;
    // bar spans across the road (width = span), thickness barW along heading
    const hl = barW / 2, hw = span / 2;
    const corner = (sl, sw) => [W(bx + tx * hl * sl + nx * hw * sw), Z(by + ty * hl * sl + ny * hw * sw)];
    accum.quad(corner(-1, -1), corner(-1, 1), corner(1, 1), corner(1, -1), y);
  }
}

/**
 * Road arrow (straight / left / right / uturn) drawn flat, centred at sim
 * (cx,cy) pointing along `heading`. Returns triangles into accum.
 * `scale` roughly sets overall length in metres.
 */
export function arrow(accum, cx, cy, heading, type, y, W, Z, scale = 4) {
  const tx = Math.cos(heading), ty = Math.sin(heading);
  const nx = -ty, ny = tx;
  // local (forward, lateral) → world helper
  const P = (fwd, lat) => [W(cx + tx * fwd + nx * lat), Z(cy + ty * fwd + ny * lat)];
  const shaftW = scale * 0.16;
  const headW = scale * 0.42;
  const headL = scale * 0.42;
  const half = scale / 2;

  // shaft as a rectangle (from -half to half-headL)
  const shaftTip = half - headL;
  accum.quad(P(-half, -shaftW), P(-half, shaftW), P(shaftTip, shaftW), P(shaftTip, -shaftW), y);

  if (type === 'left' || type === 'right') {
    const dir = type === 'left' ? 1 : -1; // +lateral is left of heading (nx = -sin)
    // bend: add a lateral shaft then arrowhead pointing sideways
    const bendFwd = shaftTip;
    const latEnd = dir * scale * 0.5;
    // lateral bar
    accum.quad(P(bendFwd - shaftW, 0), P(bendFwd + shaftW, 0), P(bendFwd + shaftW, latEnd), P(bendFwd - shaftW, latEnd), y);
    // sideways head (triangle)
    const tipLat = latEnd + dir * headL;
    triangle(accum, P(bendFwd - headW / 2, latEnd), P(bendFwd + headW / 2, latEnd), P(bendFwd, tipLat), y);
    return;
  }
  if (type === 'uturn') {
    const dir = 1;
    // vertical up shaft already drawn; add a semicircle-ish bend as two quads then a down shaft
    const topFwd = shaftTip;
    const latEnd = dir * scale * 0.34;
    accum.quad(P(topFwd - shaftW, 0), P(topFwd + shaftW, 0), P(topFwd + shaftW, latEnd), P(topFwd - shaftW, latEnd), y);
    // down shaft
    accum.quad(P(-half + shaftW * 2, latEnd - shaftW), P(topFwd, latEnd - shaftW), P(topFwd, latEnd + shaftW), P(-half + shaftW * 2, latEnd + shaftW), y);
    // head pointing back (down along -forward)
    triangle(accum, P(-half + shaftW * 2, latEnd - headW / 2), P(-half + shaftW * 2, latEnd + headW / 2), P(-half - headL + shaftW * 2, latEnd), y);
    return;
  }
  // straight arrowhead (triangle) pointing forward
  triangle(accum, P(shaftTip, -headW / 2), P(shaftTip, headW / 2), P(half, 0), y);
}

/** Add a single triangle (three world [x,z] points). */
export function triangle(accum, a, b, c, y) {
  const base = accum.n;
  accum.pos.push(a[0], y, a[1], b[0], y, b[1], c[0], y, c[1]);
  accum.uv.push(0, 0, 1, 0, 0.5, 1);
  accum.idx.push(base, base + 1, base + 2);
  accum.n += 3;
}
