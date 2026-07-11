// Stable error-code / problem+json envelope (server/http_errors.ts), ported
// from upstream's server/http/{errors.ts,error_codes.ts} (PHAA-528, primitive
// 6/6 of the REST decomposition on PHAA-519).

import type * as http from 'node:http';
import { describe, expect, it } from 'vitest';
import { problemBody, sendProblem } from '../server/http_errors';

class FakeRes {
  statusCode = 0;
  body = '';
  private readonly headerMap = new Map<string, string | number>();

  setHeader(name: string, value: string | number): void {
    this.headerMap.set(name.toLowerCase(), value);
  }
  getHeader(name: string): string | number | undefined {
    return this.headerMap.get(name.toLowerCase());
  }
  writeHead(status: number, headers?: Record<string, string | number>): this {
    this.statusCode = status;
    if (headers) for (const [k, v] of Object.entries(headers)) this.setHeader(k, v);
    return this;
  }
  end(data?: string): void {
    if (data) this.body = data;
  }
}

describe('problemBody', () => {
  it('builds the RFC 9457 shape plus the legacy `error` back-compat alias', () => {
    const body = problemBody(404, 'CHARACTER_NOT_FOUND', 'character not found');
    expect(body).toMatchObject({
      type: 'https://the-hollow.game/errors/CHARACTER_NOT_FOUND',
      title: 'Not Found',
      status: 404,
      code: 'CHARACTER_NOT_FOUND',
      detail: 'character not found',
      error: 'character not found',
    });
  });

  it('merges bounded-cardinality extension members (e.g. rate-limit policy)', () => {
    const body = problemBody(429, 'RATE_LIMITED', 'rate limited', { policy: 'discord' });
    expect(body).toMatchObject({ code: 'RATE_LIMITED', policy: 'discord' });
  });

  it('falls back to a generic title for a status outside the known set', () => {
    expect(problemBody(418, 'NOT_AUTHENTICATED', 'x').title).toBe('Error');
  });
});

describe('sendProblem', () => {
  it('writes the problem+json body with the matching status and content type', () => {
    const res = new FakeRes();
    sendProblem(
      res as unknown as http.ServerResponse,
      403,
      'CROSS_SITE_ORIGIN_REJECTED',
      'cross-site request rejected',
    );
    expect(res.statusCode).toBe(403);
    expect(res.getHeader('Content-Type')).toBe('application/problem+json');
    expect(JSON.parse(res.body)).toMatchObject({
      code: 'CROSS_SITE_ORIGIN_REJECTED',
      error: 'cross-site request rejected',
      status: 403,
    });
  });
});
