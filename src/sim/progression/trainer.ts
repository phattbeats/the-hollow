// Profession Trainer NPC command surface (GW1 build system multiclassing, Phase 3,
// PHAA-464): picking, or later changing, a secondary class. Mirrors the vendor
// command shape in items.ts (buyItem: look up the NPC's content def, check range,
// check cost, spend, apply) behind the IWorldTrainer facet (world_api/trainer.ts).
//
// `src/sim`-pure: no DOM/Three/render/ui/game/net imports, no Math.random/Date.now
// (enforced by tests/architecture.test.ts).

import { NPCS } from '../data';
import type { SimContext } from '../sim_context';
import { ALL_CLASSES, dist2d, INTERACT_RANGE, type PlayerClass } from '../types';

// A secondary profession unlocks at level 10, matching the level a class's own
// talent tree opens (FIRST_TALENT_LEVEL in content/talents.ts): by then a build
// is worth having opinions about.
export const SECONDARY_CLASS_MIN_LEVEL = 10;

// Escalating gold cost (in copper) for the 2nd, 3rd, ... paid change; the very
// first pick is free. Indexed by `secondaryClsChanges`, capped at the last
// tier. 1g / 5g / 10g / 25g / 50g, matching this game's copper denomination
// (100 copper = 1 silver, 100 silver = 1 gold; see format_money.ts).
export const SECONDARY_CLASS_CHANGE_COST = [10000, 50000, 100000, 250000, 500000];

// Pure cost rule, shared by the sim command (secondaryClassCost below) and the
// online client's display-only preview (ClientWorld.secondaryClassCost in
// src/net/online.ts), so the two can never drift.
export function secondaryClassCostFor(
  primaryCls: PlayerClass,
  currentSecondaryCls: PlayerClass | null,
  secondaryClsChanges: number,
  cls: PlayerClass,
): number | null {
  if (!ALL_CLASSES.includes(cls) || cls === primaryCls || cls === currentSecondaryCls) return null;
  if (currentSecondaryCls === null) return 0;
  const idx = Math.min(secondaryClsChanges, SECONDARY_CLASS_CHANGE_COST.length - 1);
  return SECONDARY_CLASS_CHANGE_COST[idx];
}

// Cost to set `cls` as the secondary class right now, or null if that pick is
// not legal (the player's own primary class, or already the current
// secondary). 0 for the first-ever pick.
export function secondaryClassCost(ctx: SimContext, cls: PlayerClass, pid?: number): number | null {
  const r = ctx.resolve(pid);
  if (!r) return null;
  const { meta } = r;
  return secondaryClassCostFor(meta.cls, meta.secondaryCls, meta.secondaryClsChanges, cls);
}

export function setSecondaryClass(
  ctx: SimContext,
  npcId: number,
  cls: PlayerClass,
  pid?: number,
): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  const npc = ctx.entities.get(npcId);
  if (!npc || npc.kind !== 'npc') {
    ctx.error(meta.entityId, 'That trainer is not available.');
    return;
  }
  const trainer = NPCS[npc.templateId]?.trainer;
  if (!trainer) {
    ctx.error(meta.entityId, 'That trainer is not available.');
    return;
  }
  if (!trainer.professions.includes(cls)) {
    ctx.error(meta.entityId, 'That trainer does not teach that profession.');
    return;
  }
  if (dist2d(p.pos, npc.pos) > INTERACT_RANGE + 2) {
    ctx.error(meta.entityId, 'Too far away.');
    return;
  }
  if (p.level < SECONDARY_CLASS_MIN_LEVEL) {
    ctx.error(meta.entityId, 'You must be level 10 to choose a secondary profession.');
    return;
  }
  const cost = secondaryClassCost(ctx, cls, pid);
  if (cost === null) {
    ctx.error(meta.entityId, 'That is not a legal secondary profession.');
    return;
  }
  if (meta.copper < cost) {
    ctx.error(meta.entityId, 'Not enough money.');
    return;
  }
  const firstPick = meta.secondaryCls === null;
  meta.copper -= cost;
  if (!firstPick) meta.secondaryClsChanges++;
  meta.secondaryCls = cls;
  ctx.refreshKnownAbilities(meta, false);
  ctx.emit({ type: 'trainer', action: 'setSecondaryClass', cls, pid: meta.entityId });
}
