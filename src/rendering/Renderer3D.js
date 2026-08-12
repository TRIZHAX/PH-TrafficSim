import * as THREE from 'three';
import { KMH } from '../core/Config.js';
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
 */
export class Renderer3D {
  constructor(canvas, engine, settings) {
    this.canvas = canvas;
    this.engine = engine;
    this.settings = settings;
    this.cameraMode = 'overview'; // overview | free | third | close | first
    this._free = { yaw: -Math.PI / 4, pitch: -0.9, dist: 380, tx: 0, tz: 0 };
    this._time = 0;
    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._incidentHash = '';
    this._init();
    this.rebuild();
    this._bindControls();
  }

  _quality() {
    let q = this.settings.quality;
    if (q === 'auto') {
      const mobile = /Mobi|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
      q = mobile ? 'low' : 'high';
    }
    return q;
  }

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

  _resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ---- scene (re)build ---- */
  rebuild() {
    // dispose previous builders
    this.road?.dispose(this.scene);
    this.env?.dispose(this.scene);
    this.lights?.dispose(this.scene);
    this.vehicles?.disposeFleet(this.scene);
    this.materials?.dispose();
    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);

    const net = this.engine.network;
    const def = this.engine.maps.current;
    const b = net.bounds;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2;
    this._center = { x: cx, z: cz };
    this._free.tx = 0; this._free.tz = 0;
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
      this._free.dist = Math.max(14, Math.min(1600, this._free.dist * Math.pow(1.0015, e.deltaY)));
    }, { passive: false });
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
        this._free.dist = Math.max(14, Math.min(1600, pinch.dist * pinch.d / d));
      }
    }, { passive: true });
    c.addEventListener('touchend', () => (pinch = null));
  }

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
        }
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    if (this._weatherId === 'wind') this.env.swayTrees(this._time);

    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.road?.dispose(this.scene);
    this.env?.dispose(this.scene);
    this.lights?.dispose(this.scene);
    this.vehicles?.disposeFleet(this.scene);
    this.materials?.dispose();
    this.renderer?.dispose();
  }
}
