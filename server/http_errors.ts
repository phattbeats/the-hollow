// Stable RFC 9457 (problem+json) error envelope, ported from upstream's
// server/http/{errors.ts,error_codes.ts,client_error.ts} (levy-street/
// world-of-claudecraft#1491, primitive 6/6 of the PHAA-519 REST decomposition,
// PHAA-528). Upstream wires this through a router-level error middleware; we
// have no such registry, so `sendProblem` is called directly at the small set
// of denial choke points primitives 1-5 already introduced (Origin checks,
// BOLA ownership, internal-secret checks, rate limiting) instead of across the
// whole REST error surface (deliberately out of scope, see PHAA-528).
//
// The envelope EXTENDS the existing `{ error: string }` shape (server/
// http_util.ts's json()) rather than replacing it, so every existing caller
// that reads `data.error` (src/main.ts's userFacingApiError string matcher,
// the admin dashboard, integration tests) keeps working unchanged. `code` is
// the new stable, machine-readable member: src/ui/api_error_i18n.ts matches on
// it first, falling back to the legacy string matcher for every route this
// primitive doesn't cover.
import type * as http from 'node:http';
import type { ApiErrorCode } from '../src/net/api_error_codes';

const STATUS_TITLE: Readonly<Record<number, string>> = {
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  429: 'Too Many Requests',
};

/** Extension members beyond the RFC 9457 base shape. Classification only (bounded, request-independent values), never anything request-derived. */
export type ProblemExtra = Readonly<Record<string, string | number | boolean>>;

/** The RFC 9457 problem+json body plus our `error` back-compat alias and stable `code`. */
export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  code: ApiErrorCode;
  detail: string;
  error: string;
}

/** Build the problem+json body without writing it, e.g. to merge into a route's existing envelope (server/internal.ts's `fail`). */
export function problemBody(
  status: number,
  code: ApiErrorCode,
  detail: string,
  extra?: ProblemExtra,
): ProblemBody & ProblemExtra {
  return {
    type: `https://the-hollow.game/errors/${code}`,
    title: STATUS_TITLE[status] ?? 'Error',
    status,
    code,
    detail,
    error: detail,
    ...extra,
  } as ProblemBody & ProblemExtra;
}

/**
 * Write a problem+json response for one of the stable ApiErrorCode denials.
 * Uses the `application/problem+json` media type per RFC 9457 (not
 * server/http_util.ts's json(), which is `application/json`): the client
 * (fetch's res.json()) parses either the same way, so this is purely a wire
 * signal for a client that wants to branch on content type.
 */
export function sendProblem(
  res: http.ServerResponse,
  status: number,
  code: ApiErrorCode,
  detail: string,
  extra?: ProblemExtra,
): void {
  const data = JSON.stringify(problemBody(status, code, detail, extra));
  res.writeHead(status, {
    'Content-Type': 'application/problem+json',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}
