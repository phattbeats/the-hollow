// Enchanting (PHAA-649 child of PHAA-639 v0.24.0 sequencing: upstream #1712).
// Turns a disenchanted item into dust, and a crafted scroll (any
// CraftType:'enchanting' recipe output, src/sim/content/recipes.ts) into a
// permanent flat stat bonus on one of the player's equip slots: the
// crafting-depth counterpart to src/sim/crafting.ts's craft action, and the
// combat-stat application half of upstream #1712 (no separate aura/VFX layer
// this slice; see src/sim/entity.ts recalcPlayerStats for the fold).
//
// Reskin note: upstream's Enchanting profession enchants a specific ITEM
// instance. The Hollow has no per-item-instance system (equipment/inventory
// are flat itemId+count), so this slice enchants the EQUIP SLOT instead: the
// bonus applies whenever that slot is occupied, and is replaced (never
// stacked or refunded) by re-enchanting the same slot. See PHAA-649/PHAA-817
// for the scoping discussion.
//
// Follows the same SimContext free-function pattern as crafting.ts: no class
// instance needed, the one rng draw (the disenchant quality roll) happens
// inline via ctx.rng.
//
// `src/sim`-pure: no DOM/Three/render/ui/game/net imports, no Math.random/
// Date.now (enforced by tests/architecture.test.ts). The one randomness draw
// (disenchant quality) routes through ctx.rng, never bare Math.random.

import { ENCHANTS, ITEMS } from './data';
import { recalcPlayerStats } from './entity';
import { type MaterialRarity, rollMaterialRarity } from './gathering';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import type { EnchantDef } from './types';

export function enchantById(enchantId: string): EnchantDef | undefined {
  return ENCHANTS.find((e) => e.id === enchantId);
}

// Salvage output: fixed item/count, matching resolveCraft's own "the quality
// roll is informational this slice" convention (higher enchanting
// proficiency does not yet change the granted amount; later batch work, same
// as crafting.ts's parallel note).
export const DISENCHANT_DUST_ITEM_ID = 'enchanting_dust';
const DISENCHANT_DUST_COUNT = 1;

export interface DisenchantResolution {
  granted: boolean;
  itemId?: string;
  count?: number;
  quality?: MaterialRarity;
}

/**
 * Resolves one player's disenchant attempt against one owned, non-quest item:
 * denies (no side effect at all) if the player doesn't hold a copy, so a
 * denial never consumes anything. On success, consumes exactly one copy,
 * rolls dust quality off the player's enchanting proficiency (the same
 * rollMaterialRarity ladder crafting.ts/gathering.ts use, keyed on the
 * 'enchanting' craft type), increments that proficiency, and grants the dust.
 */
export function resolveDisenchant(
  ctx: SimContext,
  meta: PlayerMeta,
  itemId: string,
  pid: number,
): DisenchantResolution {
  if (ctx.countItem(itemId, pid) < 1) return { granted: false };
  ctx.removeItem(itemId, 1, pid);
  const quality = rollMaterialRarity(meta.craftProficiency.enchanting, ctx.rng);
  meta.craftProficiency.enchanting += 1;
  ctx.addItem(DISENCHANT_DUST_ITEM_ID, DISENCHANT_DUST_COUNT, pid);
  return {
    granted: true,
    itemId: DISENCHANT_DUST_ITEM_ID,
    count: DISENCHANT_DUST_COUNT,
    quality,
  };
}

// Command entry point (behind the SimContext seam): disenchants one copy of
// an owned, non-quest item the requesting player holds. Runs on the
// deterministic tick the wire command arrives on, never off-tick, same as
// craftItem in crafting.ts.
export function disenchantItem(ctx: SimContext, itemId: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  const item = ITEMS[itemId];
  if (!item || item.kind === 'quest') {
    ctx.error(meta.entityId, 'That cannot be disenchanted.');
    return;
  }
  if (ctx.countItem(itemId, meta.entityId) < 1) {
    ctx.error(meta.entityId, "You don't have that item.");
    return;
  }
  resolveDisenchant(ctx, meta, itemId, meta.entityId);
}

export interface ApplyEnchantResolution {
  granted: boolean;
  enchant?: EnchantDef;
}

/**
 * Resolves one player's apply-enchant attempt: denies (no side effect) if the
 * player doesn't hold the enchant's scroll, so a denial never consumes
 * anything. On success, consumes the scroll, sets (replacing any enchant
 * already on that slot; no stacking, no refund of the old one) the enchant on
 * its target slot, and increments enchanting proficiency. The caller is
 * responsible for triggering a stat recompute (recalcPlayerStats), matching
 * the equip/unequip convention in items.ts.
 */
export function resolveApplyEnchant(
  ctx: SimContext,
  meta: PlayerMeta,
  enchant: EnchantDef,
  pid: number,
): ApplyEnchantResolution {
  if (ctx.countItem(enchant.scrollItemId, pid) < 1) return { granted: false };
  ctx.removeItem(enchant.scrollItemId, 1, pid);
  meta.enchants[enchant.slot] = enchant.id;
  meta.craftProficiency.enchanting += 1;
  return { granted: true, enchant };
}

// Command entry point (behind the SimContext seam): applies an enchant to
// its target equip slot, spending the requesting player's scroll for it.
export function applyEnchant(ctx: SimContext, enchantId: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  const enchant = enchantById(enchantId);
  if (!enchant) {
    ctx.error(meta.entityId, 'That enchant is unknown.');
    return;
  }
  if (ctx.countItem(enchant.scrollItemId, meta.entityId) < 1) {
    ctx.error(meta.entityId, "You don't have that scroll.");
    return;
  }
  const result = resolveApplyEnchant(ctx, meta, enchant, meta.entityId);
  if (result.granted) {
    recalcPlayerStats(p, meta.cls, meta.equipment, ctx.playerMods(meta), meta.enchants);
  }
}
