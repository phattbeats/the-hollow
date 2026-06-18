# progress.md - i18n Lazy Locales

Live status. Each phase session updates its own row + checklist in the SAME commit as its code.

## Status table
| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| 1 - Per-locale emit split | COMPLETE | 2026-06-17 | 2026-06-17 |
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
- [x] `scripts/i18n_build.mjs` emits `src/ui/i18n.resolved.generated/` (one dense `<lang>.ts` per locale with its `: EnTranslations` annotation, plus `en_XA.ts`) instead of the single file.
- [x] Generated `index.ts` barrel re-exports every locale + `en_XA` + `pending` + assembles the `translations` map (exact import surface preserved).
- [x] Generated `loaders.ts` exports `LOCALE_LOADERS` (dynamic-import thunk per non-en locale, NOT `en` / NOT `en_XA`) and `SUPPORTED_LANGUAGES` (all 14: en + 13, not en_XA).
- [x] Generated `pending.ts` exports `pending`.
- [x] `I18N_OUT_DIR` env override added; emit is atomic. **Deviation from the doc's `rmSync`+recreate:** uses per-file temp-write + `renameSync` + orphan-sweep instead. A bare `rmSync(dir)` makes every slice momentarily ABSENT, and a concurrent Vitest worker resolving `./en_XA` through the barrel (while the two reproducibility tests regenerate the dir) then fails with "Cannot find module". Temp+rename keeps every module path continuously present and atomically replaced, still leaves no orphan (the sweep deletes any stale `*.ts`), and is strictly crash-safer (no torn/empty dir). Verified: full `npm test` green.
- [x] `scripts/i18n_admin_build.mjs` mirrors the same directory transform into `src/admin/i18n.resolved.generated/` (parity only; admin stays static).
- [x] `scripts/i18n_scan.mjs` reads the new directory shape. **No edit needed:** the scanner reads the SPARSE SOURCE overlays (`i18n.en` + `i18n.locales/*` + the admin twin + sim/server DICTs), never the resolved table, so the dir split does not touch its inputs and `i18n:scan` produces a byte-identical `i18n.status.json` (verified clean `git diff`). The deliverable is satisfied by construction.
Acceptance:
- [x] `npm run i18n:build && npm run i18n:admin && npm run i18n:scan && git diff --exit-code` (regenerates identically; new dirs staged).
- [x] `npm run i18n:hash -- --check` OK (SHA `d74aeb6..` unchanged - exact: `d74aeb631f37f3d8a4374ff9940e450e062aa4062c821ab3349ae7ada28b2e4d`).
- [x] `npx tsc --noEmit` + `npm test` green (1542 passed / 9 skipped / 153 files); `npm run build` bundle-neutral: HEAD single-file main gzip 1,194.58 kB vs this dir-split 1,194.62 kB (+40 bytes). **NB: the doc's "1.13 MB" is stale; the real pre-existing size on this branch is 1.19 MB, unchanged by this phase.** `en_XA` + `loaders.ts` both tree-shaken out (0 pseudo glyphs, 0 `LOCALE_LOADERS` in dist main+admin).

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
- Phase 1: DONE 2026-06-17. The single `src/ui/i18n.resolved.generated.ts` (and admin twin) are now generated DIRECTORIES: `en.ts`..`ru_RU.ts` (14 dense `: EnTranslations` / `: AdminTranslations` slices) + `en_XA.ts` + `pending.ts` + `loaders.ts` + `index.ts` barrel. Directory-index import (`'./i18n.resolved.generated'` -> `index.ts`) resolves cleanly under moduleResolution "Bundler" (precedent: `src/render/characters/`); `src/ui/i18n.ts` + `src/admin/i18n.ts` needed ZERO change. SHA invariant because `scripts/i18n_resolved_hash.mjs` bundles `i18n.ts` EXPORTS, not file bytes. Two reality nuances vs the doc (see deliverables above): scanner needed no edit (reads source, not the resolved table); atomic emit uses temp+rename+sweep, not `rmSync` (the `rmSync` window broke concurrent barrel resolution in `npm test`). Tests touched: `tests/i18n_resolved_equivalence.test.ts` + `tests/i18n_admin_catalog.test.ts` repointed their reproducibility git-checks at the directory; the admin bundle-isolation check changed from a crude `startsWith("..")` to resolve-and-check-escape-from-`src/admin/` (the new in-dir `../i18n.en` type import is legitimate; a `../ui/...` game-table import is still caught). Nothing is lazy yet; all 14 locales still pulled through the static barrel. In-phase qa-checklist review run at completion (STEP 3); the dedicated Phase 1 QA session (`phase-01-qa.md`) is still NOT STARTED.
- Phase 2: _pending_
- Phase 3: _pending_ (record the 3a-vs-3b probe outcome here)
- Phase 4: _pending_
- Phase 5: _pending_
- Phase 6: _pending_
