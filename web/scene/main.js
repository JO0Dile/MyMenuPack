// ==========================
// THE LANDING SCENE
//
// The entry point. Everything above this is a system with one job; this is
// where they are assembled, ordered and driven.
//
// It is deliberately the only module with a `window.` on it. The rest of the
// app talks to it through AAUP_CAMPUS3D — the same two-method contract the
// line renderer had (`mount`, `stop`) — so nothing outside had to change and
// the fallback path is untouched: if anything in here throws, the canvas
// never gets `.is-live`, the original drawing stays visible, and the student
// signs in exactly as before.
//
// Load order matters and is the choreography:
//
//   0.0  the sky exists, and the environment map is built from it. Nothing
//        can be lit until this is done, so it is first and it is synchronous.
//   0.0  ground and architecture are built, hidden.
//   0.2  the environment fades up
//   1.0  the architecture rises into it
//   2.6  the camera flight is already running under all of this
//   6.2  the fountain switches on
//   6.8  the architectural lighting comes up
//   7.0  the camera lands and the student takes it
// ==========================
import {
  Scene, WebGLRenderer, Group, Color, ACESFilmicToneMapping,
  PCFSoftShadowMap, SRGBColorSpace, Clock, PMREMGenerator
} from 'three';

import { Quality } from './core/Quality.js';
import { Timeline } from './core/Timeline.js';
import { Ease, clamp01 } from './core/Easing.js';
import { PerformanceGovernor } from './core/PerformanceGovernor.js';
import { TextureFactory } from './materials/TextureFactory.js';
import { MaterialLibrary } from './materials/MaterialLibrary.js';
import { CosmicSky } from './env/CosmicSky.js';
import { LightingRig } from './env/LightingRig.js';
import { CameraController } from './camera/CameraController.js';
import { Plaza, PLAZA } from './build/Plaza.js';
import { Landmark, LANDMARK } from './build/Landmark.js';
import { Flag } from './build/Flag.js';
import { FountainSystem } from './water/FountainSystem.js';
import { AestheticPostProcessing } from './post/AestheticPostProcessing.js';
import { GlassPanel } from './ui/GlassPanel.js';
import { LoadingManager } from './core/LoadingManager.js';

class LandingScene {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.dead = false;
    this.raf = 0;
    this.clock = new Clock();

    this.quality = new Quality();
    const reduced = this.quality.reducedMotion;

    // ---- renderer ------------------------------------------------------
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: this.quality.get('name') !== 'low',
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false
    });
    this.renderer.setPixelRatio(this.quality.get('pixelRatio'));
    // ACES is the single most important line in this file for how the image
    // reads: without it a low sun and a shaded soffit cannot both be right.
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = SRGBColorSpace;
    if (this.quality.get('shadows')) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFSoftShadowMap;
    }

    // ---- scene ---------------------------------------------------------
    this.scene = new Scene();

    // النافورة وطريق, and around it the universe. There is no hill, no city
    // and no horizon: the paved disc simply ends, and past it are stars.
    this.sky = new CosmicSky(this.renderer, this.quality);
    this.scene.add(this.sky.object);

    // The environment every material reflects. In space that is a dim, cool
    // wash rather than a bright sky — which is exactly why the marble reads
    // as marble here and the water still catches a highlight.
    const env = this._spaceEnvironment();
    this.scene.environment = env;
    // No fog. Fog is atmosphere and there isn't any; the disc ends at a hard
    // edge because that is the point of the image.
    this.scene.fog = null;

    this.textures = new TextureFactory(this.quality, this.renderer);
    this.materials = new MaterialLibrary(this.textures, this.quality);
    this.materials.applyEnvironment(env);

    this.camera = new CameraController({ reduced });
    this.lighting = new LightingRig(this.scene, this.sky, this.quality);

    // ---- the world -----------------------------------------------------
    this.world = new Group();
    this.world.name = 'world';
    this.scene.add(this.world);

    this.plaza = new Plaza(this.materials, this.quality);
    this.landmark = new Landmark(this.materials, this.quality);
    this.water = new FountainSystem({
      radius: LANDMARK.poolRadius - 0.66,
      level: LANDMARK.waterLevel,
      sky: this.sky
    });
    this.panel = new GlassPanel(this.materials, this.quality);
    // Off to the west, clear of the sightline, where a flagpole stands on
    // the real plaza.
    this.flag = new Flag(this.materials, this.quality, this.sky, { x: -15.5, z: 4.5 });

    this.world.add(
      this.plaza.object, this.landmark.object, this.water.object,
      this.flag.object, this.panel.object
    );

    this.lighting.placeLamps(this.plaza.lampPositions);

    // ---- post ----------------------------------------------------------
    this.post = new AestheticPostProcessing(this.renderer, this.scene, this.camera.camera, this.quality);
    this.governor = new PerformanceGovernor(this.quality);

    // ---- choreography --------------------------------------------------
    this.timeline = new Timeline({ reduced })
      .cue('sky', 0.0, 1.2, Ease.outCubic)
      .cue('ground', 0.35, 1.4, Ease.outQuart)
      .cue('architecture', 0.9, 2.0, Ease.outQuart)
      .cue('detail', 1.9, 1.6, Ease.outCubic)
      .cue('water', 5.4, 1.6, Ease.outCubic)
      .cue('accent', 6.0, 2.2, Ease.inOutCubic)
      .cue('brand', 6.4, 1.0, Ease.outExpo, () => this._emit('brand'))
      .cue('auth', 6.9, 1.1, Ease.outExpo, () => this._emit('auth'));
    if (reduced) this.timeline.finish();

    this.camera.onLanded = () => this._emit('landed');

    this._bindInput();
    this._resize();
  }

  // A prefiltered environment taken from the deep field itself, so glass and
  // marble reflect the sky they are actually standing in.
  _spaceEnvironment() {
    const pmrem = new PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const box = new Scene();
    box.add(this.sky.dome.clone());
    const rt = pmrem.fromScene(box, 0.06);
    pmrem.dispose();
    this._envTarget = rt;
    return rt.texture;
  }

  _emit(name) {
    this.canvas.dispatchEvent(new CustomEvent('scene:' + name, { bubbles: true }));
  }

  // ---- the frame -------------------------------------------------------
  frame = () => {
    if (this.dead) return;
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;

    // Absolute time, so the choreography and the camera can never disagree
    // about what second it is however slow the frames are.
    this.timeline.setTime(t);
    if (this.governor.sample(dt)) this._applyDemotion();

    this.camera.update(t, dt);
    this.water.update(t, this.camera.camera);
    this.flag.update(t);

    // The reveal: the world does not fade as a whole, it arrives in the
    // order things are built in — ground, then structure, then detail.
    const g = this.timeline.at('ground');
    const a = this.timeline.at('architecture');
    const d = this.timeline.at('detail');
    this.landmark.object.visible = a > 0.01;
    this.plaza.object.visible = g > 0.01;
    this.flag.object.visible = d > 0.01;
    this.flag.setWind(0.35 + 0.65 * d);
    // the stars are there from the first frame and come up first of all
    this.sky.update(t, this.timeline.at('sky'));
    this.renderer.toneMappingExposure = 0.45 + 0.70 * this.timeline.at('sky');

    const w = this.timeline.at('water');
    this.water.object.visible = w > 0.01;
    this.water.setJets(w);


    const acc = this.timeline.at('accent');
    this.lighting.setAccent(acc);
    this.plaza.setAccent(acc);
    this.post.setBloom(acc);


    const auth = this.timeline.at('auth');
    this.panel.setAppear(auth);
    this.panel.update(t, this.camera.camera);
    if (auth > 0.5 && this.opts.onPanelRect) {
      const r = this.panel.projectFooter(this.camera.camera, this.canvas.clientWidth, this.canvas.clientHeight);
      this.opts.onPanelRect(r);
    }
    void d;

    this.post.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  _applyDemotion() {
    // Only the things that can be changed without rebuilding the world.
    this.renderer.setPixelRatio(this.quality.get('pixelRatio'));
    if (!this.quality.get('shadows')) this.renderer.shadowMap.enabled = false;
    this._resize();
  }

  _resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const pr = this.quality.get('pixelRatio');
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.setViewport(w, h);
    this.post.setSize(w, h, pr);
  }

  _bindInput() {
    const c = this.canvas;
    const rect = () => c.getBoundingClientRect();

    this._onMove = e => { this.camera.pointerMove(e, rect()); };
    this._onDown = e => {
      if (this.camera.pointerDown(e)) {
        c.classList.add('is-turning');
        try { c.setPointerCapture(e.pointerId); } catch (err) { /* older engines */ }
      }
    };
    this._onUp = e => {
      if (this.camera.pointerUp()) {
        c.classList.remove('is-turning');
        try { if (e.pointerId != null) c.releasePointerCapture(e.pointerId); } catch (err) { /* nothing held */ }
      }
    };
    this._onLeave = () => this.camera.pointerLeave();
    this._onOrient = e => this.camera.orientation(e);
    this._onVisible = () => {
      if (document.hidden) { cancelAnimationFrame(this.raf); this.raf = 0; }
      else if (!this.raf && !this.dead) { this.clock.getDelta(); this.raf = requestAnimationFrame(this.frame); }
    };
    this._onLost = e => { e.preventDefault(); this.stop(); };
    this._onResize = () => this._resize();

    c.addEventListener('pointermove', this._onMove);
    c.addEventListener('pointerdown', this._onDown);
    c.addEventListener('pointerup', this._onUp);
    c.addEventListener('pointercancel', this._onUp);
    window.addEventListener('pointerup', this._onUp);
    c.addEventListener('pointerleave', this._onLeave);
    window.addEventListener('deviceorientation', this._onOrient);
    document.addEventListener('visibilitychange', this._onVisible);
    c.addEventListener('webglcontextlost', this._onLost);
    window.addEventListener('resize', this._onResize);
  }

  start() {
    this.canvas.classList.add('is-live');
    this.canvas.classList.add('can-turn');
    this.clock.start();
    this.raf = requestAnimationFrame(this.frame);
    return true;
  }

  stop() {
    if (this.dead) return;
    this.dead = true;
    cancelAnimationFrame(this.raf);
    const c = this.canvas;
    c.removeEventListener('pointermove', this._onMove);
    c.removeEventListener('pointerdown', this._onDown);
    c.removeEventListener('pointerup', this._onUp);
    c.removeEventListener('pointercancel', this._onUp);
    window.removeEventListener('pointerup', this._onUp);
    c.removeEventListener('pointerleave', this._onLeave);
    window.removeEventListener('deviceorientation', this._onOrient);
    document.removeEventListener('visibilitychange', this._onVisible);
    c.removeEventListener('webglcontextlost', this._onLost);
    window.removeEventListener('resize', this._onResize);
    c.classList.remove('is-live', 'can-turn', 'is-turning');

    this.post.dispose();
    this.water.dispose();
    this.flag.dispose();
    this.materials.dispose();
    this.textures.dispose();
    this.lighting.dispose();
    this.sky.dispose();
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
    });
    this.renderer.dispose();
  }
}

// ---- the contract the rest of the app already speaks --------------------
let live = null;

// Building the scene takes long enough that doing it in one synchronous
// block would freeze the page on the frame the landing appears. So it is
// staged, with a yield between each stage, and the loading screen reports
// what is actually happening rather than counting to a hundred on a timer.
async function mount(canvas, opts = {}) {
  if (!canvas) return false;
  stop();
  const host = canvas.parentNode || document.body;
  const loader = new LoadingManager(host, opts.lang || 'en');
  try {
    const scene = new LandingScene(canvas, opts);
    live = scene;
    await loader.step();                 // sky and environment
    await loader.step();                 // materials
    await loader.step();                 // ground
    await loader.step();                 // architecture
    await loader.step();                 // lighting
    if (opts.lang) scene.panel.setLanguage(opts.lang);
    scene.start();
    loader.finish();
    return true;
  } catch (err) {
    loader.fail();
    if (live) { try { live.stop(); } catch (e) { /* already down */ } }
    live = null;
    return false;
  }
}

function stop() {
  if (!live) return;
  try { live.stop(); } catch (e) { /* already down */ }
  live = null;
}

window.AAUP_CAMPUS3D = { mount, stop, get scene() { return live; } };
export { mount, stop, LandingScene, PLAZA };
