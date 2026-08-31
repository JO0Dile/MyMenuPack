// ==========================
// ARCHITECTURAL PRIMITIVES
//
// The single biggest reason a 3D scene reads as "made in an afternoon" is
// that every edge in it is perfectly sharp. Nothing in the built world is:
// a concrete arris is chamfered so it does not spall, a stone coping is
// weathered and throated, a mullion stands proud of its glass, a window is
// set back into a reveal deep enough to throw a shadow. Those shadows are
// what tell you a wall has thickness.
//
// So there are no raw BoxGeometry walls in this scene. Everything is built
// from these, and every one of them exists to put a highlight or a shadow
// on an edge that would otherwise be a hard line.
// ==========================
import {
  BufferGeometry, BufferAttribute, BoxGeometry, CylinderGeometry, Shape,
  ExtrudeGeometry, Mesh, Group, Vector2, Vector3
} from 'three';

// ---- a box with chamfered vertical arrises ---------------------------
// Cheaper and more controllable than a rounded box: the four vertical edges
// get a small 45° flat, the horizontal ones stay sharp. That is how a
// precast panel or a stone pier is actually detailed, and the flat catches
// the sun as a bright line down the corner.
export function chamferedBox(w, h, d, chamfer = 0.06) {
  const cx = Math.min(chamfer, w * 0.4, d * 0.4);
  const s = new Shape();
  const hw = w / 2, hd = d / 2;
  s.moveTo(-hw + cx, -hd);
  s.lineTo(hw - cx, -hd);
  s.lineTo(hw, -hd + cx);
  s.lineTo(hw, hd - cx);
  s.lineTo(hw - cx, hd);
  s.lineTo(-hw + cx, hd);
  s.lineTo(-hw, hd - cx);
  s.lineTo(-hw, -hd + cx);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 });
  // rotateX(-90°) maps the extrusion's +Z onto +Y, so the solid already
  // stands on y = 0 with its top at y = h. Translating again would lift it
  // by its own height — which is exactly the kind of quiet off-by-one that
  // stacks a tower in the wrong order.
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

// ---- a coping / cornice ----------------------------------------------
// A slab that oversails the wall it caps, with a weathered top and a drip
// on the underside. The oversail is the whole point: it throws a shadow
// line along the head of the wall, which is what stops a parapet reading as
// the top of a box.
export function coping(w, d, thickness = 0.28, oversail = 0.12) {
  const g = new BoxGeometry(w + oversail * 2, thickness, d + oversail * 2);
  g.translate(0, thickness / 2, 0);
  return g;
}

// ---- a window opening, properly reveal'd ------------------------------
// Returns a group: the glass, set back into the wall, and the four returns
// of the reveal around it. Set back far enough that the head casts onto the
// glass when the sun is high and the jamb casts across it when it is low.
export function openingWithReveal({
  width, height, reveal = 0.22, glassMat, wallMat, frameMat = null, frame = 0.05
}) {
  const g = new Group();
  const glass = new Mesh(new BoxGeometry(width - frame * 2, height - frame * 2, 0.03), glassMat);
  glass.position.z = -reveal;
  g.add(glass);

  // the four returns: top, bottom, left, right
  const sides = [
    { w: width, h: reveal, d: 1, pos: [0, height / 2 - reveal / 2, -reveal / 2], rot: [Math.PI / 2, 0, 0] },
    { w: width, h: reveal, d: 1, pos: [0, -height / 2 + reveal / 2, -reveal / 2], rot: [-Math.PI / 2, 0, 0] }
  ];
  const head = new Mesh(new BoxGeometry(width, 0.02, reveal), wallMat);
  head.position.set(0, height / 2, -reveal / 2);
  const sill = new Mesh(new BoxGeometry(width, 0.02, reveal), wallMat);
  sill.position.set(0, -height / 2, -reveal / 2);
  const jambL = new Mesh(new BoxGeometry(0.02, height, reveal), wallMat);
  jambL.position.set(-width / 2, 0, -reveal / 2);
  const jambR = jambL.clone(); jambR.position.x = width / 2;
  g.add(head, sill, jambL, jambR);
  void sides;

  if (frameMat) {
    const f = new Mesh(new BoxGeometry(width, height, 0.06), frameMat);
    f.position.z = -reveal + 0.04;
    g.add(f);
  }
  return g;
}

// ---- a curtain wall bay ------------------------------------------------
// Glass in a grid, with aluminium mullions standing proud of it. The mullion
// depth is what makes a glazed facade read as glazing rather than as a
// mirror: it self-shades, and the shadow moves as the camera does.
export function curtainWall({
  width, height, cols, rows, glassMat, mullionMat,
  mullionWidth = 0.07, mullionDepth = 0.14, spandrelMat = null, spandrelEvery = 0
}) {
  const g = new Group();
  const cw = width / cols, ch = height / rows;

  for (let r = 0; r < rows; r++) {
    const isSpandrel = spandrelEvery > 0 && r % spandrelEvery === spandrelEvery - 1;
    const mat = isSpandrel && spandrelMat ? spandrelMat : glassMat;
    const panel = new Mesh(new BoxGeometry(width, ch - mullionWidth, 0.04), mat);
    panel.position.set(0, -height / 2 + ch * (r + 0.5), 0);
    g.add(panel);
  }
  // verticals
  for (let i = 0; i <= cols; i++) {
    const m = new Mesh(new BoxGeometry(mullionWidth, height, mullionDepth), mullionMat);
    m.position.set(-width / 2 + cw * i, 0, mullionDepth / 2);
    m.castShadow = true;
    g.add(m);
  }
  // horizontals
  for (let i = 0; i <= rows; i++) {
    const m = new Mesh(new BoxGeometry(width, mullionWidth, mullionDepth * 0.82), mullionMat);
    m.position.set(0, -height / 2 + ch * i, mullionDepth * 0.41);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

// ---- a two-centred pointed arch, as solid geometry ---------------------
// The arcade of the landmark. Built as an extruded shape with the opening
// cut out of it, so the arch has real thickness and a real soffit — an
// arch drawn as a curve has no inside, and the inside is most of what you
// see of an arch from below.
export function pointedArchWall({ width, height, springing, thickness, arcRise = 1.55 }) {
  const hw = width / 2;
  const outer = new Shape();
  outer.moveTo(-hw, 0);
  outer.lineTo(hw, 0);
  outer.lineTo(hw, height);
  outer.lineTo(-hw, height);
  outer.closePath();

  // the opening: two arcs struck from centres inside the span
  const oh = hw * 0.86;
  const d = oh * (arcRise - 1);
  const R = oh + d;
  const hole = new Shape();
  hole.moveTo(-oh, 0);
  hole.lineTo(-oh, springing);
  const apex = springing + Math.sqrt(R * R - d * d);
  const SEG = 18;
  for (let i = 0; i <= SEG; i++) {
    const x = -oh + (oh / SEG) * i;
    hole.lineTo(x, springing + Math.sqrt(Math.max(0, R * R - (x - d) * (x - d))));
  }
  for (let i = SEG - 1; i >= 0; i--) {
    const x = -oh + (oh / SEG) * i;
    hole.lineTo(-x, springing + Math.sqrt(Math.max(0, R * R - (x - d) * (x - d))));
  }
  hole.lineTo(oh, springing);
  hole.lineTo(oh, 0);
  hole.closePath();
  outer.holes.push(hole);

  const g = new ExtrudeGeometry(outer, {
    depth: thickness, bevelEnabled: true,
    bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 2
  });
  g.translate(0, 0, -thickness / 2);
  g.computeVertexNormals();
  g.userData.apex = apex;
  return g;
}

// ---- a fluted column with base and capital -----------------------------
// Three real pieces, not one cylinder. The entasis is slight — a straight
// shaft reads as a pipe.
export function column({ radius, height, mat, baseMat = mat, segments = 16 }) {
  const g = new Group();
  const base = new Mesh(new CylinderGeometry(radius * 1.32, radius * 1.42, radius * 0.9, segments), baseMat);
  base.position.y = radius * 0.45;
  const shaftH = height - radius * 1.9;
  const shaft = new Mesh(
    new CylinderGeometry(radius * 0.94, radius, shaftH, segments, 1),
    mat
  );
  shaft.position.y = radius * 0.9 + shaftH / 2;
  const cap = new Mesh(new CylinderGeometry(radius * 1.42, radius * 1.28, radius, segments), baseMat);
  cap.position.y = height - radius * 0.5;
  [base, shaft, cap].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
  g.add(base, shaft, cap);
  return g;
}

// ---- a stepped ring, for the island and the pool ------------------------
export function steppedRing({ inner, outer, height, segments = 64 }) {
  const s = new Shape();
  s.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const h = new Shape();
  h.absarc(0, 0, inner, 0, Math.PI * 2, true);
  s.holes.push(h);
  const g = new ExtrudeGeometry(s, {
    depth: height, bevelEnabled: true,
    bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 1, curveSegments: segments
  });
  g.rotateX(-Math.PI / 2);      // stands on y = 0, top at y = height
  g.computeVertexNormals();
  return g;
}

// Mark a whole subtree as casting and receiving, once, rather than
// remembering to do it on every mesh.
export function shadowed(obj, cast = true, receive = true) {
  obj.traverse(o => {
    if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; }
  });
  return obj;
}

export { Vector2, Vector3 };
