// Heroic-tier loot content (upstream PR #1705/#1767, port to the fork).
//
// The fork does not ship Heroic dungeons (it has delves). The board's PHAA-639
// decision (2026-07-11) reversed an earlier DEFER: heroic loot upgrades apply
// to the fork's existing Heroic DELVE tier (collapsed_reliquary) instead of a
// five-man table. Two concrete wave pieces:
//
//  1. Heroic-tier Mob-Loot Upgrades (PR #1705's "Heroic loot flair")
//     When a delve mob dies inside an instance whose `tierId === 'heroic'`,
//     src/sim/loot/loot_roll.ts swaps any epic/rare equippable drop in its
//     base loot table for the corresponding Heroic variant (built from
//     buildHeroicVariants, registered in ITEMS via data.ts). Variants read the
//     same name; the [HEROIC] tag is composed at the tooltip boundary from
//     the heroicOf back-reference.
//
//  2. Heroic Marks (PR #1705's "Soulbound" + "Mark loot fan-out")
//     New soulbound `delve_heroic_mark` currency. The mark is appended to the
//     Heroic-tier finale reward chest at run time (one per party member), with
//     a personalFor slot so the lockpicker / chest opener grants each
//     eligible member's copies. The mark is BOUND: it cannot be traded,
//     mailed, listed, vendor-sold, or discarded (see heroic_delve_reward.ts for
//     the soulbound gates folded into addItem/path through the existing
//     `noMarketList`/`noVendorSell`/`noDiscard` checks).
//
// The formula values mirror upstream PR #1705/#1767 verbatim (item level 25
// tier + per-quality bump, the (a:b) slot-tier multipliers, the heroic item
// DPS curve in weaponDpsBudget). Per the parity-ledger rule on PHAA-407
// (PHAA-659 / v0.24.0 block): "do not invent balance numbers, follow the
// upstream formulas." Anything labelled "Heroic" below copies an upstream
// value or zero (delve-tier-only) - no fourth-wall numbers.

import type { ItemDef, LootEntry } from '../types';

// The boss the Heroic-tier finale waves at. The Collapsed Reliquary ships only
// one boss (deacon_varric) so the per-boss LootEntry tables reduce to a single
// key; future Heroic-tier deeps add theirs here.
export const HEROIC_DELVE_BOSS_IDS: Record<string, string> = {
  collapsed_reliquary: 'deacon_varric',
};

// The soulbound Heroic Mark item. Spend-only currency, never a gear slot, never
// sold or vendor-listed. The QA-tuned value (15c, paid out at the Brother Halven
// equivalent Heroic Quartermaster once that NPC lands) is informational only;
// the mark's economy path runs through currency flags, not `sellValue`.
export const HEROIC_DELVE_MARK: ItemDef = {
  id: 'delve_heroic_mark',
  name: 'Heroic Reliquary Mark',
  kind: 'junk',
  sellValue: 0,
  buyValue: 0,
  noVendorSell: true,
  noDiscard: true,
  noMarketList: true,
  soulbound: true,
  // flavor reads at the icon hover in the bags window; client localises this
  // through the same sim-emit path junk items already use, no per-item i18n key.
  flavorText:
    'A stamped sigil issued by the keepers of the Reliquary. Redeem it at the Heroic Quartermaster for reliquary-grade gear.',
};

// Per-boss Heroic-tier loot tables. Mirrors the structure of upstream's
// HEROIC_BOSS_LOOT so the loot_roll.ts swap can append a Heroic mark fan-out
// next to the existing finale reward. Chances inside a group sum to 1.0 so
// exactly one upgrade drops alongside the existing Heroic-tier XP/copper
// payout from grantDelveClearTo (which already exists).
//
// Slots covered per tier: every armor archetype covers chest + waist + feet
// minimum, with a mail/cloth main-hand per delve to keep the slot coverage
// symmetrical with the existing tier base loot. New Heroic-tier items do not
// land a NEW class niche; they upgrade existing tier loot via the variant
// generator (above) and add soulbound marks to the economy.
export const HEROIC_DELVE_BOSS_LOOT: Record<string, LootEntry[]> = {
  // Finale on a Collapsed Reliquary Heroic run. Two roll groups (independent
  // draws, each sums to 1.0) -> always two upgraded items + one soulbound mark
  // per participant (added separately by the mark fan-out at grantDelveClearTo).
  deacon_varric: [
    {
      itemId: 'delve_heroic_mark',
      chance: 1.0,
      rollGroup: 'heroic_mark',
      // Marks live on the heroic-finale loot list as a sentinel so the swap in
      // loot_roll.ts fans them out per-participant (one click on the corpse
      // grants every earner their copy). The flag is carried on the produced
      // LootSlot (LootSlot.sharedPersonal), and lootCorpse (interaction.ts)
      // honours it before the normal personal fallback.
      sharedPersonal: true,
    },
  ],
};

// The Heroic-tier mob loot upscaler is implemented at the swap point
// (src/sim/loot/loot_roll.ts), not here. This module's role is just to define
// the content records (the Mark item id + its loot-table sentinel) that the
// swap and the fan-out at grantDelveClearTo both reach for.

// ---------------------------------------------------------------------------
// Heroic Nythraxis (the 10-player raid, PHAA-714). Distinct from the delve
// heroic tier above: the claim comes from the raid's OWN instance difficulty
// (instances/dungeons.ts InstanceSlot.difficulty), not a delve run's tierId,
// and the raid is one tier ABOVE the delve heroic bump.
// ---------------------------------------------------------------------------

export const NYTHRAXIS_RAID_BOSS_ID = 'nythraxis_scourge_of_thornpeak';
// One tier above the delve heroic bump (HEROIC_VARIANT_SOURCE_LEVEL, the
// level-20 delve content one tier up): the 10-player raid's own epics land at
// item level 33 (27 + the epic bump of 6) and legendaries at 37 (27 + 10).
export const NYTHRAXIS_RAID_LOOT_SOURCE_LEVEL = 27;

// The three heroic-only raid weapons: one drops per heroic kill (chances sum
// to 1.0), on top of the free heroic-variant upgrade of the boss's own normal
// set pieces and legendaries (heroic_variants.ts). Item level 33, budget-exact
// (item_level.ts registers NYTHRAXIS_RAID_LOOT_SOURCE_LEVEL for this table).
export const HEROIC_NYTHRAXIS_ITEMS: Record<string, ItemDef> = {
  deathless_greatblade: {
    id: 'deathless_greatblade',
    name: 'Deathless Greatblade',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'epic',
    requiredLevel: 20,
    weapon: { min: 45, max: 68, speed: 3.4 },
    stats: { str: 14, sta: 9 },
    sellValue: 16000,
    requiredClass: ['warrior', 'paladin'],
  },
  scepter_of_the_deathless_court: {
    id: 'scepter_of_the_deathless_court',
    name: 'Scepter of the Deathless Court',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'epic',
    requiredLevel: 20,
    weapon: { min: 29, max: 51, speed: 2.4 },
    stats: { int: 13, spi: 10 },
    sellValue: 16000,
    requiredClass: ['mage', 'priest', 'warlock'],
  },
  stormcallers_focus: {
    id: 'stormcallers_focus',
    name: "Stormcaller's Focus",
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'epic',
    requiredLevel: 20,
    weapon: { min: 31, max: 52, speed: 2.5 },
    stats: { int: 14, spi: 9 },
    sellValue: 16000,
    requiredClass: ['shaman', 'paladin'],
  },
};

// The raid boss's normal set pieces and legendaries auto-upgrade to their
// raid-tier heroic variants on a heroic claim (heroic_variants.ts); this table
// adds only the heroic-ONLY extras the normal table never carries.
export const HEROIC_RAID_BOSS_LOOT: Record<string, LootEntry[]> = {
  nythraxis_scourge_of_thornpeak: [
    { itemId: 'deathless_greatblade', chance: 0.34, rollGroup: 'nythraxis_heroic_weapon' },
    {
      itemId: 'scepter_of_the_deathless_court',
      chance: 0.33,
      rollGroup: 'nythraxis_heroic_weapon',
    },
    { itemId: 'stormcallers_focus', chance: 0.33, rollGroup: 'nythraxis_heroic_weapon' },
  ],
};
