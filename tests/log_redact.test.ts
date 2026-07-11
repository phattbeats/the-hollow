// PHAA-527: the secret/PII redactor behind the structured logger. Contract
// tests: every known secret class is scrubbed, non-secret fields survive
// verbatim, and the function is total (idempotent, non-mutating, never throws).
import { describe, expect, it } from 'vitest';
import { REDACTED, redact } from '../server/log_redact';

const HEX64 = 'a'.repeat(64);

describe('redact', () => {
  it('scrubs secret-named keys regardless of value type', () => {
    const out = redact({
      password: 'hunter2',
      newPassword: 'hunter3',
      authorization: `Bearer ${HEX64}`,
      Cookie: 'sid=abc',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      refresh_token: 'r-123',
      apiKey: 12345,
      token: { nested: 'whole value replaced' },
    }) as Record<string, unknown>;
    for (const key of Object.keys(out)) expect(out[key]).toBe(REDACTED);
  });

  it('scrubs inline Bearer credentials, 64-hex tokens, and emails inside strings', () => {
    const out = redact({
      note: `auth was Bearer abc.def-ghi and token ${HEX64} from player@example.com`,
    }) as { note: string };
    expect(out.note).not.toContain('abc.def');
    expect(out.note).not.toContain(HEX64);
    expect(out.note).not.toContain('player@example.com');
    expect(out.note).toContain(REDACTED);
  });

  it('scrubs OTP-shaped values only under OTP keys', () => {
    const out = redact({ code: '123456', build: '123456' }) as Record<string, string>;
    expect(out.code).toBe(REDACTED);
    expect(out.build).toBe('123456');
  });

  it('keeps machine codes and non-secret fields verbatim', () => {
    const when = new Date(0);
    const out = redact({ code: 'auth.invalid', count: 7, when, ok: true }) as Record<
      string,
      unknown
    >;
    expect(out.code).toBe('auth.invalid');
    expect(out.count).toBe(7);
    expect(out.when).toBe(when);
    expect(out.ok).toBe(true);
  });

  it('collapses raw bytes wholesale', () => {
    expect(redact({ blob: Buffer.from('secret') })).toEqual({ blob: REDACTED });
    expect(redact({ view: new Uint8Array([1, 2]) })).toEqual({ view: REDACTED });
  });

  it('recurses into arrays and nested objects without mutating the input', () => {
    const input = { list: [{ password: 'x' }], deep: { inner: { token: 'y' } } };
    const out = redact(input) as typeof input;
    expect(out.list[0].password).toBe(REDACTED);
    expect(out.deep.inner.token).toBe(REDACTED);
    expect(input.list[0].password).toBe('x');
  });

  it('is idempotent and cycle-safe', () => {
    const cyclic: Record<string, unknown> = { password: 'x' };
    cyclic.self = cyclic;
    const once = redact(cyclic);
    expect(redact(once)).toEqual(once);
  });
});
