// Cross-site Origin gate (server/web_login_guard.ts's isCrossSiteApiRequest),
// wired into routeHttpRequest (server/main.ts), ported from upstream's
// server/http/middleware/origin_check.ts + cors.ts (levy-street/
// world-of-claudecraft#1491, primitive 2/6 of the REST decomposition on
// PHAA-519). Unlike upstream's log-only-by-default onion middleware, this is a
// direct reject gate: a state-changing (non-GET/HEAD/OPTIONS) /api request
// whose Origin is present and not recognised (same-origin, a realm/native CORS
// allow-list entry, or a WEB_ORIGINS entry) gets a 403 before the CORS
// reflection headers in maybeCors are ever written.
//
// INTEGRATION only: replays real request shapes through the actual
// routeHttpRequest routing ladder, matching the pattern in
// tests/security_headers.test.ts. The unit-level truth table for
// isCrossSiteApiRequest itself lives in tests/web_login_guard.test.ts.

import type * as http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// db.ts reads DATABASE_URL at module scope; a dummy URL lets the bare
// server/main import resolve. Every request shape below returns before
// touching the pool: a rejected request never reaches handleApi, and an
// admitted request targets an unmatched /api/ path that falls through to the
// synchronous 404 in handleApi before any pool call.
process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:5433/wocc_phaa524_origin_check';

class FakeRes {
  statusCode = 0;
  writableEnded = false;
  body = '';
  private readonly headerMap = new Map<string, string | string[]>();

  setHeader(name: string, value: string | string[]): void {
    this.headerMap.set(name.toLowerCase(), value);
  }
  getHeader(name: string): string | string[] | undefined {
    return this.headerMap.get(name.toLowerCase());
  }
  removeHeader(name: string): void {
    this.headerMap.delete(name.toLowerCase());
  }
  writeHead(status: number, headers?: Record<string, string>): this {
    this.statusCode = status;
    if (headers) for (const [k, v] of Object.entries(headers)) this.setHeader(k, v);
    return this;
  }
  end(data?: string): void {
    if (data) this.body = data;
    this.writableEnded = true;
  }
}

function makeReq(opts: {
  method?: string;
  url: string;
  headers?: Record<string, string>;
}): http.IncomingMessage {
  return {
    method: opts.method ?? 'GET',
    url: opts.url,
    headers: opts.headers ?? {},
  } as unknown as http.IncomingMessage;
}

const MAX_POLL_TICKS = 5000;

type MainModule = typeof import('../server/main');
let main: MainModule;

beforeAll(async () => {
  main = (await import('../server/main')) as MainModule;
});

async function drive(opts: {
  method?: string;
  url: string;
  headers?: Record<string, string>;
}): Promise<FakeRes> {
  const req = makeReq(opts);
  const res = new FakeRes();
  main.routeHttpRequest(req, res as unknown as http.ServerResponse);
  let ticks = 0;
  while (!res.writableEnded) {
    if (ticks++ > MAX_POLL_TICKS) throw new Error('response never ended');
    await new Promise((r) => setImmediate(r));
  }
  return res;
}

describe('routeHttpRequest cross-site Origin gate (PHAA-524)', () => {
  // The gate is only active under the same webLoginEnforced condition as the
  // sibling login guard (production, or forced): force it on for this block so
  // the cases below exercise the enforced behaviour deterministically,
  // regardless of the ambient NODE_ENV the test runner happens to use.
  let priorRequireWebLogin: string | undefined;
  beforeAll(() => {
    priorRequireWebLogin = process.env.REQUIRE_WEB_LOGIN;
    process.env.REQUIRE_WEB_LOGIN = '1';
  });
  afterAll(() => {
    if (priorRequireWebLogin === undefined) delete process.env.REQUIRE_WEB_LOGIN;
    else process.env.REQUIRE_WEB_LOGIN = priorRequireWebLogin;
  });

  it('rejects a mismatched Origin on a state-changing POST', async () => {
    const res = await drive({
      method: 'POST',
      url: '/api/nonexistent-xyz',
      headers: { origin: 'https://evil.example.com', host: 'play.example.com' },
    });
    expect(res.statusCode).toBe(403);
    // The problem+json envelope (PHAA-528): `error` stays for back-compat
    // string matchers, `code` is the new stable, machine-readable member.
    expect(JSON.parse(res.body)).toMatchObject({
      error: 'cross-site request rejected',
      code: 'CROSS_SITE_ORIGIN_REJECTED',
    });
  });

  it('rejects a mismatched Origin on a state-changing DELETE', async () => {
    const res = await drive({
      method: 'DELETE',
      url: '/api/nonexistent-xyz',
      headers: { origin: 'https://evil.example.com', host: 'play.example.com' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('does not set CORS reflection headers on a rejected request', async () => {
    const res = await drive({
      method: 'POST',
      url: '/api/nonexistent-xyz',
      headers: { origin: 'https://evil.example.com', host: 'play.example.com' },
    });
    expect(res.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
  });

  it('lets a same-origin POST through to the route (falls to the 404 unknown-endpoint body)', async () => {
    const res = await drive({
      method: 'POST',
      url: '/api/nonexistent-xyz',
      headers: { origin: 'https://play.example.com', host: 'play.example.com' },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'unknown endpoint' });
  });

  it('lets a configured WEB_ORIGINS web-client origin through', async () => {
    const prior = process.env.WEB_ORIGINS;
    process.env.WEB_ORIGINS = 'https://community.example.com';
    try {
      const res = await drive({
        method: 'PUT',
        url: '/api/nonexistent-xyz',
        headers: { origin: 'https://community.example.com', host: 'play.example.com' },
      });
      expect(res.statusCode).toBe(404);
    } finally {
      if (prior === undefined) delete process.env.WEB_ORIGINS;
      else process.env.WEB_ORIGINS = prior;
    }
  });

  it('leaves the OPTIONS preflight short-circuit unaffected by a cross-site Origin', async () => {
    const res = await drive({
      method: 'OPTIONS',
      url: '/api/nonexistent-xyz',
      headers: { origin: 'https://evil.example.com', host: 'play.example.com' },
    });
    expect(res.statusCode).toBe(204);
  });

  it('never rejects a GET (reads are not state-changing)', async () => {
    const res = await drive({
      method: 'GET',
      url: '/api/nonexistent-xyz',
      headers: { origin: 'https://evil.example.com', host: 'play.example.com' },
    });
    expect(res.statusCode).not.toBe(403);
  });

  it('never rejects an absent Origin (native clients/beacons send none)', async () => {
    const res = await drive({ method: 'POST', url: '/api/nonexistent-xyz' });
    expect(res.statusCode).not.toBe(403);
  });

  it('does not gate /admin/api/ (upstream carve-out: admin has its own auth model)', async () => {
    // No Authorization header, so adminAccountId short-circuits to null before
    // any pool call; the point here is only that the 403 never fires.
    const res = await drive({
      method: 'POST',
      url: '/admin/api/nonexistent-xyz',
      headers: { origin: 'https://evil.example.com', host: 'play.example.com' },
    });
    expect(res.statusCode).not.toBe(403);
  });

  it('does not gate /api/public/ paths (public reads never mutate, but the carve-out must not 403 one)', async () => {
    const res = await drive({
      method: 'POST',
      url: '/api/public/nonexistent-xyz',
      headers: { origin: 'https://evil.example.com', host: 'play.example.com' },
    });
    expect(res.statusCode).not.toBe(403);
  });
});

describe('routeHttpRequest cross-site Origin gate, not enforced (dev/test default)', () => {
  it('lets a mismatched Origin through when webLoginEnforced is off, matching the login guard', async () => {
    const priorRequireWebLogin = process.env.REQUIRE_WEB_LOGIN;
    const priorNodeEnv = process.env.NODE_ENV;
    process.env.REQUIRE_WEB_LOGIN = '0';
    try {
      const res = await drive({
        method: 'POST',
        url: '/api/nonexistent-xyz',
        headers: { origin: 'https://evil.example.com', host: 'play.example.com' },
      });
      expect(res.statusCode).not.toBe(403);
    } finally {
      if (priorRequireWebLogin === undefined) delete process.env.REQUIRE_WEB_LOGIN;
      else process.env.REQUIRE_WEB_LOGIN = priorRequireWebLogin;
      if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorNodeEnv;
    }
  });
});
