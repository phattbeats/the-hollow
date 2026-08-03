// Pure, host-agnostic view model for the crafting/enchanting window (PHAA-818,
// adapts upstream #1708 for the existing PHAA-574 craft action + the PHAA-649
// enchanting facet). Reference: vendor_view.ts / gathering_view.ts (the
// pure-core + thin-consumer split, root CLAUDE.md Conventions).
//
// Recipes carry no per-recipe known/skill gate (src/sim/crafting.ts): every
// recipe in RECIPES is always listed, and "craftable" just reflects whether
// the viewer currently holds every reagent in the required quantity, mirroring
// hasRecipeMaterials exactly (so the window can never show a row the sim
// would then deny). Enchants work the same way off ENCHANTS: "appliable"
// reflects owning the scroll (resolveApplyEnchant's own gate), and the
// "already active" flag reads the viewer's own per-slot enchants
// (IWorldEnchanting#enchants) so the window can mark the currently-worn
// enchant per slot without a second sim round-trip.
//
// DOM/Three/i18n-free so tests/crafting_view.test.ts can drive it directly
// against both a Sim- and a ClientWorld-shaped IWorld.

import { CRAFT_TYPES } from '../sim/crafting';
import { ENCHANTS, ITEMS, RECIPES } from '../sim/data';
import type { CraftType, EnchantDef, EquipSlot, ItemDef, RecipeDef } from '../sim/types';
import type { IWorld } from '../world_api';

export interface CraftingReagentRow {
  itemId: string;
  item: ItemDef;
  have: number;
  need: number;
}

export interface CraftingRecipeRow {
  recipe: RecipeDef;
  resultItem: ItemDef;
  reagents: CraftingReagentRow[];
  /** True only when every reagent is held in the required quantity. */
  craftable: boolean;
}

export interface CraftingEnchantRow {
  enchant: EnchantDef;
  scrollItem: ItemDef;
  /** True when the viewer currently holds at least one copy of the scroll. */
  haveScroll: boolean;
  /** True when this exact enchant is the one currently active on its slot. */
  active: boolean;
}

export interface CraftingDisenchantRow {
  itemId: string;
  item: ItemDef;
  count: number;
}

export interface CraftingView {
  /** Every craft-type proficiency counter, in the fixed CRAFT_TYPES order. */
  proficiency: { craft: CraftType; value: number }[];
  recipes: CraftingRecipeRow[];
  enchants: CraftingEnchantRow[];
  /** Owned, non-quest items eligible to disenchant (mirrors disenchantItem's own gate). */
  disenchantable: CraftingDisenchantRow[];
}

function countHeld(world: IWorld, itemId: string): number {
  let total = 0;
  for (const slot of world.inventory) if (slot.itemId === itemId) total += slot.count;
  return total;
}

/** Builds the crafting window's full view from raw IWorld reads. */
export function buildCraftingView(world: IWorld): CraftingView {
  const proficiency = CRAFT_TYPES.map((craft) => ({
    craft,
    value: world.craftProficiency?.[craft] ?? 0,
  }));

  const recipes: CraftingRecipeRow[] = [];
  for (const recipe of RECIPES) {
    const resultItem = ITEMS[recipe.resultItemId];
    if (!resultItem) continue;
    const reagents: CraftingReagentRow[] = [];
    let craftable = true;
    for (const reagent of recipe.reagents) {
      const item = ITEMS[reagent.itemId];
      if (!item) continue;
      const have = countHeld(world, reagent.itemId);
      if (have < reagent.count) craftable = false;
      reagents.push({ itemId: reagent.itemId, item, have, need: reagent.count });
    }
    recipes.push({ recipe, resultItem, reagents, craftable });
  }

  const activeEnchants: Partial<Record<EquipSlot, string>> = world.enchants ?? {};
  const enchants: CraftingEnchantRow[] = [];
  for (const enchant of ENCHANTS) {
    const scrollItem = ITEMS[enchant.scrollItemId];
    if (!scrollItem) continue;
    enchants.push({
      enchant,
      scrollItem,
      haveScroll: countHeld(world, enchant.scrollItemId) > 0,
      active: activeEnchants[enchant.slot] === enchant.id,
    });
  }

  const disenchantable: CraftingDisenchantRow[] = [];
  for (const slot of world.inventory) {
    if (slot.count <= 0) continue;
    const item = ITEMS[slot.itemId];
    if (!item || item.kind === 'quest') continue;
    disenchantable.push({ itemId: slot.itemId, item, count: slot.count });
  }

  return { proficiency, recipes, enchants, disenchantable };
}
