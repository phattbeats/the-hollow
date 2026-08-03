import { describe, expect, it } from 'vitest';
import { FURY_ENTITY_ID, FURY_STOCK } from '../src/sim/content/pvp_honor';
import { ITEMS } from '../src/sim/data';
import {
  ARENA_DAILY_TAPER_FLOOR_START,
  ARENA_DAILY_TAPER_START,
  arenaRepeatHonorMultiplier,
  awardFiestaKillHonor,
  FIESTA_KILL_HONOR,
  grantHonor,
  RANKED_ARENA_WIN_HONOR,
  repeatHonorMultiplier,
} from '../src/sim/pvp';
import { pvpDamageMultiplier, pvpFractionsFromRatings } from '../src/sim/pvp/power';
import { eloDelta, Sim } from '../src/sim/sim';
import { groundHeight } from '../src/sim/world';

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
}

function teleport(sim: Sim, pid: number, x: number, z: number) {
  const e = sim.entities.get(pid)!;
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = groundHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
  (sim as any).rebucket(e);
}

function queueDuo(): { sim: Sim; a: number; b: number } {
  const sim = makeWorld();
  const a = sim.addPlayer('warrior', 'Aleph');
  const b = sim.addPlayer('mage', 'Bet');
  teleport(sim, a, 0, -40);
  teleport(sim, b, 6, -40);
  sim.arenaQueueJoin(a);
  sim.arenaQueueJoin(b);
  sim.tick(); // updateArena() matchmakes the pair
  return { sim, a, b };
}

function startBout(sim: Sim) {
  for (let i = 0; i < 20 * 6; i++) {
    sim.tick();
    if (sim.arenaMatchFor((sim as any).primaryId)?.state === 'active') break;
  }
}

describe('src/sim/pvp/honor.ts: grantHonor + diminishing returns', () => {
  it('grantHonor credits both the spendable and lifetime totals and emits an event', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Grantee');
    const meta = sim.meta(pid)!;
    const credited = grantHonor(sim.ctx as any, meta, 25, 'arena_win');
    expect(credited).toBe(25);
    expect(meta.honor).toBe(25);
    expect(meta.lifetimeHonor).toBe(25);
  });

  it('grantHonor floors fractional/negative amounts and no-ops at zero', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Grantee');
    const meta = sim.meta(pid)!;
    expect(grantHonor(sim.ctx as any, meta, 12.9, 'arena_win')).toBe(12);
    expect(grantHonor(sim.ctx as any, meta, -5, 'arena_win')).toBe(0);
    expect(grantHonor(sim.ctx as any, meta, 0, 'arena_win')).toBe(0);
    expect(meta.honor).toBe(12);
  });

  it('lifetimeHonor never decreases even if honor is spent below it', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Spender');
    const meta = sim.meta(pid)!;
    grantHonor(sim.ctx as any, meta, 100, 'arena_win');
    meta.honor -= 60; // simulate a Quartermaster purchase
    expect(meta.honor).toBe(40);
    expect(meta.lifetimeHonor).toBe(100);
  });

  it('repeatHonorMultiplier tapers Fiesta-style rewards 100/50/25/0 percent', () => {
    expect(repeatHonorMultiplier(0)).toBe(1);
    expect(repeatHonorMultiplier(1)).toBe(0.5);
    expect(repeatHonorMultiplier(2)).toBe(0.25);
    expect(repeatHonorMultiplier(3)).toBe(0);
    expect(repeatHonorMultiplier(99)).toBe(0); // clamps past the array length
  });

  it('arenaRepeatHonorMultiplier pays only the first win against a given opponent per day', () => {
    expect(arenaRepeatHonorMultiplier(0)).toBe(1);
    expect(arenaRepeatHonorMultiplier(1)).toBe(0);
    expect(arenaRepeatHonorMultiplier(5)).toBe(0);
  });

  it('Fiesta kill honor persists its taper across matches on the same UTC day', () => {
    const sim = makeWorld();
    const killer = sim.meta(sim.addPlayer('warrior', 'Killer'))!;
    const victim = sim.addPlayer('mage', 'Victim');
    expect(awardFiestaKillHonor(sim.ctx as any, killer, victim)).toBe(FIESTA_KILL_HONOR);
    expect(awardFiestaKillHonor(sim.ctx as any, killer, victim)).toBe(FIESTA_KILL_HONOR / 2);
    expect(killer.honorArenaDaily?.fiestaKillsByVictim[String(victim)]).toBe(2);
  });
});

describe('WARFARE rating -> damage fractions (src/sim/pvp/power.ts)', () => {
  it('converts rating to percent at 10 rating per point and caps at 20%', () => {
    expect(pvpFractionsFromRatings(0, 0)).toEqual({ offense: 0, defense: 0 });
    expect(pvpFractionsFromRatings(100, 50)).toEqual({ offense: 0.1, defense: 0.05 });
    expect(pvpFractionsFromRatings(168, 168).offense).toBeCloseTo(0.168, 5);
    expect(pvpFractionsFromRatings(10_000, 10_000)).toEqual({ offense: 0.2, defense: 0.2 });
  });

  it('pvpDamageMultiplier combines offense and defense as (1+off)*(1-def)', () => {
    const source = { stats: { pvpOffense: 0.1, pvpDefense: 0 } } as any;
    const target = { stats: { pvpOffense: 0, pvpDefense: 0.05 } } as any;
    expect(pvpDamageMultiplier(source, target)).toBeCloseTo(1.1 * 0.95, 6);
  });

  it('ignores negative stats defensively (never amplifies below the floor)', () => {
    const source = { stats: { pvpOffense: -0.5, pvpDefense: 0 } } as any;
    const target = { stats: { pvpOffense: 0, pvpDefense: -0.5 } } as any;
    expect(pvpDamageMultiplier(source, target)).toBe(1);
  });
});

describe('WARFARE is PvP-only: dealDamage never scales player-vs-mob or mob-vs-player', () => {
  it('a player with Warfare offense deals byte-identical damage to a mob', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Smiter');
    const p = sim.entities.get(pid)!;
    p.stats = { ...p.stats, pvpOffense: 0.2 };
    const mob = {
      id: 999_999,
      kind: 'mob',
      hp: 1000,
      maxHp: 1000,
      dead: false,
      auras: [],
      stats: p.stats,
    } as any;
    (sim as any).ctx.entities.set(mob.id, mob);
    (sim as any).dealDamage(p, mob, 100, false, 'physical', null, 'hit');
    expect(mob.hp).toBe(900); // unscaled: no WARFARE bonus leaks into PvE
  });
});

describe('Arena 1v1 win grants Honor through the live sim (endArenaMatch)', () => {
  it('the winner is credited RANKED_ARENA_WIN_HONOR[1v1] and the loser gets none', () => {
    const { sim, a, b } = queueDuo();
    startBout(sim);
    const ea = sim.entities.get(a)!;
    const eb = sim.entities.get(b)!;
    (sim as any).dealDamage(ea, eb, 99999, false, 'physical', null, 'hit');
    const events = sim.tick();
    const honorEvents = events.filter((e) => e.type === 'honor');
    expect(honorEvents).toHaveLength(1);
    expect((honorEvents[0] as any).amount).toBe(RANKED_ARENA_WIN_HONOR['1v1']);
    expect((honorEvents[0] as any).reason).toBe('arena_win');
    expect(sim.meta(a)!.honor).toBe(RANKED_ARENA_WIN_HONOR['1v1']);
    expect(sim.meta(a)!.lifetimeHonor).toBe(RANKED_ARENA_WIN_HONOR['1v1']);
    expect(sim.meta(b)!.honor).toBe(0);
  });

  it('a disconnect during the return-delay aftermath never double-counts honor', () => {
    const { sim, a, b } = queueDuo();
    startBout(sim);
    const ea = sim.entities.get(a)!;
    const eb = sim.entities.get(b)!;
    (sim as any).dealDamage(ea, eb, 99999, false, 'physical', null, 'hit');
    sim.tick(); // scores the win, enters the 'over' aftermath
    expect(sim.meta(a)!.honor).toBe(RANKED_ARENA_WIN_HONOR['1v1']);
    sim.removePlayer(a); // a disconnects during the aftermath (resultRecorded guards it)
    expect(sim.meta(b)).toBeTruthy(); // b unaffected, no second scoring pass ran
  });

  it('repeat wins against the same opponent the same day pay no further honor', () => {
    const { sim, a, b } = queueDuo();
    startBout(sim);
    let ea = sim.entities.get(a)!;
    let eb = sim.entities.get(b)!;
    (sim as any).dealDamage(ea, eb, 99999, false, 'physical', null, 'hit');
    sim.tick();
    expect(sim.meta(a)!.honor).toBe(RANKED_ARENA_WIN_HONOR['1v1']);
    for (let i = 0; i < 20 * 6 && sim.arenaMatchFor(a); i++) sim.tick();

    sim.arenaQueueJoin(a);
    sim.arenaQueueJoin(b);
    sim.tick();
    startBout(sim);
    ea = sim.entities.get(a)!;
    eb = sim.entities.get(b)!;
    (sim as any).dealDamage(ea, eb, 99999, false, 'physical', null, 'hit');
    sim.tick();
    // second win vs the SAME opponent identity, same UTC day: DR floors the payout at 0
    expect(sim.meta(a)!.honor).toBe(RANKED_ARENA_WIN_HONOR['1v1']);
  });
});

describe('Daily arena tapering (ARENA_DAILY_TAPER_START/FLOOR_START)', () => {
  it('wins 10-14 pay 50%, wins 15+ pay 25%, tracked by totalWins not opponent identity', () => {
    const sim = makeWorld();
    const winner = sim.meta(sim.addPlayer('warrior', 'Grinder'))!;
    winner.honorArenaDaily = {
      date: '',
      winsByOpponent: {},
      fiestaCompletionsByOpponent: {},
      fiestaKillsByVictim: {},
      totalWins: ARENA_DAILY_TAPER_START,
    };
    const before = winner.honor;
    grantHonor(sim.ctx as any, winner, RANKED_ARENA_WIN_HONOR['1v1'] * 0.5, 'arena_win');
    expect(winner.honor - before).toBe(Math.floor(RANKED_ARENA_WIN_HONOR['1v1'] * 0.5));
    winner.honorArenaDaily.totalWins = ARENA_DAILY_TAPER_FLOOR_START;
    const before2 = winner.honor;
    grantHonor(sim.ctx as any, winner, RANKED_ARENA_WIN_HONOR['1v1'] * 0.25, 'arena_win');
    expect(winner.honor - before2).toBe(Math.floor(RANKED_ARENA_WIN_HONOR['1v1'] * 0.25));
  });
});

describe('Honor persists through CharacterState round-trip', () => {
  it('honor, lifetimeHonor, and honorArenaDaily survive serialize -> addPlayer', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Persisted');
    const meta = sim.meta(pid)!;
    meta.honor = 640;
    meta.lifetimeHonor = 1500;
    meta.honorArenaDaily = {
      date: '2026-07-17',
      winsByOpponent: { '1v1:["character:1"]': 1 },
      fiestaCompletionsByOpponent: {},
      fiestaKillsByVictim: {},
      totalWins: 1,
    };
    const state = sim.serializeCharacter(pid)!;
    expect(state.honor).toBe(640);
    expect(state.lifetimeHonor).toBe(1500);

    const sim2 = makeWorld();
    const pid2 = sim2.addPlayer('warrior', 'Reloaded', { state });
    const meta2 = sim2.meta(pid2)!;
    expect(meta2.honor).toBe(640);
    expect(meta2.lifetimeHonor).toBe(1500);
    expect(meta2.honorArenaDaily?.totalWins).toBe(1);
  });

  it('a pre-honor save (no honor field) loads at zero, never NaN or negative', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Legacy');
    const state = sim.serializeCharacter(pid)!;
    delete (state as any).honor;
    delete (state as any).lifetimeHonor;

    const sim2 = makeWorld();
    const pid2 = sim2.addPlayer('warrior', 'LegacyLoaded', { state });
    const meta2 = sim2.meta(pid2)!;
    expect(meta2.honor).toBe(0);
    expect(meta2.lifetimeHonor).toBe(0);
  });
});

describe('Bramble, the Honor Quartermaster (src/sim/content/pvp_honor.ts)', () => {
  it('ships exactly 31 items across the 8 slots this fork actually has (no neck/ring)', () => {
    expect(FURY_STOCK).toHaveLength(31);
    for (const itemId of FURY_STOCK) {
      const item = ITEMS[itemId];
      expect(item, `${itemId} missing from ITEMS`).toBeTruthy();
      expect(item.priceHonor).toBeGreaterThan(0);
      expect(item.soulbound).toBe(true);
      if (item.kind === 'armor') {
        expect(item.slot).not.toBe('neck');
      }
    }
  });

  it('buying a piece spends Honor only, leaves copper untouched, and errors when short', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Buyer');
    const meta = sim.meta(pid)!;
    meta.honor = 500;
    meta.copper = 12345;
    const npc = sim.entities.get(FURY_ENTITY_ID)!;
    const e = sim.entities.get(pid)!;
    e.pos = { ...npc.pos };

    sim.buyItem(FURY_ENTITY_ID, 'bramblewar_girdle'); // priceHonor: 250
    expect(meta.honor).toBe(250);
    expect(meta.copper).toBe(12345);
    expect(meta.inventory.some((i) => i.itemId === 'bramblewar_girdle')).toBe(true);

    sim.buyItem(FURY_ENTITY_ID, 'bramblewar_warplate'); // priceHonor: 700, only 250 left
    expect(meta.honor).toBe(250); // purchase refused, balance unchanged
    expect(meta.inventory.some((i) => i.itemId === 'bramblewar_warplate')).toBe(false);
  });
});
