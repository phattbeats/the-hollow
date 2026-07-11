// Security-headers wrapper (server/security_headers.ts), ported from upstream's
// server/http/middleware/security_headers.ts (PHAA-523, primitive 1/6 of the
// REST decomposition on PHAA-519).
//
// Two layers, mirroring upstream's own test:
//   a) UNIT: drive applySecurityHeaders directly against a FakeRes and pin the
//      header contract with STRING LITERALS (never a constant imported from the
//      module under test, so a value drift in the module is actually caught).
//   b) INTEGRATION: replay real requests through the actual routeHttpRequest
//      routing ladder (server/main.ts) and prove the headers land on every
//      representative branch: a static 404, a legacy /api 405, and the
//      OPTIONS-204 CORS short-circuit. Only db-free request shapes are used (a
//      pool-touching path would need a live Postgres); the WS upgrade handshake
//      is excluded from routeHttpRequest by construction (server.on('upgrade')
//      handles it separately), so there is nothing to drive there.

import type * as http from 'node:http';
import { beforeAll, describe, expect, it } from 'vitest';
import { applySecurityHeaders } from '../server/security_headers';

// The full expected header values, pinned as literals (NOT imported from the
// module under test, so a value drift in the module is actually caught).
const EXPECT = {
  contentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy:
    'accelerometer=(), ambient-light-sensor=(), battery=(), bluetooth=(), camera=(), ' +
    'display-capture=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), ' +
    'local-fonts=(), magnetometer=(), microphone=(), midi=(), payment=(), serial=(), ' +
    'usb=(), xr-spatial-tracking=()',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin',
} as const;

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

/** Drive applySecurityHeaders over a fresh FakeRes and return it. */
function run(): FakeRes {
  const res = new FakeRes();
  applySecurityHeaders(res as unknown as http.ServerResponse);
  return res;
}

describe('applySecurityHeaders (unit)', () => {
  it('sets the full unconditional header set', () => {
    const res = run();
    expect(res.getHeader('X-Content-Type-Options')).toBe(EXPECT.contentTypeOptions);
    expect(res.getHeader('Referrer-Policy')).toBe(EXPECT.referrerPolicy);
    expect(res.getHeader('Permissions-Policy')).toBe(EXPECT.permissionsPolicy);
    expect(res.getHeader('Cross-Origin-Opener-Policy')).toBe(EXPECT.crossOriginOpenerPolicy);
    expect(res.getHeader('Cross-Origin-Resource-Policy')).toBe(EXPECT.crossOriginResourcePolicy);
  });

  it('never sets a Content-Security-Policy, Cross-Origin-Embedder-Policy, or HSTS header', () => {
    // Explicitly out of scope for PHAA-523 (matches upstream for CSP/COEP; HSTS
    // and the /oauth/-only extras are deferred entirely, not just unset here).
    const res = run();
    expect(res.getHeader('Content-Security-Policy')).toBeUndefined();
    expect(res.getHeader('Cross-Origin-Embedder-Policy')).toBeUndefined();
    expect(res.getHeader('Strict-Transport-Security')).toBeUndefined();
  });

  it('carves out Cross-Origin-Resource-Policy: cross-origin for /avatar/* (PHAA-529)', () => {
    const res = new FakeRes();
    applySecurityHeaders(res as unknown as http.ServerResponse, '/avatar/warrior/1.png');
    expect(res.getHeader('Cross-Origin-Resource-Policy')).toBe('cross-origin');
    // Every other header on the /avatar/* branch stays the unconditional default.
    expect(res.getHeader('X-Content-Type-Options')).toBe(EXPECT.contentTypeOptions);
    expect(res.getHeader('Cross-Origin-Opener-Policy')).toBe(EXPECT.crossOriginOpenerPolicy);
  });

  it('keeps Cross-Origin-Resource-Policy: same-origin for a non-/avatar/* path', () => {
    const res = new FakeRes();
    applySecurityHeaders(res as unknown as http.ServerResponse, '/api/public/something');
    expect(res.getHeader('Cross-Origin-Resource-Policy')).toBe(EXPECT.crossOriginResourcePolicy);
  });

  it('excludes the gameplay features from the Permissions-Policy and denies the sensors', () => {
    const value = run().getHeader('Permissions-Policy') as string;
    // Fullscreen (mobile landscape lock, src/main.ts) and Gamepad
    // (src/game/gamepad.ts) are in active use, so denying them would break the
    // game; they must NOT appear in the deny list.
    expect(value.includes('fullscreen')).toBe(false);
    expect(value.includes('gamepad')).toBe(false);
    // Sensitive capabilities the game never uses ARE denied.
    expect(value.includes('camera=()')).toBe(true);
    expect(value.includes('microphone=()')).toBe(true);
    expect(value.includes('geolocation=()')).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// INTEGRATION through the real routeHttpRequest.
// -----------------------------------------------------------------------------

// db.ts reads DATABASE_URL at module scope; a dummy URL lets the bare
// server/main import resolve. The pg Pool is constructed but never connects:
// every request shape below returns before touching it (verified db-free by
// reading each handler: serveStatic hits the filesystem only, and the GET
// /api/site-presence 405 returns before any recordSitePresence/pool call).
process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:5433/wocc_phaa523_security_headers';

// routeHttpRequest fire-and-forgets its async handlers (`void handleApi(...)`),
// so a request must poll writableEnded before the captured headers are readable.
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

function expectCoreHeaders(res: FakeRes): void {
  expect(res.getHeader('X-Content-Type-Options')).toBe(EXPECT.contentTypeOptions);
  expect(res.getHeader('Referrer-Policy')).toBe(EXPECT.referrerPolicy);
  expect(res.getHeader('Permissions-Policy')).toBe(EXPECT.permissionsPolicy);
  expect(res.getHeader('Cross-Origin-Opener-Policy')).toBe(EXPECT.crossOriginOpenerPolicy);
  expect(res.getHeader('Cross-Origin-Resource-Policy')).toBe(EXPECT.crossOriginResourcePolicy);
}

describe('routeHttpRequest security headers (integration)', () => {
  it('sets the headers on a static 404 (the serveStatic branch)', async () => {
    // A '.txt' asset path 404s synchronously with 'not found' and never touches
    // dist/ or the pool, so it is a deterministic db-free static branch.
    const res = await drive({ url: '/no-such-file-xyz.txt' });
    expect(res.statusCode).toBe(404);
    expectCoreHeaders(res);
  });

  it('sets the headers on a legacy /api 405 error response', async () => {
    // GET /api/site-presence returns the 405 { ok: false } heartbeat contract
    // before any DB call (server/site_presence.ts).
    const res = await drive({ url: '/api/site-presence' });
    expect(res.statusCode).toBe(405);
    expectCoreHeaders(res);
  });

  it('sets the headers on the OPTIONS-204 CORS short-circuit', async () => {
    const res = await drive({
      method: 'OPTIONS',
      url: '/api/anything',
      headers: { origin: 'http://localhost' },
    });
    expect(res.statusCode).toBe(204);
    expectCoreHeaders(res);
  });

  it('carves out Cross-Origin-Resource-Policy: cross-origin on the real /avatar/* route (PHAA-529)', async () => {
    // handleAvatar 404s synchronously on an invalid class/skin, never touching
    // the pool, so this stays a deterministic db-free branch.
    const res = await drive({ url: '/avatar/not-a-class/1.png' });
    expect(res.statusCode).toBe(404);
    expect(res.getHeader('X-Content-Type-Options')).toBe(EXPECT.contentTypeOptions);
    expect(res.getHeader('Cross-Origin-Resource-Policy')).toBe('cross-origin');
  });
});
