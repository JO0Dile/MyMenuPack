// ==========================
// LIGHT
//
// Not one light over the scene. Five roles, each doing a job you can name:
//
//   KEY      the sun. Low, warm, west. Casts every shadow in the scene and
//            decides which faces of the landmark are lit — which is the
//            whole of the composition.
//   FILL     a hemisphere light standing in for skylight. Cool from above,
//            warm bounce from the ground below. This is what stops shadow
//            sides going to dead black.
//   RIM      a dim cold light from behind and opposite the key, at grazing
//            angle. It draws a thin bright edge down the shaded side of the
//            tower and separates it from the buildings behind. Nobody
//            notices it and everybody would notice its absence.
//   ACCENT   the architectural uplighting on the landmark itself, and the
//            lamps. Comes up late in the choreography, which is what makes
//            the landmark read as *the* landmark.
//   AMBIENT  a floor, kept very low, only because a pure IBL ambient can
//            leave deep recesses at zero.
//
// The shadow camera is fitted tightly to the part of the scene that is
// actually near the landmark. A directional shadow map spread over the whole
// two-hundred-metre hill would put four texels on the arcade.
// ==========================
import {
  DirectionalLight, HemisphereLight, AmbientLight, SpotLight, PointLight,
  Color, Vector3, Object3D, SRGBColorSpace
} from 'three';

const c = hex => new Color().setHex(hex, SRGBColorSpace);

export class LightingRig {
  constructor(scene, sky, quality) {
    this.scene = scene;
    this.sky = sky;
    this.quality = quality;
    this.group = new Object3D();
    this.group.name = 'lighting';
    scene.add(this.group);
    this.accents = [];
    this._build();
  }

  _build() {
    const q = this.quality;
    const sunI = this.sky.intensity;

    // ---- key: the sun ---------------------------------------------------
    const key = new DirectionalLight(this.sky.sunColour.clone(), 3.1 * sunI);
    key.position.copy(this.sky.sunDirection).multiplyScalar(120);
    key.target.position.set(0, 6, -6);
    this.group.add(key, key.target);

    if (q.get('shadows')) {
      key.castShadow = true;
      const s = q.get('shadowMapSize');
      key.shadow.mapSize.set(s, s);
      // Fitted to the landmark and its plaza, not to the hill. Everything
      // further than this is lit but does not cast — which nobody can tell,
      // because at that distance the shadow would be a pixel.
      const cam = key.shadow.camera;
      cam.left = -46; cam.right = 46; cam.top = 46; cam.bottom = -46;
      cam.near = 40; cam.far = 250;
      cam.updateProjectionMatrix();
      // Bias is the difference between contact shadows and shadow acne on
      // every flat face. Normal bias does the work; the constant bias is
      // small and negative to keep contact tight.
      key.shadow.bias = -0.0006;
      key.shadow.normalBias = 0.035;
      key.shadow.radius = 3;
    }
    this.key = key;

    // ---- fill: skylight and ground bounce -------------------------------
    const fill = new HemisphereLight(
      this.sky.uniforms.uZenith.value.clone(),
      this.sky.uniforms.uGround.value.clone(),
      1.05 * sunI
    );
    fill.position.set(0, 40, 0);
    this.group.add(fill);
    this.fill = fill;

    // ---- rim ------------------------------------------------------------
    const rim = new DirectionalLight(c(0x9fc4ff), 0.85 * sunI);
    rim.position.set(
      -this.sky.sunDirection.x * 90,
      34,
      -this.sky.sunDirection.z * 90 - 60
    );
    rim.target.position.set(0, 9, 0);
    this.group.add(rim, rim.target);
    this.rim = rim;

    // ---- ambient floor ---------------------------------------------------
    this.ambient = new AmbientLight(c(0x8fa6c4), 0.12 * sunI);
    this.group.add(this.ambient);

    // ---- accent: the landmark is lit, deliberately -----------------------
    // Two narrow uplights washing the tower from inside the pool, the way a
    // monument like this is actually lit after dark. They start at zero and
    // come up on the timeline.
    const lampBudget = q.get('lampLights');
    for (const side of [-1, 1]) {
      const up = new SpotLight(c(0xffe6c2), 0, 34, Math.PI / 9, 0.55, 1.4);
      up.position.set(side * 5.2, 0.9, 4.6);
      up.target.position.set(side * 0.6, 12, 0);
      up.castShadow = false;
      this.group.add(up, up.target);
      this.accents.push(up);
    }
    // A cold wash on the gem, so the glass has something to catch after the
    // sun has gone.
    const gemWash = new SpotLight(c(0x86b6ff), 0, 60, Math.PI / 7, 0.7, 1.6);
    gemWash.position.set(16, 2, -18);
    gemWash.target.position.set(16, 14, -40);
    this.group.add(gemWash, gemWash.target);
    this.accents.push(gemWash);

    // The lamps along the circle only become real lights on the higher
    // tiers; below that they are emissive geometry and bloom, which is
    // most of the look for none of the cost.
    this.lampLights = [];
    for (let i = 0; i < lampBudget; i++) {
      const p = new PointLight(c(0xffd9a0), 0, 16, 2);
      this.group.add(p);
      this.lampLights.push(p);
    }
  }

  placeLamps(positions) {
    this.lampLights.forEach((l, i) => {
      const p = positions[i % positions.length];
      if (p) l.position.set(p.x, p.y, p.z);
    });
  }

  // Driven by the timeline: the architectural lighting comes up after the
  // camera has settled, which is what makes it read as a deliberate reveal
  // rather than as the scene simply being bright.
  setAccent(t) {
    const k = Math.max(0, Math.min(1, t));
    this.accents[0].intensity = 16 * k;
    this.accents[1].intensity = 16 * k;
    this.accents[2].intensity = 10 * k;
    this.lampLights.forEach(l => { l.intensity = 2.4 * k; });
  }

  // The whole rig dims together when the sign-in panel takes focus, so the
  // interface separates from the world without a scrim being thrown over it.
  setExposureBias(k) {
    this.key.intensity = 3.1 * this.sky.intensity * k;
    this.fill.intensity = 1.05 * this.sky.intensity * k;
    this.rim.intensity = 0.85 * this.sky.intensity * k;
  }

  dispose() {
    this.group.traverse(o => { if (o.dispose) o.dispose(); });
    this.scene.remove(this.group);
  }
}
