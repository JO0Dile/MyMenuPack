// ==========================
// THE SKY, WHICH IS SPACE
//
// The fountain does not stand on a hill any more. It stands in the universe,
// so the sky is a deep field with a starfield over it.
//
// There were planets here. They are gone, and the reason is worth writing
// down: a camera-facing sprite is easy to draw and very hard to place. The
// landed camera sits twenty-one units from a tower that fills the middle of
// the frame, and a portrait phone sees about nineteen degrees either side of
// the view axis where a laptop sees forty-three — so any placement that
// framed on one was wrong on the other, and every attempt to fix it in one
// aspect ratio broke the other. The starfield needs none of that: it is
// spherical, so it is correct from every angle at every viewport.
//
// Everything here is 2D by design — points drawn into a canvas at boot,
// against a shader dome pinned to the far plane.
// ==========================
import {
  Points, BufferGeometry, Float32BufferAttribute, ShaderMaterial,
  CanvasTexture, AdditiveBlending, Group,
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
    // Radius 300, not 1. The shader pins the dome's depth to the far plane
    // (gl_Position = p.xyww), so the radius changes nothing about how it
    // looks — but the geometry still has to be *around* the camera to cover
    // the screen at all, and a one-unit sphere sitting at the origin is
    // inside the fountain. The deep field was being drawn into a thumbnail
    // and then painted over. The camera never gets further than 80 units
    // from the origin, so 300 always encloses it.
    this.dome = new Mesh(new SphereGeometry(300, 24, 16), this.skyMat);
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

    // ---- what the lighting rig and the water read ----------------------
    // A single distant sun from the upper left. Everything in the scene is
    // lit from this one direction; it is what keeps the marble, the water
    // and the flag agreeing with each other about where the light is.
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
  }

  dispose() {
    this.skyMat.dispose();
    this.dome.geometry.dispose();
    this.starMat.dispose();
    this.stars.geometry.dispose();
    this.starUniforms.uMap.value.dispose();
  }
}
