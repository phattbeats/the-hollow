import { describe, expect, it } from 'vitest';
import { shouldClearAutorunOnDeath } from '../src/game/death_input_reset';

describe('shouldClearAutorunOnDeath', () => {
  it('fires only on the frame the player transitions alive -> dead', () => {
    expect(shouldClearAutorunOnDeath(false, true)).toBe(true);
  });

  it('does not fire while already dead (no repeated resets every frame)', () => {
    expect(shouldClearAutorunOnDeath(true, true)).toBe(false);
  });

  it('does not fire while alive', () => {
    expect(shouldClearAutorunOnDeath(false, false)).toBe(false);
  });

  it('does not fire on the release frame (dead -> alive, e.g. a revive)', () => {
    expect(shouldClearAutorunOnDeath(true, false)).toBe(false);
  });
});
