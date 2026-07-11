// Gathering tool tier gating (PHAA-507, upstream #1191).

import { describe, expect, it } from 'vitest';
import { ITEMS, NPCS } from '../src/sim/data';
import {
  canGatherTier,
  canHarvestMonsterMaterial,
  gatherToolTier,
  isGatherToolUse,
} from '../src/sim/gathering_tools';
import { Sim } from '../src/sim/sim';
import type { ItemDef } from '../src/sim/types';

const AMBER_TOOLS = ['flint_amber_pick', 'bonewood_amber_pick', 'starleaf_amber_pick'] as const;
const BARK_TOOLS = ['flint_bark_axe', 'bonewood_bark_axe', 'starleaf_bark_axe'] as const;
const SPORE_TOOLS = [
  'flint_spore_sickle',
  'bonewood_spore_sickle',
  'starleaf_spore_sickle',
] as const;

describe('canGatherTier / canHarvestMonsterMaterial', () => {
  it('a tier-1 tool cannot gather a tier-2 or higher target', () => {
    expect(canGatherTier(1, 1)).toBe(true);
    expect(canGatherTier(1, 2)).toBe(false);
    expect(canGatherTier(1, 3)).toBe(false);
  });

  it('a tier-2 tool can gather both tier-1 and tier-2, but not tier-3', () => {
    expect(canGatherTier(2, 1)).toBe(true);
    expect(canGatherTier(2, 2)).toBe(true);
    expect(canGatherTier(2, 3)).toBe(false);
  });

  it('a tier-3 tool can gather every tier at or below it', () => {
    expect(canGatherTier(3, 1)).toBe(true);
    expect(canGatherTier(3, 2)).toBe(true);
    expect(canGatherTier(3, 3)).toBe(true);
  });

  it('canHarvestMonsterMaterial follows the same at-or-below-tier semantics as canGatherTier', () => {
    for (let toolTier = 1; toolTier <= 3; toolTier++) {
      for (let materialTier = 1; materialTier <= 3; materialTier++) {
        expect(canHarvestMonsterMaterial(toolTier, materialTier)).toBe(
          canGatherTier(toolTier, materialTier),
        );
      }
    }
  });
});

describe('crafted gathering tools (PHAA-507)', () => {
  it('a tool exists for each gather node type at 3 tiers', () => {
    for (const [nodeType, tools] of [
      ['amber', AMBER_TOOLS],
      ['heartwood', BARK_TOOLS],
      ['spore', SPORE_TOOLS],
    ] as const) {
      const items = tools.map((id) => ITEMS[id]);
      expect(items.every(Boolean)).toBe(true);
      const tiers = items.map((item) => gatherToolTier(item, nodeType));
      expect(tiers).toEqual([1, 2, 3]);
    }
  });

  it('crafted tools are never vendor-sold: no buyValue, absent from every NPC vendorItems list', () => {
    const craftedIds = new Set<string>([...AMBER_TOOLS, ...BARK_TOOLS, ...SPORE_TOOLS]);
    for (const id of craftedIds) {
      expect(ITEMS[id].buyValue).toBeUndefined();
    }
    for (const npc of Object.values(NPCS)) {
      for (const stockedId of npc.vendorItems ?? []) {
        expect(craftedIds.has(stockedId)).toBe(false);
      }
    }
  });

  it('a base tool never becomes unusable, because this repo has no durability mechanic', () => {
    const pick = ITEMS.flint_amber_pick;
    expect(isGatherToolUse(pick.use)).toBe(true);
    expect(pick).not.toHaveProperty('durability');
    expect(gatherToolTier(pick, 'amber')).toBe(1);
  });

  it('gatherToolTier returns undefined for a non-tool item, a mismatched node type, and a differently-used tool', () => {
    expect(gatherToolTier(ITEMS.worn_sword, 'amber')).toBeUndefined();
    expect(gatherToolTier(ITEMS.flint_amber_pick, 'heartwood')).toBeUndefined();
    // simple_fishing_pole has kind: 'tool' and a use, but not a gatherTool use,
    // exercising the !isGatherToolUse(item.use) branch specifically.
    expect(isGatherToolUse(ITEMS.simple_fishing_pole.use)).toBe(false);
    expect(gatherToolTier(ITEMS.simple_fishing_pole, 'amber')).toBeUndefined();
  });

  it('rarity (quality) is separate from tier and never affects gating', () => {
    const commonTierThree: ItemDef = {
      id: 'test_common_tier3_pick',
      name: 'Test Common Tier-3 Pick',
      kind: 'tool',
      quality: 'common',
      use: { type: 'gatherTool', nodeType: 'amber', tier: 3 },
      sellValue: 1,
    };
    const rareTierThree: ItemDef = {
      id: 'test_rare_tier3_pick',
      name: 'Test Rare Tier-3 Pick',
      kind: 'tool',
      quality: 'rare',
      use: { type: 'gatherTool', nodeType: 'amber', tier: 3 },
      sellValue: 1,
    };
    expect(commonTierThree.quality).not.toBe(rareTierThree.quality);
    expect(gatherToolTier(commonTierThree, 'amber')).toBe(3);
    expect(gatherToolTier(rareTierThree, 'amber')).toBe(3);
    // The real items also carry different rarities across tiers, so the
    // tier-only gating check above is meaningful, not vacuously true.
    expect(ITEMS.flint_amber_pick.quality).toBe('common');
    expect(ITEMS.starleaf_amber_pick.quality).toBe('rare');
  });

  it('using a gathering tool is a safe no-op (live gating wiring is a follow-up)', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    const pid = sim.addPlayer('warrior', 'Aleph');
    sim.tick();

    sim.addItem('flint_amber_pick', 1, pid);
    expect(() => sim.useItem('flint_amber_pick', pid)).not.toThrow();
    expect(sim.countItem('flint_amber_pick', pid)).toBe(1);
  });
});
