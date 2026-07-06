import type { IncomingMessage } from 'node:http';
import { REALM_ORIGINS } from './realm';

export const NATIVE_APP_ORIGINS = new Set([
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
]);

export function isNativeAppRequest(req: Pick<IncomingMessage, 'headers'>): boolean {
  const origin = req.headers.origin;
  return typeof origin === 'string' && NATIVE_APP_ORIGINS.has(origin);
}

// Anti-bot: programmatic clients (curl, headless scripts, multibox farms) call
// /api/login and /api/register directly with no browser Origin header. A real
// same-origin browser POST always sends an Origin equal to the page's origin, so
// requiring a recognised Origin on the auth endpoints lets only the web client
// obtain a token. A determined attacker can still spoof Origin, but this stops
// casual scripting and the existing multibox tooling outright.

// Whether the Origin guard is active. Enforced in production, or when
// REQUIRE_WEB_LOGIN=1; disabled for local dev, the Vitest suite, and the .mjs
// e2e (which call the API directly with no Origin). REQUIRE_WEB_LOGIN=0 forces it off.
export function webLoginEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = (env.REQUIRE_WEB_LOGIN ?? '').toLowerCase();
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return env.NODE_ENV === 'production';
}

// True when the request carries an Origin that belongs to this site — i.e. it
// came from a page we served, not a raw API client. Accepts: an explicitly
// allow-listed origin (WEB_ORIGINS or a configured REALM_ORIGINS entry), the same
// host the request was sent to (Host / X-Forwarded-Host), or localhost for dev.
export function isWebClientRequest(
  req: Pick<IncomingMessage, 'headers'>,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || origin === '') return false;
  const allow = new Set<string>([
    ...REALM_ORIGINS,
    ...NATIVE_APP_ORIGINS,
    ...String(env.WEB_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ]);
  if (allow.has(origin)) return true;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  if (host === '') return false;
  const fwd = String(req.headers['x-forwarded-host'] ?? '')
    .split(',')[0]
    .trim();
  const reqHost = String(req.headers.host ?? '');
  if (host === fwd || host === reqHost) return true;
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}

// Ported from upstream's cross-site Origin check (server/http/middleware/
// origin_check.ts, levy-street/world-of-claudecraft#1491, primitive 2/6 of the
// PHAA-519 REST decomposition), as a targeted gate rather than their onion
// middleware: state-changing (non-GET/HEAD/OPTIONS) /api requests whose Origin
// is present but not recognised as ours are rejected outright, no log-only mode.
// GET/HEAD are read-only and OPTIONS is the CORS preflight (already
// short-circuited before any handler runs), so neither is ever gated.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// True when `req` is a state-changing request whose Origin is clearly
// cross-site: present, and not recognised by isWebClientRequest (the SAME
// allow-list the web-login guard above uses, so a WEB_ORIGINS entry or
// same-origin host that satisfies one satisfies both, and the two guards
// cannot drift onto different notions of "ours"). An absent Origin is never
// cross-site here: the API is bearer-only with no cookies (CSRF risk is
// minimal), and native clients/beacons that send no Origin header must keep
// working.
//
// Gated on webLoginEnforced (the SAME on/off condition as the sibling login
// guard above: production by default, or forced via REQUIRE_WEB_LOGIN), not
// unconditional. Without this, a LAN-host dev/e2e setup (`vite --host` plus the
// browserless screenshot/E2E scripts connecting from a non-localhost origin,
// e.g. `http://10.0.0.100:5173`) would start getting its mutating requests
// rejected outright, even though that traffic was never audited the way
// production's REALM_ORIGINS/WEB_ORIGINS allow-list is. Sharing the flag keeps
// the two guards' enforcement conditions from diverging.
export function isCrossSiteApiRequest(
  req: Pick<IncomingMessage, 'headers' | 'method'>,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!webLoginEnforced(env)) return false;
  const method = (req.method ?? '').toUpperCase();
  if (!MUTATING_METHODS.has(method)) return false;
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || origin === '') return false;
  return !isWebClientRequest(req, env);
}
