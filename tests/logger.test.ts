// PHAA-527: the structured JSON logger. One JSON object per line, redaction
// applied to every record, info to out / warn+error to err, child bindings
// merged, and the no-throw guarantee.
import { describe, expect, it } from 'vitest';
import { REDACTED } from '../server/log_redact';
import { createLogger } from '../server/logger';

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, log: createLogger({ out: (l) => out.push(l), err: (l) => err.push(l) }) };
}

describe('logger', () => {
  it('emits one JSON object per line with level, time, msg, and fields', () => {
    const { out, log } = capture();
    log.info({ scope: 'realm' }, 'leaderboard refreshed');
    expect(out).toHaveLength(1);
    const rec = JSON.parse(out[0]);
    expect(rec.level).toBe('info');
    expect(typeof rec.time).toBe('number');
    expect(rec.msg).toBe('leaderboard refreshed');
    expect(rec.scope).toBe('realm');
  });

  it('routes warn and error to the err transport', () => {
    const { out, err, log } = capture();
    log.warn('w');
    log.error('e');
    expect(out).toHaveLength(0);
    expect(err.map((l) => JSON.parse(l).level)).toEqual(['warn', 'error']);
  });

  it('redacts secrets in fields: no token or password ever reaches a line', () => {
    const token = 'b'.repeat(64);
    const { err, log } = capture();
    log.error({ token, detail: `retry with Bearer ${token}`, password: 'pw' }, 'auth failed');
    expect(err[0]).not.toContain(token);
    expect(err[0]).not.toContain('pw');
    const rec = JSON.parse(err[0]);
    expect(rec.token).toBe(REDACTED);
    expect(rec.password).toBe(REDACTED);
  });

  it('flattens a top-level Error to { message, stack }', () => {
    const { err, log } = capture();
    log.error({ err: new Error('boom') }, 'api error');
    const rec = JSON.parse(err[0]);
    expect(rec.err.message).toBe('boom');
    expect(typeof rec.err.stack).toBe('string');
  });

  it('child bindings ride on every line', () => {
    const { out, log } = capture();
    log.child({ realm: 'hollow' }).info('up');
    expect(JSON.parse(out[0]).realm).toBe('hollow');
  });

  it('never throws, even on unserializable fields', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const bad = createLogger({
      out: () => {
        throw new Error('transport down');
      },
    });
    expect(() => bad.info({ cyclic }, 'still fine')).not.toThrow();
  });
});
