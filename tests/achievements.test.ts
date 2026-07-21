// Achievements (PHAA-687): two layers under test.
//   1. The pure engine (src/sim/achievements_core.ts): criteria matching,
//      all-of completion, count-based progress, idempotency, points. Driven
//      directly with synthetic defs, no Sim needed.
//   2. The sim wiring (src/sim/achievements.ts + collections hook): reading a
//      real collectible unlocks a collect-category achievement, emits one
//      achievementUnlocked event, and persists additively across a save/load.

import { beforeEach, describe, expect, it } from 'vitest';
import {
  type AchievementDef,
  type AchievementSignal,
  achievementPoints,
  applyAchievementSignal,
  buildAchievementIndex,
  emptyAchievementProgress,
} from '../src/sim/achievements_core';
import { READABLES } from '../src/sim/data';
import { Sim } from '../src/sim/sim';

// Synthetic registry exercising every criterion kind + an all-of achievement.
const DEFS: AchievementDef[] = [
  {
    id: 'a_kill3',
    category: 'kill',
    criteria: [{ kind: 'kill', mobId: 'wolf', count: 3 }],
    points: 10,
  },
  {
    id: 'a_collect1',
    category: 'collect',
    criteria: [{ kind: 'collectAny', count: 1 }],
    points: 5,
  },
  {
    id: 'a_collect_both',
    category: 'collect',
    criteria: [
      { kind: 'collect', collectibleId: 'book_a' },
      { kind: 'collect', collectibleId: 'book_b' },
    ],
    points: 20,
  },
  {
    id: 'a_explore',
    category: 'explore',
    criteria: [{ kind: 'explore', zoneId: 'zone1' }],
    points: 5,
  },
  { id: 'a_quest', category: 'quest', criteria: [{ kind: 'quest', questId: 'q1' }], points: 5 },
];

function run(signals: AchievementSignal[]) {
  const index = buildAchievementIndex(DEFS);
  const progress = emptyAchievementProgress();
  const unlocked: string[] = [];
  for (const s of signals) unlocked.push(...applyAchievementSignal(index, progress, s));
  return { index, progress, unlocked };
}

describe('achievements engine (PHAA-687)', () => {
  it('unlocks a one-shot collect achievement on the first matching signal', () => {
    const { unlocked, progress } = run([{ kind: 'collect', collectibleId: 'book_a' }]);
    expect(unlocked).toContain('a_collect1');
    expect(progress.unlocked.has('a_collect1')).toBe(true);
  });

  it('requires the full count before a count-based criterion unlocks', () => {
    const two = run([
      { kind: 'kill', mobId: 'wolf' },
      { kind: 'kill', mobId: 'wolf' },
    ]);
    expect(two.unlocked).not.toContain('a_kill3');
    const three = run([
      { kind: 'kill', mobId: 'wolf' },
      { kind: 'kill', mobId: 'wolf' },
      { kind: 'kill', mobId: 'wolf' },
    ]);
    expect(three.unlocked).toContain('a_kill3');
  });

  it('an all-of achievement unlocks only once every criterion is met', () => {
    const partial = run([{ kind: 'collect', collectibleId: 'book_a' }]);
    expect(partial.unlocked).not.toContain('a_collect_both');
    const full = run([
      { kind: 'collect', collectibleId: 'book_a' },
      { kind: 'collect', collectibleId: 'book_b' },
    ]);
    expect(full.unlocked).toContain('a_collect_both');
  });

  it('unlocks are idempotent: an already-unlocked achievement never re-fires', () => {
    const index = buildAchievementIndex(DEFS);
    const progress = emptyAchievementProgress();
    const first = applyAchievementSignal(index, progress, { kind: 'explore', zoneId: 'zone1' });
    const second = applyAchievementSignal(index, progress, { kind: 'explore', zoneId: 'zone1' });
    expect(first).toContain('a_explore');
    expect(second).toEqual([]);
  });

  it('a signal no achievement references is inert', () => {
    const { unlocked, progress } = run([{ kind: 'kill', mobId: 'nonexistent_mob' }]);
    expect(unlocked).toEqual([]);
    expect(progress.counters.size).toBe(0);
  });

  it('a single collect advances both the specific and the any-N criteria', () => {
    // book_a satisfies a_collect1 (any 1) AND advances a_collect_both's first arm.
    const { unlocked } = run([{ kind: 'collect', collectibleId: 'book_a' }]);
    expect(unlocked).toEqual(['a_collect1']); // only the fully-met one unlocks
  });

  it('pads a short persisted counters array when criteria grow (forward-compat)', () => {
    // Simulate a save from before a_collect_both gained its second criterion:
    // its counters array has length 1 (only the first arm) and book_a is done.
    const index = buildAchievementIndex(DEFS);
    const progress = emptyAchievementProgress();
    progress.counters.set('a_collect_both', [1]);
    // The now-second criterion must still be able to advance and complete.
    const unlocked = applyAchievementSignal(index, progress, {
      kind: 'collect',
      collectibleId: 'book_b',
    });
    expect(unlocked).toContain('a_collect_both');
    expect(progress.counters.get('a_collect_both')).toEqual([1, 1]);
  });

  it('sums achievement points over the unlocked set (unknown ids contribute 0)', () => {
    const index = buildAchievementIndex(DEFS);
    expect(achievementPoints(index, ['a_kill3', 'a_collect_both'])).toBe(30);
    expect(achievementPoints(index, ['a_kill3', 'ghost'])).toBe(10);
  });
});

describe('achievements sim wiring (PHAA-687)', () => {
  const BOOK_A = READABLES.find((r) => r.id === 'torn_ledger_page')!;
  const BOOK_B = READABLES.find((r) => r.id === 'keepers_marginalia')!;

  let sim: Sim;
  let pid: number;

  function moveTo(p: { x: number; z: number }) {
    const e = sim.entities.get(pid)!;
    e.pos = { x: p.x, y: 0, z: p.z };
    e.prevPos = { ...e.pos };
  }

  beforeEach(() => {
    sim = new Sim({ seed: 11, playerClass: 'warrior', noPlayer: true });
    pid = sim.addPlayer('warrior', 'Achiever');
  });

  it('reading a collectible unlocks first_pages and emits exactly one achievementUnlocked event', () => {
    moveTo(BOOK_A.pos);
    sim.drainEvents(); // clear join/setup events
    sim.readCollectible(BOOK_A.id, pid);
    expect(sim.unlockedAchievementsFor(pid)).toContain('first_pages');
    const unlocks = sim.drainEvents().filter((e) => e.type === 'achievementUnlocked') as Array<{
      type: 'achievementUnlocked';
      achievementId: string;
      pid?: number;
    }>;
    expect(unlocks.map((e) => e.achievementId)).toEqual(['first_pages']);
    expect(unlocks[0].pid).toBe(pid);
  });

  it('reading both placed field books unlocks hollow_archivist and totals its points', () => {
    moveTo(BOOK_A.pos);
    sim.readCollectible(BOOK_A.id, pid);
    moveTo(BOOK_B.pos);
    sim.readCollectible(BOOK_B.id, pid);
    const unlocked = sim.unlockedAchievementsFor(pid);
    expect(unlocked).toContain('first_pages');
    expect(unlocked).toContain('hollow_archivist');
    // first_pages (5) + hollow_archivist (10) via the IWorld point accessor.
    expect(sim.achievementPoints).toBe(15);
  });

  it('re-reading an already-collected book does not re-fire an achievement', () => {
    moveTo(BOOK_A.pos);
    sim.readCollectible(BOOK_A.id, pid);
    sim.drainEvents();
    sim.readCollectible(BOOK_A.id, pid); // inert re-read (PHAA-626)
    const unlocks = sim.drainEvents().filter((e) => e.type === 'achievementUnlocked');
    expect(unlocks).toEqual([]);
  });

  it('persists unlocked achievements + counters across serialize -> addPlayer (additive, back-compat)', () => {
    moveTo(BOOK_A.pos);
    sim.readCollectible(BOOK_A.id, pid);
    const state = sim.serializeCharacter(pid)!;
    expect(state.unlockedAchievements).toContain('first_pages');

    const sim2 = new Sim({ seed: 11, playerClass: 'warrior', noPlayer: true });
    const pid2 = sim2.addPlayer('warrior', 'Achiever', { state });
    expect(sim2.unlockedAchievementsFor(pid2)).toContain('first_pages');

    // pre-PHAA-687 saves carry neither field: back-compat default empty.
    const legacyState = {
      ...state,
      unlockedAchievements: undefined,
      achievementCounters: undefined,
    };
    const sim3 = new Sim({ seed: 11, playerClass: 'warrior', noPlayer: true });
    const pid3 = sim3.addPlayer('warrior', 'Legacy', { state: legacyState });
    expect(sim3.unlockedAchievementsFor(pid3)).toEqual([]);
  });
});
