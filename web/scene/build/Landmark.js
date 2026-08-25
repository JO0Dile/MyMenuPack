// ==========================
// THE LANDMARK
//
// The clock-tower fountain. One object, as the photographs show it: the
// tower stands in the middle of the basin.
//
// Every element here is built to the real detail rather than to the
// silhouette, because the camera lands eighteen metres away and everything
// is legible at that distance:
//
//   - the basin has a coping that oversails its wall, a tiled internal face
//     and a step down to the water
//   - the piers are four clusters of three real columns, each with a base,
//     an entasis and a capital
//   - the arcade is solid wall with the arch cut out of it, so it has a
//     soffit and the soffit is in shadow
//   - the inscription band is polished black granite that oversails the
//     arcade below and is capped above, and it is the only polished thing
//     on the tower
//   - the clock stage carries four faces with real recessed dials, chapter
//     rings and hands
//   - the cap is a hipped stone roof, not a pyramid
//   - the book on top is two curved leaves on a stand
// ==========================
import {
  Group, Mesh, BoxGeometry, CylinderGeometry, RingGeometry, CircleGeometry,
  BufferGeometry, Float32BufferAttribute, DoubleSide
} from 'three';
import { chamferedBox, coping, pointedArchWall, column, steppedRing, shadowed } from './Architecture.js';

export const LANDMARK = {
  poolRadius: 9.0,
  poolWall: 0.74,
  waterLevel: 0.46,
  islandTop: 1.42,
  pierSpacing: 1.85,
  colBase: 1.78,
  colTop: 5.0,
  bandHeight: 2.4,
  clockHeight: 3.5
};

export class Landmark {
  constructor(materials, quality) {
    this.m = materials;
    this.q = quality;
    this.group = new Group();
    this.group.name = 'landmark';
    this.clockHands = [];
    this._build();
  }

  get object() { return this.group; }

  _build() {
    const M = n => this.m.get(n);
    const L = LANDMARK;
    const seg = this.q.get('name') === 'low' ? 40 : 72;

    // ---- the basin -----------------------------------------------------
    const basin = new Group();
    basin.name = 'basin';

    // the outer wall, chamfered at the top so the coping sits on a shadow
    const wall = new Mesh(
      new CylinderGeometry(L.poolRadius, L.poolRadius + 0.05, L.poolWall, seg, 1, true),
      M('limestone')
    );
    wall.position.y = L.poolWall / 2;
    basin.add(wall);

    // the coping: oversails, and is honed rather than walled, so it catches
    // the sun as a bright ring all the way round
    const cop = new Mesh(
      steppedRing({ inner: L.poolRadius - 0.62, outer: L.poolRadius + 0.14, height: 0.16, segments: seg }),
      M('limestone-honed')
    );
    cop.position.y = L.poolWall;
    basin.add(cop);

    // the internal face, tiled, and the floor of the basin
    const inner = new Mesh(
      new CylinderGeometry(L.poolRadius - 0.62, L.poolRadius - 0.62, L.poolWall, seg, 1, true),
      M('paving-fine')
    );
    inner.position.y = L.poolWall / 2;
    inner.material.side = DoubleSide;
    basin.add(inner);

    const floor = new Mesh(new CylinderGeometry(L.poolRadius - 0.62, L.poolRadius - 0.62, 0.08, seg), M('paving-fine'));
    floor.position.y = 0.06;
    basin.add(floor);

    // the kerb outside it, and the fine paving of the island it sits in
    const kerb = new Mesh(
      steppedRing({ inner: L.poolRadius + 0.14, outer: L.poolRadius + 1.35, height: 0.1, segments: seg }),
      M('paving-fine')
    );
    basin.add(kerb);
    this.group.add(shadowed(basin));

    // ---- the island the tower stands on --------------------------------
    const island = new Group();
    const steps = [
      { r: 4.62, y: 0.00, h: 0.34 },
      { r: 4.20, y: 0.34, h: 0.32 },
      { r: 3.80, y: 0.66, h: 0.32 }
    ];
    for (const s of steps) {
      const ring = new Mesh(new CylinderGeometry(s.r, s.r + 0.03, s.h, seg), M('limestone'));
      ring.position.y = s.y + s.h / 2;
      island.add(ring);
      // a honed nosing on every step, which is where the light lands
      const nose = new Mesh(steppedRing({ inner: s.r - 0.14, outer: s.r + 0.02, height: 0.03, segments: seg }), M('limestone-honed'));
      nose.position.y = s.y + s.h;
      island.add(nose);
    }
    const plinth = new Mesh(chamferedBox(5.4, 0.52, 5.4, 0.07), M('limestone'));
    plinth.position.y = 0.98;
    island.add(plinth);
    const plinthCap = new Mesh(coping(5.4, 5.4, 0.12, 0.09), M('limestone-honed'));
    plinthCap.position.y = 1.50 - 0.12;
    island.add(plinthCap);
    this.group.add(shadowed(island));

    // ---- the piers -----------------------------------------------------
    const piers = new Group();
    const P = L.pierSpacing;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const pier = new Group();
      pier.position.set(sx * P, L.islandTop, sz * P);
      // a stylobate under the cluster
      const pad = new Mesh(chamferedBox(1.22, 0.34, 1.22, 0.05), M('limestone'));
      pier.add(pad);
      const padTop = new Mesh(coping(1.02, 1.02, 0.09, 0.06), M('limestone-honed'));
      padTop.position.y = 0.34;
      pier.add(padTop);
      // three shafts, bundled
      const shaftH = L.colTop - L.colBase - 0.78;
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2 + 0.4;
        const col = column({ radius: 0.185, height: shaftH, mat: M('limestone-honed'), segments: this.q.get('name') === 'low' ? 8 : 16 });
        col.position.set(Math.cos(a) * 0.33, 0.43, Math.sin(a) * 0.33);
        pier.add(col);
      }
      // the abacus the arcade sits on
      const abacus = new Mesh(chamferedBox(1.1, 0.3, 1.1, 0.05), M('limestone'));
      abacus.position.y = 0.43 + shaftH;
      pier.add(abacus);
      piers.add(pier);
    }
    this.group.add(shadowed(piers));

    // ---- the arcade ----------------------------------------------------
    // Four walls with a pointed arch cut through each. Real thickness, so
    // the soffit of every arch is a surface the sun never reaches.
    const springing = L.colTop + 0.32;
    const arcade = new Group();
    const archGeom = pointedArchWall({
      width: P * 2 + 0.7, height: springing + 3.1, springing: springing - L.islandTop,
      thickness: 0.46
    });
    const apex = L.islandTop + archGeom.userData.apex;
    for (let i = 0; i < 4; i++) {
      const w = new Mesh(archGeom, M('limestone'));
      w.rotation.y = i * Math.PI / 2;
      w.position.set(
        Math.sin(i * Math.PI / 2) * P,
        L.islandTop,
        Math.cos(i * Math.PI / 2) * P
      );
      arcade.add(w);
    }
    this.group.add(shadowed(arcade));
    this.arcadeApex = apex;

    // the dark core standing behind the arcade, seen through every opening
    const core = new Mesh(chamferedBox(2.6, apex - L.islandTop + 0.5, 2.6, 0.04), M('granite'));
    core.position.y = L.islandTop - 0.3;
    this.group.add(shadowed(core));

    // ---- the inscription band ------------------------------------------
    const bandY = apex + 0.16;
    const band = new Group();
    const sill = new Mesh(coping(5.1, 5.1, 0.24, 0.28), M('limestone-honed'));
    sill.position.y = bandY;
    band.add(sill);

    const granite = new Mesh(chamferedBox(5.0, L.bandHeight, 5.0, 0.05), M('granite'));
    granite.position.y = bandY + 0.24;
    band.add(granite);

    const bandCap = new Mesh(coping(5.1, 5.1, 0.3, 0.3), M('limestone-honed'));
    bandCap.position.y = bandY + 0.24 + L.bandHeight;
    band.add(bandCap);
    this.group.add(shadowed(band));
    this.bandTop = bandY + 0.24 + L.bandHeight + 0.3;

    // ---- the clock stage -----------------------------------------------
    const stageY = this.bandTop;
    const stage = new Group();
    const shaft = new Mesh(chamferedBox(3.4, L.clockHeight, 3.4, 0.06), M('limestone'));
    shaft.position.y = stageY;
    stage.add(shaft);

    const dialY = stageY + L.clockHeight * 0.54;
    for (let i = 0; i < 4; i++) {
      const face = this._clockFace(1.16);
      face.rotation.y = i * Math.PI / 2;
      const a = i * Math.PI / 2;
      face.position.set(Math.sin(a) * 1.71, dialY, Math.cos(a) * 1.71);
      stage.add(face);
    }

    const eaves = new Mesh(coping(3.4, 3.4, 0.26, 0.32), M('limestone-honed'));
    eaves.position.y = stageY + L.clockHeight;
    stage.add(eaves);
    this.group.add(shadowed(stage));

    // ---- the cap: a hipped stone roof -----------------------------------
    const capY = stageY + L.clockHeight + 0.26;
    const cap = new Mesh(this._hipRoof(2.0, 0.9, 1.16), M('limestone'));
    cap.position.y = capY;
    this.group.add(shadowed(cap));

    // ---- the book ---------------------------------------------------------
    const bookY = capY + 1.16;
    const stand = new Mesh(chamferedBox(1.9, 0.3, 1.9, 0.05), M('limestone'));
    stand.position.y = bookY;
    const stand2 = new Mesh(chamferedBox(1.5, 0.26, 1.5, 0.04), M('limestone-honed'));
    stand2.position.y = bookY + 0.3;
    this.group.add(shadowed(stand), shadowed(stand2));
    const book = this._book(bookY + 0.56);
    this.group.add(shadowed(book));
    this.height = bookY + 1.5;
  }

  // A dial recessed into the stone: a sunk rebate, a chapter ring, twelve
  // marks and two hands standing off the face so they cast onto it.
  _clockFace(r) {
    const M = n => this.m.get(n);
    const g = new Group();
    const rebate = new Mesh(new CylinderGeometry(r * 1.12, r * 1.12, 0.14, 40), M('limestone-honed'));
    rebate.rotation.x = Math.PI / 2;
    rebate.position.z = -0.03;
    g.add(rebate);

    const dial = new Mesh(new CircleGeometry(r, 44), M('paint-white'));
    dial.position.z = 0.055;
    g.add(dial);

    const ring = new Mesh(new RingGeometry(r * 0.9, r * 0.965, 44), M('steel-dark'));
    ring.position.z = 0.062;
    g.add(ring);

    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const major = i % 3 === 0;
      const mark = new Mesh(
        new BoxGeometry(major ? 0.075 : 0.04, major ? 0.24 : 0.14, 0.02),
        M('steel-dark')
      );
      const rr = r * 0.79;
      mark.position.set(Math.sin(a) * rr, Math.cos(a) * rr, 0.068);
      mark.rotation.z = -a;
      g.add(mark);
    }

    // The hands read 10:10 — which is where clocks in photographs always
    // are, because it frames the dial and leaves the maker's name clear.
    const hour = new Mesh(new BoxGeometry(0.075, r * 0.56, 0.028), M('steel-dark'));
    hour.position.set(0, 0, 0.082);
    hour.geometry.translate(0, r * 0.28, 0);
    hour.rotation.z = -Math.PI * 2 * (10 / 12) - Math.PI * 2 * (10 / 60) / 12;
    const min = new Mesh(new BoxGeometry(0.052, r * 0.8, 0.026), M('steel-dark'));
    min.position.set(0, 0, 0.09);
    min.geometry.translate(0, r * 0.4, 0);
    min.rotation.z = -Math.PI * 2 * (10 / 60);
    const boss = new Mesh(new CylinderGeometry(0.07, 0.07, 0.05, 12), M('steel-dark'));
    boss.rotation.x = Math.PI / 2;
    boss.position.z = 0.1;
    g.add(hour, min, boss);
    this.clockHands.push({ hour, min });
    return g;
  }

  // Four hipped planes to a short ridge, with a small overhang. A pyramid
  // reads as a party hat; a hip with an eaves overhang reads as a roof,
  // because the overhang throws a shadow onto the wall below it.
  _hipRoof(half, height, ridgeHalf) {
    const o = half + 0.16;
    const A = [-o, 0, -o], B = [o, 0, -o], C = [o, 0, o], D = [-o, 0, o];
    const R1 = [-ridgeHalf * 0.5, height, 0], R2 = [ridgeHalf * 0.5, height, 0];
    const tris = [
      [D, C, R2], [D, R2, R1],        // the south slope
      [B, A, R1], [B, R1, R2],        // the north slope
      [C, B, R2],                     // the east hip
      [A, D, R1],                     // the west hip
      [R1, R2, [ridgeHalf * 0.5, height, 0]]   // degenerate; ridge is a line
    ];
    const pos = [];
    for (const t of tris.slice(0, 6)) for (const p of t) pos.push(p[0], p[1], p[2]);
    // the eaves fascia, so the roof has a visible thickness at its edge
    const fascia = 0.13;
    const ring = [[A, B], [B, C], [C, D], [D, A]];
    for (const [p0, p1] of ring) {
      const a = [p0[0], -fascia, p0[2]], b = [p1[0], -fascia, p1[2]];
      pos.push(...p0, ...b, ...p1);
      pos.push(...p0, ...a, ...b);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  // The open book on the stand: two leaves, each a real curved surface
  // rather than a flat plane, with a page-edge thickness and a spine
  // between them.
  _book(y) {
    const M = n => this.m.get(n);
    const g = new Group();
    const W = 0.9, H = 0.82, D = 0.66, SEG = 10;

    for (const side of [-1, 1]) {
      const pos = [];
      // A leaf is a ruled surface: it lifts away from the spine and curls
      // back down at the outer edge, the way a heavy open book does.
      const pt = (u, v) => {
        const x = side * u * W;
        const lift = Math.sin(u * Math.PI * 0.62) * H;
        const sag = Math.pow(u, 2.2) * 0.16;
        return [x, y + lift - sag, v * D];
      };
      for (let i = 0; i < SEG; i++) {
        const u0 = i / SEG, u1 = (i + 1) / SEG;
        for (const v of [[-0.5, 0.5]]) {
          const a = pt(u0, v[0]), b = pt(u1, v[0]), c = pt(u1, v[1]), d = pt(u0, v[1]);
          if (side > 0) { pos.push(...a, ...b, ...c, ...a, ...c, ...d); }
          else { pos.push(...a, ...c, ...b, ...a, ...d, ...c); }
        }
      }
      // the page edge: a thin skirt down the outer margin so the leaf is
      // not infinitely thin where the light grazes it
      const eA = pt(1, -0.5), eB = pt(1, 0.5);
      const tA = [eA[0], eA[1] - 0.05, eA[2]], tB = [eB[0], eB[1] - 0.05, eB[2]];
      pos.push(...eA, ...eB, ...tB, ...eA, ...tB, ...tA);

      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      const leaf = new Mesh(geo, M('paint-white'));
      leaf.material.side = DoubleSide;
      g.add(leaf);
    }

    const spine = new Mesh(new BoxGeometry(0.1, 0.09, D), M('limestone-honed'));
    spine.position.set(0, y + 0.02, 0);
    g.add(spine);
    return g;
  }
}
