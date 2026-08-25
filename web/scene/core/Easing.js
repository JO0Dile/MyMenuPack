// ==========================
// EASING AND INTERPOLATION
//
// Linear motion is the single loudest tell that an animation was not thought
// about. Everything that moves in this scene moves through one of these.
// ==========================

export const Ease = {
  linear: t => t,
  // The workhorse. Symmetric, no overshoot, reads as "considered".
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutQuart: t => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  // For things arriving: fast in, long settle. Camera moves, panels landing.
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  outQuint: t => 1 - Math.pow(1 - t, 5),
  // For things leaving.
  inCubic: t => t * t * t,
  // A single soft overshoot — used sparingly, and never on the camera.
  outBack: (t, s = 1.42) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  // Expo out is the one that reads as expensive: almost all of the movement
  // happens immediately and then it glides for a long time.
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  smoothstep: t => t * t * (3 - 2 * t),
  smootherstep: t => t * t * t * (t * (t * 6 - 15) + 10)
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = v => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));

// Map a value from one range to another, eased, and clamped at both ends.
export function remap(v, a, b, c, d, ease = Ease.linear) {
  return lerp(c, d, ease(clamp01(invLerp(a, b, v))));
}

// Frame-rate independent exponential smoothing. `damp` is the fraction of the
// remaining distance closed per second — the naive `x += (target - x) * 0.1`
// silently changes speed with frame rate, which is why a lean feels different
// on a 120 Hz phone.
export function damp(current, target, lambda, dt) {
  return lerp(target, current, Math.exp(-lambda * dt));
}

// A cut of a longer timeline: 0 before `start`, 1 after `end`, eased between.
export function stage(t, start, end, ease = Ease.inOutCubic) {
  return ease(clamp01(invLerp(start, end, t)));
}
