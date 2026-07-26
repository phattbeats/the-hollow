import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgres://test/test';
  return { query: vi.fn() };
});

vi.mock('pg', () => ({
  Pool: vi.fn(function Pool() {
    return { query: dbMock.query };
  }),
}));

import {
  deedRarityCounts,
  earnedDeedIdsForAccount,
  getDeedBroadcasts,
  insertCharacterDeed,
  recentDeedsForCharacter,
  setDeedBroadcasts,
} from '../server/deeds_db';
import { REALM } from '../server/realm';

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.query.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('Renown persistence SQL', () => {
  it('records a deed with explicit realm and an idempotent parameterized insert', async () => {
    await insertCharacterDeed({
      realm: REALM,
      characterId: 42,
      accountId: 7,
      deedId: 'prog_veteran',
    });

    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO character_deeds');
    expect(sql).toContain('ON CONFLICT (character_id, deed_id) DO NOTHING');
    expect(sql).toContain('$4');
    expect(sql).not.toContain('prog_veteran');
    expect(params).toEqual([REALM, 42, 7, 'prog_veteran']);
  });

  it('aggregates ranked deeds over the same eligible population', async () => {
    dbMock.query
      .mockResolvedValueOnce({ rows: [{ deed_id: 'prog_veteran', earned: 3 }] })
      .mockResolvedValueOnce({ rows: [{ eligible: 12 }] });

    await expect(deedRarityCounts()).resolves.toEqual({
      totalEligible: 12,
      earned: { prog_veteran: 3 },
    });

    const [countsSql, countsParams] = dbMock.query.mock.calls[0];
    expect(countsSql).toContain('FROM character_deeds cd');
    expect(countsSql).toContain('JOIN characters c ON c.id = cd.character_id');
    expect(countsSql).toContain('GROUP BY cd.deed_id');
    expect(countsParams).toEqual([5]);
    const [eligibleSql, eligibleParams] = dbMock.query.mock.calls[1];
    expect(eligibleSql).toContain('FROM characters');
    expect(eligibleParams).toEqual([5]);
  });

  it('reads recent deed and account title standings with bound parameters', async () => {
    dbMock.query.mockResolvedValueOnce({
      rows: [{ deed_id: 'prog_veteran', earned_at: new Date('2026-07-08T10:00:00.000Z') }],
    });
    await expect(recentDeedsForCharacter(42, 5)).resolves.toEqual([
      { deedId: 'prog_veteran', earnedAt: '2026-07-08T10:00:00.000Z' },
    ]);
    expect(dbMock.query.mock.calls[0][0]).toContain('LIMIT $2');
    expect(dbMock.query.mock.calls[0][1]).toEqual([42, 5]);

    dbMock.query.mockResolvedValueOnce({ rows: [{ deed_id: 'prog_veteran' }] });
    await expect(earnedDeedIdsForAccount(7)).resolves.toEqual(['prog_veteran']);
    expect(dbMock.query.mock.calls[1][1]).toEqual([7]);
  });

  it('persists the ranked deed broadcast preference with bound parameters', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [{ deed_broadcasts: false }] });
    await expect(getDeedBroadcasts(7)).resolves.toBe(false);
    expect(dbMock.query.mock.calls[0][1]).toEqual([7]);

    await setDeedBroadcasts(7, true);
    expect(dbMock.query.mock.calls[1][0]).toContain('deed_broadcasts = $2 WHERE id = $1');
    expect(dbMock.query.mock.calls[1][1]).toEqual([7, true]);
  });
});
