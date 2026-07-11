// Direct unit tests for src/sim/combat/casting_lifecycle.ts (C4a). These drive the
// EXPORTED module functions against a real Sim's SimContext (sim.ctx) so the moved
// branches are exercised on their own, independent of the parity golden: a timed
// cast start -> progress -> finish (applyAbility -> runEffects), a channel start ->
// tick -> finish, an interrupt (cancelCast), a pushback (timed + channel branches),
// and a determinism/replay assertion. Proves the extracted module is callable and the
// move preserved behavior.

import { describe, expect, it } from 'vitest';
import { updateTimers } from '../src/sim/combat/auras';
import {
  cancelCast,
  castAbility,
  pushbackCast,
  updateCasting,
} from '../src/sim/combat/casting_lifecycle';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity, PlayerClass } from '../src/sim/types';
import {
  CAST_PUSHBACK_SEC,
  CAST_QUEUE_WINDOW_SEC,
  CHANNEL_PUSHBACK_FRACTION,
} from '../src/sim/types';

type AnySim = Sim & Record<string, any>;
type AnyEntity = Entity & Record<string, any>;

function makeSim(cls: PlayerClass, level: number): { sim: AnySim; p: AnyEntity; meta: any } {
  const sim = new Sim({ seed: 99, playerClass: cls, autoEquip: true }) as AnySim;
  sim.setPlayerLevel(level);
  const p = sim.player as AnyEntity;
  const meta = sim.players.get(p.id);
  p.resource = p.maxResource;
  return { sim, p, meta };
}

// An idle hostile target in range + faced, so an offensive cast passes its guards.
function spawnTarget(sim: AnySim, p: AnyEntity, level = 1, dz = 6): AnyEntity {
  const mob = createMob(sim.nextId++, MOBS['forest_wolf'], level, {
    x: p.pos.x,
    y: p.pos.y,
    z: p.pos.z + dz,
  }) as AnyEntity;
  mob.maxHp = 5000;
  mob.hp = 5000;
  mob.hostile = true;
  mob.aiState = 'idle';
  sim.addEntity(mob);
  p.facing = Math.atan2(mob.pos.x - p.pos.x, mob.pos.z - p.pos.z);
  sim.targetEntity(mob.id, p.id);
  return mob;
}

// Drive the per-tick lifecycle directly until the cast clears (guarded).
function drainCast(sim: AnySim, p: AnyEntity, meta: any): number {
  let n = 0;
  while (p.castingAbility && n++ < 1000) updateCasting(sim.ctx, p, meta);
  return n;
}

describe('casting_lifecycle: timed cast start -> progress -> finish', () => {
  it('starts a timed cast (gcd armed, state set) and resolves the ability on completion', () => {
    const { sim, p, meta } = makeSim('priest', 12);
    p.hp = Math.max(1, p.maxHp - 500);
    const hp0 = p.hp;
    // Lesser Heal (friendly, never misses) so finish -> applyAbility -> runEffects is observable.
    castAbility(sim.ctx, 'lesser_heal', p.id);
    expect(p.castingAbility).toBe('lesser_heal');
    expect(p.castRemaining).toBeGreaterThan(0);
    expect(p.gcdRemaining).toBeGreaterThan(0);
    const ticks = drainCast(sim, p, meta);
    expect(p.castingAbility).toBeNull(); // FINISHED via updateCasting
    expect(ticks).toBeGreaterThan(1); // actually progressed over multiple ticks
    expect(p.hp).toBeGreaterThan(hp0); // applyAbility ran the heal effect
  });
});

describe('casting_lifecycle: channel start -> tick -> finish', () => {
  it('starts a channel (channeling, resource spent at START), ticks drain, then finishes', () => {
    const { sim, p, meta } = makeSim('warlock', 12);
    const mob = spawnTarget(sim, p);
    p.hp = Math.max(1, p.maxHp - 300);
    const res0 = p.resource;
    castAbility(sim.ctx, 'drain_life', p.id);
    expect(p.castingAbility).toBe('drain_life');
    expect(p.channeling).toBe(true);
    expect(p.resource).toBeLessThan(res0); // channels spend at START
    const mobHp0 = mob.hp;
    const ticks = drainCast(sim, p, meta);
    expect(p.castingAbility).toBeNull(); // channel ran to completion
    expect(ticks).toBeGreaterThan(1);
    // Each channel bolt deals its damage when it reaches the target (projectile_travel),
    // a few ticks after it is fired: let the last bolts land.
    for (let i = 0; i < 20 && mob.hp >= mobHp0; i++) sim.tick();
    expect(mob.hp).toBeLessThan(mobHp0); // applyChannelTick dealt drain damage
  });
});

describe('casting_lifecycle: interrupt (cancelCast)', () => {
  it('clears cast state and emits castStop(success:false)', () => {
    const { sim, p } = makeSim('mage', 12);
    spawnTarget(sim, p);
    sim.drainEvents();
    castAbility(sim.ctx, 'fireball', p.id);
    expect(p.castingAbility).toBe('fireball');
    cancelCast(sim.ctx, p);
    expect(p.castingAbility).toBeNull();
    expect(p.channeling).toBe(false);
    expect(p.castRemaining).toBe(0);
    const stop = sim.drainEvents().find((e: any) => e.type === 'castStop' && e.entityId === p.id);
    expect(stop).toBeTruthy();
    expect((stop as any).success).toBe(false);
  });
});

describe('casting_lifecycle: pushbackCast', () => {
  it('delays a timed cast by CAST_PUSHBACK_SEC (does not cancel)', () => {
    const { sim, p } = makeSim('mage', 12);
    spawnTarget(sim, p);
    castAbility(sim.ctx, 'fireball', p.id);
    const rem0 = p.castRemaining;
    const tot0 = p.castTotal;
    pushbackCast(p);
    expect(p.castingAbility).toBe('fireball'); // delayed, NOT cancelled
    expect(p.castRemaining).toBeCloseTo(rem0 + CAST_PUSHBACK_SEC, 9);
    expect(p.castTotal).toBeCloseTo(tot0 + CAST_PUSHBACK_SEC, 9);
  });

  it('shaves a channel by CHANNEL_PUSHBACK_FRACTION of its total', () => {
    const { sim, p } = makeSim('warlock', 12);
    spawnTarget(sim, p);
    castAbility(sim.ctx, 'drain_life', p.id);
    const rem0 = p.castRemaining;
    const tot0 = p.castTotal;
    pushbackCast(p);
    expect(p.channeling).toBe(true);
    expect(p.castRemaining).toBeCloseTo(Math.max(0, rem0 - tot0 * CHANNEL_PUSHBACK_FRACTION), 9);
  });
});

describe('casting_lifecycle: spell queue', () => {
  it('a press outside the tail window still errors "You are busy."', () => {
    const { sim, p } = makeSim('mage', 12);
    spawnTarget(sim, p);
    sim.drainEvents();
    castAbility(sim.ctx, 'fireball', p.id);
    expect(p.castRemaining).toBeGreaterThan(CAST_QUEUE_WINDOW_SEC);
    castAbility(sim.ctx, 'fireball', p.id);
    expect(p.queuedCastAbility).toBeNull();
    const err = sim
      .drainEvents()
      .find((e: any) => e.type === 'error' && e.text === 'You are busy.');
    expect(err).toBeTruthy();
  });

  it('a press in the tail window queues instead of erroring, and later presses overwrite the slot', () => {
    const { sim, p, meta } = makeSim('mage', 12);
    spawnTarget(sim, p);
    castAbility(sim.ctx, 'fireball', p.id);
    while (p.castRemaining > CAST_QUEUE_WINDOW_SEC) updateCasting(sim.ctx, p, meta);
    expect(p.castingAbility).toBe('fireball'); // still mid-cast, inside the window now
    sim.drainEvents();
    castAbility(sim.ctx, 'frostbolt', p.id); // queues, no "You are busy." error
    expect(p.queuedCastAbility).toBe('frostbolt');
    expect(sim.drainEvents().some((e: any) => e.type === 'error')).toBe(false);
    castAbility(sim.ctx, 'fireball', p.id); // single-slot: overwrites the earlier queued press
    expect(p.queuedCastAbility).toBe('fireball');
  });

  it('fires the queued press automatically the instant the current cast completes', () => {
    const { sim, p, meta } = makeSim('mage', 12);
    spawnTarget(sim, p);
    castAbility(sim.ctx, 'fireball', p.id);
    // drive updateCasting + updateTimers (not sim.tick(), which also resolves
    // movement/LoS against a mob spawned at an untested position) so the GCD armed
    // at cast start decays too: fireball's 2.5s cast outlasts the 1.5s GCD, so by
    // completion fireQueuedCast's GCD guard is clear and it re-casts immediately.
    while (p.castRemaining > CAST_QUEUE_WINDOW_SEC) {
      updateCasting(sim.ctx, p, meta);
      updateTimers(p);
    }
    p.resource = p.maxResource; // afford the re-fired cast too, not just the first
    castAbility(sim.ctx, 'fireball', p.id);
    expect(p.queuedCastAbility).toBe('fireball');
    let n = 0;
    while (p.queuedCastAbility && n++ < 1000) {
      updateCasting(sim.ctx, p, meta);
      updateTimers(p);
    }
    expect(p.queuedCastAbility).toBeNull(); // consumed the instant the cast completed
    expect(p.castingAbility).toBe('fireball'); // the queued press is now casting, fresh
    expect(p.castRemaining).toBeGreaterThan(0);
  });

  it('re-validates the queued press fresh (dead target drops it instead of firing blind)', () => {
    const { sim, p, meta } = makeSim('mage', 12);
    const mob = spawnTarget(sim, p);
    castAbility(sim.ctx, 'fireball', p.id);
    while (p.castRemaining > CAST_QUEUE_WINDOW_SEC) {
      updateCasting(sim.ctx, p, meta);
      updateTimers(p);
    }
    castAbility(sim.ctx, 'fireball', p.id);
    expect(p.queuedCastAbility).toBe('fireball');
    mob.dead = true; // the queued press must re-validate target/range/etc at fire time
    let n = 0;
    while (p.queuedCastAbility && n++ < 1000) {
      updateCasting(sim.ctx, p, meta);
      updateTimers(p);
    }
    expect(p.queuedCastAbility).toBeNull(); // consumed (attempted), not stranded
    expect(p.castingAbility).toBeNull(); // re-validation rejected it (no target), nothing fired
  });

  it('an interrupted cast (cancelCast) drops the queued press instead of firing it', () => {
    const { sim, p, meta } = makeSim('mage', 12);
    spawnTarget(sim, p);
    castAbility(sim.ctx, 'fireball', p.id);
    while (p.castRemaining > CAST_QUEUE_WINDOW_SEC) updateCasting(sim.ctx, p, meta);
    castAbility(sim.ctx, 'fireball', p.id);
    expect(p.queuedCastAbility).toBe('fireball');
    cancelCast(sim.ctx, p);
    expect(p.queuedCastAbility).toBeNull();
    expect(p.castingAbility).toBeNull();
  });

  it('starting to fish drops a held queued press (fishing never fires the queue, so it must not strand)', () => {
    const { sim, p, meta } = makeSim('mage', 12);
    // Park a queued press by hand, as a GCD-held slot would (castingAbility null,
    // slot truthy). Fishing re-parks castingAbility without going through
    // fireQueuedCast, so without the startFishing clear this would misfire later.
    p.queuedCastAbility = 'fireball';
    p.castingAbility = null;
    (sim as any).hasFishableWaterAhead = () => true; // satisfy the water guard for the unit test
    (sim as any).startFishing(p, meta);
    expect(p.castingAbility).toBe('fishing');
    expect(p.queuedCastAbility).toBeNull(); // dropped, not stranded onto the next real cast
  });
});

describe('casting_lifecycle: determinism', () => {
  it('same seed + same module-driven sequence -> identical end state', () => {
    const run = () => {
      const { sim, p, meta } = makeSim('warlock', 12);
      const mob = spawnTarget(sim, p);
      p.hp = Math.max(1, p.maxHp - 300);
      castAbility(sim.ctx, 'drain_life', p.id);
      for (let i = 0; i < 22; i++) updateCasting(sim.ctx, p, meta); // a channel tick fires
      pushbackCast(p); // mid-channel pushback
      drainCast(sim, p, meta); // run to completion
      return { hp: p.hp, resource: p.resource, mobHp: mob.hp, casting: p.castingAbility };
    };
    expect(run()).toEqual(run());
  });
});
