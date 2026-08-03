// Pure crafting/enchanting window core (PHAA-818, adapts upstream #1708). Same
// pattern as gathering_view.test.ts: hand-built IWorld-shaped stubs, plus one
// pass against a real Sim to prove it never drifts from the sim's own gates
// (hasRecipeMaterials / resolveApplyEnchant).

import { describe, expect, it } from 'vitest';
import { CRAFT_TYPES, emptyCraftProficiency } from '../src/sim/crafting';
import { Sim } from '../src/sim/sim';
import type { EquipSlot } from '../src/sim/types';
import { buildCraftingView } from '../src/ui/crafting_view';
import type { IWorld } from '../src/world_api';

function makeWorld(opts: {
  inventory?: { itemId: string; count: number }[];
  craftProficiency?: Partial<Record<string, number>>;
  enchants?: Partial<Record<EquipSlot, string>>;
}): IWorld {
  return {
    inventory: opts.inventory ?? [],
    craftProficiency: { ...emptyCraftProficiency(), ...(opts.craftProficiency ?? {}) },
    enchants: opts.enchants ?? {},
  } as unknown as IWorld;
}

describe('buildCraftingView proficiency', () => {
  it('returns one row per craft type, in the fixed CRAFT_TYPES order', () => {
    const world = makeWorld({ craftProficiency: { cooking: 4, enchanting: 1 } });
    const view = buildCraftingView(world);
    expect(view.proficiency.map((r) => r.craft)).toEqual([...CRAFT_TYPES]);
    expect(view.proficiency.find((r) => r.craft === 'cooking')?.value).toBe(4);
    expect(view.proficiency.find((r) => r.craft === 'enchanting')?.value).toBe(1);
    expect(view.proficiency.find((r) => r.craft === 'alchemy')?.value).toBe(0);
  });
});

describe('buildCraftingView recipes', () => {
  it('marks a recipe craftable only when every reagent is held in the required quantity', () => {
    const world = makeWorld({ inventory: [{ itemId: 'spider_leg', count: 1 }] });
    const view = buildCraftingView(world);
    const jerky = view.recipes.find((r) => r.recipe.id === 'recipe_tough_jerky')!;
    expect(jerky.craftable).toBe(true);
    const dagger = view.recipes.find((r) => r.recipe.id === 'recipe_rusty_dagger')!;
    expect(dagger.craftable).toBe(false); // needs bone_fragments x2 + linen_scrap x1, has neither
  });

  it('never marks craftable on a partial reagent match (multi-reagent recipe)', () => {
    const world = makeWorld({ inventory: [{ itemId: 'bone_fragments', count: 2 }] });
    const view = buildCraftingView(world);
    const dagger = view.recipes.find((r) => r.recipe.id === 'recipe_rusty_dagger')!;
    expect(dagger.craftable).toBe(false); // linen_scrap x1 still short
    expect(dagger.reagents.find((r) => r.itemId === 'bone_fragments')?.have).toBe(2);
    expect(dagger.reagents.find((r) => r.itemId === 'linen_scrap')?.have).toBe(0);
  });

  it('lists every recipe regardless of held materials (no known-recipe gate)', () => {
    const view = buildCraftingView(makeWorld({}));
    expect(view.recipes.length).toBeGreaterThan(0);
    expect(view.recipes.every((r) => r.craftable === false)).toBe(true);
  });
});

describe('buildCraftingView enchants', () => {
  it('flags haveScroll only when the scroll is held', () => {
    const world = makeWorld({ inventory: [{ itemId: 'scroll_minor_might', count: 1 }] });
    const view = buildCraftingView(world);
    const might = view.enchants.find((e) => e.enchant.id === 'enchant_minor_might')!;
    expect(might.haveScroll).toBe(true);
    const vigor = view.enchants.find((e) => e.enchant.id === 'enchant_minor_vigor')!;
    expect(vigor.haveScroll).toBe(false);
  });

  it('flags active only on the slot currently wearing that exact enchant', () => {
    const world = makeWorld({ enchants: { mainhand: 'enchant_minor_might' } });
    const view = buildCraftingView(world);
    const might = view.enchants.find((e) => e.enchant.id === 'enchant_minor_might')!;
    expect(might.active).toBe(true);
    const vigor = view.enchants.find((e) => e.enchant.id === 'enchant_minor_vigor')!;
    expect(vigor.active).toBe(false);
  });
});

describe('buildCraftingView disenchantable', () => {
  it('excludes quest items and zero-count slots', () => {
    const world = makeWorld({
      inventory: [
        { itemId: 'rusty_dagger', count: 2 },
        { itemId: 'boar_hide', count: 1 }, // quest item, never disenchantable
        { itemId: 'bone_fragments', count: 0 },
      ],
    });
    const view = buildCraftingView(world);
    expect(view.disenchantable.some((d) => d.itemId === 'rusty_dagger')).toBe(true);
    expect(view.disenchantable.some((d) => d.itemId === 'boar_hide')).toBe(false);
    expect(view.disenchantable.some((d) => d.itemId === 'bone_fragments')).toBe(false);
  });
});

describe('buildCraftingView against a real Sim (never drifts from the sim gate)', () => {
  it('craftable matches hasRecipeMaterials exactly after granting exact reagents', () => {
    const sim = new Sim({ seed: 3, playerClass: 'warrior', noPlayer: true });
    const pid = sim.addPlayer('warrior', 'Smith');
    sim.addItem('bone_fragments', 2, pid);
    sim.addItem('linen_scrap', 1, pid);
    const view = buildCraftingView(sim as unknown as IWorld);
    const dagger = view.recipes.find((r) => r.recipe.id === 'recipe_rusty_dagger')!;
    expect(dagger.craftable).toBe(true);
    sim.craftItem(dagger.recipe.id, pid);
    expect(sim.countItem('rusty_dagger', pid)).toBe(1);
    const after = buildCraftingView(sim as unknown as IWorld);
    expect(after.recipes.find((r) => r.recipe.id === 'recipe_rusty_dagger')?.craftable).toBe(false);
  });
});
