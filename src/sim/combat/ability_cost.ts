// Multiclass secondary-ability resource-cost translation (PHAA-467), the
// implementation of the rule proposed in
// docs/design/multiclass-resource-translation.md (board-accepted on
// PHAA-462). A secondary-kit ability's `cost` is denominated in its OWN
// class's resource type; this translates that cost onto the caster's live
// (primary-class) pool by percentage of the secondary class's own max, so the
// SAME secondary ability costs the same fraction of the bar no matter which
// primary class is casting it.

import { CLASSES } from '../content/classes';
import { nativeMaxResource } from '../entity';
import type { AbilityDef, PlayerClass, ResourceType } from '../types';

// `cost` is the ability's native (pre-translation) cost. Same-resource-type
// casts (including a druid's own kit, and rage<->energy which are both
// already flat percentages of 100) are a no-op. Clamped to [1, primaryMax]
// for any ability with a positive native cost, guarding both the round()-to-0
// floor and a divide-by-zero on a zero nativeMax.
export function translateAbilityCost(
  cost: number,
  nativeCls: PlayerClass,
  primaryResourceType: ResourceType,
  primaryMaxResource: number,
  level: number,
): number {
  if (cost <= 0) return cost;
  if (CLASSES[nativeCls].resourceType === primaryResourceType) return cost;
  const nativeMax = nativeMaxResource(nativeCls, level);
  if (nativeMax <= 0) return Math.min(cost, primaryMaxResource);
  const translated = Math.round((cost / nativeMax) * primaryMaxResource);
  return Math.max(1, Math.min(translated, primaryMaxResource));
}

// Whether `ability`'s cost should be translated at all for this caster: only
// when it comes from a class other than the caster's live/primary class (a
// secondary-kit or granted ability), and never for a form toggle (druid
// forms swap the bar rather than spending from it; see formShiftKind in
// combat/casting_lifecycle.ts).
export function needsCostTranslation(
  ability: AbilityDef,
  primaryCls: PlayerClass,
  isFormToggle: boolean,
): boolean {
  return ability.class !== primaryCls && !isFormToggle;
}
