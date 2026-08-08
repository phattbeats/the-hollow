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
    return { query: dbMock.query, connect: dbMock.connect, on: vi.fn() };
  },
}));

import { loadHomesteadState, saveHomesteadState } from '../server/db';
import type { HomesteadSave } from '../src/sim/homestead';

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.connect.mockReset();
});

const SAVE: HomesteadSave = {
  plots: [{ ownerKey: '42', ownerName: 'Hosta', x: -85, z: -220 }],
};

describe('homestead world_state persistence', () => {
  it('saveHomesteadState upserts the homestead key with parameterized JSON', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await saveHomesteadState(SAVE);
    expect(dbMock.query).toHaveBeenCalledTimes(1);
    const [sql, params] = dbMock.query.mock.calls[0];
    expect(String(sql)).toMatch(/INSERT INTO world_state/i);
    expect(String(sql)).toMatch(/ON CONFLICT \(key\) DO UPDATE/i);
    // Parameterized, never interpolated: key + serialized blob as params.
    expect(params).toEqual(['homestead', JSON.stringify(SAVE)]);
  });

  it('loadHomesteadState reads the homestead key and returns the stored blob', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [{ data: SAVE }], rowCount: 1 });
    const loaded = await loadHomesteadState();
    const [sql, params] = dbMock.query.mock.calls[0];
    expect(String(sql)).toMatch(/SELECT data FROM world_state WHERE key = \$1/i);
    expect(params).toEqual(['homestead']);
    expect(loaded).toEqual(SAVE);
  });

  it('loadHomesteadState returns null when no row exists (first boot)', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(loadHomesteadState()).resolves.toBeNull();
  });
});
