import * as THREE from 'three';

/**
 * VehicleFactory — detailed, PH-appropriate 3D vehicles (brief §5).
 *
 * The engine only knows 5 physics types (car, motorcycle, bus, truck,
 * tricycle). Each is mapped to one of several *visual classes* (sedan, SUV,
 * pickup, van, jeepney, bus, truck, motorcycle, tricycle) so the streetscape
 * looks like a real Philippine road without changing the simulation.
 *
 * Rendering strategy (performance, brief §17): every visual class is drawn
 * with a small set of InstancedMeshes — body (per-instance paint colour),
 * dark trim (wheels/bumpers/mirrors), glass, headlights, brake lights
 * (per-instance red), and indicators (per-instance amber). This keeps the
 * whole moving fleet at ~50 draw calls regardless of vehicle count, while
 * still showing brake lights and turn signals per vehicle.
 *
 * Local frame for all geometry: +X = forward (vehicle length),
 * +Z = left, +Y = up, ground at y=0. Matches renderer rotation.set(0,-heading,0).
 */

const KMH = 3.6;

/* engine type → candidate visual classes (index chosen deterministically by id) */
export const TYPE_TO_CLASSES = {
  car: ['sedan', 'sedan', 'suv', 'pickup', 'van'],
  motorcycle: ['motorcycle'],
  bus: ['bus', 'jeepney', 'jeepney'],
  truck: ['truck'],
  tricycle: ['tricycle']
};

/* paint palettes per class (per-instance pick) */
const PALETTES = {
  sedan: [0xd8dde3, 0x2b3a52, 0x8a1f26, 0x1f5136, 0x2a2d33, 0xb0b6bd, 0x394a63],
  suv: [0x30363d, 0x8a9099, 0x203a2c, 0x5a2530, 0x2b3550, 0xcfd4d9],
  pickup: [0x2a2f36, 0xb23a2c, 0x30506a, 0xd6d9dd, 0x374b36],
  van: [0xe6e9ec, 0xdadfe4, 0x33507a, 0xc7ccd2],
  jeepney: [0xd23b3b, 0x2f7ec4, 0xe0a52c, 0x2ba36a, 0xc23f8f, 0xe86a24],
  bus: [0xe8ebee, 0x2f6bb0, 0xd8b64a, 0x2ba36a, 0xc44040],
  truck: [0x8b9199, 0x33507a, 0x9c3a30, 0x445064, 0xcfd4d9],
  motorcycle: [0x1f2329, 0xb23030, 0x2b4a72, 0x2ba36a],
  tricycle: [0x2f7ec4, 0xd23b3b, 0xe0a52c, 0x2ba36a, 0x8a9099]
};

/* box-merge accumulator -------------------------------------------------- */
class Acc { constructor() { this.pos = []; this.norm = []; this.uv = []; this.idx = []; this.v = 0; } isEmpty() { return this.v === 0; } }

function box(acc, size, at, rotY = 0) {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  if (rotY) g.rotateY(rotY);
  g.translate(at[0], at[1], at[2]);
  const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv.array, id = g.index.array;
  const base = acc.v;
  for (let i = 0; i < p.length; i++) { acc.pos.push(p[i]); acc.norm.push(n[i]); }
  for (let i = 0; i < u.length; i++) acc.uv.push(u[i]);
  for (let i = 0; i < id.length; i++) acc.idx.push(id[i] + base);
  acc.v += p.length / 3;
  g.dispose();
}

function cyl(acc, r, h, at, rotZ = Math.PI / 2) {
  const g = new THREE.CylinderGeometry(r, r, h, 10);
  if (rotZ) g.rotateX(rotZ); // wheels: axle along Z
  g.translate(at[0], at[1], at[2]);
  const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv.array, id = g.index.array;
  const base = acc.v;
  for (let i = 0; i < p.length; i++) { acc.pos.push(p[i]); acc.norm.push(n[i]); }
  for (let i = 0; i < u.length; i++) acc.uv.push(u[i]);
  for (let i = 0; i < id.length; i++) acc.idx.push(id[i] + base);
  acc.v += p.length / 3;
  g.dispose();
}

function finalize(acc) {
  if (acc.isEmpty()) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(acc.norm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
  g.setIndex(acc.idx);
  return g;
}

/* Per-class part builders return { L, W, H, geos:{body,trim,glass,head,brake,turn} } */
/* Filled by _buildClassGeometry below. */

export class VehicleFactory {
  constructor(quality = 'high') {
    this.quality = quality;
    this.classes = {};        // name -> { meta, meshes:{}, count }
    this.MAX = quality === 'low' ? 220 : 320;
    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
  }

  /* build all instanced meshes and add to scene */
  buildFleet(scene) {
    const names = Object.keys(PALETTES);
    for (const name of names) this._buildClass(scene, name);
  }

  _buildClass(scene, name) {
    const set = this._buildClassGeometry(name);
    const meshes = {};
    const mk = (geo, mat, castShadow) => {
      if (!geo) return null;
      const m = new THREE.InstancedMesh(geo, mat, this.MAX);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.castShadow = castShadow && (this.quality === 'high' || this.quality === 'ultra');
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    // body: per-instance paint colour
    meshes.body = mk(set.geos.body, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.35, vertexColors: false }), true);
    if (meshes.body) meshes.body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.MAX * 3), 3);
    meshes.trim = mk(set.geos.trim, new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.7, metalness: 0.3 }), true);
    meshes.glass = mk(set.geos.glass, new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.12, metalness: 0.5, transparent: true, opacity: 0.72 }), false);
    meshes.head = mk(set.geos.head, new THREE.MeshBasicMaterial({ color: 0xfff2cc }), false);
    // brake + turn: per-instance emissive-ish colour via instanceColor on basic material
    meshes.brake = mk(set.geos.brake, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: false }), false);
    if (meshes.brake) meshes.brake.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.MAX * 3), 3);
    meshes.turn = mk(set.geos.turn, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: false }), false);
    if (meshes.turn) meshes.turn.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.MAX * 3), 3);
    this.classes[name] = { meta: set.meta, meshes };
  }

  /* Return canonical geometry set for a class: { meta:{L,W,H}, geos:{...} }. */
  _buildClassGeometry(name) {
    const body = new Acc(), trim = new Acc(), glass = new Acc(), head = new Acc(), brake = new Acc(), turn = new Acc();
    const wheels = (positions, r, halfW) => {
      for (const [x, z] of positions) { cyl(trim, r, 0.28, [x, r, z]); cyl(trim, r, 0.28, [x, r, -z]); }
      void halfW;
    };
    let meta;

    if (name === 'sedan') {
      const L = 4.4, W = 1.82, H = 1.46; meta = { L, W, H };
      const base = 0.55;
      box(body, [L * 0.98, 0.5, W], [0, base + 0.05, 0]);          // lower body
      box(body, [L * 0.52, 0.42, W * 0.9], [0.05, base + 0.5, 0]); // cabin base
      box(glass, [L * 0.44, 0.34, W * 0.82], [0.05, base + 0.62, 0]);
      box(trim, [L, 0.16, W * 1.02], [0, base - 0.16, 0]);         // sill
      box(trim, [0.18, 0.2, W * 0.9], [L / 2 - 0.02, base + 0.02, 0]); // front bumper
      box(trim, [0.18, 0.2, W * 0.9], [-L / 2 + 0.02, base + 0.02, 0]); // rear bumper
      // mirrors
      box(trim, [0.1, 0.1, 0.22], [L * 0.14, base + 0.55, W / 2 + 0.02]);
      box(trim, [0.1, 0.1, 0.22], [L * 0.14, base + 0.55, -W / 2 - 0.02]);
      box(head, [0.06, 0.14, 0.3], [L / 2 - 0.01, base + 0.12, W * 0.3]);
      box(head, [0.06, 0.14, 0.3], [L / 2 - 0.01, base + 0.12, -W * 0.3]);
      box(brake, [0.06, 0.14, 0.32], [-L / 2 + 0.01, base + 0.16, W * 0.3]);
      box(brake, [0.06, 0.14, 0.32], [-L / 2 + 0.01, base + 0.16, -W * 0.3]);
      box(turn, [0.06, 0.1, 0.14], [L / 2 - 0.01, base + 0.1, W * 0.44]);
      box(turn, [0.06, 0.1, 0.14], [L / 2 - 0.01, base + 0.1, -W * 0.44]);
      wheels([[L * 0.32, W / 2 - 0.05], [-L * 0.32, W / 2 - 0.05]], 0.34, W / 2);
    } else if (name === 'suv') {
      const L = 4.6, W = 1.9, H = 1.8; meta = { L, W, H };
      const base = 0.62;
      box(body, [L * 0.98, 0.7, W], [0, base + 0.1, 0]);
      box(body, [L * 0.6, 0.55, W * 0.94], [-0.05, base + 0.62, 0]);
      box(glass, [L * 0.5, 0.4, W * 0.86], [-0.05, base + 0.7, 0]);
      box(trim, [0.2, 0.24, W * 0.95], [L / 2 - 0.02, base + 0.06, 0]);
      box(trim, [0.2, 0.24, W * 0.95], [-L / 2 + 0.02, base + 0.06, 0]);
      box(trim, [0.1, 0.1, 0.24], [L * 0.16, base + 0.62, W / 2 + 0.03]);
      box(trim, [0.1, 0.1, 0.24], [L * 0.16, base + 0.62, -W / 2 - 0.03]);
      box(head, [0.06, 0.16, 0.32], [L / 2 - 0.01, base + 0.18, W * 0.32]);
      box(head, [0.06, 0.16, 0.32], [L / 2 - 0.01, base + 0.18, -W * 0.32]);
      box(brake, [0.06, 0.22, 0.3], [-L / 2 + 0.01, base + 0.28, W * 0.34]);
      box(brake, [0.06, 0.22, 0.3], [-L / 2 + 0.01, base + 0.28, -W * 0.34]);
      box(turn, [0.06, 0.1, 0.16], [L / 2 - 0.01, base + 0.12, W * 0.46]);
      box(turn, [0.06, 0.1, 0.16], [L / 2 - 0.01, base + 0.12, -W * 0.46]);
      wheels([[L * 0.33, W / 2 - 0.04], [-L * 0.33, W / 2 - 0.04]], 0.4, W / 2);
    } else if (name === 'pickup') {
      const L = 5.0, W = 1.9, H = 1.72; meta = { L, W, H };
      const base = 0.62;
      box(body, [L * 0.98, 0.6, W], [0, base + 0.05, 0]);
      box(body, [L * 0.4, 0.5, W * 0.94], [L * 0.22, base + 0.5, 0]); // cab forward
      box(glass, [L * 0.3, 0.36, W * 0.84], [L * 0.22, base + 0.58, 0]);
      // bed walls
      box(trim, [L * 0.42, 0.28, 0.08], [-L * 0.24, base + 0.42, W / 2 - 0.04]);
      box(trim, [L * 0.42, 0.28, 0.08], [-L * 0.24, base + 0.42, -W / 2 + 0.04]);
      box(trim, [0.08, 0.28, W * 0.9], [-L / 2 + 0.04, base + 0.42, 0]);
      box(trim, [0.2, 0.22, W * 0.95], [L / 2 - 0.02, base + 0.04, 0]);
      box(head, [0.06, 0.16, 0.3], [L / 2 - 0.01, base + 0.14, W * 0.32]);
      box(head, [0.06, 0.16, 0.3], [L / 2 - 0.01, base + 0.14, -W * 0.32]);
      box(brake, [0.06, 0.2, 0.28], [-L / 2 + 0.01, base + 0.24, W * 0.34]);
      box(brake, [0.06, 0.2, 0.28], [-L / 2 + 0.01, base + 0.24, -W * 0.34]);
      box(turn, [0.06, 0.1, 0.14], [L / 2 - 0.01, base + 0.1, W * 0.46]);
      box(turn, [0.06, 0.1, 0.14], [L / 2 - 0.01, base + 0.1, -W * 0.46]);
      wheels([[L * 0.32, W / 2 - 0.04], [-L * 0.3, W / 2 - 0.04]], 0.42, W / 2);
    } else if (name === 'van') {
      const L = 5.0, W = 1.95, H = 2.05; meta = { L, W, H };
      const base = 0.6;
      box(body, [L * 0.98, 1.2, W], [0, base + 0.45, 0]);
      box(body, [L * 0.2, 0.4, W], [L / 2 - L * 0.1, base + 0.05, 0]); // sloped nose stub
      box(glass, [0.06, 0.42, W * 0.82], [L / 2 - 0.02, base + 0.62, 0]); // windshield
      box(glass, [L * 0.5, 0.34, 0.05], [-L * 0.05, base + 0.72, W / 2 - 0.02]); // side windows
      box(glass, [L * 0.5, 0.34, 0.05], [-L * 0.05, base + 0.72, -W / 2 + 0.02]);
      box(trim, [0.2, 0.24, W * 0.95], [L / 2 - 0.02, base + 0.02, 0]);
      box(head, [0.06, 0.18, 0.3], [L / 2 - 0.01, base + 0.16, W * 0.32]);
      box(head, [0.06, 0.18, 0.3], [L / 2 - 0.01, base + 0.16, -W * 0.32]);
      box(brake, [0.06, 0.3, 0.24], [-L / 2 + 0.01, base + 0.4, W * 0.36]);
      box(brake, [0.06, 0.3, 0.24], [-L / 2 + 0.01, base + 0.4, -W * 0.36]);
      box(turn, [0.06, 0.1, 0.16], [L / 2 - 0.01, base + 0.08, W * 0.46]);
      box(turn, [0.06, 0.1, 0.16], [L / 2 - 0.01, base + 0.08, -W * 0.46]);
      wheels([[L * 0.32, W / 2 - 0.04], [-L * 0.32, W / 2 - 0.04]], 0.4, W / 2);
    } else if (name === 'jeepney') {
      const L = 6.4, W = 2.1, H = 2.4; meta = { L, W, H };
      const base = 0.7;
      // long passenger body
      box(body, [L * 0.7, 1.15, W], [-L * 0.1, base + 0.4, 0]);
      // hood / bonnet at front
      box(body, [L * 0.28, 0.55, W * 0.9], [L * 0.34, base + 0.1, 0]);
      // roof
      box(body, [L * 0.7, 0.1, W * 1.05], [-L * 0.1, base + 1.0, 0]);
      // windshield + long side openings (glass)
      box(glass, [0.06, 0.4, W * 0.82], [L * 0.2, base + 0.62, 0]);
      box(glass, [L * 0.6, 0.42, 0.05], [-L * 0.1, base + 0.7, W / 2 - 0.01]);
      box(glass, [L * 0.6, 0.42, 0.05], [-L * 0.1, base + 0.7, -W / 2 + 0.01]);
      box(trim, [0.24, 0.3, W * 0.96], [L / 2 - 0.02, base + 0.02, 0]); // chrome front
      box(head, [0.06, 0.2, 0.3], [L / 2 - 0.01, base + 0.14, W * 0.3]);
      box(head, [0.06, 0.2, 0.3], [L / 2 - 0.01, base + 0.14, -W * 0.3]);
      box(brake, [0.06, 0.2, 0.24], [-L / 2 + 0.01, base + 0.3, W * 0.36]);
      box(brake, [0.06, 0.2, 0.24], [-L / 2 + 0.01, base + 0.3, -W * 0.36]);
      box(turn, [0.06, 0.1, 0.16], [L / 2 - 0.01, base + 0.08, W * 0.44]);
      box(turn, [0.06, 0.1, 0.16], [L / 2 - 0.01, base + 0.08, -W * 0.44]);
      wheels([[L * 0.3, W / 2 - 0.03], [-L * 0.28, W / 2 - 0.03]], 0.44, W / 2);
    } else if (name === 'bus') {
      const L = 11.0, W = 2.5, H = 3.2; meta = { L, W, H };
      const base = 0.85;
      box(body, [L * 0.99, 2.0, W], [0, base + 0.9, 0]);
      box(body, [L * 0.99, 0.12, W * 1.03], [0, base + 1.9, 0]); // roof cap
      box(glass, [0.06, 0.6, W * 0.86], [L / 2 - 0.02, base + 1.05, 0]); // windshield
      box(glass, [L * 0.86, 0.55, 0.05], [-L * 0.02, base + 1.15, W / 2 - 0.01]);
      box(glass, [L * 0.86, 0.55, 0.05], [-L * 0.02, base + 1.15, -W / 2 + 0.01]);
      box(trim, [0.24, 0.4, W * 0.98], [L / 2 - 0.02, base + 0.1, 0]);
      box(trim, [0.24, 0.4, W * 0.98], [-L / 2 + 0.02, base + 0.1, 0]);
      box(head, [0.06, 0.26, 0.4], [L / 2 - 0.01, base + 0.2, W * 0.34]);
      box(head, [0.06, 0.26, 0.4], [L / 2 - 0.01, base + 0.2, -W * 0.34]);
      box(brake, [0.06, 0.3, 0.34], [-L / 2 + 0.01, base + 0.3, W * 0.36]);
      box(brake, [0.06, 0.3, 0.34], [-L / 2 + 0.01, base + 0.3, -W * 0.36]);
      box(turn, [0.06, 0.14, 0.2], [L / 2 - 0.01, base + 0.1, W * 0.44]);
      box(turn, [0.06, 0.14, 0.2], [L / 2 - 0.01, base + 0.1, -W * 0.44]);
      wheels([[L * 0.34, W / 2 - 0.02], [-L * 0.3, W / 2 - 0.02]], 0.55, W / 2);
    } else if (name === 'truck') {
      const L = 8.5, W = 2.45, H = 3.0; meta = { L, W, H };
      const base = 0.95;
      // cab
      box(body, [L * 0.26, 1.6, W], [L * 0.32, base + 0.6, 0]);
      box(glass, [0.06, 0.5, W * 0.84], [L * 0.32 + L * 0.13 - 0.02, base + 0.95, 0]);
      // cargo box
      box(body, [L * 0.62, 1.9, W], [-L * 0.16, base + 0.75, 0]);
      box(trim, [L, 0.24, W * 0.7], [0, base - 0.2, 0]); // chassis
      box(trim, [0.22, 0.5, W * 0.95], [L / 2 - 0.02, base + 0.1, 0]);
      box(head, [0.06, 0.24, 0.34], [L / 2 - 0.01, base + 0.18, W * 0.34]);
      box(head, [0.06, 0.24, 0.34], [L / 2 - 0.01, base + 0.18, -W * 0.34]);
      box(brake, [0.06, 0.26, 0.3], [-L / 2 + 0.01, base + 0.3, W * 0.36]);
      box(brake, [0.06, 0.26, 0.3], [-L / 2 + 0.01, base + 0.3, -W * 0.36]);
      box(turn, [0.06, 0.12, 0.18], [L / 2 - 0.01, base + 0.08, W * 0.45]);
      box(turn, [0.06, 0.12, 0.18], [L / 2 - 0.01, base + 0.08, -W * 0.45]);
      wheels([[L * 0.34, W / 2 - 0.02], [-L * 0.18, W / 2 - 0.02], [-L * 0.32, W / 2 - 0.02]], 0.5, W / 2);
    } else if (name === 'motorcycle') {
      const L = 2.1, W = 0.8, H = 1.2; meta = { L, W, H };
      box(body, [L * 0.7, 0.28, W * 0.5], [0, 0.62, 0]);          // tank/seat
      box(trim, [0.2, 0.4, 0.14], [L * 0.3, 0.5, 0]);             // fork
      box(trim, [0.5, 0.1, 0.12], [L * 0.2, 0.95, 0]);            // handlebar
      box(glass, [0.1, 0.24, 0.3], [L * 0.34, 0.9, 0]);           // small screen
      box(head, [0.05, 0.1, 0.1], [L / 2 - 0.02, 0.7, 0]);
      box(brake, [0.05, 0.1, 0.12], [-L / 2 + 0.02, 0.7, 0]);
      box(turn, [0.04, 0.06, 0.08], [-L / 2 + 0.04, 0.72, 0.14]);
      box(turn, [0.04, 0.06, 0.08], [-L / 2 + 0.04, 0.72, -0.14]);
      cyl(trim, 0.32, 0.12, [L * 0.34, 0.32, 0]);                 // front wheel
      cyl(trim, 0.32, 0.14, [-L * 0.34, 0.32, 0]);                // rear wheel
    } else if (name === 'tricycle') {
      const L = 2.8, W = 1.6, H = 1.5; meta = { L, W, H };
      // motorcycle part (offset to one side)
      box(body, [L * 0.6, 0.3, 0.4], [0, 0.6, -W * 0.28]);
      box(trim, [0.4, 0.1, 0.1], [L * 0.24, 0.92, -W * 0.28]);    // handlebar
      cyl(trim, 0.3, 0.1, [L * 0.32, 0.3, -W * 0.28]);
      cyl(trim, 0.3, 0.12, [-L * 0.28, 0.3, -W * 0.28]);
      // sidecar
      box(body, [L * 0.7, 0.7, W * 0.55], [-L * 0.02, 0.55, W * 0.2]);
      box(body, [L * 0.7, 0.1, W * 0.6], [-L * 0.02, 1.0, W * 0.2]); // roof
      box(glass, [L * 0.5, 0.34, 0.04], [-L * 0.02, 0.78, W * 0.46]);
      cyl(trim, 0.28, 0.1, [-L * 0.2, 0.28, W * 0.46]);           // sidecar wheel
      box(head, [0.05, 0.1, 0.1], [L / 2 - 0.02, 0.62, -W * 0.28]);
      box(brake, [0.05, 0.12, 0.12], [-L / 2 + 0.02, 0.66, W * 0.2]);
      box(turn, [0.04, 0.06, 0.08], [-L / 2 + 0.04, 0.66, W * 0.4]);
    } else {
      meta = { L: 4.4, W: 1.8, H: 1.45 };
    }

    return {
      meta,
      geos: {
        body: finalize(body), trim: finalize(trim), glass: finalize(glass),
        head: finalize(head), brake: finalize(brake), turn: finalize(turn)
      }
    };
  }

  /* deterministic paint colour for a vehicle id within its class palette */
  _paint(name, id) {
    const pal = PALETTES[name];
    return pal[(id * 2654435761 >>> 0) % pal.length];
  }

  /* map an engine vehicle to its stable visual class */
  classOf(v) {
    const cands = TYPE_TO_CLASSES[v.type] || ['sedan'];
    return cands[(v.id * 40503) % cands.length];
  }

  /**
   * Update all instanced meshes from the current vehicle list.
   * time is used for indicator blink phase.
   */
  syncFrame(vehicles, W, Z, time) {
    const counts = {};
    for (const name in this.classes) counts[name] = 0;
    const d = this._dummy, col = this._col;
    const blink = (time % 0.9) < 0.45;

    for (const v of vehicles) {
      if (v.isPlayer) continue;
      const name = this.classOf(v);
      const c = this.classes[name];
      if (!c) continue;
      const i = counts[name];
      if (i >= this.MAX) continue;
      const sx = v.length / c.meta.L, sz = v.width / c.meta.W;
      d.position.set(W(v.x), 0, Z(v.y));
      d.rotation.set(0, -v.heading, 0);
      d.scale.set(sx, 1, sz);
      d.updateMatrix();
      const M = c.meshes;
      for (const key of ['body', 'trim', 'glass', 'head', 'brake', 'turn']) {
        if (M[key]) M[key].setMatrixAt(i, d.matrix);
      }
      // paint
      if (M.body) { col.setHex(this._paint(name, v.id)); M.body.setColorAt(i, col); }
      // brake lights
      if (M.brake) { col.setHex(v.braking ? 0xff2a1a : 0x3a0d0a); M.brake.setColorAt(i, col); }
      // indicators: from connector turn or explicit turnSignal
      if (M.turn) {
        let sig = v.turnSignal;
        if (!sig && v.lane && v.lane.kind === 'connector' && (v.lane.turn === 'left' || v.lane.turn === 'right')) sig = v.lane.turn;
        const on = sig && blink;
        col.setHex(on ? 0xffb020 : 0x2a2410);
        M.turn.setColorAt(i, col);
      }
      counts[name]++;
    }

    for (const name in this.classes) {
      const M = this.classes[name].meshes;
      const n = counts[name];
      for (const key of ['body', 'trim', 'glass', 'head', 'brake', 'turn']) {
        const m = M[key];
        if (!m) continue;
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
  }

  /**
   * Detailed single-mesh player vehicle in a signature accent colour so the
   * user always recognises their own car. Returns { group, parts } where parts
   * exposes brake/turn/head meshes for per-frame light updates.
   */
  buildPlayer(type) {
    const name = (TYPE_TO_CLASSES[type] || ['sedan'])[0];
    const set = this._buildClassGeometry(name);
    const g = new THREE.Group();
    const accent = 0x5ec8f2;
    const parts = {};
    const add = (geo, mat, key) => {
      if (!geo) return;
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = this.quality === 'high' || this.quality === 'ultra';
      g.add(m);
      if (key) parts[key] = m;
    };
    add(set.geos.body, new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.45 }));
    add(set.geos.trim, new THREE.MeshStandardMaterial({ color: 0x11151a, roughness: 0.7, metalness: 0.3 }));
    add(set.geos.glass, new THREE.MeshStandardMaterial({ color: 0x0c141c, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.75 }));
    add(set.geos.head, new THREE.MeshBasicMaterial({ color: 0xfff4d6 }), 'head');
    add(set.geos.brake, new THREE.MeshBasicMaterial({ color: 0x3a0d0a }), 'brake');
    add(set.geos.turn, new THREE.MeshBasicMaterial({ color: 0x2a2410 }), 'turn');
    g.visible = false;
    return { group: g, parts, meta: set.meta };
  }

  disposeFleet(scene) {
    for (const c of Object.values(this.classes)) {
      for (const m of Object.values(c.meshes)) { scene.remove(m); m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); }
    }
    this.classes = {};
  }
}
