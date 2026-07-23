// Direct unit tests for the Book of Asphodelia deed-credit engine
// (src/sim/deeds.ts, PHAA-744). The engine draws no rng and mutates the live
// PlayerMeta.deedLog/deedsDone/earnedTitles/activeTitle in place. DEEDS ships empty
// this child (content lands in PHAA-745), so every credit function takes its
// registry as a default-valued parameter: production call sites read the real
// (empty) DEEDS table while these tests inject synthetic DeedDefs to exercise the
// real credit/completion/title-grant math.

import { describe, expect, it } from 'vitest';
import {
  onDelveClearedForDeeds,
  onInventoryChangedForDeeds,
  onMobKilledForDeeds,
  onQuestCompletedForDeeds,
  setActiveTitle,
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
    activeTitle: null,
  } as unknown as PlayerMeta;
}

const event = (events: SimEvent[], type: string): Record<string, unknown>[] =>
  events.filter((e) => e.type === type) as unknown as Record<string, unknown>[];

const KILL_DEED: DeedDef = {
  id: 'd_wolves',
  name: 'Wolf Slayer',
  text: 'Kill 3 forest wolves.',
  category: 'combat',
  objectives: [
    { type: 'kill', targetMobId: 'forest_wolf', count: 3, label: 'Forest wolves slain' },
  ],
  titleReward: 't_wolfslayer',
};

const COLLECT_DEED: DeedDef = {
  id: 'd_hides',
  name: 'Hide Collector',
  text: 'Collect 5 boar hides.',
  category: 'collection',
  objectives: [{ type: 'collect', itemId: 'boar_hide', count: 5, label: 'Boar hides collected' }],
};

const WILDCARD_KILL_DEED: DeedDef = {
  id: 'd_first_blood',
  name: 'First Blood',
  text: 'Defeat any enemy.',
  category: 'combat',
  objectives: [{ type: 'kill', count: 1, label: 'Enemies defeated' }],
  titleReward: 't_blooded',
};

describe('deeds: onMobKilledForDeeds (kill credit)', () => {
  it('auto-tracks without an accept step, credits matching kills, and grants the title on completion', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const wolf = { templateId: 'forest_wolf' } as unknown as Entity;
    const boar = { templateId: 'forest_boar' } as unknown as Entity;
    const registry = { d_wolves: KILL_DEED };

    // no accept step: crediting starts on the very first matching kill
    expect(meta.deedLog.has('d_wolves')).toBe(false);
    onMobKilledForDeeds(ctx, boar, meta, registry);
    expect(meta.deedLog.has('d_wolves')).toBe(false); // non-matching mob creates nothing

    onMobKilledForDeeds(ctx, wolf, meta, registry);
    expect(meta.deedLog.get('d_wolves')?.counts).toEqual([1]);
    onMobKilledForDeeds(ctx, wolf, meta, registry);
    onMobKilledForDeeds(ctx, wolf, meta, registry);

    expect(event(ctx.events, 'deedProgress').length).toBe(3);
    expect(event(ctx.events, 'deedProgress').at(-1)?.text).toBe('Forest wolves slain: 3/3');
    expect(meta.deedsDone.has('d_wolves')).toBe(true);
    expect(meta.deedLog.get('d_wolves')?.state).toBe('done');
    expect(event(ctx.events, 'deedDone').some((e) => e.deedId === 'd_wolves')).toBe(true);
    expect(meta.earnedTitles.has('t_wolfslayer')).toBe(true);
    expect(event(ctx.events, 'titleEarned').some((e) => e.titleId === 't_wolfslayer')).toBe(true);

    // a completed deed never over-credits or re-grants the title
    ctx.events.length = 0;
    onMobKilledForDeeds(ctx, wolf, meta, registry);
    expect(meta.deedLog.get('d_wolves')?.counts).toEqual([3]);
    expect(ctx.events.length).toBe(0);
  });

  it('credits an objective with no targetMobId on any kill (wildcard)', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const wolf = { templateId: 'forest_wolf' } as unknown as Entity;
    const boar = { templateId: 'forest_boar' } as unknown as Entity;
    const registry = { d_first_blood: WILDCARD_KILL_DEED };

    onMobKilledForDeeds(ctx, boar, meta, registry);
    expect(meta.deedsDone.has('d_first_blood')).toBe(true);
    expect(meta.earnedTitles.has('t_blooded')).toBe(true);

    // already done: a second kill of a different mob does not re-trigger anything
    ctx.events.length = 0;
    onMobKilledForDeeds(ctx, wolf, meta, registry);
    expect(ctx.events.length).toBe(0);
  });
});

const QUEST_DEED: DeedDef = {
  id: 'd_hearth',
  name: 'Hearthbound',
  text: "Complete 'A Hearth of Your Own'.",
  category: 'chronicle',
  objectives: [{ type: 'quest', questId: 'q_your_own_hearth', count: 1, label: 'Hearth quest' }],
  titleReward: 't_hearthbound',
};

const WILDCARD_QUEST_DEED: DeedDef = {
  id: 'd_chronicler',
  name: 'The Chronicler',
  text: 'Complete 3 quests.',
  category: 'chronicle',
  objectives: [{ type: 'quest', count: 3, label: 'Quests completed' }],
};

describe('deeds: onQuestCompletedForDeeds (quest credit)', () => {
  it('auto-tracks without an accept step and credits only the matching questId', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_hearth: QUEST_DEED };

    onQuestCompletedForDeeds(ctx, 'q_wolves', meta, registry);
    expect(meta.deedLog.has('d_hearth')).toBe(false); // non-matching quest creates nothing

    onQuestCompletedForDeeds(ctx, 'q_your_own_hearth', meta, registry);
    expect(meta.deedsDone.has('d_hearth')).toBe(true);
    expect(meta.earnedTitles.has('t_hearthbound')).toBe(true);
    expect(event(ctx.events, 'deedDone').some((e) => e.deedId === 'd_hearth')).toBe(true);

    // a completed deed never re-triggers
    ctx.events.length = 0;
    onQuestCompletedForDeeds(ctx, 'q_your_own_hearth', meta, registry);
    expect(ctx.events.length).toBe(0);
  });

  it('credits an objective with no questId on any quest completion (wildcard)', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_chronicler: WILDCARD_QUEST_DEED };

    onQuestCompletedForDeeds(ctx, 'q_wolves', meta, registry);
    onQuestCompletedForDeeds(ctx, 'q_boars', meta, registry);
    expect(meta.deedsDone.has('d_chronicler')).toBe(false);
    expect(meta.deedLog.get('d_chronicler')?.counts).toEqual([2]);

    onQuestCompletedForDeeds(ctx, 'q_spiders', meta, registry);
    expect(meta.deedsDone.has('d_chronicler')).toBe(true);
  });
});

const DELVE_DEED: DeedDef = {
  id: 'd_reliquary',
  name: 'First Descent',
  text: 'Clear the Collapsed Reliquary.',
  category: 'delve',
  objectives: [
    {
      type: 'delve',
      delveId: 'collapsed_reliquary',
      count: 1,
      label: 'Collapsed Reliquary cleared',
    },
  ],
  titleReward: 't_reliquary_cleared',
};

const HEROIC_DEATHLESS_DEED: DeedDef = {
  id: 'd_flawless_vigil',
  name: 'Flawless Vigil',
  text: 'Clear the Collapsed Reliquary on Heroic without dying.',
  category: 'delve',
  objectives: [
    {
      type: 'delve',
      delveId: 'collapsed_reliquary',
      tierId: 'heroic',
      deathless: true,
      count: 1,
      label: 'Deathless Heroic clear',
    },
  ],
};

const WILDCARD_DELVE_DEED: DeedDef = {
  id: 'd_delver',
  name: 'The Delver',
  text: 'Clear 3 delves.',
  category: 'delve',
  objectives: [{ type: 'delve', count: 3, label: 'Delves cleared' }],
};

describe('deeds: onDelveClearedForDeeds (delve credit)', () => {
  it('auto-tracks without an accept step and credits only the matching delveId', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_reliquary: DELVE_DEED };

    onDelveClearedForDeeds(ctx, 'other_delve', 'normal', false, meta, registry);
    expect(meta.deedLog.has('d_reliquary')).toBe(false); // non-matching delve creates nothing

    onDelveClearedForDeeds(ctx, 'collapsed_reliquary', 'normal', false, meta, registry);
    expect(meta.deedsDone.has('d_reliquary')).toBe(true);
    expect(meta.earnedTitles.has('t_reliquary_cleared')).toBe(true);

    // a completed deed never re-triggers
    ctx.events.length = 0;
    onDelveClearedForDeeds(ctx, 'collapsed_reliquary', 'normal', false, meta, registry);
    expect(ctx.events.length).toBe(0);
  });

  it('requires the tierId and deathless flag to both match when the objective sets them', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_flawless_vigil: HEROIC_DEATHLESS_DEED };

    onDelveClearedForDeeds(ctx, 'collapsed_reliquary', 'normal', true, meta, registry); // wrong tier
    onDelveClearedForDeeds(ctx, 'collapsed_reliquary', 'heroic', false, meta, registry); // died
    expect(meta.deedsDone.has('d_flawless_vigil')).toBe(false);

    onDelveClearedForDeeds(ctx, 'collapsed_reliquary', 'heroic', true, meta, registry);
    expect(meta.deedsDone.has('d_flawless_vigil')).toBe(true);
  });

  it('credits an objective with no delveId on any delve clear (wildcard)', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_delver: WILDCARD_DELVE_DEED };

    onDelveClearedForDeeds(ctx, 'collapsed_reliquary', 'normal', false, meta, registry);
    onDelveClearedForDeeds(ctx, 'collapsed_reliquary', 'heroic', true, meta, registry);
    expect(meta.deedsDone.has('d_delver')).toBe(false);
    expect(meta.deedLog.get('d_delver')?.counts).toEqual([2]);

    onDelveClearedForDeeds(ctx, 'other_delve', 'normal', false, meta, registry);
    expect(meta.deedsDone.has('d_delver')).toBe(true);
  });
});

describe('deeds: onInventoryChangedForDeeds (collect credit)', () => {
  it('tracks countItem up to the target and completes without a title reward', () => {
    let held = 0;
    const ctx = makeCtx(() => held);
    const meta = makeMeta();
    const registry = { d_hides: COLLECT_DEED };

    for (let i = 1; i <= 5; i++) {
      held = i;
      onInventoryChangedForDeeds(ctx, meta, registry);
      expect(meta.deedLog.get('d_hides')?.counts).toEqual([i]);
    }
    expect(meta.deedsDone.has('d_hides')).toBe(true);
    expect(meta.earnedTitles.size).toBe(0); // COLLECT_DEED has no titleReward

    // losing items after completion does not reopen a done deed
    ctx.events.length = 0;
    held = 0;
    onInventoryChangedForDeeds(ctx, meta, registry);
    expect(meta.deedLog.get('d_hides')?.counts).toEqual([5]);
    expect(ctx.events.length).toBe(0);
  });
});

describe('deeds: setActiveTitle', () => {
  it('only accepts an earned title, and null always clears it', () => {
    const meta = makeMeta();
    setActiveTitle(meta, 't_wolfslayer');
    expect(meta.activeTitle).toBeNull(); // not earned yet: silent no-op

    meta.earnedTitles.add('t_wolfslayer');
    setActiveTitle(meta, 't_wolfslayer');
    expect(meta.activeTitle).toBe('t_wolfslayer');

    setActiveTitle(meta, null);
    expect(meta.activeTitle).toBeNull();
  });
});
