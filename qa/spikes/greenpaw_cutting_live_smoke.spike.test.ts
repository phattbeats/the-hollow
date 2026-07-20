// PHAA-772 live smoke: Greenpaw's cutting companion in a running world.
//
// PHAA-751's own tests/greenpaw_cutting.test.ts already lock plant/grow/spawn/
// follow/persistence/determinism. This QA harness closes the one gap Sable
// flagged on PR #264 (comment d0022d98): none of those unit tests exercise the
// 999999-HP, non-hostile, dmg=0, aggroRadius=0 companion as a would-be COMBAT
// target in a live ticking world. It drives the real Sim tick loop (not a
// mocked slice) and asserts, from every angle a player could reach it:
//   1. tab-target and target-nearest-enemy NEVER select the companion, even
//      when it is the closest entity to the player.
//   2. a click/manual soft-select plus a force-set autoAttack can NEVER land a
//      swing on it (the auto-attack tick clears autoAttack on a non-hostile
//      target), so its HP never moves and it never emits a `damage` event.
//   3. a real AoE (Thunder Clap, radius 8, centered on the caster) that DOES
//      splash an adjacent hostile wolf NEVER touches the companion standing the
//      same distance away, and never emits FCT (a `damage` event) for it, even
//      over a sustained multi-second fight.
//
// The single sim chokepoint behind all three is Sim.isHostileTo: for an owned
// mob it delegates to hostility toward the OWNER player, which at a homestead
// (no duel, no arena) is always false, so the companion is invisible to every
// tab/attack/AoE/damage path. This harness proves that end to end.
//
// The "force growth" harness bit the ticket calls for is done here WITHOUT a
// dev command or a shrunk GROWTH_DURATION: the growth accumulator is advanced to
// one tick short of the threshold, then a genuine sim.tick() crosses it so the
// spawn happens through the real per-tick greenpawCutting.update() path.
//
// Run in isolation:
//   NODE_ENV= npx vitest run qa/spikes/greenpaw_cutting_live_smoke.spike.test.ts --reporter=verbose
import { beforeEach, describe, expect, it } from 'vitest';
import { HOLLOW_QUEST_ORDER } from '../../src/sim/content/hollow';
import { MOBS } from '../../src/sim/data';
import { createMob } from '../../src/sim/entity';
import { GROWTH_DURATION } from '../../src/sim/greenpaw_cutting';
import { Sim } from '../../src/sim/sim';
import { DT, type Entity, type SimEvent } from '../../src/sim/types';

const SEED = 7;
// The same valid, open homestead claim spot tests/homestead.test.ts and
// tests/greenpaw_cutting.test.ts use.
const SPOT_A = { x: -85, z: -234 };

function makeSim(seed = SEED): Sim {
  return new Sim({ seed, playerClass: 'warrior', autoEquip: true });
}

function standAt(sim: Sim, pid: number, pos: { x: number; z: number }): void {
  const e = sim.entities.get(pid)!;
  e.pos.x = pos.x;
  e.pos.z = pos.z;
  e.prevPos = { ...e.pos };
}

// Grant the full Greenpaw arc, claim SPOT_A, and plant the cutting standing on
// the plot: the exact state plant() needs to succeed.
function plantAt(sim: Sim, pid: number): void {
  const meta = sim.players.get(pid)!;
  for (const qid of HOLLOW_QUEST_ORDER) meta.questsDone.add(qid);
  standAt(sim, pid, SPOT_A);
  sim.homesteadClaim(pid);
  sim.addItem('first_cutting', 1, pid);
  sim.useItem('first_cutting', pid);
}

// Advance growth to one tick short of the threshold, then let a genuine tick
// cross it so trySpawnFor runs inside the real per-tick update path. Returns the
// live companion entity.
function growAndSpawn(sim: Sim): Entity {
  sim.greenpawCutting.update(GROWTH_DURATION - DT);
  expect(companionFor(sim, sim.playerId)).toBeUndefined(); // not grown yet
  sim.tick(); // this tick's greenpawCutting.update(DT) crosses the threshold
  const c = companionFor(sim, sim.playerId);
  expect(c).toBeDefined();
  return c!;
}

function companionFor(sim: Sim, ownerPid: number): Entity | undefined {
  return [...sim.entities.values()].find((e) => e.kind === 'mob' && e.ownerId === ownerPid);
}

function damageEvents(events: SimEvent[]): Extract<SimEvent, { type: 'damage' }>[] {
  return events.filter((e): e is Extract<SimEvent, { type: 'damage' }> => e.type === 'damage');
}

describe('PHAA-772 Greenpaw companion: never a valid combat target (live world)', () => {
  let sim: Sim;
  let p1: number;
  let companion: Entity;

  beforeEach(() => {
    sim = makeSim();
    p1 = sim.playerId;
    sim.setPlayerLevel(14); // learns Thunder Clap (learnLevel 6, rank 2 at 14)
    plantAt(sim, p1);
    companion = growAndSpawn(sim);
    sim.drainEvents();
  });

  it('spawns non-hostile, owned, effectively unkillable, and is NEVER hostile to anyone', () => {
    expect(companion.hostile).toBe(false);
    expect(companion.ownerId).toBe(p1);
    expect(companion.hp).toBe(999999);
    expect(MOBS[companion.templateId].dmgBase).toBe(0);
    expect(MOBS[companion.templateId].aggroRadius).toBe(0);
    // The single chokepoint: not hostile to its own owner...
    expect(sim.isHostileTo(sim.entities.get(p1)!, companion)).toBe(false);
    // ...nor to an unrelated second player sharing the world (no duel/arena).
    const p2 = sim.addPlayer('mage', 'Bystander');
    standAt(sim, p2, { x: SPOT_A.x + 2, z: SPOT_A.z });
    expect(sim.isHostileTo(sim.entities.get(p2)!, companion)).toBe(false);
  });

  it('tab-target and target-nearest-enemy skip it even when it is the closest entity', () => {
    // Neither selector may ever land on the companion. (targetId MAY resolve to
    // a real Hollow-zone wolf pack within the 40yd query radius of the homestead;
    // that is correct behavior. The companion is the one entity that must never
    // be selected.)
    sim.tabTarget(p1);
    expect(sim.entities.get(p1)!.targetId).not.toBe(companion.id);
    sim.targetNearestEnemy(p1);
    expect(sim.entities.get(p1)!.targetId).not.toBe(companion.id);

    // Now add a real hostile wolf a bit FARTHER than the companion. The
    // nearest-enemy scan must still pick the wolf and never the closer companion.
    const wolf = createMob(90042, MOBS.forest_wolf, 5, sim.groundPos(SPOT_A.x + 4, SPOT_A.z));
    sim.addEntity(wolf);
    expect(sim.isHostileTo(sim.entities.get(p1)!, wolf)).toBe(true); // guard: wolf is a real target
    const dCompanion = Math.hypot(companion.pos.x - SPOT_A.x, companion.pos.z - SPOT_A.z);
    const dWolf = Math.hypot(wolf.pos.x - SPOT_A.x, wolf.pos.z - SPOT_A.z);
    expect(dCompanion).toBeLessThan(dWolf); // companion is genuinely the closer entity

    sim.entities.get(p1)!.targetId = null;
    sim.targetNearestEnemy(p1);
    expect(sim.entities.get(p1)!.targetId).toBe(wolf.id);

    // Cycle tab-target many times: it must never once resolve to the companion.
    sim.entities.get(p1)!.targetId = null;
    for (let i = 0; i < 12; i++) {
      sim.tabTarget(p1);
      expect(sim.entities.get(p1)!.targetId).not.toBe(companion.id);
    }
  });

  it('a click soft-select plus a forced autoAttack can never land a swing on it', () => {
    // A click can soft-select any entity (to read its nameplate), but selecting
    // a non-hostile target must force autoAttack off.
    sim.targetEntity(companion.id, p1);
    const p = sim.entities.get(p1)!;
    expect(p.targetId).toBe(companion.id);
    expect(p.autoAttack).toBe(false);

    // Force the harder case: pin the target AND force autoAttack true, bypassing
    // the click guard, then run the live loop. The auto-attack tick must refuse
    // to swing a non-hostile target and clear the flag; HP never moves.
    p.autoAttack = true;
    p.targetId = companion.id;
    const hpBefore = companion.hp;
    const events: SimEvent[] = [];
    for (let i = 0; i < 60; i++) {
      events.push(...sim.tick()); // tick() returns and clears the event buffer
    }
    expect(companion.hp).toBe(hpBefore);
    expect(companion.dead).toBe(false);
    expect(p.autoAttack).toBe(false);
    expect(damageEvents(events).some((e) => e.targetId === companion.id)).toBe(false);
  });

  it('a real Thunder Clap splashes an adjacent wolf but never the companion (no stray FCT)', () => {
    const p = sim.entities.get(p1)!;
    // Wolf within Thunder Clap radius (8), same open ground as the companion.
    const wolf = createMob(90043, MOBS.forest_wolf, 5, sim.groundPos(SPOT_A.x + 3, SPOT_A.z));
    // Give the wolf a deep HP pool so it survives the whole sustained fight and
    // stays present as an active AoE splash target the entire time (mirrors
    // tests/combat_damage.test.ts's durable-target trick).
    wolf.maxHp = 500000;
    wolf.hp = 500000;
    sim.addEntity(wolf);
    const wolfHpBefore = wolf.hp;
    const companionHpBefore = companion.hp;
    expect(Math.hypot(companion.pos.x - p.pos.x, companion.pos.z - p.pos.z)).toBeLessThan(8);
    expect(Math.hypot(wolf.pos.x - p.pos.x, wolf.pos.z - p.pos.z)).toBeLessThan(8);

    const events: SimEvent[] = [];
    // Sustained fight: clap on cooldown for ~10s of sim time while the wolf
    // aggros and the companion follows through it all.
    for (let i = 0; i < 200; i++) {
      p.resource = 100; // keep rage topped so the clap always fires
      sim.castAbility('thunder_clap', p1);
      events.push(...sim.tick()); // tick() returns and clears the event buffer
    }

    const dmg = damageEvents(events);
    // The AoE genuinely fired and splashed the wolf (proves this is a live hit,
    // not a no-op that would trivially "pass").
    expect(dmg.some((e) => e.targetId === wolf.id && e.amount > 0)).toBe(true);
    expect(wolf.hp).toBeLessThan(wolfHpBefore);
    // ...and never once touched the companion.
    expect(dmg.some((e) => e.targetId === companion.id)).toBe(false);
    expect(companion.hp).toBe(companionHpBefore);
    expect(companion.hp).toBe(999999);
    expect(companion.dead).toBe(false);
  });
});
