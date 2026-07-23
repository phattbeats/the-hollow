// Book of Asphodelia deed-tracking engine (PHAA-744 engine/wire layer;
// PHAA-745 authors the deed/title roster, category by category). Deeds
// auto-track from character creation: unlike quests there is no accept step,
// every deed in the registry gains credit as its objectives are met. Draws NO
// rng; hooked from the same event sites as quest credit (quests/quest_credit.ts)
// so it runs on the deterministic 20Hz tick like everything else in src/sim.
//
// src/sim-pure: imports only sibling sim types + data (no render/ui/game/net/DOM/
// Three, no Math.random/Date.now), so it runs unchanged in Node, the browser, and
// the headless RL env. The deed registry is passed with a default parameter (not
// imported directly into the credit loops) so tests can exercise real credit/
// completion/title-grant math against a synthetic registry independent of the
// live DEEDS content table.

import { DEEDS } from './data';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import type { DeedDef, DeedObjective, DeedProgress, Entity } from './types';

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

function killMatches(obj: DeedObjective, mob: Entity): boolean {
  return obj.type === 'kill' && (!obj.targetMobId || obj.targetMobId === mob.templateId);
}

function questMatches(obj: DeedObjective, questId: string): boolean {
  return obj.type === 'quest' && (!obj.questId || obj.questId === questId);
}

function delveMatches(
  obj: DeedObjective,
  delveId: string,
  tierId: string,
  deathless: boolean,
): boolean {
  return (
    obj.type === 'delve' &&
    (!obj.delveId || obj.delveId === delveId) &&
    (!obj.tierId || obj.tierId === tierId) &&
    (!obj.deathless || deathless)
  );
}

function levelMatches(obj: DeedObjective, level: number): boolean {
  return obj.type === 'level' && level >= (obj.atLeast ?? 1);
}

export function onMobKilledForDeeds(
  ctx: SimContext,
  mob: Entity,
  meta: PlayerMeta,
  deedDefs: Record<string, DeedDef> = DEEDS,
): void {
  for (const def of Object.values(deedDefs)) {
    if (meta.deedsDone.has(def.id)) continue;
    if (!def.objectives.some((obj) => killMatches(obj, mob))) continue;
    const dp = progressFor(meta, def);
    let changed = false;
    def.objectives.forEach((obj, i) => {
      if (killMatches(obj, mob) && dp.counts[i] < obj.count) {
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

// Chronicle deeds (PHAA-745): hooked from the same completeQuest() core the
// turn-in and refusal paths share (quests/quest_commands.ts), so it fires once
// per quest completion regardless of which path granted it.
export function onQuestCompletedForDeeds(
  ctx: SimContext,
  questId: string,
  meta: PlayerMeta,
  deedDefs: Record<string, DeedDef> = DEEDS,
): void {
  for (const def of Object.values(deedDefs)) {
    if (meta.deedsDone.has(def.id)) continue;
    if (!def.objectives.some((obj) => questMatches(obj, questId))) continue;
    const dp = progressFor(meta, def);
    let changed = false;
    def.objectives.forEach((obj, i) => {
      if (questMatches(obj, questId) && dp.counts[i] < obj.count) {
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

// Delve deeds (PHAA-745): hooked from the single per-member clear-economy choke
// point (grantDelveClearTo in delves/runs.ts), shared by every path that grants a
// delve clear, so it fires once per member regardless of how the run ended.
export function onDelveClearedForDeeds(
  ctx: SimContext,
  delveId: string,
  tierId: string,
  deathless: boolean,
  meta: PlayerMeta,
  deedDefs: Record<string, DeedDef> = DEEDS,
): void {
  for (const def of Object.values(deedDefs)) {
    if (meta.deedsDone.has(def.id)) continue;
    if (!def.objectives.some((obj) => delveMatches(obj, delveId, tierId, deathless))) continue;
    const dp = progressFor(meta, def);
    let changed = false;
    def.objectives.forEach((obj, i) => {
      if (delveMatches(obj, delveId, tierId, deathless) && dp.counts[i] < obj.count) {
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

// Progression deeds (PHAA-745): hooked from the single level-up choke point in
// grantXp (combat/damage.ts), fired once per level crossed. A 'level' objective
// credits when the character reaches its atLeast threshold; count is 1 (a
// threshold is reached once), and the deedsDone guard prevents any re-credit.
export function onLevelReachedForDeeds(
  ctx: SimContext,
  level: number,
  meta: PlayerMeta,
  deedDefs: Record<string, DeedDef> = DEEDS,
): void {
  for (const def of Object.values(deedDefs)) {
    if (meta.deedsDone.has(def.id)) continue;
    if (!def.objectives.some((obj) => levelMatches(obj, level))) continue;
    const dp = progressFor(meta, def);
    let changed = false;
    def.objectives.forEach((obj, i) => {
      if (levelMatches(obj, level) && dp.counts[i] < obj.count) {
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
