// Sim-level integration coverage for the Profession Trainer command (PHAA-464
// multiclassing), noted as a test gap in the PHAA-534 QA review: only the pure
// cost core (secondaryClassCostFor) was unit-tested, not the sim.setSecondaryClass
// command itself. Covers copper spend, secondaryClsChanges increment, and the
// guard rejections (level < 10, illegal pick, insufficient funds).

import { describe, expect, it } from 'vitest';
import { SECONDARY_CLASS_CHANGE_COST } from '../src/sim/progression/trainer';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';

function makeSim(seed = 11) {
  // The Profession Trainer NPC (elder_yarrow) lives inside the Hollow hub
  // instance (`dynamic`, only spawned there), so joining must land the
  // player in the hub to find it (PHAA-404 hollowStart spawn policy).
  return new Sim({ seed, playerClass: 'warrior', autoEquip: false, hollowStart: true });
}

function standAtTrainer(sim: Sim): number {
  const trainer = [...sim.entities.values()].find(
    (e): e is Entity => e.kind === 'npc' && e.templateId === 'elder_yarrow',
  );
  if (!trainer) throw new Error('trainer NPC not found');
  const pos = sim.groundPos(trainer.pos.x, trainer.pos.z);
  sim.player.pos = { ...pos };
  sim.player.prevPos = { ...pos };
  return trainer.id;
}

describe('sim.setSecondaryClass (Profession Trainer command)', () => {
  it('the first pick is free and sets the secondary class', () => {
    const sim = makeSim();
    const trainerId = standAtTrainer(sim);
    sim.setPlayerLevel(10);
    const meta = sim.meta(sim.primaryId)!;
    const startingCopper = meta.copper;

    sim.setSecondaryClass(trainerId, 'mage');

    expect(meta.secondaryCls).toBe('mage');
    expect(meta.secondaryClsChanges).toBe(0);
    expect(meta.copper).toBe(startingCopper);
    const ev = sim.drainEvents().find((e) => e.type === 'trainer');
    expect(ev).toMatchObject({ type: 'trainer', action: 'setSecondaryClass', cls: 'mage' });
  });

  it('a later change charges the escalating fee and increments secondaryClsChanges', () => {
    const sim = makeSim();
    const trainerId = standAtTrainer(sim);
    sim.setPlayerLevel(10);
    const meta = sim.meta(sim.primaryId)!;
    sim.setSecondaryClass(trainerId, 'mage'); // first pick, free
    meta.copper = SECONDARY_CLASS_CHANGE_COST[0];

    sim.setSecondaryClass(trainerId, 'priest');

    expect(meta.secondaryCls).toBe('priest');
    expect(meta.secondaryClsChanges).toBe(1);
    expect(meta.copper).toBe(0);
  });

  it('rejects a pick below level 10 and leaves state untouched', () => {
    const sim = makeSim();
    const trainerId = standAtTrainer(sim);
    const meta = sim.meta(sim.primaryId)!;
    const startingCopper = meta.copper;
    expect(sim.player.level).toBeLessThan(10);

    sim.setSecondaryClass(trainerId, 'mage');

    expect(meta.secondaryCls).toBeNull();
    expect(meta.copper).toBe(startingCopper);
    const err = sim.drainEvents().find((e) => e.type === 'error');
    expect(err).toMatchObject({ type: 'error', text: expect.stringContaining('level 10') });
  });

  it('rejects picking your own primary class as the secondary', () => {
    const sim = makeSim();
    const trainerId = standAtTrainer(sim);
    sim.setPlayerLevel(10);
    const meta = sim.meta(sim.primaryId)!;
    const startingCopper = meta.copper;

    sim.setSecondaryClass(trainerId, 'warrior'); // meta's own primary class

    expect(meta.secondaryCls).toBeNull();
    expect(meta.copper).toBe(startingCopper);
    const err = sim.drainEvents().find((e) => e.type === 'error');
    expect(err).toMatchObject({
      type: 'error',
      text: expect.stringContaining('legal secondary profession'),
    });
  });

  it('rejects a change the player cannot afford, leaving copper and the current pick untouched', () => {
    const sim = makeSim();
    const trainerId = standAtTrainer(sim);
    sim.setPlayerLevel(10);
    const meta = sim.meta(sim.primaryId)!;
    sim.setSecondaryClass(trainerId, 'mage'); // first pick, free
    meta.copper = 0;

    sim.setSecondaryClass(trainerId, 'priest');

    expect(meta.secondaryCls).toBe('mage');
    expect(meta.secondaryClsChanges).toBe(0);
    expect(meta.copper).toBe(0);
    const err = sim.drainEvents().find((e) => e.type === 'error');
    expect(err).toMatchObject({ type: 'error', text: expect.stringContaining('Not enough money') });
  });
});
