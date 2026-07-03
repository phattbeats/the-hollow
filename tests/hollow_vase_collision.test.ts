// PHAA-402 follow-up: the vase and its hearth (mantel-altar + flue) render as
// solid geometry (src/render/hollow_props.ts) but had no collider, so players
// walked straight through the sacred centerpiece. Confirms the fix blocks the
// hub only, and leaves the Drowned Temple (which shares `interior: 'temple'`
// but has no vase) untouched.
import { describe, expect, it } from 'vitest';
import { isBlocked, resolvePosition } from '../src/sim/colliders';
import { VASE_POS } from '../src/sim/content/hollow';
import { instanceOrigin } from '../src/sim/data';

const SEED = 42;
const HUB = instanceOrigin(6, 0); // the_hollow
const TEMPLE = instanceOrigin(3, 0); // drowned_temple, same `interior: 'temple'` shell

describe('the Hollow hub vase collision (PHAA-402)', () => {
  it('blocks a mover walking into the vase', () => {
    const x = HUB.x + VASE_POS.x;
    const z = HUB.z + VASE_POS.z;
    expect(isBlocked(SEED, x, z, 0.5)).toBe(true);
  });

  it('pushes a mover out to roughly the plinth radius', () => {
    const x = HUB.x + VASE_POS.x;
    const z = HUB.z + VASE_POS.z - 1; // approaching from the gate side
    const res = resolvePosition(SEED, x, z, 0.5);
    const dist = Math.hypot(res.x - HUB.x, res.z - HUB.z);
    expect(dist).toBeGreaterThan(1.6);
  });

  it('blocks the hearth cluster (mantel-altar + flue) behind the vase', () => {
    const x = HUB.x + VASE_POS.x;
    const z = HUB.z + VASE_POS.z + 1.9;
    expect(isBlocked(SEED, x, z, 0.5)).toBe(true);
  });

  it("does not block Greenpaw's spot, clear of the vase footprint", () => {
    expect(isBlocked(SEED, HUB.x + 3, HUB.z + 4, 0.5)).toBe(false);
  });

  it('leaves the Drowned Temple (same interior shell, no vase) unblocked at the equivalent spot', () => {
    const x = TEMPLE.x + VASE_POS.x;
    const z = TEMPLE.z + VASE_POS.z;
    expect(isBlocked(SEED, x, z, 0.5)).toBe(false);
  });
});
