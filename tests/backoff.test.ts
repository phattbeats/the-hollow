import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeBackoffDelay } from '../src/net/backoff';

describe('computeBackoffDelay (full-jitter reconnect backoff)', () => {
  const BASE = 1_000;
  const MAX = 15_000;

  it('stays within [0.5x, 1.5x] of the deterministic exponential step', () => {
    for (let attempt = 1; attempt <= 6; attempt++) {
      const step = Math.min(MAX, BASE * 2 ** (attempt - 1));
      for (let i = 0; i < 200; i++) {
        const delay = computeBackoffDelay(attempt, BASE, MAX);
        expect(delay).toBeGreaterThanOrEqual(Math.round(step * 0.5));
        expect(delay).toBeLessThanOrEqual(Math.min(MAX, Math.round(step * 1.5)));
      }
    }
  });

  it('never exceeds maxDelayMs even once the step itself would', () => {
    for (let i = 0; i < 200; i++) {
      const delay = computeBackoffDelay(40, BASE, MAX);
      expect(delay).toBeLessThanOrEqual(MAX);
    }
  });

  describe('with Math.random pinned', () => {
    beforeEach(() => vi.spyOn(Math, 'random'));
    afterEach(() => vi.restoreAllMocks());

    it('draws the low end of the band at random()=0', () => {
      vi.mocked(Math.random).mockReturnValue(0);
      // attempt 1: step = 1000ms, band low = 500ms
      expect(computeBackoffDelay(1, BASE, MAX)).toBe(500);
    });

    it('draws the high end of the band as random()->1', () => {
      vi.mocked(Math.random).mockReturnValue(0.999999);
      // attempt 3: step = 4000ms, band high approaches 6000ms
      expect(computeBackoffDelay(3, BASE, MAX)).toBe(6000);
    });

    it('two consecutive calls at the same attempt are not forced identical (spread, not lockstep)', () => {
      vi.mocked(Math.random).mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
      const a = computeBackoffDelay(2, BASE, MAX);
      const b = computeBackoffDelay(2, BASE, MAX);
      expect(a).not.toBe(b);
    });
  });
});
