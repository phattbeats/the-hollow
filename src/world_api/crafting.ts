// ---------------------------------------------------------------------------
// Crafting (PHAA-574, professions-depth batch): the crafting command surface.
// Recipe content (src/sim/content/recipes.ts, exported as RECIPES from
// src/sim/data) is static and read directly by both the offline Sim and the
// online ClientWorld, the same convention as GATHER_NODES; no IWorld method
// is needed for recipe browsing, only the craft action and the local
// viewer's own proficiency read.
// ---------------------------------------------------------------------------

import type { CraftType } from '../sim/types';

export interface IWorldCrafting {
  /** Craft a recipe (server re-checks materials). */
  craftItem(recipeId: string): void;
  /** The local viewer's own per-craft proficiency. */
  craftProficiency: Record<CraftType, number>;
}
