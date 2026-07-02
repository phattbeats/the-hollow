import { beforeEach, describe, expect, it, vi } from 'vitest';

// db.ts builds a pg Pool and requires DATABASE_URL at import time; stub both so
// the module loads and every query goes through a spy we can assert against
// (the save_character_and_market.test.ts pattern).
const dbMock = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgres://test/test';
});
vi.mock('pg', () => ({
  Pool: function Pool() {
    return { query: dbMock.query, connect: dbMock.connect };
  },
}));

import { loadHousingState, saveHousingState } from '../server/db';
import type { HousingSave } from '../src/sim/housing';

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.connect.mockReset();
});

const SAVE: HousingSave = {
  plots: [
    {
      plotId: 'plot_w1',
      ownerKey: '42',
      ownerName: 'Hosta',
      objects: [{ slot: 0, kind: 'lantern' }],
    },
  ],
};

describe('housing world_state persistence', () => {
  it('saveHousingState upserts the housing key with parameterized JSON', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await saveHousingState(SAVE);
    expect(dbMock.query).toHaveBeenCalledTimes(1);
    const [sql, params] = dbMock.query.mock.calls[0];
    expect(String(sql)).toMatch(/INSERT INTO world_state/i);
    expect(String(sql)).toMatch(/ON CONFLICT \(key\) DO UPDATE/i);
    // Parameterized, never interpolated: key + serialized blob as params.
    expect(params).toEqual(['housing', JSON.stringify(SAVE)]);
  });

  it('loadHousingState reads the housing key and returns the stored blob', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [{ data: SAVE }], rowCount: 1 });
    const loaded = await loadHousingState();
    const [sql, params] = dbMock.query.mock.calls[0];
    expect(String(sql)).toMatch(/SELECT data FROM world_state WHERE key = \$1/i);
    expect(params).toEqual(['housing']);
    expect(loaded).toEqual(SAVE);
  });

  it('loadHousingState returns null when no row exists (first boot)', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(loadHousingState()).resolves.toBeNull();
  });
});
