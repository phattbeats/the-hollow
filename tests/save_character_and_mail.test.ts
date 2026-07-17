import { beforeEach, describe, expect, it, vi } from 'vitest';

// db.ts builds a pg Pool and requires DATABASE_URL at import time; stub both so
// the module loads and every query goes through a spy we can assert against.
const dbMock = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgres://test/test';
});
vi.mock('pg', () => ({
  Pool: function Pool() {
    return { query: dbMock.query, connect: dbMock.connect, on: vi.fn() };
  },
}));

import { saveCharacterAndMailState } from '../server/db';
import type { CharacterState, MailSave } from '../src/sim/sim';

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.connect.mockReset();
});

function clientStub() {
  const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 } as any);
  const release = vi.fn();
  return { query, release };
}

const STATE = {
  level: 7,
  questLog: [],
  questsDone: [],
  inventory: [],
} as unknown as CharacterState;
const MAIL = { mail: [], nextMailId: 1 } as unknown as MailSave;

describe('saveCharacterAndMailState', () => {
  it('writes the character row and the mail row in ONE transaction (atomic claim)', async () => {
    const client = clientStub();
    dbMock.connect.mockResolvedValueOnce(client as any);

    await saveCharacterAndMailState(42, 7, STATE, MAIL);

    const sqls = client.query.mock.calls.map((c) => String(c[0]));
    // Single transaction: BEGIN first, COMMIT last, no ROLLBACK.
    expect(sqls[0]).toMatch(/^BEGIN/);
    expect(sqls[sqls.length - 1]).toMatch(/^COMMIT/);
    expect(sqls.some((s) => /ROLLBACK/.test(s))).toBe(false);
    // Both rows are written on the same client (so they commit or fail together).
    expect(sqls.some((s) => /UPDATE characters/i.test(s))).toBe(true);
    expect(sqls.some((s) => /world_state/i.test(s))).toBe(true);
    // Nothing leaks onto the bare pool: atomicity would be lost otherwise.
    expect(dbMock.query).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });

  it('targets the mail world_state key and the right character id', async () => {
    const client = clientStub();
    dbMock.connect.mockResolvedValueOnce(client as any);

    await saveCharacterAndMailState(99, 12, STATE, MAIL);

    const charCall = client.query.mock.calls.find((c) => /UPDATE characters/i.test(String(c[0])));
    expect(charCall?.[1]).toEqual(expect.arrayContaining([99, 12]));
    const mailCall = client.query.mock.calls.find((c) => /world_state/i.test(String(c[0])));
    expect(mailCall?.[1]).toContain('mail');
  });

  it('rolls back and rethrows if either write fails, leaving no half-commit', async () => {
    const client = clientStub();
    client.query.mockImplementation((sql: string) => {
      if (/UPDATE characters/i.test(sql)) throw new Error('boom');
      return Promise.resolve({ rows: [], rowCount: 0 } as any);
    });
    dbMock.connect.mockResolvedValueOnce(client as any);

    await expect(saveCharacterAndMailState(1, 1, STATE, MAIL)).rejects.toThrow('boom');

    const sqls = client.query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => /ROLLBACK/.test(s))).toBe(true);
    expect(sqls.some((s) => /^COMMIT/.test(s))).toBe(false);
    expect(client.release).toHaveBeenCalled();
  });
});
