// Presentation metadata for the character-select class showcase.
//
// This is a thin, host-agnostic data module (no DOM/Three imports) so the
// drift guard in tests/charselect_class_details.test.ts can import it directly
// and cross-check it against the sim's source of truth (`CLASSES`/`ABILITIES`
// in src/sim/content/classes.ts). Keeping it separate from main.ts (which
// runs browser side-effects on import) is what makes that test possible.
//
// Starting stats, resource type, HP/mana and ability tooltips all read LIVE
// from the sim at render time; the only hand-maintained data here is the
// role/armor/weapon labels and the curated "signature" ability picks.

import type { PlayerClass } from '../sim/types';
import { classDisplayName } from './entity_i18n';
import type { TranslationKey } from './i18n';
import { t } from './i18n';

export interface ClassDetails {
  roleKey: TranslationKey;
  roleType: 'tank' | 'dps' | 'ranged' | 'healer' | 'hybrid';
  armorKey: TranslationKey;
  weaponsKey: TranslationKey;
}

export const CLASS_DETAILS: Record<PlayerClass, ClassDetails> = {
  warrior: {
    roleKey: 'classDetails.roles.warrior',
    roleType: 'hybrid',
    armorKey: 'classDetails.armor.chainLeatherCloth',
    weaponsKey: 'classDetails.weapons.swordsMacesAxes',
  },
  paladin: {
    roleKey: 'classDetails.roles.paladin',
    roleType: 'hybrid',
    armorKey: 'classDetails.armor.chainLeatherCloth',
    weaponsKey: 'classDetails.weapons.swordsMaces',
  },
  hunter: {
    roleKey: 'classDetails.roles.hunter',
    roleType: 'ranged',
    armorKey: 'classDetails.armor.leatherCloth',
    weaponsKey: 'classDetails.weapons.axesSwords',
  },
  rogue: {
    roleKey: 'classDetails.roles.rogue',
    roleType: 'dps',
    armorKey: 'classDetails.armor.leatherCloth',
    weaponsKey: 'classDetails.weapons.daggersSwords',
  },
  priest: {
    roleKey: 'classDetails.roles.priest',
    roleType: 'healer',
    armorKey: 'classDetails.armor.cloth',
    weaponsKey: 'classDetails.weapons.staves',
  },
  shaman: {
    roleKey: 'classDetails.roles.shaman',
    roleType: 'hybrid',
    armorKey: 'classDetails.armor.chainLeatherCloth',
    weaponsKey: 'classDetails.weapons.macesAxes',
  },
  mage: {
    roleKey: 'classDetails.roles.mage',
    roleType: 'ranged',
    armorKey: 'classDetails.armor.cloth',
    weaponsKey: 'classDetails.weapons.staves',
  },
  warlock: {
    roleKey: 'classDetails.roles.warlock',
    roleType: 'ranged',
    armorKey: 'classDetails.armor.cloth',
    weaponsKey: 'classDetails.weapons.staves',
  },
  druid: {
    roleKey: 'classDetails.roles.druid',
    roleType: 'hybrid',
    armorKey: 'classDetails.armor.leatherCloth',
    weaponsKey: 'classDetails.weapons.staves',
  },
};

// Three curated "signature" abilities per class, shown on the select screen.
// Each entry MUST be a real ability that the class can learn, enforced by
// tests/charselect_class_details.test.ts so this never drifts from the sim.
export const SIGNATURE_ABILITIES: Record<PlayerClass, string[]> = {
  warrior: ['charge', 'heroic_strike', 'rend'],
  paladin: ['holy_light', 'judgement', 'seal_of_righteousness'],
  hunter: ['serpent_sting', 'aimed_shot', 'arcane_shot'],
  rogue: ['sinister_strike', 'eviscerate', 'evasion'],
  priest: ['smite', 'power_word_shield', 'shadow_word_pain'],
  shaman: ['lightning_bolt', 'rockbiter_weapon', 'ghost_wolf'],
  mage: ['fireball', 'frostbolt', 'polymorph'],
  warlock: ['shadow_bolt', 'corruption', 'life_tap'],
  druid: ['wrath', 'bear_form', 'rejuvenation'],
};

/**
 * Charselect / character-sheet display label for a class pair (PHAA-465): a
 * character with a secondary profession (GW1-style multiclass) reads as
 * "Primary / Secondary", otherwise just the primary class name. Pure and
 * DOM-free so it can be unit-tested directly; the only render sink is
 * classDetails.classPairLabel (t()), never string concat.
 */
export function classPairLabel(primary: PlayerClass, secondary: PlayerClass | null): string {
  const primaryLabel = classDisplayName(primary);
  if (!secondary) return primaryLabel;
  return t('classDetails.classPairLabel', {
    primary: primaryLabel,
    secondary: classDisplayName(secondary),
  });
}
