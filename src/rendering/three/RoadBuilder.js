import * as THREE from 'three';
import { FlatAccum, ribbon, solidLine, rect, crosswalk, arrow } from './geometry.js';

/**
 * RoadBuilder — constructs the driveable road layer in 3D (brief §1, §8):
 * textured asphalt carriageways (clearly lighter than the terrain), white lane
 * dividers (dashed) and edge lines, yellow centre lines, stop lines,
 * pedestrian crosswalks, directional lane arrows, raised concrete curbs and
 * sidewalks, and paved intersection pads.
 *
 * Everything merges into a handful of meshes (one per material) so the entire
 * static road network is only a few draw calls. Coordinate mapping W/Z is
 * injected to match the renderer's sim→three convention.
 *
 * Exposes the built meshes and per-approach stop-line frames so the renderer
 * and the DrivingMonitor can reason about intersections.
 */

const Y = {
  asphalt: 0.02, pad: 0.03, edge: 0.05, divider: 0.05, center: 0.055,
  stop: 0.06, crosswalk: 0.058, arrow: 0.065, sidewalk: 0.10, curb: 0.17
};

export class RoadBuilder {
  constructor(materials, quality = 'high') {
    this.mat = materials;
    this.quality = quality;
    this.meshes = [];
    this.stopLines = [];   // {x,y (sim), heading, width} for renderer/monitor
  }

  /** Build the whole road layer into `scene`. */
  build(scene, net, W, Z) {
    this.net = net;
    const lw = net.laneWidth;

    const asphalt = new FlatAccum();
    const white = new FlatAccum();
    const yellow = new FlatAccum();
    const arrows = new FlatAccum();
    const zebra = new FlatAccum();
    const curbTop = new FlatAccum();
    const sidewalk = new FlatAccum();

    // signalized node set for deciding stop lines / crosswalks
    const signalNodes = new Set(net.signals.map(s => s.node));

    for (const link of net.links) {
      const spinePts = (link.spine || link.lanes[0].poly).pts;
      const n = link.lanes.length;
      const carW = n * lw;
      const half = carW / 2;

      // Asphalt carriageway centred on the lane band (offset half from spine)
      ribbon(asphalt, spinePts, carW, half, Y.asphalt, W, Z, 6);

      // Outer white edge line
      solidLine(white, spinePts, 0.16, carW - 0.12, Y.edge, W, Z);

      // Dashed white lane dividers between adjacent same-direction lanes
      for (let k = 1; k < n; k++) {
        this._offsetDashed(white, spinePts, 0.14, k * lw, Y.divider, W, Z);
      }

      // Curb + sidewalk along the outer edge (skip on low quality for perf)
      if (this.quality !== 'low') {
        solidLine(curbTop, spinePts, 0.3, carW + 0.15, Y.curb, W, Z);
        ribbon(sidewalk, spinePts, 2.4, carW + 1.4, Y.sidewalk, W, Z, 3);
      }

      // Approach markings at signal/intersection
      const toNode = net.nodes.get(link.to);
      const endSignal = link.lanes.some(l => l.signal);
      if (endSignal || (toNode && toNode.roads.length > 1)) {
        this._approachMarkings(link, white, arrows, zebra, endSignal, signalNodes, W, Z);
      }
    }

    // Yellow centre line: one per road (forward links only) to avoid doubling
    for (const link of net.links) {
      if (link.id.endsWith('_B')) continue;
      const spinePts = (link.spine || link.lanes[0].poly).pts;
      // double yellow on main roads, single otherwise
      if (link.main) {
        this._offsetSolid(yellow, spinePts, 0.14, 0.22, Y.center, W, Z);
        this._offsetSolid(yellow, spinePts, 0.14, -0.22, Y.center, W, Z);
      } else {
        solidLine(yellow, spinePts, 0.16, 0, Y.center, W, Z);
      }
    }

    // Intersection pads (paved) — a disc at each multi-road node
    const padGroup = new THREE.Group();
    for (const node of net.nodes.values()) {
      if (node.roads.length < 2) continue;
      const r = node.radius + lw * 0.5;
      const geo = new THREE.CircleGeometry(r, 22);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, this.mat.intersection);
      m.position.set(W(node.x), Y.pad, Z(node.y));
      m.receiveShadow = this.quality !== 'low';
      padGroup.add(m);
    }
    scene.add(padGroup);
    this.meshes.push(padGroup);

    // Commit merged meshes
    this._commit(scene, asphalt, this.mat.asphalt, true, 'asphalt');
    this._commit(scene, sidewalk, this.mat.sidewalk, true);
    this._commit(scene, curbTop, this.mat.curb, false);
    this._commit(scene, white, this.mat.lineWhite, false);
    this._commit(scene, yellow, this.mat.lineYellow, false);
    this._commit(scene, zebra, this.mat.crosswalk, false);
    this._commit(scene, arrows, this.mat.arrow, false);

    return { asphaltMesh: this._asphaltMesh, stopLines: this.stopLines };
  }

  /* offset a solid line whose lateral position is `off` from spine */
  _offsetSolid(accum, pts, w, off, y, W, Z) { solidLine(accum, pts, w, off, y, W, Z); }

  /* dashed line at lateral offset `off` from spine, following spine geometry */
  _offsetDashed(accum, pts, w, off, y, W, Z) {
    // build a temporary polyline offset by `off` then dash along it
    const off1 = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
      const dx = c[0] - a[0], dy = c[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      off1.push([pts[i][0] + (-dy / len) * off, pts[i][1] + (dx / len) * off]);
    }
    // simple manual dashing along off1
    const hw = w / 2;
    let carry = 0, draw = true, acc = 0;
    for (let i = 1; i < off1.length; i++) {
      const p0 = off1[i - 1], p1 = off1[i];
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      const seg = Math.hypot(dx, dy) || 1;
      const nx = -dy / seg, ny = dx / seg;
      // subdivide segment into small steps toggling dash/gap (3m dash, 5m gap)
      let s = 0;
      while (s < seg) {
        const step = Math.min(seg - s, (draw ? 3 : 5) - carry);
        if (draw) {
          const ax = p0[0] + (dx / seg) * s, ay = p0[1] + (dy / seg) * s;
          const bx = p0[0] + (dx / seg) * (s + step), by = p0[1] + (dy / seg) * (s + step);
          accum.quad(
            [W(ax - nx * hw), Z(ay - ny * hw)], [W(ax + nx * hw), Z(ay + ny * hw)],
            [W(bx + nx * hw), Z(by + ny * hw)], [W(bx - nx * hw), Z(by - ny * hw)], y
          );
        }
        carry += step; s += step;
        if (carry >= (draw ? 3 : 5) - 1e-6) { carry = 0; draw = !draw; }
      }
    }
    void carry; void acc;
  }

  /* stop line, crosswalk and lane arrows near the downstream node of a link */
  _approachMarkings(link, white, arrows, zebra, endSignal, signalNodes, W, Z) {
    const lw = this.net.laneWidth;
    const n = link.lanes.length;
    const carW = n * lw;
    const lane0 = link.lanes[0].poly;
    const L = link.length;

    // Stop line across the carriageway near the end
    const sStop = Math.max(0, L - 1.5);
    const p = link.spine ? link.spine.at(sStop) : lane0.at(sStop);
    // white bar spanning carriageway (offset half from spine)
    this._barAcross(white, p, carW, 0.6, carW / 2, Y.stop, W, Z);
    this.stopLines.push({ x: p.x, y: p.y, heading: p.heading, width: carW, node: link.to });

    // Crosswalk just upstream of the stop line (only at signalized nodes)
    if (endSignal && signalNodes.has(link.to)) {
      const pc = link.spine ? link.spine.at(Math.max(0, L - 4.2)) : lane0.at(Math.max(0, L - 4.2));
      // crosswalk centred over the carriageway centre
      const cx = pc.x + Math.cos(pc.heading + Math.PI / 2) * (carW / 2);
      const cy = pc.y + Math.sin(pc.heading + Math.PI / 2) * (carW / 2);
      crosswalk(zebra, cx, cy, pc.heading, carW + 0.4, 3.0, Y.crosswalk, W, Z, Math.max(4, Math.round(carW)));
    }

    // Directional arrows in each lane based on available connector turns
    for (let i = 0; i < n; i++) {
      const lane = link.lanes[i];
      const turns = new Set((lane.next || []).map(c => c.turn));
      let type = 'straight';
      if (turns.size > 1) type = 'straight';
      else if (turns.has('left')) type = 'left';
      else if (turns.has('right')) type = 'right';
      else if (turns.has('straight')) type = 'straight';
      const sA = Math.max(2, lane.length - 9);
      const pa = lane.at(sA);
      arrow(arrows, pa.x, pa.y, pa.heading, type, Y.arrow, W, Z, Math.min(4.5, lw * 1.3));
    }
  }

  /* a bar across the road centred at frame p, offset laterally by `off` */
  _barAcross(accum, p, span, depth, off, y, W, Z) {
    const nx = Math.cos(p.heading + Math.PI / 2), ny = Math.sin(p.heading + Math.PI / 2);
    const cx = p.x + nx * off, cy = p.y + ny * off;
    // bar: length `depth` along heading, width `span` across
    rect(accum, cx, cy, p.heading, depth, span, y, W, Z);
  }

  _commit(scene, accum, material, receiveShadow, tag) {
    if (accum.isEmpty()) return;
    const geo = accum.build();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = receiveShadow && this.quality !== 'low';
    scene.add(mesh);
    this.meshes.push(mesh);
    if (tag === 'asphalt') this._asphaltMesh = mesh;
  }

  /** Swap asphalt look for damaged/severe road conditions (brief §10). */
  setDamaged(damaged) {
    if (this._asphaltMesh) this._asphaltMesh.material = damaged ? this.mat.asphaltDamaged : this.mat.asphalt;
  }

  dispose(scene) {
    for (const m of this.meshes) {
      scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.traverse) m.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    this.meshes = [];
    this.stopLines = [];
  }
}
