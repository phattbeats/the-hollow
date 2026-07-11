import { describe, expect, it } from 'vitest';
import {
  isCrossSiteApiRequest,
  isNativeAppRequest,
  isWebClientRequest,
  webLoginEnforced,
} from '../server/web_login_guard';

const req = (headers: Record<string, string>) => ({ headers }) as any;
const methodReq = (method: string, headers: Record<string, string>) => ({ method, headers }) as any;

describe('web login guard (anti-bot)', () => {
  it('enforces in production, is off in dev/test, and honours REQUIRE_WEB_LOGIN', () => {
    expect(webLoginEnforced({ NODE_ENV: 'production' } as any)).toBe(true);
    expect(webLoginEnforced({ NODE_ENV: 'test' } as any)).toBe(false);
    expect(webLoginEnforced({ NODE_ENV: 'development' } as any)).toBe(false);
    expect(webLoginEnforced({ NODE_ENV: 'production', REQUIRE_WEB_LOGIN: '0' } as any)).toBe(false);
    expect(webLoginEnforced({ NODE_ENV: 'development', REQUIRE_WEB_LOGIN: '1' } as any)).toBe(true);
  });

  it('rejects requests with no Origin (curl / headless scripts / multibox)', () => {
    expect(isWebClientRequest(req({}))).toBe(false);
    expect(isWebClientRequest(req({ 'user-agent': 'Mozilla/5.0' }))).toBe(false); // spoofed UA, still no Origin
  });

  it('accepts a same-origin browser POST (Origin host matches Host / X-Forwarded-Host)', () => {
    expect(
      isWebClientRequest(req({ origin: 'https://play.example.com', host: 'play.example.com' })),
    ).toBe(true);
    expect(
      isWebClientRequest(
        req({ origin: 'https://play.example.com', 'x-forwarded-host': 'play.example.com' }),
      ),
    ).toBe(true);
  });

  it('accepts an explicit WEB_ORIGINS allow-list entry and localhost dev', () => {
    expect(
      isWebClientRequest(req({ origin: 'https://play.example.com' }), {
        WEB_ORIGINS: 'https://play.example.com',
      } as any),
    ).toBe(true);
    expect(
      isWebClientRequest(req({ origin: 'http://localhost:5173', host: '127.0.0.1:8787' })),
    ).toBe(true);
  });

  it('accepts Capacitor native app origins', () => {
    expect(
      isWebClientRequest(req({ origin: 'capacitor://localhost', host: 'thehollow.world' })),
    ).toBe(true);
    expect(isWebClientRequest(req({ origin: 'http://localhost', host: 'thehollow.world' }))).toBe(
      true,
    );
    expect(isWebClientRequest(req({ origin: 'https://localhost', host: 'thehollow.world' }))).toBe(
      true,
    );
  });

  it('identifies native app origins for Turnstile bypass', () => {
    expect(
      isNativeAppRequest(req({ origin: 'capacitor://localhost', host: 'thehollow.world' })),
    ).toBe(true);
    expect(isNativeAppRequest(req({ origin: 'http://localhost', host: 'thehollow.world' }))).toBe(
      true,
    );
    expect(isNativeAppRequest(req({ origin: 'https://localhost', host: 'thehollow.world' }))).toBe(
      true,
    );
    expect(
      isNativeAppRequest(req({ origin: 'https://thehollow.world', host: 'thehollow.world' })),
    ).toBe(false);
    expect(
      isNativeAppRequest(req({ origin: 'https://evil.example.com', host: 'thehollow.world' })),
    ).toBe(false);
    expect(isNativeAppRequest(req({ host: 'thehollow.world' }))).toBe(false);
  });

  it('rejects a foreign origin', () => {
    expect(
      isWebClientRequest(req({ origin: 'https://evil.example.com', host: 'play.example.com' })),
    ).toBe(false);
  });
});

describe('isCrossSiteApiRequest (PHAA-524 cross-site Origin gate)', () => {
  // Enforced under the same webLoginEnforced condition as the login guard
  // above: force it on with REQUIRE_WEB_LOGIN so these cases exercise the
  // production behaviour deterministically, regardless of NODE_ENV.
  const enforced = { REQUIRE_WEB_LOGIN: '1' } as any;

  it('rejects a mismatched Origin on POST/DELETE when enforced', () => {
    expect(
      isCrossSiteApiRequest(
        methodReq('POST', { origin: 'https://evil.example.com', host: 'play.example.com' }),
        enforced,
      ),
    ).toBe(true);
    expect(
      isCrossSiteApiRequest(
        methodReq('DELETE', { origin: 'https://evil.example.com', host: 'play.example.com' }),
        enforced,
      ),
    ).toBe(true);
  });

  it('never rejects, regardless of Origin, when not enforced (dev/test default)', () => {
    // Matches webLoginEnforced's own default: off outside production unless
    // REQUIRE_WEB_LOGIN forces it. A LAN-host dev/e2e origin (vite --host,
    // the browserless scripts) must keep working here.
    expect(
      isCrossSiteApiRequest(
        methodReq('POST', { origin: 'https://evil.example.com', host: 'play.example.com' }),
        { NODE_ENV: 'development' } as any,
      ),
    ).toBe(false);
    expect(
      isCrossSiteApiRequest(
        methodReq('POST', { origin: 'http://10.0.0.100:5173', host: '127.0.0.1:8787' }),
        { NODE_ENV: 'test' } as any,
      ),
    ).toBe(false);
  });

  it('allows a same-origin POST when enforced', () => {
    expect(
      isCrossSiteApiRequest(
        methodReq('POST', { origin: 'https://play.example.com', host: 'play.example.com' }),
        enforced,
      ),
    ).toBe(false);
  });

  it('allows a configured WEB_ORIGINS entry when enforced, matching isWebClientRequest', () => {
    expect(
      isCrossSiteApiRequest(
        methodReq('PUT', { origin: 'https://play.example.com', host: 'other.example.com' }),
        { REQUIRE_WEB_LOGIN: '1', WEB_ORIGINS: 'https://play.example.com' } as any,
      ),
    ).toBe(false);
  });

  it('allows a native app origin when enforced', () => {
    expect(
      isCrossSiteApiRequest(
        methodReq('POST', { origin: 'capacitor://localhost', host: 'thehollow.world' }),
        enforced,
      ),
    ).toBe(false);
  });

  it('never gates GET, HEAD, or OPTIONS even when enforced (reads and preflight are unaffected)', () => {
    const evilHeaders = { origin: 'https://evil.example.com', host: 'play.example.com' };
    expect(isCrossSiteApiRequest(methodReq('GET', evilHeaders), enforced)).toBe(false);
    expect(isCrossSiteApiRequest(methodReq('HEAD', evilHeaders), enforced)).toBe(false);
    expect(isCrossSiteApiRequest(methodReq('OPTIONS', evilHeaders), enforced)).toBe(false);
  });

  it('never rejects an absent Origin even when enforced (native clients/beacons send none)', () => {
    expect(isCrossSiteApiRequest(methodReq('POST', { host: 'play.example.com' }), enforced)).toBe(
      false,
    );
    expect(isCrossSiteApiRequest(methodReq('DELETE', {}), enforced)).toBe(false);
  });
});
