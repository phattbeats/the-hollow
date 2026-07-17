// Pure item-level budget primitives: the quality/slot weightings, the primary-stat
// budget that an item of (level, quality, slot) is expected to grant, the weapon-DPS
// ladder, and the helpers that redistribute an item's stat line onto a new budget.
//
// Why this lives in its own leaf: item_level.ts owns the SOURCE-INDEX-aware readouts
// (the part that looks up an item's level from MOBS/QUESTS), and content/heroic_variants.ts
// runs at data-evaluation time BEFORE that source index is initialised. Both need the
// pure budget math (quality/slot multipliers, normalizePrimaryStats), so a third module
// holds them with no `./data` import and no source-index access. Neither side can reach
// the other through this file.
//
// `src/sim`-pure: no DOM, no rng, no clock; deterministic given only its arguments.

import type { EquipSlot, ItemDef, Stats, WeaponInfo } from './types';

// The five primary attributes an item can carry. Armor is NOT primary (it is an
// armor-class/slot property, not part of the comparable stat budget) so it stays
// off this list and passes through unchanged in normalizePrimaryStats.
export const PRIMARY_STATS = ['str', 'agi', 'sta', 'int', 'spi'] as const;
export type PrimaryStat = (typeof PRIMARY_STATS)[number];

// A rarer item "punches above" the level of the content that drops it. Grounded in
// the classic convention that a blue from a level-N pull outclasses a green from
// the same pull; the exact bumps are tuned to this game's level-20 cap.
export const QUALITY_ILVL_BONUS: Record<string, number> = {
  poor: 0,
  common: 0,
  uncommon: 1,
  rare: 3,
  epic: 6,
  legendary: 10,
};

// Share of a level's stat budget that each quality grants. Whites/greys carry no
// primary stats (armor only), greens roughly half, blues most, purples the full
// ladder, mirroring the existing hand-authored content. Legendaries are a steep
// jump (the two in the game are flagship BiS artifacts that should dwarf epics).
export const QUALITY_STAT_MULT: Record<string, number> = {
  poor: 0,
  common: 0,
  uncommon: 0.55,
  rare: 0.8,
  epic: 1.0,
  legendary: 1.9,
};

// Slot weight for the stat budget: chest and main-hand carry the most, the smaller
// slots less. Matches the slot weighting already described for armor in items.ts.
export const SLOT_STAT_MULT: Record<EquipSlot, number> = {
  mainhand: 1.0,
  chest: 1.0,
  legs: 0.9,
  helmet: 0.85,
  shoulder: 0.75,
  waist: 0.7,
  gloves: 0.7,
  feet: 0.65,
};

// Primary-stat points granted per item level at full (rare-mult x chest-mult = 1).
export const STAT_PER_ILVL = 0.7;

// Heroic-tier item level assigned to base loot upgraded in a Heroic instance. Both
// rares (25) and epics (25 + 6 = 31 via the epic bump) read above their base drops
// without ever downgrading the item-level-31 final-boss set (we only swap drops,
// never the boss-only epics; see src/sim/content/heroic_variants.ts).
export const HEROIC_VARIANT_SOURCE_LEVEL = 25;

// Weapon DPS ladder fitted to the authored drops. The base item's damage is scaled
// toward this curve when the variant is built, keeping its swing speed and spread.
// Used by content/heroic_variants.ts so an upgraded weapon matches its item level.
export function weaponDpsBudget(level: number): number {
  // Linear fit to the classic curve: a level-26 two-hander lands ~15.0, a level-31
  // epic lands ~16.0, capping around the legacy-ish range. Tuned so item_level.ts's
  // expected-budget assertions stay stable for both base and heroic drops.
  if (level <= 0) return 0;
  return level * 0.55 + 0.7;
}

// The total primary-stat points an item of this level + quality + slot should grant.
// Quality bump is applied separately by callers via (level + QUALITY_ILVL_BONUS[q]).
export function primaryStatBudget(
  level: number,
  quality: ItemDef['quality'],
  slot: EquipSlot | undefined,
): number {
  if (!slot) return 0;
  const q = QUALITY_STAT_MULT[quality ?? 'common'] ?? 0;
  const s = SLOT_STAT_MULT[slot] ?? 0.7;
  return Math.max(0, Math.round(level * q * s * STAT_PER_ILVL));
}

// Redistribute `budget` primary-stat points across whichever attributes the item
// already uses, keeping their ratio (its stat identity) and the integer sum EXACTLY
// equal to `budget`. armor is passed through untouched. Largest-remainder rounding
// makes it deterministic (ties broken by PRIMARY_STATS order). Note: under a very
// lopsided ratio with a tiny budget a minor attribute can still round to 0; the
// authored tiers use balanced ratios where every attribute survives.
export function normalizePrimaryStats(stats: Partial<Stats>, budget: number): Partial<Stats> {
  const out: Partial<Stats> = {};
  if (stats.armor !== undefined) out.armor = stats.armor;
  const present = PRIMARY_STATS.filter((k) => (stats[k] ?? 0) > 0);
  const total = present.reduce((a, k) => a + (stats[k] ?? 0), 0);
  if (present.length === 0 || total === 0 || budget <= 0) return out;
  const parts = present.map((k) => {
    const exact = (budget * (stats[k] ?? 0)) / total;
    const base = Math.floor(exact);
    return { k, base, frac: exact - base };
  });
  let assigned = parts.reduce((a, p) => a + p.base, 0);
  // Hand out the leftover points to the largest fractional parts first; the stable
  // PRIMARY_STATS order keeps ties deterministic across runs and hosts.
  const order = [...parts].sort((a, b) => b.frac - a.frac);
  for (let i = 0; assigned < budget; i++, assigned++) order[i % order.length].base += 1;
  for (const p of parts) out[p.k] = p.base;
  return out;
}

// Build a WeaponInfo with min/max damage that lands on `targetDps` for the given
// speed and base spread. Used so a Heroic weapon variant stays on the item-level
// curve for its slot (per-slot scaling preserves the classic damage feel).
export function scaleWeaponDamage(base: WeaponInfo, targetDps: number): Partial<WeaponInfo> {
  const speed = base.speed;
  const mid = targetDps * speed;
  // Keep the original spread (±range around the midpoint). If the base spread is
  // unknown, default to ±10% which matches the authored ladder's ratio.
  const spread = Math.max(1, Math.round(mid * 0.15));
  const min = Math.max(1, Math.round(mid - spread));
  const max = Math.max(min + 1, Math.round(mid + spread));
  return { min, max, speed };
}
