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
  // Read off the straight-on photograph rather than invented. It is a
  // folded wedge, not a crystal and not a pyramid:
  //
  //   - one great sloping face of dark blue-green glass, triangulated in a
  //     diagrid, running from a high ridge down to the plaza
  //   - solid WHITE fins folding down at the west end and along the foot,
  //     which are stone, not glazing, and are most of the silhouette
  //   - opaque white triangular panels scattered among the glass, which is
  //     the pattern you actually recognise the building by
  //   - a physical white space frame standing proud of the glazing, built
  //     as real beams rather than drawn as lines
  //   - the red V at the entrance, in structural section, not a stick
  //
  // Named parts, per the brief: glassStructure, spaceFrame, redSupports.
  // =========================================================
  gem() {
    const M = n => this.m.get(n);
    const g = new Group();
    g.name = 'gemBuilding';

    // Metres, converted. The origin of the building is its front-left foot.
    const P = (x, y, z) => new Vector3(x * U + 19, y * U, z * U - 46);

    // ---- the controlling points -----------------------------------------
    // The ridge runs west-high to east-low. The great face hangs off it and
    // meets the plaza along the front edge.
    const RW = P(-13.0, 24.0, -6.0);   // ridge, west and highest
    const RE = P(11.0, 17.5, -9.0);    // ridge, east and lower
    const FW = P(-15.5, 1.0, 11.5);    // front foot, west
    const FE = P(13.5, 1.0, 8.5);      // front foot, east
    const NW = P(-6.0, 8.5, 14.5);     // the nose, where the entrance is
    const BW = P(-15.0, 2.0, -14.0);   // back foot, west
    const BE = P(13.0, 2.0, -15.5);    // back foot, east

    // ---- glassStructure --------------------------------------------------
    // The great face, split about the nose so the fold reads.
    const glass = new Group();
    glass.name = 'glassStructure';
    const faces = [
      { tri: [RW, FW, NW], n: this.low ? 4 : 7 },
      { tri: [RW, NW, RE], n: this.low ? 4 : 7 },
      { tri: [RE, NW, FE], n: this.low ? 4 : 6 }
    ];

    const at = (p0, p1, p2, i, j, n) => new Vector3().copy(p0)
      .addScaledVector(new Vector3().subVectors(p1, p0), i / n)
      .addScaledVector(new Vector3().subVectors(p2, p0), j / n);

    const rnd = rng(31);
    const darkPos = [], palePos = [];
    const joints = [];
    for (const f of faces) {
      const [p0, p1, p2] = f.tri, n = f.n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; i + j < n; j++) {
          const a = at(p0, p1, p2, i, j, n), b = at(p0, p1, p2, i + 1, j, n), c = at(p0, p1, p2, i, j + 1, n);
          // roughly one panel in six is an opaque white triangle
          (rnd() > 0.83 ? palePos : darkPos).push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
          joints.push([a, b], [a, c]);
          if (i + j < n - 1) {
            const d = at(p0, p1, p2, i + 1, j + 1, n);
            (rnd() > 0.83 ? palePos : darkPos).push(b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
            joints.push([b, c]);
          }
        }
      }
    }
    for (const [src, mat, name] of [[darkPos, M('glass-dark'), 'glazing'],
                                    [palePos, M('paint-white'), 'stonePanels']]) {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(src, 3));
      geo.computeVertexNormals();
      const m = new Mesh(geo, mat);
      m.name = name;
      m.castShadow = true; m.receiveShadow = true;
      glass.add(m);
    }
    // the dark interior, so the glazing has something behind it
    const backPos = [];
    const T = (a, b, c) => backPos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    T(RW, RE, BE); T(RW, BE, BW);        // the back slope
    T(BW, BE, FE); T(BW, FE, FW);        // the underside / floor plate
    T(RW, BW, FW); T(RE, FE, BE);        // the two ends
    const back = new BufferGeometry();
    back.setAttribute('position', new Float32BufferAttribute(backPos, 3));
    back.computeVertexNormals();
    const shell = new Mesh(back, M('glass-spandrel'));
    shell.name = 'shell';
    shell.castShadow = true; shell.receiveShadow = true;
    glass.add(shell);
    g.add(glass);

    // ---- the white folding fins ------------------------------------------
    // Solid stone planes, not glazing. They fold down at the west end and
    // along the foot of the great face, and they carry the silhouette.
    const fins = new Group();
    fins.name = 'stoneFins';
    const finPos = [];
    const F = (a, b, c) => finPos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const FW2 = P(-19.5, 1.0, 6.0), RW2 = P(-17.0, 20.0, -7.0);
    F(RW, FW, FW2); F(RW, FW2, RW2);                    // the west fin
    const FE2 = P(17.0, 1.0, 4.0), RE2 = P(14.5, 14.0, -10.0);
    F(RE, FE, FE2); F(RE, FE2, RE2);                    // the east fin
    const finGeo = new BufferGeometry();
    finGeo.setAttribute('position', new Float32BufferAttribute(finPos, 3));
    finGeo.computeVertexNormals();
    const finMesh = new Mesh(finGeo, M('limestone'));
    finMesh.name = 'fins';
    finMesh.castShadow = true; finMesh.receiveShadow = true;
    finMesh.material.side = DoubleSide;
    fins.add(finMesh);
    g.add(fins);

    // ---- spaceFrame ------------------------------------------------------
    // Real beams standing proud of the glazing on the diagrid joints, and
    // heavier members on every arris. Instanced: one geometry, one material,
    // several hundred transforms.
    const frame = new Group();
    frame.name = 'spaceFrame';
    const unit = new CylinderGeometry(1, 1, 1, this.low ? 4 : 6, 1);
    const dummy = new Object3D();
    const up = new Vector3(0, 1, 0);
    const build = (list, radius, mat, name) => {
      const mesh = new InstancedMesh(unit, mat, list.length);
      mesh.name = name;
      let k = 0;
      for (const [a, b] of list) {
        const d = new Vector3().subVectors(b, a);
        const len = d.length();
        if (len < 0.02) continue;
        dummy.position.copy(a).addScaledVector(d, 0.5);
        dummy.quaternion.setFromUnitVectors(up, d.clone().normalize());
        dummy.scale.set(radius, len, radius);
        dummy.updateMatrix();
        mesh.setMatrixAt(k++, dummy.matrix);
      }
      mesh.count = k;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      return mesh;
    };
    frame.add(build(joints, 0.038 * U, M('paint-white'), 'diagrid'));
    frame.add(build([[RW, RE], [RW, FW], [RE, FE], [FW, NW], [NW, FE],
                     [RW, NW], [RE, NW], [RW, RW2], [RE, RE2],
                     [FW, FW2], [FE, FE2]], 0.13 * U, M('paint-white'), 'arrises'));
    g.add(frame);

    // ---- redSupports -----------------------------------------------------
    // A V in structural section: two rectangular members meeting at a point
    // just above the paving, splaying up to carry the nose. Thick, because
    // in the photographs they plainly are.
    const red = new Group();
    red.name = 'redSupports';
    const foot = P(-6.0, 0.4, 12.2);
    for (const s of [-1, 1]) {
      const head = P(-6.0 + s * 4.2, 8.2, 13.4);
      const d = new Vector3().subVectors(head, foot);
      const len = d.length();
      const beam = new Mesh(new BoxGeometry(0.62 * U, len, 0.42 * U), M('paint-red'));
      beam.position.copy(foot).addScaledVector(d, 0.5);
      beam.quaternion.setFromUnitVectors(up, d.clone().normalize());
      beam.castShadow = true;
      red.add(beam);
    }
    const shoe = new Mesh(new CylinderGeometry(0.5 * U, 0.62 * U, 0.7 * U, 10), M('steel-dark'));
    shoe.position.copy(foot).setY(0.35 * U);
    red.add(shoe);
    g.add(red);

    // ---- the entrance ----------------------------------------------------
    const doors = new Mesh(new BoxGeometry(11 * U, 4.4 * U, 0.3), M('glass-vision'));
    doors.position.set(P(-6, 0, 10.6).x, 2.2 * U, P(-6, 0, 10.6).z);
    doors.name = 'entrance';
    g.add(doors);

    return g;
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
    const cx = -22, cz = -62;
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
    const cx = 40, cz = -92, W = 17, D = 16, H = 68;

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
    const cx = 56, cz = -70, W = 26, D = 19, H = 30;

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
    const cx = 82, cz = -44, W = 40, D = 22, H = 27;

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
    drum.position.set(-4, 22, -62);
    const core = new Mesh(new CylinderGeometry(1.9, 1.9, 44, this.low ? 10 : 18), M('concrete'));
    core.position.set(-4, 22, -62);
    g.add(drum, core);
    for (let i = 0; i <= 9; i++) {
      const ring = new Mesh(new CylinderGeometry(3.5, 3.5, 0.18, this.low ? 12 : 24), M('aluminium'));
      ring.position.set(-4, i * 44 / 9, -62);
      g.add(ring);
    }
    const cap = new Mesh(new CylinderGeometry(3.9, 3.5, 0.7, this.low ? 12 : 24), M('concrete'));
    cap.position.set(-4, 44.3, -62);
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
