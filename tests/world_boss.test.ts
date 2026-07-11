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
