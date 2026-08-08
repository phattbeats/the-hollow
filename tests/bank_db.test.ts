import { beforeEach, describe, expect, it, vi } from 'vitest';

// Follow the repo's DB-test pattern (see player_card_db.test.ts / arena_db.test.ts):
// stub DATABASE_URL + mock the pg Pool so db.ts loads and every pool.query is a spy
// we control. Drives the real bankBonusFactsForAccount through every branch with no
// live database; only pg is mocked, never the function under test.
const dbMock = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgres://test/test';
  return { query: vi.fn() };
});
vi.mock('pg', () => ({
  Pool: vi.fn(function Pool() {
    return { query: dbMock.query, on: vi.fn() };
  }),
}));

import { bankBonusFactsForAccount } from '../server/db';

let factsRows: any[] = [];

beforeEach(() => {
  factsRows = [];
  dbMock.query.mockReset();
  dbMock.query.mockImplementation((sql: string) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    if (s.includes('email_verified_at IS NOT NULL')) return Promise.resolve({ rows: factsRows });
    return Promise.resolve({ rows: [] });
  });
});

describe('bankBonusFactsForAccount (PHAA-571: wallet-link + referral facts dropped)', () => {
  it('reads emailVerified + discordLinked only, no wallet or referral facts', async () => {
    factsRows = [{ email_verified: true, discord_linked: false }];
    await expect(bankBonusFactsForAccount(7)).resolves.toEqual({
      emailVerified: true,
      discordLinked: false,
    });
  });

  it('defaults to all-false when no account row comes back', async () => {
    factsRows = [];
    await expect(bankBonusFactsForAccount(999)).resolves.toEqual({
      emailVerified: false,
      discordLinked: false,
    });
  });

  it('never queries wallet_links or referrals', async () => {
    factsRows = [{ email_verified: false, discord_linked: true }];
    await bankBonusFactsForAccount(7);
    const queried = dbMock.query.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(queried.some((sql) => sql.includes('wallet_links'))).toBe(false);
    expect(queried.some((sql) => sql.includes('qualified_referrals'))).toBe(false);
  });
});
