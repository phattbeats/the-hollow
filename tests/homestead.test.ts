// Homestead v0 (the open-world Hollow Reaches plots): quest-arc gate,
// placement/collision-avoidance, and the serialize/load round trip,
// mirroring tests/housing.test.ts's coverage of the Sanctum tier.

import { beforeEach, describe, expect, it } from 'vitest';
import { HOLLOW_QUEST_ORDER } from '../src/sim/content/hollow';
import { HOLLOW_HOMESTEAD_AREA, HOLLOW_ZONE_CAMPS } from '../src/sim/content/hollow_zone';
import { Sim } from '../src/sim/sim';

const SEED = 7;

// Two valid, mutually-clear claim spots inside the buildable area, both far
// enough from the gate/lake/graveyard/Fallow Acres wolf camp/roads.
// (-85,-220) predates main's #83 camp-decor pass, which put a wildlife camp
// within clearance of it; (-85,-234) is clear of every ring and >MIN_SEPARATION
// from SPOT_B.
const SPOT_A = { x: -85, z: -234 };
const SPOT_B = { x: -90, z: -260 };
// Inside the buildable area but inside the Fallow Acres camp's clearance ring.
const SPOT_IN_CAMP = { x: HOLLOW_ZONE_CAMPS[0].center.x, z: HOLLOW_ZONE_CAMPS[0].center.z };
// Outside the buildable area entirely (east of it, near the hub).
const SPOT_OUTSIDE = { x: 0, z: -220 };

function makeSim(): Sim {
  return new Sim({ seed: SEED, playerClass: 'warrior', playerName: 'Hosta' });
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

describe('homestead claim gate', () => {
  let sim: Sim;
  let p1: number;

  beforeEach(() => {
    sim = makeSim();
    p1 = sim.playerId;
  });

  it('rejects a claim before the full Greenpaw quest arc is done', () => {
    standAt(sim, p1, SPOT_A);
    sim.homesteadClaim(p1);
    expect(sim.homesteadRev).toBe(0);
    expect(sim.homesteadInfoFor(p1)!.plots).toHaveLength(0);
  });

  it('rejects a claim with only a partial arc done', () => {
    sim.players.get(p1)!.questsDone.add(HOLLOW_QUEST_ORDER[0]);
    standAt(sim, p1, SPOT_A);
    sim.homesteadClaim(p1);
    expect(sim.homesteadRev).toBe(0);
  });

  it('claims a valid spot once the full arc is done', () => {
    grantGreenpawArc(sim, p1);
    standAt(sim, p1, SPOT_A);
    sim.homesteadClaim(p1);
    const info = sim.homesteadInfoFor(p1)!;
    expect(info.plots).toHaveLength(1);
    expect(info.plots[0]).toMatchObject({
      x: SPOT_A.x,
      z: SPOT_A.z,
      ownerName: 'Hosta',
      mine: true,
    });
    expect(sim.homesteadRev).toBe(1);
  });
});

describe('homestead placement / collision-avoidance', () => {
  let sim: Sim;
  let p1: number;

  beforeEach(() => {
    sim = makeSim();
    p1 = sim.playerId;
    grantGreenpawArc(sim, p1);
  });

  it('rejects a spot outside the buildable area', () => {
    standAt(sim, p1, SPOT_OUTSIDE);
    sim.homesteadClaim(p1);
    expect(sim.homesteadRev).toBe(0);
  });

  it('rejects a spot inside the Fallow Acres wolf camp clearance ring', () => {
    standAt(sim, p1, SPOT_IN_CAMP);
    sim.homesteadClaim(p1);
    expect(sim.homesteadRev).toBe(0);
  });

  it('rejects a second plot placed too close to an existing one, but allows a clear one', () => {
    standAt(sim, p1, SPOT_A);
    sim.homesteadClaim(p1);
    const p2 = sim.addPlayer('mage', 'Nabu', { accountKey: 'acct2' });
    grantGreenpawArc(sim, p2);
    // Right next to SPOT_A's owner, well inside the minimum-separation ring.
    standAt(sim, p2, { x: SPOT_A.x + 10, z: SPOT_A.z });
    sim.homesteadClaim(p2);
    expect(sim.homesteadInfoFor(p1)!.plots).toHaveLength(1);
    // A spot far enough away claims fine.
    standAt(sim, p2, SPOT_B);
    sim.homesteadClaim(p2);
    const info = sim.homesteadInfoFor(p1)!;
    expect(info.plots.map((p) => p.ownerName).sort()).toEqual(['Hosta', 'Nabu']);
  });

  it('rejects a second homestead for the same owner', () => {
    standAt(sim, p1, SPOT_A);
    sim.homesteadClaim(p1);
    standAt(sim, p1, SPOT_B);
    sim.homesteadClaim(p1);
    expect(sim.homesteadInfoFor(p1)!.plots).toHaveLength(1);
    expect(sim.homesteadRev).toBe(1);
  });

  it('routes /homestead chat commands through the sim chat router', () => {
    standAt(sim, p1, SPOT_A);
    sim.chat('/homestead claim', p1);
    expect(sim.homesteadInfoFor(p1)!.plots).toHaveLength(1);
    // Re-issuing the command errors (self-only notice) without changing state.
    sim.chat('/homestead claim', p1);
    expect(sim.homesteadInfoFor(p1)!.plots).toHaveLength(1);
  });
});

describe('homestead serialize/load round trip', () => {
  it('survives a save/load into a fresh sim (the server-restart path)', () => {
    const sim = makeSim();
    const p1 = sim.playerId;
    grantGreenpawArc(sim, p1);
    standAt(sim, p1, SPOT_A);
    sim.homesteadClaim(p1);
    const save = JSON.parse(JSON.stringify(sim.serializeHomestead()));

    const sim2 = makeSim();
    sim2.loadHomestead(save);
    const p = sim2.addPlayer('mage', 'Nabu', { accountKey: 'acct2' });
    const info = sim2.homesteadInfoFor(p)!;
    expect(info.plots).toHaveLength(1);
    expect(info.plots[0]).toMatchObject({
      x: SPOT_A.x,
      z: SPOT_A.z,
      ownerName: 'Hosta',
      mine: false,
    });
    // re-serialize is stable
    expect(sim2.serializeHomestead()).toEqual(save);
  });

  it('drops corrupt rows: missing coords, blank owner keys, duplicate owners', () => {
    const sim = makeSim();
    sim.loadHomestead({
      plots: [
        { ownerKey: 'a', ownerName: 'A', x: -85, z: -234 },
        // same owner again: dropped (one homestead per account)
        { ownerKey: 'a', ownerName: 'A', x: -90, z: -260 },
        { ownerKey: '', ownerName: 'B', x: -80, z: -230 },
        { ownerKey: 'c', ownerName: 'C', x: 'nope', z: -230 },
      ],
    } as never);
    const save = sim.serializeHomestead();
    expect(save.plots).toHaveLength(1);
    expect(save.plots[0]).toMatchObject({ ownerKey: 'a', x: -85, z: -234 });
  });

  it('accountKey (not character identity) is the owner key on the server path', () => {
    const sim = makeSim();
    const a = sim.addPlayer('mage', 'CharOne', { accountKey: 'acct9', characterId: 101 });
    grantGreenpawArc(sim, a);
    standAt(sim, a, SPOT_A);
    sim.homesteadClaim(a);
    // a second character on the SAME account may not claim another homestead
    const b = sim.addPlayer('rogue', 'CharTwo', { accountKey: 'acct9', characterId: 102 });
    grantGreenpawArc(sim, b);
    standAt(sim, b, SPOT_B);
    sim.homesteadClaim(b);
    expect(sim.serializeHomestead().plots).toHaveLength(1);
  });
});

// Sanity check on the fixture geometry itself: SPOT_A/SPOT_B must actually
// sit inside the documented buildable box, or the tests above would be
// exercising the wrong rejection reason.
describe('homestead test fixtures', () => {
  it('SPOT_A and SPOT_B are inside HOLLOW_HOMESTEAD_AREA', () => {
    for (const spot of [SPOT_A, SPOT_B]) {
      expect(spot.x).toBeGreaterThanOrEqual(HOLLOW_HOMESTEAD_AREA.xMin);
      expect(spot.x).toBeLessThanOrEqual(HOLLOW_HOMESTEAD_AREA.xMax);
      expect(spot.z).toBeGreaterThanOrEqual(HOLLOW_HOMESTEAD_AREA.zMin);
      expect(spot.z).toBeLessThanOrEqual(HOLLOW_HOMESTEAD_AREA.zMax);
    }
  });
});
