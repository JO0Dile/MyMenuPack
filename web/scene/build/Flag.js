// ==========================
// THE FLAG
//
// A pole and a real piece of cloth. The cloth is a plane displaced in the
// vertex shader by two crossed travelling waves whose amplitude grows with
// distance from the hoist — which is the whole trick: a flag is pinned along
// one edge and free along the other, so the ripple has to start at nothing
// and end large, or it reads as a sheet of paper flapping.
//
// The normal is recomputed from the analytic derivatives of those same
// waves, so the light actually runs along the folds instead of sitting flat.
//
// ON THE EMBLEM: the roundel below is drawn here as a stand-in — an
// institutional seal of the right shape, weight and colour for a flag seen
// at this size. It is NOT a reproduction of the university's crest, because
// inventing the details of a real institution's mark would be worse than
// leaving it plain. If you have the real artwork, drop it in
// web/assets/img/ and pass its URL as `emblemUrl`; everything else here
// stays as it is.
// ==========================
import {
  Group, Mesh, PlaneGeometry, CylinderGeometry, SphereGeometry,
  ShaderMaterial, CanvasTexture, DoubleSide, SRGBColorSpace, LinearFilter,
  TextureLoader, Color
} from 'three';

const VERT = /* glsl */`
  uniform float uTime;
  uniform float uWind;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying float vFold;

  // The two wave trains, and their slopes. Amplitude is zero at the hoist
  // (u = 0) and grows toward the fly, because that is how cloth on a pole
  // behaves.
  float cloth(vec2 p, out float dx, out float dy) {
    float grip = pow(p.x, 1.55);
    float a1 = sin(p.x * 9.0 - uTime * 3.1 + p.y * 2.2);
    float a2 = sin(p.x * 15.0 - uTime * 4.6 - p.y * 3.4) * 0.42;
    float a3 = sin(p.y * 5.0 + uTime * 1.7) * 0.22;
    dx = (cos(p.x * 9.0 - uTime * 3.1 + p.y * 2.2) * 9.0
        + cos(p.x * 15.0 - uTime * 4.6 - p.y * 3.4) * 0.42 * 15.0) * grip;
    dy = (cos(p.x * 9.0 - uTime * 3.1 + p.y * 2.2) * 2.2
        - cos(p.x * 15.0 - uTime * 4.6 - p.y * 3.4) * 0.42 * 3.4
        + cos(p.y * 5.0 + uTime * 1.7) * 0.22 * 5.0) * grip;
    return (a1 + a2 + a3) * grip;
  }

  void main() {
    vUv = uv;
    float dx, dy;
    float h = cloth(uv, dx, dy) * uWind;
    vFold = h;
    vec3 p = position;
    p.z += h * 0.34;
    // the fly edge also lifts and falls, not just ripples
    p.y += sin(uv.x * 3.2 - uTime * 2.4) * pow(uv.x, 2.0) * 0.16 * uWind;

    vec3 n = normalize(vec3(-dx * 0.34 * uWind, -dy * 0.34 * uWind, 1.0));
    vNormalW = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uMap;
  uniform vec3 uLightDir;
  uniform vec3 uLightColour;
  uniform vec3 uAmbient;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying float vFold;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    vec3 n = normalize(vNormalW);
    // Two-sided: the back of a flag is lit too, just less.
    float d = dot(n, normalize(uLightDir));
    float lit = max(abs(d), 0.0) * (d > 0.0 ? 1.0 : 0.55);
    vec3 col = tex.rgb * (uAmbient + uLightColour * lit * 1.15);
    // the fold's own shading, so the cloth has depth even in flat light
    col *= 0.86 + 0.14 * (vFold * 0.5 + 0.5);
    gl_FragColor = vec4(col, tex.a);
  }
`;

// The seal. Shape, weight and colour of an institutional roundel at flag
// size — deliberately not a copy of anyone's actual crest.
function flagTexture() {
  const W = 512, H = 336;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  g.fillStyle = '#f4f3ef';                       // the cloth
  g.fillRect(0, 0, W, H);
  // a hoist band, so the flag has a construction
  g.fillStyle = '#e8e6df';
  g.fillRect(0, 0, W * 0.045, H);

  const cx = W * 0.54, cy = H / 2, R = H * 0.34;
  const GREEN = '#1c7a3e', DARK = '#232a30';

  g.save();
  g.translate(cx, cy);

  // the outer ring and the inner rule
  g.strokeStyle = GREEN; g.lineWidth = R * 0.1;
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = DARK; g.lineWidth = R * 0.028;
  g.beginPath(); g.arc(0, 0, R * 0.83, 0, Math.PI * 2); g.stroke();

  // the mark: an open book over a rising path, which is what this app is
  g.fillStyle = DARK;
  g.beginPath();
  g.moveTo(-R * 0.42, R * 0.10);
  g.quadraticCurveTo(-R * 0.20, -R * 0.06, 0, R * 0.02);
  g.quadraticCurveTo(R * 0.20, -R * 0.06, R * 0.42, R * 0.10);
  g.lineTo(R * 0.42, R * 0.22);
  g.quadraticCurveTo(R * 0.20, R * 0.06, 0, R * 0.14);
  g.quadraticCurveTo(-R * 0.20, R * 0.06, -R * 0.42, R * 0.22);
  g.closePath(); g.fill();
  g.strokeStyle = GREEN; g.lineWidth = R * 0.075;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(-R * 0.34, -R * 0.16);
  g.lineTo(-R * 0.02, -R * 0.46);
  g.lineTo(R * 0.34, -R * 0.16);
  g.stroke();

  // arc text, top and bottom, set on the ring
  const arc = (text, radius, start, sweep, size, colour, flip) => {
    g.save();
    g.fillStyle = colour;
    g.font = `700 ${size}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const step = sweep / Math.max(1, text.length - 1);
    for (let i = 0; i < text.length; i++) {
      const a = start + step * i;
      g.save();
      g.rotate(a);
      g.translate(0, flip ? radius : -radius);
      if (flip) g.rotate(Math.PI);
      g.fillText(text[i], 0, 0);
      g.restore();
    }
    g.restore();
  };
  arc('ARAB AMERICAN UNIVERSITY', R * 0.72, -0.92, 1.84, R * 0.115, DARK, false);
  arc('الجامعة العربية الأمريكية', R * 0.72, -0.62, 1.24, R * 0.125, GREEN, true);
  g.restore();

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;
  return t;
}

export class Flag {
  constructor(materials, quality, sky, { x = 0, z = 0, height = 9.5, emblemUrl = null } = {}) {
    this.m = materials;
    this.group = new Group();
    this.group.name = 'flag';
    const low = quality.get('name') === 'low';
    const M = n => this.m.get(n);

    // ---- the pole --------------------------------------------------------
    const base = new Mesh(new CylinderGeometry(0.36, 0.46, 0.5, low ? 8 : 16), M('limestone-honed'));
    base.position.y = 0.25;
    const collar = new Mesh(new CylinderGeometry(0.15, 0.2, 0.3, low ? 8 : 14), M('steel-dark'));
    collar.position.y = 0.62;
    const pole = new Mesh(new CylinderGeometry(0.055, 0.08, height, low ? 7 : 12), M('aluminium'));
    pole.position.y = height / 2 + 0.6;
    const finial = new Mesh(new SphereGeometry(0.13, low ? 6 : 12, low ? 5 : 8), M('aluminium'));
    finial.position.y = height + 0.68;
    [base, collar, pole, finial].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    this.group.add(base, collar, pole, finial);

    // ---- the cloth -------------------------------------------------------
    const CW = 3.4, CH = 2.25;
    const geo = new PlaneGeometry(CW, CH, low ? 22 : 44, low ? 14 : 28);
    // the hoist sits on the pole, so the plane is offset to hang off it
    geo.translate(CW / 2, 0, 0);

    const map = flagTexture();
    this.uniforms = {
      uTime: { value: 0 },
      uWind: { value: 1 },
      uMap: { value: map },
      uLightDir: { value: sky.sunDirection.clone() },
      uLightColour: { value: sky.sunColour.clone() },
      uAmbient: { value: new Color(0.24, 0.27, 0.36) }
    };
    this.material = new ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      side: DoubleSide, transparent: false
    });
    this.cloth = new Mesh(geo, this.material);
    this.cloth.position.set(0.06, height - CH / 2 + 0.2, 0);
    this.cloth.castShadow = false;      // a shadow from a shader-displaced
    this.cloth.receiveShadow = false;   // plane would not match what is drawn
    this.cloth.name = 'cloth';
    this.group.add(this.cloth);

    // If the real artwork is dropped in, it replaces the stand-in with no
    // other change.
    if (emblemUrl) {
      new TextureLoader().load(emblemUrl, tex => {
        tex.colorSpace = SRGBColorSpace;
        this.uniforms.uMap.value = tex;
      }, undefined, () => { /* keep the drawn seal */ });
    }

    this.group.position.set(x, 0.05, z);
  }

  get object() { return this.group; }

  update(t) { this.uniforms.uTime.value = t; }

  setWind(k) { this.uniforms.uWind.value = k; }

  dispose() {
    this.material.dispose();
    this.cloth.geometry.dispose();
    this.uniforms.uMap.value.dispose();
  }
}
