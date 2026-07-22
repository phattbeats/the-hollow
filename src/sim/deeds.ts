// Book of Asphodelia deed-tracking engine (PHAA-744, engine/wire layer only; the
// authored deed/title roster lands in PHAA-745). Deeds auto-track from character
// creation: unlike quests there is no accept step, every deed in the registry
// gains credit as its objectives are met. Draws NO rng; hooked from the same
// event sites as quest credit (quests/quest_credit.ts) so it runs on the
// deterministic 20Hz tick like everything else in src/sim.
//
// src/sim-pure: imports only sibling sim types + data (no render/ui/game/net/DOM/
// Three, no Math.random/Date.now), so it runs unchanged in Node, the browser, and
// the headless RL env. The deed registry is passed with a default parameter (not
// imported directly into the credit loops) so tests can exercise real credit/
// completion/title-grant math against a synthetic registry while DEEDS itself
// stays the empty placeholder table until PHAA-745 lands content.

import { DEEDS } from './data';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import type { DeedDef, DeedProgress, Entity } from './types';

function progressFor(meta: PlayerMeta, def: DeedDef): DeedProgress {
  let dp = meta.deedLog.get(def.id);
  if (!dp) {
    dp = { deedId: def.id, counts: def.objectives.map(() => 0), state: 'active' };
    meta.deedLog.set(def.id, dp);
  }
  return dp;
}

function checkDeedComplete(
  ctx: SimContext,
  def: DeedDef,
  dp: DeedProgress,
  meta: PlayerMeta,
): void {
  if (dp.state === 'done') return;
  const complete = def.objectives.every((obj, i) => dp.counts[i] >= obj.count);
  if (!complete) return;
  dp.state = 'done';
  meta.deedsDone.add(def.id);
  ctx.emit({ type: 'deedDone', deedId: def.id, pid: meta.entityId });
  if (def.titleReward && !meta.earnedTitles.has(def.titleReward)) {
    meta.earnedTitles.add(def.titleReward);
    ctx.emit({ type: 'titleEarned', titleId: def.titleReward, pid: meta.entityId });
  }
}

export function onMobKilledForDeeds(
  ctx: SimContext,
  mob: Entity,
  meta: PlayerMeta,
  deedDefs: Record<string, DeedDef> = DEEDS,
): void {
  for (const def of Object.values(deedDefs)) {
    if (meta.deedsDone.has(def.id)) continue;
    if (!def.objectives.some((obj) => obj.type === 'kill' && obj.targetMobId === mob.templateId))
      continue;
    const dp = progressFor(meta, def);
    let changed = false;
    def.objectives.forEach((obj, i) => {
      if (obj.type === 'kill' && obj.targetMobId === mob.templateId && dp.counts[i] < obj.count) {
        dp.counts[i]++;
        changed = true;
        ctx.emit({
          type: 'deedProgress',
          deedId: def.id,
          text: `${obj.label}: ${dp.counts[i]}/${obj.count}`,
          pid: meta.entityId,
        });
      }
    });
    if (changed) checkDeedComplete(ctx, def, dp, meta);
  }
}

export function onInventoryChangedForDeeds(
  ctx: SimContext,
  meta: PlayerMeta,
  deedDefs: Record<string, DeedDef> = DEEDS,
): void {
  for (const def of Object.values(deedDefs)) {
    if (meta.deedsDone.has(def.id)) continue;
    if (!def.objectives.some((obj) => obj.type === 'collect')) continue;
    const dp = progressFor(meta, def);
    let changed = false;
    def.objectives.forEach((obj, i) => {
      if (obj.type === 'collect' && obj.itemId) {
        const have = Math.min(obj.count, ctx.countItem(obj.itemId, meta.entityId));
        if (have !== dp.counts[i]) {
          dp.counts[i] = have;
          changed = true;
          ctx.emit({
            type: 'deedProgress',
            deedId: def.id,
            text: `${obj.label}: ${have}/${obj.count}`,
            pid: meta.entityId,
          });
        }
      }
    });
    if (changed) checkDeedComplete(ctx, def, dp, meta);
  }
}

// The title command surface: selects (or clears with null) the earned title
// shown alongside the character's name. Server-validated against earnedTitles
// so a client cannot equip a title it never earned; an invalid id is a silent
// no-op rather than a player-facing error toast (no title UI exists to trigger
// this yet, that lands with the cross-surface child PHAA-748).
export function setActiveTitle(meta: PlayerMeta, titleId: string | null): void {
  if (titleId !== null && !meta.earnedTitles.has(titleId)) return;
  meta.activeTitle = titleId;
}
