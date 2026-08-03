// Healer-hold positioning for a channelHeal mob (Spirit of Malric, the Heroic
// Nythraxis add): it is a HEALER, not a bruiser, so it holds a standoff near
// its protectee (the biggest friendly mob in range, e.g. the raid boss) and
// channels a visible heal instead of running the raid down. Falls back to
// normal melee/chase AI only when there is no ally in range to heal.
//
// `src/sim`-pure: reads/writes only through SimContext + Entity; no rng.

import { isLockedOut, isSilenced } from '../combat/cc';
import { MOBS } from '../data';
import type { SimContext } from '../sim_context';
import { dist2d, type Entity } from '../types';
import { NYTHRAXIS_SPIRIT_MENDING_CAST_ID } from './healer_channel';

const HEALER_STANDOFF = 6;

// Returns true when this tick was fully handled by the heal-hold (stood,
// chased into range, or was interrupted): the caller should not run its
// normal chase/attack AI. Returns false when the mob has no channelHeal
// mechanic, or has one but nobody to heal (falls back to normal AI).
export function updateChannelHealerHold(ctx: SimContext, mob: Entity): boolean {
  const heal = MOBS[mob.templateId]?.channelHeal;
  if (!heal) return false;
  // Cached protectee: only walk the whole entity map when the cached one is
  // gone, dead, or out of range (mirrors the timer-gated mendAlly/wardAllies
  // scans rather than scanning every tick while engaged).
  let protectee =
    mob.healProtecteeId != null ? (ctx.entities.get(mob.healProtecteeId) ?? null) : null;
  if (!protectee || protectee.dead || dist2d(protectee.pos, mob.pos) > heal.radius) {
    protectee = null;
    for (const ally of ctx.entities.values()) {
      if (ally.kind !== 'mob' || ally.dead || ally.ownerId !== null) continue;
      if (ally.hostile !== mob.hostile || ally.id === mob.id) continue;
      if (dist2d(ally.pos, mob.pos) > heal.radius) continue;
      if (!protectee || ally.maxHp > protectee.maxHp) protectee = ally;
    }
    mob.healProtecteeId = protectee?.id ?? null;
  }
  if (!protectee) return false; // nobody to heal: fall back to normal AI
  mob.facing = Math.atan2(protectee.pos.x - mob.pos.x, protectee.pos.z - mob.pos.z);
  const clearBar = () => {
    mob.castingAbility = null;
    mob.castTotal = 0;
    mob.castRemaining = 0;
    mob.channeling = false;
  };
  if (dist2d(mob.pos, protectee.pos) > HEALER_STANDOFF) {
    ctx.moveToward(mob, protectee.pos, mob.moveSpeed * ctx.moveSpeedMult(mob));
    mob.aiState = 'chase';
    clearBar();
  } else if (isSilenced(mob) || isLockedOut(mob, heal.school ?? 'shadow')) {
    // Interrupted (silenced or school-locked): stand idle with no cast bar. The
    // channelHeal break in Sim's per-tick mechanic block already reset the ramp.
    mob.aiState = 'attack';
    clearBar();
  } else {
    // In position and free: stand still and channel a visible cast bar
    // counting down to the next heal tick (driven by mob.channelTimer).
    mob.aiState = 'attack';
    mob.castingAbility = NYTHRAXIS_SPIRIT_MENDING_CAST_ID;
    mob.castTotal = heal.every;
    mob.castRemaining = Math.max(0, mob.channelTimer);
    mob.channeling = true;
  }
  return true;
}
