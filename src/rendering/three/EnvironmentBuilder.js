import * as THREE from 'three';

/**
 * EnvironmentBuilder — the Philippine roadside (brief §12): dense low/mid-rise
 * buildings and small establishments, tropical trees & palms, concrete utility
 * poles with wires, street lights, speed-limit signs, plus incident furniture
 * (construction barriers, traffic cones) placed on blocked lanes. Landmarks
 * (church spire, plaza, market, school, civic) get distinct treatments.
 *
 * Static geometry is merged aggressively; dynamic incident props are tracked so
 * they can be added/removed as incidents change.
 */

export class EnvironmentBuilder {
  constructor(materials, quality = 'high') {
    this.mat = materials;
    this.quality = quality;
    this.group = new THREE.Group();
    this.incidentGroup = new THREE.Group();
    this.streetLamps = [];   // {mesh} emissive lamp meshes for night/weather
    this.trees = [];         // {top, baseY, x, z} for wind sway
    this._built = false;
  }

  build(scene, net, def, W, Z) {
    this.net = net; this.W = W; this.Z = Z;
    scene.add(this.group);
    scene.add(this.incidentGroup);

    this._buildGround(def, net, W, Z);
    this._buildBuildings(def, W, Z);
    this._buildLandmarks(def, W, Z);
    this._buildRoadside(net, W, Z);
    this._buildSigns(net, W, Z);
    this._buildWaterGreens(def, W, Z);
    this._built = true;
  }

  _buildGround(def, net, W, Z) {
    const b = net.bounds;
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(b.maxX - b.minX + 1400, b.maxY - b.minY + 1400),
      this.mat.ground
    );
    g.rotation.x = -Math.PI / 2;
    g.position.set(W((b.minX + b.maxX) / 2), -0.05, Z((b.minY + b.maxY) / 2));
    g.receiveShadow = this.quality !== 'low';
    this.group.add(g);
  }

  _palette(i) {
    const pal = [0xb7bcc2, 0xa6b0b8, 0xc6c2b4, 0x9aa6ad, 0xbfb0a0, 0xa8b4bc, 0xd0cabd];
    return pal[i % pal.length];
  }

  _buildBuildings(def, W, Z) {
    const shadow = this.quality === 'high' || this.quality === 'ultra';
    let bi = 0;
    for (const bl of def.blocks || []) {
      const [bx, by, bw, bh] = bl;
      const cols = Math.max(1, Math.round(bw / 40));
      const rows = Math.max(1, Math.round(bh / 40));
      const cw = bw / cols, ch = bh / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.12) { bi++; continue; } // occasional gap / lot
          const pad = 2 + Math.random() * 3;
          const w = cw - pad, d = ch - pad;
          const floors = 1 + (bi * 7 + r * 3 + c) % 4;   // 1–4 storeys, provincial
          const hgt = 3.2 * floors + (Math.random() * 1.5);
          const litFrac = 0.15 + Math.random() * 0.4;
          const mat = this.mat.building(this._palette(bi), litFrac);
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
          m.position.set(W(bx + (c + 0.5) * cw), hgt / 2, Z(by + (r + 0.5) * ch));
          m.castShadow = m.receiveShadow = shadow;
          this.group.add(m);
          // simple flat roof parapet / rooftop tank for realism
          if (floors >= 2 && Math.random() < 0.5) {
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 8), this.mat.poleMetal);
            tank.position.set(m.position.x + (Math.random() - 0.5) * w * 0.4, hgt + 0.6, m.position.z + (Math.random() - 0.5) * d * 0.4);
            this.group.add(tank);
          }
          bi++;
        }
      }
    }
  }

  _buildLandmarks(def, W, Z) {
    const shadow = this.quality === 'high' || this.quality === 'ultra';
    const colors = { plaza: 0x6f8f6a, church: 0xd8cdb0, civic: 0x9fb4c4, market: 0xc9a86a, school: 0xb0a6c8 };
    for (const lm of def.landmarks || []) {
      const cx = W(lm.x + lm.w / 2), cz = Z(lm.y + lm.h / 2);
      if (lm.kind === 'plaza') {
        const m = new THREE.Mesh(new THREE.BoxGeometry(lm.w, 0.3, lm.h), new THREE.MeshStandardMaterial({ color: colors.plaza, roughness: 0.9 }));
        m.position.set(cx, 0.15, cz); m.receiveShadow = shadow; this.group.add(m);
        // gazebo
        const gz = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 0.4, 8), this.mat.curb);
        gz.position.set(cx, 0.5, cz); this.group.add(gz);
        continue;
      }
      const hgt = lm.kind === 'church' ? 9 : lm.kind === 'school' ? 7 : 8;
      const m = new THREE.Mesh(new THREE.BoxGeometry(lm.w, hgt, lm.h), new THREE.MeshStandardMaterial({ color: colors[lm.kind] || 0xb0b6bd, roughness: 0.85 }));
      m.position.set(cx, hgt / 2, cz);
      m.castShadow = m.receiveShadow = shadow;
      this.group.add(m);
      if (lm.kind === 'church') {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(lm.w * 0.28, hgt * 0.7, lm.h * 0.28), m.material);
        tower.position.set(cx - lm.w * 0.3, hgt * 0.85, cz);
        const spire = new THREE.Mesh(new THREE.ConeGeometry(lm.w * 0.16, 4.5, 6), new THREE.MeshStandardMaterial({ color: 0x7a6a44, roughness: 0.7 }));
        spire.position.set(cx - lm.w * 0.3, hgt * 1.2 + 2.25, cz);
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.16), this.mat.curb);
        cross.position.set(cx - lm.w * 0.3, hgt * 1.2 + 4.9, cz);
        this.group.add(tower, spire, cross);
      }
    }
  }

  _buildRoadside(net, W, Z) {
    const lw = net.laneWidth;
    const step = this.quality === 'low' ? 60 : 38;
    const seen = new Set();
    for (const link of net.links) {
      if (link.id.endsWith('_B')) continue; // one pass per road
      if (seen.has(link.roadId)) continue;
      seen.add(link.roadId);
      const spine = link.spine || link.lanes[0].poly;
      const off = link.lanes.length * lw + 3.2;
      for (let s = step / 2; s < spine.length; s += step) {
        const p = spine.at(s);
        const nx = Math.cos(p.heading + Math.PI / 2), ny = Math.sin(p.heading + Math.PI / 2);
        for (const side of [-1, 1]) {
          const wx = W(p.x + nx * off * side), wz = Z(p.y + ny * off * side);
          const kind = (Math.floor(s / step) + (side + 1)) % 3;
          if (kind === 0) this._tree(wx, wz);
          else if (kind === 1) this._palm(wx, wz);
          else if (link.main) this._streetLight(wx, wz, p.heading, side);
          else this._utilityPole(wx, wz);
        }
      }
    }
  }

  _tree(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.2, 6), this.mat.trunk);
    trunk.position.set(x, 1.1, z);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.7 + Math.random() * 0.5, 7, 6), this.mat.leaf);
    top.position.set(x, 3.1, z);
    top.scale.y = 0.9;
    top.castShadow = this.quality === 'high' || this.quality === 'ultra';
    this.group.add(trunk, top);
    this.trees.push({ top, x, z, baseY: 3.1 });
  }

  _palm(x, z) {
    const h = 4.5 + Math.random() * 1.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, h, 6), this.mat.trunk);
    trunk.position.set(x, h / 2, z);
    this.group.add(trunk);
    const frondMat = this.mat.leafPalm;
    for (let i = 0; i < 6; i++) {
      const fr = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.4, 4), frondMat);
      const a = (i / 6) * Math.PI * 2;
      fr.position.set(x + Math.cos(a) * 0.9, h + 0.2, z + Math.sin(a) * 0.9);
      fr.rotation.z = Math.PI / 2.4 * (i % 2 ? 1 : -1);
      fr.rotation.y = a;
      this.group.add(fr);
      this.trees.push({ top: fr, x, z, baseY: h + 0.2 });
    }
  }

  _streetLight(x, z, heading, side) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 6.5, 6), this.mat.poleMetal);
    pole.position.set(x, 3.25, z);
    // arm reaching over the road
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.1), this.mat.poleMetal);
    const dirx = -Math.cos(heading + Math.PI / 2) * side, dirz = Math.sin(heading + Math.PI / 2) * side;
    arm.position.set(x + dirx * 1.0, 6.4, z + dirz * 1.0);
    arm.rotation.y = -heading;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), this.mat.glassLit);
    lamp.position.set(x + dirx * 2.0, 6.3, z + dirz * 2.0);
    this.group.add(pole, arm, lamp);
    this.streetLamps.push(lamp);
  }

  _utilityPole(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 6), this.mat.poleDark);
    pole.position.set(x, 3.75, z);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.6), this.mat.poleDark);
    cross.position.set(x, 6.8, z);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.2), this.mat.poleDark);
    cross2.position.set(x, 6.3, z);
    this.group.add(pole, cross, cross2);
  }

  /* speed-limit signs on main road approaches */
  _buildSigns(net, W, Z) {
    const lw = net.laneWidth;
    const KMH = 3.6;
    const seen = new Set();
    for (const link of net.links) {
      if (!link.main) continue;
      if (seen.has(link.roadId + link.id.slice(-1))) continue;
      seen.add(link.roadId + link.id.slice(-1));
      const spine = link.spine || link.lanes[0].poly;
      if (spine.length < 40) continue;
      const p = spine.at(spine.length * 0.35);
      const off = link.lanes.length * lw + 2.4;
      const nx = Math.cos(p.heading + Math.PI / 2), ny = Math.sin(p.heading + Math.PI / 2);
      const wx = W(p.x + nx * off), wz = Z(p.y + ny * off);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 6), this.mat.poleMetal);
      pole.position.set(wx, 1.5, wz);
      const limit = Math.round((link.lanes[0].speedLimit * KMH) / 5) * 5;
      const sign = this._speedSign(limit);
      sign.position.set(wx, 3.0, wz);
      sign.rotation.y = -p.heading + Math.PI / 2;
      this.group.add(pole, sign);
    }
  }

  _speedSign(limit) {
    const { c, ctx } = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; return { c: cv, ctx: cv.getContext('2d') }; })();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = '#c62828'; ctx.stroke();
    ctx.fillStyle = '#111'; ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(limit), 64, 68);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), mat);
    m.userData.tex = tex;
    return m;
  }

  _buildWaterGreens(def, W, Z) {
    for (const wtr of def.water || []) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wtr.w, wtr.h), this.mat.water);
      m.rotation.x = -Math.PI / 2;
      m.position.set(W(wtr.x + wtr.w / 2), -0.02, Z(wtr.y + wtr.h / 2));
      this.group.add(m);
    }
    for (const g of def.greens || []) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(g[2], g[3]), this.mat.grass);
      m.rotation.x = -Math.PI / 2;
      m.position.set(W(g[0] + g[2] / 2), -0.01, Z(g[1] + g[3] / 2));
      m.receiveShadow = this.quality !== 'low';
      this.group.add(m);
    }
  }

  /**
   * Rebuild incident furniture (cones + barriers) from the incident manager.
   * Called by the renderer when incidents change. Places props on the blocked
   * arc-length of each incident lane (brief §10).
   */
  syncIncidents(incidents, W, Z) {
    // clear
    while (this.incidentGroup.children.length) {
      const c = this.incidentGroup.children.pop();
      c.traverse?.(o => { if (o.geometry) o.geometry.dispose(); });
      this.incidentGroup.remove(c);
    }
    for (const inc of incidents.incidents || []) {
      const lane = inc.lane;
      if (!lane) continue;
      const from = Number.isFinite(lane.blockedFrom) ? lane.blockedFrom : (inc.at ?? lane.length * 0.5);
      // cones fanning back from the blockage
      for (let k = 0; k < 5; k++) {
        const s = Math.max(0, from - k * 3);
        const p = lane.at(s);
        const nx = Math.cos(p.heading + Math.PI / 2), ny = Math.sin(p.heading + Math.PI / 2);
        const lat = (k % 2 ? 0.6 : -0.6);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 8), this.mat.cone);
        cone.position.set(W(p.x + nx * lat), 0.35, Z(p.y + ny * lat));
        this.incidentGroup.add(cone);
      }
      // barrier bar at the blockage
      const pb = lane.at(from);
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, this.net.laneWidth * 0.9), this.mat.barrier);
      barrier.position.set(W(pb.x), 0.5, Z(pb.y));
      barrier.rotation.y = -pb.heading;
      this.incidentGroup.add(barrier);
    }
  }

  /** Toggle street-lamp emissive glow (night / low-visibility weather). */
  setLampsOn(on) {
    for (const l of this.streetLamps) l.visible = on;
  }

  swayTrees(time) {
    for (let i = 0; i < this.trees.length; i++) {
      const t = this.trees[i];
      t.top.position.x = t.x + Math.sin(time * 1.8 + i) * 0.06;
    }
  }

  dispose(scene) {
    for (const grp of [this.group, this.incidentGroup]) {
      grp.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.userData?.tex) o.userData.tex.dispose();
      });
      scene.remove(grp);
    }
    this.streetLamps = []; this.trees = [];
  }
}
