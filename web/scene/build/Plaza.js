// ==========================
// THE PLAZA
//
// From the photograph taken out of the glass: the fountain sits at the
// centre of concentric bands of paving that alternate in tone, laid to the
// circle, ringed by a kerb, then the road. Around it — planters with clipped
// shrubs, young trees in tree grilles, benches, and lamp columns.
//
// Every band is a real annulus at its own height, so the step from paving to
// kerb to asphalt is a real step and catches a real shadow.
// ==========================
import {
  Group, Mesh, CylinderGeometry, ConeGeometry, BoxGeometry, SphereGeometry, PlaneGeometry,
  InstancedMesh, Object3D, MeshStandardMaterial, Color, SRGBColorSpace,
  DoubleSide, TorusGeometry
} from 'three';
import { steppedRing, chamferedBox, shadowed } from './Architecture.js';

export const PLAZA = {
  pool: 9.0,
  kerbOut: 10.6,
  paved: 24.0,
  roadIn: 25.6,
  roadOut: 33.0
};

// The camera lands south of the fountain and looks north across it. Nothing
// tall is planted in that sector, for the same reason a real plaza keeps its
// sightline to the landmark clear — and because a tree three metres in front
// of the lens hides the entire thing it was planted to frame.
const VIEW_BEARING = Math.atan2(21.5, -3);      // where the camera stands
function inSightline(a, half) {
  let d = Math.abs(((a - VIEW_BEARING + Math.PI) % (Math.PI * 2)) - Math.PI);
  return d < half;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Plaza {
  constructor(materials, quality) {
    this.m = materials;
    this.q = quality;
    this.low = quality.get('name') === 'low';
    this.group = new Group();
    this.group.name = 'plaza';
    this.lampPositions = [];
    this._lit = [];
    this._build();
  }

  get object() { return this.group; }

  _build() {
    const M = n => this.m.get(n);
    const seg = this.low ? 56 : 104;

    // ---- the paved deck -------------------------------------------------
    // The whole site is paved. In the photographs there is not a square
    // metre of bare ground anywhere near the fountain: concrete and stone
    // from the retaining wall to the foot of every building, with the
    // carriageway running through it. The scene had sand up to the basin,
    // which is why it read as a monument dropped in a desert.
    const deck = new Mesh(new PlaneGeometry(210, 200), M('concrete'));
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(6, 0.005, -46);
    deck.receiveShadow = true;
    deck.name = 'deck';
    this.group.add(deck);

    // the carriageway between the fountain and the buildings, which is what
    // actually holds them apart
    const carriage = new Mesh(new PlaneGeometry(150, 15), M('asphalt'));
    carriage.rotation.x = -Math.PI / 2;
    carriage.position.set(10, 0.012, -36);
    carriage.receiveShadow = true;
    this.group.add(carriage);
    for (let i = 0; i < 22; i++) {
      const dash = new Mesh(new BoxGeometry(2.2, 0.014, 0.2), M('paving-fine'));
      dash.position.set(-56 + i * 6.4, 0.02, -36);
      this.group.add(dash);
    }
    // and the kerb that separates it from the walking surface
    for (const z of [-28.6, -43.4]) {
      const k = new Mesh(new BoxGeometry(150, 0.16, 0.5), M('limestone-honed'));
      k.position.set(10, 0.08, z);
      k.receiveShadow = true; k.castShadow = true;
      this.group.add(k);
    }

    // ---- concentric paving ------------------------------------------------
    // Eight bands out from the fountain, alternating between the two stones.
    // A single textured disc reads as a texture; bands read as laid work,
    // because the joint between them is geometry and takes a shadow.
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      const r0 = PLAZA.kerbOut + (PLAZA.paved - PLAZA.kerbOut) * (i / bands);
      const r1 = PLAZA.kerbOut + (PLAZA.paved - PLAZA.kerbOut) * ((i + 1) / bands);
      const band = new Mesh(
        steppedRing({ inner: r0, outer: r1 + 0.02, height: 0.05 + (i % 2) * 0.012, segments: seg }),
        M(i % 2 ? 'paving' : 'paving-fine')
      );
      band.position.y = 0.02;
      band.receiveShadow = true;
      this.group.add(band);
    }

    // the fine apron immediately round the basin, laid to a tighter ring
    const apron = new Mesh(
      steppedRing({ inner: PLAZA.pool + 0.16, outer: PLAZA.kerbOut, height: 0.07, segments: seg }),
      M('paving-fine')
    );
    apron.position.y = 0.02;
    apron.receiveShadow = true;
    this.group.add(apron);

    // ---- the kerb ---------------------------------------------------------
    const kerb = new Mesh(
      steppedRing({ inner: PLAZA.paved, outer: PLAZA.roadIn, height: 0.17, segments: seg }),
      M('concrete')
    );
    kerb.position.y = 0.02;
    kerb.receiveShadow = true;
    kerb.castShadow = true;
    this.group.add(kerb);

    // ---- the road ---------------------------------------------------------
    const road = new Mesh(
      steppedRing({ inner: PLAZA.roadIn, outer: PLAZA.roadOut, height: 0.04, segments: seg }),
      M('asphalt')
    );
    road.position.y = 0.02;
    road.receiveShadow = true;
    this.group.add(road);

    // lane markings, instanced
    const dashGeo = new BoxGeometry(0.18, 0.014, 2.0);
    const dashMat = new MeshStandardMaterial({
      color: new Color().setHex(0xe6e2d6, SRGBColorSpace), roughness: 0.8, metalness: 0
    });
    const N = this.low ? 20 : 34;
    const dashes = new InstancedMesh(dashGeo, dashMat, N);
    const o = new Object3D();
    const rm = (PLAZA.roadIn + PLAZA.roadOut) / 2;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2;
      o.position.set(Math.cos(a) * rm, 0.07, Math.sin(a) * rm);
      o.rotation.set(0, -a, 0);
      o.updateMatrix();
      dashes.setMatrixAt(i, o.matrix);
    }
    dashes.instanceMatrix.needsUpdate = true;
    this.group.add(dashes);

    // ---- the jets ----------------------------------------------------------
    const jetMat = new MeshStandardMaterial({
      color: new Color().setHex(0xf0f8ff, SRGBColorSpace),
      emissive: new Color().setHex(0x9ecbe8, SRGBColorSpace),
      emissiveIntensity: 0.1,
      roughness: 0.2, metalness: 0, transparent: true, opacity: 0.32,
      depthWrite: false, side: DoubleSide
    });
    this.jetMaterial = jetMat;
    const jets = new Group();
    const JN = this.low ? 14 : 26;
    for (let i = 0; i < JN; i++) {
      const a = i / JN * Math.PI * 2;
      const tall = i % 2 === 0;
      const h = tall ? 2.6 : 1.8;
      const r = PLAZA.pool - 1.5;
      const cone = new Mesh(new ConeGeometry(0.07, h, 7, 3, true), jetMat);
      cone.position.set(Math.cos(a) * r, 0.5 + h / 2, Math.sin(a) * r);
      cone.rotation.z = Math.cos(a) * 0.16;
      cone.rotation.x = -Math.sin(a) * 0.16;
      jets.add(cone);
    }
    jets.visible = false;
    this.jets = jets;
    this.group.add(jets);

    // ---- landscaping --------------------------------------------------------
    this._planting();
    this._furniture();
  }

  // Clipped shrubs in stone planters, and young trees in grilles. Placed on
  // the ring the photographs put them on — between the paving and the kerb,
  // where they do not obstruct the walk round the fountain.
  _planting() {
    const M = n => this.m.get(n);
    const r = rng(11);
    const detail = this.q.get('instancedDetail');
    const ring = PLAZA.paved - 2.6;

    const planters = Math.round((this.low ? 8 : 14) * detail);
    for (let i = 0; i < planters; i++) {
      const a = i / planters * Math.PI * 2 + 0.22;
      if (inSightline(a, 0.34)) continue;
      const g = new Group();
      const pot = new Mesh(new CylinderGeometry(0.86, 0.72, 0.62, this.low ? 8 : 16), M('limestone-honed'));
      pot.position.y = 0.31;
      const rim = new Mesh(new TorusGeometry(0.86, 0.055, 6, this.low ? 10 : 18), M('limestone-honed'));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.62;
      g.add(pot, rim);
      // the shrub: three overlapping spheres, squashed, so it reads as
      // clipped planting rather than as a ball on a stick
      for (let k = 0; k < 3; k++) {
        const s = 0.46 + r() * 0.2;
        const b = new Mesh(new SphereGeometry(s, this.low ? 6 : 10, this.low ? 4 : 7), M('foliage'));
        b.position.set((r() - 0.5) * 0.5, 0.78 + k * 0.16 + r() * 0.1, (r() - 0.5) * 0.5);
        b.scale.y = 0.78;
        g.add(b);
      }
      g.position.set(Math.cos(a) * ring, 0.08, Math.sin(a) * ring);
      this.group.add(shadowed(g));
    }

    const trees = Math.round((this.low ? 6 : 12) * detail);
    for (let i = 0; i < trees; i++) {
      const a = i / trees * Math.PI * 2 + 0.62;
      if (inSightline(a, 0.72)) continue;
      const rr = PLAZA.paved - 5.2;
      this.group.add(this._tree(Math.cos(a) * rr, Math.sin(a) * rr, 2.6 + r() * 1.2, r));
    }
  }

  _tree(x, z, h, r) {
    const M = n => this.m.get(n);
    const g = new Group();
    // the grille the tree stands in, which is what makes it read as planted
    // into paving rather than dropped onto it
    const grille = new Mesh(
      steppedRing({ inner: 0.42, outer: 1.05, height: 0.04, segments: this.low ? 8 : 16 }),
      M('steel-dark')
    );
    g.add(grille);
    const trunk = new Mesh(new CylinderGeometry(0.09, 0.14, h, this.low ? 6 : 9), M('bark'));
    trunk.position.y = h / 2;
    g.add(trunk);
    for (let k = 0; k < 4; k++) {
      const s = 0.72 + r() * 0.42;
      const c = new Mesh(new SphereGeometry(s, this.low ? 6 : 11, this.low ? 5 : 8), M('foliage'));
      c.position.set((r() - 0.5) * 1.0, h + 0.1 + k * 0.34 - (r() * 0.3), (r() - 0.5) * 1.0);
      c.scale.y = 0.82;
      g.add(c);
    }
    g.position.set(x, 0.08, z);
    return shadowed(g);
  }

  _furniture() {
    const M = n => this.m.get(n);
    const lamps = this.low ? 8 : 12;
    for (let i = 0; i < lamps; i++) {
      const a = i / lamps * Math.PI * 2 + 0.3;
      if (inSightline(a, 0.3)) continue;
      const rr = PLAZA.paved - 1.0;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      this.group.add(this._lamp(x, z, a));
      this.lampPositions.push({ x, y: 4.3, z });
    }
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.9;
      const rr = PLAZA.kerbOut + 3.2;
      this.group.add(this._bench(Math.cos(a) * rr, Math.sin(a) * rr, -a + Math.PI / 2));
    }
    void M;
  }

  _lamp(x, z, a) {
    const M = n => this.m.get(n);
    const g = new Group();
    const base = new Mesh(new CylinderGeometry(0.17, 0.22, 0.34, 10), M('concrete'));
    base.position.y = 0.17;
    const post = new Mesh(new CylinderGeometry(0.06, 0.09, 3.9, 10), M('lamp-body'));
    post.position.y = 2.0;
    const arm = new Mesh(new BoxGeometry(0.62, 0.07, 0.09), M('lamp-body'));
    arm.position.set(0.28, 3.9, 0);
    const head = new Mesh(new CylinderGeometry(0.2, 0.12, 0.2, 10), M('lamp-body'));
    head.position.set(0.55, 3.82, 0);
    const lit = new Mesh(new CylinderGeometry(0.14, 0.11, 0.045, 10), M('lamp-lit'));
    lit.position.set(0.55, 3.7, 0);
    g.add(base, post, arm, head, lit);
    this._lit.push(lit);
    g.position.set(x, 0.08, z);
    g.rotation.y = -a;
    return shadowed(g, true, false);
  }

  _bench(x, z, rot) {
    const M = n => this.m.get(n);
    const g = new Group();
    for (let i = 0; i < 4; i++) {
      const slat = new Mesh(chamferedBox(1.9, 0.07, 0.13, 0.015), M('bark'));
      slat.position.set(0, 0.45, -0.24 + i * 0.16);
      g.add(slat);
    }
    for (let i = 0; i < 3; i++) {
      const slat = new Mesh(chamferedBox(1.9, 0.07, 0.12, 0.015), M('bark'));
      slat.position.set(0, 0.66 + i * 0.17, -0.3);
      slat.rotation.x = -0.2;
      g.add(slat);
    }
    for (const s of [-1, 1]) {
      const leg = new Mesh(chamferedBox(0.1, 0.45, 0.56, 0.02), M('steel-dark'));
      leg.position.set(s * 0.76, 0, 0);
      const up = new Mesh(chamferedBox(0.08, 0.62, 0.09, 0.02), M('steel-dark'));
      up.position.set(s * 0.76, 0.45, -0.3);
      g.add(leg, up);
    }
    g.position.set(x, 0.08, z);
    g.rotation.y = rot;
    return shadowed(g);
  }

  setAccent(k) {
    this.jets.visible = k > 0.02;
    this.jetMaterial.opacity = 0.32 * k;
    this.jetMaterial.emissiveIntensity = 0.1 * k;
  }
}
