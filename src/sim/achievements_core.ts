// Achievements engine (PHAA-687): the pure, host-agnostic core that turns a
// stream of in-world accomplishments (a mob killed, a collectible found, a zone
// entered, a quest completed) into unlocked achievements. It sits ALONGSIDE the
// MILESTONES lifetime-XP ladder (src/sim/types.ts MilestoneDef), never folded
// into it: milestones stay the authoritative XP ladder, achievements are the
// net-new discrete-accomplishment subsystem.
//
// This module is deliberately dependency-free game math: no `Sim`, no rng, no
// DOM/Three/render/ui/game/net imports, no `Date.now`/`Math.random`. Unlock
// ordering is a pure function of the tick-ordered signals it is fed, so offline
// Sim, the authoritative server, and the headless RL env all agree, and a
// Vitest can drive it directly (tests/achievements.test.ts). The thin sim
// consumer that feeds it real events lives in src/sim/achievements.ts.
//
// Reuse over forks: achievement progress is server-authoritative persisted state
// (mirrors the PHAA-626 collections core), and collect-category criteria are
// driven by the SAME `collectibleFound` event the collections core already
// emits, so there is exactly one collection-progress path, not two.

// The category an achievement is filed under (drives UI grouping later; the
// panel is a coordinated sibling ticket under PHAA-625). `meta` is reserved for
// cross-cutting achievements (e.g. surfacing a MILESTONES rung as an
// achievement) and grants no combat power: achievements are gameplay-neutral.
export type AchievementCategory = 'kill' | 'collect' | 'explore' | 'quest' | 'meta';

// A single condition. An achievement's `criteria` is an ALL-OF list: the
// achievement unlocks only once every criterion is satisfied. Count-based
// criteria (`kill`, `collectAny`) track a running counter; the rest are
// one-shot (target 1).
export type AchievementCriterion =
  | { kind: 'kill'; mobId: string; count: number }
  | { kind: 'collect'; collectibleId: string } // a specific collectible, once
  | { kind: 'collectAny'; count: number } // any N distinct collectibles
  | { kind: 'explore'; zoneId: string } // first enter of a zone
  | { kind: 'quest'; questId: string }; // complete a quest

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  // ALL-OF: every criterion must be met for the achievement to unlock.
  criteria: AchievementCriterion[];
  // Achievement points, WoW-style; purely cosmetic score, no gameplay effect.
  points: number;
  // Hidden achievements are tracked normally but should not be shown until
  // unlocked (a UI concern; the engine tracks them the same either way).
  hidden?: boolean;
  // Optional title this achievement grants when unlocked. Achievements are a
  // SOURCE of selectable titles (feeds the PHAA-744 title registry); this field
  // names the title id but does NOT define the title here.
  grantsTitleId?: string;
}

// Normalized accomplishment signals the sim feeds the engine. The sim consumer
// (src/sim/achievements.ts) translates real sim transitions (a `death` event
// with a player killer, a `collectibleFound` event, a zone enter, a quest
// turn-in) into these.
export type AchievementSignal =
  | { kind: 'kill'; mobId: string }
  | { kind: 'collect'; collectibleId: string }
  | { kind: 'explore'; zoneId: string }
  | { kind: 'quest'; questId: string };

// Per-character progress. Plain-serializable-friendly (Set/Map mirror the
// PHAA-626 collectedIds shape): `unlocked` only ever grows; `counters` holds a
// per-criterion progress counter keyed by achievement id. Persisted additively
// as JSONB (see CharacterState in src/sim/sim.ts), so pre-achievements saves
// load cleanly.
export interface AchievementProgress {
  unlocked: Set<string>;
  counters: Map<string, number[]>;
}

export function emptyAchievementProgress(): AchievementProgress {
  return { unlocked: new Set(), counters: new Map() };
}

// Precomputed reverse index: a signal maps to the exact (achievement, criterion)
// slots it can advance, so applying a signal is O(matches), never a full scan of
// the registry every kill/collect. Built once from the registry (see
// src/sim/achievements.ts), never per tick.
export interface AchievementIndex {
  byKill: Map<string, Array<[string, number]>>; // mobId -> [achId, criterionIdx][]
  byCollect: Map<string, Array<[string, number]>>; // collectibleId -> ...
  byExplore: Map<string, Array<[string, number]>>; // zoneId -> ...
  byQuest: Map<string, Array<[string, number]>>; // questId -> ...
  collectAny: Array<[string, number]>; // criteria that respond to ANY collect
  defsById: Map<string, AchievementDef>;
}

function push(map: Map<string, Array<[string, number]>>, key: string, entry: [string, number]) {
  const list = map.get(key);
  if (list) list.push(entry);
  else map.set(key, [entry]);
}

export function buildAchievementIndex(defs: readonly AchievementDef[]): AchievementIndex {
  const index: AchievementIndex = {
    byKill: new Map(),
    byCollect: new Map(),
    byExplore: new Map(),
    byQuest: new Map(),
    collectAny: [],
    defsById: new Map(),
  };
  for (const def of defs) {
    index.defsById.set(def.id, def);
    def.criteria.forEach((c, ci) => {
      switch (c.kind) {
        case 'kill':
          push(index.byKill, c.mobId, [def.id, ci]);
          break;
        case 'collect':
          push(index.byCollect, c.collectibleId, [def.id, ci]);
          break;
        case 'collectAny':
          index.collectAny.push([def.id, ci]);
          break;
        case 'explore':
          push(index.byExplore, c.zoneId, [def.id, ci]);
          break;
        case 'quest':
          push(index.byQuest, c.questId, [def.id, ci]);
          break;
      }
    });
  }
  return index;
}

// The target count for a criterion: count-based kinds carry their own target,
// one-shot kinds are complete at 1.
function criterionTarget(c: AchievementCriterion): number {
  return c.kind === 'kill' || c.kind === 'collectAny' ? c.count : 1;
}

function affected(index: AchievementIndex, signal: AchievementSignal): Array<[string, number]> {
  switch (signal.kind) {
    case 'kill':
      return index.byKill.get(signal.mobId) ?? [];
    case 'collect': {
      const specific = index.byCollect.get(signal.collectibleId) ?? [];
      // A collect signal advances both the specific-collectible criteria and
      // every "any N collectibles" criterion.
      return index.collectAny.length ? [...specific, ...index.collectAny] : specific;
    }
    case 'explore':
      return index.byExplore.get(signal.zoneId) ?? [];
    case 'quest':
      return index.byQuest.get(signal.questId) ?? [];
  }
}

// Apply one accomplishment signal. Increments the matching criterion counters
// (capped at their target), then unlocks any achievement whose criteria are now
// ALL met and was not already unlocked. Returns the ids newly unlocked by THIS
// signal, in stable registry order, so the caller can emit one event / grant one
// title per new unlock. Idempotent: a signal for an already-complete criterion
// is inert, and an already-unlocked achievement is never re-returned.
export function applyAchievementSignal(
  index: AchievementIndex,
  progress: AchievementProgress,
  signal: AchievementSignal,
): string[] {
  const slots = affected(index, signal);
  if (slots.length === 0) return [];
  const touched = new Set<string>();
  for (const [achId, ci] of slots) {
    if (progress.unlocked.has(achId)) continue; // already done: ignore
    const def = index.defsById.get(achId);
    if (!def) continue;
    let counters = progress.counters.get(achId);
    if (!counters) {
      counters = new Array(def.criteria.length).fill(0);
      progress.counters.set(achId, counters);
    }
    const target = criterionTarget(def.criteria[ci]);
    if (counters[ci] < target) counters[ci] += 1;
    touched.add(achId);
  }
  if (touched.size === 0) return [];
  // Re-check touched achievements in registry order for stable unlock ordering.
  const newlyUnlocked: string[] = [];
  for (const [achId, def] of index.defsById) {
    if (!touched.has(achId) || progress.unlocked.has(achId)) continue;
    const counters = progress.counters.get(achId);
    if (!counters) continue;
    const complete = def.criteria.every((c, ci) => counters[ci] >= criterionTarget(c));
    if (complete) {
      progress.unlocked.add(achId);
      newlyUnlocked.push(achId);
    }
  }
  return newlyUnlocked;
}

// Sum of achievement points the character has unlocked (the WoW-style score).
// Unknown ids (a save referencing a since-removed achievement) contribute 0.
export function achievementPoints(index: AchievementIndex, unlocked: Iterable<string>): number {
  let total = 0;
  for (const id of unlocked) total += index.defsById.get(id)?.points ?? 0;
  return total;
}
