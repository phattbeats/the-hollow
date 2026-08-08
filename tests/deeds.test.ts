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
  onLevelReachedForDeeds,
  onMobKilledForDeeds,
  onPvpWinForDeeds,
  onQuestCompletedForDeeds,
  onSocialActionForDeeds,
  onZoneVisitedForDeeds,
  setActiveTitle,
} from '../src/sim/deeds';
import type { PlayerMeta } from '../src/sim/sim';
import { Sim } from '../src/sim/sim';
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

const LEVEL_DEED: DeedDef = {
  id: 'd_taking_root',
  name: 'Taking Root',
  text: 'Reach level 10.',
  category: 'progression',
  objectives: [{ type: 'level', atLeast: 10, count: 1, label: 'Reach level 10' }],
  titleReward: 't_rooted',
};

describe('deeds: onLevelReachedForDeeds (progression credit)', () => {
  it('credits only once the level threshold is reached, then completes and grants the title', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_taking_root: LEVEL_DEED };

    onLevelReachedForDeeds(ctx, 9, meta, registry); // below threshold
    expect(meta.deedLog.has('d_taking_root')).toBe(false);

    onLevelReachedForDeeds(ctx, 10, meta, registry);
    expect(meta.deedsDone.has('d_taking_root')).toBe(true);
    expect(meta.earnedTitles.has('t_rooted')).toBe(true);
  });

  it('credits a threshold crossed by a multi-level jump (final level at or past atLeast)', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_taking_root: LEVEL_DEED };

    onLevelReachedForDeeds(ctx, 14, meta, registry); // jumped past 10 in one grant
    expect(meta.deedsDone.has('d_taking_root')).toBe(true);
  });

  it('never re-triggers a completed progression deed on later level-ups', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_taking_root: LEVEL_DEED };

    onLevelReachedForDeeds(ctx, 10, meta, registry);
    ctx.events.length = 0;
    onLevelReachedForDeeds(ctx, 11, meta, registry);
    onLevelReachedForDeeds(ctx, 20, meta, registry);
    expect(ctx.events.length).toBe(0);
  });
});

const EXPLORE_DEED: DeedDef = {
  id: 'd_into_the_mire',
  name: 'Into the Mire',
  text: 'Enter Mirefen Marsh.',
  category: 'exploration',
  objectives: [{ type: 'explore', zoneId: 'mirefen_marsh', count: 1, label: 'Mirefen Marsh' }],
  titleReward: 't_wayfarer',
};

const GRAND_TOUR_DEED: DeedDef = {
  id: 'd_grand_tour',
  name: 'Seed on the Wind',
  text: 'Stand in both lands.',
  category: 'exploration',
  objectives: [
    { type: 'explore', zoneId: 'eastbrook_vale', count: 1, label: 'Eastbrook Vale' },
    { type: 'explore', zoneId: 'mirefen_marsh', count: 1, label: 'Mirefen Marsh' },
  ],
};

const WILDCARD_EXPLORE_DEED: DeedDef = {
  id: 'd_first_steps',
  name: 'First Steps',
  text: 'Enter any zone.',
  category: 'exploration',
  objectives: [{ type: 'explore', count: 1, label: 'Zones entered' }],
};

describe('deeds: onZoneVisitedForDeeds (exploration credit)', () => {
  it('ignores a non-matching zone and credits + completes on the matching one', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_into_the_mire: EXPLORE_DEED };

    onZoneVisitedForDeeds(ctx, 'eastbrook_vale', meta, registry); // wrong zone
    expect(meta.deedLog.has('d_into_the_mire')).toBe(false);

    onZoneVisitedForDeeds(ctx, 'mirefen_marsh', meta, registry);
    expect(meta.deedsDone.has('d_into_the_mire')).toBe(true);
    expect(meta.earnedTitles.has('t_wayfarer')).toBe(true);
  });

  it('re-entering an already-credited zone is an idempotent no-op (no re-credit event)', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_into_the_mire: EXPLORE_DEED };

    onZoneVisitedForDeeds(ctx, 'mirefen_marsh', meta, registry);
    ctx.events.length = 0;
    onZoneVisitedForDeeds(ctx, 'mirefen_marsh', meta, registry);
    expect(ctx.events.length).toBe(0);
  });

  it('completes a multi-zone tour only once every distinct zone has been entered', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_grand_tour: GRAND_TOUR_DEED };

    onZoneVisitedForDeeds(ctx, 'eastbrook_vale', meta, registry);
    expect(meta.deedsDone.has('d_grand_tour')).toBe(false);
    // Re-entering the first zone must not credit the second objective.
    onZoneVisitedForDeeds(ctx, 'eastbrook_vale', meta, registry);
    expect(meta.deedsDone.has('d_grand_tour')).toBe(false);

    onZoneVisitedForDeeds(ctx, 'mirefen_marsh', meta, registry);
    expect(meta.deedsDone.has('d_grand_tour')).toBe(true);
  });

  it('a wildcard explore objective credits on the first entry of any zone', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_first_steps: WILDCARD_EXPLORE_DEED };

    onZoneVisitedForDeeds(ctx, 'the_hollow_reaches', meta, registry);
    expect(meta.deedsDone.has('d_first_steps')).toBe(true);
  });
});

const ARENA_WIN_DEED: DeedDef = {
  id: 'd_ranked_wins',
  name: 'Ranked Contender',
  text: 'Win 3 ranked arena bouts.',
  category: 'pvp',
  objectives: [{ type: 'pvp', pvpKind: 'arena', count: 3, label: 'Ranked arena wins' }],
  titleReward: 't_contender',
};

const WILDCARD_PVP_DEED: DeedDef = {
  id: 'd_first_kill',
  name: 'First Kill',
  text: 'Win any pvp bout.',
  category: 'pvp',
  objectives: [{ type: 'pvp', count: 1, label: 'PvP bouts won' }],
};

describe('deeds: onPvpWinForDeeds (pvp credit)', () => {
  it('credits only the matching pvpKind, then completes and grants the title', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_ranked_wins: ARENA_WIN_DEED };

    onPvpWinForDeeds(ctx, 'duel', meta, registry); // non-matching kind
    expect(meta.deedLog.has('d_ranked_wins')).toBe(false);

    onPvpWinForDeeds(ctx, 'arena', meta, registry);
    onPvpWinForDeeds(ctx, 'arena', meta, registry);
    expect(meta.deedsDone.has('d_ranked_wins')).toBe(false);
    onPvpWinForDeeds(ctx, 'arena', meta, registry);
    expect(meta.deedsDone.has('d_ranked_wins')).toBe(true);
    expect(meta.earnedTitles.has('t_contender')).toBe(true);

    ctx.events.length = 0;
    onPvpWinForDeeds(ctx, 'arena', meta, registry);
    expect(ctx.events.length).toBe(0); // a completed deed never re-triggers
  });

  it('credits an objective with no pvpKind on any pvp win (wildcard)', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_first_kill: WILDCARD_PVP_DEED };

    onPvpWinForDeeds(ctx, 'boarball', meta, registry);
    expect(meta.deedsDone.has('d_first_kill')).toBe(true);
  });
});

const FISH_DEED: DeedDef = {
  id: 'd_angler',
  name: 'The Angler',
  text: 'Land 3 catches.',
  category: 'social',
  objectives: [{ type: 'social', socialKind: 'fish', count: 3, label: 'Fish landed' }],
  titleReward: 't_angler',
};

const TALK_DEED: DeedDef = {
  id: 'd_old_friend',
  name: 'An Old Friend',
  text: 'Speak with the Hollow Sage.',
  category: 'social',
  objectives: [
    {
      type: 'social',
      socialKind: 'talk',
      npcId: 'hollow_sage',
      count: 1,
      label: 'Spoke with the Hollow Sage',
    },
  ],
};

const WILDCARD_TALK_DEED: DeedDef = {
  id: 'd_gladhander',
  name: 'Gladhander',
  text: 'Speak with anyone.',
  category: 'social',
  objectives: [{ type: 'social', socialKind: 'talk', count: 1, label: 'NPCs greeted' }],
};

describe('deeds: onSocialActionForDeeds (social credit)', () => {
  it('credits only the matching socialKind, then completes and grants the title', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_angler: FISH_DEED };

    onSocialActionForDeeds(ctx, 'roll', meta, undefined, registry); // non-matching kind
    expect(meta.deedLog.has('d_angler')).toBe(false);

    onSocialActionForDeeds(ctx, 'fish', meta, undefined, registry);
    onSocialActionForDeeds(ctx, 'fish', meta, undefined, registry);
    expect(meta.deedsDone.has('d_angler')).toBe(false);
    onSocialActionForDeeds(ctx, 'fish', meta, undefined, registry);
    expect(meta.deedsDone.has('d_angler')).toBe(true);
    expect(meta.earnedTitles.has('t_angler')).toBe(true);
  });

  it('requires the npcId to match when a talk objective sets one', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_old_friend: TALK_DEED };

    onSocialActionForDeeds(ctx, 'talk', meta, 'some_other_npc', registry);
    expect(meta.deedsDone.has('d_old_friend')).toBe(false);

    onSocialActionForDeeds(ctx, 'talk', meta, 'hollow_sage', registry);
    expect(meta.deedsDone.has('d_old_friend')).toBe(true);
  });

  it('credits a talk objective with no npcId on any NPC (wildcard)', () => {
    const ctx = makeCtx();
    const meta = makeMeta();
    const registry = { d_gladhander: WILDCARD_TALK_DEED };

    onSocialActionForDeeds(ctx, 'talk', meta, 'anyone_at_all', registry);
    expect(meta.deedsDone.has('d_gladhander')).toBe(true);
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

// PHAA-748 (Book of Asphodelia child 5: title cross-surface rendering).
// The IWorldDeeds seam grew two per-pid reads, activeTitleFor(pid) and
// earnedTitlesFor(pid), so render/ui can pull another player's active title
// for the nameplate / unit-frame / chat / inspect / leaderboard surfaces
// without ever reaching into a concrete world. The offline Sim resolves the
// pid through its players map; the online ClientWorld mirrors the local
// player's title on the wire today and returns null / an empty Set for any
// other pid until the wire grows per-entity titles.
describe('deeds: IWorldDeeds per-pid title reads (PHAA-748)', () => {
  function makeMultiSim(): {
    sim: Sim;
    pidSelf: number;
    pidOther: number;
  } {
    const sim = new Sim({ seed: 17, playerClass: 'warrior', noPlayer: true });
    const pidSelf = sim.addPlayer('warrior', 'Self');
    const pidOther = sim.addPlayer('mage', 'Other');
    sim.tick();
    return { sim, pidSelf, pidOther };
  }

  it('offline Sim.activeTitleFor returns the per-player active title', () => {
    const { sim, pidSelf, pidOther } = makeMultiSim();
    // No titles yet: both pids return null.
    expect(sim.activeTitleFor(pidSelf)).toBeNull();
    expect(sim.activeTitleFor(pidOther)).toBeNull();
    // Earn + set a title on self only; other stays null.
    const metaSelf = sim.meta(pidSelf);
    expect(metaSelf).toBeDefined();
    if (!metaSelf) return;
    metaSelf.earnedTitles.add('t_wolfslayer');
    setActiveTitle(metaSelf, 't_wolfslayer');
    expect(sim.activeTitleFor(pidSelf)).toBe('t_wolfslayer');
    expect(sim.activeTitleFor(pidOther)).toBeNull();
    // Clearing it on self restores null.
    setActiveTitle(metaSelf, null);
    expect(sim.activeTitleFor(pidSelf)).toBeNull();
  });

  it('offline Sim.earnedTitlesFor returns the per-player earned-title set', () => {
    const { sim, pidSelf, pidOther } = makeMultiSim();
    const metaSelf = sim.meta(pidSelf);
    const metaOther = sim.meta(pidOther);
    expect(metaSelf).toBeDefined();
    expect(metaOther).toBeDefined();
    if (!metaSelf || !metaOther) return;
    expect(sim.earnedTitlesFor(pidSelf).size).toBe(0);
    expect(sim.earnedTitlesFor(pidOther).size).toBe(0);
    metaSelf.earnedTitles.add('t_wolfslayer');
    metaSelf.earnedTitles.add('t_blooded');
    metaOther.earnedTitles.add('t_blooded');
    expect(sim.earnedTitlesFor(pidSelf)).toEqual(new Set(['t_wolfslayer', 't_blooded']));
    expect(sim.earnedTitlesFor(pidOther)).toEqual(new Set(['t_blooded']));
    // The returned Set is the live PlayerMeta.earnedTitles reference, so
    // adding to it is visible on the next read (the seam returns by-ref).
    sim.earnedTitlesFor(pidSelf).add('t_rooted');
    expect(metaSelf.earnedTitles.has('t_rooted')).toBe(true);
  });

  it('activeTitleFor / earnedTitlesFor return null / empty Set for unknown pids', () => {
    const { sim } = makeMultiSim();
    expect(sim.activeTitleFor(-1)).toBeNull();
    expect(sim.activeTitleFor(999_999)).toBeNull();
    expect(sim.earnedTitlesFor(-1).size).toBe(0);
    expect(sim.earnedTitlesFor(999_999).size).toBe(0);
  });
});
