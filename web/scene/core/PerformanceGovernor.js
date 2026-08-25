// ==========================
// PERFORMANCE GOVERNOR
//
// Device detection is a guess. This is the correction: watch the actual
// frame time and, if the device is plainly struggling, step the quality
// down once and stop. Two rules make it useful rather than annoying —
//
//   it only ever moves downward, because a tier that oscillates looks worse
//   than a tier that is slightly too low; and
//
//   it ignores the first second and a half, because that is compile,
//   upload and the first few frames of a cold pipeline, and judging a
//   device on those would demote everything.
// ==========================
export class PerformanceGovernor {
  constructor(quality, { sampleSeconds = 2.5, target = 46 } = {}) {
    this.quality = quality;
    this.sampleSeconds = sampleSeconds;
    this.target = target;
    this.reset();
  }

  reset() {
    this.t = 0;
    this.frames = 0;
    this.acc = 0;
    this.settled = false;
    this.done = false;
    this.fps = 60;
  }

  // Returns true if the tier changed, so the caller can rebuild what needs it.
  sample(dt) {
    if (this.done) return false;
    this.t += dt;
    if (this.t < 1.5) return false;                 // let the pipeline warm up
    this.acc += dt;
    this.frames++;
    if (this.acc < this.sampleSeconds) return false;

    this.fps = this.frames / this.acc;
    this.acc = 0; this.frames = 0;

    if (this.fps < this.target * 0.55) {
      this.done = true;
      return this.quality.demote(`measured ${this.fps.toFixed(0)} fps`);
    }
    if (this.fps >= this.target) { this.done = true; }   // it is fine, stop watching
    return false;
  }
}
