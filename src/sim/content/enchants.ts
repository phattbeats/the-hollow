// Enchanting (PHAA-649 child of PHAA-639 v0.24.0 sequencing: upstream #1712).
// Common-tier only this slice, mirroring PHAA-574's own recipes.ts scoping
// note: framework + reskin, one enchant per equipped slot family, no
// skill-tier gating. Data-as-code, exempt from module-first size rules per
// root CLAUDE.md.
//
// Each enchant's scroll (`scrollItemId`) is itself just a normal crafted item:
// see src/sim/content/recipes.ts for the CraftType:'enchanting' RecipeDef that
// produces it, and src/sim/content/items.ts (BASE_ITEMS) for the dust reagent
// + scroll item records. Deeper enchanting (skill-tier gating, higher-tier
// enchants, disenchant-quality-scaled dust yield) is later batch work.

import type { EnchantDef } from '../types';

export const ENCHANTS: EnchantDef[] = [
  {
    id: 'enchant_minor_might',
    name: 'Minor Might',
    slot: 'mainhand',
    scrollItemId: 'scroll_minor_might',
    stats: { str: 3 },
  },
  {
    id: 'enchant_minor_vigor',
    name: 'Minor Vigor',
    slot: 'chest',
    scrollItemId: 'scroll_minor_vigor',
    stats: { sta: 4 },
  },
  {
    id: 'enchant_minor_focus',
    name: 'Minor Focus',
    slot: 'helmet',
    scrollItemId: 'scroll_minor_focus',
    stats: { int: 3 },
  },
  {
    id: 'enchant_minor_agility',
    name: 'Minor Agility',
    slot: 'legs',
    scrollItemId: 'scroll_minor_agility',
    stats: { agi: 3 },
  },
];
