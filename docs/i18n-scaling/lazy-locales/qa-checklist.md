# qa-checklist.md - i18n Lazy Locales (whole-feature integration matrix)

Verified once at packet completion (final QA phase), in addition to each phase's own QA. Mirrors the design doc's 8 acceptance gates + the three determinism properties.

## Bundle / payload (the point of the feature)
- [ ] Main client chunk gzip <= ~0.62 MB (from 1.13 MB): `gzip -c dist/assets/main-*.js | wc -c`.
- [ ] i18n share of the main chunk gzip <= ~45 KB (en only), via bundle analysis.
- [ ] 13 + dialect content-hashed locale chunks exist: `ls dist/assets/*-*.js`; each ~37-44 KB gzip (`gzip -c dist/assets/<lang>-*.js | wc -c`).
- [ ] `en` is NOT a separate locale chunk (it is eager, in main).
- [ ] A default-English visitor downloads ZERO non-English locale bytes: default-load network trace has no `es-*.js`..`ru_RU-*.js` request, and no non-en locale data is baked into `main-*.js`.

## Synchronous t() / correctness
- [ ] `t()` signature + inner loop unchanged; it reads `resident[lang] ?? resident.en!` synchronously.
- [ ] A non-en `currentLanguage` renders translated synchronously AFTER an awaited `ensureLocaleLoaded`, and falls back to English BEFORE it (no throw, no flash).
- [ ] `ensureLocaleLoaded` is idempotent, coalescing (one inflight promise per lang), English-instant, and failure-soft (rejection -> English fallback, retry allowed, no rejected bootstrap).
- [ ] `?lang=es` and one CJK locale (e.g. `zh_CN`) render fully localized with no English flash and no layout shift, on first paint AND in-session swap.
- [ ] Loader rejection (simulated 404) degrades to English with no client crash; `settings.languageLoadFailed`/`languageLoadUnavailable` surface via `t()`.

## Determinism / reproducibility (three properties)
- [ ] **Determinism:** `assertDeterministic` double-generation is byte-identical (perturbed `TZ`/`LC_ALL`/temp path) for both game + admin generators.
- [ ] **Freshness:** `git diff --exit-code` clean against the committed `i18n.resolved.generated/` dirs after `npm run i18n:gen`.
- [ ] **Completeness:** `npx tsc --noEmit` green (every locale module `: EnTranslations`, per file).
- [ ] **SHA invariance:** `npm run i18n:hash -- --check` OK; baseline `d74aeb6..` did NOT move across the whole packet.

## i18n completeness / two-tier gate
- [ ] The 3 new keys (`settings.languageLoadFailed`, `languageLoadUnavailable`, `languageLoading`) exist in `en` and are filled in the 10 base locales; `es_ES`/`fr_CA` inherit, `en_CA` English.
- [ ] PR-tier `npm test` green (English-only permitted); `I18N_RELEASE_TIER=1 npm test` green on the translated tree, and still RED on a synthetic pending row (gate teeth intact).
- [ ] `npx vitest run tests/localization_fixes.test.ts` (S3 guard) green.
- [ ] No `t()` key value changed (the resolved table is content-identical to pre-packet, modulo the 3 new keys).

## en_XA dev pseudo-locale
- [ ] `?lang=en_XA` works in dev (game + admin) and pseudo-izes the `t()` tables.
- [ ] The prod `vite build` bundle contains NO `en_XA` in any chunk (tree-shaken; `en_XA` absent from `LOCALE_LOADERS`/`translations`/`SUPPORTED_LANGUAGES`).

## Canary + test seam
- [ ] `tests/homepage_foundation.test.ts` awaits `ensureLocaleLoaded` per non-en locale before its sync `t()` assertion.
- [ ] `tests/i18n_t_behavior.test.ts` mock is re-pointed to the lazy seam; the release-only empty-pending assertion still passes.
- [ ] New loader/fallback/non-en-sync tests are present and meaningful (not "it runs").

## Admin parity
- [ ] `src/admin/i18n.resolved.generated/` has the per-locale file split (parity).
- [ ] Admin KEEPS its static import (no lazy flip); its async surface (`ensureAdminLocaleLoaded`) mirrors structurally.
- [ ] Admin resolved table reproducible; no admin completeness regression.

## CI / git hygiene
- [ ] `src/ui/i18n.status.json` is gitignored and untracked; `git status` clean after build with no megabyte file tracked.
- [ ] `.gitattributes` marks the generated dirs `linguist-generated` (GitHub collapses them in PR diffs).
- [ ] `i18n:gen` runs in BOTH CI jobs after `npm ci`, before typecheck/build.
- [ ] Committed `i18n.status.summary.json` (few KB) cross-checked by the registry test.

## Scope / safety
- [ ] No `src/sim` / `server` / `src/net` / IWorld / wire / persistence change in the whole packet diff.
- [ ] `privacy-security-review` PASS for the Phase 5 CI change; no secret/`ALLOW_DEV_COMMANDS` introduced; the inline boot script reads only `localStorage.locale` and injects a same-origin preload.
- [ ] No em dashes / emojis in any player-facing copy or commit message.
- [ ] No generated-file hand-edits anywhere in the diff.

## Build gate (CI-equivalent, pre-merge)
- [ ] `npm test && npx tsc --noEmit && npm run build:env && npm run build:server && npm run build` all green.

## Performance
- [ ] Throttled TTI probe (Slow-4G + 4x CPU, median of N): English faster than pre-packet; non-en not slower; delta-based (absolute ms depends on the runner).
- [ ] First-paint screenshot diff: 0 frames of English-then-localized flash.
- [ ] `npm run asset:budget` within budget (no renderer asset change expected).

## Packet teardown (final QA only)
- [ ] All deferred follow-ups surfaced (esp. the release-tier fill of the 3 keys if not yet done, and the 3a/3b probe outcome).
- [ ] On explicit user confirmation, delete ONLY `docs/i18n-scaling/lazy-locales/` (the design doc + `translation-workflow.md` one level up STAY). `git rm -r docs/i18n-scaling/lazy-locales/` if committed, then `docs: remove i18n lazy-locales planning scaffolding`.
