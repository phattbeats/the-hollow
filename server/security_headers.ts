// Response-header helper ported from upstream's server/http/middleware/
// security_headers.ts (levy-street/world-of-claudecraft#1491, primitive 1/6 of
// the REST decomposition, PHAA-523). Upstream wires it as a top-level wrapper
// ahead of its middleware onion; we have no such registry, so it is called
// directly as the first statement of routeHttpRequest (server/main.ts) instead,
// covering every branch: CORS, the OPTIONS-204 preflight short-circuit, and
// every route including static/404. It must never run on the WS upgrade
// handshake, which server.on('upgrade') handles outside routeHttpRequest by
// construction.
//
// Deliberately NOT set, matching upstream: Content-Security-Policy (deferred to
// a separate report-only effort) and Cross-Origin-Embedder-Policy (it would
// break the cross-origin GLB/HDRI asset loads the renderer depends on).
// Also NOT ported from upstream's primitive: Strict-Transport-Security, the
// /oauth/-only X-Frame-Options + Cache-Control hardening, and Server/
// X-Powered-By stripping. PHAA-523 scopes this port to exactly the five
// unconditional headers below; the rest is out of scope for this change.

import type * as http from 'node:http';

const HEADER_CONTENT_TYPE_OPTIONS = 'X-Content-Type-Options';
const HEADER_REFERRER_POLICY = 'Referrer-Policy';
const HEADER_PERMISSIONS_POLICY = 'Permissions-Policy';
const HEADER_CROSS_ORIGIN_OPENER_POLICY = 'Cross-Origin-Opener-Policy';
const HEADER_CROSS_ORIGIN_RESOURCE_POLICY = 'Cross-Origin-Resource-Policy';

const CONTENT_TYPE_OPTIONS_VALUE = 'nosniff';
const REFERRER_POLICY_VALUE = 'strict-origin-when-cross-origin';
const CROSS_ORIGIN_OPENER_POLICY_VALUE = 'same-origin';
const CROSS_ORIGIN_RESOURCE_POLICY_VALUE = 'same-origin';

// The browser features denied to every page, mirroring upstream's list.
// Fullscreen and Gamepad are deliberately ABSENT: the game client calls the
// Fullscreen API (src/main.ts, the mobile landscape orientation lock) and the
// Gamepad API (src/game/gamepad.ts). Everything below is a sensor/capability
// the game never uses.
const PERMISSIONS_POLICY_DENY_FEATURES: readonly string[] = [
  'accelerometer',
  'ambient-light-sensor',
  'battery',
  'bluetooth',
  'camera',
  'display-capture',
  'geolocation',
  'gyroscope',
  'hid',
  'idle-detection',
  'local-fonts',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'serial',
  'usb',
  'xr-spatial-tracking',
];

// Each denied feature as `name=()` (an empty allowlist), joined into the single
// Permissions-Policy value. Built once from the list above so the list is the
// one source of truth.
const PERMISSIONS_POLICY_VALUE = PERMISSIONS_POLICY_DENY_FEATURES.map(
  (feature) => `${feature}=()`,
).join(', ');

/**
 * Set the security headers on `res` for every HTTP response the server emits.
 */
export function applySecurityHeaders(res: http.ServerResponse): void {
  res.setHeader(HEADER_CONTENT_TYPE_OPTIONS, CONTENT_TYPE_OPTIONS_VALUE);
  res.setHeader(HEADER_REFERRER_POLICY, REFERRER_POLICY_VALUE);
  res.setHeader(HEADER_PERMISSIONS_POLICY, PERMISSIONS_POLICY_VALUE);
  res.setHeader(HEADER_CROSS_ORIGIN_OPENER_POLICY, CROSS_ORIGIN_OPENER_POLICY_VALUE);
  res.setHeader(HEADER_CROSS_ORIGIN_RESOURCE_POLICY, CROSS_ORIGIN_RESOURCE_POLICY_VALUE);
}
