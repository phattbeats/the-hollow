// PHAA-701: proves GameServer's wiring from a boarball win to the account-scoped
// daily-reward claim, not just the underlying primitives (already covered by
// tests/daily_rewards.test.ts and tests/daily_rewards_db.test.ts in isolation).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbState = vi.hoisted(
  () => new Map<number, { cycleIndex: number; lastClaimUtcDay: string }>(),
);

vi.mock('../server/db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  saveCharacterState: vi.fn(async () => {}),
  openPlaySession: vi.fn(async () => 1),
  closePlaySession: vi.fn(async () => {}),
  insertChatLogs: vi.fn(async () => {}),
  markAccountQuestComplete: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  grantAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  // Mirrors the real WHERE-guarded atomicity contract (server/db.ts): returns
  // null (no grant) if the account already claimed `today`.
  claimAccountDailyReward: vi.fn(async (accountId: number, today: string, cycleLength: number) => {
    const current = dbState.get(accountId) ?? { cycleIndex: 0, lastClaimUtcDay: '' };
    if (current.lastClaimUtcDay === today) return null;
    const next = { cycleIndex: (current.cycleIndex + 1) % cycleLength, lastClaimUtcDay: today };
    dbState.set(accountId, next);
    return { grantedCycleIndex: current.cycleIndex, next };
  }),
}));

import { claimAccountDailyReward } from '../server/db';
import { GameServer } from '../server/game';
import type { SimEvent } from '../src/sim/types';

beforeEach(() => {
  dbState.clear();
  vi.clearAllMocks();
});

function fakeWs() {
  return { readyState: 1, send: vi.fn(), close: vi.fn() };
}

type ArenaEndEvent = Extract<SimEvent, { type: 'arenaEnd' }>;

function boarballWinEvent(pid: number, overrides: Partial<ArenaEndEvent> = {}): ArenaEndEvent {
  return {
    type: 'arenaEnd',
    pid,
    format: 'boarball',
    won: true,
    draw: false,
    oppName: 'Rival Pack',
    ratingBefore: 1500,
    ratingAfter: 1500,
    allies: [],
    enemies: [],
    ...overrides,
  };
}

describe('boarball win daily-reward bonus (PHAA-701)', () => {
  it('auto-claims the account-scoped daily slot for a boarball winner who has not claimed today', async () => {
    const server = new GameServer();
    const ws = fakeWs();
    const joined = server.join(ws as any, 1, 1, 'Champ', 'warrior', null);
    if ('error' in joined) throw new Error(joined.error);
    (server as any).sim.utcDay = '2026-07-26';
    const copperBefore = server.sim.copper;

    (server as any).grantBoarballWinDailyBonus([boarballWinEvent(joined.pid)]);

    await vi.waitFor(() => expect(joined.accountDailyRewards.lastClaimUtcDay).toBe('2026-07-26'));
    expect(claimAccountDailyReward).toHaveBeenCalledWith(1, '2026-07-26', expect.any(Number));
    expect(joined.accountDailyRewards.cycleIndex).toBe(1);
    expect(joined.accountDailyRewards.locked).toBe(false);
    expect(server.sim.copper).toBeGreaterThan(copperBefore);
  });

  it('does not double-grant a second boarball win the same day', async () => {
    const server = new GameServer();
    const ws = fakeWs();
    const joined = server.join(ws as any, 2, 2, 'Repeat', 'warrior', null);
    if ('error' in joined) throw new Error(joined.error);
    (server as any).sim.utcDay = '2026-07-26';

    (server as any).grantBoarballWinDailyBonus([boarballWinEvent(joined.pid)]);
    await vi.waitFor(() => expect(joined.accountDailyRewards.lastClaimUtcDay).toBe('2026-07-26'));
    expect(claimAccountDailyReward).toHaveBeenCalledTimes(1);
    const copperAfterFirst = server.sim.copper;

    // A second win the same day must not even attempt a second DB round trip
    // (the in-memory guard mirrors the explicit daily_rewards_claim command).
    (server as any).grantBoarballWinDailyBonus([boarballWinEvent(joined.pid)]);
    expect(claimAccountDailyReward).toHaveBeenCalledTimes(1);
    expect(server.sim.copper).toBe(copperAfterFirst);
  });

  it('ignores a losing boarball match and a winning non-boarball arena match', async () => {
    const server = new GameServer();
    const loserWs = fakeWs();
    const arenaWinnerWs = fakeWs();
    const loser = server.join(loserWs as any, 3, 3, 'Loser', 'warrior', null);
    const arenaWinner = server.join(arenaWinnerWs as any, 4, 4, 'Duelist', 'warrior', null);
    if ('error' in loser) throw new Error(loser.error);
    if ('error' in arenaWinner) throw new Error(arenaWinner.error);
    (server as any).sim.utcDay = '2026-07-26';

    const losingEvent = boarballWinEvent(loser.pid, { won: false });
    const rankedArenaWin = boarballWinEvent(arenaWinner.pid, { format: '1v1' });

    (server as any).grantBoarballWinDailyBonus([losingEvent, rankedArenaWin]);

    expect(claimAccountDailyReward).not.toHaveBeenCalled();
    expect(loser.accountDailyRewards.lastClaimUtcDay).toBe('');
    expect(arenaWinner.accountDailyRewards.lastClaimUtcDay).toBe('');
  });
});
