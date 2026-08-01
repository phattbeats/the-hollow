// Heroic-tier item variants for delve loot (upstream PR #1705/#1767, port to
// the fork). When a mob dies inside a HEROIC delve instance, the loot swap in
// src/sim/loot/loot_roll.ts exchanges any epic/rare equippable that would have
// dropped off the mob's base loot table for its "Heroic" copy: the same item
// identity one tier up, primary stats rescaled to the matching item-level
// budget, weapon damage on the hero DPS curve.
//
// These variants are real ItemDefs merged into ITEMS (data.ts), so the rest of
// the engine (tooltip, equip, itemScore, the server->client wire) handles them
// like any other item. The two forks from the base item are:
//   - the variant inherits the base name (classic behaviour: a Heroic drop reads
//     identically named); the Heroic distinction is shown via the [HEROIC] tag
//     on the tooltip's quality/kind line, composed from the `heroicOf` back-
//     reference by entity_i18n at the client boundary.
//   - the entity manifest skips variants because the variant id starts with
//     `heroic_`, so no per-variant translation key is needed.
//
// mob.loot entries that point at a no-slot/junk/quest item are skipped: only
// equippable armor/weapons with quality in {epic, rare} get a Heroic variant.
// Vendor jewelry, quest rewards, the item-level-31 delve-heroic set
// (HEROIC_BOSS_LOOT) and the Heroic Mark item are NEVER produced as a variant.
// The mark lives behind a derived id (`delve_heroic_mark`) that has no base,
// and the boss-loot table is appended at run time, so neither can appear in a
// mob's loot list for this filter to fire on them.
//
// `src/sim`-pure (deterministic over content tables): no rng, no clock, no DOM.

import {
  HEROIC_HIT_RATING_ARMOR,
  HEROIC_HIT_RATING_WEAPON,
  HEROIC_VARIANT_SOURCE_LEVEL,
  normalizePrimaryStats,
  PRIMARY_STATS,
  primaryStatBudget,
  QUALITY_ILVL_BONUS,
  scaleWeaponDamage,
  weaponDpsBudget,
} from '../item_budget';
import type { ItemDef, MobTemplate } from '../types';

// Stable, pure prefix: the variant's id is always `heroic_<baseId>`. Prefix
// collision with an existing base item id would surface at data-evaluation, and
// tests pin it via `tests/heroic_loot_wave_delves.test.ts`.
export function heroicVariantId(baseId: string): string {
  return `heroic_${baseId}`;
}

// True when an item id looks like a Heroic variant (the prefix above). Used by
// the loot swap to fast-skip already-built variants and by the entity manifest
// to filter them out. Cheap regex; keeps the swap O(n) over the base list.
export function isHeroicVariantId(id: string): boolean {
  return id.startsWith('heroic_');
}

function makeHeroicVariant(base: ItemDef): ItemDef {
  const quality = base.quality ?? 'common';
  // Per-quality level: a base epic lands at 25 + 6 = 31, a base rare lands at 25
  // + 3 = 28 (matching upstream's epic 28 / rare 25 reading), a base legendary
  // keeps its 35. The variant reads at least the higher of the target or the
  // base's realized stat budget so it is NEVER a downgrade vs its base.
  const targetLevel = HEROIC_VARIANT_SOURCE_LEVEL + (QUALITY_ILVL_BONUS[quality] ?? 0);
  const targetBudget = primaryStatBudget(targetLevel, base.quality, base.slot);
  const baseBudget = base.stats
    ? PRIMARY_STATS.reduce((sum, stat) => sum + (base.stats?.[stat] ?? 0), 0)
    : 0;
  // normalizePrimaryStats keeps the item's stat identity (its str/agi/int ratio)
  // and passes armor through untouched; only the primary-stat sum grows to the
  // larger of the heroic target budget and the base item's realized budget.
  const stats = base.stats
    ? normalizePrimaryStats(base.stats, Math.max(targetBudget, baseBudget))
    : base.stats;
  const variant: ItemDef = {
    ...base,
    id: heroicVariantId(base.id),
    // Same name as the base item; the [HEROIC] tag is composed at the tooltip
    // boundary by entity_i18n from the `heroicOf` field, never a name prefix.
    name: base.name,
    heroicOf: base.id,
    stats,
  };
  // A weapon variant rescales its damage to the heroic-tier DPS ladder for the
  // variant's own item level, keeping its swing speed and base spread. A base
  // weapon already above the curve retains its realized dps (never a downgrade).
  if (base.weapon) {
    const baseDps = (base.weapon.min + base.weapon.max) / 2 / base.weapon.speed;
    variant.weapon = {
      ...base.weapon,
      ...scaleWeaponDamage(base.weapon, Math.max(weaponDpsBudget(targetLevel), baseDps)),
    };
  }
  // Hit rating, off the primary-stat budget above: only an epic base reaches the
  // item-level-31 tier (a rare stays at 28, the lesser rung), so only epics carry
  // the rating. This is what makes ilvl 31 a qualitative step over 26/28, not just
  // +2 stats (PHAA-733 / upstream PR #1860's ilvl-31 allowance).
  if (quality === 'epic') {
    variant.hitRating = base.kind === 'weapon' ? HEROIC_HIT_RATING_WEAPON : HEROIC_HIT_RATING_ARMOR;
  }
  return variant;
}

// Build a Heroic variant for every epic/rare EQUIPPABLE item that drops from a
// mob's base loot table. Vendor jewelry, quest rewards, the item-level-31 hero
// set appended via HEROIC_BOSS_LOOT (these live in loot tables, never mob.loot),
// junk/quest objects, and non-gear are excluded by the quality + slot + kind
// gates: they never appear in a MobTemplate.loot as an eligible drop.
//
// Called from data.ts at content-evaluation time, BEFORE item_level's source
// index is initialized (the variant only needs the pure stats, never the
// source lookup), so the cycle that motivated item_budget.ts stays clean.
export function buildHeroicVariants(
  items: Record<string, ItemDef>,
  mobs: Record<string, MobTemplate>,
): Record<string, ItemDef> {
  const eligible = new Set<string>();
  for (const mob of Object.values(mobs)) {
    for (const entry of mob.loot ?? []) {
      const id = entry.itemId;
      if (!id) continue;
      const def = items[id];
      if (!def) continue;
      if (def.heroicOf) continue; // skip already-built variants (rebuild safety)
      if (def.quality !== 'epic' && def.quality !== 'rare') continue;
      if (!def.slot) continue;
      if (def.kind !== 'armor' && def.kind !== 'weapon') continue;
      eligible.add(id);
    }
  }
  const out: Record<string, ItemDef> = {};
  for (const id of eligible) out[heroicVariantId(id)] = makeHeroicVariant(items[id]);
  return out;
}
