// Direct unit tests for the Dungeon Finder module (src/sim/social/dungeon_finder.ts,
// PHAA-736 phase 1): the fixed-capability role helper, the solo queue-join guards, and
// the end-of-tick matcher that pops a full tank+healer+3dps group into a freshly formed
// party and walks it into the dungeon via the existing instances/dungeons.ts door path.

import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import {
  classRoles,
  dungeonFinderInfoFor,
  dungeonFinderQueueJoin,
  dungeonFinderQueueLeave,
  updateDungeonFinder,
} from '../src/sim/social/dungeon_finder';
import type { Entity } from '../src/sim/types';

type AnySim = Sim & Record<string, any>;

function makeSim(seed = 42): AnySim {
  return new Sim({ seed, playerClass: 'warrior', noPlayer: true }) as AnySim;
}

describe('classRoles: fixed per-class capability (content/talents.ts spec roles)', () => {
  it('resolves the classic hybrid/pure archetypes', () => {
    expect(classRoles('warrior').sort()).toEqual(['dps', 'tank']);
    expect(classRoles('paladin').sort()).toEqual(['dps', 'healer', 'tank']);
    expect(classRoles('priest').sort()).toEqual(['dps', 'healer']);
    expect(classRoles('shaman').sort()).toEqual(['dps', 'healer']);
    expect(classRoles('druid').sort()).toEqual(['dps', 'healer', 'tank']);
    expect(classRoles('hunter')).toEqual(['dps']);
    expect(classRoles('rogue')).toEqual(['dps']);
    expect(classRoles('mage')).toEqual(['dps']);
    expect(classRoles('warlock')).toEqual(['dps']);
  });
});

describe('dungeonFinderQueueJoin: guards', () => {
  it('rejects a role the class cannot fill', () => {
    const sim = makeSim();
    const pid = sim.addPlayer('mage', 'Zed');
    dungeonFinderQueueJoin(sim.ctx, 'tank', undefined, pid);
    expect(dungeonFinderInfoFor(sim.ctx, pid).queued).toBe(false);
  });

  it('rejects an unknown dungeon id', () => {
    const sim = makeSim();
    const pid = sim.addPlayer('warrior', 'Zed');
    dungeonFinderQueueJoin(sim.ctx, 'tank', 'not_a_real_dungeon', pid);
    expect(dungeonFinderInfoFor(sim.ctx, pid).queued).toBe(false);
  });

  it('rejects a dead player', () => {
    const sim = makeSim();
    const pid = sim.addPlayer('warrior', 'Zed');
    (sim.entities.get(pid) as Entity).dead = true;
    dungeonFinderQueueJoin(sim.ctx, 'tank', undefined, pid);
    expect(dungeonFinderInfoFor(sim.ctx, pid).queued).toBe(false);
  });

  it('rejects a player already in a multi-member party', () => {
    const sim = makeSim();
    const a = sim.addPlayer('warrior', 'Aaa');
    const b = sim.addPlayer('priest', 'Bbb');
    sim.partyInvite(b, a);
    sim.partyAccept(b);
    dungeonFinderQueueJoin(sim.ctx, 'tank', undefined, a);
    expect(dungeonFinderInfoFor(sim.ctx, a).queued).toBe(false);
  });

  it('accepts a valid solo join and reports queue position', () => {
    const sim = makeSim();
    const pid = sim.addPlayer('warrior', 'Zed');
    dungeonFinderQueueJoin(sim.ctx, 'tank', undefined, pid);
    const info = dungeonFinderInfoFor(sim.ctx, pid);
    expect(info).toEqual({ queued: true, role: 'tank', dungeonId: 'hollow_crypt', position: 1 });
  });

  it('leaving the queue clears the entry', () => {
    const sim = makeSim();
    const pid = sim.addPlayer('warrior', 'Zed');
    dungeonFinderQueueJoin(sim.ctx, 'tank', undefined, pid);
    dungeonFinderQueueLeave(sim.ctx, pid);
    expect(dungeonFinderInfoFor(sim.ctx, pid).queued).toBe(false);
  });
});

describe('updateDungeonFinder: stale-entry re-validation', () => {
  it('drops (and does not match) a queued solo player who has since joined a real party', () => {
    const sim = makeSim();
    const tank = sim.addPlayer('warrior', 'Tank');
    const healer = sim.addPlayer('priest', 'Healer');
    const dps1 = sim.addPlayer('mage', 'Dps1');
    const dps2 = sim.addPlayer('rogue', 'Dps2');
    const dps3 = sim.addPlayer('hunter', 'Dps3');
    dungeonFinderQueueJoin(sim.ctx, 'tank', undefined, tank);
    dungeonFinderQueueJoin(sim.ctx, 'healer', undefined, healer);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps1);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps2);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps3);

    // The queued tank accepts an unrelated party invite before the next tick.
    const outsider = sim.addPlayer('warlock', 'Outsider');
    sim.partyInvite(tank, outsider);
    sim.partyAccept(tank);
    const realParty = sim.partyOf(tank);
    expect(realParty?.members.length).toBe(2);

    updateDungeonFinder(sim.ctx);

    // The stale entry was dropped, not matched: the real party is untouched
    // (not overwritten by formPartyFromRoster), and the tank never entered hollow_crypt.
    expect(dungeonFinderInfoFor(sim.ctx, tank).queued).toBe(false);
    expect(sim.partyOf(tank)?.id).toBe(realParty?.id);
    expect(sim.partyOf(tank)?.members.length).toBe(2);
    expect(sim.instanceSlotAt((sim.entities.get(tank) as Entity).pos)).toBeNull();
  });
});

describe('updateDungeonFinder: the end-of-tick matcher', () => {
  it('does not match until a full 1 tank + 1 healer + 3 dps group is queued', () => {
    const sim = makeSim();
    const tank = sim.addPlayer('warrior', 'Tank');
    const healer = sim.addPlayer('priest', 'Healer');
    const dps1 = sim.addPlayer('mage', 'Dps1');
    dungeonFinderQueueJoin(sim.ctx, 'tank', undefined, tank);
    dungeonFinderQueueJoin(sim.ctx, 'healer', undefined, healer);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps1);

    updateDungeonFinder(sim.ctx);

    expect(dungeonFinderInfoFor(sim.ctx, tank).queued).toBe(true);
    expect(sim.partyOf(tank)).toBeNull();
  });

  it('forms a party of 5 and walks the group into the dungeon once the roles fill', () => {
    const sim = makeSim();
    const tank = sim.addPlayer('warrior', 'Tank');
    const healer = sim.addPlayer('priest', 'Healer');
    const dps1 = sim.addPlayer('mage', 'Dps1');
    const dps2 = sim.addPlayer('rogue', 'Dps2');
    const dps3 = sim.addPlayer('hunter', 'Dps3');
    const pids = [tank, healer, dps1, dps2, dps3];
    dungeonFinderQueueJoin(sim.ctx, 'tank', undefined, tank);
    dungeonFinderQueueJoin(sim.ctx, 'healer', undefined, healer);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps1);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps2);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps3);

    updateDungeonFinder(sim.ctx);

    // The queue is drained and every member landed in the same real party.
    for (const pid of pids) {
      expect(dungeonFinderInfoFor(sim.ctx, pid).queued).toBe(false);
    }
    const party = sim.partyOf(tank);
    expect(party).not.toBeNull();
    expect(party?.members.slice().sort((a, b) => a - b)).toEqual(
      pids.slice().sort((a, b) => a - b),
    );
    for (const pid of pids.slice(1)) {
      expect(sim.partyOf(pid)?.id).toBe(party?.id);
    }

    // Every member was actually teleported into the same hollow_crypt instance.
    const slots = new Set(
      pids.map((pid) => sim.instanceSlotAt((sim.entities.get(pid) as Entity).pos)),
    );
    expect(slots.size).toBe(1);
    expect([...slots][0]).not.toBeNull();
  });

  it('a hybrid class can fill the scarce role a pure-dps class cannot', () => {
    // Paladin can tank; this proves the matcher accepts any class whose
    // classRoles() covers the role picked at queue time, not a hardcoded id.
    const sim = makeSim();
    const tank = sim.addPlayer('paladin', 'Tank');
    const healer = sim.addPlayer('shaman', 'Healer');
    const dps1 = sim.addPlayer('warlock', 'Dps1');
    const dps2 = sim.addPlayer('druid', 'Dps2');
    const dps3 = sim.addPlayer('hunter', 'Dps3');
    dungeonFinderQueueJoin(sim.ctx, 'tank', undefined, tank);
    dungeonFinderQueueJoin(sim.ctx, 'healer', undefined, healer);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps1);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps2);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps3);

    updateDungeonFinder(sim.ctx);

    expect(sim.partyOf(tank)?.members.length).toBe(5);
  });

  it('is FIFO within each role bucket: the earliest joiner is matched, later ones stay queued', () => {
    const sim = makeSim();
    const tankEarly = sim.addPlayer('warrior', 'TankEarly');
    const tankLate = sim.addPlayer('paladin', 'TankLate');
    const healer = sim.addPlayer('priest', 'Healer');
    const dps1 = sim.addPlayer('mage', 'Dps1');
    const dps2 = sim.addPlayer('rogue', 'Dps2');
    const dps3 = sim.addPlayer('hunter', 'Dps3');
    const dpsLate = sim.addPlayer('warlock', 'DpsLate');

    // Queue the eventual match's members first, then a second tank and a
    // second dps that must NOT be pulled ahead of an earlier same-role entry.
    dungeonFinderQueueJoin(sim.ctx, 'tank', undefined, tankEarly);
    dungeonFinderQueueJoin(sim.ctx, 'healer', undefined, healer);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps1);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps2);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dps3);
    dungeonFinderQueueJoin(sim.ctx, 'tank', undefined, tankLate);
    dungeonFinderQueueJoin(sim.ctx, 'dps', undefined, dpsLate);

    updateDungeonFinder(sim.ctx);

    const party = sim.partyOf(tankEarly);
    expect(party).not.toBeNull();
    expect(party?.members.slice().sort((a, b) => a - b)).toEqual(
      [tankEarly, healer, dps1, dps2, dps3].slice().sort((a, b) => a - b),
    );
    // The later tank and dps were not pulled into the match and remain queued.
    expect(dungeonFinderInfoFor(sim.ctx, tankLate)).toEqual({
      queued: true,
      role: 'tank',
      dungeonId: 'hollow_crypt',
      position: 1,
    });
    expect(dungeonFinderInfoFor(sim.ctx, dpsLate)).toEqual({
      queued: true,
      role: 'dps',
      dungeonId: 'hollow_crypt',
      position: 1,
    });
  });
});
