import { Polyline, dist } from '../core/MathUtils.js';
import { SIM } from '../core/Config.js';

let laneSeq = 0;

/** A single directed lane. Vehicles move along it by arc length `s`. */
export class Lane {
  constructor(poly, opts = {}) {
    this.id = `L${laneSeq++}`;
    this.poly = poly;
    this.length = poly.length;
    this.link = opts.link || null;       // parent Link (null for connectors)
    this.index = opts.index ?? 0;        // lane index within link (0 = innermost)
    this.kind = opts.kind || 'normal';   // 'normal' | 'connector'
    this.speedLimit = opts.speedLimit || SIM.defaultSpeedLimit;
    this.next = [];                      // lanes reachable when this one ends
    this.left = null; this.right = null; // adjacent lanes in same link
    this.vehicles = [];                  // sorted by s ascending each step
    this.signal = null;                  // { node, phase } if end is signal-controlled
    this.endNode = opts.endNode || null;
    this.startNode = opts.startNode || null;
    this.blockedFrom = Infinity;         // incident blockage position (m); Infinity = open
    this.conflicts = [];                 // conflicting connectors (unsignalized yield)
    this.turn = opts.turn || 'straight';
  }
  at(s) { return this.poly.at(s); }
}

/** A directed carriageway of a road between two nodes (1..n lanes). */
export class Link {
  constructor(id, road, from, to, lanes) {
    this.id = id;
    this.roadId = road.id;
    this.name = road.name;
    this.main = !!road.main;
    this.from = from; this.to = to;
    this.lanes = lanes;
    this.length = lanes[0]?.length || 0;
    lanes.forEach((l, i) => {
      l.link = this; l.index = i;
      l.left = lanes[i - 1] || null;
      l.right = lanes[i + 1] || null;
    });
  }
}

function resample(poly, s0, s1, step = 3) {
  const pts = [];
  const n = Math.max(2, Math.ceil((s1 - s0) / step));
  for (let i = 0; i <= n; i++) {
    const p = poly.at(s0 + ((s1 - s0) * i) / n);
    pts.push([p.x, p.y]);
  }
  return new Polyline(pts);
}

function bezier(p0, h0, p1, h1) {
  const d = Math.max(4, dist(p0.x, p0.y, p1.x, p1.y) / 2.4);
  const c0 = { x: p0.x + Math.cos(h0) * d, y: p0.y + Math.sin(h0) * d };
  const c1 = { x: p1.x - Math.cos(h1) * d, y: p1.y - Math.sin(h1) * d };
  const pts = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([
      u * u * u * p0.x + 3 * u * u * t * c0.x + 3 * u * t * t * c1.x + t * t * t * p1.x,
      u * u * u * p0.y + 3 * u * u * t * c0.y + 3 * u * t * t * c1.y + t * t * t * p1.y
    ]);
  }
  return new Polyline(pts);
}

function segsIntersect(a, b, c, d) {
  const ccw = (p, q, r) => (r[1] - p[1]) * (q[0] - p[0]) - (q[1] - p[1]) * (r[0] - p[0]);
  return ccw(a, c, d) * ccw(b, c, d) < 0 && ccw(c, a, b) * ccw(d, a, b) < 0;
}

function polysCross(p1, p2) {
  for (let i = 1; i < p1.pts.length; i++)
    for (let j = 1; j < p2.pts.length; j++)
      if (segsIntersect(p1.pts[i - 1], p1.pts[i], p2.pts[j - 1], p2.pts[j])) return true;
  return false;
}

/**
 * RoadNetwork — builds the runnable lane graph from a declarative map definition.
 * Map defs contain nodes, roads (with lane counts + speed limits), signals,
 * landmarks and decorations; the network derives lane centerlines, intersection
 * connectors, signal phases and conflict sets.
 */
export class RoadNetwork {
  constructor(def) {
    laneSeq = 0;
    this.def = def;
    this.laneWidth = def.laneWidth || 3.2;
    this.nodes = new Map();
    this.links = [];
    this.lanes = [];
    this.connectors = [];
    this.signals = [];      // [{ node, x, y, approaches: [{linkId, phase, heading}] }]
    this.entryLanes = [];
    this.bounds = { minX: 1e9, minY: 1e9, maxX: -1e9, maxY: -1e9 };
    this._build();
  }

  _build() {
    const def = this.def;
    for (const n of def.nodes) {
      this.nodes.set(n.id, { ...n, roads: [], inLinks: [], outLinks: [], radius: 0 });
      this._grow(n.x, n.y);
    }
    for (const road of def.roads) this.nodes.get(road.from).roads.push(road), this.nodes.get(road.to).roads.push(road);

    // Intersection setback radius per node
    for (const node of this.nodes.values()) {
      let r = 0;
      for (const rd of node.roads) {
        const w = ((rd.lanesF ?? 1) + (rd.lanesB ?? 1)) * this.laneWidth;
        r = Math.max(r, w / 2 + 3.5);
      }
      node.radius = node.roads.length > 1 ? r : 0;
    }

    // Build directed links with offset lane centerlines
    for (const road of def.roads) {
      const a = this.nodes.get(road.from), b = this.nodes.get(road.to);
      const pts = [[a.x, a.y], ...(road.via || []), [b.x, b.y]];
      pts.forEach(p => this._grow(p[0], p[1]));
      const limit = (road.speedLimit || 40) / 3.6;
      this._makeLink(road, pts, a, b, road.lanesF ?? 1, limit, 'F');
      this._makeLink(road, [...pts].reverse(), b, a, road.lanesB ?? 1, limit, 'B');
    }

    // Signals — group approaches into 2 phases by heading (E-W vs N-S)
    const signalDefs = def.signals || [];
    for (const sd of signalDefs) {
      const node = this.nodes.get(sd.node);
      if (!node) continue;
      const approaches = node.inLinks.map(link => {
        const lane = link.lanes[0];
        const h = lane.poly.headingAt(lane.length - 0.5);
        const phase = Math.abs(Math.cos(h)) >= Math.abs(Math.sin(h)) ? 0 : 1;
        return { linkId: link.id, phase, heading: h };
      });
      const sig = { node: sd.node, x: node.x, y: node.y, approaches, timing: { ...sd } };
      this.signals.push(sig);
      for (const link of node.inLinks) {
        const app = approaches.find(a => a.linkId === link.id);
        for (const lane of link.lanes) lane.signal = { node: sd.node, phase: app.phase };
      }
    }

    // Connectors across every internal node
    for (const node of this.nodes.values()) {
      if (node.roads.length < 2) continue;
      for (const inLink of node.inLinks) {
        for (const outLink of node.outLinks) {
          if (outLink.roadId === inLink.roadId && outLink.to === inLink.from) continue; // no U-turn
          const nIn = inLink.lanes.length, nOut = outLink.lanes.length;
          for (let i = 0; i < nIn; i++) {
            const from = inLink.lanes[i];
            const to = outLink.lanes[Math.min(i, nOut - 1)];
            const p0 = from.at(from.length), p1 = to.at(0);
            const poly = bezier(p0, p0.heading, p1, p1.heading);
            const c = new Lane(poly, {
              kind: 'connector',
              speedLimit: Math.min(from.speedLimit, to.speedLimit, 30 / 3.6),
              startNode: node.id, endNode: node.id
            });
            let dh = p1.heading - p0.heading;
            while (dh > Math.PI) dh -= 2 * Math.PI;
            while (dh < -Math.PI) dh += 2 * Math.PI;
            c.turn = Math.abs(dh) < 0.35 ? 'straight' : dh > 0 ? 'right' : 'left';
            c.next = [to];
            c._fromLink = inLink; c._node = node.id;
            from.next.push(c);
            this.connectors.push(c);
          }
        }
      }
      // conflict sets (unsignalized yield + left-turn yield)
      const nodeConns = this.connectors.filter(c => c._node === node.id);
      for (const c of nodeConns) {
        for (const o of nodeConns) {
          if (o === c || o._fromLink === c._fromLink) continue;
          if (polysCross(c.poly, o.poly)) c.conflicts.push(o);
        }
      }
    }

    this.lanes = [...this.links.flatMap(l => l.lanes), ...this.connectors];
    this.entryLanes = this.links.filter(l => this.nodes.get(l.from).roads.length === 1).flatMap(l => l.lanes);
    this.mainLinks = this.links.filter(l => l.main);
    // total lane-length for density calcs
    this.totalLaneLength = this.links.reduce((s, l) => s + l.length * l.lanes.length, 0);
  }

  _makeLink(road, pts, from, to, laneCount, limit, dir) {
    if (laneCount <= 0) return;
    const spine = new Polyline(pts);
    const t0 = from.radius ? from.radius + 2 : 0;
    const t1 = to.radius ? to.radius + 2 : 0;
    if (spine.length - t0 - t1 < 8) return;
    const lanes = [];
    for (let i = 0; i < laneCount; i++) {
      const off = (i + 0.5) * this.laneWidth;
      const offPts = Polyline.offset(pts, off);
      const offPoly = new Polyline(offPts);
      const lane = new Lane(resample(offPoly, t0, offPoly.length - t1), {
        speedLimit: limit, startNode: from.id, endNode: to.id
      });
      lanes.push(lane);
    }
    const link = new Link(`${road.id}_${dir}`, road, from.id, to.id, lanes);
    link.spine = resample(spine, t0, spine.length - t1);
    this.links.push(link);
    from.outLinks.push(link); to.inLinks.push(link);
  }

  _grow(x, y) {
    const b = this.bounds;
    b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x);
    b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y);
  }
}
