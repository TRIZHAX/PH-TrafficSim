import { Camera2D } from '../camera/Camera2D.js';
import { KMH } from '../core/Config.js';

const VEHICLE_COLORS = {
  car: '#5ec8f2', motorcycle: '#ffd166', bus: '#b28dff',
  truck: '#8fa3b8', tricycle: '#7ee8a2'
};

/**
 * Renderer2D — DEFAULT top-down canvas renderer.
 * Reads engine state each frame; draws terrain, road network, signals,
 * incidents, sensors, vehicles, player and weather overlay.
 * Static geometry (terrain + roads) is cached on an offscreen canvas and
 * re-blitted per frame, so hundreds of vehicles stay cheap.
 */
export class Renderer2D {
  constructor(canvas, engine, settings) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.engine = engine;
    this.settings = settings;
    this.camera = new Camera2D(canvas);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._staticCache = null;
    this._rainDrops = [];
    this._time = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.canvas.width = Math.max(1, w * this.dpr);
    this.canvas.height = Math.max(1, h * this.dpr);
    this._staticCache = null;
  }

  fitMap() { this.camera.fit(this.engine.network.bounds); this._staticCache = null; }

  invalidate() { this._staticCache = null; }

  render(dt) {
    this._time += dt;
    const ctx = this.ctx;
    const cam = this.camera;
    cam.update(dt);
    if (this.engine.player.active && cam.follow !== this.engine.player && this._followPlayer) cam.follow = this.engine.player;

    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // background
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this._drawTerrain(ctx);
    this._drawRoads(ctx);
    this._drawIncidents(ctx);
    this._drawSignals(ctx);
    this._drawSensors(ctx);
    this._drawVehicles(ctx);
    this._drawPlayer(ctx);

    ctx.restore();

    if (this.settings.weatherFx) this._drawWeatherOverlay(ctx, w, h, dt);
    if (this.settings.showLabels) this._drawLabels(ctx);
  }

  /* ---- terrain: land, water, greens, blocks, landmarks ---- */
  _drawTerrain(ctx) {
    const def = this.engine.maps.current;
    const b = this.engine.network.bounds;
    // land plate
    ctx.fillStyle = '#10161d';
    ctx.fillRect(b.minX - 200, b.minY - 200, b.maxX - b.minX + 400, b.maxY - b.minY + 400);
    // subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.022)';
    ctx.lineWidth = 1 / this.camera.zoom;
    const step = 100;
    ctx.beginPath();
    for (let x = Math.floor((b.minX - 200) / step) * step; x < b.maxX + 200; x += step) { ctx.moveTo(x, b.minY - 200); ctx.lineTo(x, b.maxY + 200); }
    for (let y = Math.floor((b.minY - 200) / step) * step; y < b.maxY + 200; y += step) { ctx.moveTo(b.minX - 200, y); ctx.lineTo(b.maxX + 200, y); }
    ctx.stroke();
    // greens
    for (const g of def.greens || []) {
      ctx.fillStyle = 'rgba(56,224,125,0.07)';
      this._rr(ctx, g[0], g[1], g[2], g[3], 12); ctx.fill();
    }
    // water
    for (const wtr of def.water || []) {
      ctx.fillStyle = 'rgba(80,160,255,0.12)';
      this._rr(ctx, wtr.x, wtr.y, wtr.w, wtr.h, 16); ctx.fill();
    }
    // building blocks
    for (const bl of def.blocks || []) {
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1.2;
      this._rr(ctx, bl[0], bl[1], bl[2], bl[3], 6); ctx.fill(); ctx.stroke();
    }
    // landmarks
    for (const lm of def.landmarks || []) {
      const colors = { plaza: 'rgba(56,224,125,0.14)', church: 'rgba(255,193,77,0.13)', civic: 'rgba(94,200,242,0.12)', market: 'rgba(255,138,61,0.13)', school: 'rgba(178,141,255,0.13)' };
      ctx.fillStyle = colors[lm.kind] || 'rgba(255,255,255,0.06)';
      this._rr(ctx, lm.x, lm.y, lm.w, lm.h, 8); ctx.fill();
      if (this.camera.zoom > 0.45 && this.settings.showLabels) {
        ctx.fillStyle = 'rgba(230,240,250,0.5)';
        ctx.font = `600 ${10 / Math.max(this.camera.zoom, 0.6)}px "Barlow", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(lm.label, lm.x + lm.w / 2, lm.y + lm.h / 2 + 3);
      }
    }
  }

  _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---- roads: asphalt, lane dividers, edge lines, condition tint ---- */
  _drawRoads(ctx) {
    const net = this.engine.network;
    const lw = net.laneWidth;
    const cond = this.engine.roadCond.get();

    // connectors (intersection pavement) first
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const node of net.nodes.values()) {
      if (node.roads.length < 2) continue;
      ctx.fillStyle = '#1b232d';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + lw, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const link of net.links) {
      const width = link.lanes.length * lw + 1.2;
      // asphalt (drawn per directed link, offset so both directions join)
      const spine = link.lanes[0].poly.pts;
      ctx.strokeStyle = '#1b232d';
      ctx.lineWidth = width + lw;
      this._path(ctx, spine); ctx.stroke();
    }
    for (const link of net.links) {
      // condition tint
      if (cond.id === 'wet') {
        ctx.strokeStyle = 'rgba(90,140,220,0.10)';
        ctx.lineWidth = link.lanes.length * net.laneWidth + 2;
        this._path(ctx, link.lanes[0].poly.pts); ctx.stroke();
      } else if (cond.id === 'damaged' || cond.id === 'severe') {
        ctx.strokeStyle = cond.id === 'severe' ? 'rgba(255,77,77,0.10)' : 'rgba(255,138,61,0.08)';
        ctx.lineWidth = link.lanes.length * net.laneWidth + 2;
        this._path(ctx, link.lanes[0].poly.pts); ctx.stroke();
      }
      // lane dividers (dashed) between lanes of same direction
      ctx.strokeStyle = 'rgba(220,230,240,0.20)';
      ctx.lineWidth = 0.35;
      ctx.setLineDash([3.5, 4.5]);
      for (let i = 1; i < link.lanes.length; i++) {
        const mid = link.lanes[i].poly.pts.map((p, j) => {
          const q = link.lanes[i - 1].poly.pts[Math.min(j, link.lanes[i - 1].poly.pts.length - 1)];
          return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        });
        this._path(ctx, mid); ctx.stroke();
      }
      ctx.setLineDash([]);
      // centerline (yellow) on the inner edge of lane 0
      const center = link.spine?.pts || link.lanes[0].poly.pts;
      ctx.strokeStyle = 'rgba(255,193,77,0.4)';
      ctx.lineWidth = 0.35;
      this._path(ctx, center); ctx.stroke();
      // stop line where the link ends at a signal
      if (link.lanes[0].signal) {
        const lane0 = link.lanes[0], laneN = link.lanes[link.lanes.length - 1];
        const p0 = lane0.at(lane0.length - 1), p1 = laneN.at(laneN.length - 1);
        const nx = Math.cos(p0.heading + Math.PI / 2), ny = Math.sin(p0.heading + Math.PI / 2);
        ctx.strokeStyle = 'rgba(230,240,250,0.5)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(p0.x - nx * lw * 0.5, p0.y - ny * lw * 0.5);
        ctx.lineTo(p1.x + nx * lw * 0.5, p1.y + ny * lw * 0.5);
        ctx.stroke();
      }
    }

    // road names at zoom
    if (this.camera.zoom > 0.5 && this.settings.showLabels) {
      ctx.fillStyle = 'rgba(180,200,220,0.42)';
      const drawn = new Set();
      for (const link of net.links) {
        if (drawn.has(link.roadId)) continue;
        drawn.add(link.roadId);
        const mid = link.spine ? link.spine.at(link.spine.length / 2) : link.lanes[0].at(link.length / 2);
        ctx.save();
        ctx.translate(mid.x, mid.y);
        let ang = mid.heading;
        if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
        ctx.rotate(ang);
        ctx.font = `600 ${9 / Math.max(this.camera.zoom * 0.85, 0.7)}px "Barlow", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(link.name, 0, -link.lanes.length * lw - 2);
        ctx.restore();
      }
    }
  }

  _path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }
  /* ---- traffic signals: one lamp per approach at the stop line ---- */
  _drawSignals(ctx) {
    const snap = this.engine.lights.snapshot();
    const net = this.engine.network;
    const colors = { green: '#38e07d', yellow: '#ffc14d', red: '#ff4d4d', flash: this._time % 1 < 0.5 ? '#ffc14d' : '#4a3a20' };
    for (const sig of snap) {
      for (const app of sig.approaches) {
        const link = net.links.find(l => l.id === app.linkId);
        if (!link) continue;
        const lane = link.lanes[link.lanes.length - 1];
        const p = lane.at(Math.max(0, lane.length - 1));
        const nx = Math.cos(p.heading + Math.PI / 2), ny = Math.sin(p.heading + Math.PI / 2);
        const px = p.x + nx * (net.laneWidth * 0.9 + 1.5), py = p.y + ny * (net.laneWidth * 0.9 + 1.5);
        const state = sig.failed ? 'flash' : (app.phase === 0 ? sig.phase0 : sig.phase1);
        // pole base
        ctx.fillStyle = '#2a3542';
        ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill();
        // lamp with glow
        ctx.fillStyle = colors[state];
        ctx.shadowColor = colors[state]; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(px, py, 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  /* ---- incidents: construction cones / accident markers / closures ---- */
  _drawIncidents(ctx) {
    for (const inc of this.engine.incidents.incidents) {
      if (inc.type === 'signalFail') {
        this._incidentBadge(ctx, inc.x, inc.y - 10, '#ffc14d', 'signal');
        continue;
      }
      const lane = inc.lane;
      const zoneStart = inc.at, zoneEnd = Math.min(lane.length, inc.at + inc.zone);
      // hatched zone
      ctx.strokeStyle = inc.type === 'accident' ? 'rgba(255,77,77,0.55)' : 'rgba(255,193,77,0.55)';
      ctx.lineWidth = this.engine.network.laneWidth * 0.85;
      ctx.setLineDash([2, 2]);
      const pts = [];
      for (let s = zoneStart; s <= zoneEnd; s += 4) { const p = lane.at(s); pts.push([p.x, p.y]); }
      if (pts.length > 1) { this._path(ctx, pts); ctx.stroke(); }
      ctx.setLineDash([]);
      // vector marker (emoji-free) drawn directly on the canvas
      const tone = inc.type === 'accident' ? '#ff4d4d' : '#ff8a3d';
      this._incidentBadge(ctx, inc.x, inc.y, tone, inc.type);
      // cones at zone edges for construction
      if (inc.type === 'construction' || inc.type === 'laneClosure') {
        ctx.fillStyle = '#ff8a3d';
        for (const s of [zoneStart - 3, zoneEnd + 3]) {
          const p = lane.at(Math.max(0, Math.min(lane.length, s)));
          ctx.beginPath(); ctx.arc(p.x, p.y, 0.8, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  /**
   * Draw a compact, emoji-free incident marker directly on the canvas: a small
   * rounded badge in the incident's tone with a simple vector glyph. World units
   * are metres, so the badge is ~4m across — legible when zoomed in, unobtrusive
   * when zoomed out. Mirrors the vector-icon language of the HTML UI.
   */
  _incidentBadge(ctx, x, y, tone, type) {
    const R = 2.0;
    ctx.save();
    ctx.translate(x, y);
    // badge disc
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,14,20,0.82)'; ctx.fill();
    ctx.lineWidth = 0.45; ctx.strokeStyle = tone; ctx.stroke();
    ctx.strokeStyle = tone; ctx.fillStyle = tone;
    ctx.lineWidth = 0.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    if (type === 'construction') {
      // triangle warning
      ctx.moveTo(0, -1.05); ctx.lineTo(1.05, 0.85); ctx.lineTo(-1.05, 0.85); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -0.15); ctx.lineTo(0, 0.35); ctx.stroke();
    } else if (type === 'accident') {
      // medical cross
      ctx.moveTo(0, -0.9); ctx.lineTo(0, 0.9); ctx.moveTo(-0.9, 0); ctx.lineTo(0.9, 0); ctx.stroke();
    } else if (type === 'laneClosure') {
      // no-entry bar
      ctx.arc(0, 0, 1.0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.7, 0); ctx.lineTo(0.7, 0); ctx.stroke();
    } else if (type === 'signal') {
      // signal head: three stacked lamps
      ctx.strokeRect(-0.55, -1.05, 1.1, 2.1);
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) { ctx.moveTo(0.28, i * 0.62); ctx.arc(0, i * 0.62, 0.28, 0, Math.PI * 2); }
      ctx.stroke();
    } else {
      // breakdown / generic: wrench-ish slash
      ctx.moveTo(-0.7, 0.7); ctx.lineTo(0.7, -0.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(0.55, -0.55, 0.4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---- virtual sensors ---- */
  _drawSensors(ctx) {
    if (!this.settings.showStats || this.camera.zoom < 0.4) return;
    for (const s of this.engine.stats.sensors) {
      ctx.strokeStyle = 'rgba(94,200,242,0.35)';
      ctx.lineWidth = 0.6;
      const nx = Math.cos(s.heading + Math.PI / 2), ny = Math.sin(s.heading + Math.PI / 2);
      const w = s.link.lanes.length * this.engine.network.laneWidth;
      ctx.setLineDash([1.5, 1.5]);
      ctx.beginPath();
      ctx.moveTo(s.x - nx * w, s.y - ny * w);
      ctx.lineTo(s.x + nx * w, s.y + ny * w);
      ctx.stroke();
      ctx.setLineDash([]);
      if (this.camera.zoom > 0.8) {
        ctx.fillStyle = 'rgba(94,200,242,0.7)';
        ctx.font = '3.5px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${s.flowPerHour()} v/h`, s.x + nx * (w + 6), s.y + ny * (w + 6));
      }
    }
  }

  /* ---- AI vehicles: oriented rounded rects, brake glow, color by type ---- */
  _drawVehicles(ctx) {
    const zoom = this.camera.zoom;
    const simple = zoom < 0.45; // LOD: dots when zoomed far out
    for (const v of this.engine.traffic.vehicles) {
      if (simple) {
        ctx.fillStyle = v.v < 1 ? '#ff4d4d' : VEHICLE_COLORS[v.type];
        ctx.beginPath(); ctx.arc(v.x, v.y, 1.6, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(v.heading);
      const L = v.length, W = v.width;
      // body
      ctx.fillStyle = VEHICLE_COLORS[v.type] || '#9fb2c4';
      this._rr(ctx, -L / 2, -W / 2, L, W, Math.min(0.7, W / 3)); ctx.fill();
      // windshield hint
      ctx.fillStyle = 'rgba(10,16,22,0.55)';
      ctx.fillRect(L * 0.08, -W / 2 + 0.25, L * 0.22, W - 0.5);
      // brake lights
      if (v.braking || v.v < 0.3) {
        ctx.fillStyle = '#ff4d4d';
        ctx.shadowColor = '#ff4d4d'; ctx.shadowBlur = 5;
        ctx.fillRect(-L / 2 - 0.2, -W / 2 + 0.2, 0.5, 0.8);
        ctx.fillRect(-L / 2 - 0.2, W / 2 - 1.0, 0.5, 0.8);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
  }

  /* ---- player vehicle: distinct highlight ring + heading arrow ---- */
  _drawPlayer(ctx) {
    const p = this.engine.player;
    if (!p.active) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    // pulse ring
    const pulse = 4.5 + Math.sin(this._time * 4) * 0.6;
    ctx.strokeStyle = 'rgba(56,224,125,0.6)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.rotate(p.heading);
    const L = p.length, W = p.width;
    ctx.fillStyle = '#38e07d';
    ctx.shadowColor = '#38e07d'; ctx.shadowBlur = 10;
    this._rr(ctx, -L / 2, -W / 2, L, W, Math.min(0.8, W / 3)); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(8,14,10,0.6)';
    ctx.fillRect(L * 0.05, -W / 2 + 0.25, L * 0.24, W - 0.5);
    if (p.braking) {
      ctx.fillStyle = '#ff4d4d'; ctx.shadowColor = '#ff4d4d'; ctx.shadowBlur = 6;
      ctx.fillRect(-L / 2 - 0.25, -W / 2 + 0.15, 0.5, 0.9);
      ctx.fillRect(-L / 2 - 0.25, W / 2 - 1.05, 0.5, 0.9);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  /* ---- weather overlay in screen space ---- */
  _drawWeatherOverlay(ctx, w, h, dt) {
    const wt = this.engine.weather.get();
    if (wt.id === 'clear') { this._rainDrops.length = 0; return; }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (wt.id === 'rain' || wt.id === 'heavyRain') {
      const target = wt.id === 'heavyRain' ? 160 : 70;
      while (this._rainDrops.length < target) this._rainDrops.push({ x: Math.random() * w, y: Math.random() * h, l: 6 + Math.random() * 10, s: 400 + Math.random() * 300 });
      if (this._rainDrops.length > target) this._rainDrops.length = target;
      ctx.strokeStyle = wt.id === 'heavyRain' ? 'rgba(150,190,255,0.4)' : 'rgba(150,190,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of this._rainDrops) {
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + d.l);
        d.y += d.s * dt; d.x -= d.s * 0.18 * dt;
        if (d.y > h) { d.y = -10; d.x = Math.random() * (w + 40); }
      }
      ctx.stroke();
      ctx.fillStyle = wt.id === 'heavyRain' ? 'rgba(8,14,26,0.30)' : 'rgba(8,14,26,0.14)';
      ctx.fillRect(0, 0, w, h);
    } else if (wt.id === 'fog') {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.75);
      g.addColorStop(0, 'rgba(170,185,200,0.10)');
      g.addColorStop(1, 'rgba(170,185,200,0.42)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (wt.id === 'wind') {
      ctx.strokeStyle = 'rgba(200,220,240,0.13)';
      ctx.lineWidth = 1;
      const t = this._time * 250;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const y = (i * 97 + Math.sin(i * 3.4) * 40 + h) % h;
        const x = (t * (0.7 + i * 0.09) + i * 173) % (w + 160) - 80;
        ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 24, y - 4, x + 48, y);
      }
      ctx.stroke();
    }
  }

  _drawLabels(ctx) { /* handled inside world-space passes */ }
}
