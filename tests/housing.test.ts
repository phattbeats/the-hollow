// Housing v0 (the Hollow hub homesteads): claim/uniqueness/validation and the
// serialize/load round trip, mirroring the market persistence pattern.

import { beforeEach, describe, expect, it } from 'vitest';
import {
  HOLLOW_HOUSE_OBJECT_KINDS,
  HOLLOW_HOUSE_PLOTS,
  HOLLOW_HOUSE_SLOT_OFFSETS,
} from '../src/sim/content/hollow';
import { Sim } from '../src/sim/sim';

const SEED = 7;

function makeSim(): Sim {
  return new Sim({ seed: SEED, playerClass: 'warrior', playerName: 'Hosta' });
}

// Put the player inside a hub instance and stand them on the given plot.
function standOnPlot(sim: Sim, pid: number, plotIndex: number): void {
  sim.enterDungeon('the_hollow', pid);
  const info = sim.housingInfoFor(pid);
  expect(info?.origin).not.toBeNull();
  const plot = HOLLOW_HOUSE_PLOTS[plotIndex];
  const e = sim.entities.get(pid)!;
  e.pos.x = info!.origin!.x + plot.x;
  e.pos.z = info!.origin!.z + plot.z;
  e.prevPos = { ...e.pos };
}

describe('housing claim', () => {
  let sim: Sim;
  let p1: number;
  let p2: number;

  beforeEach(() => {
    sim = makeSim();
    p1 = sim.playerId; // the offline primary player
    p2 = sim.addPlayer('mage', 'Nabu', { accountKey: 'acct2' });
  });

  it('claims the plot you stand on inside the hub', () => {
    standOnPlot(sim, p1, 0);
    sim.housingClaim(p1);
    const info = sim.housingInfoFor(p1)!;
    const plot = info.plots.find((p) => p.plotId === HOLLOW_HOUSE_PLOTS[0].id)!;
    expect(plot.ownerName).toBe('Hosta');
    expect(plot.mine).toBe(true);
    expect(sim.housingRev).toBe(1);
  });

  it('rejects a claim outside the hub instance', () => {
    sim.housingClaim(p1); // still in the overworld
    expect(sim.housingRev).toBe(0);
    expect(sim.housingInfoFor(p1)!.plots.every((p) => p.ownerName === null)).toBe(true);
  });

  it('rejects a second plot for the same owner', () => {
    standOnPlot(sim, p1, 0);
    sim.housingClaim(p1);
    standOnPlot(sim, p1, 1);
    sim.housingClaim(p1);
    const info = sim.housingInfoFor(p1)!;
    expect(info.plots.filter((p) => p.ownerName !== null)).toHaveLength(1);
    expect(sim.housingRev).toBe(1);
  });

  it('rejects claiming an already-owned plot and lets two accounts own distinct plots', () => {
    standOnPlot(sim, p1, 2);
    sim.housingClaim(p1);
    // p2 (a different account) stands on the SAME plot id in their own instance
    standOnPlot(sim, p2, 2);
    sim.housingClaim(p2);
    let info = sim.housingInfoFor(p2)!;
    const contested = info.plots.find((p) => p.plotId === HOLLOW_HOUSE_PLOTS[2].id)!;
    expect(contested.ownerName).toBe('Hosta');
    expect(contested.mine).toBe(false);
    // a free plot claims fine, and both houses are visible to both viewers
    standOnPlot(sim, p2, 3);
    sim.housingClaim(p2);
    info = sim.housingInfoFor(p2)!;
    expect(
      info.plots
        .filter((p) => p.ownerName !== null)
        .map((p) => p.ownerName)
        .sort(),
    ).toEqual(['Hosta', 'Nabu']);
    const asP1 = sim.housingInfoFor(p1)!;
    expect(asP1.plots.filter((p) => p.ownerName !== null)).toHaveLength(2);
    expect(asP1.plots.find((p) => p.plotId === HOLLOW_HOUSE_PLOTS[3].id)!.mine).toBe(false);
  });

  it('routes /house chat commands through the sim chat router', () => {
    standOnPlot(sim, p1, 0);
    sim.chat('/house claim', p1);
    sim.chat('/house place 2 lantern', p1);
    const plot = sim.housingInfoFor(p1)!.plots.find((p) => p.mine)!;
    expect(plot.objects).toEqual([{ slot: 1, kind: 'lantern' }]);
    sim.chat('/house remove 2', p1);
    expect(sim.housingInfoFor(p1)!.plots.find((p) => p.mine)!.objects).toEqual([]);
  });
});

describe('housing decor placement', () => {
  let sim: Sim;
  let p1: number;

  beforeEach(() => {
    sim = makeSim();
    p1 = sim.playerId;
    standOnPlot(sim, p1, 0);
    sim.housingClaim(p1);
  });

  it('places, replaces, and removes decor on valid slots', () => {
    sim.housingPlace(0, 'planter', p1);
    sim.housingPlace(0, 'crate', p1); // replace at the same slot
    sim.housingPlace(3, 'bench', p1);
    let objects = sim.housingInfoFor(p1)!.plots.find((p) => p.mine)!.objects;
    expect(objects).toEqual([
      { slot: 0, kind: 'crate' },
      { slot: 3, kind: 'bench' },
    ]);
    sim.housingRemove(0, p1);
    objects = sim.housingInfoFor(p1)!.plots.find((p) => p.mine)!.objects;
    expect(objects).toEqual([{ slot: 3, kind: 'bench' }]);
  });

  it('rejects bad slots, unknown kinds, and placement by a non-owner', () => {
    const revBefore = sim.housingRev;
    sim.housingPlace(-1, 'crate', p1);
    sim.housingPlace(HOLLOW_HOUSE_SLOT_OFFSETS.length, 'crate', p1);
    sim.housingPlace(1.5, 'crate', p1);
    sim.housingPlace(0, 'throne', p1);
    const p2 = sim.addPlayer('mage', 'Nabu', { accountKey: 'acct2' });
    sim.enterDungeon('the_hollow', p2);
    sim.housingPlace(0, 'crate', p2); // owns no plot
    sim.housingRemove(0, p2);
    expect(sim.housingRev).toBe(revBefore);
    expect(sim.housingInfoFor(p1)!.plots.find((p) => p.mine)!.objects).toEqual([]);
  });
});

describe('housing serialize/load round trip', () => {
  it('survives a save/load into a fresh sim (the server-restart path)', () => {
    const sim = makeSim();
    const p1 = sim.playerId;
    standOnPlot(sim, p1, 1);
    sim.housingClaim(p1);
    sim.housingPlace(0, 'planter', p1);
    sim.housingPlace(2, 'lantern', p1);
    const save = JSON.parse(JSON.stringify(sim.serializeHousing()));

    const sim2 = makeSim();
    sim2.loadHousing(save);
    const p = sim2.addPlayer('mage', 'Nabu', { accountKey: 'acct2' });
    const info = sim2.housingInfoFor(p)!;
    const plot = info.plots.find((q) => q.plotId === HOLLOW_HOUSE_PLOTS[1].id)!;
    expect(plot.ownerName).toBe('Hosta');
    expect(plot.mine).toBe(false);
    expect(plot.objects).toEqual([
      { slot: 0, kind: 'planter' },
      { slot: 2, kind: 'lantern' },
    ]);
    // re-serialize is stable
    expect(sim2.serializeHousing()).toEqual(save);
  });

  it('drops corrupt rows: bad plot ids, bad kinds, out-of-range slots, duplicate owners', () => {
    const sim = makeSim();
    sim.loadHousing({
      plots: [
        { plotId: 'nope', ownerKey: 'a', ownerName: 'X', objects: [] },
        {
          plotId: HOLLOW_HOUSE_PLOTS[0].id,
          ownerKey: 'a',
          ownerName: 'A',
          objects: [
            { slot: 0, kind: HOLLOW_HOUSE_OBJECT_KINDS[0] },
            { slot: 99, kind: HOLLOW_HOUSE_OBJECT_KINDS[0] },
            { slot: 1, kind: 'throne' },
          ],
        },
        // same owner again on another plot: dropped (one house per account)
        { plotId: HOLLOW_HOUSE_PLOTS[1].id, ownerKey: 'a', ownerName: 'A', objects: [] },
        { plotId: HOLLOW_HOUSE_PLOTS[2].id, ownerKey: '', ownerName: 'B', objects: [] },
      ],
    } as never);
    const save = sim.serializeHousing();
    expect(save.plots).toHaveLength(1);
    expect(save.plots[0].plotId).toBe(HOLLOW_HOUSE_PLOTS[0].id);
    expect(save.plots[0].objects).toEqual([{ slot: 0, kind: HOLLOW_HOUSE_OBJECT_KINDS[0] }]);
  });

  it('accountKey (not character identity) is the owner key on the server path', () => {
    const sim = makeSim();
    const a = sim.addPlayer('mage', 'CharOne', { accountKey: 'acct9', characterId: 101 });
    standOnPlot(sim, a, 4);
    sim.housingClaim(a);
    // a second character on the SAME account may not claim another plot
    const b = sim.addPlayer('rogue', 'CharTwo', { accountKey: 'acct9', characterId: 102 });
    standOnPlot(sim, b, 5);
    sim.housingClaim(b);
    expect(sim.serializeHousing().plots).toHaveLength(1);
    expect(sim.housingInfoFor(b)!.plots.find((p) => p.mine)?.plotId).toBe(HOLLOW_HOUSE_PLOTS[4].id);
  });
});
