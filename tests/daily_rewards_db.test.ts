import { beforeEach, describe, expect, it, vi } from 'vitest';

// Follow the repo's DB-test pattern (see bank_db.test.ts / arena_db.test.ts): stub
// DATABASE_URL + mock the pg Pool so db.ts loads and every pool.query is a spy we
// control. Drives the real claimAccountDailyReward through every branch with no
// live database.
const dbMock = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgres://test/test';
  return { query: vi.fn() };
});
vi.mock('pg', () => ({
  Pool: vi.fn(function Pool() {
    return { query: dbMock.query };
  }),
}));

import { claimAccountDailyReward, normalizeAccountDailyRewards } from '../server/db';

let currentRow: { daily_rewards: unknown; daily_rewards_locked_at: unknown } = {
  daily_rewards: {},
  daily_rewards_locked_at: null,
};
let updateRowCount = 1;
let updatedDailyRewards: unknown = null;

beforeEach(() => {
  currentRow = { daily_rewards: {}, daily_rewards_locked_at: null };
  updateRowCount = 1;
  updatedDailyRewards = null;
  dbMock.query.mockReset();
  dbMock.query.mockImplementation((sql: string) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    if (s.startsWith('SELECT daily_rewards FROM accounts')) {
      return Promise.resolve({ rows: [{ daily_rewards: currentRow.daily_rewards }] });
    }
    if (s.startsWith('UPDATE accounts SET daily_rewards =')) {
      return Promise.resolve({
        rowCount: updateRowCount,
        rows: updateRowCount > 0 ? [{ daily_rewards: updatedDailyRewards }] : [],
      });
    }
    return Promise.resolve({ rows: [] });
  });
});

describe('normalizeAccountDailyRewards', () => {
  it('defaults to cycle 0 / never-claimed for garbage input', () => {
    expect(normalizeAccountDailyRewards(null)).toEqual({ cycleIndex: 0, lastClaimUtcDay: '' });
    expect(normalizeAccountDailyRewards({ cycleIndex: -1 })).toEqual({
      cycleIndex: 0,
      lastClaimUtcDay: '',
    });
  });

  it('passes through valid stored state', () => {
    expect(normalizeAccountDailyRewards({ cycleIndex: 3, lastClaimUtcDay: '2026-07-11' })).toEqual({
      cycleIndex: 3,
      lastClaimUtcDay: '2026-07-11',
    });
  });
});

describe('claimAccountDailyReward (atomic claim-once-per-day)', () => {
  it('grants today and advances the cycle when eligible', async () => {
    currentRow.daily_rewards = { cycleIndex: 2, lastClaimUtcDay: '2026-07-10' };
    updatedDailyRewards = { cycleIndex: 3, lastClaimUtcDay: '2026-07-12' };
    const result = await claimAccountDailyReward(1, '2026-07-12', 7);
    expect(result).toEqual({
      grantedCycleIndex: 2,
      next: { cycleIndex: 3, lastClaimUtcDay: '2026-07-12' },
    });
  });

  it('wraps the cycle index at the cycle length', async () => {
    currentRow.daily_rewards = { cycleIndex: 6, lastClaimUtcDay: '2026-07-11' };
    updatedDailyRewards = { cycleIndex: 0, lastClaimUtcDay: '2026-07-12' };
    const result = await claimAccountDailyReward(1, '2026-07-12', 7);
    expect(result?.grantedCycleIndex).toBe(6);
    expect(result?.next.cycleIndex).toBe(0);
  });

  it('returns null when the WHERE guard rejects the update (already claimed today or locked)', async () => {
    updateRowCount = 0;
    const result = await claimAccountDailyReward(1, '2026-07-12', 7);
    expect(result).toBeNull();
  });

  it('passes the exact WHERE-guard params (accountId, new state json, today)', async () => {
    currentRow.daily_rewards = { cycleIndex: 0, lastClaimUtcDay: '' };
    updatedDailyRewards = { cycleIndex: 1, lastClaimUtcDay: '2026-07-12' };
    await claimAccountDailyReward(42, '2026-07-12', 7);
    const updateCall = dbMock.query.mock.calls.find((c: unknown[]) =>
      String(c[0]).replace(/\s+/g, ' ').includes('UPDATE accounts SET daily_rewards ='),
    );
    expect(updateCall?.[1]).toEqual([
      42,
      JSON.stringify({ cycleIndex: 1, lastClaimUtcDay: '2026-07-12' }),
      '2026-07-12',
    ]);
  });
});
