import { describe, expect, it } from 'vitest';
import { type AnimState, desiredBaseState } from '../src/render/characters/anim_state';

const baseAnim: AnimState = {
  speed: 0,
  moving: false,
  airborne: false,
  backwards: false,
  dead: false,
  casting: false,
  swimming: false,
  sitting: false,
};

describe('characters/anim_state desiredBaseState', () => {
  it('returns idle when nothing else is set', () => {
    expect(desiredBaseState(baseAnim, false)).toBe('idle');
  });

  it('returns idle (not swim) when stationary in water (PHAA-473)', () => {
    const stationary = { ...baseAnim, swimming: true };
    expect(desiredBaseState(stationary, false)).toBe('idle');
  });

  it('returns swim when both swimming and moving', () => {
    const moving = { ...baseAnim, swimming: true, moving: true, speed: 3 };
    expect(desiredBaseState(moving, false)).toBe('swim');
  });

  it('returns jump when airborne in water while stationary', () => {
    const airborneInWater = { ...baseAnim, swimming: true, airborne: true };
    expect(desiredBaseState(airborneInWater, false)).toBe('jump');
  });

  it('still picks swim when both swimming and moving and airborne is also set', () => {
    // swim is checked before jump (consistent with the existing precedence).
    const all = { ...baseAnim, swimming: true, moving: true, airborne: true, speed: 3 };
    expect(desiredBaseState(all, false)).toBe('swim');
  });

  it('does not regress: airborne beats stationary-in-water', () => {
    // airborne checked after swim + moving; in this combination airborne wins.
    const airborneInWater = { ...baseAnim, swimming: true, airborne: true };
    expect(desiredBaseState(airborneInWater, false)).toBe('jump');
  });

  it('returns walkBack when backwards with a walkBack clip while moving', () => {
    const back = { ...baseAnim, moving: true, backwards: true, speed: 2 };
    expect(desiredBaseState(back, true)).toBe('walkBack');
    // Without a walkBack clip the reversed forward locomotion path takes over.
    expect(desiredBaseState(back, false)).toBe('walk');
  });

  it('returns run when speed crosses the run threshold while moving on land', () => {
    const run = { ...baseAnim, moving: true, speed: 5 };
    expect(desiredBaseState(run, false)).toBe('run');
  });
});
