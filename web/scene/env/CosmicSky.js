// ==========================
// THE SKY, WHICH IS SPACE
//
// The fountain does not stand on a hill any more. It stands in the universe,
// so the sky is a starfield with planets in it.
//
// Everything here is 2D by design — points and camera-facing sprites drawn
// into canvases at boot. A sphere with a texture on it would cost far more
// and look worse at this distance, because what makes a planet read is the
// crispness of its limb against black and the softness of its terminator,
// and both are easier to draw than to light.
// ==========================
import {
  Points, BufferGeometry, Float32BufferAttribute, ShaderMaterial, Sprite,
  SpriteMaterial, CanvasTexture, AdditiveBlending, NormalBlending, Group,
  Color, Mesh, SphereGeometry, BackSide, SRGBColorSpace, LinearFilter, Vector3
} from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- the deep sky --------------------------------------------------------
// Not flat black. A real night sky has structure in it: a faint band of
// galaxy across one diagonal and a slow drift from indigo to near-black.
const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const SKY_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uHigh;
  uniform vec3 uLow;
  uniform vec3 uBand;
  uniform float uTime;

  float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
  float noise(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                      mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                  mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                      mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
    return n;
  }
  float fbm(vec3 p){
    float v = 0.0, a = 0.5;
    for(int i = 0; i < 5; i++){ v += noise(p) * a; p *= 2.03; a *= 0.5; }
    return v;
  }

  void main(){
    vec3 d = normalize(vDir);
    // the vertical fall, biased so most of the frame is the deep colour
    float t = pow(clamp(d.y * 0.5 + 0.5, 0.0, 1.0), 1.6);
    vec3 col = mix(uLow, uHigh, t);

    // the galactic band, running on a diagonal and softly clouded
    float band = 1.0 - abs(dot(d, normalize(vec3(0.42, 0.30, -0.86))));
    band = pow(clamp(band, 0.0, 1.0), 15.0);
    float clouds = fbm(d * 3.4 + vec3(0.0, uTime * 0.004, 0.0));
    col += uBand * band * (0.35 + clouds * 0.85);

    // a very slow breathing in the deep field, so it is never quite static
    col += uBand * 0.05 * fbm(d * 1.6 - vec3(uTime * 0.002));

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ---- a star, drawn once and shared ---------------------------------------
function starSprite() {
  const S = 64, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.42, 'rgba(190,215,255,0.22)');
  grad.addColorStop(1, 'rgba(120,160,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const STAR_VERT = /* glsl */`
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aTint;
  varying vec3 vTint;
  varying float vTwinkle;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uReveal;
  void main(){
    vTint = aTint;
    // Twinkle is atmospheric scintillation, so it belongs to the star, not
    // to a global pulse: every one has its own phase and its own rate.
    vTwinkle = 0.68 + 0.32 * sin(uTime * (1.1 + fract(aPhase) * 2.2) + aPhase * 6.28);
    vTwinkle *= uReveal;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const STAR_FRAG = /* glsl */`
  precision mediump float;
  uniform sampler2D uMap;
  varying vec3 vTint;
  varying float vTwinkle;
  void main(){
    vec4 s = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vTint * s.rgb, s.a * vTwinkle);
  }
`;

// ---- a planet, drawn into a canvas ---------------------------------------
// Bands, a terminator, a limb, and optionally a ring. Flat, and from four
// hundred units away indistinguishable from a lit sphere.
function planetTexture(opts) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const R = S * 0.34, cx = S / 2, cy = S / 2;
  const rnd = mulberry32(opts.seed);

  // the ring goes behind the body
  if (opts.ring) {
    g.save();
    g.translate(cx, cy);
    g.rotate(opts.ringTilt || -0.42);
    g.scale(1, 0.24);
    for (let i = 0; i < 26; i++) {
      const rr = R * (1.32 + i * 0.024);
      g.beginPath();
      g.arc(0, 0, rr, 0, Math.PI * 2);
      g.strokeStyle = `rgba(${opts.ringColour}, ${0.05 + rnd() * 0.16})`;
      g.lineWidth = R * 0.022;
      g.stroke();
    }
    g.restore();
  }

  // the body, with latitude banding
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = opts.base;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < (opts.bands || 12); i++) {
    const y = cy - R + (2 * R) * (i / (opts.bands || 12));
    const h = (2 * R) / (opts.bands || 12) * (0.5 + rnd() * 0.8);
    g.fillStyle = `rgba(${opts.bandColour}, ${0.06 + rnd() * 0.2})`;
    g.fillRect(cx - R, y, R * 2, h);
  }
  // a couple of soft storms
  for (let i = 0; i < (opts.spots || 0); i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * R * 0.6;
    const sx = cx + Math.cos(a) * d, sy = cy + Math.sin(a) * d * 0.7;
    const sr = R * (0.07 + rnd() * 0.13);
    const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sg.addColorStop(0, `rgba(${opts.spotColour}, 0.5)`);
    sg.addColorStop(1, `rgba(${opts.spotColour}, 0)`);
    g.fillStyle = sg;
    g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  }
  // the terminator: the night side, falling away from the light
  const term = g.createLinearGradient(cx - R, cy - R, cx + R * 0.9, cy + R);
  term.addColorStop(0, 'rgba(0,0,0,0)');
  term.addColorStop(0.46, 'rgba(0,0,0,0.12)');
  term.addColorStop(0.78, 'rgba(0,0,0,0.72)');
  term.addColorStop(1, 'rgba(0,0,0,0.92)');
  g.fillStyle = term;
  g.fillRect(0, 0, S, S);
  g.restore();

  // the limb: a bright rim on the lit side, which is what sells a sphere
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2);
  g.strokeStyle = `rgba(${opts.limb || '255,255,255'}, 0.5)`;
  g.lineWidth = R * 0.035;
  g.stroke();
  g.restore();

  // and a thin atmosphere glowing outside it
  const atm = g.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.22);
  atm.addColorStop(0, `rgba(${opts.glow}, 0.30)`);
  atm.addColorStop(1, `rgba(${opts.glow}, 0)`);
  g.fillStyle = atm;
  g.beginPath(); g.arc(cx, cy, R * 1.22, 0, Math.PI * 2); g.fill();

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;
  return t;
}

const PLANETS = [
  { name: 'banded', pos: [-150, 78, -230], size: 74, seed: 3,
    base: '#c98f5a', bandColour: '120,70,38', spotColour: '236,180,120',
    glow: '230,170,110', bands: 16, spots: 3 },
  { name: 'ringed', pos: [186, 116, -300], size: 96, seed: 11,
    base: '#d9c48d', bandColour: '150,120,70', spotColour: '245,225,180',
    glow: '235,210,150', bands: 12, spots: 1, ring: true,
    ringColour: '226,206,164', ringTilt: -0.5 },
  { name: 'ice', pos: [-236, 44, -180], size: 46, seed: 23,
    base: '#7fb6d8', bandColour: '40,80,120', spotColour: '200,235,255',
    glow: '150,205,245', bands: 8, spots: 1 },
  { name: 'red', pos: [122, 40, -168], size: 34, seed: 41,
    base: '#b5573c', bandColour: '90,40,28', spotColour: '230,150,110',
    glow: '220,120,90', bands: 6, spots: 2 },
  // a moon, close and small, catching the same light the fountain does
  { name: 'moon', pos: [-92, 128, -96], size: 30, seed: 59,
    base: '#cfd3da', bandColour: '110,116,128', spotColour: '160,166,178',
    glow: '190,205,230', bands: 4, spots: 4 }
];

export class CosmicSky {
  constructor(renderer, quality) {
    this.quality = quality;
    this.group = new Group();
    this.group.name = 'cosmos';
    this.time = 0;

    // ---- the deep field ------------------------------------------------
    this.skyUniforms = {
      uHigh: { value: new Color().setHex(0x0a1130, SRGBColorSpace) },
      uLow: { value: new Color().setHex(0x03050f, SRGBColorSpace) },
      uBand: { value: new Color().setHex(0x2c3f78, SRGBColorSpace) },
      uTime: { value: 0 }
    };
    this.skyMat = new ShaderMaterial({
      uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: BackSide, depthWrite: false, depthTest: false, fog: false
    });
    this.dome = new Mesh(new SphereGeometry(1, 24, 16), this.skyMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1000;
    this.dome.name = 'deepField';
    this.group.add(this.dome);

    // ---- the stars ------------------------------------------------------
    const low = quality.get('name') === 'low';
    const N = low ? 900 : (quality.get('name') === 'high' ? 3200 : 1800);
    const pos = [], size = [], phase = [], tint = [];
    const rnd = mulberry32(7);
    // Real stars are not white. Most are cooler than the sun and a few are
    // much hotter, and that scatter is most of what makes a field look real.
    const COLOURS = [
      [1.00, 0.96, 0.92], [1.00, 0.90, 0.78], [0.98, 0.86, 0.66],
      [0.82, 0.88, 1.00], [0.72, 0.82, 1.00], [1.00, 0.98, 1.00]
    ];
    for (let i = 0; i < N; i++) {
      // on a sphere, evenly — not in a cube, which pools stars at the corners
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2;
      const r = 420 + rnd() * 60;
      const s = Math.sqrt(1 - u * u);
      pos.push(Math.cos(a) * s * r, u * r * 0.72 + 40, Math.sin(a) * s * r);
      // a steep magnitude distribution: many faint, very few bright
      const m = Math.pow(rnd(), 3.1);
      size.push(1.2 + m * 9.5);
      phase.push(rnd());
      const c = COLOURS[Math.floor(rnd() * COLOURS.length)];
      const b = 0.45 + m * 0.55;
      tint.push(c[0] * b, c[1] * b, c[2] * b);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aSize', new Float32BufferAttribute(size, 1));
    g.setAttribute('aPhase', new Float32BufferAttribute(phase, 1));
    g.setAttribute('aTint', new Float32BufferAttribute(tint, 3));
    g.computeBoundingSphere();

    this.starUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: quality.get('pixelRatio') },
      uReveal: { value: 0 },
      uMap: { value: starSprite() }
    };
    this.starMat = new ShaderMaterial({
      uniforms: this.starUniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending
    });
    this.stars = new Points(g, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -900;
    this.stars.name = 'stars';
    this.group.add(this.stars);

    // ---- the planets -----------------------------------------------------
    this.planets = new Group();
    this.planets.name = 'planets';
    this.planetSprites = [];
    const budget = low ? 3 : PLANETS.length;
    PLANETS.slice(0, budget).forEach(p => {
      // depthTest ON. A sprite is transparent, and the transparent pass runs
      // after the opaque one — so with depth testing off a planet three
      // hundred units away paints straight over the tower twenty units
      // away, whatever its renderOrder says. Testing against the depth
      // buffer is what actually puts it behind.
      const mat = new SpriteMaterial({
        map: planetTexture(p), transparent: true, depthWrite: false,
        depthTest: true, blending: NormalBlending, opacity: 0
      });
      const sp = new Sprite(mat);
      sp.position.set(p.pos[0], p.pos[1], p.pos[2]);
      sp.scale.setScalar(p.size);
      sp.name = p.name;
      sp.renderOrder = -880;
      sp.userData.drift = 0.004 + Math.random() * 0.004;
      this.planets.add(sp);
      this.planetSprites.push(sp);
    });
    this.group.add(this.planets);

    // ---- what the lighting rig and the water read ----------------------
    // The planets' terminators all fall away to the lower right, so the key
    // light comes from the upper left. Everything in the scene is lit from
    // that same direction, which is the only reason a flat sprite planet and
    // a shaded marble pier can share a frame without one of them looking
    // wrong.
    this.sunDirection = new Vector3(-0.42, 0.58, 0.70).normalize();
    this.sunColour = new Color().setHex(0xdce6ff, SRGBColorSpace);
    this.horizonColour = new Color().setHex(0x141c38, SRGBColorSpace);
    this.intensity = 0.62;
    // Kept in the shape LightingRig expects, so the rig did not have to
    // learn about space to work in it.
    this.uniforms = {
      uZenith: { value: new Color().setHex(0x1a2650, SRGBColorSpace) },
      uGround: { value: new Color().setHex(0x0a0f22, SRGBColorSpace) }
    };
    void renderer;
  }

  get object() { return this.group; }

  update(t, reveal) {
    this.time = t;
    this.skyUniforms.uTime.value = t;
    this.starUniforms.uTime.value = t;
    this.starUniforms.uReveal.value = reveal;
    // The planets do not orbit — they are hundreds of units away and orbital
    // motion at that distance would be invisible. They drift, barely, so the
    // sky is never quite the same twice.
    this.planetSprites.forEach((s, i) => {
      s.material.opacity = reveal;
      s.position.y += Math.sin(t * s.userData.drift + i) * 0.004;
    });
  }

  dispose() {
    this.skyMat.dispose();
    this.dome.geometry.dispose();
    this.starMat.dispose();
    this.stars.geometry.dispose();
    this.starUniforms.uMap.value.dispose();
    this.planetSprites.forEach(s => { s.material.map.dispose(); s.material.dispose(); });
  }
}
