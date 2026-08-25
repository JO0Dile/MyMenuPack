// ==========================
// THE AUTHENTICATION PANEL, AS AN OBJECT IN THE WORLD
//
// Not a div over a canvas. A physical pane of frosted glass standing in
// front of the fountain: it has thickness, a machined aluminium edge that
// catches the sun, it refracts the tower behind it, it casts a shadow, and
// it drifts on a slow float so it reads as suspended rather than pasted on.
//
// The type is a CanvasTexture on a plane a millimetre in front of the glass,
// so it is lit by the same environment as everything else. The real DOM
// controls sit exactly over its projected screen rectangle — which is how
// the panel stays keyboard-operable, screen-reader-addressable and
// selectable while looking like part of the scene.
// ==========================
import {
  Group, Mesh, PlaneGeometry, BoxGeometry, CylinderGeometry, Shape,
  ExtrudeGeometry, CanvasTexture, MeshBasicMaterial, SRGBColorSpace,
  LinearFilter, Vector3, DoubleSide
} from 'three';

const W = 5.0, H = 3.05, T = 0.16, R = 0.24;

function roundedPlate(w, h, r, depth) {
  const s = new Shape();
  const hw = w / 2, hh = h / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r); s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh); s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r); s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  const g = new ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.035,
    bevelSegments: 3, curveSegments: 8
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

export class GlassPanel {
  constructor(materials, quality) {
    this.m = materials;
    this.q = quality;
    this.group = new Group();
    this.group.name = 'auth-panel';
    this.group.position.set(0, 7.6, 11.4);
    this.group.visible = false;
    this._t = 0;
    this._appear = 0;
    this._build();
  }

  get object() { return this.group; }

  _build() {
    const M = n => this.m.get(n);

    const glass = new Mesh(roundedPlate(W, H, R, T), M('glass-ui'));
    glass.castShadow = true;
    glass.renderOrder = 10;
    this.glass = glass;
    this.group.add(glass);

    // The edge: a slim machined frame standing a little proud of the glass
    // on both faces. This is the detail that makes it a manufactured object.
    const edge = new Mesh(roundedPlate(W + 0.07, H + 0.07, R + 0.03, T + 0.05), M('glass-ui-edge'));
    edge.renderOrder = 9;
    this.edge = edge;
    this.group.add(edge);
    // hollow it out so only the rim shows
    const cut = new Mesh(roundedPlate(W - 0.06, H - 0.06, R - 0.02, T + 0.14), M('glass-ui'));
    cut.visible = false;
    this.group.add(cut);

    // A brushed spine down the leading edge, catching the key light.
    for (const s of [-1, 1]) {
      const rail = new Mesh(new CylinderGeometry(0.035, 0.035, H - R * 1.2, 8), M('glass-ui-edge'));
      rail.rotation.z = 0;
      rail.position.set(s * (W / 2 + 0.055), 0, 0);
      this.group.add(rail);
    }

    this.face = this._typePlane();
    this.group.add(this.face);
  }

  // The type, drawn once at boot into a canvas. Sized generously so it is
  // sharp when the camera lands close.
  _typePlane() {
    const px = this.q.get('name') === 'low' ? 1024 : 2048;
    const c = document.createElement('canvas');
    c.width = px; c.height = Math.round(px * H / W);
    const g = c.getContext('2d');
    this.ctx = g; this.canvas = c;
    this._paint('en');
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter;
    tex.anisotropy = 4;
    this.texture = tex;
    // A transmissive material is drawn in its own pass, after everything
    // transparent — so an ordinary transparent plane in front of the pane is
    // still painted *under* it. The type is the one thing on this object
    // that must never be lost, so it composites last and unconditionally.
    const m = new Mesh(new PlaneGeometry(W - 0.44, H - 0.44), new MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, depthTest: false,
      side: DoubleSide
    }));
    m.position.z = T / 2 + 0.014;
    m.renderOrder = 30;
    return m;
  }

  _paint(lang) {
    const g = this.ctx, c = this.canvas;
    const w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    const rtl = lang === 'ar';
    g.textAlign = 'center';
    try { g.direction = rtl ? 'rtl' : 'ltr'; } catch (e) { /* older engines */ }

    // AAUPATH — the identity, first and largest
    g.fillStyle = 'rgba(255,255,255,0.97)';
    g.font = `900 ${Math.round(h * 0.185)}px Cairo, system-ui, sans-serif`;
    try { g.letterSpacing = `${Math.round(h * 0.028)}px`; } catch (e) { /* older engines */ }
    g.fillText('AAUPATH', w / 2, h * 0.30);

    // طريقك — a first-class element, not a translation note
    try { g.letterSpacing = '0px'; } catch (e) { /* older engines */ }
    g.fillStyle = 'rgba(174,196,255,0.96)';
    g.font = `700 ${Math.round(h * 0.105)}px Cairo, system-ui, sans-serif`;
    g.fillText('طريقك', w / 2, h * 0.445);

    // a hairline rule, the way a real fascia is divided
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = Math.max(1, h * 0.004);
    g.beginPath(); g.moveTo(w * 0.3, h * 0.52); g.lineTo(w * 0.7, h * 0.52); g.stroke();

    g.fillStyle = 'rgba(226,234,248,0.86)';
    g.font = `500 ${Math.round(h * 0.062)}px system-ui, sans-serif`;
    const line = rtl
      ? 'كل مساق في تخصصك، ووين وصلت فيه.'
      : 'Every course in your degree, and where you are on it.';
    this._wrap(g, line, w / 2, h * 0.635, w * 0.82, h * 0.084);

    if (this.texture) this.texture.needsUpdate = true;
  }

  _wrap(g, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '', yy = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, yy); line = word; yy += lh;
      } else line = test;
    }
    g.fillText(line, x, yy);
  }

  setLanguage(lang) { this._paint(lang); }

  // Where the panel's controls should sit on screen, in CSS pixels, so the
  // real buttons can be placed exactly over the glass.
  projectFooter(camera, width, height) {
    const p = new Vector3(0, -H * 0.30, T / 2 + 0.02).applyMatrix4(this.group.matrixWorld);
    p.project(camera);
    const l = new Vector3(-W / 2 + 0.5, -H * 0.30, T / 2).applyMatrix4(this.group.matrixWorld).project(camera);
    const r = new Vector3(W / 2 - 0.5, -H * 0.30, T / 2).applyMatrix4(this.group.matrixWorld).project(camera);
    return {
      x: (p.x * 0.5 + 0.5) * width,
      y: (-p.y * 0.5 + 0.5) * height,
      width: Math.abs(r.x - l.x) * 0.5 * width,
      visible: p.z < 1
    };
  }

  // Materialise: it does not fade in, it arrives — rising a little, settling,
  // and the edge lighting coming up last.
  setAppear(k) {
    this._appear = k;
    this.group.visible = k > 0.005;
    const e = k * k * (3 - 2 * k);
    this.group.scale.setScalar(0.94 + 0.06 * e);
    this._baseY = 7.6;
    this.glass.material.opacity = 1;
    this.edge.material.emissiveIntensity = 0.06 * e;
    this.face.material.opacity = Math.max(0, (k - 0.25) / 0.75);
  }

  update(t, camera) {
    this._t = t;
    if (!this.group.visible) return;
    // A slow figure of eight, small enough to be subconscious.
    const k = this._appear;
    this.group.position.y = (this._baseY || 7.6) - (1 - k) * 0.9
      + Math.sin(t * 0.42) * 0.075 * k;
    this.group.position.x = Math.sin(t * 0.27) * 0.05 * k;
    this.group.rotation.z = Math.sin(t * 0.33) * 0.006 * k;
    // It always faces the camera, because it is an interface, but it leans
    // rather than snapping — the lean is what sells it as a physical object
    // hanging in the air.
    const target = Math.atan2(camera.position.x - this.group.position.x,
                              camera.position.z - this.group.position.z);
    this.group.rotation.y += (target - this.group.rotation.y) * 0.06;
    this.group.rotation.x = Math.sin(t * 0.31) * 0.008 * k;
  }
}
