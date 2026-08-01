// Crafting recipes (PHAA-574, professions-depth batch: upstream #1127/#1197).
// Common-tier only, one recipe per craft: framework + reskin. Data-as-code,
// exempt from module-first size rules per root CLAUDE.md.
//
// Reagents reuse the existing gathered-material items already granted by
// src/sim/gathering.ts's node harvest (bone_fragments, linen_scrap,
// spider_leg). Outputs reuse existing low-tier BASE_ITEMS entries
// (src/sim/content/items.ts) rather than introducing new item ids, matching
// upstream's own choice for this issue: it avoids expanding the item-name
// i18n surface for a first framework slice. Deeper crafting (skill-tier
// gating, the craft wheel, archetype-exclusive combos, bespoke Hollow-themed
// output items) is later batch work; see PHAA-574's follow-up children.

import type { RecipeDef } from '../types';

// `level` (PHAA-712): every reagent here is a The Hollow Reaches node drop
// (gathering.ts's NODE_HARVEST_TABLE), and that zone's levelRange is [1, 4]
// (content/hollow_zone.ts) -- so this whole common-tier batch sits at the
// zone's floor, level 1. A later crafting-depth batch introducing
// higher-tier reagents/recipes sets its own `level` accordingly.
export const RECIPES: RecipeDef[] = [
  {
    id: 'recipe_rusty_dagger',
    craft: 'weaponcrafting',
    reagents: [
      { itemId: 'bone_fragments', count: 2 },
      { itemId: 'linen_scrap', count: 1 },
    ],
    resultItemId: 'rusty_dagger',
    resultCount: 1,
    level: 1,
  },
  {
    id: 'recipe_recruit_tunic',
    craft: 'armorcrafting',
    reagents: [{ itemId: 'bone_fragments', count: 3 }],
    resultItemId: 'recruit_tunic',
    resultCount: 1,
    level: 1,
  },
  {
    id: 'recipe_apprentice_robe',
    craft: 'tailoring',
    reagents: [{ itemId: 'linen_scrap', count: 3 }],
    resultItemId: 'apprentice_robe',
    resultCount: 1,
    level: 1,
  },
  {
    id: 'recipe_footpad_jerkin',
    craft: 'leatherworking',
    reagents: [
      { itemId: 'spider_leg', count: 2 },
      { itemId: 'bone_fragments', count: 1 },
    ],
    resultItemId: 'footpad_jerkin',
    resultCount: 1,
    level: 1,
  },
  {
    id: 'recipe_tough_jerky',
    craft: 'cooking',
    reagents: [{ itemId: 'spider_leg', count: 1 }],
    resultItemId: 'tough_jerky',
    resultCount: 1,
    level: 1,
  },
  {
    id: 'recipe_minor_healing_potion',
    craft: 'alchemy',
    reagents: [
      { itemId: 'linen_scrap', count: 1 },
      { itemId: 'spider_leg', count: 1 },
    ],
    resultItemId: 'minor_healing_potion',
    resultCount: 1,
    level: 1,
  },
  // Enchanting scrolls (PHAA-649 child, upstream #1712): each scroll is
  // crafted from disenchant's own salvage output (enchanting_dust), so the
  // profession is a closed loop through the existing crafting pipeline with
  // no new "how do I make it" logic; see src/sim/enchanting.ts for the
  // disenchant/apply-enchant actions and content/enchants.ts for what each
  // scroll's EnchantDef does when applied.
  {
    id: 'recipe_scroll_minor_might',
    craft: 'enchanting',
    reagents: [{ itemId: 'enchanting_dust', count: 2 }],
    resultItemId: 'scroll_minor_might',
    resultCount: 1,
  },
  {
    id: 'recipe_scroll_minor_vigor',
    craft: 'enchanting',
    reagents: [{ itemId: 'enchanting_dust', count: 2 }],
    resultItemId: 'scroll_minor_vigor',
    resultCount: 1,
  },
  {
    id: 'recipe_scroll_minor_focus',
    craft: 'enchanting',
    reagents: [{ itemId: 'enchanting_dust', count: 2 }],
    resultItemId: 'scroll_minor_focus',
    resultCount: 1,
  },
  {
    id: 'recipe_scroll_minor_agility',
    craft: 'enchanting',
    reagents: [{ itemId: 'enchanting_dust', count: 2 }],
    resultItemId: 'scroll_minor_agility',
    resultCount: 1,
  },
];
