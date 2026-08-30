// ==========================
// THE CAMPUS
//
// Rebuilt to the photographs, and the thing the previous version got most
// wrong was scale. The clock tower is small — about thirteen metres — and
// the complex stands right over it: the glass gem's nose comes almost to
// the fountain kerb and its ridge is more than twice the tower's height.
// Modelling them far away and roughly the tower's size is what made the
// scene read as an empty field with an ornament in it.
//
// One unit here is about 0.68 m, set by the tower. Everything below is
// dimensioned from that.
// ==========================
import {
  Group, Mesh, BoxGeometry, CylinderGeometry, InstancedMesh, Object3D,
  BufferGeometry, Float32BufferAttribute, Shape, ExtrudeGeometry,
  MeshStandardMaterial, Color, SRGBColorSpace, Vector3, DoubleSide
} from 'three';
import { chamferedBox, coping, curtainWall, shadowed } from './Architecture.js';

const U = 1 / 0.68;                    // metres to scene units

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BuildingGeometry {
  constructor(materials, quality) {
    this.m = materials;
    this.q = quality;
    this.low = quality.get('name') === 'low';
    this.group = new Group();
    this.group.name = 'campus';
    this.litWindows = [];
    this._build();
  }

  get object() { return this.group; }

  _build() {
    this.group.add(
      this.gem(),
      this.stoneBlock(),
      this.highRise(),
      this.signBlock(),
      this.screenBlock(),
      this.link()
    );
  }

  // =========================================================
  // THE GLASS GEM
  //
  // A crystal the size of a building: one great triangulated plane facing
  // the plaza, folded back along a ridge, with the nose coming down to the
  // red beams over the entrance. Panelled in a triangular lattice with
  // aluminium capping on every joint, and a scatter of pale opaque panels
  // among the glass — which on the real building is stone, and is what
  // stops a glazed slope reading as a mirror.
  // =========================================================
  gem() {
    const M = n => this.m.get(n);
    const g = new Group();
    g.name = 'gem';

    // Metres, then converted. The ridge runs roughly north-east, the great
    // plane faces the fountain, and the nose lands just past the kerb.
    const P = (x, y, z) => new Vector3(x * U + 15, y * U, z * U - 20);
    const N  = P(-6.5, 0.4, 13.5);   // the nose, over the doors
    const A  = P(-2.0, 15.5, 5.0);   // the head of the leading arris
    const R  = P(-7.5, 22.5, -6.0);  // the apex, back and west
    const S  = P(9.5, 15.0, -8.0);   // the eastern shoulder
    const W1 = P(-15.5, 0.4, 5.5), W2 = P(-17.5, 7.5, -9.5);
    const E1 = P(14.0, 0.4, 2.5),  E2 = P(16.5, 5.0, -11.0);
    const B1 = P(-15.5, 0.4, -13.0), B2 = P(14.0, 0.4, -13.5);

    const faces = [
      [N, W1, A], [N, A, E1],                 // the two great planes
      [W1, W2, A], [W2, R, A],
      [A, R, S], [A, S, E1],
      [E1, S, E2], [W2, S, R], [W2, E2, S],
      [W2, B1, E2], [B1, B2, E2]              // the back, closing the solid
    ];

    const sub = this.low ? 3 : 5;
    const glassPos = [], stonePos = [];
    const r = rng(7);
    const at = (p0, p1, p2, i, j) => new Vector3().copy(p0)
      .addScaledVector(new Vector3().subVectors(p1, p0), i / sub)
      .addScaledVector(new Vector3().subVectors(p2, p0), j / sub);

    for (const [p0, p1, p2] of faces) {
      for (let i = 0; i < sub; i++) {
        for (let j = 0; i + j < sub; j++) {
          const a = at(p0, p1, p2, i, j), b = at(p0, p1, p2, i + 1, j), c = at(p0, p1, p2, i, j + 1);
          const bin = r() > 0.86 ? stonePos : glassPos;
          bin.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
          if (i + j < sub - 1) {
            const d = at(p0, p1, p2, i + 1, j + 1);
            const bin2 = r() > 0.86 ? stonePos : glassPos;
            bin2.push(b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
          }
        }
      }
    }
    for (const [src, mat, name] of [[glassPos, M('glass-dark'), 'gem-glass'],
                                    [stonePos, M('paint-white'), 'gem-stone']]) {
      if (!src.length) continue;
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(src, 3));
      geo.computeVertexNormals();
      const m = new Mesh(geo, mat);
      m.name = name;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }

    // the dark interior behind the glazing
    const shell = new BufferGeometry();
    const sp = [];
    for (const [p0, p1, p2] of faces) sp.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    shell.setAttribute('position', new Float32BufferAttribute(sp, 3));
    shell.computeVertexNormals();
    const inner = new Mesh(shell, M('glass-spandrel'));
    inner.scale.setScalar(0.955);
    inner.position.set(15 * 0.045, 0.4, -20 * 0.045);
    g.add(inner);

    // ---- the lattice ---------------------------------------------------
    // Aluminium capping on the panel joints of the two plaza-facing planes,
    // and on every arris. This is the diagonal grid you actually see.
    const tube = (a, b, rad, mat) => {
      const d = new Vector3().subVectors(b, a);
      const len = d.length();
      if (len < 0.01) return null;
      const m = new Mesh(new CylinderGeometry(rad, rad, len, this.low ? 4 : 6), mat);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize());
      m.castShadow = true;
      return m;
    };
    const cap = 0.045 * U;
    for (const [p0, p1, p2] of [[N, W1, A], [N, A, E1], [A, R, S], [A, S, E1]]) {
      for (let i = 0; i <= sub; i++) {
        for (let j = 0; i + j <= sub; j++) {
          const a = at(p0, p1, p2, i, j);
          if (i + j < sub) {
            const b = at(p0, p1, p2, i + 1, j), c = at(p0, p1, p2, i, j + 1);
            const t1 = tube(a, b, cap, M('aluminium')); if (t1) g.add(t1);
            const t2 = tube(a, c, cap, M('aluminium')); if (t2) g.add(t2);
            const t3 = tube(b, c, cap * 0.8, M('aluminium')); if (t3) g.add(t3);
          }
        }
      }
    }
    for (const [a, b] of [[N, A], [N, W1], [N, E1], [W1, A], [E1, A], [W1, W2],
                          [E1, E2], [W2, R], [E2, S], [R, A], [A, S], [R, S]]) {
      const t = tube(a, b, cap * 1.5, M('aluminium')); if (t) g.add(t);
    }

    // ---- the red beams -------------------------------------------------
    // The V under the nose. Painted steel, and the one saturated thing in
    // the whole composition.
    const apex = P(-6.5, 7.0, 11.0);
    for (const s of [-1, 1]) {
      const foot = P(-6.5 + s * 3.2, 0.3, 14.6);
      const t = tube(foot, apex, 0.26 * U, M('paint-red'));
      if (t) g.add(t);
      const t2 = tube(foot, P(-6.5 + s * 1.4, 4.0, 12.8), 0.2 * U, M('paint-red'));
      if (t2) g.add(t2);
    }

    // ---- the entrance ---------------------------------------------------
    const doorC = P(-6.5, 0, 12.0);
    const doors = new Mesh(new BoxGeometry(9 * U, 4.2 * U, 0.3), M('glass-vision'));
    doors.position.copy(doorC).setY(2.1 * U);
    g.add(doors);
    const soffit = new Mesh(chamferedBox(11 * U, 0.5 * U, 3.4 * U, 0.06), M('concrete'));
    soffit.position.copy(doorC).setY(4.3 * U).setZ(doorC.z + 1.4 * U);
    g.add(soffit);

    return shadowed(g);
  }

  // =========================================================
  // THE WHITE STONE BLOCK
  //
  // Tall, stepped, faced in pale stone, cut with triangular openings, and
  // with the green vertical panels down its western bay that are the thing
  // you recognise it by.
  // =========================================================
  stoneBlock() {
    const M = n => this.m.get(n);
    const g = new Group();
    g.name = 'stone-block';
    const cx = -13, cz = -34;
    const W = 24, D = 20, H = 50;
    const r = rng(23);

    // the perforated front skin, with the triangles cut clean through
    const face = new Shape();
    face.moveTo(-W / 2, 0); face.lineTo(W / 2, 0);
    face.lineTo(W / 2, H); face.lineTo(-W / 2, H); face.closePath();

    const cols = 5, rows = 9;
    for (let c = 0; c < cols; c++) {
      for (let row = 1; row < rows; row++) {
        if (r() > 0.62) continue;
        const bw = W / cols;
        const sz = bw * (0.3 + r() * 0.36);
        const px = -W / 2 + bw * c + (bw - sz) * (0.15 + r() * 0.7);
        const py = 2.4 + (H - 6) * (row / rows) + r() * 0.8;
        const hole = new Shape();
        if (r() > 0.45) { hole.moveTo(px, py); hole.lineTo(px + sz, py); hole.lineTo(px + sz / 2, py + sz); }
        else { hole.moveTo(px, py + sz); hole.lineTo(px + sz, py + sz); hole.lineTo(px + sz / 2, py); }
        hole.closePath();
        face.holes.push(hole);
      }
    }
    const skin = new ExtrudeGeometry(face, {
      depth: 1.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.06,
      bevelSegments: 1, curveSegments: 1
    });
    skin.computeVertexNormals();
    const front = new Mesh(skin, M('limestone'));
    front.position.set(cx, 0, cz + D / 2 - 1.1);
    g.add(front);

    // the mass behind it, and the dark cavity the openings look into
    const body = new Mesh(chamferedBox(W - 0.4, H, D - 1.3, 0.1), M('limestone'));
    body.position.set(cx, 0, cz - 0.6);
    const cavity = new Mesh(new BoxGeometry(W - 1.2, H - 4, 0.7), M('glass-spandrel'));
    cavity.position.set(cx, 2, cz + D / 2 - 1.9);
    g.add(body, cavity);

    // stepped massing: a set-back tower on the west, a lower wing east
    const tower = new Mesh(chamferedBox(W * 0.52, H * 0.3, D * 0.7, 0.1), M('limestone'));
    tower.position.set(cx - W * 0.16, H, cz - D * 0.1);
    const wing = new Mesh(chamferedBox(W * 0.44, H * 0.46, D * 0.62, 0.1), M('limestone'));
    wing.position.set(cx + W * 0.36, 0, cz + D * 0.28);
    g.add(tower, wing);
    for (const [m, w, d, h] of [[tower, W * 0.52, D * 0.7, H + H * 0.3],
                                [wing, W * 0.44, D * 0.62, H * 0.46]]) {
      const c = new Mesh(coping(w, d, 0.42, 0.22), M('limestone-honed'));
      c.position.set(m.position.x, h, m.position.z);
      g.add(c);
    }

    // ---- the green panels -----------------------------------------------
    const greenMat = M('paint-green');
    for (let i = 0; i < 4; i++) {
      const panel = new Mesh(chamferedBox(0.9, H * 0.5, 0.5, 0.03), greenMat);
      panel.position.set(cx - W / 2 + 1.6 + i * 1.5, H * 0.22, cz + D / 2 + 0.25);
      g.add(panel);
    }
    for (let i = 0; i < 3; i++) {
      const band = new Mesh(chamferedBox(6.4, 0.7, 0.35, 0.03), greenMat);
      band.position.set(cx - W / 2 + 3.6, H * 0.2 + i * H * 0.17, cz + D / 2 + 0.22);
      g.add(band);
    }

    // ---- glazing --------------------------------------------------------
    const bay = curtainWall({
      width: 6.6, height: H * 0.42, cols: 3, rows: 9,
      glassMat: M('glass-vision'), mullionMat: M('aluminium'),
      spandrelMat: M('glass-spandrel'), spandrelEvery: 3
    });
    bay.position.set(cx + W / 2 - 4.6, H * 0.24 + H * 0.21, cz + D / 2 + 0.2);
    g.add(bay);

    return shadowed(g);
  }

  // =========================================================
  // THE HIGH-RISE
  // =========================================================
  highRise() {
    const M = n => this.m.get(n);
    const g = new Group();
    g.name = 'high-rise';
    const cx = 34, cz = -64, W = 17, D = 16, H = 68;

    const core = new Mesh(chamferedBox(W, H, D, 0.16), M('concrete-dark'));
    core.position.set(cx, 0, cz);
    g.add(core);

    // Every floor of glazing on the two visible faces as one InstancedMesh
    // each — twenty floors of panes is the exact case instancing is for.
    const floors = this.low ? 12 : 20;
    const paneW = 2.4, paneH = 2.4;
    for (const [isSouth, faceZ, faceX] of [[true, cz + D / 2 + 0.08, cx], [false, cz, cx - W / 2 - 0.08]]) {
      const span = isSouth ? W - 1.6 : D - 1.6;
      const per = Math.max(1, Math.floor(span / (paneW + 0.3)));
      const total = floors * per;
      const panes = new InstancedMesh(new BoxGeometry(paneW, paneH, 0.18), M('glass-vision'), total);
      const mulls = new InstancedMesh(new BoxGeometry(0.16, paneH + 0.9, 0.34), M('aluminium'), total + floors);
      const o = new Object3D();
      let n = 0, mn = 0;
      for (let f = 0; f < floors; f++) {
        const y = 3.2 + f * (H - 6) / floors;
        for (let i = 0; i < per; i++) {
          const off = -(per - 1) * (paneW + 0.3) / 2 + i * (paneW + 0.3);
          if (isSouth) { o.position.set(faceX + off, y, faceZ); o.rotation.set(0, 0, 0); }
          else { o.position.set(faceX, y, cz + off); o.rotation.set(0, Math.PI / 2, 0); }
          o.updateMatrix(); panes.setMatrixAt(n++, o.matrix);
          if (isSouth) o.position.set(faceX + off - (paneW + 0.3) / 2, y, faceZ + 0.14);
          else o.position.set(faceX - 0.14, y, cz + off - (paneW + 0.3) / 2);
          o.updateMatrix(); mulls.setMatrixAt(mn++, o.matrix);
        }
      }
      panes.count = n; mulls.count = mn;
      panes.instanceMatrix.needsUpdate = true;
      mulls.instanceMatrix.needsUpdate = true;
      panes.castShadow = true;
      g.add(panes, mulls);
      this.litWindows.push(panes);
    }

    const crown = new Mesh(chamferedBox(W * 0.76, 3.2, D * 0.76, 0.12), M('concrete'));
    crown.position.set(cx, H, cz);
    const mast = new Mesh(new CylinderGeometry(0.12, 0.2, 8, 8), M('steel-dark'));
    mast.position.set(cx, H + 7, cz);
    g.add(crown, mast);
    return shadowed(g);
  }

  // =========================================================
  // THE DARK BLOCK WITH THE NAME
  // =========================================================
  signBlock() {
    const M = n => this.m.get(n);
    const g = new Group();
    g.name = 'sign-block';
    const cx = 48, cz = -44, W = 26, D = 19, H = 30;

    const body = new Mesh(chamferedBox(W, H, D, 0.12), M('concrete-dark'));
    body.position.set(cx, 0, cz);
    g.add(body);

    const floors = 6, paneW = 2.1, paneH = 2.6;
    const per = Math.floor((W - 2.2) / (paneW + 0.28));
    const panes = new InstancedMesh(new BoxGeometry(paneW, paneH, 0.2), M('glass-vision'), floors * per);
    const o = new Object3D();
    let n = 0;
    for (let f = 0; f < floors; f++) {
      const y = 2.6 + f * (H - 6) / floors;
      for (let i = 0; i < per; i++) {
        o.position.set(cx - (per - 1) * (paneW + 0.28) / 2 + i * (paneW + 0.28), y, cz + D / 2 + 0.06);
        o.rotation.set(0, 0, 0); o.updateMatrix();
        panes.setMatrixAt(n++, o.matrix);
      }
    }
    panes.count = n;
    panes.instanceMatrix.needsUpdate = true;
    g.add(panes);
    this.litWindows.push(panes);

    const cap = new Mesh(coping(W, D, 0.6, 0.26), M('concrete'));
    cap.position.set(cx, H, cz);
    const sign = new Mesh(chamferedBox(W * 0.5, 2.1, 0.4, 0.04), M('paint-green'));
    sign.position.set(cx - W * 0.14, H * 0.84, cz + D / 2 + 0.16);
    const lit = new Mesh(new BoxGeometry(W * 0.48, 1.8, 0.08), M('sign-lit'));
    lit.position.set(cx - W * 0.14, H * 0.84 + 1.05, cz + D / 2 + 0.38);
    const roundel = new Mesh(new CylinderGeometry(2.1, 2.1, 0.3, 24), M('paint-green'));
    roundel.rotation.x = Math.PI / 2;
    roundel.position.set(cx + W * 0.3, H * 0.86, cz + D / 2 + 0.2);
    g.add(cap, sign, lit, roundel);
    return shadowed(g);
  }

  // =========================================================
  // THE LONG BUILDING WITH THE PERFORATED SCREEN
  // =========================================================
  screenBlock() {
    const M = n => this.m.get(n);
    const g = new Group();
    g.name = 'screen-block';
    const cx = 74, cz = -22, W = 40, D = 22, H = 27;

    const body = new Mesh(chamferedBox(W, H, D, 0.14), M('limestone'));
    body.position.set(cx, 0, cz);
    g.add(body);

    const cols = this.low ? 20 : 40, rows = 7;
    const cellH = (H - 3) / rows;
    const fins = new InstancedMesh(
      new BoxGeometry(0.18, cellH - 0.4, 0.42), M('paint-white'), cols * rows
    );
    const o = new Object3D();
    let n = 0;
    for (let c = 0; c < cols; c++) {
      for (let r2 = 0; r2 < rows; r2++) {
        o.position.set(
          cx - W / 2 + 1.1 + c * ((W - 2.2) / (cols - 1)),
          2 + r2 * cellH + cellH / 2,
          cz + D / 2 + 0.22
        );
        o.rotation.set(0, 0, 0); o.updateMatrix();
        fins.setMatrixAt(n++, o.matrix);
      }
    }
    fins.count = n;
    fins.instanceMatrix.needsUpdate = true;
    fins.castShadow = true;
    g.add(fins);

    for (let r2 = 1; r2 < rows; r2++) {
      const band = new Mesh(new BoxGeometry(W - 1.6, 0.42, 0.5), M('limestone-honed'));
      band.position.set(cx, 2 + r2 * cellH, cz + D / 2 + 0.2);
      g.add(band);
    }

    // the diagonal stair across the face
    const x0 = cx - W * 0.3, x1 = cx + W * 0.16, y0 = 1.4, y1 = H * 0.78;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const slab = new Mesh(new BoxGeometry(len, 0.55, 3.2), M('concrete'));
    slab.position.set((x0 + x1) / 2, (y0 + y1) / 2, cz + D / 2 + 1.7);
    slab.rotation.z = ang;
    g.add(slab);
    for (const s of [-1, 1]) {
      const rail = new Mesh(new BoxGeometry(len, 0.2, 0.2), M('paint-red'));
      rail.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 1.4, cz + D / 2 + 1.7 + s * 1.5);
      rail.rotation.z = ang;
      g.add(rail);
    }

    const cap = new Mesh(coping(W, D, 0.6, 0.26), M('limestone-honed'));
    cap.position.set(cx, H, cz);
    g.add(cap);
    return shadowed(g);
  }

  // The glazed link between the gem and the stone block, and the drum.
  link() {
    const M = n => this.m.get(n);
    const g = new Group();
    const drum = new Mesh(new CylinderGeometry(3.4, 3.4, 44, this.low ? 12 : 24, 1, true), M('glass-vision'));
    drum.position.set(2, 22, -36);
    const core = new Mesh(new CylinderGeometry(1.9, 1.9, 44, this.low ? 10 : 18), M('concrete'));
    core.position.set(2, 22, -36);
    g.add(drum, core);
    for (let i = 0; i <= 9; i++) {
      const ring = new Mesh(new CylinderGeometry(3.5, 3.5, 0.18, this.low ? 12 : 24), M('aluminium'));
      ring.position.set(2, i * 44 / 9, -36);
      g.add(ring);
    }
    const cap = new Mesh(new CylinderGeometry(3.9, 3.5, 0.7, this.low ? 12 : 24), M('concrete'));
    cap.position.set(2, 44.3, -36);
    g.add(cap);
    return shadowed(g);
  }

  setAccent(k) {
    for (const w of this.litWindows) {
      if (w.material.emissive) {
        w.material.emissive.setHex(0x33465c);
        w.material.emissiveIntensity = 0.5 * k;
      }
    }
  }
}

export { MeshStandardMaterial, Color, SRGBColorSpace, DoubleSide };
