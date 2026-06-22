// Rate-limit the local player model's visual yaw, factored out of the renderer
// so it can be reasoned about and unit-tested without a WebGL context.
//
// The camera can drive the player's heading (classic right-mouse mouselook, or
// the always-on Mouse Camera mode while a movement key is held). While that
// override is DISENGAGED the player freely orbits the camera (camYaw) yet the
// model keeps showing the interpolated sim facing, so the two diverge by up to
// 180deg. Applying the override as a raw assignment then snaps the model across
// that whole gap in a single frame - the model "instantly rotates backwards".
// Clamping the per-frame change to a max angular velocity makes the model rotate
// smoothly to follow the camera instead of teleporting. The cap sits well above
// any intentional input (keyboard TURN_SPEED is PI rad/s, a normal mouse drag is
// only a few degrees per frame) so ordinary turning passes straight through and
// only a discontinuity, or a violent flick, gets smoothed.

export const SELF_TURN_MAX_RATE = 10; // rad/sec cap on camera-driven model yaw
const MAX_FRAME_DT = 1 / 30; // clamp long frames so a hitch cannot over-rotate

/** Shortest signed angular distance from `from` to `to`, in (-PI, PI]. */
export function wrapAngle(d: number): number {
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Move `current` toward `target` by at most `maxStep` radians, taking the
 * shortest path around the +/-PI wrap. Changes within `maxStep` snap to target.
 */
export function approachAngle(current: number, target: number, maxStep: number): number {
  const step = Math.max(0, maxStep);
  const d = wrapAngle(target - current);
  if (Math.abs(d) <= step) return target;
  return current + Math.sign(d) * step;
}

/**
 * Advance the player model's displayed yaw one frame toward a camera-driven
 * target, capped at SELF_TURN_MAX_RATE so it can never teleport. `current` is the
 * yaw shown last frame (seed it from the live interpolated facing on first
 * engage); `frameDt` is the frame delta in seconds.
 */
export function stepSelfFacing(current: number, target: number, frameDt: number): number {
  const dt = Math.min(Math.max(0, frameDt), MAX_FRAME_DT);
  return approachAngle(current, target, SELF_TURN_MAX_RATE * dt);
}
