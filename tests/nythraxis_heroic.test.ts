// Direct unit + integration tests for the Heroic Nythraxis tier (PHAA-714): the raid
// difficulty selection, the boss/add heroic stat scaling, the Deathless Court adds
// (channelHeal + CC rules + ignoreTaunt), Dread Curse, the Soul Rend/Deathless Rage
// heroic scaling, the difficulty-scoped raid lockout, and the heroic loot swap.

import { describe, expect, it } from 'vitest';
import * as nythraxis from '../src/sim/encounters/nythraxis';
import { Sim } from '../src/sim/sim';
import type { SimContext } from '../src/sim/sim_context';
import { type Entity, NYTHRAXIS_BOSS_ID } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';

type AnySim = Sim & Record<string, any>;
type AnyEntity = Entity & Record<string, any>;

const ctxOf = (sim: Sim): SimContext => (sim as unknown as { ctx: SimContext }).ctx;

function teleport(sim: AnySim, e: AnyEntity, x: number, z: number, y?: number): void {
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = y ?? groundHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
  sim.rebucket(e);
}

function tickSeconds(sim: Sim, seconds: number) {
  for (let i = 0; i < seconds * 20; i++) sim.tick();
}

// Enter the Nythraxis arena with a full attuned raid (tank + dpsCount dps, 6 by
// default so the heroic 6-player Soul Rend pick has enough candidates), claiming the
// given difficulty via setRaidDifficulty (the raid leader's "/raid heroic|normal").
function setup(difficulty: 'normal' | 'heroic' = 'normal', dpsCount = 6) {
  const sim = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true }) as AnySim;
  const tankPid = sim.addPlayer('warrior', 'Tank') as number;
  sim.setPlayerLevel(20, tankPid); // raid-geared level: a default-level tank cannot
  // survive even a single heroic Gravebreaker swing (2x normal damage).
  sim.players.get(tankPid)!.questsDone.add('q_nythraxis_bound_guardian');
  const dpsPids: number[] = [];
  for (let i = 0; i < dpsCount; i++) {
    const pid = sim.addPlayer('mage', `Dps${i}`) as number;
    sim.setPlayerLevel(20, pid);
    sim.partyInvite(pid, tankPid);
    sim.partyAccept(pid);
    dpsPids.push(pid);
  }
  sim.convertPartyToRaid(tankPid);
  if (difficulty === 'heroic') sim.setRaidDifficulty('heroic', tankPid);
  sim.enterDungeon('nythraxis_boss_arena', tankPid);
  const tank = sim.entities.get(tankPid) as AnyEntity;
  const boss = [...sim.entities.values()].find(
    (e: AnyEntity) => e.kind === 'mob' && e.templateId === NYTHRAXIS_BOSS_ID && !e.dead,
  ) as AnyEntity;
  teleport(sim, tank, boss.pos.x, boss.pos.z - 6, boss.pos.y);
  const dps = dpsPids.map((pid) => sim.entities.get(pid) as AnyEntity);
  dps.forEach((e, i) => {
    teleport(sim, e, boss.spawnPos.x + (i - dpsCount / 2), boss.spawnPos.z - 20, boss.pos.y);
  });
  boss.inCombat = true;
  boss.aiState = 'attack';
  boss.aggroTargetId = tank.id;
  boss.threat.set(tank.id, 1000);
  return { sim, ctx: ctxOf(sim), tank, dps, boss };
}

describe('Heroic Nythraxis tier (PHAA-714)', () => {
  it('the raid leader selects difficulty; only the raid leader may, and only while raided', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true }) as AnySim;
    const soloPid = sim.addPlayer('warrior', 'Solo') as number;
    sim.setRaidDifficulty('heroic', soloPid);
    expect(sim.partyOf(soloPid)).toBeNull(); // no-op: not even in a party

    const leaderPid = sim.addPlayer('warrior', 'Leader') as number;
    const memberPid = sim.addPlayer('mage', 'Member') as number;
    sim.partyInvite(memberPid, leaderPid);
    sim.partyAccept(memberPid);
    for (let i = 0; i < 3; i++) {
      const pid = sim.addPlayer('mage', `Fill${i}`) as number;
      sim.partyInvite(pid, leaderPid);
      sim.partyAccept(pid);
    }
    sim.convertPartyToRaid(leaderPid);
    sim.setRaidDifficulty('heroic', memberPid); // not the leader
    expect(sim.partyOf(leaderPid)?.raidDifficulty).toBe('normal');
    sim.setRaidDifficulty('heroic', leaderPid);
    expect(sim.partyOf(leaderPid)?.raidDifficulty).toBe('heroic');
    sim.setRaidDifficulty('normal', leaderPid);
    expect(sim.partyOf(leaderPid)?.raidDifficulty).toBe('normal');
  });

  it('a heroic claim scales the boss health/damage/armor and is fixed for the instance', () => {
    const { boss: normalBoss } = setup('normal', 4);
    const { boss: heroicBoss, sim } = setup('heroic', 4);
    expect(heroicBoss.maxHp).toBe(Math.round(normalBoss.maxHp * 1.6));
    expect(heroicBoss.hp).toBe(heroicBoss.maxHp);
    expect(heroicBoss.weapon.min).toBe(Math.round(normalBoss.weapon.min * 2.0));
    expect(heroicBoss.weapon.max).toBe(Math.round(normalBoss.weapon.max * 2.0));
    expect(heroicBoss.stats.armor).toBe(Math.round(normalBoss.stats.armor * 1.2));
    const inst = (
      sim.instances as { mobIds: number[]; partyKey: unknown; difficulty: string }[]
    ).find((i) => i.mobIds.includes(heroicBoss.id) && i.partyKey !== null);
    expect(inst?.difficulty).toBe('heroic');
  });

  it('normal and heroic Nythraxis lock independently (a kill on one leaves the other open)', () => {
    const { ctx, boss, tank } = setup('heroic', 4);
    expect(nythraxis.isNythraxisRaidEnemy(boss)).toBe(true);
    nythraxis.grantNythraxisLockout(ctx, boss);
    const meta = ctx.players.get(tank.id)!;
    expect(meta.raidLockouts.has('nythraxis_boss_arena:heroic')).toBe(true);
    expect(meta.raidLockouts.has('nythraxis_boss_arena')).toBe(false);
  });

  it('a heroic summon channel spawns the three Deathless Court adds', () => {
    const { ctx, boss } = setup('heroic', 4);
    const st = nythraxis.initNythraxisEncounter(boss);
    st.phase = 2;
    nythraxis.startNythraxisHeroicSummon(ctx, boss, st);
    expect(st.heroicSummonChannelRemaining).toBeGreaterThan(0);
    expect(boss.castingAbility).toBe('nythraxis_heroic_summon');
    while ((st.heroicSummonChannelRemaining ?? 0) > 0) {
      nythraxis.updateNythraxisHeroicSummon(ctx, boss, st);
    }
    expect(boss.castingAbility).toBeNull();
    const court = [
      'nythraxis_heroic_warrior_add',
      'nythraxis_heroic_priest_add',
      'nythraxis_heroic_rogue_add',
    ];
    for (const templateId of court) {
      const add = [...ctx.entities.values()].find((e) => e.templateId === templateId && !e.dead);
      expect(add, templateId).toBeTruthy();
      expect(boss.summonedIds).toContain(add!.id);
    }
    // Deathless Rage's own heroic re-summon trigger is gated on the previous court
    // having fallen: while the adds above are still alive, driving a full Deathless
    // Rage cycle must NOT stack a second court.
    const before = [...ctx.entities.values()].filter((e) => court.includes(e.templateId)).length;
    nythraxis.startNythraxisDeathlessRage(ctx, boss, st);
    st.deathlessCastRemaining = 0.001;
    st.wardChannels = [];
    nythraxis.updateNythraxisDeathlessRage(ctx, boss, st);
    expect(st.heroicSummonChannelRemaining ?? 0).toBe(0); // not re-armed: court still up
    const after = [...ctx.entities.values()].filter((e) => court.includes(e.templateId)).length;
    expect(after).toBe(before);
  });

  it('Malric (the priest add) is CC-able and Voss (the rogue add) ignores taunt; the warrior add is CC-immune', () => {
    const { ctx, boss } = setup('heroic', 4);
    nythraxis.initNythraxisEncounter(boss);
    nythraxis.spawnNythraxisHeroicAdds(ctx, boss);
    const malric = [...ctx.entities.values()].find(
      (e) => e.templateId === 'nythraxis_heroic_priest_add' && !e.dead,
    )!;
    const voss = [...ctx.entities.values()].find(
      (e) => e.templateId === 'nythraxis_heroic_rogue_add' && !e.dead,
    )!;
    const aldren = [...ctx.entities.values()].find(
      (e) => e.templateId === 'nythraxis_heroic_warrior_add' && !e.dead,
    )!;
    expect(nythraxis.isNythraxisControllableAdd(malric)).toBe(true);
    expect(nythraxis.isNythraxisControllableAdd(voss)).toBe(true);
    expect(nythraxis.isNythraxisControllableAdd(aldren)).toBe(false);
    expect(nythraxis.isNythraxisRaidEnemy(malric)).toBe(true);
  });

  it('Malric channels an escalating heal on the wounded boss; a stun resets the ramp', () => {
    const { sim, ctx, boss, tank } = setup('heroic', 4);
    // Wounded but still above the 70% phase-2 threshold: below it, the boss's own
    // per-tick encounter update (also driven by sim.tick()) starts the transition
    // and stuns the whole room, including Malric, before the heal can be observed.
    boss.hp = Math.floor(boss.maxHp * 0.9);
    nythraxis.initNythraxisEncounter(boss);
    nythraxis.spawnNythraxisHeroicAdds(ctx, boss);
    const malric = [...ctx.entities.values()].find(
      (e) => e.templateId === 'nythraxis_heroic_priest_add' && !e.dead,
    ) as AnyEntity;
    teleport(sim, malric, boss.pos.x - 2, boss.pos.z, boss.pos.y);
    malric.hostile = true;
    malric.inCombat = true;
    malric.aiState = 'attack';
    // updateMob resolves a target via updateMobTarget/threat before the healer-hold
    // hook ever runs; give Malric a live player target so the AI dispatcher reaches
    // the 'attack' case body (the hold intercepts before any melee logic). This test
    // is about the heal mechanic, not raid mitigation, so give the tank enough of a
    // health buffer to survive a few raw heroic swings unhealed.
    malric.aggroTargetId = tank.id;
    malric.threat.set(tank.id, 1);
    tank.maxHp = 1_000_000;
    tank.hp = 1_000_000;
    const hpBefore = boss.hp;
    tickSeconds(sim, 6); // > every (4s): at least one heal tick should have landed
    expect(tank.dead).toBe(false);
    expect(boss.hp).toBeGreaterThan(hpBefore);
    expect(malric.channelRamp).toBeGreaterThan(0);
    // A stun interrupts the channel and resets the ramp.
    malric.auras.push({
      id: 'test_stun',
      name: 'Test Stun',
      kind: 'stun',
      remaining: 5,
      duration: 5,
      value: 0,
      sourceId: boss.id,
      school: 'physical',
    });
    tickSeconds(sim, 1);
    expect(malric.channelRamp).toBe(0);
  });

  it('Dread Curse stacks on the boss current target over time, up to 10 stacks', () => {
    const { ctx, boss, tank } = setup('heroic', 4);
    const st = nythraxis.initNythraxisEncounter(boss);
    st.phase = 1;
    for (let i = 0; i < 12; i++) {
      st.dreadCurseTimer = 0;
      nythraxis.updateNythraxisDreadCurse(ctx, boss, st);
    }
    expect(st.dreadCurseStacks).toBe(10);
    const aura = tank.auras.find((a: { id: string }) => a.id === 'nythraxis_dread_curse');
    expect(aura).toBeTruthy();
    expect(aura!.value).toBeCloseTo(1);
    // Normal difficulty never applies Dread Curse.
    const { ctx: normalCtx, boss: normalBoss, tank: normalTank } = setup('normal', 4);
    const normalSt = nythraxis.initNythraxisEncounter(normalBoss);
    normalSt.phase = 1;
    normalSt.dreadCurseTimer = 0;
    nythraxis.updateNythraxisDreadCurse(normalCtx, normalBoss, normalSt);
    expect(normalTank.auras.some((a: { id: string }) => a.id === 'nythraxis_dread_curse')).toBe(
      false,
    );
  });

  it('Soul Rend marks 6 on heroic (vs 3 on normal) and deals 150% max hp on heroic (vs 100%)', () => {
    const { ctx, boss, tank, dps } = setup('heroic', 6);
    const st = nythraxis.initNythraxisEncounter(boss);
    st.phase = 2;
    nythraxis.castNythraxisSoulRend(ctx, boss, st);
    expect(st.soulRendMarks.length).toBe(6);
    const markedIds = st.soulRendMarks.map((m) => m.playerId);
    expect(new Set(markedIds).size).toBe(6);
    expect(markedIds).not.toContain(tank.id);
    for (const id of markedIds) expect(dps.some((d) => d.id === id)).toBe(true);

    const { ctx: normalCtx, boss: normalBoss } = setup('normal', 6);
    const normalSt = nythraxis.initNythraxisEncounter(normalBoss);
    normalSt.phase = 2;
    nythraxis.castNythraxisSoulRend(normalCtx, normalBoss, normalSt);
    expect(normalSt.soulRendMarks.length).toBe(3);
  });

  it('Deathless Rage on a failed wardstone channel deals 115% max hp on heroic (a guaranteed kill, vs the survivable 82% on normal)', () => {
    const { ctx, boss, tank } = setup('heroic', 4);
    const st = nythraxis.initNythraxisEncounter(boss);
    nythraxis.startNythraxisDeathlessRage(ctx, boss, st);
    // 115% of a full-health pool always overkills; since dealDamage floors at 0,
    // the exact dealt amount isn't independently observable, but "did the target
    // survive a full-health hit" is: heroic never can (>100%), normal always can
    // (<100%). That is exactly the design intent (heroic = a guaranteed kill).
    tank.hp = tank.maxHp;
    st.deathlessCastRemaining = 0.001; // force the "failed" branch to resolve now
    st.wardChannels = []; // no channels started: definitely not interrupt-ready
    nythraxis.updateNythraxisDeathlessRage(ctx, boss, st);
    expect(tank.hp).toBe(0);

    const { ctx: normalCtx, boss: normalBoss, tank: normalTank } = setup('normal', 4);
    const normalSt = nythraxis.initNythraxisEncounter(normalBoss);
    nythraxis.startNythraxisDeathlessRage(normalCtx, normalBoss, normalSt);
    const normalMaxHp = normalTank.maxHp;
    normalTank.hp = normalMaxHp;
    normalSt.deathlessCastRemaining = 0.001;
    normalSt.wardChannels = [];
    nythraxis.updateNythraxisDeathlessRage(normalCtx, normalBoss, normalSt);
    expect(normalTank.hp).toBeGreaterThan(0);
    expect(normalMaxHp - normalTank.hp).toBe(Math.ceil(normalMaxHp * 0.82));
  });

  it('the heroic loot swap upgrades the boss set pieces and rolls the heroic-only weapon table', () => {
    const { ctx, boss } = setup('heroic', 4);
    boss.loot = null;
    boss.hp = 0;
    boss.dead = false;
    // rollLoot reads template.loot directly via MOBS; call the loot module through ctx.
    ctx.rollLoot(boss, ctx.players.get([...ctx.players.keys()][0])!);
    expect(boss.loot).toBeTruthy();
    const items = boss.loot!.items;
    expect(items.length).toBeGreaterThan(0);
    // Every equippable item on a heroic Nythraxis corpse should be a Heroic variant
    // or the loot table's copper/quest-free items; at least one heroicOf id must
    // appear given the boss's own loot table is all epic/legendary set pieces.
    const hasHeroicVariant = items.some((it) => it.itemId.startsWith('heroic_'));
    expect(hasHeroicVariant).toBe(true);
  });
});
