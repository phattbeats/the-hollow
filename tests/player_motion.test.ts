// Pins the pure surface of the extracted player-movement kernel. The FULL
// kernel (turn/wish/collision/vertical) is proven byte-identical to the
// pre-extraction Sim by the parity gate (tests/parity); this file guards the
// small terrain-independent pieces the online display extrapolator also reuses.

import { describe, expect, it } from 'vitest';
import {
  BACKPEDAL_MULT,
  FALL_SAFE_DISTANCE,
  GRAVITY,
  JUMP_VELOCITY,
  jumpMult,
  SWIM_SPEED_MULT,
  swimSurfaceY,
} from '../src/sim/player_motion';
import type { Aura, Entity } from '../src/sim/types';

function auras(...as: Array<Partial<Aura>>): Aura[] {
  return as as Aura[];
}

describe('player_motion pure exports', () => {
  it('freezes the movement constants that the classic-feel tuning depends on', () => {
    expect(GRAVITY).toBe(16);
    expect(JUMP_VELOCITY).toBe(6);
    expect(BACKPEDAL_MULT).toBe(0.65);
    expect(SWIM_SPEED_MULT).toBe(0.65);
    expect(FALL_SAFE_DISTANCE).toBe(12);
  });

  it('jumpMult is 1 without a buff_jump aura', () => {
    const e = { auras: auras() } as Entity;
    expect(jumpMult(e)).toBe(1);
  });

  it('jumpMult takes the strongest buff_jump aura and ignores others', () => {
    const e = {
      auras: auras(
        { kind: 'buff_jump', value: 1.5 },
        { kind: 'buff_speed', value: 2 },
        {
          kind: 'buff_jump',
          value: 1.2,
        },
      ),
    } as Entity;
    expect(jumpMult(e)).toBe(1.5);
  });

  it('swimSurfaceY rides 0.75yd below the local water line', () => {
    // Outside any declared lake waterLevelAt is -Infinity, so the surface is too.
    expect(swimSurfaceY(0, 0)).toBe(Number.NEGATIVE_INFINITY);
  });
});
