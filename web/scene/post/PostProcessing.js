// ==========================
// POST
//
// Restrained on purpose. The brief for this scene is architectural
// visualisation, not a game menu, and the fastest way to make a render look
// amateur is to announce that post-processing exists.
//
// Three things, in this order:
//
//   BLOOM      only on what is genuinely brighter than the display can
//              show — the sun in the sky, the specular glint off the water,
//              the lamp lenses. The threshold is high for exactly that
//              reason: bloom applied to a lit wall is just a blur.
//   TONE MAP   ACES, which is what actually makes a bright sky and a shaded
//              soffit coexist in eight bits. This is doing more for the
//              image than every other effect combined.
//   OUTPUT     the sRGB conversion, last, once.
//
// Ambient occlusion is on the HIGH tier only. It is the most expensive pass
// here and the one with the smallest effect at this camera distance.
// ==========================
import { Vector2 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class PostProcessing {
  constructor(renderer, scene, camera, quality) {
    this.enabled = true;
    this.quality = quality;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    if (quality.get('bloom')) {
      this.bloom = new UnrealBloomPass(
        new Vector2(1, 1),
        quality.get('bloomStrength'),
        0.5,        // radius: wide and soft, not a starburst
        0.92        // threshold: only genuinely over-bright pixels
      );
      this.composer.addPass(this.bloom);
    }

    this.composer.addPass(new OutputPass());
  }

  setSize(w, h, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w * pixelRatio, h * pixelRatio);
  }

  // The bloom eases in with the accent lighting rather than being on from
  // the first frame, so the fountain switching on actually reads.
  setBloom(k) {
    if (this.bloom) {
      this.bloom.strength = this.quality.get('bloomStrength') * (0.55 + 0.45 * k);
    }
  }

  render() { this.composer.render(); }

  dispose() {
    this.composer.passes.forEach(p => p.dispose && p.dispose());
    if (this.composer.renderTarget1) this.composer.renderTarget1.dispose();
    if (this.composer.renderTarget2) this.composer.renderTarget2.dispose();
  }
}
