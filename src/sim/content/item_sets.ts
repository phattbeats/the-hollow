// Item sets and their equipped-piece bonuses (classic "tier set" style).
//
// The sets are the epic armor families that drop from the Gravewyrm Sanctum
// (tier 1) and the Nythraxis raid (tier 2), plus three leveling "haste kit"
// families assembled from existing world-drop items. Wearing enough pieces of
// a family grants stacking 2- and 3-piece bonuses, resolved in
// `recalcPlayerStats` (primary stats, attack power, crit, haste) and, for
// caster sets, in `Sim.pushbackCast` (cast-interrupt pushback from damage).
//
// Bonuses are keyed by archetype: the plate (Strength) families get attack
// power then Strength/Stamina; the leather (Agility) families get attack power
// then Agility/crit; the cloth (caster) families get cast-pushback reduction.
// Every tier-2 3-piece bonus ALSO grants haste (ONE stat: faster melee and
// ranged swings AND shorter casts/channels), and the three leveling haste
// kits grant haste alone at 3 pieces. This file is data-as-code: balance
// numbers live here, never inline in the engine. `aggregateSetBonuses` is the
// pure resolver imported by `entity.ts`.

import type { ItemSet, SetBonusEffect, SetBonusTier } from '../types';

// Haste granted by a 3-piece bonus (fraction). The one knob for every haste
// source: 0.15 makes swings 15% faster and casts/channels 15% shorter.
export const SET_HASTE_3PC = 0.15;

// Set ids. Tier-1 families drop from the Gravewyrm Sanctum; tier-2 from the
// Nythraxis raid. The string is also the `set` tag on each member item.
export const SET_DEATHLORD = 'deathlord'; // t1 plate, Strength
export const SET_WYRMSHADOW = 'wyrmshadow'; // t1 leather, Agility
export const SET_NECROMANCERS = 'necromancers'; // t1 cloth, caster
export const SET_CROWNFORGED = 'crownforged'; // t2 plate, Strength
export const SET_NIGHTTALON = 'nighttalon'; // t2 leather, Agility
export const SET_SOULFLAME = 'soulflame'; // t2 cloth, caster
export const SET_STORMCALLERS = 'stormcallers'; // t2 cloth (shaman), caster
// Leveling haste kits: families of EXISTING world-drop items (each member gets
// the `set` tag on its ItemDef in items.ts; no new item names).
export const SET_VALE_ARCANIST = 'vale_arcanist'; // cloth, caster
export const SET_BOUNDSTONE_VANGUARD = 'boundstone_vanguard'; // mail, melee
export const SET_GREYJAW_STALKER = 'greyjaw_stalker'; // leather, marksman

// Archetype bonus tiers. Tiers stack (a 3-piece set grants both the 2- and
// 3-piece bonuses); cast pushback reduction max-combines (see the resolver).
// Tier-1 families drop in the Gravewyrm Sanctum and reach their 3-piece tier.
// Tier-2 helms/shoulders drop in the Nythraxis raid, but only 2 pieces per
// tier-2 family exist in content today (content/zone3.ts), so their 3-piece
// tier (tier-1 stats PLUS haste) is defined here but not yet reachable via
// real equipment; see tests/haste_set_bonus.test.ts and item_sets.test.ts.
const STRENGTH_T1_BONUSES: SetBonusTier[] = [
  { pieces: 2, effect: { ap: 40 }, text: 'Increases attack power by 40.' },
  { pieces: 3, effect: { str: 15, sta: 15 }, text: 'Increases Strength by 15 and Stamina by 15.' },
];
const STRENGTH_T2_BONUSES: SetBonusTier[] = [
  { pieces: 2, effect: { ap: 40 }, text: 'Increases attack power by 40.' },
  {
    pieces: 3,
    effect: { str: 15, sta: 15, haste: SET_HASTE_3PC },
    text: 'Increases Strength by 15, Stamina by 15, and attack and casting speed by 15%.',
  },
];
const AGILITY_T1_BONUSES: SetBonusTier[] = [
  { pieces: 2, effect: { ap: 40 }, text: 'Increases attack power by 40.' },
  {
    pieces: 3,
    effect: { agi: 15, crit: 0.02 },
    text: 'Increases Agility by 15 and critical strike chance by 2%.',
  },
];
const AGILITY_T2_BONUSES: SetBonusTier[] = [
  { pieces: 2, effect: { ap: 40 }, text: 'Increases attack power by 40.' },
  {
    pieces: 3,
    effect: { agi: 15, crit: 0.02, haste: SET_HASTE_3PC },
    text: 'Increases Agility by 15, critical strike chance by 2%, and attack and casting speed by 15%.',
  },
];
const CASTER_T1_BONUSES: SetBonusTier[] = [
  {
    pieces: 2,
    effect: { castPushbackReduction: 0.5 },
    text: 'Reduces cast pushback from damage by 50%.',
  },
  {
    pieces: 3,
    effect: { castPushbackReduction: 1 },
    text: 'You cannot be pushed back while casting (immune to cast pushback from damage).',
  },
];
const CASTER_T2_BONUSES: SetBonusTier[] = [
  {
    pieces: 2,
    effect: { castPushbackReduction: 0.5 },
    text: 'Reduces cast pushback from damage by 50%.',
  },
  {
    pieces: 3,
    effect: { castPushbackReduction: 1, haste: SET_HASTE_3PC },
    text:
      'You cannot be pushed back while casting (immune to cast pushback from damage), and ' +
      'attack and casting speed is increased by 15%.',
  },
];
// The leveling haste kits grant haste alone, and only at 3 pieces:
// deliberately a single-tier reward a leveler assembles from world drops.
const HASTE_KIT_BONUSES: SetBonusTier[] = [
  {
    pieces: 3,
    effect: { haste: SET_HASTE_3PC },
    text: 'Increases attack and casting speed by 15%.',
  },
];

export const ITEM_SETS: Record<string, ItemSet> = {
  [SET_DEATHLORD]: {
    id: SET_DEATHLORD,
    name: 'Deathlord Battlegear',
    bonuses: STRENGTH_T1_BONUSES,
  },
  [SET_WYRMSHADOW]: {
    id: SET_WYRMSHADOW,
    name: 'Wyrmshadow Vestments',
    bonuses: AGILITY_T1_BONUSES,
  },
  [SET_NECROMANCERS]: {
    id: SET_NECROMANCERS,
    name: "Necromancer's Raiment",
    bonuses: CASTER_T1_BONUSES,
  },
  [SET_CROWNFORGED]: {
    id: SET_CROWNFORGED,
    name: 'Crownforged Regalia',
    bonuses: STRENGTH_T2_BONUSES,
  },
  [SET_NIGHTTALON]: { id: SET_NIGHTTALON, name: 'Nighttalon Pelt', bonuses: AGILITY_T2_BONUSES },
  [SET_SOULFLAME]: { id: SET_SOULFLAME, name: 'Soulflame Regalia', bonuses: CASTER_T2_BONUSES },
  [SET_STORMCALLERS]: {
    id: SET_STORMCALLERS,
    name: "Stormcaller's Vestments",
    bonuses: CASTER_T2_BONUSES,
  },
  [SET_VALE_ARCANIST]: {
    id: SET_VALE_ARCANIST,
    name: "Vale Arcanist's Regalia",
    bonuses: HASTE_KIT_BONUSES,
  },
  [SET_BOUNDSTONE_VANGUARD]: {
    id: SET_BOUNDSTONE_VANGUARD,
    name: 'Boundstone Vanguard',
    bonuses: HASTE_KIT_BONUSES,
  },
  [SET_GREYJAW_STALKER]: {
    id: SET_GREYJAW_STALKER,
    name: "Greyjaw Stalker's Kit",
    bonuses: HASTE_KIT_BONUSES,
  },
};

// Fully-resolved set effect: every field defaulted so callers never branch on
// undefined. `castPushbackReduction` is clamped to 0..1.
export interface AggregatedSetEffect {
  str: number;
  agi: number;
  sta: number;
  int: number;
  spi: number;
  ap: number;
  crit: number;
  haste: number;
  castPushbackReduction: number;
}

function zeroEffect(): AggregatedSetEffect {
  return {
    str: 0,
    agi: 0,
    sta: 0,
    int: 0,
    spi: 0,
    ap: 0,
    crit: 0,
    haste: 0,
    castPushbackReduction: 0,
  };
}

// Resolve equipped set-piece counts (setId -> count) into the summed bonus.
// Stat/AP/crit/haste effects add across every met tier; cast pushback reduction
// max-combines (so the 3-piece 100% supersedes the 2-piece 50% rather than
// summing past 1). Pure and host-agnostic so a Vitest can drive it directly.
export function aggregateSetBonuses(counts: Map<string, number>): AggregatedSetEffect {
  const out = zeroEffect();
  for (const [setId, count] of counts) {
    const set = ITEM_SETS[setId];
    if (!set) continue;
    for (const tier of set.bonuses) {
      if (count < tier.pieces) continue;
      const e: SetBonusEffect = tier.effect;
      out.str += e.str ?? 0;
      out.agi += e.agi ?? 0;
      out.sta += e.sta ?? 0;
      out.int += e.int ?? 0;
      out.spi += e.spi ?? 0;
      out.ap += e.ap ?? 0;
      out.crit += e.crit ?? 0;
      out.haste += e.haste ?? 0;
      if (e.castPushbackReduction != null) {
        out.castPushbackReduction = Math.max(out.castPushbackReduction, e.castPushbackReduction);
      }
    }
  }
  out.castPushbackReduction = Math.min(1, Math.max(0, out.castPushbackReduction));
  return out;
}
