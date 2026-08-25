// ==========================
// TEXTURES, MADE HERE
//
// Not one image file. Every map in this scene is drawn into a canvas at boot
// and uploaded — which is why the whole environment costs no download beyond
// the code that draws it, and why every map can follow the quality tier's
// resolution instead of shipping at one size and being scaled.
//
// What textures are actually for here is surface *break-up*. A wall with a
// constant roughness reads as plastic no matter how good the lighting is;
// the eye is looking for the story of how a surface was made and how it has
// weathered since. Concrete has form-tie marks and pour lines. Paving has
// joints and each slab is a slightly different stone. Glass is not uniformly
// smooth. None of that has to be loud to work — most of these maps vary over
// a range of a few per cent.
// ==========================
import {
  CanvasTexture, RepeatWrapping, LinearMipmapLinearFilter, LinearFilter, SRGBColorSpace
} from 'three';

// A small, fast, seedable value noise. Deterministic on purpose: the campus
// should look identical on every device and every reload.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeValueNoise(seed) {
  const rnd = mulberry32(seed);
  const G = 256;
  const grid = new Float32Array(G * G);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const at = (x, y) => grid[(y & (G - 1)) * G + (x & (G - 1))];
  const smooth = t => t * t * (3 - 2 * t);
  return function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi + 1, yi + 1), d = at(xi, yi + 1);
    return (a * (1 - xf) + b * xf) * (1 - yf) + (d * (1 - xf) + c * xf) * yf;
  };
}

function fbm(noise, x, y, octaves = 4, gain = 0.5, lac = 2) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += noise(x * f, y * f) * amp;
    norm += amp; amp *= gain; f *= lac;
  }
  return v / norm;
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function finish(c, { repeat = 1, srgb = false, aniso = 1 }) {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export class TextureFactory {
  constructor(quality, renderer) {
    this.size = quality.get('textureSize');
    this.aniso = Math.min(
      quality.get('anisotropy'),
      renderer ? renderer.capabilities.getMaxAnisotropy() : 1
    );
    this.cache = new Map();
  }

  _memo(key, make) {
    if (!this.cache.has(key)) this.cache.set(key, make());
    return this.cache.get(key);
  }

  dispose() {
    this.cache.forEach(t => { if (t && t.dispose) t.dispose(); });
    this.cache.clear();
  }

  // ---- concrete -------------------------------------------------------
  // Board-marked in-situ concrete: horizontal pour lines, the grid of tie
  // holes that the formwork left, and a slow blotchy variation from the mix.
  concrete({ repeat = 4, tint = 0.5 } = {}) {
    return this._memo(`concrete:${repeat}:${tint}`, () => {
      const S = this.size, c = canvas(S), g = c.getContext('2d');
      const n = makeValueNoise(11);
      const img = g.createImageData(S, S), d = img.data;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const u = x / S * 6, v = y / S * 6;
          let s = fbm(n, u, v, 5, 0.55);
          // the pour lines: a soft dark band every quarter of the tile
          const band = Math.abs(((y / S * 4) % 1) - 0.5);
          s -= band < 0.02 ? (0.02 - band) * 3.4 : 0;
          const l = Math.round(clamp255((tint + (s - 0.5) * 0.16) * 255));
          const i = (y * S + x) * 4;
          d[i] = l; d[i + 1] = l; d[i + 2] = Math.round(l * 0.995); d[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      // form-tie holes, on the grid a real shutter would have used
      g.fillStyle = 'rgba(0,0,0,0.20)';
      const step = S / 4;
      for (let y = step * 0.5; y < S; y += step) {
        for (let x = step * 0.5; x < S; x += step) {
          g.beginPath(); g.arc(x, y, S / 190, 0, Math.PI * 2); g.fill();
        }
      }
      return finish(c, { repeat, srgb: true, aniso: this.aniso });
    });
  }

  // ---- limestone paving ----------------------------------------------
  // Slabs, not a pattern. Each one is laid with a real joint, is a slightly
  // different stone from its neighbour, and is worn unevenly.
  paving({ repeat = 6, cols = 4, tint = 0.62 } = {}) {
    return this._memo(`paving:${repeat}:${cols}:${tint}`, () => {
      const S = this.size, c = canvas(S), g = c.getContext('2d');
      const n = makeValueNoise(29), rnd = mulberry32(7);
      g.fillStyle = '#2c2a27'; g.fillRect(0, 0, S, S);   // the joint colour
      const cell = S / cols, joint = Math.max(1, S / 300);
      for (let ry = 0; ry < cols; ry++) {
        // every other course is offset, the way slabs are actually laid
        const off = (ry % 2) * cell * 0.5;
        for (let rx = -1; rx <= cols; rx++) {
          const x = rx * cell + off + joint, y = ry * cell + joint;
          const w = cell - joint * 2, h = cell - joint * 2;
          const shade = tint + (rnd() - 0.5) * 0.075;
          const l = Math.round(clamp255(shade * 255));
          g.fillStyle = `rgb(${l},${Math.round(l * 0.985)},${Math.round(l * 0.955)})`;
          g.fillRect(x, y, w, h);
        }
      }
      // wear and staining over the top of the slabs, ignoring the joints
      const img = g.getImageData(0, 0, S, S), d = img.data;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const s = fbm(n, x / S * 9, y / S * 9, 4, 0.6) - 0.5;
          const i = (y * S + x) * 4;
          const k = 1 + s * 0.11;
          d[i] = clamp255(d[i] * k); d[i + 1] = clamp255(d[i + 1] * k); d[i + 2] = clamp255(d[i + 2] * k);
        }
      }
      g.putImageData(img, 0, 0);
      return finish(c, { repeat, srgb: true, aniso: this.aniso });
    });
  }

  // ---- roughness variation -------------------------------------------
  // The most valuable map in the whole set and the least visible one. It is
  // what stops every surface catching the sun in exactly the same way.
  roughness({ repeat = 4, base = 0.7, spread = 0.22, seed = 3, scale = 7 } = {}) {
    return this._memo(`rough:${repeat}:${base}:${spread}:${seed}:${scale}`, () => {
      const S = this.size, c = canvas(S), g = c.getContext('2d');
      const n = makeValueNoise(seed);
      const img = g.createImageData(S, S), d = img.data;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const v = fbm(n, x / S * scale, y / S * scale, 5, 0.55);
          const r = clamp255((base + (v - 0.5) * spread) * 255);
          const i = (y * S + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = r; d[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      return finish(c, { repeat, aniso: this.aniso });
    });
  }

  // ---- a normal map derived from the same noise -----------------------
  // Cheap Sobel over a height field. Enough to catch a grazing sun on a wall
  // and give it texture, which is all it is for.
  normal({ repeat = 4, strength = 1.0, seed = 5, scale = 9 } = {}) {
    return this._memo(`normal:${repeat}:${strength}:${seed}:${scale}`, () => {
      const S = this.size, c = canvas(S), g = c.getContext('2d');
      const n = makeValueNoise(seed);
      const h = new Float32Array(S * S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++)
          h[y * S + x] = fbm(n, x / S * scale, y / S * scale, 4, 0.55);
      const img = g.createImageData(S, S), d = img.data;
      const at = (x, y) => h[(((y % S) + S) % S) * S + (((x % S) + S) % S)];
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const dx = (at(x + 1, y) - at(x - 1, y)) * strength * 4;
          const dy = (at(x, y + 1) - at(x, y - 1)) * strength * 4;
          let nx = -dx, ny = -dy, nz = 1;
          const len = Math.hypot(nx, ny, nz);
          nx /= len; ny /= len; nz /= len;
          const i = (y * S + x) * 4;
          d[i] = (nx * 0.5 + 0.5) * 255;
          d[i + 1] = (ny * 0.5 + 0.5) * 255;
          d[i + 2] = (nz * 0.5 + 0.5) * 255;
          d[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      return finish(c, { repeat, aniso: this.aniso });
    });
  }
}

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
