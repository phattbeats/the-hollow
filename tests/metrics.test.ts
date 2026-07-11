// PHAA-527: the RED /metrics exporter, the token gate, the bounded route
// templates, and the attack-signal wiring into ratelimit.ts / ownership.ts.
// State-validation focus per the ticket's QA gate: /metrics 404s without the
// token, counters increment on the right signal, and no secret reaches a line.
import type * as http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createAccessLogSink, truncateIpForLog } from '../server/access_log';
import {
  type AttackSignalSink,
  attackSignalSink,
  noopAttackSignalSink,
  setAttackSignalSink,
} from '../server/attack_signals';
import { createLogger } from '../server/logger';
import {
  type MetricEvent,
  OVERFLOW_ROUTE,
  routeTemplateForPath,
  teeMetricSink,
  UNMATCHED_ROUTE,
} from '../server/metric_sink';
import { createHttpMetrics, handleMetricsRequest } from '../server/metrics';
import { rateLimited, resetRateLimits } from '../server/ratelimit';

const TOKEN = 'c'.repeat(64);

function fakeReq(headers: Record<string, string> = {}, method = 'GET'): http.IncomingMessage {
  return { method, headers, url: '/metrics', socket: {} } as unknown as http.IncomingMessage;
}

function fakeRes() {
  const state = { status: 0, body: '', headers: {} as Record<string, unknown> };
  const res = {
    writeHead(status: number, headers?: Record<string, unknown>) {
      state.status = status;
      if (headers) state.headers = headers;
      return res;
    },
    end(body?: string) {
      if (body !== undefined) state.body = body;
    },
  } as unknown as http.ServerResponse;
  return { res, state };
}

afterEach(() => {
  setAttackSignalSink(noopAttackSignalSink);
  resetRateLimits();
});

describe('createHttpMetrics', () => {
  it('records RED series with bounded labels and exposes them as text', async () => {
    const m = createHttpMetrics();
    m.sink.record({ route: '/api/characters/:id', method: 'get', status: 200, durationMs: 12 });
    m.sink.record({ route: '/api/characters/:id', method: 'get', status: 200, durationMs: 3 });
    const text = await m.metricsText();
    expect(text).toContain(
      'http_requests_total{route="/api/characters/:id",method="GET",status="200"} 2',
    );
    expect(text).toContain('http_request_duration_seconds_bucket');
  });

  it('isolates instances: no duplicate-registration throw, no cross-talk', async () => {
    const a = createHttpMetrics();
    const b = createHttpMetrics({ defaultMetrics: true });
    a.sink.record({ route: '/x', method: 'GET', status: 500, durationMs: 1 });
    expect(await b.metricsText()).not.toContain('route="/x"');
  });

  it('attack-signal counters increment on the right signal and never throw', async () => {
    const m = createHttpMetrics();
    m.attackSignals.rateLimitHit('auth', 'ip');
    m.attackSignals.authFailure('bad_credentials');
    m.attackSignals.authFailure('throttled');
    m.attackSignals.bolaDenied('/api/characters/:id');
    m.attackSignals.pgLimiterWrite('global');
    const text = await m.metricsText();
    expect(text).toContain('rate_limit_hits_total{policy="auth",key_kind="ip"} 1');
    expect(text).toContain('auth_failures_total{kind="bad_credentials"} 1');
    expect(text).toContain('auth_failures_total{kind="throttled"} 1');
    expect(text).toContain('bola_denied_total{route="/api/characters/:id"} 1');
    expect(text).toContain('pg_limiter_writes_total{policy="global"} 1');
  });

  it('a malformed event is dropped, never thrown', () => {
    const m = createHttpMetrics();
    expect(() => m.sink.record({} as unknown as MetricEvent)).not.toThrow();
  });
});

describe('handleMetricsRequest (token gate)', () => {
  it('404s with no token configured, even with a bearer', async () => {
    const { res, state } = fakeRes();
    await handleMetricsRequest(
      fakeReq({ authorization: `Bearer ${TOKEN}` }),
      res,
      createHttpMetrics(),
      undefined,
    );
    expect(state.status).toBe(404);
  });

  it('404s without an Authorization header', async () => {
    const { res, state } = fakeRes();
    await handleMetricsRequest(fakeReq(), res, createHttpMetrics(), TOKEN);
    expect(state.status).toBe(404);
  });

  it('404s on a wrong token and on a non-GET method', async () => {
    const m = createHttpMetrics();
    const wrong = fakeRes();
    await handleMetricsRequest(
      fakeReq({ authorization: `Bearer ${'d'.repeat(64)}` }),
      wrong.res,
      m,
      TOKEN,
    );
    expect(wrong.state.status).toBe(404);
    const post = fakeRes();
    await handleMetricsRequest(
      fakeReq({ authorization: `Bearer ${TOKEN}` }, 'POST'),
      post.res,
      m,
      TOKEN,
    );
    expect(post.state.status).toBe(404);
  });

  it('200s the exposition text with the right bearer', async () => {
    const m = createHttpMetrics();
    m.attackSignals.authFailure('bad_credentials');
    const { res, state } = fakeRes();
    await handleMetricsRequest(fakeReq({ authorization: `Bearer ${TOKEN}` }), res, m, TOKEN);
    expect(state.status).toBe(200);
    expect(state.body).toContain('auth_failures_total');
  });
});

describe('route templates stay bounded', () => {
  it('collapses numeric ids and 64-hex tokens to :params', () => {
    expect(routeTemplateForPath('/api/characters/12345/sheet')).toBe('/api/characters/:id/sheet');
    expect(routeTemplateForPath(`/api/x/${'a'.repeat(64)}`)).toBe('/api/x/:token');
  });

  it('exposes the 404 and overflow collapse labels', () => {
    expect(UNMATCHED_ROUTE).toBe('(unmatched)');
    expect(OVERFLOW_ROUTE).toBe('(other)');
  });
});

describe('attack-signal emission sites', () => {
  it('rateLimited() emits one auth/ip hit per rejected request', () => {
    const hits: Array<[string, string]> = [];
    setAttackSignalSink({
      ...noopAttackSignalSink,
      rateLimitHit: (policy, kind) => hits.push([policy, kind]),
    } as AttackSignalSink);
    const req = {
      socket: { remoteAddress: '203.0.113.9' },
      headers: {},
    } as unknown as http.IncomingMessage;
    for (let i = 0; i < 3; i++) rateLimited(req, 2);
    expect(hits).toEqual([['auth', 'ip']]);
  });

  it('the slot is read at emission time and restores to the no-op', () => {
    expect(attackSignalSink()).toBe(noopAttackSignalSink);
  });
});

describe('access log sink', () => {
  it('truncates IPs and emits one structured access line', () => {
    expect(truncateIpForLog('203.0.113.9')).toBe('203.0.113.x');
    expect(truncateIpForLog('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::');
    const lines: string[] = [];
    const sink = createAccessLogSink(createLogger({ out: (l) => lines.push(l) }));
    sink.record({
      route: '/api/login',
      method: 'POST',
      status: 429,
      durationMs: 5,
      ip: '10.0.0.7',
    });
    const rec = JSON.parse(lines[0]);
    expect(rec.msg).toBe('access');
    expect(rec.route).toBe('/api/login');
    expect(rec.status).toBe(429);
    expect(rec.ip).toBe('10.0.0.x');
  });

  it('teeMetricSink survives a throwing sink', () => {
    const seen: MetricEvent[] = [];
    const tee = teeMetricSink(
      {
        record() {
          throw new Error('down');
        },
      },
      { record: (e) => seen.push(e) },
    );
    tee.record({ route: '/x', method: 'GET', status: 200, durationMs: 1 });
    expect(seen).toHaveLength(1);
  });
});
