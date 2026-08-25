// ==========================
// TIMELINE
//
// The choreography of the opening: things arrive in an order, and the order
// is the point. A timeline is a list of cues with a time, a duration and an
// easing; reading it tells you what the first eight seconds look like without
// running them.
//
// Reduced motion collapses every cue to its end state on the first frame,
// which is not the same as deleting the design — the composition, the
// lighting and the copy all still arrive, they simply arrive already there.
// ==========================
import { Ease, clamp01, invLerp } from './Easing.js';

export class Timeline {
  constructor({ reduced = false } = {}) {
    this.cues = [];
    this.reduced = reduced;
    this.t = 0;
    this.running = true;
  }

  // at: seconds from the start. for: seconds it takes.
  cue(name, at, dur, ease = Ease.inOutCubic, onFire = null) {
    this.cues.push({ name, at, dur, ease, onFire, fired: false });
    this.cues.sort((a, b) => a.at - b.at);
    return this;
  }

  get duration() {
    return this.cues.reduce((m, c) => Math.max(m, c.at + c.dur), 0);
  }

  advance(dt) {
    if (!this.running) return;
    this.t += dt;
    for (const c of this.cues) {
      if (!c.fired && this.t >= c.at) {
        c.fired = true;
        if (c.onFire) c.onFire();
      }
    }
    if (this.t > this.duration + 0.5) this.running = false;
  }

  // How far through a named cue we are, 0..1, eased.
  at(name) {
    if (this.reduced) return 1;
    const c = this.cues.find(x => x.name === name);
    if (!c) return 1;
    if (c.dur <= 0) return this.t >= c.at ? 1 : 0;
    return c.ease(clamp01(invLerp(c.at, c.at + c.dur, this.t)));
  }

  done(name) { return this.at(name) >= 1; }

  // Jump to the end. Used by reduced motion, and by anyone who has already
  // seen this screen once.
  finish() {
    this.t = this.duration + 1;
    for (const c of this.cues) {
      if (!c.fired) { c.fired = true; if (c.onFire) c.onFire(); }
    }
    this.running = false;
  }
}
