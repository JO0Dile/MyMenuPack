// ==========================
// MATERIALS
//
// One library, built once, shared by everything. Two reasons that matters:
// a material is a shader program and duplicating them duplicates compiles,
// and — more important here — realism comes from a *small* palette of
// materials used consistently. A campus built from eleven materials looks
// like a campus. One where every mesh invents its own looks like a demo.
//
// Every value below is chosen against a real surface rather than picked to
// look nice on its own. Roughness is doing most of the work: the difference
// between honed limestone at 0.78 and polished granite at 0.22 is the whole
// difference between the fountain's body and its inscription band, and it is
// far more convincing than any change of colour would be.
// ==========================
import {
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, Color,
  DoubleSide, FrontSide, SRGBColorSpace
} from 'three';

// Authored in sRGB because that is how anyone reads a colour, converted on
// the way in because that is the only space lighting is correct in.
const c = hex => new Color().setHex(hex, SRGBColorSpace);

export class MaterialLibrary {
  constructor(textures, quality) {
    this.tex = textures;
    this.quality = quality;
    this.map = new Map();
    this._build();
  }

  get(name) {
    const m = this.map.get(name);
    if (!m) throw new Error('no material "' + name + '"');
    return m;
  }

  _add(name, mat) { mat.name = name; this.map.set(name, mat); return mat; }

  _build() {
    const T = this.tex;
    const hq = this.quality.get('textureSize') >= 512;

    // ---- stone ---------------------------------------------------------
    // The campus is faced in a warm Jerusalem-family limestone. Honed, so it
    // is rough enough to kill any highlight but not so rough it goes chalky.
    this._add('limestone', new MeshStandardMaterial({
      color: c(0xdedac9),
      roughness: 0.82,
      metalness: 0,
      map: hq ? T.paving({ repeat: 2, cols: 3, tint: 0.74 }) : null,
      roughnessMap: T.roughness({ repeat: 3, base: 0.82, spread: 0.16, seed: 12 }),
      normalMap: hq ? T.normal({ repeat: 3, strength: 0.5, seed: 12, scale: 11 }) : null
    }));

    // The same stone, cut and polished for copings and sills — sharper, and
    // it catches the sun where the walling does not.
    this._add('limestone-honed', new MeshStandardMaterial({
      color: c(0xe6e2d3), roughness: 0.55, metalness: 0,
      roughnessMap: T.roughness({ repeat: 4, base: 0.55, spread: 0.12, seed: 19 })
    }));

    // ---- concrete ------------------------------------------------------
    this._add('concrete', new MeshStandardMaterial({
      color: c(0xc9c6bd), roughness: 0.9, metalness: 0,
      map: hq ? T.concrete({ repeat: 3, tint: 0.66 }) : null,
      roughnessMap: T.roughness({ repeat: 3, base: 0.9, spread: 0.1, seed: 23 }),
      normalMap: hq ? T.normal({ repeat: 3, strength: 0.7, seed: 23, scale: 8 }) : null
    }));

    this._add('concrete-dark', new MeshStandardMaterial({
      color: c(0x8e8b84), roughness: 0.93, metalness: 0,
      roughnessMap: T.roughness({ repeat: 4, base: 0.93, spread: 0.08, seed: 31 })
    }));

    // ---- granite -------------------------------------------------------
    // The inscription band. Black, polished, and the only thing on the
    // landmark that reflects the sky — which is exactly why it reads as a
    // different material from ten metres away.
    this._add('granite', new MeshPhysicalMaterial({
      color: c(0x14171b), roughness: 0.16, metalness: 0.06,
      clearcoat: 0.6, clearcoatRoughness: 0.14,
      roughnessMap: T.roughness({ repeat: 2, base: 0.16, spread: 0.09, seed: 41 })
    }));

    // ---- glass ---------------------------------------------------------
    // The gem. Dark solar glass over a dark interior: barely transmissive,
    // strongly reflective at grazing angles, and a little rough because a
    // large pane never is not.
    // Real transmission, not opacity: the pane has thickness, refracts what
    // is behind it, and tints by depth. That is what makes an edge-on sheet
    // of glass read as glass instead of as a dark mirror.
    this._add('glass-dark', new MeshPhysicalMaterial({
      color: c(0xdfeaf2),
      roughness: 0.06,
      metalness: 0,
      transmission: 0.92,
      thickness: 0.9,
      ior: 1.52,
      attenuationColor: c(0x0e2233),
      attenuationDistance: 1.1,
      specularIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.6,
      transparent: true,
      side: FrontSide
    }));

    // The spandrel panels between the glazing — opaque, same family, matte.
    this._add('glass-spandrel', new MeshStandardMaterial({
      color: c(0x1b242e), roughness: 0.42, metalness: 0.1, envMapIntensity: 0.8
    }));

    // Ordinary vision glass on the ordinary buildings.
    this._add('glass-vision', new MeshPhysicalMaterial({
      color: c(0xe8f1f6), roughness: 0.075, metalness: 0,
      transmission: 0.86, thickness: 0.5, ior: 1.5,
      attenuationColor: c(0x2b4a5c), attenuationDistance: 2.2,
      clearcoat: 0.9, clearcoatRoughness: 0.06, envMapIntensity: 1.3,
      transparent: true
    }));

    // The authentication panel. Frosted rather than clear — it has to hold
    // type — with a bright edge that catches the sun, which is what makes a
    // pane read as a physical object rather than as a rectangle of blur.
    // Clear enough to see the tower through, with just enough roughness to
    // soften what is behind the type. Frosting past about 0.14 turns the
    // pane to milk and the landmark disappears behind the interface, which
    // is the opposite of what it is for.
    this._add('glass-ui', new MeshPhysicalMaterial({
      color: c(0xeaf2fb), roughness: 0.1, metalness: 0,
      transmission: 1, thickness: 0.16, ior: 1.34,
      attenuationColor: c(0x25405e), attenuationDistance: 9,
      clearcoat: 1, clearcoatRoughness: 0.06,
      specularIntensity: 1,
      envMapIntensity: 1.5, transparent: true, opacity: 0.62,
      side: DoubleSide
    }));
    this._add('glass-ui-edge', new MeshPhysicalMaterial({
      color: c(0xbcd4ee), roughness: 0.12, metalness: 0.35,
      clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 2.0,
      emissive: c(0x2c4d78), emissiveIntensity: 0.06
    }));

    // ---- metal ---------------------------------------------------------
    // Two different metals, because "metal" is not a material. Anodised
    // aluminium for the mullions and handrails; painted steel for the
    // struts and the crane.
    this._add('aluminium', new MeshStandardMaterial({
      color: c(0x9aa0a6), roughness: 0.34, metalness: 1,
      roughnessMap: T.roughness({ repeat: 6, base: 0.34, spread: 0.14, seed: 53 }),
      envMapIntensity: 1.1
    }));

    this._add('steel-dark', new MeshStandardMaterial({
      color: c(0x3d4148), roughness: 0.46, metalness: 0.9, envMapIntensity: 0.9
    }));

    // The red struts under the gem, and the diagonal stair. Painted steel:
    // metalness zero, a little gloss, and it is the one saturated thing in
    // the whole composition.
    this._add('paint-red', new MeshPhysicalMaterial({
      color: c(0xb8352a), roughness: 0.36, metalness: 0,
      clearcoat: 0.55, clearcoatRoughness: 0.3, envMapIntensity: 0.9
    }));

    this._add('paint-green', new MeshPhysicalMaterial({
      color: c(0x1f7a3d), roughness: 0.38, metalness: 0,
      clearcoat: 0.4, clearcoatRoughness: 0.32, envMapIntensity: 0.8
    }));

    this._add('paint-white', new MeshStandardMaterial({
      color: c(0xeeece7), roughness: 0.5, metalness: 0, envMapIntensity: 0.8
    }));

    // ---- ground --------------------------------------------------------
    this._add('paving', new MeshStandardMaterial({
      color: c(0xbdb6a6), roughness: 0.86, metalness: 0,
      map: T.paving({ repeat: 9, cols: 4, tint: 0.72 }),
      roughnessMap: T.roughness({ repeat: 9, base: 0.86, spread: 0.14, seed: 61 }),
      normalMap: hq ? T.normal({ repeat: 9, strength: 0.55, seed: 61, scale: 10 }) : null
    }));

    // The band of finer paving on the island, laid in rings rather than
    // slabs — a different repeat is enough to tell them apart.
    this._add('paving-fine', new MeshStandardMaterial({
      color: c(0xcac3b3), roughness: 0.8, metalness: 0,
      map: T.paving({ repeat: 16, cols: 5, tint: 0.78 }),
      roughnessMap: T.roughness({ repeat: 12, base: 0.8, spread: 0.12, seed: 67 })
    }));

    this._add('asphalt', new MeshStandardMaterial({
      color: c(0x35383d), roughness: 0.94, metalness: 0,
      roughnessMap: T.roughness({ repeat: 14, base: 0.94, spread: 0.07, seed: 71 }),
      normalMap: hq ? T.normal({ repeat: 14, strength: 0.4, seed: 71, scale: 14 }) : null
    }));

    // The hill the whole thing is cut into. Dry, pale, and mercifully matte.
    this._add('ground', new MeshStandardMaterial({
      color: c(0xa89272), roughness: 0.97, metalness: 0,
      roughnessMap: T.roughness({ repeat: 8, base: 0.97, spread: 0.05, seed: 83 }),
      normalMap: hq ? T.normal({ repeat: 8, strength: 0.9, seed: 83, scale: 6 }) : null
    }));

    this._add('ground-far', new MeshStandardMaterial({
      color: c(0x9d8f78), roughness: 1, metalness: 0
    }));

    // ---- planting ------------------------------------------------------
    this._add('foliage', new MeshStandardMaterial({
      color: c(0x4a6b3a), roughness: 0.88, metalness: 0, side: DoubleSide
    }));
    this._add('bark', new MeshStandardMaterial({
      color: c(0x5a4c3c), roughness: 0.95, metalness: 0
    }));

    // ---- emissive ------------------------------------------------------
    // Lamps and accent lighting. Emissive rather than lit, because a lamp
    // head is a source, not a surface — and bloom will do the rest.
    this._add('lamp-lit', new MeshBasicMaterial({ color: c(0xffd9a0) }));
    this._add('lamp-body', new MeshStandardMaterial({
      color: c(0x2b2e33), roughness: 0.5, metalness: 0.8
    }));

    this._add('sign-lit', new MeshBasicMaterial({ color: c(0x6fe39a) }));
  }

  // Every lit material in the scene shares one environment. Assigning it in
  // one place means the sky can change without hunting through the graph.
  applyEnvironment(envMap) {
    this.map.forEach(m => {
      if ('envMap' in m) { m.envMap = envMap; m.needsUpdate = true; }
    });
  }

  dispose() {
    this.map.forEach(m => m.dispose());
    this.map.clear();
  }
}
