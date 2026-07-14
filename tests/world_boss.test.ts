// PHAA-494: the world-boss + daily personal-loot lockout framework, and the
// Heartwood Colossus mechanics kit (aoeSlow anti-kite snare, bigCast telegraphed
// hardcast, battleYells) it exercises. Mirrors the per-mechanic test style used
// across mob_*.test.ts (private-method access on `sim as any`).
import { describe, expect, it } from 'vitest';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';
import {
  isWorldBossLootEligible,
  markWorldBossLooted,
  WORLD_BOSS_CORPSE_SECONDS,
  WORLD_BOSS_INTERVAL_SECONDS,
  WORLD_BOSS_LOCKOUT_MS,
  WORLD_BOSSES,
  worldBossIdFromLockout,
  worldBossLockoutId,
} from '../src/sim/world_boss';

const findBoss = (sim: Sim): Entity | undefined =>
  [...(sim as any).entities.values()].find((e: Entity) => e.templateId === 'heartwood_colossus');

describe('world boss lockout ids', () => {
  it('round-trips a boss id through the worldboss: prefix', () => {
    const id = worldBossLockoutId('heartwood_colossus');
    expect(id).toBe('worldboss:heartwood_colossus');
    expect(worldBossIdFromLockout(id)).toBe('heartwood_colossus');
  });

  it('does not mistake a dungeon lockout id for a world-boss one', () => {
    expect(worldBossIdFromLockout('nythraxis_boss_arena')).toBeNull();
  });
});

describe('world boss loot lockout gate (pure)', () => {
  it('is eligible with no lockout entry, then locked for WORLD_BOSS_LOCKOUT_MS after looting', () => {
    const meta = { entityId: 1, raidLockouts: new Map<string, number>() } as any;
    expect(isWorldBossLootEligible(meta, 'heartwood_colossus', 1000)).toBe(true);
    markWorldBossLooted(meta, 'heartwood_colossus', 1000);
    expect(meta.raidLockouts.get('worldboss:heartwood_colossus')).toBe(
      1000 + WORLD_BOSS_LOCKOUT_MS,
    );
    expect(
      isWorldBossLootEligible(meta, 'heartwood_colossus', 1000 + WORLD_BOSS_LOCKOUT_MS - 1),
    ).toBe(false);
    expect(isWorldBossLootEligible(meta, 'heartwood_colossus', 1000 + WORLD_BOSS_LOCKOUT_MS)).toBe(
      true,
    );
  });
});

describe('world boss scheduler', () => {
  it('spawns nothing before its first interval is due', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    (sim as any).updateWorldBosses();
    expect(findBoss(sim)).toBeUndefined();
  });

  it('spawns the Heartwood Colossus once its interval elapses, at its fixed point', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    (sim as any).time = WORLD_BOSS_INTERVAL_SECONDS;
    (sim as any).updateWorldBosses();
    const boss = findBoss(sim);
    expect(boss).toBeTruthy();
    expect(boss!.maxHp).toBe(WORLD_BOSSES[0].hpScale.base);
    expect(boss!.hp).toBe(WORLD_BOSSES[0].hpScale.base);
    expect(boss!.pos.x).toBe(WORLD_BOSSES[0].pos.x);
    expect(boss!.pos.z).toBe(WORLD_BOSSES[0].pos.z);
  });

  it('never double-spawns while a boss is already alive', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    (sim as any).time = WORLD_BOSS_INTERVAL_SECONDS;
    (sim as any).updateWorldBosses();
    (sim as any).time = WORLD_BOSS_INTERVAL_SECONDS * 2;
    (sim as any).updateWorldBosses();
    const bosses = [...(sim as any).entities.values()].filter(
      (e: Entity) => e.templateId === 'heartwood_colossus',
    );
    expect(bosses).toHaveLength(1);
  });

  it('worldBossAtBoot schedules the first rise immediately instead of one interval out', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior', worldBossAtBoot: true });
    (sim as any).updateWorldBosses();
    expect(findBoss(sim)).toBeTruthy();
  });

  it('drops the lootable corpse and clears the slot once the corpse window elapses', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    (sim as any).time = WORLD_BOSS_INTERVAL_SECONDS;
    (sim as any).updateWorldBosses();
    const boss = findBoss(sim)!;
    boss.dead = true;
    boss.corpseTimer = 1;
    (sim as any).updateWorldBosses();
    expect(findBoss(sim)).toBeTruthy(); // still lingering, window not elapsed
    boss.corpseTimer = 0;
    (sim as any).updateWorldBosses();
    expect(findBoss(sim)).toBeUndefined(); // window elapsed, corpse removed
  });
});

describe('world boss death: personal loot + corpse behavior', () => {
  function spawnAdjacentBoss(sim: Sim): Entity {
    const template = MOBS.heartwood_colossus;
    const mob = createMob((sim as any).nextId++, template, template.maxLevel, {
      x: 2,
      y: 0,
      z: 0,
    });
    (sim as any).addEntity(mob);
    return mob;
  }

  it('awards the killer personal loot, never auto-respawns in place, and keeps a long corpse window', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    const p = sim.player;
    p.pos.x = 0;
    p.pos.z = 0;
    const boss = spawnAdjacentBoss(sim);
    boss.threat.set(p.id, 1);
    (sim as any).handleDeath(boss, p);
    expect(boss.dead).toBe(true);
    expect(boss.respawnTimer).toBe(Infinity);
    expect(boss.corpseTimer).toBe(WORLD_BOSS_CORPSE_SECONDS);
    expect(boss.lootable).toBe(true);
    // The guaranteed trophy always drops, personalFor-scoped to the one
    // contributor (the killer), never a bare/shared entry.
    const trophy = boss.loot!.items.find((i) => i.itemId === 'heartwood_splinter');
    expect(trophy).toBeTruthy();
    expect(trophy!.personalFor).toEqual([p.id]);
  });

  it('actually taking a world-boss personal slot through lootCorpse sets the loot lockout', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    const p = sim.player;
    p.pos.x = 0;
    p.pos.z = 0;
    const meta = (sim as any).primary;
    const boss = spawnAdjacentBoss(sim);
    boss.threat.set(p.id, 1);
    (sim as any).handleDeath(boss, p);
    expect(meta.raidLockouts.has('worldboss:heartwood_colossus')).toBe(false);
    sim.lootCorpse(boss.id);
    expect(meta.raidLockouts.has('worldboss:heartwood_colossus')).toBe(true);
    expect(meta.raidLockouts.get('worldboss:heartwood_colossus')).toBeGreaterThan(
      (sim as any).cfg.lockoutNowMs(),
    );
  });

  it('never awards personal loot to a contributor already locked out for this boss', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    const p = sim.player;
    p.pos.x = 0;
    p.pos.z = 0;
    const meta = (sim as any).primary;
    markWorldBossLooted(meta, 'heartwood_colossus', (sim as any).cfg.lockoutNowMs());
    const boss = spawnAdjacentBoss(sim);
    boss.threat.set(p.id, 1);
    (sim as any).handleDeath(boss, p);
    expect(boss.loot?.items.some((i) => i.itemId === 'heartwood_splinter')).toBeFalsy();
  });

  it('despawns any adds the boss summoned when it dies', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    const p = sim.player;
    p.pos.x = 0;
    p.pos.z = 0;
    const boss = spawnAdjacentBoss(sim);
    boss.threat.set(p.id, 1);
    const add = createMob((sim as any).nextId++, MOBS.forest_wolf, 1, { x: 3, y: 0, z: 0 });
    (sim as any).addEntity(add);
    boss.summonedIds.push(add.id);
    (sim as any).handleDeath(boss, p);
    expect((sim as any).entities.has(add.id)).toBe(false);
  });
});

describe('Heartwood Colossus mechanics kit', () => {
  function spawnEngagedBoss(sim: Sim): Entity {
    const template = MOBS.heartwood_colossus;
    const boss = createMob((sim as any).nextId++, template, template.maxLevel, {
      x: 10,
      y: 0,
      z: 0,
    });
    (sim as any).addEntity(boss);
    boss.aiState = 'chase';
    boss.aggroTargetId = sim.player.id;
    return boss;
  }

  it('Grasping Roots (aoeSlow) applies a slow aura to a nearby player even while chasing', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    const p = sim.player;
    p.gm = true; // survive the boss's swing so a same-tick death doesn't wipe the aura
    p.pos.x = 10;
    p.pos.z = 5; // within aoeSlow.radius (14)
    const boss = spawnEngagedBoss(sim);
    boss.aoeSlowTimer = 0.001;
    sim.tick();
    const aura = p.auras.find((a) => a.kind === 'slow' && a.sourceId === boss.id);
    expect(aura).toBeTruthy();
    expect(aura!.name).toBe('Grasping Roots');
    expect(aura!.value).toBe(MOBS.heartwood_colossus.aoeSlow!.mult);
  });

  it('Heartwood Eruption (bigCast) opens a real cast bar, then novas everyone in radius', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    const p = sim.player;
    // High HP rather than gm (gm is fully invulnerable, which would also swallow
    // the nova damage this test asserts on) so melee swings during the cast bar
    // can't kill the player before the eruption lands.
    p.maxHp = 999999;
    p.hp = 999999;
    p.pos.x = 11;
    p.pos.z = 0; // in melee range, so the mob enters 'attack' (bigCast fires there)
    const boss = spawnEngagedBoss(sim);
    boss.aiState = 'attack';
    boss.bigCastTimer = 0.001;
    sim.tick();
    expect(boss.castingAbility).toBe('heartwood_eruption');
    const castTime = MOBS.heartwood_colossus.bigCast!.castTime;
    const startHp = p.hp;
    for (let i = 0; i < Math.ceil(castTime / (1 / 20)) + 1; i++) sim.tick();
    expect(boss.castingAbility).toBeNull();
    expect(p.hp).toBeLessThan(startHp);
    // bigCastTimer freezes for the whole cast (the casting branch never touches
    // it), so it must resume at exactly `every`, not `every + castTime`, or the
    // real cadence balloons to every + 2*castTime between casts.
    expect(boss.bigCastTimer).toBe(MOBS.heartwood_colossus.bigCast!.every);
  });

  it('battleYells barks a cycling line into yell chat on its cadence', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    const p = sim.player;
    p.pos.x = 10;
    p.pos.z = 5;
    const boss = spawnEngagedBoss(sim);
    boss.loudYellTimer = 0.001;
    const events: any[] = [];
    const origEmit = (sim as any).emit.bind(sim);
    (sim as any).emit = (e: any) => {
      events.push(e);
      origEmit(e);
    };
    sim.tick();
    const yell = events.find(
      (e) => e.type === 'chat' && e.channel === 'yell' && e.entityId === boss.id,
    );
    expect(yell).toBeTruthy();
    expect(MOBS.heartwood_colossus.battleYells!.lines).toContain(yell.text);
  });
});

// PHAA-579: folds upstream #1643's Thunzharr unkitable-movespeed fix into the
// world-boss framework. The colossus's moveSpeed (10.5) already outpaced base
// player run speed (7) from the original PHAA-494 port, so raw speed alone was
// never kiteable; the missing piece was phasesThroughObstacles, so a straight
// chase line through camp furniture can't wedge him and hand a kiter the gap.
describe('world boss pathing (phases through obstacles, upstream #1643)', () => {
  it('the template opts in via phasesThroughObstacles', () => {
    expect(MOBS.heartwood_colossus.phasesThroughObstacles).toBe(true);
  });

  it('outruns a player on foot: boss move speed exceeds base run speed', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    expect(MOBS.heartwood_colossus.moveSpeed).toBeGreaterThan(sim.player.moveSpeed);
  });

  it('an ordinary (unflagged) template does not phase through obstacles', () => {
    expect(MOBS.forest_wolf.phasesThroughObstacles).toBeFalsy();
  });

  it('marches a dead-straight line through a camp prop that deflects an ordinary chaser', () => {
    // Same tent collider (seed 20061, ~1.95yd radius) tests/sim.test.ts's "chasing
    // mobs slide around a camp prop" case proves deflects an ordinary mob mid-chase.
    // With phasesThroughObstacles the colossus ignores it entirely: x never
    // deviates from the straight-line path, unlike the collide-and-slide branch.
    const sim = new Sim({ seed: 20061, playerClass: 'warrior' });
    const template = MOBS.heartwood_colossus;
    const startX = -3;
    const boss = createMob((sim as any).nextId++, template, template.maxLevel, {
      x: startX,
      y: 0,
      z: 500,
    });
    (sim as any).addEntity(boss);
    const dest = { x: startX, y: 0, z: 515 }; // straight through the tent at z=505
    const straightTicks = Math.ceil(15 / (boss.moveSpeed * (1 / 20))) + 2;
    let arrived = false;
    for (let i = 0; i < straightTicks && !arrived; i++) {
      arrived = (sim as any).moveToward(boss, dest, boss.moveSpeed);
      expect(Math.abs(boss.pos.x - startX)).toBeLessThan(1e-6);
    }
    expect(arrived).toBe(true);
  });
});

// PHAA-517: folds upstream #1502/#1503's Thunzharr cc-immunity + tuning into the
// world-boss framework. ccImmune already blocked stun/root/etc (PHAA-494); this adds
// the separate slowImmune flag (player snares do not stick, unlike most elites) and
// closes the polymorph hole where the sheep full-heal ran before the ccImmune aura
// gate dropped the aura, healing the boss to full without sheeping it.
describe('world boss cc-immunity and slow-immunity (upstream #1502/#1503)', () => {
  function spawnEngagedBoss(sim: Sim): Entity {
    const template = MOBS.heartwood_colossus;
    const boss = createMob((sim as any).nextId++, template, template.maxLevel, {
      x: 10,
      y: 0,
      z: 0,
    });
    (sim as any).addEntity(boss);
    boss.aiState = 'chase';
    boss.aggroTargetId = sim.player.id;
    return boss;
  }

  it('the template opts into both ccImmune and slowImmune', () => {
    expect(MOBS.heartwood_colossus.ccImmune).toBe(true);
    expect(MOBS.heartwood_colossus.slowImmune).toBe(true);
  });

  it('shrugs off a player-applied snare but still takes a self-applied (scripted) slow', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    const boss = spawnEngagedBoss(sim);
    const p = sim.player;

    // A Frostbolt/Hamstring-style snare from a player does not stick to the raid boss.
    (sim as any).applyAura(boss, {
      id: 'frostbolt_slow',
      name: 'Frostbolt',
      kind: 'slow',
      remaining: 5,
      duration: 5,
      value: 0.4,
      sourceId: p.id,
      school: 'frost',
    });
    expect(boss.auras.some((a: { kind: string }) => a.kind === 'slow')).toBe(false);

    // But a self-sourced slow (a scripted mechanic on itself, e.g. Grasping Roots'
    // own bookkeeping) is exempt from the immunity.
    (sim as any).applyAura(boss, {
      id: 'self_slow',
      name: 'Rooted Stance',
      kind: 'slow',
      remaining: 5,
      duration: 5,
      value: 0.5,
      sourceId: boss.id,
      school: 'nature',
    });
    expect(boss.auras.some((a: { kind: string; id: string }) => a.id === 'self_slow')).toBe(true);
  });

  it('an ordinary (unflagged) mob is not slow-immune: a player snare lands normally', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    const wolf = createMob((sim as any).nextId++, MOBS.forest_wolf, 1, { x: 5, y: 0, z: 0 });
    (sim as any).addEntity(wolf);
    (sim as any).applyAura(wolf, {
      id: 'frostbolt_slow',
      name: 'Frostbolt',
      kind: 'slow',
      remaining: 5,
      duration: 5,
      value: 0.4,
      sourceId: sim.player.id,
      school: 'frost',
    });
    expect(wolf.auras.some((a: { kind: string }) => a.kind === 'slow')).toBe(true);
  });

  it('rejects Polymorph on the boss, so it is never sheeped or full-healed mid-fight', () => {
    const sim = new Sim({ seed: 1, playerClass: 'mage' });
    sim.setPlayerLevel(20); // knows Polymorph
    const boss = spawnEngagedBoss(sim);
    boss.hp = Math.floor(boss.maxHp * 0.4); // hurt mid-fight

    const p = sim.player;
    p.facing = Math.atan2(boss.pos.x - p.pos.x, boss.pos.z - p.pos.z);
    sim.targetEntity(boss.id);
    sim.castAbility('polymorph');
    const events = sim.tick();

    // The cast is rejected outright, so the polymorph effect (and its sheep full-heal
    // side effect, the "he just reset to full" bug) never runs.
    expect(
      events.some(
        (e) => e.type === 'error' && /cannot be polymorphed/i.test((e as { text: string }).text),
      ),
    ).toBe(true);
    expect(boss.auras.some((a) => a.kind === 'polymorph')).toBe(false);
    // Its HP was not snapped to full; one tick of idle regen cannot reach maxHp from 40%.
    expect(boss.hp).toBeLessThan(boss.maxHp);
  });

  it('also rejects Polymorph on an ordinary ccImmune mob, not just the world boss', () => {
    // The guard widening (fam === 'undead' || gorrak || MOBS[...].ccImmune) closes the
    // full-heal hole for every ccImmune template, not only heartwood_colossus: confirm
    // it on a plain rare elite (mogger, zone1) so the broad scope is pinned by a test.
    expect(MOBS.mogger.ccImmune).toBe(true);
    expect(MOBS.mogger.worldBoss).toBeUndefined();

    const sim = new Sim({ seed: 1, playerClass: 'mage' });
    sim.setPlayerLevel(20);
    const mogger = createMob((sim as any).nextId++, MOBS.mogger, MOBS.mogger.maxLevel, {
      x: 10,
      y: 0,
      z: 0,
    });
    (sim as any).addEntity(mogger);
    mogger.hp = Math.floor(mogger.maxHp * 0.4);

    const p = sim.player;
    p.facing = Math.atan2(mogger.pos.x - p.pos.x, mogger.pos.z - p.pos.z);
    sim.targetEntity(mogger.id);
    sim.castAbility('polymorph');
    const events = sim.tick();

    expect(
      events.some(
        (e) => e.type === 'error' && /cannot be polymorphed/i.test((e as { text: string }).text),
      ),
    ).toBe(true);
    expect(mogger.auras.some((a) => a.kind === 'polymorph')).toBe(false);
    expect(mogger.hp).toBeLessThan(mogger.maxHp);
  });

  it('still sheeps a normal, non-immune mob (polymorph is otherwise unchanged)', () => {
    const sim = new Sim({ seed: 1, playerClass: 'mage' });
    sim.setPlayerLevel(20);
    const wolf = createMob((sim as any).nextId++, MOBS.forest_wolf, 5, { x: 10, y: 0, z: 5 });
    (sim as any).addEntity(wolf);
    const p = sim.player;
    p.facing = Math.atan2(wolf.pos.x - p.pos.x, wolf.pos.z - p.pos.z);
    sim.targetEntity(wolf.id);
    sim.castAbility('polymorph');
    for (let i = 0; i < 20 * 2; i++) sim.tick();
    expect(wolf.auras.some((a) => a.kind === 'polymorph')).toBe(true);
  });
});

describe('world boss hp scaling per-player step (upstream #1502)', () => {
  it('steps the pool gently (5k/head), not steeply, per extra participant', () => {
    expect(WORLD_BOSSES[0].hpScale.perPlayer).toBe(5_000);
  });
});
