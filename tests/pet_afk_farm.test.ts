import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { Entity } from '../src/sim/types';

// Anti-AFK gate on aggressive pet auto-pull (hunter/warlock). An aggressive pet
// proactively pulls nearby hostiles only while the owner is actually playing; an
// idle owner's pet still DEFENDS (mob attacking owner/pet, or owner attacking a
// mob) but must not farm the area on its own. See petPickTarget + PET_OWNER_IDLE_TICKS.

const makeWorld = () => new Sim({ seed: 42, playerClass: 'hunter', noPlayer: true });

// Adopt a wild mob as the player's pet (mirrors a completed tame).
function givePet(sim: Sim, ownerPid: number): Entity {
  for (const e of sim.entities.values()) {
    if (e.kind === 'mob' && !e.dead && e.ownerId === null) {
      e.ownerId = ownerPid;
      e.hostile = false;
      e.hp = e.maxHp;
      return e;
    }
  }
  throw new Error('no wild mob available to adopt as a pet');
}

// A second, unowned, hostile wild mob to serve as the pull target.
function findWildHostile(sim: Sim, excludeId: number): Entity {
  for (const e of sim.entities.values()) {
    if (e.kind === 'mob' && !e.dead && e.ownerId === null && e.id !== excludeId) {
      e.hostile = true;
      return e;
    }
  }
  throw new Error('no second wild mob available');
}

function place(e: Entity, x: number, z: number): void {
  e.pos.x = x; e.pos.z = z;
  e.prevPos = { ...e.pos };
}

// Set up: aggressive pet next to the owner, a hostile mob 5yd from the pet that
// is NOT engaging anyone (so only the `aggressive` auto-pull branch can grab it).
function setup() {
  const sim = makeWorld();
  const pid = sim.addPlayer('hunter', 'Aleph');
  const owner = sim.entities.get(pid)!;
  const pet = givePet(sim, pid);
  sim.setPetMode('aggressive', pid);
  const target = findWildHostile(sim, pet.id);
  place(owner, 0, 0);
  place(pet, 1, 0);
  place(target, 6, 0); // 5yd from the pet, within PET_AGGRESSIVE_RANGE (18)
  target.aggroTargetId = null; // not engaging the owner or pet
  owner.targetId = null;
  owner.autoAttack = false;
  const meta = sim.meta(pid)!;
  const pick = (): Entity | null => (sim as any).petPickTarget(pet, owner);
  return { sim, pid, owner, pet, target, meta, pick };
}

describe('aggressive pet AFK-farm gate', () => {
  it('an ACTIVE owner\'s aggressive pet auto-pulls a nearby hostile', () => {
    const { sim, target, meta, pick } = setup();
    meta.lastActiveTick = sim.tickCount; // just acted
    expect(pick()?.id).toBe(target.id);
  });

  it('an IDLE owner\'s aggressive pet does NOT auto-pull a non-engaging hostile', () => {
    const { sim, meta, pick } = setup();
    meta.lastActiveTick = sim.tickCount - 100000; // long idle
    expect(pick()).toBeNull();
  });

  it('an IDLE owner\'s pet STILL defends when a mob engages the owner', () => {
    const { sim, owner, target, meta, pick } = setup();
    meta.lastActiveTick = sim.tickCount - 100000; // long idle
    target.aggroTargetId = owner.id; // the mob attacks the owner
    expect(pick()?.id).toBe(target.id);
  });
});
