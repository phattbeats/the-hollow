// Pure gathering HUD core (PHAA-508, ports upstream #1194): the character-sheet
// gathering rows, i.e. the viewer's per-node-type harvest proficiency
// (IWorldGathering#gatheringProficiency) and the crafted-tool gating rows (best
// owned tool tier per node type, PHAA-507). DOM/Three-free, same-input ->
// same-output, driven with hand-built IWorld-shaped stubs (no real Sim needed).

import { describe, expect, it } from 'vitest';
import type { GatherNodeType } from '../src/sim/types';
import { buildGatheringProficiencyRows, buildGatheringToolRows } from '../src/ui/gathering_view';
import type { IWorld } from '../src/world_api';

function makeWorld(opts: {
  proficiency?: Partial<Record<GatherNodeType, number>>;
  inventory?: { itemId: string; count: number }[];
}): IWorld {
  return {
    gatheringProficiency: { amber: 0, heartwood: 0, spore: 0, ...(opts.proficiency ?? {}) },
    inventory: opts.inventory ?? [],
  } as unknown as IWorld;
}

describe('buildGatheringProficiencyRows', () => {
  it('returns one row per gather node type, in the fixed order', () => {
    const world = makeWorld({ proficiency: { amber: 3, heartwood: 0, spore: 7 } });
    const rows = buildGatheringProficiencyRows(world);
    expect(rows.map((r) => r.nodeType)).toEqual(['amber', 'heartwood', 'spore']);
  });

  it('matches the input values exactly', () => {
    const world = makeWorld({ proficiency: { amber: 12, heartwood: 4, spore: 0 } });
    const rows = buildGatheringProficiencyRows(world);
    expect(rows).toEqual([
      { nodeType: 'amber', value: 12 },
      { nodeType: 'heartwood', value: 4 },
      { nodeType: 'spore', value: 0 },
    ]);
  });

  it('defaults an absent or malformed entry to 0, never throwing', () => {
    const world = makeWorld({
      proficiency: { amber: Number.NaN, heartwood: -5 } as Partial<Record<GatherNodeType, number>>,
    });
    const rows = buildGatheringProficiencyRows(world);
    expect(rows.find((r) => r.nodeType === 'amber')?.value).toBe(0);
    expect(rows.find((r) => r.nodeType === 'heartwood')?.value).toBe(0);
    expect(rows.find((r) => r.nodeType === 'spore')?.value).toBe(0);
  });
});

describe('buildGatheringToolRows', () => {
  it('reports null for every node type when the viewer owns no gathering tool', () => {
    const rows = buildGatheringToolRows(makeWorld({ inventory: [] }));
    expect(rows).toEqual([
      { nodeType: 'amber', tier: null },
      { nodeType: 'heartwood', tier: null },
      { nodeType: 'spore', tier: null },
    ]);
  });

  it('reports the owned tool tier for the matching node type only', () => {
    // flint_amber_pick is a real tier-1 amber gather tool (src/sim/content/items.ts).
    const world = makeWorld({ inventory: [{ itemId: 'flint_amber_pick', count: 1 }] });
    const rows = buildGatheringToolRows(world);
    expect(rows.find((r) => r.nodeType === 'amber')?.tier).toBe(1);
    expect(rows.find((r) => r.nodeType === 'heartwood')?.tier).toBeNull();
    expect(rows.find((r) => r.nodeType === 'spore')?.tier).toBeNull();
  });

  it('keeps the highest owned tier when the viewer holds several tools for one type', () => {
    // bonewood_amber_pick is tier 2, flint_amber_pick tier 1: the best is surfaced.
    const world = makeWorld({
      inventory: [
        { itemId: 'flint_amber_pick', count: 1 },
        { itemId: 'bonewood_amber_pick', count: 1 },
      ],
    });
    expect(buildGatheringToolRows(world).find((r) => r.nodeType === 'amber')?.tier).toBe(2);
  });

  it('ignores non-tool inventory items (never throwing on unknown ids)', () => {
    const world = makeWorld({
      inventory: [
        { itemId: 'not_a_real_item', count: 1 },
        { itemId: 'flint_spore_sickle', count: 1 },
      ],
    });
    const rows = buildGatheringToolRows(world);
    expect(rows.find((r) => r.nodeType === 'spore')?.tier).toBe(1);
    expect(rows.find((r) => r.nodeType === 'amber')?.tier).toBeNull();
  });
});
