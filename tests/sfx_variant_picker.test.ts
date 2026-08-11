// Pure-picker tests for src/game/sfx_variant_picker.ts. No DOM, no WebAudio
// stub; the picker is a pure function on a `Rng` instance and a list of
// usable indices. These tests are the only place the picker is exercised in
// isolation, and they double as a behavioural pin for upstream PR #1901's
// no-repeat-biased random selection algorithm adapted to the fork's Rng.

import { describe, expect, it } from 'vitest';
import { pickWeightedVariant, REPEAT_VARIANT_WEIGHT } from '../src/game/sfx_variant_picker';
import { Rng } from '../src/sim/rng';

describe('pickWeightedVariant', () => {
  it('returns the single usable index when only one variant is usable', () => {
    const rng = new Rng(1);
    expect(pickWeightedVariant(rng, [2], 0)).toBe(2);
    expect(pickWeightedVariant(rng, [2], 2)).toBe(2); // last match is irrelevant with 1 usable
    expect(pickWeightedVariant(rng, [2], undefined)).toBe(2);
  });

  it('returns 0 defensively when usable is empty (caller invariant)', () => {
    const rng = new Rng(1);
    expect(pickWeightedVariant(rng, [], 0)).toBe(0);
  });

  it('covers every usable index across many rolls (3-take pool)', () => {
    const rng = new Rng(42);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      seen.add(pickWeightedVariant(rng, [0, 1, 2], undefined));
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(1)).toBe(true);
    expect(seen.has(2)).toBe(true);
  });

  it('downweights but does NOT exclude the immediately previous variant', () => {
    // 2-take pool: every draw is either index 0 or 1. With last=0 the roll
    // weight on 0 is REPEAT_VARIANT_WEIGHT (0.15) and on 1 is 1.0. Across
    // many draws, both indices must still appear; the back-to-back repeat
    // rate (Picking the same index as `last` twice) must stay low.
    const rng = new Rng(7);
    let picks = 0;
    let repeats = 0;
    let last: number | undefined;
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const p = pickWeightedVariant(rng, [0, 1], last);
      picks++;
      seen.add(p);
      if (p === last) repeats++;
      last = p;
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(1)).toBe(true);
    // Observed repeat rate should be near REPEAT_VARIANT_WEIGHT (0.15) but
    // allow for sampling noise. Use a wide bound so the test stays robust.
    const repeatRate = repeats / picks;
    expect(repeatRate).toBeGreaterThan(0);
    expect(repeatRate).toBeLessThan(REPEAT_VARIANT_WEIGHT + 0.05);
  });

  it('treats a `last` not present in `usable` as no previous play', () => {
    // `last=99` is not in [0,1,2], so every index gets weight 1.0. With
    // three equal-weight entries each should land roughly 1/3 of the time.
    const rng = new Rng(99);
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) {
      counts[pickWeightedVariant(rng, [0, 1, 2], 99)]++;
    }
    // Each bucket gets ~1000 draws; allow a generous ±15% band so the test
    // is stable across Rng implementation changes.
    for (const c of counts) {
      expect(c).toBeGreaterThan(3000 * 0.28);
      expect(c).toBeLessThan(3000 * 0.39);
    }
  });

  it('is deterministic for a given Rng seed and history', () => {
    const run = (seed: number): number[] => {
      const rng = new Rng(seed);
      const out: number[] = [];
      let last: number | undefined;
      for (let i = 0; i < 50; i++) {
        const p = pickWeightedVariant(rng, [0, 1, 2, 3], last);
        out.push(p);
        last = p;
      }
      return out;
    };
    expect(run(1234)).toEqual(run(1234));
  });
});
