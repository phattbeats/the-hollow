// Code-first API error matcher, ported from upstream's client_error.ts
// (levy-street/world-of-claudecraft#1491, primitive 6/6 of the PHAA-519 REST
// decomposition, PHAA-528). Matches the stable `code` member the server's
// problem+json envelope (server/http_errors.ts) attaches to the denial paths
// primitives 1-5 introduced (Origin checks, BOLA ownership, internal-secret,
// rate limiting). A code with no entry below (e.g. ACCOUNT_LOCKED, whose
// message varies by ban vs. suspension vs. deactivation and can't be reduced
// to one static string) is deliberately left OFF this table: the caller falls
// back to the pre-existing string matcher (src/main.ts's userFacingApiError),
// which already handles it correctly.
//
// Pure, host-agnostic module: no DOM access beyond src/ui/i18n.ts's t(), so it
// is Vitest-testable directly (tests/api_error_i18n.test.ts).
import type { ApiErrorCode } from '../net/api_error_codes';
import { type TranslationKey, t } from './i18n';

const CODE_KEY: Readonly<Partial<Record<ApiErrorCode, TranslationKey>>> = {
  CROSS_SITE_ORIGIN_REJECTED: 'apiError.crossSiteRejected',
  NOT_AUTHENTICATED: 'apiError.notAuthenticated',
  READ_ONLY_TOKEN: 'apiError.readOnlyToken',
  CHARACTER_NOT_FOUND: 'apiError.characterNotFound',
  RATE_LIMITED: 'apiError.rateLimited',
};

/**
 * The localized text for a stable API error `code`, or null when `code` is
 * absent/unrecognized/deliberately uncovered (caller should fall back to its
 * own string matcher).
 */
export function apiErrorCodeText(code: string | null | undefined): string | null {
  if (!code) return null;
  const key = CODE_KEY[code as ApiErrorCode];
  return key ? t(key) : null;
}
