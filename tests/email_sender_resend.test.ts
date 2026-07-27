import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RESEND_API_URL, ResendSender, selectResendSender } from '../server/email/resend_sender';
import type { OutboundEmail } from '../server/email/sender';
import { selectSender } from '../server/email/sender';

const SAMPLE: OutboundEmail = {
  to: 'player@example.com',
  subject: 'Reset your password',
  html: '<p>reset</p>',
  text: 'reset',
};

let originalFetch: typeof fetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  // Clear every env var selectSender reads, so a stray .env cannot leak between
  // tests and accidentally pick a real transport where a fake one is expected.
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.EMAIL_API_URL;
  delete process.env.EMAIL_API_KEY;
});

function mockFetch(impl: typeof fetch): ReturnType<typeof vi.fn> {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('ResendSender', () => {
  it('POSTs the Resend envelope (URL, bearer key, from/to/subject/html/text)', async () => {
    const fetchSpy = mockFetch(async () => new Response('{}', { status: 200 }));
    const sender = new ResendSender({ apiKey: 're_test_key', from: 'no-reply@thehollow.world' });
    await sender.send(SAMPLE);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(RESEND_API_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer re_test_key');
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      from: 'no-reply@thehollow.world',
      to: 'player@example.com',
      subject: 'Reset your password',
      html: '<p>reset</p>',
      text: 'reset',
    });
  });

  it('throws with the status and a truncated body when Resend rejects', async () => {
    mockFetch(async () => new Response('{"message":"domain not verified"}', { status: 422 }));
    const sender = new ResendSender({ apiKey: 're_x', from: 'no-reply@thehollow.world' });
    await expect(sender.send(SAMPLE)).rejects.toThrow(/resend responded 422/);
    await expect(sender.send(SAMPLE)).rejects.toThrow(/domain not verified/);
  });

  it('reports the transport name as "resend" for startup logs', () => {
    const sender = new ResendSender({ apiKey: 're_x', from: 'a@b.com' });
    expect(sender.name).toBe('resend');
  });
});

describe('selectResendSender', () => {
  it('returns null when RESEND_API_KEY is unset (no silent fall-through)', () => {
    expect(selectResendSender({})).toBeNull();
  });

  it('returns null when EMAIL_FROM is unset, even if the key is set', () => {
    // Both must be present: a half-configured env is a hard miss so the
    // console fallback at the top of selectSender can surface the gap.
    expect(selectResendSender({ RESEND_API_KEY: 're_x' })).toBeNull();
  });

  it('returns a configured ResendSender when both env vars are set', () => {
    const s = selectResendSender({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'a@b.com' });
    expect(s).toBeInstanceOf(ResendSender);
    expect(s!.name).toBe('resend');
  });

  it('trims surrounding whitespace from both env vars', () => {
    const s = selectResendSender({ RESEND_API_KEY: '  re_x  ', EMAIL_FROM: '  a@b.com  ' });
    expect(s).toBeInstanceOf(ResendSender);
  });
});

describe('selectSender (precedence: Resend > Http > Console)', () => {
  it('picks Resend when RESEND_API_KEY + EMAIL_FROM are both set', () => {
    const s = selectSender({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'a@b.com' });
    expect(s.name).toBe('resend');
  });

  it('falls back to the generic HTTP transport when Resend is unset', () => {
    const s = selectSender({
      EMAIL_API_URL: 'https://example.com/emails',
      EMAIL_API_KEY: 'k',
      EMAIL_FROM: 'a@b.com',
    });
    expect(s.name).toBe('http');
  });

  it('falls back to the console transport when nothing is configured', () => {
    expect(selectSender({}).name).toBe('console');
  });

  it('a half-configured Resend env (no EMAIL_FROM) still falls through to http or console', () => {
    // Resend is rejected (missing from), so http also rejected (no URL),
    // and the caller lands on console. Never silently picks an invalid mix.
    expect(selectSender({ RESEND_API_KEY: 're_x' }).name).toBe('console');
  });
});
