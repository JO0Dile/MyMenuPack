// ==========================
// DUST
//
// Motes in the shafts of low sun. Two things make this read as air rather
// than as snow: they are only visible where the key light would actually
// catch them, and they move on convection — slow, rising, wandering — not
// on a wind.
//
// One Points draw, everything on the GPU, and it is the first thing the LOW
// tier drops.
// ==========================
import {
  Points, BufferGeometry, Float32BufferAttribute, ShaderMaterial,
  AdditiveBlending, Color, Vector3, SRGBColorSpace
} from 'three';

const VERT = /* glsl */`
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uReveal;
  varying float vFade;
  varying float vSeed;

  void main() {
    vSeed = aSeed;
    vec3 p = position;

    // convection: a slow rise that recycles, plus two wanders at different
    // frequencies so no two motes track each other
    float life = fract(aSeed + uTime * 0.021);
    p.y += life * 14.0;
    p.x += sin(uTime * 0.19 + aSeed * 43.0) * 1.5
         + sin(uTime * 0.07 + aSeed * 11.0) * 3.2;
    p.z += cos(uTime * 0.16 + aSeed * 27.0) * 1.5
         + cos(uTime * 0.05 + aSeed * 7.0) * 3.0;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    // fade in at birth, out at death, and away with distance so the far
    // field does not turn into static
    float ends = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.78, 1.0, life));
    float dist = 1.0 - smoothstep(24.0, 96.0, -mv.z);
    vFade = ends * dist * uReveal;

    gl_PointSize = aSize * uPixelRatio * (36.0 / max(1.0, -mv.z));
  }
`;

const FRAG = /* glsl */`
  precision mediump float;
  uniform vec3 uColour;
  varying float vFade;
  varying float vSeed;
  void main() {
    // a soft round mote, not a square
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    float a = (1.0 - smoothstep(0.02, 0.25, r)) * vFade;
    // a little variation in warmth, so they are not all the same speck
    vec3 col = uColour * (0.82 + fract(vSeed * 13.0) * 0.36);
    gl_FragColor = vec4(col, a * 0.26);
  }
`;

export class ParticleSystem {
  constructor(quality, sky) {
    const low = quality.get('name') === 'low';
    this.count = low ? 0 : (quality.get('name') === 'high' ? 900 : 420);
    this.enabled = this.count > 0;
    if (!this.enabled) { this.points = null; return; }

    const pos = [], seed = [], size = [];
    for (let i = 0; i < this.count; i++) {
      // concentrated where the camera actually is: around the plaza, not
      // spread evenly over two hundred metres of hill
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.pow(Math.random(), 0.6) * 34;
      pos.push(Math.cos(a) * r, Math.random() * 10 - 2, Math.sin(a) * r + 2);
      seed.push(Math.random());
      size.push(0.7 + Math.random() * 2.1);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
    g.setAttribute('aSize', new Float32BufferAttribute(size, 1));
    g.computeBoundingSphere();

    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: quality.get('pixelRatio') },
      uReveal: { value: 0 },
      uColour: { value: new Color().copy(sky.sunColour).lerp(new Color().setHex(0xffffff, SRGBColorSpace), 0.3) }
    };
    this.material = new ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: AdditiveBlending
    });
    this.points = new Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'dust';
  }

  get object() { return this.points; }

  update(t, reveal) {
    if (!this.enabled) return;
    this.uniforms.uTime.value = t;
    this.uniforms.uReveal.value = reveal;
  }

  dispose() {
    if (!this.enabled) return;
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

export { Vector3 };
