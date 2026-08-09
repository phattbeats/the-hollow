// Dungeon Finder (ADAPT upstream #1789), phase 1: a pre-10 fixed-capability
// matcher. Solo players queue for a single role (tank/healer/dps); the matcher
// runs at end of tick (deterministic, no rng draws of its own) and pops the
// oldest tank + healer + 3 dps into a freshly formed party, then walks them
// into the dungeon via the existing instances/dungeons.ts door path.
//
// "Fixed-capability" means the role a class MAY queue as is a static fact of
// the class (mirrors the roles its specs already cover in content/talents.ts),
// never the player's currently allocated spec/points: pre-10 characters have
// no points to allocate yet, so reading live talent state would not work.
// Phase 2 (role-from-spec matching, blocked on Talents 2.0 / PHAA-715) will
// replace classRoles with a read of the player's actual assigned spec; this
// module is the seam that swap targets.
//
// Only one dungeon qualifies for the pre-10 bracket today (hollow_crypt, mob
// levels 7-10); DUNGEON_FINDER_DUNGEON_IDS stays a short list so Phase 2 only
// has to append, not restructure.

import { type Role, talentsFor } from '../content/talents';
import { DUNGEON_X_THRESHOLD, DUNGEONS } from '../data';
import type { SimContext } from '../sim_context';
import { ALL_CLASSES, type PlayerClass } from '../types';

export const DUNGEON_FINDER_DUNGEON_IDS: readonly string[] = ['hollow_crypt'];

export interface DungeonFinderQueueEntry {
  pid: number;
  role: Role;
  dungeonId: string;
  joinedAt: number;
}

export interface DungeonFinderInfo {
  queued: boolean;
  role: Role | null;
  dungeonId: string | null;
  position: number; // 1-based position within the player's role queue, 0 if not queued
}

const ROLE_REQUIREMENTS: Record<Role, number> = { tank: 1, healer: 1, dps: 3 };

// Fixed per-class role capability, computed once from the specs the class
// already carries (see file banner). A dedupe over each spec's role.
const CLASS_ROLES: Partial<Record<PlayerClass, Role[]>> = {};
for (const cls of ALL_CLASSES) {
  const roles = talentsFor(cls)?.specs.map((s) => s.role) ?? [];
  CLASS_ROLES[cls] = [...new Set(roles)];
}

export function classRoles(cls: PlayerClass): Role[] {
  return CLASS_ROLES[cls] ?? [];
}

export function isDungeonFinderQueued(ctx: SimContext, pid: number): boolean {
  return ctx.dungeonFinderQueue.some((e) => e.pid === pid);
}

export function dungeonFinderPosition(ctx: SimContext, pid: number): number {
  const entry = ctx.dungeonFinderQueue.find((e) => e.pid === pid);
  if (!entry) return 0;
  let position = 0;
  for (const e of ctx.dungeonFinderQueue) {
    if (e.role !== entry.role || e.dungeonId !== entry.dungeonId) continue;
    position++;
    if (e.pid === pid) break;
  }
  return position;
}

export function dungeonFinderInfoFor(ctx: SimContext, pid: number): DungeonFinderInfo {
  const entry = ctx.dungeonFinderQueue.find((e) => e.pid === pid);
  if (!entry) return { queued: false, role: null, dungeonId: null, position: 0 };
  return {
    queued: true,
    role: entry.role,
    dungeonId: entry.dungeonId,
    position: dungeonFinderPosition(ctx, pid),
  };
}

export function dungeonFinderQueueJoin(
  ctx: SimContext,
  role: Role,
  dungeonId?: string,
  pid?: number,
): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const id = r.meta.entityId;
  const targetDungeonId = dungeonId ?? DUNGEON_FINDER_DUNGEON_IDS[0];
  // Already queued: a no-op. The queue window polls dungeonFinderInfo live
  // (position included), so there is nothing further to tell the player.
  if (isDungeonFinderQueued(ctx, id)) return;
  if (r.e.dead) {
    ctx.error(id, 'You cannot queue for the Dungeon Finder while dead.');
    return;
  }
  if (!DUNGEON_FINDER_DUNGEON_IDS.includes(targetDungeonId)) {
    ctx.error(id, 'That dungeon is not available through the Dungeon Finder yet.');
    return;
  }
  if (!classRoles(r.meta.cls).includes(role)) {
    ctx.error(id, 'Your class cannot queue for that role.');
    return;
  }
  const party = ctx.partyOf(id);
  if (party && party.members.length > 1) {
    ctx.error(id, 'Leave your party before queueing for the Dungeon Finder.');
    return;
  }
  if (ctx.duels.has(id)) {
    ctx.error(id, 'You cannot queue for the Dungeon Finder while dueling.');
    return;
  }
  if (ctx.trades.has(id)) {
    ctx.error(id, 'Finish your trade before queueing for the Dungeon Finder.');
    return;
  }
  if (r.e.pos.x > DUNGEON_X_THRESHOLD) {
    ctx.error(id, 'You cannot queue for the Dungeon Finder from inside an instance.');
    return;
  }
  ctx.dungeonFinderQueue = [
    ...ctx.dungeonFinderQueue,
    { pid: id, role, dungeonId: targetDungeonId, joinedAt: ctx.time },
  ];
  ctx.emit({
    type: 'log',
    text: `You join the Dungeon Finder queue as ${role}. Stand by for a group...`,
    color: '#8fd',
    pid: id,
  });
}

export function dungeonFinderQueueLeave(ctx: SimContext, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const id = r.meta.entityId;
  if (!isDungeonFinderQueued(ctx, id)) return;
  ctx.dungeonFinderQueue = ctx.dungeonFinderQueue.filter((e) => e.pid !== id);
  ctx.emit({ type: 'log', text: 'You leave the Dungeon Finder queue.', color: '#8fd', pid: id });
}

// A queued entry can go stale between join and match (the player parties up,
// starts a duel/trade, or walks into an instance by another path); re-run the
// same eligibility the join guard checked, or a stale entry could get dragged
// into formPartyFromRoster and corrupt a party it has since actually joined.
function isStillEligible(ctx: SimContext, entry: DungeonFinderQueueEntry): boolean {
  if (!ctx.players.has(entry.pid)) return false;
  const e = ctx.entities.get(entry.pid);
  if (!e || e.dead) return false;
  const party = ctx.partyOf(entry.pid);
  if (party && party.members.length > 1) return false;
  if (ctx.duels.has(entry.pid)) return false;
  if (ctx.trades.has(entry.pid)) return false;
  if (e.pos.x > DUNGEON_X_THRESHOLD) return false;
  return true;
}

// End-of-tick matcher: FIFO within each role bucket, no rng draws of its own
// (entering the claimed instance may draw ctx.rng for a first-time mob-level
// roll, same as any other door-triggered entry).
export function updateDungeonFinder(ctx: SimContext): void {
  ctx.dungeonFinderQueue = ctx.dungeonFinderQueue.filter((e) => {
    if (isStillEligible(ctx, e)) return true;
    // Tell a still-connected, still-alive player why they dropped out (e.g.
    // they joined a party after queueing solo); a dead/disconnected one has
    // no one to tell.
    const entity = ctx.entities.get(e.pid);
    if (ctx.players.has(e.pid) && entity && !entity.dead) {
      ctx.emit({
        type: 'log',
        text: 'You were removed from the Dungeon Finder queue.',
        color: '#f96',
        pid: e.pid,
      });
    }
    return false;
  });
  for (const dungeonId of DUNGEON_FINDER_DUNGEON_IDS) {
    const pool = ctx.dungeonFinderQueue.filter((e) => e.dungeonId === dungeonId);
    const byRole: Record<Role, DungeonFinderQueueEntry[]> = { tank: [], healer: [], dps: [] };
    for (const e of pool) byRole[e.role].push(e);
    if (
      byRole.tank.length < ROLE_REQUIREMENTS.tank ||
      byRole.healer.length < ROLE_REQUIREMENTS.healer ||
      byRole.dps.length < ROLE_REQUIREMENTS.dps
    ) {
      continue;
    }
    const chosen = [
      byRole.tank[0],
      byRole.healer[0],
      ...byRole.dps.slice(0, ROLE_REQUIREMENTS.dps),
    ];
    const pids = chosen.map((e) => e.pid);
    const chosenSet = new Set(pids);
    ctx.dungeonFinderQueue = ctx.dungeonFinderQueue.filter((e) => !chosenSet.has(e.pid));
    ctx.formPartyFromRoster(pids);
    const dungeonName = DUNGEONS[dungeonId]?.name ?? dungeonId;
    for (const pid of pids) {
      ctx.emit({
        type: 'log',
        text: `Your Dungeon Finder group is ready: ${dungeonName}!`,
        color: '#8f8',
        pid,
      });
    }
    for (const pid of pids) ctx.enterDungeon(dungeonId, pid);
  }
}
