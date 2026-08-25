// ==========================
// CAMERA — LOCKED
//
// This behaviour is a settled design decision and is ported here unchanged
// from the previous implementation. Do not redesign it. The keyframes, the
// seven-second duration, the smoothstep between segments, the breath, the
// pointer lean, and the post-landing orbit around the fountain are all
// deliberate and were arrived at by iteration.
//
//   0.00   high and wide over the whole ridge
//   0.42   coming down over the road
//   1.00   the tower centred, the cut block over its left shoulder and the
//          gem over its right
//
// Then the student owns it: drag to swing round the fountain, which never
// moves, because the camera rides a sphere centred on the tower's axis and
// aimed at it. A flick carries on and eases out. Until the first drag it
// turns very slowly by itself.
//
// The only things changed for the rebuild are technical, and are marked
// TECHNICAL below: near/far planes fitted to the new geometry so nothing
// clips, and a vertical field of view that widens on narrow viewports so a
// portrait phone frames the same composition instead of cropping it. Both
// preserve the intended shot; neither alters the movement.
// ==========================
import { PerspectiveCamera, Vector3 } from 'three';
import { clamp } from '../core/Easing.js';

const KEYS = [
  { t: 0.00, eye: [-20, 40, 64], at: [22, 9, -34] },
  { t: 0.42, eye: [-13, 20, 40], at: [10, 8, -20] },
  { t: 1.00, eye: [-3, 4.2, 21.5], at: [0, 5.6, 0] }
];
const FLIGHT_SECONDS = 7.0;

// What the camera turns around once it has landed: the tower's own axis, at
// the height the flight was already aiming at.
const PIVOT = new Vector3(0, 5.6, 0);

export class CameraController {
  constructor({ reduced = false } = {}) {
    // TECHNICAL: far was 460 in the line renderer and has to clear the third
    // ridge at z = -205 seen from the opening eye. near is as far out as it
    // can go without clipping the pool rim in the landed frame, because a
    // tight near/far ratio is most of the depth buffer's precision.
    this.camera = new PerspectiveCamera(62, 1, 0.35, 620);
    this.camera.name = 'camera';
    this.reduced = reduced;

    this.eye = new Vector3();
    this.at = new Vector3();

    this.tilt = { x: 0, y: 0, wantX: 0, wantY: 0 };
    this.orbit = null;
    this.dragging = false;
    this._last = { x: 0, y: 0 };
    this._baseFov = 62;
  }

  // TECHNICAL, responsive only. The shot is framed on its vertical extent;
  // holding a constant vertical field of view on a portrait phone throws the
  // buildings either side out of frame. Widening it on narrow aspects keeps
  // the same subject in the same place with the same relationship to the
  // frame — the composition, not the numbers, is what is locked.
  setViewport(width, height) {
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    const fov = aspect < 0.72
      ? this._baseFov + (0.72 - aspect) * 44   // portrait phones
      : aspect > 2.1
        ? this._baseFov - (aspect - 2.1) * 6   // very wide desktops
        : this._baseFov;
    this.camera.fov = clamp(fov, 52, 82);
    this.camera.updateProjectionMatrix();
  }

  // 0 while the flight runs, 1 once it has landed.
  progress(t) {
    return this.reduced ? 1 : Math.min(1, t / FLIGHT_SECONDS);
  }

  update(t, dt) {
    const raw = this.progress(t);
    let eye, at;

    if (raw >= 1) {
      eye = KEYS[2].eye.slice();
      at = KEYS[2].at.slice();
    } else {
      const seg = raw < KEYS[1].t ? 0 : 1;
      const a = KEYS[seg], b = KEYS[seg + 1];
      let u = (raw - a.t) / (b.t - a.t);
      u = u * u * (3 - 2 * u);                       // smoothstep
      eye = [0, 0, 0]; at = [0, 0, 0];
      for (let i = 0; i < 3; i++) {
        eye[i] = a.eye[i] + (b.eye[i] - a.eye[i]) * u;
        at[i] = a.at[i] + (b.at[i] - a.at[i]) * u;
      }
    }

    // Ease the lean toward wherever the device or pointer last asked for, so
    // a sharp movement still arrives as a glide.
    this.tilt.x += (this.tilt.wantX - this.tilt.x) * 0.06;
    this.tilt.y += (this.tilt.wantY - this.tilt.y) * 0.06;

    if (raw >= 1) {
      if (!this.orbit) {
        const dx = KEYS[2].eye[0] - PIVOT.x;
        const dy = KEYS[2].eye[1] - PIVOT.y;
        const dz = KEYS[2].eye[2] - PIVOT.z;
        const r = Math.hypot(dx, dy, dz);
        this.orbit = {
          r, yaw: Math.atan2(dx, dz), elev: Math.asin(dy / r),
          v: 0, touched: false, landed: t
        };
        if (this.onLanded) this.onLanded();
      }
      const o = this.orbit;
      if (!this.dragging) {
        o.yaw += o.v;
        o.v *= 0.93;                                  // the flick, easing out
        if (!o.touched && !this.reduced && t - o.landed > 2.0) o.yaw += 0.00065;
      }
      // The lean and the breath ride the orbit rather than world space: a
      // shove along world X means one thing from the south and the opposite
      // from the north.
      const oy = o.yaw - (this.dragging ? 0 : this.tilt.x * 0.055);
      const oe = o.elev - (this.dragging ? 0 : this.tilt.y * 0.05);
      const rad = o.r * (this.reduced ? 1 : 1 + Math.sin(t * 0.31) * 0.014);
      this.eye.set(
        PIVOT.x + Math.cos(oe) * Math.sin(oy) * rad,
        PIVOT.y + Math.sin(oe) * rad + (this.reduced ? 0 : Math.sin(t * 0.23) * 0.10),
        PIVOT.z + Math.cos(oe) * Math.cos(oy) * rad
      );
      this.at.copy(PIVOT);
    } else {
      if (!this.reduced) {
        eye[2] += Math.sin(t * 0.31) * 0.30;
        eye[1] += Math.sin(t * 0.23) * 0.10;
      }
      eye[0] += this.tilt.x * 1.7;
      eye[1] -= this.tilt.y * 0.5;
      at[0] += this.tilt.x * 0.5;
      at[1] -= this.tilt.y * 1.2;
      this.eye.set(eye[0], eye[1], eye[2]);
      this.at.set(at[0], at[1], at[2]);
    }

    this.camera.position.copy(this.eye);
    this.camera.lookAt(this.at);
  }

  get canTurn() { return !!this.orbit; }

  // ---- input, unchanged -------------------------------------------------
  pointerMove(e, rect) {
    if (this.dragging && this.orbit) {
      const dx = (e.clientX - this._last.x) / Math.max(1, rect.width);
      const dy = (e.clientY - this._last.y) / Math.max(1, rect.height);
      this._last.x = e.clientX; this._last.y = e.clientY;
      const step = -dx * 3.4;
      this.orbit.yaw += step;
      this.orbit.v = step * 0.55;
      this.orbit.elev = clamp(this.orbit.elev + dy * 1.1, -0.17, 0.62);
      return true;
    }
    this.tilt.wantX = ((e.clientX - rect.left) / rect.width * 2 - 1) * 1.1;
    this.tilt.wantY = ((e.clientY - rect.top) / rect.height * 2 - 1) * 0.6;
    return false;
  }

  pointerDown(e) {
    if (!this.orbit) return false;
    this.dragging = true;
    this._last.x = e.clientX; this._last.y = e.clientY;
    this.orbit.touched = true;
    this.orbit.v = 0;
    return true;
  }

  pointerUp() {
    if (!this.dragging) return false;
    this.dragging = false;
    return true;
  }

  pointerLeave() { this.tilt.wantX = 0; this.tilt.wantY = 0; }

  orientation(e) {
    if (e.gamma == null) return;
    this.tilt.wantX = clamp(e.gamma / 26, -1.1, 1.1);
    this.tilt.wantY = clamp(((e.beta || 45) - 45) / 40, -0.6, 0.6);
  }
}

export { KEYS as CAMERA_KEYFRAMES, FLIGHT_SECONDS, PIVOT as CAMERA_PIVOT };
