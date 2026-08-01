// ---------------------------------------------------------------------------
// Enchanting (PHAA-649 child, upstream #1712): the enchanting command surface.
// Enchant content (src/sim/content/enchants.ts, exported as ENCHANTS from
// src/sim/data) is static and read directly by both the offline Sim and the
// online ClientWorld, the same convention as RECIPES/GATHER_NODES; no IWorld
// method is needed for enchant browsing, only the two actions and the local
// viewer's own active-enchants read.
// ---------------------------------------------------------------------------

import type { EquipSlot } from '../sim/types';

export interface IWorldEnchanting {
  /** Disenchant one owned, non-quest item into enchanting dust (server re-checks). */
  disenchantItem(itemId: string): void;
  /** Apply an enchant to its target equip slot, spending its scroll (server re-checks). */
  applyEnchant(enchantId: string): void;
  /** The local viewer's own active per-equip-slot enchants. */
  enchants: Partial<Record<EquipSlot, string>>;
}
