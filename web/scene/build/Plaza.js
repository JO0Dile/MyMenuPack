// ==========================
// THE PLAZA AND THE ROAD
//
// النافورة وطريق — the fountain and a road, and nothing else. No buildings,
// no hill, no city. The whole disc floats in space, so it has an edge: the
// paving stops, the road stops, and past that there is nothing but stars.
//
// Because there is nothing to look at but this, everything here is built to
// be looked at closely: the paving is laid in real courses, the road has a
// crown and a kerb, and the edge of the disc is a real thickness rather
// than an infinitely thin plane seen from below.
// ==========================
import {
  Group, Mesh, CylinderGeometry, ConeGeometry, BoxGeometry, InstancedMesh,
  Object3D, MeshStandardMaterial, Color, SRGBColorSpace, DoubleSide
} from 'three';
import { steppedRing, shadowed } from './Architecture.js';

export const PLAZA = {
  pool: 9.0,
  kerbOut: 10.6,
  paved: 22.0,
  roadIn: 23.4,
  roadOut: 31.0,
  rim: 33.0
};

export class Plaza {
  constructor(materials, quality) {
    this.m = materials;
    this.q = quality;
    this.low = quality.get('name') === 'low';
    this.group = new Group();
    this.group.name = 'plaza';
    this.lampPositions = [];
    this._build();
  }

  get object() { return this.group; }

  _build() {
    const M = n => this.m.get(n);
    const seg = this.low ? 64 : 128;

    // ---- the paving, in real courses -------------------------------------
    // Ten concentric courses alternating between the two stones, each a real
    // annulus at its own height, so every joint takes a shadow. A single
    // textured disc would read as a texture; this reads as laid work.
    const courses = this.low ? 6 : 10;
    for (let i = 0; i < courses; i++) {
      const r0 = PLAZA.kerbOut + (PLAZA.paved - PLAZA.kerbOut) * (i / courses);
      const r1 = PLAZA.kerbOut + (PLAZA.paved - PLAZA.kerbOut) * ((i + 1) / courses);
      const band = new Mesh(
        steppedRing({ inner: r0, outer: r1 + 0.015, height: 0.055 + (i % 2) * 0.014, segments: seg }),
        M(i % 2 ? 'paving' : 'paving-fine')
      );
      band.position.y = 0.02;
      band.receiveShadow = true;
      band.name = 'course' + i;
      this.group.add(band);
    }

    // radial joints, so the courses read as laid to the circle rather than
    // as concentric rings of paint
    const joints = this.low ? 36 : 72;
    const jointGeo = new BoxGeometry(PLAZA.paved - PLAZA.kerbOut, 0.012, 0.055);
    const jointMesh = new InstancedMesh(jointGeo, M('concrete-dark'), joints);
    const o = new Object3D();
    const mid = (PLAZA.kerbOut + PLAZA.paved) / 2;
    for (let i = 0; i < joints; i++) {
      const a = i / joints * Math.PI * 2;
      o.position.set(Math.cos(a) * mid, 0.095, Math.sin(a) * mid);
      o.rotation.set(0, -a, 0);
      o.updateMatrix();
      jointMesh.setMatrixAt(i, o.matrix);
    }
    jointMesh.instanceMatrix.needsUpdate = true;
    this.group.add(jointMesh);

    // the fine apron round the basin, laid tighter
    const apron = new Mesh(
      steppedRing({ inner: PLAZA.pool + 0.16, outer: PLAZA.kerbOut, height: 0.075, segments: seg }),
      M('paving-fine')
    );
    apron.position.y = 0.02;
    apron.receiveShadow = true;
    apron.name = 'apron';
    this.group.add(apron);

    // ---- the kerb ---------------------------------------------------------
    const kerb = new Mesh(
      steppedRing({ inner: PLAZA.paved, outer: PLAZA.roadIn, height: 0.16, segments: seg }),
      M('limestone-honed')
    );
    kerb.position.y = 0.02;
    kerb.receiveShadow = true;
    kerb.castShadow = true;
    kerb.name = 'kerb';
    this.group.add(kerb);

    // ---- الطريق ------------------------------------------------------------
    const road = new Mesh(
      steppedRing({ inner: PLAZA.roadIn, outer: PLAZA.roadOut, height: 0.035, segments: seg }),
      M('asphalt')
    );
    road.position.y = 0.02;
    road.receiveShadow = true;
    road.name = 'road';
    this.group.add(road);

    // the lane line, dashed
    const dashes = this.low ? 22 : 40;
    const dashMat = new MeshStandardMaterial({
      color: new Color().setHex(0xe8e3d4, SRGBColorSpace), roughness: 0.78, metalness: 0
    });
    const dashMesh = new InstancedMesh(new BoxGeometry(0.19, 0.013, 1.9), dashMat, dashes);
    const rm = (PLAZA.roadIn + PLAZA.roadOut) / 2;
    for (let i = 0; i < dashes; i++) {
      const a = i / dashes * Math.PI * 2;
      o.position.set(Math.cos(a) * rm, 0.06, Math.sin(a) * rm);
      o.rotation.set(0, -a, 0);
      o.updateMatrix();
      dashMesh.setMatrixAt(i, o.matrix);
    }
    dashMesh.instanceMatrix.needsUpdate = true;
    this.group.add(dashMesh);

    // the white edge line at the outer kerb
    const edgeLine = new Mesh(
      steppedRing({ inner: PLAZA.roadOut - 0.55, outer: PLAZA.roadOut - 0.28, height: 0.012, segments: seg }),
      dashMat
    );
    edgeLine.position.y = 0.056;
    this.group.add(edgeLine);

    // ---- the edge of the world --------------------------------------------
    // The disc has to end somewhere, and an infinitely thin plane seen from
    // slightly below is the one thing that would give the whole illusion
    // away. So it has a real thickness and a chamfered underside.
    const rim = new Mesh(
      new CylinderGeometry(PLAZA.rim, PLAZA.rim - 0.55, 1.5, seg, 1, true),
      M('concrete')
    );
    rim.position.y = -0.73;
    rim.material.side = DoubleSide;
    rim.receiveShadow = true;
    rim.name = 'rim';
    this.group.add(rim);

    const verge = new Mesh(
      steppedRing({ inner: PLAZA.roadOut, outer: PLAZA.rim, height: 0.03, segments: seg }),
      M('concrete')
    );
    verge.position.y = 0.02;
    verge.receiveShadow = true;
    this.group.add(verge);

    const soffit = new Mesh(new CylinderGeometry(PLAZA.rim - 0.55, 1.2, 2.6, seg, 1, true), M('concrete-dark'));
    soffit.position.y = -2.2;
    soffit.material.side = DoubleSide;
    this.group.add(soffit);

    // ---- the jets ----------------------------------------------------------
    const jetMat = new MeshStandardMaterial({
      color: new Color().setHex(0xf2f9ff, SRGBColorSpace),
      emissive: new Color().setHex(0x9ecfee, SRGBColorSpace),
      emissiveIntensity: 0.18,
      roughness: 0.2, metalness: 0, transparent: true, opacity: 0.36,
      depthWrite: false, side: DoubleSide
    });
    this.jetMaterial = jetMat;
    const jets = new Group();
    jets.name = 'jets';
    const JN = this.low ? 16 : 28;
    for (let i = 0; i < JN; i++) {
      const a = i / JN * Math.PI * 2;
      const tall = i % 2 === 0;
      const h = tall ? 2.7 : 1.9;
      const r = PLAZA.pool - 1.5;
      const cone = new Mesh(new ConeGeometry(0.075, h, 7, 3, true), jetMat);
      cone.position.set(Math.cos(a) * r, 0.5 + h / 2, Math.sin(a) * r);
      cone.rotation.z = Math.cos(a) * 0.17;
      cone.rotation.x = -Math.sin(a) * 0.17;
      jets.add(cone);
    }
    jets.visible = false;
    this.jets = jets;
    this.group.add(jets);

    // ---- lamps -------------------------------------------------------------
    // The only furniture. Four of them, on the verge, because without a
    // single vertical out there the disc has no sense of its own size.
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + Math.PI / 4;
      const rr = PLAZA.roadOut + 1.0;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      this.group.add(this._lamp(x, z, a));
      this.lampPositions.push({ x, y: 4.2, z });
    }

    shadowed(this.group, false, true);
  }

  _lamp(x, z, a) {
    const M = n => this.m.get(n);
    const g = new Group();
    g.name = 'lamp';
    const base = new Mesh(new CylinderGeometry(0.18, 0.24, 0.34, 10), M('concrete'));
    base.position.y = 0.17;
    const post = new Mesh(new CylinderGeometry(0.06, 0.1, 4.0, 10), M('lamp-body'));
    post.position.y = 2.05;
    const arm = new Mesh(new BoxGeometry(0.7, 0.08, 0.1), M('lamp-body'));
    arm.position.set(-0.32, 4.0, 0);
    const head = new Mesh(new CylinderGeometry(0.22, 0.13, 0.22, 10), M('lamp-body'));
    head.position.set(-0.64, 3.9, 0);
    const lit = new Mesh(new CylinderGeometry(0.15, 0.12, 0.05, 10), M('lamp-lit'));
    lit.position.set(-0.64, 3.77, 0);
    g.add(base, post, arm, head, lit);
    g.position.set(x, 0.05, z);
    g.rotation.y = -a;
    [base, post, arm, head].forEach(m => { m.castShadow = true; });
    return g;
  }

  setAccent(k) {
    this.jets.visible = k > 0.02;
    this.jetMaterial.opacity = 0.36 * k;
    this.jetMaterial.emissiveIntensity = 0.18 * k;
  }
}
