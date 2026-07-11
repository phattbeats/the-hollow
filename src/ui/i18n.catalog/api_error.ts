// i18n source catalog - stable API error codes (PHAA-528). English values
// only; the locale translations live in src/ui/i18n.locales/<lang>.ts (the
// runtime-authoritative overlays), filled by the maintainer at release. Every
// key here is "wordy" under the M16 rule (see src/ui/CLAUDE.md), so its five
// non-Latin fills (zh_CN/zh_TW/ja_JP/ko_KR/ru_RU) ship in the SAME change.
//
// Assembled into `en` by ./index.ts under the `apiError` namespace. One key per
// ApiErrorCode (src/net/api_error_codes.ts) that has a single, caller-
// independent message; a code whose detail varies per caller (ACCOUNT_LOCKED)
// has no entry here and stays on the pre-existing string matcher, see
// src/ui/api_error_i18n.ts.
export const apiErrorStrings = {
  crossSiteRejected: 'Cross-site request rejected.',
  notAuthenticated: 'Not authenticated.',
  readOnlyToken: 'This token is read-only.',
  characterNotFound: 'Character not found.',
  rateLimited: 'Too many attempts. Wait a minute and try again.',
};
