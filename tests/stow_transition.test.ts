// PHAA-737 Row J (upstream #1765 ADAPT). The sheathed swap is deferred to the
// midpoint of the arm-gesture one-shot so the prop re-parents while the hand
// passes the shoulder instead of teleporting. This state machine is the pure
// timing/target logic; visual.ts plays the clip and performs the swap. Three
// events (`'none' | 'expired' | 'swap'`) drive the visual layer, and rapid
// retoggles / mid-flight reversals are the interesting cases.

import { describe, expect, it } from 'vitest';
import {
  createStowTransition,
  forceStow,
  requestStow,
  tickStow,
} from '../src/render/characters/stow_transition';

describe('createStowTransition', () => {
  it('starts with both flags off and no pending timer', () => {
    const t = createStowTransition();
    expect(t.attached).toBe(false);
    expect(t.target).toBe(false);
    expect(t.timer).toBe(0);
  });
});

describe('forceStow', () => {
  it('snaps to a new pose and returns true when a re-attach is needed', () => {
    const t = createStowTransition();
    expect(forceStow(t, true)).toBe(true);
    expect(t.attached).toBe(true);
    expect(t.target).toBe(true);
    expect(t.timer).toBe(0);
  });

  it('returns false and stays put when the requested pose already matches', () => {
    const t = createStowTransition();
    forceStow(t, true);
    expect(forceStow(t, true)).toBe(false);
    expect(t.attached).toBe(true);
  });

  it('cancels any pending deferred swap', () => {
    const t = createStowTransition();
    requestStow(t, true, 0.5); // pending: target=true, attached=false, timer=0.5
    expect(t.timer).toBeGreaterThan(0);
    forceStow(t, true);
    expect(t.timer).toBe(0);
    expect(t.attached).toBe(true);
  });
});

describe('requestStow', () => {
  it('records the new target and arms the timer', () => {
    const t = createStowTransition();
    expect(requestStow(t, true, 0.5)).toBe(true);
    expect(t.target).toBe(true);
    expect(t.timer).toBeCloseTo(0.5);
    expect(t.attached).toBe(false);
  });

  it('is a no-op when the target already matches', () => {
    const t = createStowTransition();
    requestStow(t, true, 0.5);
    const before = { target: t.target, timer: t.timer, attached: t.attached };
    expect(requestStow(t, true, 0.5)).toBe(false);
    expect(t.target).toBe(before.target);
    expect(t.timer).toBe(before.timer);
    expect(t.attached).toBe(before.attached);
  });

  it('replays the gesture on a mid-flight reversal (returns true)', () => {
    const t = createStowTransition();
    requestStow(t, true, 0.5); // sheath in progress
    // Reverse: target flips to false, the caller must replay the arm gesture.
    expect(requestStow(t, false, 0.5)).toBe(true);
    expect(t.target).toBe(false);
    expect(t.timer).toBeCloseTo(0.5);
    expect(t.attached).toBe(false); // still hasn't swapped
  });

  it('clamps a zero / negative swap delay to a tiny positive value (one-frame guard)', () => {
    const t = createStowTransition();
    requestStow(t, true, 0);
    expect(t.timer).toBeGreaterThan(0);
    expect(t.timer).toBeLessThan(1e-3);
  });
});

describe('tickStow', () => {
  it("returns 'none' when no swap is pending", () => {
    const t = createStowTransition();
    expect(tickStow(t, 0.016)).toBe('none');
  });

  it("returns 'none' while the timer is still counting down", () => {
    const t = createStowTransition();
    requestStow(t, true, 0.5);
    expect(tickStow(t, 0.1)).toBe('none');
    expect(t.timer).toBeGreaterThan(0);
  });

  it("returns 'swap' exactly when the deferred re-parent must be applied", () => {
    const t = createStowTransition();
    requestStow(t, true, 0.1);
    // One tick that fully lapses the timer fires the swap on that tick.
    const ev = tickStow(t, 0.1);
    expect(ev).toBe('swap');
    expect(t.attached).toBe(true);
    expect(t.timer).toBe(0);
  });

  it("returns 'expired' when a mid-flight reversal lands back on the already-attached pose", () => {
    const t = createStowTransition();
    forceStow(t, true); // attached=true, target=true
    // Mid-flight reversal: target flips to false, arms a fresh timer.
    requestStow(t, false, 0.1);
    // Now re-reverse to the original target (no swap should happen; we are
    // already attached to the matching pose).
    requestStow(t, true, 0.05);
    expect(t.attached).toBe(true);
    // One tick that fully lapses the timer fires the expired event on that tick.
    const ev = tickStow(t, 0.05);
    expect(ev).toBe('expired');
    expect(t.attached).toBe(true);
    expect(t.timer).toBe(0);
  });

  it('idempotent: repeated ticks after a swap return "none"', () => {
    const t = createStowTransition();
    requestStow(t, true, 0.05);
    const first = tickStow(t, 0.05); // swap fires here
    expect(first).toBe('swap');
    expect(tickStow(t, 0.016)).toBe('none');
    expect(tickStow(t, 1.0)).toBe('none');
  });

  it('a second request after a swap arms a fresh timer (next gesture replays)', () => {
    const t = createStowTransition();
    requestStow(t, true, 0.05);
    tickStow(t, 0.05); // swap fires, attached=true, target=true
    // Second stow-off request: arm a new timer.
    expect(requestStow(t, false, 0.2)).toBe(true);
    expect(t.target).toBe(false);
    expect(t.timer).toBeCloseTo(0.2);
    expect(t.attached).toBe(true); // not yet swapped
    // One tick that fully lapses the timer fires the next swap.
    const ev = tickStow(t, 0.2);
    expect(ev).toBe('swap');
    expect(t.attached).toBe(false);
  });
});
