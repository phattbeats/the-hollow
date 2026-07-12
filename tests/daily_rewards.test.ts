import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';

describe('grantDailyRewardCycleSlot (the online-only grant primitive)', () => {
  it('grants the copper for a given cycle index deterministically', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    const pid = sim.playerId;
    const before = sim.copper;
    const ok = sim.grantDailyRewardCycleSlot(0, pid);
    expect(ok).toBe(true);
    expect(sim.copper).toBeGreaterThan(before);
  });

  it('grants the slot item when bag space allows it', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    const pid = sim.playerId;
    sim.grantDailyRewardCycleSlot(1, pid); // slot 1: 2x baked_bread
    expect(sim.countItem('baked_bread')).toBe(2);
  });

  it('returns false for an unknown player id', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    expect(sim.grantDailyRewardCycleSlot(0, 999999)).toBe(false);
  });
});

describe('claimDailyReward (the offline self-contained IWorld member)', () => {
  it('grants the reward and advances the cycle on a fresh day', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    sim.utcDay = '2026-07-12';
    const before = sim.copper;
    sim.claimDailyReward();
    expect(sim.copper).toBeGreaterThan(before);
    expect(sim.dailyRewards.cycleIndex).toBe(1);
    expect(sim.dailyRewards.lastClaimUtcDay).toBe('2026-07-12');
  });

  it('is a no-op if the same utcDay claims twice (no double grant)', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    sim.utcDay = '2026-07-12';
    sim.claimDailyReward();
    const afterFirst = sim.copper;
    sim.claimDailyReward();
    expect(sim.copper).toBe(afterFirst);
    expect(sim.dailyRewards.cycleIndex).toBe(1);
  });

  it('is a no-op while reward-locked', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    sim.utcDay = '2026-07-12';
    sim.dailyRewards = { ...sim.dailyRewards, locked: true };
    const before = sim.copper;
    sim.claimDailyReward();
    expect(sim.copper).toBe(before);
    expect(sim.dailyRewards.lastClaimUtcDay).toBe('');
  });

  it('missing a day never resets the cycle (no streak-loss shape)', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior' });
    sim.utcDay = '2026-07-01';
    sim.claimDailyReward();
    expect(sim.dailyRewards.cycleIndex).toBe(1);
    // Skip six real days, claim again: index just advances from where it left off.
    sim.utcDay = '2026-07-08';
    sim.claimDailyReward();
    expect(sim.dailyRewards.cycleIndex).toBe(2);
  });
});
