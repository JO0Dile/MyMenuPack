// ==========================
// BUILDING GEOMETRY
//
// The complex the landmark stands in front of, as volumetric solids. Every
// mass here is a Mesh with real thickness; the glazing is transmissive
// glass in aluminium framing that stands proud of it; the trusses are
// tubes, not lines.
// ==========================
import {
  Group, Mesh, BoxGeometry, CylinderGeometry, PlaneGeometry, InstancedMesh,
  Object3D, BufferGeometry, Float32BufferAttribute, Shape, ExtrudeGeometry,
  DoubleSide, Vector3
} from 'three';
import { chamferedBox, coping, curtainWall, shadowed } from './Architecture.js';

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
    this.group.name = 'complex';
    this.litWindows = [];
    this._build();
  }

  get object() { return this.group; }

  _build() {
    this.group.add(
      this.gem(16, -38, 1.25),
      this.cutBlock(-9, -48, 16, 15, 21),
      this.stairDrum(30, -50, 2.4, 21),
      this.signBlock(50, -52, 20, 15, 20),
      this.screenBlock(66, -30, 30, 17, 19),
      this.highRise(30, -84, 14, 13, 44),
      this.gatehouse(84, -14)
    );
  }

  // ---- the gem -------------------------------------------------------
  // A closed faceted solid, panelled in transmissive glass, with the
  // diagonal trusses that actually hold that geometry up expressed on the
  // outside as tubes running along every arris.
  gem(cx, cz, k) {
    const M = n => this.m.get(n);
    const g = new Group();
    g.name = 'gem';
    const V = (x, y, z) => new Vector3(cx + x * k, y * k, cz + z * k);

    const N = V(-2, 0.4, 18), A = V(0, 15, 1), R = V(-6, 17, -7), S = V(11, 11, -8);
    const W1 = V(-17, 0.4, 7), W2 = V(-19, 6, -10);
    const E1 = V(16, 0.4, 3), E2 = V(18, 4, -11);
    // the footprint, closing the solid underneath so it is a volume
    const F = [N, W1, W2, E2, E1];

    const faces = [
      [N, W1, A], [N, A, E1], [W1, W2, A], [W2, R, A],
      [A, R, S], [A, S, E1], [E1, S, E2], [W2, S, R], [W2, E2, S]
    ];

    // The glazed skin: each facet subdivided into a triangular panel grid,
    // built as one buffer so the whole gem is a single draw call.
    const pos = [];
    const sub = this.low ? 2 : 4;
    for (const [p0, p1, p2] of faces) {
      for (let i = 0; i < sub; i++) {
        for (let j = 0; i + j < sub; j++) {
          const at = (a, b) => new Vector3()
            .copy(p0)
            .addScaledVector(new Vector3().subVectors(p1, p0), a / sub)
            .addScaledVector(new Vector3().subVectors(p2, p0), b / sub);
          const a0 = at(i, j), b0 = at(i + 1, j), c0 = at(i, j + 1);
          pos.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, c0.x, c0.y, c0.z);
          if (i + j < sub - 1) {
            const d0 = at(i + 1, j + 1);
            pos.push(b0.x, b0.y, b0.z, d0.x, d0.y, d0.z, c0.x, c0.y, c0.z);
          }
        }
      }
    }
    // close the base
    for (let i = 1; i < F.length - 1; i++) {
      pos.push(F[0].x, F[0].y, F[0].z, F[i + 1].x, F[i + 1].y, F[i + 1].z, F[i].x, F[i].y, F[i].z);
    }
    const skin = new BufferGeometry();
    skin.setAttribute('position', new Float32BufferAttribute(pos, 3));
    skin.computeVertexNormals();
    const glass = new Mesh(skin, M('glass-dark'));
    glass.castShadow = true;
    glass.receiveShadow = true;
    g.add(glass);

    // A dark shell just inside the glass, so transmission has something to
    // find instead of looking straight through the building.
    const inner = new Mesh(skin.clone().scale(0.965, 0.965, 0.965), M('glass-spandrel'));
    inner.position.set(cx * 0.035, 0.32, cz * 0.035);
    g.add(inner);

    // ---- the trusses --------------------------------------------------
    const arris = [
      [N, A], [N, W1], [N, E1], [W1, A], [E1, A], [W1, W2], [E1, E2],
      [W2, E2], [W2, R], [E2, S], [R, A], [A, S], [R, S], [W2, S]
    ];
    const tubeR = 0.16 * k;
    for (const [a, b] of arris) g.add(this._tube(a, b, tubeR, M('aluminium')));

    // and the diagonal bracing across the two great planes
    for (const [p0, p1, p2] of [[N, W1, A], [N, A, E1]]) {
      const n = this.low ? 2 : 4;
      for (let i = 1; i < n; i++) {
        const f = i / n;
        const a = new Vector3().lerpVectors(p0, p1, f);
        const b = new Vector3().lerpVectors(p0, p2, f);
        g.add(this._tube(a, b, tubeR * 0.62, M('aluminium')));
      }
    }

    // ---- the red struts and the entrance --------------------------------
    const doorC = V(-2, 0, 15.4);
    for (const s of [-1.2, 1.2]) {
      const foot = V(-2 + s * 1.9, 0.3, 16.7);
      const head = V(-2, 5.6, 14.6);
      g.add(this._tube(foot, head, 0.2 * k, M('paint-red')));
    }
    const doors = new Mesh(new BoxGeometry(7.4 * k, 3.8 * k, 0.24), M('glass-vision'));
    doors.position.copy(doorC).setY(1.9 * k);
    g.add(doors);
    const canopy = new Mesh(chamferedBox(9 * k, 0.34, 3 * k, 0.06), M('concrete'));
    canopy.position.copy(doorC).setY(4.0 * k).setZ(doorC.z + 1.1 * k);
    g.add(canopy);

    return shadowed(g);
  }

  _tube(a, b, r, mat) {
    const d = new Vector3().subVectors(b, a);
    const len = d.length();
    const geo = new CylinderGeometry(r, r, len, this.low ? 5 : 8, 1);
    const m = new Mesh(geo, mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
    m.castShadow = true;
    return m;
  }

  // ---- the white block with the triangular openings -------------------
  // The triangles are cut through the wall with ExtrudeGeometry holes, so
  // they are real openings with real reveals — you can see the soffit of
  // each one, and the sun lands inside them.
  cutBlock(cx, cz, w, d, h) {
    const M = n => this.m.get(n);
    const g = new Group();
    g.name = 'cut-block';
    const r = rng(3);

    const face = new Shape();
    face.moveTo(-w / 2, 0); face.lineTo(w / 2, 0);
    face.lineTo(w / 2, h); face.lineTo(-w / 2, h); face.closePath();

    const cols = 4, rows = 6;
    for (let c = 0; c < cols; c++) {
      for (let row = 0; row < rows; row++) {
        if (r() > 0.72) continue;
        const bw = w / cols;
        const sz = bw * (0.34 + r() * 0.4);
        const px = -w / 2 + bw * c + (bw - sz) * (0.2 + r() * 0.6);
        const py = 1.6 + (h - 4) * (row / rows) + r() * 0.6;
        const hole = new Shape();
        if (r() > 0.42) {
          hole.moveTo(px, py); hole.lineTo(px + sz, py); hole.lineTo(px + sz / 2, py + sz);
        } else {
          hole.moveTo(px, py + sz); hole.lineTo(px + sz, py + sz); hole.lineTo(px + sz / 2, py);
        }
        hole.closePath();
        face.holes.push(hole);
      }
    }
    const wallGeo = new ExtrudeGeometry(face, {
      depth: 0.85, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04,
      bevelSegments: 1, curveSegments: 1
    });
    wallGeo.computeVertexNormals();
    const front = new Mesh(wallGeo, M('limestone'));
    front.position.set(cx, 0, cz + d / 2 - 0.85);
    g.add(front);

    // the body behind the perforated skin
    const body = new Mesh(chamferedBox(w - 0.3, h, d - 1, 0.08), M('limestone'));
    body.position.set(cx, 0, cz - 0.42);
    g.add(body);
    // the dark interior seen through the openings
    const cavity = new Mesh(new BoxGeometry(w - 0.6, h - 0.4, 0.5), M('glass-spandrel'));
    cavity.position.set(cx, 0.2, cz + d / 2 - 1.4);
    g.add(cavity);

    // the set-back upper volume and the lower wing
    const upper = new Mesh(chamferedBox(w * 0.62, h * 0.26, d * 0.72, 0.08), M('limestone'));
    upper.position.set(cx - w * 0.14, h, cz - d * 0.1);
    const wing = new Mesh(chamferedBox(w * 0.46, h * 0.52, d * 0.62, 0.08), M('limestone'));
    wing.position.set(cx + w * 0.34, 0, cz + d * 0.3);
    g.add(upper, wing);

    const cap = new Mesh(coping(w * 0.62, d * 0.72, 0.34, 0.16), M('limestone-honed'));
    cap.position.set(cx - w * 0.14, h + h * 0.26, cz - d * 0.1);
    g.add(cap);

    // the coloured fins down the western bay
    for (let i = 0; i < 5; i++) {
      const fin = new Mesh(new BoxGeometry(0.16, h * 0.62, 0.42), M('paint-green'));
      fin.position.set(cx - w / 2 + 0.55 + i * 0.46, h * 0.18 + h * 0.31, cz + d / 2 + 0.1);
      g.add(fin);
    }

    // a glazed band down the eastern edge
    const band = curtainWall({
      width: 3.6, height: h * 0.6, cols: 3, rows: 8,
      glassMat: M('glass-vision'), mullionMat: M('aluminium'), spandrelMat: M('glass-spandrel'),
      spandrelEvery: 3
    });
    band.position.set(cx + w / 2 - 2.4, h * 0.22 + h * 0.3, cz + d / 2 + 0.1);
    g.add(band);

    return shadowed(g);
  }

  // ---- the glazed stair drum ------------------------------------------
  stairDrum(cx, cz, r, h) {
    const M = n => this.m.get(n);
    const g = new Group();
    const seg = this.low ? 10 : 20;
    const skin = new Mesh(new CylinderGeometry(r, r, h, seg, 1, true), M('glass-vision'));
    skin.position.set(cx, h / 2, cz);
    g.add(skin);
    const core = new Mesh(new CylinderGeometry(r * 0.55, r * 0.55, h, seg), M('concrete'));
    core.position.set(cx, h / 2, cz);
    g.add(core);
    for (let i = 0; i <= 7; i++) {
      const ring = new Mesh(new CylinderGeometry(r + 0.06, r + 0.06, 0.12, seg), M('aluminium'));
      ring.position.set(cx, h * i / 7, cz);
      g.add(ring);
    }
    for (let i = 0; i < seg; i += 2) {
      const a = i / seg * Math.PI * 2;
      const mull = new Mesh(new BoxGeometry(0.09, h, 0.14), M('aluminium'));
      mull.position.set(cx + Math.cos(a) * (r + 0.04), h / 2, cz + Math.sin(a) * (r + 0.04));
      mull.rotation.y = -a;
      g.add(mull);
    }
    const cap = new Mesh(new CylinderGeometry(r + 0.25, r + 0.1, 0.4, seg), M('concrete'));
    cap.position.set(cx, h + 0.2, cz);
    g.add(cap);
    return shadowed(g);
  }

  // ---- the dark block that carries the name ----------------------------
  signBlock(cx, cz, w, d, h) {
    const M = n => this.m.get(n);
    const g = new Group();
    const body = new Mesh(chamferedBox(w, h, d, 0.1), M('concrete-dark'));
    body.position.set(cx, 0, cz);
    g.add(body);

    // ribbon glazing, instanced: six floors of identical panes is exactly
    // what InstancedMesh is for
    const floors = 6;
    const paneW = 1.5, paneH = 1.9;
    const perFloor = Math.floor((w - 1.6) / (paneW + 0.22));
    const total = floors * perFloor;
    const panes = new InstancedMesh(new BoxGeometry(paneW, paneH, 0.16), M('glass-vision'), total);
    const mulls = new InstancedMesh(new BoxGeometry(0.12, paneH + 0.5, 0.3), M('aluminium'), total + floors);
    const o = new Object3D();
    let n = 0, mn = 0;
    for (let f = 0; f < floors; f++) {
      const y = 1.7 + f * (h - 2.6) / floors;
      for (let i = 0; i < perFloor; i++) {
        const x = cx - (perFloor - 1) * (paneW + 0.22) / 2 + i * (paneW + 0.22);
        o.position.set(x, y, cz + d / 2 + 0.02); o.rotation.set(0, 0, 0); o.updateMatrix();
        panes.setMatrixAt(n++, o.matrix);
        o.position.set(x - (paneW + 0.22) / 2, y, cz + d / 2 + 0.12); o.updateMatrix();
        mulls.setMatrixAt(mn++, o.matrix);
      }
      o.position.set(cx + (perFloor - 1) * (paneW + 0.22) / 2 + (paneW + 0.22) / 2, y, cz + d / 2 + 0.12);
      o.updateMatrix(); mulls.setMatrixAt(mn++, o.matrix);
    }
    panes.count = n; mulls.count = mn;
    panes.instanceMatrix.needsUpdate = true;
    mulls.instanceMatrix.needsUpdate = true;
    panes.castShadow = true;
    g.add(panes, mulls);
    this.litWindows.push(panes);

    const cap = new Mesh(coping(w, d, 0.42, 0.2), M('concrete'));
    cap.position.set(cx, h, cz);
    g.add(cap);

    // the sign band and the roundel
    const sign = new Mesh(chamferedBox(w * 0.52, 1.5, 0.3, 0.04), M('paint-green'));
    sign.position.set(cx - w * 0.16, h * 0.84, cz + d / 2 + 0.12);
    const lit = new Mesh(new BoxGeometry(w * 0.5, 1.3, 0.06), M('sign-lit'));
    lit.position.set(cx - w * 0.16, h * 0.84 + 0.75, cz + d / 2 + 0.3);
    const roundel = new Mesh(new CylinderGeometry(1.5, 1.5, 0.22, 24), M('paint-green'));
    roundel.rotation.x = Math.PI / 2;
    roundel.position.set(cx + w * 0.28, h * 0.88, cz + d / 2 + 0.16);
    g.add(sign, lit, roundel);
    return shadowed(g);
  }

  // ---- the long white building with the diagonal stair -----------------
  screenBlock(cx, cz, w, d, h) {
    const M = n => this.m.get(n);
    const g = new Group();
    const body = new Mesh(chamferedBox(w, h, d, 0.12), M('limestone'));
    body.position.set(cx, 0, cz);
    g.add(body);

    // the perforated screen: instanced fins standing off the facade, which
    // self-shade and read as a brise-soleil rather than as a pattern
    const cols = this.low ? 18 : 34, rows = 6;
    const finGeo = new BoxGeometry(0.14, (h - 2) / rows - 0.3, 0.34);
    const fins = new InstancedMesh(finGeo, M('paint-white'), cols * rows);
    const o = new Object3D();
    let n = 0;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = cx - w / 2 + 0.8 + c * ((w - 1.6) / (cols - 1));
        const y = 1.3 + r * (h - 2) / rows;
        o.position.set(x, y + ((h - 2) / rows) / 2, cz + d / 2 + 0.18);
        o.rotation.set(0, 0, 0); o.updateMatrix();
        fins.setMatrixAt(n++, o.matrix);
      }
    }
    fins.count = n;
    fins.instanceMatrix.needsUpdate = true;
    fins.castShadow = true;
    g.add(fins);

    for (let r = 1; r < rows; r++) {
      const band = new Mesh(new BoxGeometry(w - 1.2, 0.34, 0.4), M('limestone-honed'));
      band.position.set(cx, 1.3 + r * (h - 2) / rows, cz + d / 2 + 0.16);
      g.add(band);
    }

    // the diagonal stair, as a real box with treads and a red balustrade
    const x0 = cx - w * 0.34, x1 = cx + w * 0.16, y0 = 1.0, y1 = h * 0.8;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const slab = new Mesh(new BoxGeometry(len, 0.4, 2.4), M('concrete'));
    slab.position.set((x0 + x1) / 2, (y0 + y1) / 2, cz + d / 2 + 1.3);
    slab.rotation.z = ang;
    g.add(slab);
    for (const side of [-1, 1]) {
      const rail = new Mesh(new BoxGeometry(len, 0.16, 0.16), M('paint-red'));
      rail.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 1.05, cz + d / 2 + 1.3 + side * 1.15);
      rail.rotation.z = ang;
      g.add(rail);
    }

    const cap = new Mesh(coping(w, d, 0.5, 0.22), M('limestone-honed'));
    cap.position.set(cx, h, cz);
    g.add(cap);
    return shadowed(g);
  }

  // ---- the high-rise ---------------------------------------------------
  highRise(cx, cz, w, d, h) {
    const M = n => this.m.get(n);
    const g = new Group();
    const core = new Mesh(chamferedBox(w, h, d, 0.14), M('concrete-dark'));
    core.position.set(cx, 0, cz);
    g.add(core);

    // seventeen floors of curtain walling on the two visible faces
    const floors = this.low ? 10 : 17;
    for (const [face, rot] of [[cz + d / 2 + 0.06, 0], [cx - w / 2 - 0.06, -Math.PI / 2]]) {
      const wide = rot === 0 ? w - 0.6 : d - 0.6;
      const wall = curtainWall({
        width: wide, height: h - 1.6, cols: rot === 0 ? 5 : 4, rows: floors,
        glassMat: M('glass-vision'), mullionMat: M('aluminium'),
        spandrelMat: M('glass-spandrel'), spandrelEvery: 2,
        mullionWidth: 0.1, mullionDepth: 0.2
      });
      if (rot === 0) wall.position.set(cx, (h - 1.6) / 2 + 0.8, face);
      else { wall.position.set(face, (h - 1.6) / 2 + 0.8, cz); wall.rotation.y = rot; }
      g.add(wall);
    }

    const crown = new Mesh(chamferedBox(w * 0.72, 2.2, d * 0.72, 0.1), M('concrete'));
    crown.position.set(cx, h, cz);
    const mast = new Mesh(new CylinderGeometry(0.1, 0.16, 6, 8), M('steel-dark'));
    mast.position.set(cx, h + 5.2, cz);
    g.add(crown, mast);
    return shadowed(g);
  }

  gatehouse(cx, cz) {
    const M = n => this.m.get(n);
    const g = new Group();
    const a = new Mesh(chamferedBox(9, 5, 7, 0.1), M('limestone'));
    a.position.set(cx, 0, cz);
    const b = new Mesh(chamferedBox(5, 3.4, 4.5, 0.08), M('limestone'));
    b.position.set(cx - 6, 0, cz + 10);
    const cap = new Mesh(coping(9, 7, 0.3, 0.2), M('limestone-honed'));
    cap.position.set(cx, 5, cz);
    g.add(a, b, cap);
    return shadowed(g);
  }

  // The windows warm up with the evening accent lighting.
  setAccent(k) {
    for (const w of this.litWindows) {
      if (w.material.emissive) {
        w.material.emissive.setHex(0x2a3d52);
        w.material.emissiveIntensity = 0.55 * k;
      }
    }
  }
}
