// /livez + /readyz (PHAA-734 production stability hardening), driven through
// the real routeHttpRequest routing ladder, same integration pattern as
// tests/security_headers.test.ts. A freshly-imported server/main.ts never
// calls game.start(), so the tick loop never runs and GameServer's cold-boot
// backstop keeps livenessStatus().ok true for the life of this test file;
// the unhealthy (503) branch is covered directly against GameServer in
// tests/linkdead.test.ts, where the internal clock is reachable to fake.

import type * as http from 'node:http';
import { beforeAll, describe, expect, it } from 'vitest';

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

function makeReq(url: string): http.IncomingMessage {
  return { method: 'GET', url, headers: {} } as unknown as http.IncomingMessage;
}

process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:5433/wocc_phaa734_health_routes';

type MainModule = typeof import('../server/main');
let main: MainModule;

beforeAll(async () => {
  main = (await import('../server/main')) as MainModule;
  // Importing server/main pulls the whole server module graph through vitest's
  // on-demand transform; on a cold cache (this file run in isolation) that
  // exceeds the default 10s hook timeout, so give it explicit headroom.
}, 60_000);

async function drive(url: string): Promise<FakeRes> {
  const req = makeReq(url);
  const res = new FakeRes();
  main.routeHttpRequest(req, res as unknown as http.ServerResponse);
  let ticks = 0;
  while (!res.writableEnded) {
    if (ticks++ > 5000) throw new Error('response never ended');
    await new Promise((r) => setImmediate(r));
  }
  return res;
}

describe('/livez and /readyz', () => {
  it('/livez reports 200 with the liveness JSON shape while the loop is fresh', async () => {
    const res = await drive('/livez');
    expect(res.statusCode).toBe(200);
    expect(res.getHeader('content-type')).toBe('application/json');
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(typeof body.sinceLastTickMs).toBe('number');
  });

  it('/readyz reports 200 and not draining under normal operation', async () => {
    const res = await drive('/readyz');
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.draining).toBe(false);
  });

  it('both stay unauthenticated (no bearer/secret required, unlike /internal/*)', async () => {
    const livez = await drive('/livez');
    const readyz = await drive('/readyz');
    expect(livez.statusCode).toBe(200);
    expect(readyz.statusCode).toBe(200);
  });
});
