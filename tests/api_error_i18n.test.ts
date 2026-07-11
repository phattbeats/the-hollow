// Code-first API error matcher (src/ui/api_error_i18n.ts), PHAA-528 primitive
// 6/6 of the REST decomposition on PHAA-519.
import { describe, expect, it } from 'vitest';
import { apiErrorCodeText } from '../src/ui/api_error_i18n';

describe('apiErrorCodeText', () => {
  it('resolves every covered ApiErrorCode to its localized apiError.* text', () => {
    expect(apiErrorCodeText('CROSS_SITE_ORIGIN_REJECTED')).toBe('Cross-site request rejected.');
    expect(apiErrorCodeText('NOT_AUTHENTICATED')).toBe('Not authenticated.');
    expect(apiErrorCodeText('READ_ONLY_TOKEN')).toBe('This token is read-only.');
    expect(apiErrorCodeText('CHARACTER_NOT_FOUND')).toBe('Character not found.');
    expect(apiErrorCodeText('RATE_LIMITED')).toBe(
      'Too many attempts. Wait a minute and try again.',
    );
  });

  it('returns null for a code with no static generic message (e.g. ACCOUNT_LOCKED), so the caller falls back', () => {
    // ACCOUNT_LOCKED's detail varies by ban vs. suspension vs. deactivation and
    // can't be reduced to one static string; the fine-grained string matcher
    // (src/main.ts's userFacingApiError) must keep handling it.
    expect(apiErrorCodeText('ACCOUNT_LOCKED')).toBeNull();
  });

  it('returns null for an unrecognized or absent code', () => {
    expect(apiErrorCodeText('SOMETHING_NEW')).toBeNull();
    expect(apiErrorCodeText(null)).toBeNull();
    expect(apiErrorCodeText(undefined)).toBeNull();
    expect(apiErrorCodeText('')).toBeNull();
  });
});
