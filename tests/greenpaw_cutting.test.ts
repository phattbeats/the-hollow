// Greenpaw's cutting (PHAA-751): the plant-at-your-homestead gate, growth
// timing, cosmetic variant determinism, the companion entity lifecycle, and
// the serialize/load round trip. Mirrors tests/homestead.test.ts's coverage
// style (grant the arc, stand at a spot, drive the sim, assert on state).

import { beforeEach, describe, expect, it } from 'vitest';
import { GREENPAW_COMPANION_MOB_IDS, HOLLOW_QUEST_ORDER } from '../src/sim/content/hollow';
import { GROWTH_DURATION } from '../src/sim/greenpaw_cutting';
import { Sim } from '../src/sim/sim';
import type { Entity, SimEvent } from '../src/sim/types';

const SEED = 7;
// Same valid, clear claim spot homestead.test.ts uses.
const SPOT_A = { x: -85, z: -234 };
const SPOT_FAR = { x: 0, z: -220 }; // outside the homestead area entirely

function makeSim(seed = SEED): Sim {
  return new Sim({ seed, playerClass: 'warrior', playerName: 'Hosta' });
}

function grantGreenpawArc(sim: Sim, pid: number): void {
  const meta = sim.players.get(pid)!;
  for (const qid of HOLLOW_QUEST_ORDER) meta.questsDone.add(qid);
}

function standAt(sim: Sim, pid: number, pos: { x: number; z: number }): void {
  const e = sim.entities.get(pid)!;
  e.pos.x = pos.x;
  e.pos.z = pos.z;
  e.prevPos = { ...e.pos };
}

// Grants the full arc, claims SPOT_A, hands over first_cutting, and leaves the
// player standing on their own plot: the exact state plant() needs to succeed.
function readyToPlant(sim: Sim, pid: number): void {
  grantGreenpawArc(sim, pid);
  standAt(sim, pid, SPOT_A);
  sim.homesteadClaim(pid);
  sim.addItem('first_cutting', 1, pid);
}

function errorTexts(events: SimEvent[]): string[] {
  return events
    .filter((e): e is Extract<SimEvent, { type: 'error' }> => e.type === 'error')
    .map((e) => e.text);
}

function logTexts(events: SimEvent[]): string[] {
  return events
    .filter((e): e is Extract<SimEvent, { type: 'log' }> => e.type === 'log')
    .map((e) => e.text);
}

function companionFor(sim: Sim, ownerPid: number): Entity | undefined {
  return [...sim.entities.values()].find((e) => e.kind === 'mob' && e.ownerId === ownerPid);
}

describe('greenpaw_cutting.plant gate', () => {
  let sim: Sim;
  let p1: number;

  beforeEach(() => {
    sim = makeSim();
    p1 = sim.playerId;
  });

  it('refuses to plant without owning first_cutting (generic no-item gate, before the plant branch)', () => {
    grantGreenpawArc(sim, p1);
    standAt(sim, p1, SPOT_A);
    sim.homesteadClaim(p1);
    sim.drainEvents();
    sim.useItem('first_cutting', p1);
    const errs = errorTexts(sim.drainEvents());
    expect(errs.some((t) => /don't have that item/i.test(t))).toBe(true);
    expect(sim.greenpawCutting.serialize().cuttings).toHaveLength(0);
  });

  it('refuses to plant without a claimed homestead plot', () => {
    sim.addItem('first_cutting', 1, p1);
    sim.drainEvents();
    sim.useItem('first_cutting', p1);
    const errs = errorTexts(sim.drainEvents());
    expect(errs.some((t) => /need a homestead plot/i.test(t))).toBe(true);
    expect(sim.countItem('first_cutting', p1)).toBe(1); // untouched
    expect(sim.greenpawCutting.serialize().cuttings).toHaveLength(0);
  });

  it('refuses to plant far from your own plot', () => {
    grantGreenpawArc(sim, p1);
    standAt(sim, p1, SPOT_A);
    sim.homesteadClaim(p1);
    sim.addItem('first_cutting', 1, p1);
    standAt(sim, p1, SPOT_FAR);
    sim.drainEvents();
    sim.useItem('first_cutting', p1);
    const errs = errorTexts(sim.drainEvents());
    expect(errs.some((t) => /must be at your own homestead/i.test(t))).toBe(true);
    expect(sim.greenpawCutting.serialize().cuttings).toHaveLength(0);
  });

  it('plants successfully at your own plot: consumes the item, records the cutting', () => {
    readyToPlant(sim, p1);
    sim.drainEvents();
    sim.useItem('first_cutting', p1);
    expect(sim.countItem('first_cutting', p1)).toBe(0);
    const logs = logTexts(sim.drainEvents());
    expect(logs.some((t) => /plant the cutting/i.test(t))).toBe(true);
    const cuttings = sim.greenpawCutting.serialize().cuttings;
    expect(cuttings).toHaveLength(1);
    expect(cuttings[0]).toMatchObject({ ownerName: 'Hosta', x: SPOT_A.x, z: SPOT_A.z, growth: 0 });
    expect(GREENPAW_COMPANION_MOB_IDS as readonly string[]).toContain(cuttings[0].mobTemplateId);
  });

  it('refuses a second planting', () => {
    readyToPlant(sim, p1);
    sim.useItem('first_cutting', p1);
    sim.addItem('first_cutting', 1, p1); // a second copy, somehow
    sim.drainEvents();
    sim.useItem('first_cutting', p1);
    const errs = errorTexts(sim.drainEvents());
    expect(errs.some((t) => /already planted/i.test(t))).toBe(true);
    expect(sim.greenpawCutting.serialize().cuttings).toHaveLength(1);
  });
});

describe('greenpaw_cutting growth timing + companion spawn', () => {
  let sim: Sim;
  let p1: number;

  beforeEach(() => {
    sim = makeSim();
    p1 = sim.playerId;
    readyToPlant(sim, p1);
    sim.useItem('first_cutting', p1);
  });

  it('does not spawn the companion before GROWTH_DURATION elapses', () => {
    sim.greenpawCutting.update(GROWTH_DURATION - 1);
    expect(sim.greenpawCutting.serialize().cuttings[0].growth).toBe(GROWTH_DURATION - 1);
    expect(companionFor(sim, p1)).toBeUndefined();
  });

  it('spawns a non-hostile owned companion once GROWTH_DURATION elapses, and clamps growth', () => {
    sim.drainEvents();
    sim.greenpawCutting.update(GROWTH_DURATION + 500);
    expect(sim.greenpawCutting.serialize().cuttings[0].growth).toBe(GROWTH_DURATION);
    const companion = companionFor(sim, p1);
    expect(companion).toBeDefined();
    expect(companion!.hostile).toBe(false);
    expect(GREENPAW_COMPANION_MOB_IDS as readonly string[]).toContain(companion!.templateId);
    const logs = logTexts(sim.drainEvents());
    expect(logs.some((t) => /grown into a companion/i.test(t))).toBe(true);
  });

  it('does not double-spawn on repeated update() calls once already grown', () => {
    sim.greenpawCutting.update(GROWTH_DURATION + 1);
    const first = companionFor(sim, p1)!.id;
    sim.greenpawCutting.update(1000);
    expect(companionFor(sim, p1)!.id).toBe(first);
    expect([...sim.entities.values()].filter((e) => e.ownerId === p1)).toHaveLength(1);
  });

  it('the companion follows its owner once grown (mob-AI dispatch, real tick)', () => {
    sim.greenpawCutting.update(GROWTH_DURATION + 1);
    const companion = companionFor(sim, p1)!;
    // Push the owner far from the companion's spawn point, then let the sim
    // tick drive the mob-AI dispatch (isGreenpawCompanionMob -> updateGreenpawCompanion).
    standAt(sim, p1, { x: SPOT_A.x + 20, z: SPOT_A.z + 20 });
    const before = { x: companion.pos.x, z: companion.pos.z };
    for (let i = 0; i < 40; i++) sim.tick();
    expect(companion.pos.x !== before.x || companion.pos.z !== before.z).toBe(true);
  });
});

describe('greenpaw_cutting cosmetic variant determinism', () => {
  it('the same seed and action sequence rolls the same variant', () => {
    function variantFor(seed: number): string {
      const sim = makeSim(seed);
      const pid = sim.playerId;
      readyToPlant(sim, pid);
      sim.useItem('first_cutting', pid);
      return sim.greenpawCutting.serialize().cuttings[0].mobTemplateId;
    }
    expect(variantFor(SEED)).toBe(variantFor(SEED));
  });
});

describe('greenpaw_cutting serialize/load round trip', () => {
  it('survives a save/load into a fresh sim (the server-restart path), including growth', () => {
    const sim = makeSim();
    const p1 = sim.playerId;
    readyToPlant(sim, p1);
    sim.useItem('first_cutting', p1);
    sim.greenpawCutting.update(GROWTH_DURATION / 2);
    const save = JSON.parse(JSON.stringify(sim.greenpawCutting.serialize()));

    const sim2 = makeSim();
    sim2.loadGreenpawCutting(save);
    // Not spawned yet: growth is at the halfway point and nobody with this
    // ownerKey is online in sim2.
    expect(companionFor(sim2, sim2.playerId)).toBeUndefined();
    expect(sim2.greenpawCutting.serialize()).toEqual(save);
  });

  it('drops corrupt rows: missing coords, blank owner keys, an unknown mob id, duplicate owners', () => {
    const sim = makeSim();
    sim.loadGreenpawCutting({
      cuttings: [
        {
          ownerKey: 'a',
          ownerName: 'A',
          x: -85,
          z: -234,
          growth: 10,
          mobTemplateId: 'greenpaw_cutting_dawn',
        },
        // same owner again: dropped (one cutting per account)
        {
          ownerKey: 'a',
          ownerName: 'A',
          x: -90,
          z: -260,
          growth: 0,
          mobTemplateId: 'greenpaw_cutting_moss',
        },
        {
          ownerKey: '',
          ownerName: 'B',
          x: -80,
          z: -230,
          growth: 0,
          mobTemplateId: 'greenpaw_cutting_ash',
        },
        {
          ownerKey: 'c',
          ownerName: 'C',
          x: 'nope',
          z: -230,
          growth: 0,
          mobTemplateId: 'greenpaw_cutting_ash',
        },
        {
          ownerKey: 'd',
          ownerName: 'D',
          x: -80,
          z: -230,
          growth: 0,
          mobTemplateId: 'not_a_real_mob',
        },
      ],
    } as never);
    const save = sim.greenpawCutting.serialize();
    expect(save.cuttings).toHaveLength(1);
    expect(save.cuttings[0]).toMatchObject({ ownerKey: 'a', x: -85, z: -234, growth: 10 });
  });

  it('spawns the companion on join once already grown from a prior session', () => {
    const sim = makeSim();
    sim.loadGreenpawCutting({
      cuttings: [
        {
          ownerKey: 'acct9',
          ownerName: 'CharOne',
          x: SPOT_A.x,
          z: SPOT_A.z,
          growth: GROWTH_DURATION,
          mobTemplateId: 'greenpaw_cutting_dawn',
        },
      ],
    });
    const pid = sim.addPlayer('mage', 'CharOne', { accountKey: 'acct9' });
    expect(companionFor(sim, pid)).toBeDefined();
  });
});
