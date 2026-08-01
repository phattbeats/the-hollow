import { describe, expect, it } from 'vitest';
import {
  isInJailBounds,
  isInJailCage,
  JAIL_CAGE_HALF,
  JAIL_CENTER,
  JAIL_OUTER_HALF,
  jailCageSpawn,
} from '../src/sim/content/jail';

describe('jail geometry', () => {
  it('places the hold clear of every other far-off instance band', () => {
    // Dungeons/arena/delves all anchor to positive x past a few hundred; a
    // large negative x guarantees none of those range checks ever fire here.
    expect(JAIL_CENTER.x).toBeLessThan(0);
    expect(JAIL_CENTER.z).toBeLessThan(0);
  });

  it('isInJailCage matches the cage half-extent, isInJailBounds the wider yard', () => {
    expect(isInJailCage(JAIL_CENTER)).toBe(true);
    expect(isInJailCage({ x: JAIL_CENTER.x + JAIL_CAGE_HALF, z: JAIL_CENTER.z })).toBe(true);
    expect(isInJailCage({ x: JAIL_CENTER.x + JAIL_CAGE_HALF + 1, z: JAIL_CENTER.z })).toBe(false);

    expect(isInJailBounds({ x: JAIL_CENTER.x + JAIL_OUTER_HALF, z: JAIL_CENTER.z })).toBe(true);
    expect(isInJailBounds({ x: JAIL_CENTER.x + JAIL_OUTER_HALF + 1, z: JAIL_CENTER.z })).toBe(
      false,
    );
    // The yard is always at least as large as the cage it encloses.
    expect(JAIL_OUTER_HALF).toBeGreaterThan(JAIL_CAGE_HALF);
  });

  it('jailCageSpawn is deterministic and stays inside the cage', () => {
    for (let slot = 0; slot < 20; slot++) {
      const spawn = jailCageSpawn(slot);
      expect(spawn).toEqual(jailCageSpawn(slot));
      expect(isInJailCage(spawn)).toBe(true);
    }
  });
});
