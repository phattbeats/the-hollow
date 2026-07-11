// Pure, host-agnostic classifier for whether an ability can ONLY ever be cast on
// the caster, so the spellbook/action-bar tooltip can show a "Self only" line for
// beneficial self-centered abilities (Frost Armor, Ice Barrier, Evasion, the
// warrior stances) that carry no other targeting hint. hud.ts is the thin
// consumer (abilityRequirementLines); this lives on its own so a Vitest can import
// and pin the truth table directly without pulling in the DOM/Three HUD module.
//
// It keys off the effect TYPES, not `requiresTarget`, because a hostile
// self-centered AoE (Thunder Clap, Frost Nova, Arcane Explosion) also leaves
// `requiresTarget` false: only the effect shape distinguishes the two.
import type { AbilityDef, AbilityEffect } from '../sim/types';

// Effect types that only ever act on the caster (a beneficial self-buff, a
// self-inflicted cost, a weapon imbue, a pet summon/dismiss).
export const SELF_ONLY_EFFECT_TYPES = new Set<AbilityEffect['type']>([
  'selfBuff',
  'absorb',
  'imbue',
  'lifeTap',
  'gainResource',
  'selfDamagePctMax',
  'summonDemon',
  'dismissPet',
]);

export function isSelfOnlyAbility(def: AbilityDef): boolean {
  // A `requiresTarget` ability needs an entity, so it is never self-only. A
  // ground-targeted AoE (`groundAoE`) is aimed at a world point rather than the
  // caster; it is excluded by simply not being in the allowlist below, so no
  // separate ground-target flag is needed here.
  if (def.requiresTarget) return false;
  // An empty effects list is special-cased elsewhere (Conjure Water/Food make bag
  // items, Revive Pet acts on the pet), so we can't claim self-only from it: an
  // `every` over `[]` is vacuously true, which would mislabel those abilities.
  return def.effects.length > 0 && def.effects.every((eff) => SELF_ONLY_EFFECT_TYPES.has(eff.type));
}
