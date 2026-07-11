// Stable, bounded machine-readable API error codes, shared by the server
// problem+json envelope (server/http_errors.ts) and the client code-first
// matcher (src/ui/api_error_i18n.ts). Ported from upstream's error_codes.ts
// (levy-street/world-of-claudecraft#1491, primitive 6/6 of the PHAA-519 REST
// decomposition, PHAA-528).
//
// Scoped to the denial paths primitives 1-5 of that decomposition already
// introduced (Origin checks, BOLA ownership, internal-secret checks, rate
// limiting): this is NOT a catalog for every REST error in the codebase.
// PHAA-528 deliberately does not attempt a full-surface error-model rewrite;
// see that ticket for the scoping rationale. A code that needs a caller-
// specific detail (e.g. account lockout, whose message varies by ban vs.
// suspension vs. deactivation) is intentionally left OFF the client's
// code-first matcher and keeps resolving through the existing string
// matcher (src/main.ts's userFacingApiError).
//
// Lives under src/net/ (not server/ or src/ui/) so both sides can import it:
// server/ already imports plain data modules from src/ (e.g. internal.ts's
// specialRoleByKey from src/sim/discord_roles), and src/ui/ must never import
// server/ code.
export const API_ERROR_CODES = [
  /** Cross-site Origin check rejected the request (PHAA-524). */
  'CROSS_SITE_ORIGIN_REJECTED',
  /** No (or an unrecognized) bearer token (server/ownership.ts, server/internal.ts). */
  'NOT_AUTHENTICATED',
  /** A read-scope token attempted a mutating route (server/ownership.ts). */
  'READ_ONLY_TOKEN',
  /** The account is banned, suspended, or deactivated (server/ownership.ts). */
  'ACCOUNT_LOCKED',
  /** The BOLA ownership loader found no character owned by the caller (PHAA-525). */
  'CHARACTER_NOT_FOUND',
  /** One of the in-memory rate limiters denied the request (server/ratelimit.ts). */
  'RATE_LIMITED',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
