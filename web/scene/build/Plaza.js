// ==========================
// THE PLAZA AND THE ROAD
//
// The ground the landmark stands on, and the roundabout the road makes
// around it. Built as real annular surfaces at slightly different heights
// rather than as one textured disc, because the step between paving and
// kerb and asphalt is a real step and catches a real shadow.
//
// The jets are here rather than in the water because they are geometry —
// thin tapered cones of atomised water standing up from the rim — and the
// water surface is a shader.
// ==========================
import {
  Group, Mesh, CylinderGeometry, ConeGeometry, BoxGeometry, InstancedMesh,
  Object3D, MeshStandardMaterial, Color, SRGBColorSpace, DoubleSide
} from 'three';
import { steppedRing, chamferedBox, shadowed } from './Architecture.js';

export const PLAZA = { pool: 9.0, kerb: 10.35, inner: 15.5, roadIn: 17.5, roadOut: 23.5 };

export class Plaza {
  constructor(materials, quality, sky) {
    this.m = materials;
    this.q = quality;
    this.sky = sky;
    this.group = new Group();
    this.group.name = 'plaza';
    this.lampPositions = [];
    this._build();
  }

  get object() { return this.group; }

  _build() {
    const M = n => this.m.get(n);
    const seg = this.q.get('name') === 'low' ? 48 : 88;

    // ---- the paved circle ----------------------------------------------
    const paving = new Mesh(
      steppedRing({ inner: PLAZA.kerb, outer: PLAZA.inner, height: 0.06, segments: seg }),
      M('paving')
    );
    paving.position.y = 0.06;
    paving.receiveShadow = true;
    this.group.add(paving);

    // a band of finer paving inside it, laid to the circle
    const fine = new Mesh(
      steppedRing({ inner: PLAZA.kerb, outer: PLAZA.kerb + 1.9, height: 0.02, segments: seg }),
      M('paving-fine')
    );
    fine.position.y = 0.115;
    fine.receiveShadow = true;
    this.group.add(fine);

    // ---- the kerb the road stops at -------------------------------------
    const kerb = new Mesh(
      steppedRing({ inner: PLAZA.inner, outer: PLAZA.roadIn, height: 0.14, segments: seg }),
      M('concrete')
    );
    kerb.position.y = 0.14;
    kerb.receiveShadow = true;
    this.group.add(kerb);

    // ---- the road --------------------------------------------------------
    const road = new Mesh(
      steppedRing({ inner: PLAZA.roadIn, outer: PLAZA.roadOut, height: 0.03, segments: seg }),
      M('asphalt')
    );
    road.position.y = 0.03;
    road.receiveShadow = true;
    this.group.add(road);

    // the dashed lane line, instanced — 24 identical dashes is exactly the
    // case instancing exists for
    const dashGeo = new BoxGeometry(0.16, 0.012, 1.5);
    const dashMat = new MeshStandardMaterial({
      color: new Color().setHex(0xd8d3c4, SRGBColorSpace), roughness: 0.85, metalness: 0
    });
    const dashes = new InstancedMesh(dashGeo, dashMat, 26);
    const dummy = new Object3D();
    const rm = (PLAZA.roadIn + PLAZA.roadOut) / 2;
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2;
      dummy.position.set(Math.cos(a) * rm, 0.045, Math.sin(a) * rm);
      dummy.rotation.set(0, -a, 0);
      dummy.updateMatrix();
      dashes.setMatrixAt(i, dummy.matrix);
    }
    dashes.instanceMatrix.needsUpdate = true;
    this.group.add(dashes);

    // ---- the jets --------------------------------------------------------
    // Tapered cones, alternating tall and short, leaning inward. Emissive so
    // bloom catches them and they read as atomised rather than as plastic.
    const jetMat = new MeshStandardMaterial({
      color: new Color().setHex(0xdff0ff, SRGBColorSpace),
      emissive: new Color().setHex(0x8fc4e8, SRGBColorSpace),
      emissiveIntensity: 0.14,
      roughness: 0.25, metalness: 0, transparent: true, opacity: 0.5,
      depthWrite: false, side: DoubleSide
    });
    this.jetMaterial = jetMat;
    const N = this.q.get('name') === 'low' ? 12 : 24;
    const jets = new Group();
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2;
      const tall = i % 2 === 0;
      const h = tall ? 2.9 : 2.05;
      const r = PLAZA.pool - 1.9;
      const cone = new Mesh(new ConeGeometry(0.075, h, 7, 3, true), jetMat);
      cone.position.set(Math.cos(a) * r, 0.5 + h / 2, Math.sin(a) * r);
      // leaning in toward the tower, which is where they actually point
      cone.rotation.z = Math.cos(a) * 0.19;
      cone.rotation.x = -Math.sin(a) * 0.19;
      jets.add(cone);
    }
    jets.visible = false;
    this.jets = jets;
    this.group.add(jets);

    // ---- lamps ------------------------------------------------------------
    const lampCount = this.q.get('name') === 'low' ? 6 : 10;
    for (let i = 0; i < lampCount; i++) {
      const a = i / lampCount * Math.PI * 2 + 0.4;
      const x = Math.cos(a) * 19.5, z = Math.sin(a) * 19.5;
      this.group.add(this._lamp(x, z));
      this.lampPositions.push({ x, y: 3.9, z });
    }

    // ---- benches -----------------------------------------------------------
    for (const a of [0.9, 2.4, 3.9, 5.4]) {
      this.group.add(this._bench(Math.cos(a) * 12.6, Math.sin(a) * 12.6, -a));
    }
  }

  _lamp(x, z) {
    const M = n => this.m.get(n);
    const g = new Group();
    const base = new Mesh(new CylinderGeometry(0.15, 0.19, 0.28, 10), M('concrete'));
    base.position.y = 0.14;
    const post = new Mesh(new CylinderGeometry(0.055, 0.075, 3.5, 10), M('lamp-body'));
    post.position.y = 1.75;
    const arm = new Mesh(new BoxGeometry(0.5, 0.06, 0.08), M('lamp-body'));
    arm.position.set(0.2, 3.5, 0);
    const head = new Mesh(new CylinderGeometry(0.16, 0.1, 0.16, 10), M('lamp-body'));
    head.position.set(0.42, 3.44, 0);
    const lit = new Mesh(new CylinderGeometry(0.115, 0.095, 0.04, 10), M('lamp-lit'));
    lit.position.set(0.42, 3.35, 0);
    g.add(base, post, arm, head, lit);
    g.position.set(x, 0.06, z);
    this._lit = this._lit || [];
    this._lit.push(lit);
    return shadowed(g, true, false);
  }

  _bench(x, z, rot) {
    const M = n => this.m.get(n);
    const g = new Group();
    const seat = new Mesh(chamferedBox(1.7, 0.09, 0.46, 0.02), M('bark'));
    seat.position.y = 0.44;
    const back = new Mesh(chamferedBox(1.7, 0.09, 0.1, 0.02), M('bark'));
    back.position.set(0, 0.86, -0.2);
    back.rotation.x = -0.18;
    for (const s of [-1, 1]) {
      const leg = new Mesh(chamferedBox(0.09, 0.44, 0.42, 0.015), M('steel-dark'));
      leg.position.set(s * 0.66, 0, 0);
      g.add(leg);
      const stay = new Mesh(chamferedBox(0.06, 0.44, 0.06, 0.01), M('steel-dark'));
      stay.position.set(s * 0.66, 0.44, -0.2);
      g.add(stay);
    }
    g.add(seat, back);
    g.position.set(x, 0.12, z);
    g.rotation.y = rot;
    return shadowed(g);
  }

  // The jets and the lamp glass come up together with the accent lighting.
  setAccent(k) {
    this.jets.visible = k > 0.02;
    this.jetMaterial.opacity = 0.34 * k;
    this.jetMaterial.emissiveIntensity = 0.14 * k;
  }
}
