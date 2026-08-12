import * as THREE from 'three';

/**
 * materials.js — shared, cached materials & procedural canvas textures for the
 * 3D renderer. Everything is created once per renderer instance through a
 * MaterialLibrary so draw calls stay low and GPU memory bounded (brief §17).
 *
 * Textures are generated on a 2D canvas (no external asset files → fully
 * offline). Colours follow the app's dark control-room palette but the road
 * itself is deliberately lighter than the terrain so it reads clearly as the
 * driveable surface (brief §1).
 */

/* ---- procedural canvas textures ------------------------------------------ */

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d') };
}

/** Asphalt: dark grey base with fine speckle + subtle lane-direction grain. */
function asphaltTexture(size = 256) {
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = '#3a4048';
  ctx.fillRect(0, 0, size, size);
  // speckle
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  // faint aggregate blotches
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${20 + Math.random() * 40},${20 + Math.random() * 40},${25 + Math.random() * 40},${0.15 + Math.random() * 0.2})`;
    const r = 1 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Damaged asphalt: asphalt + cracks + patched potholes. */
function damagedAsphaltTexture(size = 256) {
  const base = asphaltTexture(size);
  const c = base.image;
  const ctx = c.getContext('2d');
  // cracks
  ctx.strokeStyle = 'rgba(12,12,14,0.75)';
  for (let i = 0; i < 10; i++) {
    ctx.lineWidth = 0.6 + Math.random() * 1.4;
    ctx.beginPath();
    let x = Math.random() * size, y = Math.random() * size;
    ctx.moveTo(x, y);
    const segs = 3 + (Math.random() * 4 | 0);
    for (let s = 0; s < segs; s++) {
      x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // dark patches (filled potholes)
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = 'rgba(18,18,20,0.6)';
    ctx.beginPath();
    ctx.ellipse(Math.random() * size, Math.random() * size, 6 + Math.random() * 10, 5 + Math.random() * 8, Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Concrete sidewalk: light grey with expansion-joint grid. */
function sidewalkTexture(size = 128) {
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = '#6a7078';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(30,34,38,0.55)';
  ctx.lineWidth = 2;
  for (let g = 0; g <= size; g += size / 2) {
    ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(size, g); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Grass / ground: mottled dark green. */
function grassTexture(size = 128) {
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = '#1f3324';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const g = 30 + Math.random() * 60;
    ctx.fillStyle = `rgba(${20 + Math.random() * 20},${g},${28 + Math.random() * 20},0.5)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* ---- material library ---------------------------------------------------- */

export class MaterialLibrary {
  constructor(quality = 'high') {
    this.quality = quality;
    this.textures = [];
    this._m = {};
    this._build();
  }

  _tex(fn, repeat) {
    const t = fn();
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    this.textures.push(t);
    return t;
  }

  _build() {
    const hi = this.quality === 'high' || this.quality === 'ultra';

    // Surfaces
    this.asphalt = new THREE.MeshStandardMaterial({
      map: this._tex(() => asphaltTexture(hi ? 256 : 128)),
      roughness: 0.94, metalness: 0.0, color: 0xffffff
    });
    this.asphaltDamaged = new THREE.MeshStandardMaterial({
      map: this._tex(() => damagedAsphaltTexture(hi ? 256 : 128)),
      roughness: 0.98, metalness: 0.0, color: 0xdadada
    });
    this.intersection = new THREE.MeshStandardMaterial({
      map: this._tex(() => asphaltTexture(hi ? 256 : 128)),
      roughness: 0.9, metalness: 0.0, color: 0xe4e8ec
    });
    this.sidewalk = new THREE.MeshStandardMaterial({
      map: this._tex(() => sidewalkTexture()), roughness: 0.85, color: 0xd8dde2
    });
    this.curb = new THREE.MeshStandardMaterial({ color: 0xc8ccce, roughness: 0.8 });
    this.grass = new THREE.MeshStandardMaterial({
      map: this._tex(() => grassTexture()), roughness: 1.0, color: 0xcfe0cf
    });
    this.ground = new THREE.MeshStandardMaterial({ color: 0x14201a, roughness: 1.0 });

    // Markings — unlit so they stay crisp regardless of lighting/weather
    this.lineWhite = new THREE.MeshBasicMaterial({ color: 0xf2f4f6 });
    this.lineYellow = new THREE.MeshBasicMaterial({ color: 0xf2c14e });
    this.stopLine = new THREE.MeshBasicMaterial({ color: 0xf2f4f6 });
    this.crosswalk = new THREE.MeshBasicMaterial({ color: 0xe8ebee });
    this.arrow = new THREE.MeshBasicMaterial({ color: 0xf0f2f4 });

    // Structure
    this.curbYellow = new THREE.MeshStandardMaterial({ color: 0xd8b64a, roughness: 0.7 });
    this.poleMetal = new THREE.MeshStandardMaterial({ color: 0x6b7178, roughness: 0.55, metalness: 0.6 });
    this.poleDark = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.6, metalness: 0.4 });
    this.signalHousing = new THREE.MeshStandardMaterial({ color: 0x181d23, roughness: 0.55, metalness: 0.3 });
    this.signBack = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.6, metalness: 0.4 });
    this.barrier = new THREE.MeshStandardMaterial({ color: 0xe4623a, roughness: 0.7 });
    this.barrierStripe = new THREE.MeshBasicMaterial({ color: 0xf4f4f4 });
    this.cone = new THREE.MeshStandardMaterial({ color: 0xff6a2b, roughness: 0.7 });
    this.glassLit = new THREE.MeshBasicMaterial({ color: 0xffe6b0 });

    // Foliage
    this.trunk = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.9 });
    this.leaf = new THREE.MeshStandardMaterial({ color: 0x2f6a3c, roughness: 0.95 });
    this.leafPalm = new THREE.MeshStandardMaterial({ color: 0x357544, roughness: 0.95 });

    // Water
    this.water = new THREE.MeshStandardMaterial({ color: 0x24506e, roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.92 });
  }

  /** Building façade material with a lit-window texture, cached per palette index. */
  building(colorHex, litFraction = 0.35) {
    const key = `bldg_${colorHex}_${Math.round(litFraction * 10)}`;
    if (this._m[key]) return this._m[key];
    const { c, ctx } = makeCanvas(128);
    const base = new THREE.Color(colorHex);
    ctx.fillStyle = `#${base.getHexString()}`;
    ctx.fillRect(0, 0, 128, 128);
    // window grid
    const cols = 6, rows = 8, mx = 10, my = 8;
    const ww = (128 - mx * (cols + 1)) / cols;
    const wh = (128 - my * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const lit = Math.random() < litFraction;
        ctx.fillStyle = lit ? `rgba(255,224,160,${0.7 + Math.random() * 0.3})` : 'rgba(18,24,32,0.85)';
        ctx.fillRect(mx + col * (ww + mx), my + r * (wh + my), ww, wh);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.textures.push(tex);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.05 });
    this._m[key] = mat;
    return mat;
  }

  /** Wet-look adjustment: raise reflectivity of road surfaces (brief §11). */
  setWet(wet) {
    const rough = wet ? 0.5 : 0.94;
    const metal = wet ? 0.35 : 0.0;
    for (const m of [this.asphalt, this.intersection]) {
      m.roughness = rough; m.metalness = metal; m.needsUpdate = true;
    }
    this.asphaltDamaged.roughness = wet ? 0.7 : 0.98;
  }

  dispose() {
    for (const t of this.textures) t.dispose();
    for (const k in this) {
      const v = this[k];
      if (v && v.isMaterial) v.dispose();
    }
    for (const k in this._m) this._m[k].dispose();
  }
}
