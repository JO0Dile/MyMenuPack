// ==========================
// QUALITY
//
// One place that decides how hard this device should be pushed, and one
// object everything else reads. Three tiers; the visual gap between them is
// deliberately small and the cost gap is not.
//
// The detection is deliberately conservative. Nothing here can actually
// measure a GPU — `renderer.info` tells you what you drew, not how much the
// device minded — so the tier is a starting guess from cheap signals, and
// PerformanceGovernor moves it down if the frame time disagrees.
// ==========================

export const TIER = { LOW: 0, MEDIUM: 1, HIGH: 2 };

const PRESETS = {
  [TIER.LOW]: {
    name: 'low',
    pixelRatio: 1,
    shadows: false,
    shadowMapSize: 0,
    shadowCascades: 0,
    ao: false,
    bloom: true,
    bloomStrength: 0.22,
    anisotropy: 1,
    textureSize: 256,
    waterReflection: false,
    instancedDetail: 0.45,   // how much of the optional scatter is placed
    lampLights: 0,           // real point lights on the lamps
    maxLights: 3
  },
  [TIER.MEDIUM]: {
    name: 'medium',
    pixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    shadowCascades: 1,
    ao: false,
    bloom: true,
    bloomStrength: 0.3,
    anisotropy: 4,
    textureSize: 512,
    waterReflection: false,
    instancedDetail: 0.75,
    lampLights: 2,
    maxLights: 6
  },
  [TIER.HIGH]: {
    name: 'high',
    pixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    shadowCascades: 1,
    ao: true,
    bloom: true,
    bloomStrength: 0.34,
    anisotropy: 8,
    textureSize: 1024,
    waterReflection: true,
    instancedDetail: 1,
    lampLights: 4,
    maxLights: 10
  }
};

// Cheap signals, read once. None of them is reliable alone, which is why the
// governor exists — but together they keep a five-year-old phone out of the
// shadow-mapped, ambient-occluded path it would choke on.
function guess() {
  const nav = typeof navigator === 'undefined' ? {} : navigator;
  const mem = nav.deviceMemory || 0;                 // GB, Chromium only
  const cores = nav.hardwareConcurrency || 0;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 480;
  const dpr = devicePixelRatio || 1;
  const saveData = !!(nav.connection && nav.connection.saveData);

  if (saveData) return TIER.LOW;
  // A phone that reports little memory or few cores is telling the truth
  // often enough to trust.
  if (mem && mem <= 2) return TIER.LOW;
  if (cores && cores <= 2) return TIER.LOW;
  if (coarse && small && dpr >= 3 && (!mem || mem <= 4)) return TIER.LOW;
  if (coarse) return (mem >= 6 || cores >= 8) ? TIER.MEDIUM : TIER.LOW;
  if (mem && mem >= 8 && cores >= 8) return TIER.HIGH;
  if (cores >= 4) return TIER.MEDIUM;
  return TIER.MEDIUM;
}

export class Quality {
  constructor(forced) {
    this.tier = forced != null ? forced : guess();
    this.settings = { ...PRESETS[this.tier] };
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._listeners = new Set();
    // The pixel ratio is capped independently of the tier: past 2 the cost is
    // quadratic and nobody can see it.
    this.settings.pixelRatio = Math.min(this.settings.pixelRatio, devicePixelRatio || 1);
  }

  get name() { return this.settings.name; }
  get(key) { return this.settings[key]; }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  // Only ever called downward, by the governor, and only once — a tier that
  // oscillates is worse than a tier that is slightly too low.
  demote(reason) {
    if (this.tier === TIER.LOW) return false;
    this.tier -= 1;
    const keep = this.settings.pixelRatio;
    this.settings = { ...PRESETS[this.tier] };
    this.settings.pixelRatio = Math.min(this.settings.pixelRatio, keep, devicePixelRatio || 1);
    this.demotedBecause = reason;
    this._listeners.forEach(fn => fn(this));
    return true;
  }
}
