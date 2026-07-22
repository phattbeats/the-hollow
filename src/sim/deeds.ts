// Book of Asphodelia deed engine (PHAA-744), behind the SimContext seam.
// Unlike quests, a deed has no accept step: every player implicitly tracks
// every DEEDS entry, so a DeedProgress record is created lazily the first
// time an objective is credited. Completion is automatic (no turn-in NPC)
// and grants the deed's titleReward, if any, to PlayerMeta.earnedTitles.
//
// src/sim-pure: imports only sibling sim types + the DEEDS/TITLES data tables
// (no render/ui/game/net/DOM/Three, no Math.random/Date.now), so it runs
// unchanged in Node, the browser, and the headless RL env.

import { DEEDS } from './data';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import type { DeedDef, DeedProgress, Entity } from './types';

function progressFor(meta: PlayerMeta, deed: DeedDef): DeedProgress {
  let dp = meta.deedLog.get(deed.id);
  if (!dp) {
    dp = { deedId: deed.id, counts: deed.objectives.map(() => 0) };
    meta.deedLog.set(deed.id, dp);
  }
  return dp;
}

export function checkDeedComplete(
  ctx: SimContext,
  deed: DeedDef,
  dp: DeedProgress,
  meta: PlayerMeta,
): void {
  if (meta.deedsDone.has(deed.id)) return; // idempotent regardless of caller
  const ready = deed.objectives.every((obj, i) => dp.counts[i] >= obj.count);
  if (!ready) return;
  meta.deedLog.delete(deed.id);
  meta.deedsDone.add(deed.id);
  ctx.emit({ type: 'deedCompleted', deedId: deed.id, pid: meta.entityId });
  if (deed.titleReward) {
    meta.earnedTitles.add(deed.titleReward);
    ctx.emit({ type: 'titleEarned', titleId: deed.titleReward, pid: meta.entityId });
  }
}

// Only DEEDS actually touched by a kill/collect ever gain a DeedProgress entry:
// every player implicitly tracks every deed, so an eager entry for every
// untouched deed on every event would bloat meta.deedLog (and the persisted
// CharacterState) with meaningless zero-progress noise.
export function onMobKilledForDeeds(ctx: SimContext, mob: Entity, meta: PlayerMeta): void {
  for (const deed of Object.values(DEEDS)) {
    if (meta.deedsDone.has(deed.id)) continue;
    if (!deed.objectives.some((obj) => obj.type === 'kill' && obj.targetMobId === mob.templateId)) {
      continue;
    }
    const dp = progressFor(meta, deed);
    let changed = false;
    deed.objectives.forEach((obj, i) => {
      if (obj.type === 'kill' && obj.targetMobId === mob.templateId && dp.counts[i] < obj.count) {
        dp.counts[i]++;
        changed = true;
      }
    });
    if (changed) checkDeedComplete(ctx, deed, dp, meta);
  }
}

export function onInventoryChangedForDeeds(ctx: SimContext, meta: PlayerMeta): void {
  for (const deed of Object.values(DEEDS)) {
    if (meta.deedsDone.has(deed.id)) continue;
    let dp = meta.deedLog.get(deed.id);
    let changed = false;
    deed.objectives.forEach((obj, i) => {
      if (obj.type !== 'collect' || !obj.itemId) return;
      const have = Math.min(obj.count, ctx.countItem(obj.itemId, meta.entityId));
      const current = dp?.counts[i] ?? 0;
      if (have === current) return;
      dp = dp ?? progressFor(meta, deed);
      dp.counts[i] = have;
      changed = true;
    });
    if (changed && dp) checkDeedComplete(ctx, deed, dp, meta);
  }
}
