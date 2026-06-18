# progress.md - i18n Lazy Locales

Live status. Each phase session updates its own row + checklist in the SAME commit as its code.

## Status table
| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| 1 - Per-locale emit split | NOT STARTED | | |
| 1 QA | NOT STARTED | | |
| 2 - Async loader + bootstrap | NOT STARTED | | |
| 2 QA | NOT STARTED | | |
| 3 - The lazy flip | NOT STARTED | | |
| 3 QA | NOT STARTED | | |
| 4 - Modulepreload + first-paint perf | NOT STARTED | | |
| 4 QA | NOT STARTED | | |
| 5 - Artifact / CI / determinism hygiene | NOT STARTED | | |
| 5 QA | NOT STARTED | | |
| 6 - i18n.en.ts directory split | NOT STARTED | | |
| 6 QA | NOT STARTED | | |

Status values: NOT STARTED / IN PROGRESS / COMPLETE / COMPLETE (WITH FOLLOWUPS) / BLOCKED.

## Phase 1 - Per-locale emit split (Doc Step 1)
Deliverables:
- [ ] `scripts/i18n_build.mjs` emits `src/ui/i18n.resolved.generated/` (one dense `<lang>.ts` per locale with its `: EnTranslations` annotation, plus `en_XA.ts`) instead of the single file.
- [ ] Generated `index.ts` barrel re-exports every locale + `en_XA` + `pending` + assembles the `translations` map (exact import surface preserved).
- [ ] Generated `loaders.ts` exports `LOCALE_LOADERS` (dynamic-import thunk per non-en locale, NOT `en_XA`) and `SUPPORTED_LANGUAGES`.
- [ ] Generated `pending.ts` exports `pending`.
- [ ] `I18N_OUT_DIR` env override added; emit is atomic (compute all in memory, then write / `rmSync`+recreate - no torn directory).
- [ ] `scripts/i18n_admin_build.mjs` mirrors the same directory transform into `src/admin/i18n.resolved.generated/` (parity only).
- [ ] `scripts/i18n_scan.mjs` reads the new directory shape.
Acceptance:
- [ ] `npm run i18n:build && npm run i18n:admin && npm run i18n:scan && git diff --exit-code` (regenerates identically; new dir committed).
- [ ] `npm run i18n:hash -- --check` OK (SHA `d74aeb6..` unchanged).
- [ ] `npx tsc --noEmit` + `npm test` green; `npm run build` gzip within noise of 1.13 MB (no bundle change - all 14 still pulled via the static barrel).

## Phase 2 - Async loader + bootstrap (Doc Step 2)
Deliverables:
- [ ] `src/ui/i18n.ts`: `resident` map (seeded `{ en }` + the current language synchronously), `inflight` map, `ensureLocaleLoaded(lang)` (idempotent, coalescing, English-instant, failure-soft, shape-tolerant read `mod.default ?? mod[lang]`), `isLocaleResident(lang)`, `reportLocaleLoadFailure`; `tableFor()` final line `resident[lang] ?? resident.en!`.
- [ ] `setLanguage` stays synchronous and unchanged in signature (does NOT load); `supportedLanguages` derives from `SUPPORTED_LANGUAGES`.
- [ ] `src/main.ts`: `await ensureLocaleLoaded(getLanguage())` before the first `t()` in `startGame` (behind the loading screen); `await ensureLocaleLoaded(selected)` in the picker handler before `setLanguage`.
- [ ] 3 new `en` keys: `settings.languageLoadFailed`, `settings.languageLoadUnavailable`, `settings.languageLoading` (rendered via `t()`).
- [ ] Admin mirror: `ensureAdminLocaleLoaded` before `localizeStatic()` (async surface only; no lazy flip).
- [ ] Maintainer fills the 3 keys in the 10 base locales so the release-tier gate stays green (recommended within this phase).
Acceptance:
- [ ] `npm test` + a new test: `t()` is synchronous and correct for a non-en `currentLanguage` before AND after an awaited `ensureLocaleLoaded`.
- [ ] `?lang=es` shows no flash / no console error; `i18n:hash --check` OK; `tsc --noEmit` green.
- [ ] Bundle may tick up slightly (loaders + lazy chunks emitted alongside still-static statics) - do NOT advertise a bundle win yet.

## Phase 3 - The lazy flip (Doc Step 3)
Deliverables:
- [ ] `src/ui/i18n.ts` imports only `en` + `pending` + `LOCALE_LOADERS` + `SUPPORTED_LANGUAGES` (plus dev-only `en_XA` behind the PROD guard); the 13 statics are no longer eagerly imported.
- [ ] Tree-shake probe: `npm run build` then `gzip -c dist/assets/main-*.js | wc -c`; if ~590 KB, Option 3a holds (keep `i18n.ts` re-exporting the dense consts). If the probe fails, fall to Option 3b (repoint const-importing tests + `i18n_resolved_hash.mjs` at the generated `index.ts`) as a SEPARATE commit.
- [ ] Fix `tests/homepage_foundation.test.ts`: `await ensureLocaleLoaded(lang.code)` before the synchronous `t()` assertion per non-en locale.
- [ ] Fix `tests/i18n_t_behavior.test.ts`: re-point the pending-injection mock to the new seam (mock `LOCALE_LOADERS.es` / the per-locale `es` module or pre-seed `resident.es`, then `await ensureLocaleLoaded("es")`).
- [ ] New tests: loader-rejection (simulated 404) -> English fallback, no crash; non-en current language renders translated after await; pending/release hard-fail still throws.
Acceptance:
- [ ] `dist/assets/`: `main-*.js` gzip ~590 KB (<= 0.62 MB); 13 + dialect content-hashed locale chunks (~42 KB gzip each); `en` not a separate chunk.
- [ ] Default-English load network trace: ZERO `es-*.js`..`ru_RU-*.js` requests; no non-en locale data baked into `main-*.js`.
- [ ] `i18n:hash --check` OK; `npm test` green with the canary edits; `tsc --noEmit` green.
- [ ] `?lang=es` + one CJK locale render fully localized, no flash, no layout shift (first paint + in-session swap).

## Phase 4 - Modulepreload + first-paint perf (Doc Step 4 preload deliverable)
Deliverables:
- [ ] Inline boot `<script>` in `index.html` `<head>` reads `localStorage.locale` and injects `<link rel="modulepreload">` for that locale's hashed chunk before the main module parses (resolve the hashed filename from Vite's post-build `manifest.json`; match `crossorigin`).
- [ ] Runtime prefetch helper (starts the locale fetch earlier within the same execution) retained alongside the `<link>` (ship BOTH).
- [ ] Do NOT speculatively preload other locales (re-introduces bloat).
Acceptance:
- [ ] Network trace for a stored non-en locale: the locale chunk is a high-priority, parser-discoverable request (no main-then-locale waterfall), with NO double-fetch.
- [ ] `npm run build` green; correct hashed filename resolved from `dist/.vite/manifest.json`.
- [ ] Throttled TTI probe (Slow-4G + 4x CPU, median of N): English not slower, stored-locale faster than the no-preload baseline; mobile screenshot shows no layout shift.

## Phase 5 - Artifact / CI / determinism hygiene (Doc Step 4 CI/git)
Deliverables:
- [ ] `git rm --cached src/ui/i18n.status.json` + gitignore it.
- [ ] `.gitattributes`: mark `i18n.resolved.generated/**` (and the admin twin) `linguist-generated`.
- [ ] `package.json`: add `i18n:gen` (`i18n:build && i18n:admin && i18n:scan`).
- [ ] `.github/workflows/ci.yml`: add a `Generate i18n artifacts` (`npm run i18n:gen`) step to BOTH jobs, after `npm ci`, before typecheck/build.
- [ ] `tests/helpers/i18n_determinism.ts`: `assertDeterministic({ script, outFiles, env? })` (double-generate via `I18N_OUT_DIR`, perturb `TZ`/`LC_ALL`/temp path); replace the `status.json` freshness sub-suite in `tests/i18n_status_registry.test.ts` with it; repoint the directory diff in `tests/i18n_resolved_equivalence.test.ts`.
- [ ] Ship committed `src/ui/i18n.status.summary.json` (counts + per-locale rollup + `universeHash`, no per-key bodies), cross-checked by the registry test.
Acceptance:
- [ ] Fresh clone -> `npm ci && npm test` green with `i18n.status.json` ABSENT pre-build (proves `pretest` regenerates it).
- [ ] `I18N_RELEASE_TIER=1 npm test` green on a translated tree; red on a synthetic pending row (gate teeth intact).
- [ ] `git status` clean after build; no megabyte file tracked; `i18n:hash --check` OK.

## Phase 6 - i18n.en.ts directory split (Doc Q6 / Section 4.4.3)
Deliverables:
- [ ] Split `src/ui/i18n.en.ts` into `src/ui/i18n.en/` (`shell.ts`, `hud.ts`, `abilities.ts`, `quests.ts`, `items.ts`, `game.ts`, `_merge.ts`) + barrel `index.ts`; `i18n.en.ts` becomes a thin re-export (public surface unchanged).
- [ ] Each module keeps its exact content; no value changes (this is a pure module reorg).
Acceptance:
- [ ] Resolved table byte-identical -> `i18n:hash --check` OK (SHA unchanged); `git diff --exit-code` on the regenerated dirs.
- [ ] `npx tsc --noEmit` + `npm test` + `npm run build` green; public import surface from `i18n.en` unchanged.

## Notes (filled after completion)
- Phase 1: _pending_
- Phase 2: _pending_
- Phase 3: _pending_ (record the 3a-vs-3b probe outcome here)
- Phase 4: _pending_
- Phase 5: _pending_
- Phase 6: _pending_
