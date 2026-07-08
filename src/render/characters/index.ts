// Character visual system — rigged glTF replacements for the old procedural
// rigs. Asset fetches start at module import (see assets.ts) and register
// with the preload gate, so createCharacterVisual is synchronous by the time
// the Renderer constructs views.
import type { Entity, PlayerClass } from '../../sim/types';
import { mechHeldWeaponOverride, visualKeyFor } from './manifest';
import { createPlantMobVisual, type PlantCreatureVisual } from './plant_dispatch';
import { CharacterVisual } from './visual';

export { PlantCreatureVisual, plantArchetypeFor } from './plant_dispatch';
export { CharacterPreview } from './preview';
export type { AnimState } from './visual';
export { CharacterVisual } from './visual';

/** Any renderer-drivable mob/player/npc visual: a GLB rig, or (PHAA-531) a
 *  seeded procedural plant creature for the Under-Shrine archetypes. Both
 *  expose the same update/trigger/LOD/dispose surface (see plant_dispatch.ts). */
export type MobVisual = CharacterVisual | PlantCreatureVisual;

/** Build the visual for an entity (or an explicit shapeshift/polymorph form key). */
export function createCharacterVisual(
  e: Entity,
  formKey: 'form_sheep' | 'form_bear' | 'form_cat' | 'form_travel',
): CharacterVisual;
export function createCharacterVisual(e: Entity): MobVisual;
export function createCharacterVisual(
  e: Entity,
  formKey?: 'form_sheep' | 'form_bear' | 'form_cat' | 'form_travel',
): MobVisual {
  // shapeshift/polymorph forms never apply to mobs, so only the bare-entity
  // call can route to the plant-creature generator
  if (!formKey && e.kind === 'mob') {
    const plant = createPlantMobVisual(e);
    if (plant) return plant;
  }
  // forms (sheep/bear/cat/travel) are their own models — skins and held weapons
  // only apply to the base body
  const key = formKey ?? visualKeyFor(e);
  // The class-agnostic Combat Mech adopts the wearer class's hand layout, so a
  // rogue-skinned mech dual-wields the equipped weapon in both hands. e.templateId
  // is the player's class on every host, so this matches offline and online.
  const weaponOverride =
    !formKey && key === 'player_mech' && e.kind === 'player'
      ? mechHeldWeaponOverride(e.templateId as PlayerClass)
      : null;
  return new CharacterVisual(
    key,
    e.color,
    formKey ? 0 : (e.skin ?? 0),
    formKey ? null : e.mainhandItemId,
    weaponOverride,
  );
}
