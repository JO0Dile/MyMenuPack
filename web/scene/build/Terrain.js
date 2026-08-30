// ==========================
// THE HILL
//
// The campus is cut into a ridge, and half of what makes it feel large is
// that the ground does something — falls away to the south, rises to the
// ridges beyond, and carries the shoulder the retaining wall holds up.
//
// One displaced plane rather than a stack of quads: it takes the shadow of
// the landmark, it can be sampled to sit anything else on it, and the
// silhouette against the sky is a real profile rather than a straight line.
// ==========================
import {
  Group, Mesh, PlaneGeometry, InstancedMesh, Object3D, BoxGeometry,
  MeshStandardMaterial, Color, SRGBColorSpace
} from 'three';
import { shadowed } from './Architecture.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The height of the hill at any point. Flat where the campus is — a
// platform was cut for it — then falling away south and rising north into
// the ridges. Deterministic, so it is the same hill every time.
export function heightAt(x, z) {
  const r = Math.hypot(x * 0.86, z + 8);
  // the cut platform
  const platform = 1 - Math.min(1, Math.max(0, (r - 30) / 26));
  const bench = platform * platform * (3 - 2 * platform);

  // south of the road the ground drops off the shoulder
  const drop = Math.max(0, (z - 30) / 22);
  const fall = -Math.pow(Math.min(drop, 1), 1.5) * 16 - Math.max(0, drop - 1) * 9;

  // north: two ridges climbing away
  const rise = Math.max(0, (-z - 60) / 60);
  const climb = Math.pow(Math.min(rise, 1.6), 1.35) * 26;

  const roll = Math.sin(x * 0.021) * 2.4 + Math.sin(x * 0.0063 + 1.7) * 5.2
             + Math.sin((x + z) * 0.013) * 1.8;

  const wild = (1 - bench) * (fall + climb + roll);
  return wild;
}

export class Terrain {
  constructor(materials, quality) {
    this.m = materials;
    this.q = quality;
    this.group = new Group();
    this.group.name = 'terrain';
    this._build();
  }

  get object() { return this.group; }

  _build() {
    const M = n => this.m.get(n);
    const low = this.q.get('name') === 'low';
    const SIZE = 460;
    const SEG = low ? 96 : 180;

    const geo = new PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const ground = new Mesh(geo, M('ground'));
    ground.position.set(0, -0.02, -20);
    ground.receiveShadow = true;
    ground.name = 'hill';
    this.group.add(ground);

    // ---- the retaining wall along the shoulder ---------------------------
    // The one piece of engineering that makes the platform read as *cut*
    // rather than as a lawn: a long curved concrete wall with expansion
    // joints, holding the road up above the fall.
    const wall = new Group();
    const rnd = mulberry32(17);
    const N = low ? 34 : 66;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const a0 = Math.PI * (0.06 + t0 * 0.88), a1 = Math.PI * (0.06 + t1 * 0.88);
      const R = 30.5;
      const x0 = Math.cos(a0) * R * 1.5, z0 = 6 + Math.sin(a0) * R * 0.62;
      const x1 = Math.cos(a1) * R * 1.5, z1 = 6 + Math.sin(a1) * R * 0.62;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const h = 2.6 + rnd() * 0.5;
      const panel = new Mesh(new BoxGeometry(len * 1.02, h, 0.55), M('concrete'));
      panel.position.set(mx, -h / 2 + 0.35, mz);
      panel.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      panel.receiveShadow = true;
      wall.add(panel);
      // the coping along the top, in one continuous run
      const cap = new Mesh(new BoxGeometry(len * 1.02, 0.2, 0.72), M('concrete-dark'));
      cap.position.set(mx, 0.45, mz);
      cap.rotation.y = panel.rotation.y;
      wall.add(cap);
    }
    this.group.add(shadowed(wall, false, true));

    // ---- scrub -------------------------------------------------------------
    // Instanced, and thinned by the quality tier. Nothing here is precious:
    // it exists so the hill is not bare, and it is the first thing to go on
    // a slow device.
    const detail = this.q.get('instancedDetail');
    const count = Math.round((low ? 260 : 700) * detail);
    const bushGeo = new BoxGeometry(1, 1, 1);
    const bushMat = new MeshStandardMaterial({
      color: new Color().setHex(0x6d6a4a, SRGBColorSpace), roughness: 1, metalness: 0
    });
    const bushes = new InstancedMesh(bushGeo, bushMat, count);
    const d = new Object3D();
    const r2 = mulberry32(29);
    let placed = 0;
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const a = r2() * Math.PI * 2;
      const rad = 120 + r2() * 90;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad * 0.82 - 14;
      if (Math.hypot(x * 0.9, z + 30) < 118) continue;   // not on the paved deck
      const y = heightAt(x, z) - 20 * 0 - 0.02;
      const s = 0.5 + r2() * 1.5;
      d.position.set(x, y + s * 0.22, z - 20);
      d.rotation.set(0, r2() * 3.14, 0);
      d.scale.set(s, s * (0.4 + r2() * 0.4), s);
      d.updateMatrix();
      bushes.setMatrixAt(placed++, d.matrix);
    }
    bushes.count = placed;
    bushes.instanceMatrix.needsUpdate = true;
    bushes.castShadow = false;
    bushes.receiveShadow = true;
    this.group.add(bushes);

    // ---- the town on the far ridges ---------------------------------------
    // Instanced white blocks along the two ridges. At that distance a house
    // is four pixels, and four pixels of the right value in the right place
    // is what makes a hillside read as inhabited.
    const houseGeo = new BoxGeometry(1, 1, 1);
    const houseMat = new MeshStandardMaterial({
      color: new Color().setHex(0xd9d3c4, SRGBColorSpace), roughness: 0.95, metalness: 0
    });
    const hc = Math.round((low ? 90 : 210) * detail);
    const houses = new InstancedMesh(houseGeo, houseMat, hc);
    const r3 = mulberry32(53);
    let hp = 0;
    for (let i = 0; i < hc * 3 && hp < hc; i++) {
      const x = (r3() * 2 - 1) * 220;
      const z = -95 - r3() * 120;
      const y = heightAt(x, z);
      if (y < 4) continue;
      const w = 3 + r3() * 5, h = 3 + r3() * 6;
      d.position.set(x, y + h / 2 - 20 * 0, z - 20);
      d.rotation.set(0, r3() * 3.14, 0);
      d.scale.set(w, h, w * (0.7 + r3() * 0.5));
      d.updateMatrix();
      houses.setMatrixAt(hp++, d.matrix);
    }
    houses.count = hp;
    houses.instanceMatrix.needsUpdate = true;
    this.group.add(houses);
  }
}
