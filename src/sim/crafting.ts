// Crafting (PHAA-574, professions-depth batch: upstream #1127/#1197). Turns a
// recipe (src/sim/content/recipes.ts) plus the reagents it needs into the
// output item: the crafting-depth counterpart to src/sim/gathering.ts's node
// harvest (which supplies the reagents in the first place). Common-tier only
// this slice: every recipe is craftable by any player who has the materials,
// no per-recipe skill/known gate. Higher-tier gating, the craft wheel, and
// archetype-exclusive combos are later batch work.
//
// Follows the same SimContext free-function pattern as gathering.ts's
// harvestNode: no class instance needed, since the one rng draw (the output
// quality roll) happens inline via ctx.rng, with no reach-back required.
//
// `src/sim`-pure: no DOM/Three/render/ui/game/net imports, no Math.random/
// Date.now (enforced by tests/architecture.test.ts). The one randomness draw
// (output quality) routes through ctx.rng, never bare Math.random.

import { RECIPES } from './data';
import { type MaterialRarity, rollMaterialRarity } from './gathering';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import type { CraftType, RecipeDef } from './types';

export const CRAFT_TYPES: readonly CraftType[] = [
  'weaponcrafting',
  'armorcrafting',
  'tailoring',
  'leatherworking',
  'cooking',
  'alchemy',
  // Enchanting (PHAA-649 child, upstream #1712): see src/sim/enchanting.ts.
  'enchanting',
];

/** A fresh, all-zero craft proficiency record: one counter per craft type. */
export function emptyCraftProficiency(): Record<CraftType, number> {
  const out = {} as Record<CraftType, number>;
  for (const type of CRAFT_TYPES) out[type] = 0;
  return out;
}

export function recipeById(recipeId: string): RecipeDef | undefined {
  return RECIPES.find((r) => r.id === recipeId);
}

/** Whether the given player currently holds every reagent a recipe requires,
 *  in the required quantities. Read-only: never mutates inventory. */
export function hasRecipeMaterials(ctx: SimContext, recipe: RecipeDef, pid: number): boolean {
  return recipe.reagents.every((r) => ctx.countItem(r.itemId, pid) >= r.count);
}

export interface CraftResolution {
  granted: boolean;
  itemId?: string;
  count?: number;
  quality?: MaterialRarity;
}

/**
 * Resolves one player's craft attempt against one recipe: denies (no side
 * effect at all) if any reagent is short, so partial consumption never
 * happens. On success, consumes every reagent, rolls the output's quality off
 * the player's current proficiency in the recipe's craft (the same
 * rollMaterialRarity ladder gathering.ts uses, keyed on craft proficiency
 * instead of gathering proficiency), increments that proficiency, and grants
 * the output item (the caller's ctx.addItem already emits the player-facing
 * "You receive" notice, so no separate success text is needed here).
 */
export function resolveCraft(
  ctx: SimContext,
  meta: PlayerMeta,
  recipe: RecipeDef,
  pid: number,
): CraftResolution {
  if (!hasRecipeMaterials(ctx, recipe, pid)) return { granted: false };
  for (const reagent of recipe.reagents) {
    ctx.removeItem(reagent.itemId, reagent.count, pid);
  }
  const quality = rollMaterialRarity(meta.craftProficiency[recipe.craft], ctx.rng);
  meta.craftProficiency[recipe.craft] += 1;
  ctx.addItem(recipe.resultItemId, recipe.resultCount, pid);
  return { granted: true, itemId: recipe.resultItemId, count: recipe.resultCount, quality };
}

// Command entry point (behind the SimContext seam): resolves one player's
// craft attempt against a recipe id. Runs on the deterministic tick the wire
// command arrives on, never off-tick, same as harvestNode in gathering.ts.
export function craftItem(ctx: SimContext, recipeId: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  const recipe = recipeById(recipeId);
  if (!recipe) {
    ctx.error(meta.entityId, 'That recipe is unknown.');
    return;
  }
  if (!hasRecipeMaterials(ctx, recipe, meta.entityId)) {
    ctx.error(meta.entityId, "You don't have the materials for that.");
    return;
  }
  resolveCraft(ctx, meta, recipe, meta.entityId);
}
