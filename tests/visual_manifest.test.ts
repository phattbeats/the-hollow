import { describe, expect, it } from 'vitest';
import { VISUALS } from '../src/render/characters/manifest';

describe('character visual manifest', () => {
  it('plays the custom boar death animation quickly enough to read as an instant death', () => {
    expect(VISUALS.mob_boar.clips.death).toBe('Dying');
    expect(VISUALS.mob_boar.deathTimeScale).toBeGreaterThanOrEqual(3);
  });
});
