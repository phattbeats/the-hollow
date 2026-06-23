import { describe, it, expect } from 'vitest';
import { RUN_SPEED } from '../src/sim/types';
import {
  targetIntensity,
  stepIntensity,
  speedStreaks,
  vignetteAlpha,
  FX_SPEED_FLOOR,
  FX_SPEED_FULL,
} from '../src/render/travel_speed_fx';

describe('travel speed fx (pure core)', () => {
  it('shows nothing when not in travel form, even at top speed', () => {
    expect(targetIntensity({ inTravelForm: false, speed: FX_SPEED_FULL, reducedMotion: false })).toBe(0);
  });

  it('shows nothing while in form but standing still or walking below the floor', () => {
    expect(targetIntensity({ inTravelForm: true, speed: 0, reducedMotion: false })).toBe(0);
    expect(targetIntensity({ inTravelForm: true, speed: FX_SPEED_FLOOR, reducedMotion: false })).toBe(0);
    expect(targetIntensity({ inTravelForm: true, speed: RUN_SPEED, reducedMotion: false })).toBe(0);
  });

  it('ramps up as travel-form speed approaches the +40% top speed', () => {
    const mid = targetIntensity({ inTravelForm: true, speed: (FX_SPEED_FLOOR + FX_SPEED_FULL) / 2, reducedMotion: false });
    const full = targetIntensity({ inTravelForm: true, speed: FX_SPEED_FULL, reducedMotion: false });
    expect(mid).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(mid);
    expect(full).toBeCloseTo(1, 5);
  });

  it('clamps above the top speed and never exceeds 1', () => {
    expect(targetIntensity({ inTravelForm: true, speed: FX_SPEED_FULL * 2, reducedMotion: false })).toBeCloseTo(1, 5);
  });

  it('is fully suppressed under prefers-reduced-motion', () => {
    expect(targetIntensity({ inTravelForm: true, speed: FX_SPEED_FULL, reducedMotion: true })).toBe(0);
  });

  it('eases intensity toward the target and is frame-rate independent in direction', () => {
    let v = 0;
    for (let i = 0; i < 240; i++) v = stepIntensity(v, 1, 1 / 60);
    expect(v).toBeGreaterThan(0.95);
    // a single tiny step moves toward, never past, the target.
    const oneStep = stepIntensity(0, 1, 1 / 60);
    expect(oneStep).toBeGreaterThan(0);
    expect(oneStep).toBeLessThan(1);
    // decays back toward 0 when target drops.
    let down = 1;
    for (let i = 0; i < 240; i++) down = stepIntensity(down, 0, 1 / 60);
    expect(down).toBeLessThan(0.05);
  });

  it('produces no streaks at zero intensity and a populated, bounded field above it', () => {
    expect(speedStreaks(0, 0)).toHaveLength(0);
    const streaks = speedStreaks(0.8, 1.25, 28);
    expect(streaks).toHaveLength(28);
    for (const s of streaks) {
      expect(s.outer).toBeGreaterThan(s.inner);
      expect(s.inner).toBeGreaterThanOrEqual(0);
      expect(s.outer).toBeLessThanOrEqual(1);
      expect(s.alpha).toBeGreaterThanOrEqual(0);
      expect(s.alpha).toBeLessThanOrEqual(1);
    }
  });

  it('streak layout is deterministic for the same inputs', () => {
    expect(speedStreaks(0.6, 2.0)).toEqual(speedStreaks(0.6, 2.0));
  });

  it('vignette scales with intensity', () => {
    expect(vignetteAlpha(0)).toBe(0);
    expect(vignetteAlpha(1)).toBeGreaterThan(vignetteAlpha(0.5));
  });
});
