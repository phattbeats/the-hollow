// Direct unit tests for the Book of Asphodelia deed engine (src/sim/deeds.ts,
// PHAA-744). DEEDS ships empty in this child (content lands later), so these
// tests inject synthetic DeedDef fixtures directly into the real (mutable)
// DEEDS record, exercised against a minimal fake SimContext, mirroring
// tests/quest_credit.test.ts's approach for the analogous quest-credit trio.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEEDS } from '../src/sim/data';
import {
  checkDeedComplete,
  onInventoryChangedForDeeds,
  onMobKilledForDeeds,
} from '../src/sim/deeds';
import type { PlayerMeta } from '../src/sim/sim';
import type { SimContext } from '../src/sim/sim_context';
import type { DeedDef, DeedProgress, Entity, SimEvent } from '../src/sim/types';

type FakeCtx = SimContext & { events: SimEvent[] };

function makeCtx(itemCount: () => number = () => 0): FakeCtx {
  const events: SimEvent[] = [];
  return {
    events,
    emit: (ev: SimEvent) => {
      events.push(ev);
    },
    countItem: (_itemId: string, _pid?: number) => itemCount(),
  } as unknown as FakeCtx;
}

function makeMeta(entityId = 1): PlayerMeta {
  return {
    entityId,
    deedLog: new Map<string, DeedProgress>(),
    deedsDone: new Set<string>(),
    earnedTitles: new Set<string>(),
  } as unknown as PlayerMeta;
}

const event = (events: SimEvent[], type: string): Record<string, unknown>[] =>
  events.filter((e) => e.type === type) as unknown as Record<string, unknown>[];

const KILL_DEED_ID = 'test_deed_kill_wolves';
const COLLECT_DEED_ID = 'test_deed_collect_hides';

const KILL_DEED: DeedDef = {
  id: KILL_DEED_ID,
  name: 'Test Kill Deed',
  category: 'test',
  objectives: [
    { type: 'kill', targetMobId: 'forest_wolf', count: 3, label: 'Forest wolves slain' },
  ],
  titleReward: 'test_title_wolfsbane',
};

const COLLECT_DEED: DeedDef = {
  id: COLLECT_DEED_ID,
  name: 'Test Collect Deed',
  category: 'test',
  objectives: [{ type: 'collect', itemId: 'boar_hide', count: 2, label: 'Boar hides collected' }],
};

beforeEach(() => {
  DEEDS[KILL_DEED_ID] = KILL_DEED;
  DEEDS[COLLECT_DEED_ID] = COLLECT_DEED;
});

afterEach(() => {
  delete DEEDS[KILL_DEED_ID];
  delete DEEDS[COLLECT_DEED_ID];
});

describe('deeds: onMobKilledForDeeds (kill credit)', () => {
  it('lazily creates progress, increments per matching kill, and completes + grants the title at the target', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const wolf = { templateId: 'forest_wolf' } as unknown as Entity;
    const boar = { templateId: 'forest_boar' } as unknown as Entity;

    // no progress entry exists until the first relevant credit (no accept step)
    expect(meta.deedLog.has(KILL_DEED_ID)).toBe(false);

    // a non-matching kill credits nothing and creates no entry
    onMobKilledForDeeds(ctx, boar, meta);
    expect(meta.deedLog.has(KILL_DEED_ID)).toBe(false);

    onMobKilledForDeeds(ctx, wolf, meta);
    expect(meta.deedLog.get(KILL_DEED_ID)?.counts).toEqual([1]);

    onMobKilledForDeeds(ctx, wolf, meta);
    expect(meta.deedLog.get(KILL_DEED_ID)?.counts).toEqual([2]);
    expect(meta.deedsDone.has(KILL_DEED_ID)).toBe(false);

    onMobKilledForDeeds(ctx, wolf, meta);
    // completion removes the log entry, marks done, and grants the title
    expect(meta.deedLog.has(KILL_DEED_ID)).toBe(false);
    expect(meta.deedsDone.has(KILL_DEED_ID)).toBe(true);
    expect(meta.earnedTitles.has('test_title_wolfsbane')).toBe(true);
    expect(event(ctx.events, 'deedCompleted').some((e) => e.deedId === KILL_DEED_ID)).toBe(true);
    expect(event(ctx.events, 'titleEarned').some((e) => e.titleId === 'test_title_wolfsbane')).toBe(
      true,
    );

    // a completed deed never re-tracks (no re-creation of the log entry, no re-grant)
    onMobKilledForDeeds(ctx, wolf, meta);
    expect(meta.deedLog.has(KILL_DEED_ID)).toBe(false);
    expect(event(ctx.events, 'deedCompleted').length).toBe(1);
  });
});

describe('deeds: onInventoryChangedForDeeds (collect credit)', () => {
  it('tracks countItem up to the target and completes with no title when titleReward is absent', () => {
    let held = 0;
    const ctx = makeCtx(() => held);
    const meta = makeMeta();

    held = 1;
    onInventoryChangedForDeeds(ctx, meta);
    expect(meta.deedLog.get(COLLECT_DEED_ID)?.counts).toEqual([1]);
    expect(meta.deedsDone.has(COLLECT_DEED_ID)).toBe(false);

    held = 2;
    onInventoryChangedForDeeds(ctx, meta);
    expect(meta.deedLog.has(COLLECT_DEED_ID)).toBe(false);
    expect(meta.deedsDone.has(COLLECT_DEED_ID)).toBe(true);
    expect(event(ctx.events, 'deedCompleted').some((e) => e.deedId === COLLECT_DEED_ID)).toBe(true);
    expect(event(ctx.events, 'titleEarned').length).toBe(0);
  });

  it('clamps have to the objective count', () => {
    let held = 0;
    const ctx = makeCtx(() => held);
    const meta = makeMeta();

    held = 50;
    onInventoryChangedForDeeds(ctx, meta);
    expect(meta.deedsDone.has(COLLECT_DEED_ID)).toBe(true);
  });
});

describe('deeds: checkDeedComplete', () => {
  it('is a no-op while any objective is short', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const dp: DeedProgress = { deedId: KILL_DEED_ID, counts: [1] };
    meta.deedLog.set(KILL_DEED_ID, dp);

    checkDeedComplete(ctx, KILL_DEED, dp, meta);
    expect(meta.deedLog.has(KILL_DEED_ID)).toBe(true);
    expect(meta.deedsDone.has(KILL_DEED_ID)).toBe(false);
    expect(ctx.events.length).toBe(0);
  });
});
