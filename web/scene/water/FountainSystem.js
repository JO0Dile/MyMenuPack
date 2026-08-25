// ==========================
// WATER
//
// A fountain basin, not an ocean. The surface is small, always seen from
// close and from above, and it sits under a low sun — so what matters is
// the specular highlight breaking up as the surface moves, and the sky
// reflecting in it. Refraction and depth-fade would cost real time and
// nobody would see either at this scale.
//
// So: a PBR surface with a scrolling dual-octave normal, a reflection of
// the environment, and a fresnel that opens up at grazing angles the way
// water actually does — nearly transparent looking straight down, a mirror
// at the far rim.
// ==========================
import {
  Mesh, CircleGeometry, ShaderMaterial, Color, Vector2, Vector3,
  DoubleSide, SRGBColorSpace, UniformsUtils, UniformsLib
} from 'three';

const VERT = /* glsl */`
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec2 vUv;
  varying float vHeight;
  uniform float uTime;
  uniform float uJetWash;

  // Real vertex displacement, not just a normal trick: the surface itself
  // moves. It matters at the rim, where the silhouette of the water against
  // the stone visibly rises and falls.
  float wave(vec2 p, float t) {
    float a = sin(p.x * 3.1 + t * 0.9) * cos(p.y * 3.5 - t * 0.7);
    float b = sin(p.x * 7.3 - t * 1.3 + cos(p.y * 6.1)) * 0.45;
    float r = length(p);
    float rings = sin(r * 26.0 - t * 2.1) * smoothstep(0.25, 0.95, r) * uJetWash;
    return (a + b) * 0.5 + rings * 0.8;
  }

  void main() {
    vUv = uv;
    vec2 p = (uv - 0.5) * 2.0;
    float h = wave(p, uTime);
    vHeight = h;
    vec3 displaced = position + vec3(0.0, h * 0.035, 0.0);
    vec4 w = modelMatrix * vec4(displaced, 1.0);
    vWorld = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec2 vUv;
  varying float vHeight;

  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSunDir;
  uniform vec3 uSunColour;
  uniform vec3 uSkyColour;
  uniform vec3 uCamera;
  uniform float uJetWash;

  // Two crossed wave trains at different scales and speeds. Cheap, and the
  // interference between them is what stops a moving water surface reading
  // as a single sliding pattern.
  vec3 ripple(vec2 p) {
    float t = uTime;
    vec2 a = p * 3.1 + vec2(t * 0.09, t * 0.055);
    vec2 b = p * 7.3 - vec2(t * 0.14, t * 0.11);
    vec2 c = p * 15.0 + vec2(-t * 0.2, t * 0.17);
    float ha = sin(a.x) * cos(a.y * 1.13);
    float hb = sin(b.x * 1.07 + cos(b.y)) * 0.42;
    float hc = sin(c.x + sin(c.y * 1.3)) * 0.16;
    // Rings pushed out from the jets around the rim, decaying inward.
    float r = length(p);
    float rings = sin(r * 26.0 - t * 2.1) * 0.5 * uJetWash * smoothstep(0.25, 0.95, r);
    float h = ha + hb + hc + rings;
    // gradient of that height field, by finite difference in the analytic
    // derivatives we already have
    float dx = cos(a.x) * cos(a.y * 1.13) * 3.1
             + cos(b.x * 1.07 + cos(b.y)) * 0.42 * 7.3 * 1.07
             + cos(c.x + sin(c.y * 1.3)) * 0.16 * 15.0;
    float dy = -sin(a.x) * sin(a.y * 1.13) * 1.13 * 3.1
             + 0.42 * cos(b.x * 1.07 + cos(b.y)) * -sin(b.y) * 7.3
             + 0.16 * cos(c.x + sin(c.y * 1.3)) * cos(c.y * 1.3) * 1.3 * 15.0;
    return normalize(vec3(-dx * 0.012, 1.0, -dy * 0.012)) * (0.5 + 0.5 * h * 0.0 + 1.0) - vec3(0.0, 0.0, 0.0);
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    if (length(p) > 1.0) discard;

    vec3 n = normalize(ripple(p));
    vec3 v = normalize(uCamera - vWorld);

    // Fresnel. Looking down, you see the basin; looking across, the sky.
    float f = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.4);
    f = mix(0.035, 1.0, f);

    vec3 body = mix(uDeep, uShallow, smoothstep(0.2, 1.0, length(p)));
    vec3 sky = mix(uSkyColour, uSunColour, 0.18);

    // The specular: a tight sun glint on the moving surface. This is the
    // single most water-like thing in the shader — the highlight has to
    // break into shards rather than sit as one blob.
    vec3 h = normalize(normalize(uSunDir) + v);
    float spec = pow(max(dot(n, h), 0.0), 420.0) * 3.2
               + pow(max(dot(n, h), 0.0), 44.0) * 0.32;

    // the crests catch a little more sky than the troughs
    vec3 col = mix(body, sky, clamp(f + vHeight * 0.05, 0.0, 1.0)) + uSunColour * spec;

    // Foam where the jets land, kept to a whisper.
    float foam = smoothstep(0.82, 0.99, length(p)) * uJetWash * 0.20;
    col = mix(col, vec3(0.93, 0.95, 0.97), foam);

    gl_FragColor = vec4(col, mix(0.86, 1.0, f));
  }
`;

export class FountainSystem {
  constructor({ radius, level, sky }) {
    this.uniforms = {
      uTime: { value: 0 },
      uShallow: { value: new Color().setHex(0x2f7fb8, SRGBColorSpace) },
      uDeep: { value: new Color().setHex(0x0e3f6b, SRGBColorSpace) },
      uSunDir: { value: sky.sunDirection.clone() },
      uSunColour: { value: sky.sunColour.clone() },
      uSkyColour: { value: sky.horizonColour.clone() },
      uCamera: { value: new Vector3() },
      uJetWash: { value: 0.0 }
    };
    // Enough rings and segments for the displacement to read as a
    // surface rather than as a fan of triangles rippling at the centre.
    const geo = new CircleGeometry(radius, 128, 0, Math.PI * 2);
    geo.rotateX(-Math.PI / 2);
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      side: DoubleSide
    });
    this.mesh = new Mesh(geo, this.material);
    this.mesh.position.y = level;
    this.mesh.name = 'water';
    this.mesh.receiveShadow = false;
  }

  get object() { return this.mesh; }

  update(t, camera) {
    this.uniforms.uTime.value = t;
    this.uniforms.uCamera.value.copy(camera.position);
  }

  // The jets come on with the rest of the accent lighting rather than
  // running from the first frame — a fountain switching on is a better
  // moment than a fountain that was always on.
  setJets(k) { this.uniforms.uJetWash.value = Math.max(0, Math.min(1, k)); }

  dispose() { this.material.dispose(); this.mesh.geometry.dispose(); }
}

export { UniformsUtils, UniformsLib, Vector2 };
