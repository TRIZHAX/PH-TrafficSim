import * as THREE from 'three';

/**
 * TrafficLightBuilder — realistic 3-lamp signal heads on mast-arm poles at each
 * signalized approach (brief §7). Each head has a dark housing, red/amber/green
 * lenses with an emissive glow sprite, a back-plate for contrast, and a small
 * pedestrian signal box on the pole. Heads are positioned to the right of each
 * approach lane group and cantilevered toward the stop line so the driver can
 * always see the relevant signal.
 *
 * update(lights, time) sets which lens is lit per approach from the engine's
 * TrafficLightManager state — 'green' | 'yellow' | 'red' | 'flash'.
 */

const LENS = { red: 0xff3b30, yellow: 0xffc14d, green: 0x2ee06a, off: 0x141414 };
const GLOW = { red: 0xff5a4a, yellow: 0xffd070, green: 0x50f090 };

export class TrafficLightBuilder {
  constructor(materials, quality = 'high') {
    this.mat = materials;
    this.quality = quality;
    this.group = new THREE.Group();
    this.heads = [];      // {node, phase, lenses:{red,yellow,green}, glow, pedGreen, pedRed}
    this._lensGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12);
    this._lensGeo.rotateX(Math.PI / 2); // face +Z locally (toward approach)
  }

  build(scene, net, W, Z) {
    scene.add(this.group);
    for (const sig of net.signals) {
      for (const app of sig.approaches) {
        const link = net.links.find(l => l.id === app.linkId);
        if (!link) continue;
        const lane = link.lanes[link.lanes.length - 1]; // rightmost approach lane
        const end = lane.length;
        const p = lane.at(Math.max(0, end - 0.5));
        const nx = Math.cos(p.heading + Math.PI / 2), ny = Math.sin(p.heading + Math.PI / 2);
        const off = net.laneWidth + 1.4;
        const baseX = p.x + nx * off, baseY = p.y + ny * off;
        this._buildHead(sig.node, app.phase, baseX, baseY, p.heading, W, Z);
      }
    }
    return this.group;
  }

  _buildHead(node, phase, sx, sy, heading, W, Z) {
    const g = new THREE.Group();
    const wx = W(sx), wz = Z(sy);
    g.position.set(wx, 0, wz);
    g.rotation.y = -heading;              // local +X = approach forward direction

    // pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 6.2, 8), this.mat.poleDark);
    pole.position.set(0, 3.1, 0);
    pole.castShadow = this.quality === 'high';
    g.add(pole);

    // mast arm cantilevered forward over the lanes (local +X toward oncoming stop line)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.14, 0.14), this.mat.poleDark);
    arm.position.set(1.4, 6.0, 0);
    g.add(arm);

    // housing hung under the arm
    const housing = new THREE.Group();
    housing.position.set(2.4, 5.2, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.55), this.mat.signBack);
    back.position.set(-0.08, 0, 0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.2, 0.42), this.mat.signalHousing);
    housing.add(back, box);

    // three lenses facing the approaching driver (local -X). Head faces back
    // toward oncoming traffic, so lenses face local -X.
    const mkLens = (yy, colorOff) => {
      const m = new THREE.Mesh(this._lensGeo, new THREE.MeshBasicMaterial({ color: colorOff }));
      m.rotation.y = Math.PI / 2;         // face -X
      m.position.set(-0.2, yy, 0);
      housing.add(m);
      return m;
    };
    const red = mkLens(0.4, LENS.off);
    const yellow = mkLens(0.0, LENS.off);
    const green = mkLens(-0.4, LENS.off);

    // glow sprite (single, repositioned to the lit lamp)
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), new THREE.MeshBasicMaterial({ color: GLOW.red, transparent: true, opacity: 0, depthWrite: false }));
    glow.rotation.y = -Math.PI / 2;
    glow.position.set(-0.26, 0.4, 0);
    housing.add(glow);

    g.add(housing);

    // pedestrian signal box lower on the pole
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.2), this.mat.signalHousing);
    ped.position.set(0.18, 2.6, 0);
    const pedRed = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), new THREE.MeshBasicMaterial({ color: 0x5a1512 }));
    pedRed.position.set(0.02, 2.72, 0.11); pedRed.rotation.y = 0;
    const pedGreen = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), new THREE.MeshBasicMaterial({ color: 0x14351f }));
    pedGreen.position.set(0.02, 2.5, 0.11);
    g.add(ped, pedRed, pedGreen);

    this.group.add(g);
    this.heads.push({ node, phase, lenses: { red, yellow, green }, glow, pedRed, pedGreen });
  }

  /** Update all heads from engine light state. */
  update(lights, time) {
    const flashOn = (time % 1) < 0.5;
    for (const h of this.heads) {
      const state = lights.stateFor(h.node, h.phase);
      const set = (lens, on, litColor) => lens.material.color.setHex(on ? litColor : LENS.off);
      if (state === 'flash') {
        set(h.lenses.red, false, LENS.red);
        set(h.lenses.green, false, LENS.green);
        set(h.lenses.yellow, flashOn, LENS.yellow);
        h.glow.material.opacity = flashOn ? 0.5 : 0;
        h.glow.material.color.setHex(GLOW.yellow);
        h.glow.position.y = 0.0;
      } else {
        set(h.lenses.red, state === 'red', LENS.red);
        set(h.lenses.yellow, state === 'yellow', LENS.yellow);
        set(h.lenses.green, state === 'green', LENS.green);
        const y = state === 'red' ? 0.4 : state === 'yellow' ? 0.0 : -0.4;
        h.glow.position.y = y;
        h.glow.material.opacity = 0.55;
        h.glow.material.color.setHex(GLOW[state] || GLOW.red);
      }
      // pedestrian: walk (green) only when vehicle phase is red
      const walk = state === 'red';
      h.pedGreen.material.color.setHex(walk ? 0x2ee06a : 0x14351f);
      h.pedRed.material.color.setHex(walk ? 0x5a1512 : 0xff3b30);
    }
  }

  dispose(scene) {
    this.group.traverse(o => { if (o.geometry && o.geometry !== this._lensGeo) o.geometry.dispose(); });
    this._lensGeo.dispose();
    scene.remove(this.group);
    this.heads = [];
  }
}
