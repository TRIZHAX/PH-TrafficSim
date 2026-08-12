import * as THREE from 'three';
import { KMH } from '../core/Config.js';
<<<<<<< HEAD
import { MaterialLibrary } from './three/materials.js';
import { RoadBuilder } from './three/RoadBuilder.js';
import { EnvironmentBuilder } from './three/EnvironmentBuilder.js';
import { VehicleFactory } from './three/VehicleFactory.js';
import { TrafficLightBuilder } from './three/TrafficLightBuilder.js';

/**
 * Renderer3D — OPTIONAL Three.js visualization of the SAME simulation state.
 * It reads engine state only; it never mutates the simulation (the renderer/
 * engine separation the whole project depends on).
 *
 * World mapping: three.x = sim.x - cx, three.z = sim.y - cz, +Y up.
 * Vehicle heading maps to rotation.set(0, -heading, 0).
 *
 * This orchestrator composes dedicated builders (road, environment, vehicles,
 * traffic lights) so the scene looks like a serious academic streetscape while
 * staying performant (merged static geometry + instanced fleet).
=======

const TYPE_COLORS = {
  car: 0x5ec8f2, motorcycle: 0xffd166, bus: 0xb28dff,
  truck: 0x8fa3b8, tricycle: 0x7ee8a2
};
const MAX_INSTANCES = 420;

/**
 * Renderer3D — OPTIONAL Three.js visualization of the SAME simulation state.
 * World mapping: sim (x, y) → three (x, -y) on the XZ plane, +Y up.
 * Vehicles are InstancedMesh per type (one draw call each); environment is
 * low-poly boxes/cones built once per map. No simulation logic lives here.
>>>>>>> 537061ed35c7d92f7bb486f3a7ec519bfed51bb6
 */
export class Renderer3D {
  constructor(canvas, engine, settings) {
    this.canvas = canvas;
    this.engine = engine;
    this.settings = settings;
<<<<<<< HEAD
    this.cameraMode = 'overview'; // overview | free | third | close | first
    this._free = { yaw: -Math.PI / 4, pitch: -0.9, dist: 380, tx: 0, tz: 0 };
    this._time = 0;
    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._incidentHash = '';
=======
    this.cameraMode = 'overview'; // overview | free | third | first
    this._free = { yaw: -Math.PI / 4, pitch: -0.9, dist: 380, tx: 0, tz: 0 };
    this._keys = new Set();
    this._time = 0;
>>>>>>> 537061ed35c7d92f7bb486f3a7ec519bfed51bb6
    this._init();
    this.rebuild();
    this._bindControls();
  }

<<<<<<< HEAD
=======
  _init() {
    const q = this._quality();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : q === 'medium' ? 1.5 : 2));
    this.renderer.shadowMap.enabled = q === 'high' || q === 'ultra';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.5, 4000);
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

>>>>>>> 537061ed35c7d92f7bb486f3a7ec519bfed51bb6
  _quality() {
    let q = this.settings.quality;
    if (q === 'auto') {
      const mobile = /Mobi|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
      q = mobile ? 'low' : 'high';
    }
    return q;
  }

<<<<<<< HEAD
  _init() {
    const q = this._quality();
    this.quality = q;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : q === 'medium' ? 1.5 : 2));
    this.renderer.shadowMap.enabled = q === 'high' || q === 'ultra';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.4, 6000);
    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  setQuality() { /* applied on next 3D entry (renderer recreated) */ }
=======
  setQuality() { /* re-created on next 3D entry; lightweight approach */ }
>>>>>>> 537061ed35c7d92f7bb486f3a7ec519bfed51bb6

  _resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

<<<<<<< HEAD
  /* ---- scene (re)build ---- */
  rebuild() {
    // dispose previous builders
    this.road?.dispose(this.scene);
    this.env?.dispose(this.scene);
    this.lights?.dispose(this.scene);
    this.vehicles?.disposeFleet(this.scene);
    this.materials?.dispose();
    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);
=======
  /* ---- environment: rebuilt whenever the map changes ---- */
  rebuild() {
    // dispose previous scene content
    this.scene.clear();
    this._signalLamps = [];
    this._incidentMarkers = new Map();
>>>>>>> 537061ed35c7d92f7bb486f3a7ec519bfed51bb6

    const net = this.engine.network;
    const def = this.engine.maps.current;
    const b = net.bounds;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2;
    this._center = { x: cx, z: cz };
    this._free.tx = 0; this._free.tz = 0;
<<<<<<< HEAD
    const W = (x) => x - cx, Z = (y) => y - cz;
    this._W = W; this._Z = Z;

    this.scene.background = new THREE.Color(0x8fb8d8);
    this.scene.fog = new THREE.Fog(0x9fc4dc, 500, 2200);

    this._buildLighting(b);

    this.materials = new MaterialLibrary(this.quality);
    this.road = new RoadBuilder(this.materials, this.quality);
    this.road.build(this.scene, net, W, Z);

    this.env = new EnvironmentBuilder(this.materials, this.quality);
    this.env.build(this.scene, net, def, W, Z);

    this.lights = new TrafficLightBuilder(this.materials, this.quality);
    this.lights.build(this.scene, net, W, Z);

    this.vehicles = new VehicleFactory(this.quality);
    this.vehicles.buildFleet(this.scene);
    this._buildPlayer();

    this._buildRainFx();
    this._incidentHash = '';
    this._syncIncidents();
    this._applyWeatherLook();

    this._free.dist = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.72;
  }

  _buildPlayer() {
    this._player = this.vehicles.buildPlayer(this.engine.player.type);
    this.scene.add(this._player.group);
  }

  /** Rebuild the player mesh when its type changes (called from render). */
  _ensurePlayerType() {
    if (this._playerType !== this.engine.player.type) {
      if (this._player) {
        this.scene.remove(this._player.group);
        this._player.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      }
      this._buildPlayer();
      this._playerType = this.engine.player.type;
    }
  }

  _syncIncidents() {
    const inc = this.engine.incidents;
    const hash = (inc.incidents || []).map(i => `${i.id}:${i.type}`).join('|');
    if (hash === this._incidentHash) return;
    this._incidentHash = hash;
    this.env.syncIncidents(inc, this._W, this._Z);
    // damaged road surface look
    const rc = this.engine.roadCond.condition;
    this.road.setDamaged(rc === 'damaged' || rc === 'severe');
  }

  _buildLighting(b) {
    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x35543f, 1.05);
    this.scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.35);
    sun.position.set(320, 480, -180);
    if (this.renderer.shadowMap.enabled) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(this.quality === 'ultra' ? 4096 : 2048, this.quality === 'ultra' ? 4096 : 2048);
      const s = Math.max(500, (b.maxX - b.minX) * 0.6);
      Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 10, far: 1800 });
      sun.shadow.bias = -0.0004;
    }
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    const fill = new THREE.DirectionalLight(0xbcd6ff, 0.3);
    fill.position.set(-260, 200, 240);
    this.scene.add(fill);
    this.fill = fill;
  }

  /* ---- weather ---- */
  _applyWeatherLook() {
    const w = this.engine.weather.get();
    const fog = this.scene.fog;
    const wet = w.id === 'rain' || w.id === 'heavyRain';
    this.materials.setWet(wet || this.engine.roadCond.condition === 'wet');
    let sky, near, far, sun, hemi, lamps;
    switch (w.id) {
      case 'fog':       sky = 0xb8c2c8; near = 30;  far = 300;  sun = 0.45; hemi = 0.8;  lamps = true;  break;
      case 'heavyRain': sky = 0x5b6774; near = 90;  far = 620;  sun = 0.5;  hemi = 0.75; lamps = true;  break;
      case 'rain':      sky = 0x76858f; near = 180; far = 1100; sun = 0.75; hemi = 0.85; lamps = true;  break;
      case 'wind':      sky = 0x86b0cc; near = 400; far = 2200; sun = 1.2;  hemi = 1.0;  lamps = false; break;
      default:          sky = 0x8fb8d8; near = 500; far = 2400; sun = 1.35; hemi = 1.05; lamps = false; break;
    }
    this.scene.background.setHex(sky);
    fog.color.setHex(sky);
    fog.near = near; fog.far = far;
    this.sun.intensity = sun;
    this.hemi.intensity = hemi;
    this.env?.setLampsOn(lamps);
    if (this._rain) {
      const on = this.settings.weatherFx && wet;
      this._rain.visible = on;
      if (on) this._rain.material.opacity = w.id === 'heavyRain' ? 0.7 : 0.42;
    }
    this._weatherId = w.id;
  }

  _buildRainFx() {
    const count = this.quality === 'low' ? 900 : 3000;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 560;
      pos[i * 3 + 1] = Math.random() * 140;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 560;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbcd0f0, size: 0.5, transparent: true, opacity: 0.5, depthWrite: false }));
    this._rain.visible = false;
    this._rain.frustumCulled = false;
    this.scene.add(this._rain);
  }

  /* ---- camera ---- */
  cycleCameraMode(driving) {
    const order = driving ? ['third', 'close', 'first', 'overview'] : ['overview', 'free'];
    const i = order.indexOf(this.cameraMode);
    this.cameraMode = order[(i + 1) % order.length];
    const names = { overview: 'Traffic Overview', free: 'Free Camera', third: 'Third Person', close: 'Close Chase', first: 'First Person' };
    return names[this.cameraMode];
  }

  setCameraMode(m) { this.cameraMode = m; }

  /** WASD pan for free / overview camera. */
  freeMove(input, dt) {
    if (this.cameraMode !== 'free' && this.cameraMode !== 'overview') return;
    const sp = this._free.dist * 0.9 * dt;
    const yaw = this._free.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this._free.tx += input.throttle * fx * sp + input.steer * fz * sp;
    this._free.tz += input.throttle * fz * sp - input.steer * fx * sp;
  }

  _updateCamera(dt) {
    const cam = this.camera;
    const p = this.engine.player;
    const W = this._W, Z = this._Z;
    const smooth = 1 - Math.pow(0.0016, dt); // frame-rate independent damping

    if ((this.cameraMode === 'third' || this.cameraMode === 'close' || this.cameraMode === 'first') && p.active) {
      const spd = Math.abs(p.v);
      if (this.cameraMode === 'first') {
        const ex = W(p.x) + Math.cos(p.heading) * (p.length * 0.28);
        const ez = Z(p.y) + Math.sin(p.heading) * (p.length * 0.28);
        this._camPos.set(ex, 1.35, ez);
        cam.position.copy(this._camPos);
        this._lookTarget.set(W(p.x) + Math.cos(p.heading) * 30, 1.15, Z(p.y) + Math.sin(p.heading) * 30);
        cam.lookAt(this._lookTarget);
        return;
      }
      const back = this.cameraMode === 'close' ? 6.5 + spd * 0.18 : 10.5 + spd * 0.32;
      const height = this.cameraMode === 'close' ? 3.0 + spd * 0.05 : 5.2 + spd * 0.07;
      this._camPos.set(
        W(p.x) - Math.cos(p.heading) * back,
        height,
        Z(p.y) - Math.sin(p.heading) * back
      );
      cam.position.lerp(this._camPos, smooth);
      this._lookTarget.set(W(p.x) + Math.cos(p.heading) * 7, 1.2, Z(p.y) + Math.sin(p.heading) * 7);
      this._camLook.lerp(this._lookTarget, smooth);
      cam.lookAt(this._camLook);
      return;
    }

    // free / overview orbit around target
    const f = this._free;
    if (this.cameraMode === 'overview') f.pitch = Math.min(f.pitch, -0.85);
    const cy = Math.sin(-f.pitch) * f.dist;
    const ch = Math.cos(-f.pitch) * f.dist;
    cam.position.set(f.tx + Math.sin(f.yaw) * ch, Math.max(6, cy), f.tz + Math.cos(f.yaw) * ch);
    this._lookTarget.set(f.tx, 0, f.tz);
    cam.lookAt(this._lookTarget);
  }

=======

    // sky + fog
    this.scene.background = new THREE.Color(0x0a1018);
    this.scene.fog = new THREE.Fog(0x0a1018, 600, 1600);

    // lights
    const hemi = new THREE.HemisphereLight(0x8fb8d8, 0x1a2530, 0.85);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 1.1);
    this.sun.position.set(300, 420, -200);
    if (this.renderer.shadowMap.enabled) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      const s = 700;
      Object.assign(this.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: 1400 });
    }
    this.scene.add(this.sun);
    this.hemi = hemi;

    const W = (x) => x - cx;           // sim x → three x
    const Z = (y) => y - cz;           // sim y → three z
    this._W = W; this._Z = Z;

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(b.maxX - b.minX + 900, b.maxY - b.minY + 900),
      new THREE.MeshLambertMaterial({ color: 0x111a14 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // roads: flat ribbons following link spines
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x232c36 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x8a97a5 });
    for (const link of net.links) {
      const pts = (link.spine || link.lanes[0].poly).pts;
      const width = link.lanes.length * net.laneWidth + 1.4;
      this._ribbon(pts, width, 0.02, roadMat, W, Z);
      // center line
      this._ribbon(pts, 0.32, 0.05, new THREE.MeshBasicMaterial({ color: 0xd8b04a }), W, Z);
    }
    // intersection pads
    for (const node of net.nodes.values()) {
      if (node.roads.length < 2) continue;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(node.radius + net.laneWidth, node.radius + net.laneWidth, 0.04, 20), roadMat);
      pad.position.set(W(node.x), 0.01, Z(node.y));
      this.scene.add(pad);
    }
    // sidewalks along roads (simple darker ribbons) — skip for perf on low
    const q = this._quality();

    // buildings from blocks + landmarks
    const palette = [0x2a3644, 0x323d4d, 0x3a4656, 0x2e3a48];
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    let bi = 0;
    for (const bl of def.blocks || []) {
      const [bx, by, bw, bh] = bl;
      // subdivide each block into a few buildings
      const n = Math.max(1, Math.round((bw * bh) / 9000));
      for (let i = 0; i < n; i++) {
        const w = bw / n * 0.72, d = bh * 0.72;
        const hgt = 8 + ((bi * 37) % 22);
        const m = new THREE.Mesh(bGeo, new THREE.MeshLambertMaterial({ color: palette[bi % palette.length] }));
        m.scale.set(w, hgt, d);
        m.position.set(W(bx + bw / n * (i + 0.5)), hgt / 2, Z(by + bh / 2));
        m.castShadow = m.receiveShadow = this.renderer.shadowMap.enabled;
        this.scene.add(m);
        bi++;
      }
    }
    const lmColors = { plaza: 0x2c4a38, church: 0x54452c, civic: 0x2c4454, market: 0x54402c, school: 0x413454 };
    for (const lm of def.landmarks || []) {
      const hgt = lm.kind === 'plaza' ? 0.4 : 10;
      const m = new THREE.Mesh(bGeo, new THREE.MeshLambertMaterial({ color: lmColors[lm.kind] || 0x333f4d }));
      m.scale.set(lm.w, hgt, lm.h);
      m.position.set(W(lm.x + lm.w / 2), hgt / 2, Z(lm.y + lm.h / 2));
      this.scene.add(m);
      if (lm.kind === 'church') {
        const spire = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 6), new THREE.MeshLambertMaterial({ color: 0x6a5836 }));
        spire.position.set(W(lm.x + lm.w / 2), hgt + 4, Z(lm.y + lm.h / 2));
        this.scene.add(spire);
      }
    }

    // trees + street lights along main links
    const treeTrunk = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 5);
    const treeTop = new THREE.SphereGeometry(1.9, 6, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3826 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e5e3a });
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a4450 });
    const treeStep = q === 'low' ? 90 : 55;
    this._treeTops = [];
    for (const link of net.links) {
      if (link.id.endsWith('_B')) continue; // one side pass per road
      const spine = link.spine || link.lanes[0].poly;
      const off = link.lanes.length * net.laneWidth + 4;
      for (let s = treeStep / 2; s < spine.length; s += treeStep) {
        const p = spine.at(s);
        const nx = Math.cos(p.heading + Math.PI / 2), ny = Math.sin(p.heading + Math.PI / 2);
        for (const side of [-1, 1]) {
          const tx = W(p.x + nx * off * side), tz = Z(p.y + ny * off * side);
          if ((s / treeStep + (side + 1)) % 3 < 1.5) {
            const t1 = new THREE.Mesh(treeTrunk, trunkMat);
            t1.position.set(tx, 1.2, tz);
            const t2 = new THREE.Mesh(treeTop, leafMat);
            t2.position.set(tx, 3.4, tz);
            this.scene.add(t1, t2);
            this._treeTops.push(t2);
          } else if (link.main) {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 5), poleMat);
            pole.position.set(tx, 3, tz);
            const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe6b0 }));
            lampGlow.position.set(tx, 6, tz);
            this.scene.add(pole, lampGlow);
          }
        }
      }
    }

    // traffic light heads at signalized nodes
    const headGeo = new THREE.BoxGeometry(0.9, 2.4, 0.9);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x222a33 });
    for (const sig of net.signals) {
      for (const app of sig.approaches) {
        const link = net.links.find(l => l.id === app.linkId);
        if (!link) continue;
        const lane = link.lanes[link.lanes.length - 1];
        const p = lane.at(Math.max(0, lane.length - 1));
        const nx = Math.cos(p.heading + Math.PI / 2), ny = Math.sin(p.heading + Math.PI / 2);
        const px = p.x + nx * (net.laneWidth + 1.6), py = p.y + ny * (net.laneWidth + 1.6);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.4, 5), poleMat);
        pole.position.set(W(px), 2.7, Z(py));
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(W(px), 5.6, Z(py));
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ color: 0x38e07d }));
        lamp.position.set(W(px), 5.6, Z(py));
        lamp.translateY(0.0);
        this.scene.add(pole, head, lamp);
        this._signalLamps.push({ lamp, node: sig.node, phase: app.phase });
      }
    }

    // water & greens
    for (const wtr of def.water || []) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wtr.w, wtr.h), new THREE.MeshLambertMaterial({ color: 0x1c3450, transparent: true, opacity: 0.9 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(W(wtr.x + wtr.w / 2), -0.05, Z(wtr.y + wtr.h / 2));
      this.scene.add(m);
    }
    for (const g of def.greens || []) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(g[2], g[3]), new THREE.MeshLambertMaterial({ color: 0x1b3324 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(W(g[0] + g[2] / 2), -0.05, Z(g[1] + g[3] / 2));
      this.scene.add(m);
    }

    this._buildVehicleInstances();
    this._buildPlayerMesh();
    this._buildWeatherFx();
    this._applyWeatherLook();

    // initial camera
    this._free.dist = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.72;
  }

  /** Flat ribbon mesh along a polyline. */
  _ribbon(pts, width, y, mat, W, Z) {
    const verts = [], idx = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
      const dx = c[0] - a[0], dy = c[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * width / 2, ny = dx / len * width / 2;
      verts.push(W(pts[i][0] + nx), y, Z(pts[i][1] + ny));
      verts.push(W(pts[i][0] - nx), y, Z(pts[i][1] - ny));
      if (i > 0) {
        const k = i * 2;
        idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = this.renderer.shadowMap.enabled;
    this.scene.add(mesh);
    return mesh;
  }

  /* ---- instanced vehicles: one InstancedMesh per type ---- */
  _buildVehicleInstances() {
    this._instances = {};
    this._dummy = new THREE.Object3D();
    for (const [type, color] of Object.entries(TYPE_COLORS)) {
      const spec = this.engine.traffic.vehicles[0]?.spec; // just for reference
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshLambertMaterial({ color });
      const mesh = new THREE.InstancedMesh(geo, mat, MAX_INSTANCES);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.castShadow = this.renderer.shadowMap.enabled;
      this.scene.add(mesh);
      this._instances[type] = mesh;
    }
  }

  _buildPlayerMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x38e07d }));
    body.name = 'body';
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.86), new THREE.MeshLambertMaterial({ color: 0x0d2418 }));
    cab.position.set(-0.05, 0.75, 0);
    g.add(body, cab);
    g.visible = false;
    this.scene.add(g);
    this._playerMesh = g;
  }

  _buildWeatherFx() {
    // rain particle system
    const count = this._quality() === 'low' ? 800 : 2500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 500;
      pos[i * 3 + 1] = Math.random() * 120;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 500;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9db8e8, size: 0.55, transparent: true, opacity: 0.55 }));
    this._rain.visible = false;
    this.scene.add(this._rain);
  }

  _applyWeatherLook() {
    const w = this.engine.weather.get();
    const fog = this.scene.fog;
    if (w.id === 'fog') { fog.near = 40; fog.far = 260; this.scene.background = new THREE.Color(0x2a333d); this.sun.intensity = 0.4; this.hemi.intensity = 0.6; }
    else if (w.id === 'heavyRain') { fog.near = 120; fog.far = 520; this.scene.background = new THREE.Color(0x141c26); this.sun.intensity = 0.35; this.hemi.intensity = 0.55; }
    else if (w.id === 'rain') { fog.near = 250; fog.far = 900; this.scene.background = new THREE.Color(0x131b24); this.sun.intensity = 0.6; this.hemi.intensity = 0.7; }
    else if (w.id === 'wind') { fog.near = 500; fog.far = 1500; this.scene.background = new THREE.Color(0x0c1219); this.sun.intensity = 1.0; this.hemi.intensity = 0.8; }
    else { fog.near = 600; fog.far = 1600; this.scene.background = new THREE.Color(0x0a1018); this.sun.intensity = 1.1; this.hemi.intensity = 0.85; }
    this._rain.visible = this.settings.weatherFx && (w.id === 'rain' || w.id === 'heavyRain');
    if (this._rain.visible) this._rain.material.opacity = w.id === 'heavyRain' ? 0.7 : 0.4;
    this._weatherId = w.id;
  }
  /* ---- camera controls: mouse-look orbit + WASD pan in free mode ---- */
>>>>>>> 537061ed35c7d92f7bb486f3a7ec519bfed51bb6
  _bindControls() {
    const c = this.canvas;
    let drag = null;
    c.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => {
      if (!drag) return;
      const sens = 0.005 * (this.settings.cameraSensitivity || 1);
      this._free.yaw -= (e.clientX - drag.x) * sens;
      this._free.pitch = Math.max(-1.45, Math.min(-0.12, this._free.pitch + (e.clientY - drag.y) * sens));
      drag = { x: e.clientX, y: e.clientY };
      if (this.cameraMode === 'overview') this.cameraMode = 'free';
    });
    c.addEventListener('pointerup', () => (drag = null));
    c.addEventListener('wheel', e => {
      e.preventDefault();
<<<<<<< HEAD
      this._free.dist = Math.max(14, Math.min(1600, this._free.dist * Math.pow(1.0015, e.deltaY)));
    }, { passive: false });
=======
      this._free.dist = Math.max(18, Math.min(1400, this._free.dist * Math.pow(1.0015, e.deltaY)));
    }, { passive: false });
    // pinch zoom
>>>>>>> 537061ed35c7d92f7bb486f3a7ec519bfed51bb6
    let pinch = null;
    c.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
        pinch = { d, dist: this._free.dist };
      }
    }, { passive: true });
    c.addEventListener('touchmove', e => {
      if (pinch && e.touches.length === 2) {
        const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
<<<<<<< HEAD
        this._free.dist = Math.max(14, Math.min(1600, pinch.dist * pinch.d / d));
=======
        this._free.dist = Math.max(18, Math.min(1400, pinch.dist * pinch.d / d));
>>>>>>> 537061ed35c7d92f7bb486f3a7ec519bfed51bb6
      }
    }, { passive: true });
    c.addEventListener('touchend', () => (pinch = null));
  }

<<<<<<< HEAD
  /* ---- per-frame ---- */
  render(dt) {
    this._time += dt;
    const e = this.engine;

    if (this._weatherId !== e.weather.current) this._applyWeatherLook();
    this._syncIncidents();

    // fleet
    this.vehicles.syncFrame(e.traffic.vehicles, this._W, this._Z, this._time);

    // player
    this._ensurePlayerType();
    const p = e.player;
    const grp = this._player.group;
    grp.visible = p.active;
    if (p.active) {
      grp.position.set(this._W(p.x), 0, this._Z(p.y));
      grp.rotation.set(0, -p.heading, 0);
      const sx = p.length / this._player.meta.L, sz = p.width / this._player.meta.W;
      grp.scale.set(sx, 1, sz);
      if (this._player.parts.brake) this._player.parts.brake.material.color.setHex(p.braking ? 0xff2a1a : 0x3a0d0a);
    }

    // signals
    this.lights.update(e.lights, this._time);

    // rain
    if (this._rain && this._rain.visible) {
      const pos = this._rain.geometry.attributes.position;
      const speed = (this._weatherId === 'heavyRain' ? 110 : 70) * dt;
      const cxp = this.camera.position.x, czp = this.camera.position.z;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - speed;
        if (y < 0) {
          y = 120 + Math.random() * 30;
          pos.setX(i, cxp + (Math.random() - 0.5) * 460);
          pos.setZ(i, czp + (Math.random() - 0.5) * 460);
=======
  cycleCameraMode(driving) {
    const order = driving ? ['third', 'first', 'free', 'overview'] : ['overview', 'free'];
    const i = order.indexOf(this.cameraMode);
    this.cameraMode = order[(i + 1) % order.length];
    const names = { overview: 'Traffic Overview', free: 'Free Camera', third: 'Third Person', first: 'First Person' };
    return names[this.cameraMode];
  }

  setCameraMode(m) { this.cameraMode = m; }

  /** WASD pan for free camera (reads raw key state from InputManager). */
  freeMove(input, dt) {
    if (this.cameraMode !== 'free' && this.cameraMode !== 'overview') return;
    const sp = this._free.dist * 0.9 * dt;
    const yaw = this._free.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this._free.tx += (-input.throttle) * -fx * sp + input.steer * fz * sp;
    this._free.tz += (-input.throttle) * -fz * sp - input.steer * fx * sp;
  }

  render(dt) {
    this._time += dt;
    const e = this.engine;
    if (this._weatherId !== e.weather.current) this._applyWeatherLook();

    // vehicles → instances
    const counts = {};
    for (const type of Object.keys(this._instances)) counts[type] = 0;
    const d = this._dummy;
    const W = this._W, Z = this._Z;
    for (const v of e.traffic.vehicles) {
      const mesh = this._instances[v.type];
      if (!mesh || counts[v.type] >= MAX_INSTANCES) continue;
      const h = v.type === 'bus' || v.type === 'truck' ? 3.0 : v.type === 'motorcycle' ? 1.4 : 1.7;
      d.position.set(W(v.x), h / 2 + 0.05, Z(v.y));
      d.rotation.set(0, -v.heading, 0);
      d.scale.set(v.length, h, v.width);
      d.updateMatrix();
      mesh.setMatrixAt(counts[v.type]++, d.matrix);
    }
    for (const [type, mesh] of Object.entries(this._instances)) {
      mesh.count = counts[type];
      mesh.instanceMatrix.needsUpdate = true;
    }

    // player
    const p = e.player;
    this._playerMesh.visible = p.active;
    if (p.active) {
      this._playerMesh.position.set(W(p.x), 0.85, Z(p.y));
      this._playerMesh.rotation.set(0, -p.heading, 0);
      const body = this._playerMesh.getObjectByName('body');
      body.scale.set(p.length, 1.6, p.width);
    }

    // signal lamps
    const lampColors = { green: 0x38e07d, yellow: 0xffc14d, red: 0xff4d4d, flash: (this._time % 1 < 0.5) ? 0xffc14d : 0x3a2f18 };
    for (const s of this._signalLamps) {
      const state = e.lights.stateFor(s.node, s.phase);
      s.lamp.material.color.setHex(lampColors[state] || 0x38e07d);
    }

    // rain fall
    if (this._rain.visible) {
      const pos = this._rain.geometry.attributes.position;
      const speed = (this._weatherId === 'heavyRain' ? 90 : 60) * dt;
      const cx = this.camera.position.x, cz = this.camera.position.z;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - speed;
        if (y < 0) {
          y = 100 + Math.random() * 30;
          pos.setX(i, cx + (Math.random() - 0.5) * 400);
          pos.setZ(i, cz + (Math.random() - 0.5) * 400);
>>>>>>> 537061ed35c7d92f7bb486f3a7ec519bfed51bb6
        }
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

<<<<<<< HEAD
    if (this._weatherId === 'wind') this.env.swayTrees(this._time);
=======
    // trees sway in wind
    if (this._weatherId === 'wind' && this._treeTops) {
      const sway = Math.sin(this._time * 2.2) * 0.35;
      for (let i = 0; i < this._treeTops.length; i++) {
        this._treeTops[i].position.x += Math.sin(this._time * 2.2 + i) * 0.012;
      }
    }
>>>>>>> 537061ed35c7d92f7bb486f3a7ec519bfed51bb6

    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

<<<<<<< HEAD
  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.road?.dispose(this.scene);
    this.env?.dispose(this.scene);
    this.lights?.dispose(this.scene);
    this.vehicles?.disposeFleet(this.scene);
    this.materials?.dispose();
    this.renderer?.dispose();
=======
  _updateCamera(dt) {
    const cam = this.camera;
    const p = this.engine.player;
    const W = this._W, Z = this._Z;
    if ((this.cameraMode === 'third' || this.cameraMode === 'first') && p.active) {
      if (this.cameraMode === 'third') {
        // Mapping: three.x = sim.x, three.z = sim.y ⇒ sim heading (cos h, sin h) works directly in xz
        const back = 11 + Math.abs(p.v) * 0.35;
        cam.position.lerp(new THREE.Vector3(W(p.x) - Math.cos(p.heading) * back, 6 + Math.abs(p.v) * 0.08, Z(p.y) - Math.sin(p.heading) * back), 1 - Math.pow(0.0001, dt));
        cam.lookAt(W(p.x) + Math.cos(p.heading) * 8, 1.2, Z(p.y) + Math.sin(p.heading) * 8);
      } else {
        cam.position.set(W(p.x) + Math.cos(p.heading) * 0.8, 1.45, Z(p.y) + Math.sin(p.heading) * 0.8);
        cam.lookAt(W(p.x) + Math.cos(p.heading) * 30, 1.1, Z(p.y) + Math.sin(p.heading) * 30);
      }
      return;
    }
    // free / overview orbit around target
    const f = this._free;
    if (this.cameraMode === 'overview') {
      f.pitch = Math.min(f.pitch, -0.9);
    }
    const cy = Math.sin(-f.pitch) * f.dist;
    const ch = Math.cos(-f.pitch) * f.dist;
    cam.position.set(f.tx + Math.sin(f.yaw) * ch, Math.max(4, cy), f.tz + Math.cos(f.yaw) * ch);
    cam.lookAt(f.tx, 0, f.tz);
>>>>>>> 537061ed35c7d92f7bb486f3a7ec519bfed51bb6
  }
}
