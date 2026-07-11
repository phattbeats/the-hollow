import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mirror tests/account_server.test.ts / character_db.test.ts: stub DATABASE_URL
// and mock the pg Pool so db.ts loads and every pool.query is a spy routed by
// SQL text, driving the REAL guards through every branch with no live database.
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
  bearerAccount,
  bearerActiveAccount,
  bearerReadAccount,
  bearerToken,
  requireAdminAccount,
  requireOwnedCharacter,
} from '../server/ownership';

// ── http fakes ──────────────────────────────────────────────────────────────
function makeReq(token: string | null): any {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}
function makeRes(): any {
  return {
    statusCode: 0,
    body: '',
    writeHead(status: number) {
      this.statusCode = status;
      return this;
    },
    end(data: string) {
      this.body = data ?? '';
      return this;
    },
  };
}
const parse = (res: any) => ({
  status: res.statusCode,
  data: res.body ? JSON.parse(res.body) : {},
});

const TOKEN = 'a'.repeat(64);
const OTHER_TOKEN = 'b'.repeat(64);

// ── query router ────────────────────────────────────────────────────────────
let tokenRow: { account_id: number; scope: string } | null;
let accountRow: {
  banned_at: string | null;
  suspended_until: string | null;
  deactivated_at: string | null;
} | null;
let isAdmin: boolean;
let characterRow: { id: number; account_id: number; name: string } | null;

function routeQuery(sql: string, params: any[]) {
  if (sql.includes('FROM auth_tokens')) {
    return { rows: tokenRow && params[0] === TOKEN ? [tokenRow] : [] };
  }
  if (sql.includes('is_admin FROM accounts')) {
    return { rows: [{ is_admin: isAdmin }] };
  }
  if (sql.includes('banned_at, suspended_until')) {
    return { rows: accountRow ? [accountRow] : [] };
  }
  if (sql.includes('FROM characters WHERE id')) {
    return { rows: characterRow ? [characterRow] : [] };
  }
  return { rows: [] };
}

beforeEach(() => {
  tokenRow = { account_id: 1, scope: 'full' };
  accountRow = { banned_at: null, suspended_until: null, deactivated_at: null };
  isAdmin = false;
  characterRow = { id: 42, account_id: 1, name: 'Aelwyn' };
  dbMock.query.mockReset();
  dbMock.query.mockImplementation((sql: string, params: any[]) => routeQuery(sql, params));
});

describe('bearerToken', () => {
  it('extracts a well-formed bearer token', () => {
    expect(bearerToken(makeReq(TOKEN))).toBe(TOKEN);
  });
  it('rejects a missing or malformed header', () => {
    expect(bearerToken(makeReq(null))).toBeNull();
    expect(bearerToken({ headers: { authorization: 'Bearer not-hex' } } as any)).toBeNull();
  });
});

describe('bearerAccount', () => {
  it('resolves the account for a live token', async () => {
    expect(await bearerAccount(makeReq(TOKEN))).toBe(1);
  });
  it('returns null for an unrecognized token', async () => {
    expect(await bearerAccount(makeReq(OTHER_TOKEN))).toBeNull();
  });
});

describe('bearerActiveAccount', () => {
  it('returns the account id for a full-scope, unlocked account', async () => {
    const res = makeRes();
    expect(await bearerActiveAccount(makeReq(TOKEN), res)).toBe(1);
    expect(res.statusCode).toBe(0);
  });
  it('401s when unauthenticated', async () => {
    const res = makeRes();
    expect(await bearerActiveAccount(makeReq(null), res)).toBeNull();
    expect(parse(res)).toMatchObject({ status: 401 });
  });
  it('403s a read-only token, so a companion/OAuth token can never mutate', async () => {
    tokenRow = { account_id: 1, scope: 'read' };
    const res = makeRes();
    expect(await bearerActiveAccount(makeReq(TOKEN), res)).toBeNull();
    expect(parse(res)).toMatchObject({ status: 403 });
  });
  it('403s a banned account', async () => {
    accountRow = { banned_at: '2026-01-01', suspended_until: null, deactivated_at: null };
    const res = makeRes();
    expect(await bearerActiveAccount(makeReq(TOKEN), res)).toBeNull();
    expect(parse(res).status).toBe(403);
  });
});

describe('bearerReadAccount', () => {
  it('accepts a read-scope token', async () => {
    tokenRow = { account_id: 1, scope: 'read' };
    const res = makeRes();
    expect(await bearerReadAccount(makeReq(TOKEN), res)).toBe(1);
  });
  it('401s when unauthenticated', async () => {
    const res = makeRes();
    expect(await bearerReadAccount(makeReq(null), res)).toBeNull();
    expect(parse(res).status).toBe(401);
  });
});

describe('requireAdminAccount', () => {
  it('resolves the account id when the caller is admin', async () => {
    isAdmin = true;
    expect(await requireAdminAccount(makeReq(TOKEN))).toBe(1);
  });
  it('denies a non-admin account', async () => {
    isAdmin = false;
    expect(await requireAdminAccount(makeReq(TOKEN))).toBeNull();
  });
  it('denies an unauthenticated caller', async () => {
    expect(await requireAdminAccount(makeReq(null))).toBeNull();
  });
});

describe('requireOwnedCharacter', () => {
  it('returns the character row when the account owns it, scoped by id + account_id', async () => {
    const res = makeRes();
    const character = await requireOwnedCharacter(res, 1, 42);
    expect(character).toMatchObject({ id: 42, account_id: 1 });
    expect(res.statusCode).toBe(0);
    // getCharacter's WHERE clause is id = $1 AND account_id = $2: confirm the
    // loader passes (characterId, accountId) through to the real ownership scope.
    const call = dbMock.query.mock.calls.find((c: any[]) =>
      c[0].includes('FROM characters WHERE id'),
    )!;
    expect(call[1].slice(0, 2)).toEqual([42, 1]);
  });
  // BOLA: a wrong owner and a nonexistent character id both 404 the same way,
  // so neither branch leaks whether the id exists under a different account.
  it('404s without leaking existence when another account owns the character', async () => {
    characterRow = null; // the ownership-scoped SELECT (id + account_id) matches no row
    const res = makeRes();
    const character = await requireOwnedCharacter(res, 999, 42);
    expect(character).toBeNull();
    expect(parse(res)).toMatchObject({ status: 404, data: { error: 'character not found' } });
  });
  it('404s the same way for a genuinely nonexistent character id', async () => {
    characterRow = null;
    const res = makeRes();
    const character = await requireOwnedCharacter(res, 1, 999999);
    expect(character).toBeNull();
    expect(parse(res).status).toBe(404);
  });
  it('lets a caller override the not-found message', async () => {
    characterRow = null;
    const res = makeRes();
    await requireOwnedCharacter(res, 1, 42, 'reporting character not found');
    expect(parse(res).data).toMatchObject({ error: 'reporting character not found' });
  });
});
