// Collection tracking core (PHAA-625/626): reading a world readable is a real
// sim command now, resolved server-side, that marks the collectible's stable
// id collected exactly once, forever. Mirrors the gather-node harvest test
// shape (tests/gathering.test.ts): deny-without-throwing on every guard, one
// clean grant, and a persistence round-trip.

import { beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIBLES_BY_ID, READABLES } from '../src/sim/data';
import { Sim } from '../src/sim/sim';

describe('readCollectible (PHAA-626)', () => {
  const READABLE = READABLES[0];

  let sim: Sim;
  let pid: number;

  beforeEach(() => {
    sim = new Sim({ seed: 7, playerClass: 'warrior', noPlayer: true });
    pid = sim.addPlayer('warrior', 'Reader');
    const e = sim.entities.get(pid)!;
    e.pos = { x: READABLE.pos.x, y: 0, z: READABLE.pos.z };
    e.prevPos = { ...e.pos };
  });

  it('every readable has a matching CollectibleDef', () => {
    for (const r of READABLES) {
      expect(COLLECTIBLES_BY_ID[r.id]).toMatchObject({ kind: 'readable', zoneId: r.zoneId });
    }
  });

  it('a player near a readable collects it exactly once', () => {
    expect(sim.collectedIdsFor(pid)).not.toContain(READABLE.id);
    sim.readCollectible(READABLE.id, pid);
    expect(sim.collectedIdsFor(pid)).toEqual([READABLE.id]);
  });

  it('re-reading an already-collected id is inert (no duplicate, no error)', () => {
    sim.readCollectible(READABLE.id, pid);
    expect(() => sim.readCollectible(READABLE.id, pid)).not.toThrow();
    expect(sim.collectedIdsFor(pid)).toEqual([READABLE.id]);
  });

  it('denies collection when the player is too far from the readable', () => {
    const e = sim.entities.get(pid)!;
    e.pos = { x: READABLE.pos.x + 9999, y: 0, z: READABLE.pos.z };
    e.prevPos = { ...e.pos };
    sim.readCollectible(READABLE.id, pid);
    expect(sim.collectedIdsFor(pid)).not.toContain(READABLE.id);
  });

  it('denies collection for a dead player without throwing', () => {
    const e = sim.entities.get(pid)!;
    e.dead = true;
    expect(() => sim.readCollectible(READABLE.id, pid)).not.toThrow();
    expect(sim.collectedIdsFor(pid)).not.toContain(READABLE.id);
  });

  it('an unknown collectible id is denied without throwing', () => {
    expect(() => sim.readCollectible('not_a_real_collectible', pid)).not.toThrow();
    expect(sim.collectedIdsFor(pid)).toEqual([]);
  });

  it('one player collecting never marks it collected for another player', () => {
    const pidB = sim.addPlayer('warrior', 'Other');
    const eB = sim.entities.get(pidB)!;
    eB.pos = { x: READABLE.pos.x, y: 0, z: READABLE.pos.z };
    eB.prevPos = { ...eB.pos };

    sim.readCollectible(READABLE.id, pid);
    expect(sim.collectedIdsFor(pid)).toEqual([READABLE.id]);
    expect(sim.collectedIdsFor(pidB)).toEqual([]);
  });

  it('persists across serializeCharacter -> addPlayer (additive, back-compat)', () => {
    sim.readCollectible(READABLE.id, pid);
    const state = sim.serializeCharacter(pid)!;
    expect(state.collectedIds).toEqual([READABLE.id]);

    const sim2 = new Sim({ seed: 7, playerClass: 'warrior', noPlayer: true });
    const pid2 = sim2.addPlayer('warrior', 'Reader', { state });
    expect(sim2.collectedIdsFor(pid2)).toEqual([READABLE.id]);

    // pre-PHAA-626 saves carry no collectedIds field at all: back-compat default empty.
    const legacyState = { ...state, collectedIds: undefined };
    const sim3 = new Sim({ seed: 7, playerClass: 'warrior', noPlayer: true });
    const pid3 = sim3.addPlayer('warrior', 'Legacy', { state: legacyState });
    expect(sim3.collectedIdsFor(pid3)).toEqual([]);
  });
});
