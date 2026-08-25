// ==========================
// SKY
//
// A physical-ish gradient sky rendered on a box, and — more importantly —
// the source of every reflection in the scene. Without an environment map a
// PBR material has nothing to be shiny *with*: glass goes flat black, metal
// goes grey, and the whole point of the material system is lost. So the sky
// is drawn once, run through PMREM, and handed to everything.
//
// The hour is late afternoon into blue hour: a low warm sun in the west,
// a cool zenith, and a bright horizon band. That is the light this hill
// actually gets in the photographs, and it is also the most flattering
// light for architecture — long shadows, warm faces, cool shade.
// ==========================
import {
  Mesh, BoxGeometry, ShaderMaterial, BackSide, Color, Vector3,
  PMREMGenerator, Scene, SRGBColorSpace
} from 'three';

const VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;               // always on the far plane
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColour;
  uniform float uSunSize;
  uniform float uHaze;
  uniform float uLevel;

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;

    // Sky: zenith to horizon, biased so most of the visible band is the
    // gradient rather than flat blue. pow() rather than a linear ramp
    // because the real one falls off fast near the top.
    float t = pow(clamp(h, 0.0, 1.0), 0.42);
    vec3 sky = mix(uHorizon, uZenith, t);

    // Below the horizon: the ground bounce, which is what fills the
    // undersides of things once this becomes an environment map.
    float g = pow(clamp(-h, 0.0, 1.0), 0.5);
    sky = mix(sky, uGround, g);

    // The sun, and the glow around it. Two lobes: a small hot disc and a
    // wide soft one, which is the cheapest convincing approximation of
    // scattering there is.
    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.35, sd);
    float glow = pow(sd, 26.0) * 0.55 + pow(sd, 5.0) * 0.16;
    sky += uSunColour * (disc * 6.0 + glow);

    // Haze pooled along the horizon, strongest toward the sun.
    float band = exp(-abs(h) * 9.0);
    sky = mix(sky, mix(uHorizon, uSunColour, 0.28), band * uHaze);

    gl_FragColor = vec4(sky * uLevel, 1.0);
  }
`;

const PRESET = {
  // The one the scene ships with: late afternoon, sun low in the west.
  afternoon: {
    zenith: 0x5f95d8, horizon: 0xe2dccd, ground: 0x8a7860,
    sun: 0xffd7a3, sunAltitude: 17, sunAzimuth: -104,
    sunSize: 0.018, haze: 0.55, intensity: 1.0, level: 1.45
  },
  // Kept because the app has dark themes and a bright sky behind a dark UI
  // is a fight nobody wins.
  blueHour: {
    zenith: 0x16294d, horizon: 0x9d7d78, ground: 0x2b2620,
    sun: 0xff9d5c, sunAltitude: 3.5, sunAzimuth: -110,
    sunSize: 0.02, haze: 0.72, intensity: 0.55, level: 0.9
  },
  night: {
    zenith: 0x070c18, horizon: 0x1d2637, ground: 0x0a0c11,
    sun: 0x4a6ea8, sunAltitude: -6, sunAzimuth: -110,
    sunSize: 0.012, haze: 0.4, intensity: 0.16, level: 0.5
  }
};

export class EnvironmentManager {
  constructor(renderer, presetName = 'afternoon') {
    this.renderer = renderer;
    this.preset = { ...PRESET[presetName] };
    this.presetName = presetName;

    const uniforms = {
      uZenith: { value: new Color().setHex(this.preset.zenith, SRGBColorSpace) },
      uHorizon: { value: new Color().setHex(this.preset.horizon, SRGBColorSpace) },
      uGround: { value: new Color().setHex(this.preset.ground, SRGBColorSpace) },
      uSunDir: { value: new Vector3() },
      uSunColour: { value: new Color().setHex(this.preset.sun, SRGBColorSpace) },
      uSunSize: { value: this.preset.sunSize },
      uHaze: { value: this.preset.haze },
      uLevel: { value: this.preset.level }
    };
    this.uniforms = uniforms;
    this.sunDirection = new Vector3();
    this._recomputeSun();

    this.material = new ShaderMaterial({
      uniforms, vertexShader: VERT, fragmentShader: FRAG,
      side: BackSide, depthWrite: false, depthTest: false, fog: false
    });
    this.mesh = new Mesh(new BoxGeometry(2, 2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.name = 'sky';
  }

  _recomputeSun() {
    const alt = this.preset.sunAltitude * Math.PI / 180;
    const azi = this.preset.sunAzimuth * Math.PI / 180;
    this.sunDirection.set(
      Math.cos(alt) * Math.sin(azi),
      Math.sin(alt),
      Math.cos(alt) * Math.cos(azi)
    ).normalize();
    this.uniforms.uSunDir.value.copy(this.sunDirection);
  }

  get horizonColour() { return this.uniforms.uHorizon.value; }
  get sunColour() { return this.uniforms.uSunColour.value; }
  get intensity() { return this.preset.intensity; }

  // Render the sky into a cube and prefilter it. This is the single most
  // valuable thing in the lighting setup: it is where glass gets something
  // to reflect, where metal gets its colour, and where every upward-facing
  // surface gets its ambient.
  buildEnvironment() {
    const pmrem = new PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const scene = new Scene();
    scene.add(this.mesh.clone());
    const rt = pmrem.fromScene(scene, 0.04);
    pmrem.dispose();
    this.envMap = rt.texture;
    this._envTarget = rt;
    return this.envMap;
  }

  dispose() {
    this.material.dispose();
    this.mesh.geometry.dispose();
    if (this._envTarget) this._envTarget.dispose();
  }
}

export { PRESET as SKY_PRESETS };
