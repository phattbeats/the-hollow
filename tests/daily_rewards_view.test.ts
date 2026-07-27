import { describe, expect, it } from 'vitest';
import type { DailyRewardEntry } from '../src/sim/content/daily_rewards';
import { buildDailyRewardsView } from '../src/ui/daily_rewards_view';

const CYCLE: DailyRewardEntry[] = [
  { copper: 15 },
  { copper: 5, itemId: 'baked_bread', itemCount: 2 },
  { copper: 25 },
];

describe('buildDailyRewardsView', () => {
  it('marks the next-to-claim slot by cycleIndex, not by date', () => {
    const view = buildDailyRewardsView(
      { cycleIndex: 1, lastClaimUtcDay: '', locked: false },
      CYCLE,
      '2026-07-12',
    );
    expect(view.cells.map((c) => c.isNext)).toEqual([false, true, false]);
    expect(view.cells[1].itemId).toBe('baked_bread');
  });

  it('canClaim is true when today has no claim yet and the account is not locked', () => {
    const view = buildDailyRewardsView(
      { cycleIndex: 0, lastClaimUtcDay: '2026-07-11', locked: false },
      CYCLE,
      '2026-07-12',
    );
    expect(view.canClaim).toBe(true);
    expect(view.locked).toBe(false);
  });

  it('canClaim is false once today is already claimed', () => {
    const view = buildDailyRewardsView(
      { cycleIndex: 0, lastClaimUtcDay: '2026-07-12', locked: false },
      CYCLE,
      '2026-07-12',
    );
    expect(view.canClaim).toBe(false);
  });

  it('canClaim is false when the account is reward-locked, even on a fresh day', () => {
    const view = buildDailyRewardsView(
      { cycleIndex: 0, lastClaimUtcDay: '2026-07-11', locked: true },
      CYCLE,
      '2026-07-12',
    );
    expect(view.canClaim).toBe(false);
    expect(view.locked).toBe(true);
  });

  it('missing a day never resets the cycle index (no streak-loss shape)', () => {
    // Skipped three real days; the index still just picks up wherever it left off.
    const view = buildDailyRewardsView(
      { cycleIndex: 2, lastClaimUtcDay: '2026-07-05', locked: false },
      CYCLE,
      '2026-07-12',
    );
    expect(view.cells.map((c) => c.isNext)).toEqual([false, false, true]);
    expect(view.canClaim).toBe(true);
  });
});
