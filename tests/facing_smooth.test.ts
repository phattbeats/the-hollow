import { describe, it, expect } from 'vitest';
import { stepSelfFacing, approachAngle, SELF_TURN_MAX_RATE } from '../src/render/facing_smooth';

const FRAME_60 = 1 / 60;

describe('approachAngle', () => {
  it('takes the shortest path across the +/-PI wrap', () => {
    // from 3.0 to -3.0 is +0.28 the short way, not -6.0 the long way
    const r = approachAngle(3.0, -3.0, 1);
    expect(r).toBeCloseTo(-3.0, 5); // within one big step, snaps to target
  });

  it('clamps a large change to maxStep along the shortest direction', () => {
    expect(approachAngle(0, Math.PI, 0.1)).toBeCloseTo(0.1, 6);
    expect(approachAngle(0, -Math.PI / 2, 0.1)).toBeCloseTo(-0.1, 6);
  });

  it('passes a small change straight through', () => {
    expect(approachAngle(0, 0.05, 0.2)).toBeCloseTo(0.05, 6);
  });
});

describe('stepSelfFacing', () => {
  it('NEVER teleports the model across a near-180deg camera-driven jump in one frame', () => {
    // Reproduces the bug: standing in mouse-camera mode the player orbits the
    // camera ~180deg away from the model facing, then starts moving so the
    // override engages. The old code did `facing = override` (instant snap).
    const from = 0;
    const target = Math.PI - 0.01; // camera orbited almost fully behind
    const next = stepSelfFacing(from, target, FRAME_60);
    const moved = Math.abs(next - from);
    expect(moved).toBeLessThan(Math.PI); // not a teleport
    // capped at the configured max angular velocity for one 60Hz frame
    expect(moved).toBeCloseTo(SELF_TURN_MAX_RATE * FRAME_60, 5);
  });

  it('reaches the target smoothly over several frames', () => {
    let f = 0;
    const target = Math.PI - 0.01;
    let frames = 0;
    while (Math.abs(f - target) > 1e-6 && frames < 1000) {
      f = stepSelfFacing(f, target, FRAME_60);
      frames++;
    }
    expect(frames).toBeGreaterThan(1); // took more than a single snap frame
    expect(frames).toBeLessThan(120); // but converges quickly (well under ~1s)
    expect(f).toBeCloseTo(target, 5);
  });

  it('does NOT rate-limit intentional input below the cap (keyboard TURN_SPEED = PI rad/s)', () => {
    // one 60Hz frame of keyboard turning is PI/60 rad, far under the cap, so it
    // must pass through unchanged - no lag added to normal turning.
    const perFrame = Math.PI / 60;
    const next = stepSelfFacing(0, perFrame, FRAME_60);
    expect(next).toBeCloseTo(perFrame, 6);
  });

  it('clamps an over-long frame so a hitch cannot over-rotate', () => {
    const moved = Math.abs(stepSelfFacing(0, Math.PI, 0.5) - 0);
    // 0.5s would be a huge step; it is clamped to the MAX_FRAME_DT budget
    expect(moved).toBeLessThanOrEqual(SELF_TURN_MAX_RATE * (1 / 30) + 1e-9);
  });
});
