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
// ON THE MARK: this flies AAUPATH's own flag — the app icon that ships in
// this repository, on a plain field. It is deliberately not the university's
// crest: that artwork is not in this repository, and drawing an approximation
// of a real institution's mark is worse than not drawing it. Drop the real
// file in web/assets/img/ and pass its URL as `emblemUrl` to replace the
// whole cloth; nothing else here changes.
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

// The cloth. This is AAUPATH's flag, not the university's: the app's own
// mark, which exists in this repository, on a plain field. The previous
// version drew an invented institutional roundel — a green ring with a
// made-up device and the university's name arced around it — and an
// invented crest for a real institution is worse than no crest at all, so
// it is gone. If you have the university's actual artwork, drop the file in
// web/assets/img/ and pass its URL as `emblemUrl`; it replaces this whole
// texture and nothing else changes.
const FIELD = '#f6f5f1';
const BAND = '#e9e7e0';
const INK = '#1d2a44';
const BLUE = '#2f5fd0';

function drawCloth(g, W, H) {
  g.fillStyle = FIELD;
  g.fillRect(0, 0, W, H);
  // a hoist band, so the flag has a construction
  g.fillStyle = BAND;
  g.fillRect(0, 0, W * 0.045, H);
  // and a thin rule down the fly, the way a sewn flag is finished
  g.fillStyle = 'rgba(29,42,68,0.10)';
  g.fillRect(W - W * 0.012, 0, W * 0.012, H);
}

function drawType(g, W, H) {
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  g.font = `700 ${H * 0.13}px system-ui, sans-serif`;
  // letter-spaced by hand: canvas has no tracking, and a wordmark set solid
  // at this size reads as a smudge on a flag two dozen units away
  const word = 'AAUPATH', track = H * 0.028;
  const widths = [...word].map(ch => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + track * (word.length - 1);
  let x = W * 0.54 - total / 2;
  for (let i = 0; i < word.length; i++) {
    g.fillText(word[i], x + widths[i] / 2, H * 0.755);
    x += widths[i] + track;
  }
  g.fillStyle = BLUE;
  g.font = `600 ${H * 0.105}px system-ui, sans-serif`;
  g.fillText('\u0637\u0631\u064a\u0642\u0643', W * 0.54, H * 0.885);
  g.restore();
}

// The field is drawn straight away so the flag is never blank; the mark is
// composited in when the icon has decoded, and the texture is marked for
// re-upload. `onReady` fires on both paths so the caller does not have to
// care which one happened.
function flagTexture(iconUrl, onReady) {
  const W = 512, H = 336;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  drawCloth(g, W, H);
  drawType(g, W, H);

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;

  if (iconUrl) {
    const img = new Image();
    img.onload = () => {
      const s = H * 0.42;
      g.save();
      // a soft drop under the badge so it sits on the cloth instead of
      // floating on it
      g.shadowColor = 'rgba(29,42,68,0.28)';
      g.shadowBlur = H * 0.035;
      g.shadowOffsetY = H * 0.012;
      g.drawImage(img, W * 0.54 - s / 2, H * 0.34 - s / 2, s, s);
      g.restore();
      t.needsUpdate = true;
      if (onReady) onReady();
    };
    img.onerror = () => { if (onReady) onReady(); };
    img.src = iconUrl;
  } else if (onReady) {
    onReady();
  }
  return t;
}

export class Flag {
  constructor(materials, quality, sky,
    { x = 0, z = 0, height = 9.5, emblemUrl = null,
      iconUrl = 'assets/icons/icon-any-512.png' } = {}) {
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
    const pole = new Mesh(new CylinderGeometry(0.065, 0.095, height, low ? 7 : 12), M('aluminium'));
    pole.position.y = height / 2 + 0.6;
    const finial = new Mesh(new SphereGeometry(0.13, low ? 6 : 12, low ? 5 : 8), M('aluminium'));
    finial.position.y = height + 0.68;
    [base, collar, pole, finial].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    this.group.add(base, collar, pole, finial);

    // ---- the cloth -------------------------------------------------------
    const CW = 4.3, CH = 2.85;
    const geo = new PlaneGeometry(CW, CH, low ? 22 : 44, low ? 14 : 28);
    // the hoist sits on the pole, so the plane is offset to hang off it
    geo.translate(CW / 2, 0, 0);

    const map = flagTexture(iconUrl);
    this.uniforms = {
      uTime: { value: 0 },
      uWind: { value: 1 },
      uMap: { value: map },
      uLightDir: { value: sky.sunDirection.clone() },
      uLightColour: { value: sky.sunColour.clone() },
      // Brighter than the rest of the scene's ambient on purpose: a flag is a
      // thin sheet with sky on both sides of it, so it never sits in the deep
      // shade a solid wall does, and at this size the mark on it has to read.
      uAmbient: { value: new Color(0.42, 0.46, 0.56) }
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

    // If the university's own artwork is dropped in, it replaces the whole
    // cloth with no other change. On failure the drawn field stays, which is
    // why the field has to be worth looking at on its own.
    if (emblemUrl) {
      new TextureLoader().load(emblemUrl, tex => {
        tex.colorSpace = SRGBColorSpace;
        this.uniforms.uMap.value = tex;
      }, undefined, () => { /* keep the drawn cloth */ });
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
