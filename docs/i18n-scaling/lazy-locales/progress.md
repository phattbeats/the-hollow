# progress.md - i18n Lazy Locales

Live status. Each phase session updates its own row + checklist in the SAME commit as its code.

## Status table
| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| 1 - Per-locale emit split | COMPLETE | 2026-06-17 | 2026-06-17 |
| 1 QA | COMPLETE (WITH FOLLOWUPS) | 2026-06-18 | 2026-06-18 |
| 2 - Async loader + bootstrap | COMPLETE | 2026-06-18 | 2026-06-18 |
| 2 QA | COMPLETE | 2026-06-18 | 2026-06-18 |
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
- [x] `npm run i18n:hash -- --check` OK (SHA `d74aeb6..` unchanged - exact: `d74aeb631f37f3d8a4374ff9940e450e062aa4062c821ab3349ae7ada28b2e4d`). NB: that was the Phase-1 SHA on the release/v0.9 baseline; the 2026-06-18 v0.10.0 merge (5e78a85) re-baselined the resolved table to `9606d9cf..` (now the value committed in `src/ui/i18n.resolved.sha256`).
- [x] `npx tsc --noEmit` + `npm test` green (1542 passed / 9 skipped / 153 files); `npm run build` bundle-neutral: HEAD single-file main gzip 1,194.58 kB vs this dir-split 1,194.62 kB (+40 bytes). **NB: the doc's "1.13 MB" is stale; the real pre-existing size on this branch is 1.19 MB, unchanged by this phase.** `en_XA` + `loaders.ts` both tree-shaken out (0 pseudo glyphs, 0 `LOCALE_LOADERS` in dist main+admin).

## Phase 2 - Async loader + bootstrap (Doc Step 2)
Deliverables:
- [x] `src/ui/i18n.ts`: `resident` map (seeded `{ en }` + the boot language synchronously), `inflight` map, `ensureLocaleLoaded(lang)` (idempotent, coalescing, English-instant, failure-soft, shape-tolerant read `mod.default ?? mod[lang]`), `isLocaleResident(lang)`, `reportLocaleLoadFailure`; `tableFor()` gains the English fallback. **DEVIATION (intentional):** `tableFor()` is `resident[lang] ?? translations[lang] ?? resident.en!`, NOT the packet's literal `resident[lang] ?? resident.en!`. The `translations[lang]` middle term is the still-static backstop that keeps Phase 2 byte-for-byte unchanged: ~6 test files (`homepage_foundation`, `sim_item_i18n`, `quartermaster_gear`, `chat_context_menu`, `server_i18n`, `localization_coverage`, `localization_fixes`) call `setLanguage(non-en)` then `t()` synchronously without an await, and the packet schedules their await-fixes for Phase 3 - so without the backstop they would regress to English and `npm test` would go red THIS phase. resident[lang] when loaded == translations[lang] content (same generated module), so it is provably byte-identical. **Phase 3 removes the `translations[lang]` term** when it drops the static barrel import; that is the natural site of the change.
- [x] `setLanguage` stays synchronous and unchanged in signature (does NOT load); `supportedLanguages` derives from `SUPPORTED_LANGUAGES` (`[...SUPPORTED_LANGUAGES]`, pinned equal to `Object.keys(translations)` by `i18n_emit_shape`).
- [x] `src/main.ts`: `await ensureLocaleLoaded(getLanguage())` after the loading-screen paint, before `mountGameUi` in `startGame` (behind the loading screen); `await ensureLocaleLoaded(selected)` in the (now async) picker handler before `setLanguage`; homepage shell (`wireStartScreens`) awaits before its initial `translatePage` (`.then(translatePage, translatePage)` so the English fallback still renders and no rejection escapes).
- [x] 3 new `en` keys: `settings.languageLoadFailed`, `settings.languageLoadUnavailable`, `settings.languageLoading` (TOP-LEVEL `settings` namespace, NOT `game.settings`; rendered via `t()` at the picker + a new `#lang-select-status` aria-live span in index.html).
- [x] Admin mirror: `ensureAdminLocaleLoaded` (+ `isAdminLocaleResident`) awaited before `localizeStatic()` in `src/admin/main.ts` (async surface only; admin keeps every locale static, so the load body is unreachable - parity scaffolding, no lazy flip).
- [x] Maintainer filled the 3 keys in the 10 base locales (es, fr_FR, it_IT, de_DE, zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU); es_ES/fr_CA inherit via DIALECT_BASE, en_CA stays English, en_XA pseudo-localized. Registry `pending=0` held; release-tier gate dry-run green.
Acceptance:
- [x] `npm test` green (224 files / 1962 passed / 9 skipped) + new `tests/i18n_lazy_loader.test.ts`: `t()` is synchronous and correct for a non-en `currentLanguage` before AND after an awaited `ensureLocaleLoaded` (pre-await via the static backstop, post-await via resident), plus English-instant, coalescing, and the 3 new keys.
- [x] `i18n:hash --check` OK at the re-baselined SHA `3254ea95..` (was `9606d9cf..`; the move is exactly the 3-key fill - diff is purely additive, only the 3 keys across all 15 slices); `tsc --noEmit` green. (`?lang=es` no-flash is structurally guaranteed by the await sitting behind the painted loading screen; full browser confirmation belongs to Phase 2 QA / Phase 3.)
- [x] Bundle ticked up slightly as expected (main gzip 1,264.62 kB vs the v0.10 Phase-1-QA baseline 1,263.10 kB, +1.52 kB: loader code + the 3 keys x locales in the still-static main chunk). NOT advertised as a win; the lazy win is Phase 3.

## Phase 3 - The lazy flip (Doc Step 3)
Deliverables:
- [ ] `src/ui/i18n.ts` imports only `en` + `pending` + `LOCALE_LOADERS` + `SUPPORTED_LANGUAGES` (plus dev-only `en_XA` behind the PROD guard); the 13 statics are no longer eagerly imported.
- [ ] Tree-shake probe: `npm run build` then `gzip -c dist/assets/main-*.js | wc -c`; if ~590 KB, Option 3a holds (keep `i18n.ts` re-exporting the dense consts). If the probe fails, fall to Option 3b (repoint const-importing tests + `i18n_resolved_hash.mjs` at the generated `index.ts`) as a SEPARATE commit.
- [ ] Fix `tests/homepage_foundation.test.ts`: `await ensureLocaleLoaded(lang.code)` before the synchronous `t()` assertion per non-en locale.
- [ ] Fix `tests/i18n_t_behavior.test.ts`: re-point the pending-injection mock to the new seam (mock `LOCALE_LOADERS.es` / the per-locale `es` module or pre-seed `resident.es`, then `await ensureLocaleLoaded("es")`).
- [ ] New tests: loader-rejection (simulated 404) -> English fallback, no crash; non-en current language renders translated after await; pending/release hard-fail still throws.
Acceptance:
- [ ] `dist/assets/`: `main-*.js` gzip materially smaller than the pre-flip baseline (pre-v0.10 estimate ~590 KB / <= 0.62 MB; re-measure); 13 + dialect content-hashed locale chunks (~42 KB gzip each, pre-v0.10 estimate); `en` not a separate chunk.
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
- [ ] Resolved table byte-identical -> the resolved-table SHA must not move during the phase: `npm run i18n:hash -- --check` stays green against the baseline committed in `src/ui/i18n.resolved.sha256` at the start of the phase (currently `9606d9cf..` after the 2026-06-18 v0.10.0 merge, NOT the `d74aeb6..` recorded under Phase 1, which was the old release/v0.9 baseline); `git diff --exit-code` on the regenerated dirs. A move within the phase is a real bug (pure module reorg), never a re-baseline.
- [ ] `npx tsc --noEmit` + `npm test` + `npm run build` green; public import surface from `i18n.en` unchanged.

## Notes (filled after completion)
- 2026-06-18: merged release/v0.10.0 (merge 5e78a85); resolved-table baseline re-generated to `9606d9cf..` (was `d74aeb6..`); Phase 1 emit-split intact, Phases 2-6 still pending.
- Phase 1: DONE 2026-06-17. The single `src/ui/i18n.resolved.generated.ts` (and admin twin) are now generated DIRECTORIES: `en.ts`..`ru_RU.ts` (14 dense `: EnTranslations` / `: AdminTranslations` slices) + `en_XA.ts` + `pending.ts` + `loaders.ts` + `index.ts` barrel. Directory-index import (`'./i18n.resolved.generated'` -> `index.ts`) resolves cleanly under moduleResolution "Bundler" (precedent: `src/render/characters/`); `src/ui/i18n.ts` + `src/admin/i18n.ts` needed ZERO change. SHA invariant because `scripts/i18n_resolved_hash.mjs` bundles `i18n.ts` EXPORTS, not file bytes. Two reality nuances vs the doc (see deliverables above): scanner needed no edit (reads source, not the resolved table); atomic emit uses temp+rename+sweep, not `rmSync` (the `rmSync` window broke concurrent barrel resolution in `npm test`). Tests touched: `tests/i18n_resolved_equivalence.test.ts` + `tests/i18n_admin_catalog.test.ts` repointed their reproducibility git-checks at the directory; the admin bundle-isolation check changed from a crude `startsWith("..")` to resolve-and-check-escape-from-`src/admin/` (the new in-dir `../i18n.en` type import is legitimate; a `../ui/...` game-table import is still caught). Nothing is lazy yet; all 14 locales still pulled through the static barrel. In-phase qa-checklist review run at completion (STEP 3); the dedicated Phase 1 QA session (`phase-01-qa.md`) is still NOT STARTED.
- Phase 1 QA: COMPLETE (WITH FOLLOWUPS) 2026-06-18. Verdict PASS-WITH-FOLLOWUPS. Validation matrix all green: byte-identity regen (`i18n:build`+`admin`+`scan` -> `git diff --exit-code` clean), `i18n:hash --check` OK at `9606d9cf..` (SHA did NOT move - layout-only change), `tsc --noEmit` exit 0, `npm test` 223 files / 1958 passed / 9 skipped, `npm run build` bundle-neutral (main gzip 1,263.10 kB; v0.10 re-measure of the stale 1.19 MB figure - all 14 locales still in the main chunk via the static barrel, as designed; the lazy win is Phase 3). 4 review agents (correctness / test-coverage / dead-code / qa-checklist) found 0 BLOCKING. Fixes applied this pass (all NICE-TO-HAVE + the 2 SHOULD-FIX addressed; commits separate from this doc):
  - **NEW test** `tests/i18n_emit_shape.test.ts` (the biggest gap): pins the emit SURFACE for game+admin - `translations` key set (14, en_XA excluded), `LOCALE_LOADERS` keys (13, no en/en_XA), `SUPPORTED_LANGUAGES` == `Object.keys(translations)` == runtime `supportedLanguages`, `pending` key set, and each loader thunk lazily resolves its slice. Plus a determinism + orphan-sweep block that drives both build scripts through the **`I18N_OUT_DIR`** override into an `os.tmpdir()` scratch dir (override branch was previously dead-untested), asserts byte-identical re-emit and that a planted `orphan_zz.ts` is swept - this makes the build-script comment ("used by the determinism test") truthful.
  - **Orphan-sweep hardened**: `writeModuleDir` in both build scripts now also prunes stale `*.ts.tmp` (a crash between `writeFileSync` and `renameSync` left one that the old `.ts`-only sweep ignored); `.gitignore` also guards `src/{ui,admin}/i18n.resolved.generated/*.tmp` so a crash leftover can never be committed. Output byte-identical (SHA unchanged).
  - **Stale-comment sweep**: refreshed the now-misleading single-file `i18n.resolved.generated.ts` references (the artifact is a directory) in `src/ui/i18n.ts`, `src/admin/i18n.ts`, `src/ui/i18n.en.ts`, `src/admin/i18n.en.ts`, `src/ui/CLAUDE.md`, `scripts/i18n_scan.mjs`, `scripts/i18n_admin_split.mjs`, `tests/i18n_build_gapfill.test.ts`, `tests/i18n_dialect_resolution.test.ts`.
  - **Admin-no-SHA asymmetry documented** (assessed NOT a gap - pre-existing): added a note at `scripts/i18n_resolved_hash.mjs` `BASELINE_PATH` that the admin table is intentionally gated by the `i18n_admin_catalog` reproducibility test, not a SHA baseline, so a later phase does not "restore" a file that never existed.
  - **Dead scratch removed**: `git rm fix_braces.mjs` (repo-root one-shot regex hack that mutated `src/sim/sim.ts`; no callers, not wired into npm, entered via merge-fixup `971fbd16` - out of the Phase 1 range but genuinely dead/hazardous).
  - Deferred (correctly out of scope): the `loaders.ts`/`SUPPORTED_LANGUAGES` "could drift later" note is now neutralized by the surface test asserting the two agree; a generalized `assertDeterministic` helper is already Phase 5's deliverable (this QA's scratch-dir determinism test is a narrower early instance - Phase 5 can fold it in).
- Phase 2: DONE 2026-06-18. Landed the async loader seam additively; nothing flipped to lazy. New symbols in `src/ui/i18n.ts`: `resident`/`inflight` maps, `ensureLocaleLoaded`, `isLocaleResident`, `reportLocaleLoadFailure`; `tableFor` English fallback (with the static backstop, see the deliverable note); `supportedLanguages` now from `SUPPORTED_LANGUAGES`. Awaited at three boundaries (startGame, picker, homepage shell) + admin mirror (`ensureAdminLocaleLoaded`). 3 new top-level `settings.*` keys filled across all locales (pending stayed 0). SHA re-baselined `9606d9cf..` -> `3254ea95..` (exactly the 3-key fill). Two review agents (qa-checklist COVERAGE + a correctness diff review) returned 0 BLOCKING / 0 SHOULD-FIX (verdicts PASS and SHIP); both independently confirmed the `tableFor` backstop deviation is correct and byte-for-byte preserving, the SHA move is only the 3 keys, and `t()` stays synchronous. The in-phase `.finally(() => translatePage())` on the homepage shell was changed to `.then(translatePage, translatePage)` per a QA nice-to-have (consume rejection so no unhandled rejection escapes once Phase 3 makes it a real fetch). **Phase 3 handoffs (not Phase 2 defects):** (a) drop the `translations[lang]` term in `tableFor` + the static barrel import when the lazy flip lands; (b) add a loader-rejection test (simulable only after the flip makes a 404 possible) -> English fallback, retry possible, picker shows `languageLoadFailed`; (c) the `startGame` bootstrap `await ensureLocaleLoaded(getLanguage())` rethrows on a real fetch reject (Phase 2 never rejects because the boot language is pre-seeded resident) - Phase 3 must wrap it so a failed first load still falls back to English. **Phase 2 QA is now COMPLETE (see the Phase 2 QA note below); NEXT: run `docs/i18n-scaling/lazy-locales/phase-03-lazy-flip.md` (Phase 3 - the lazy flip).**
- Phase 2 QA: COMPLETE 2026-06-18. Verdict **PASS** (0 BLOCKING, 1 SHOULD-FIX fixed, rest are Phase 3 handoffs). Deterministic matrix all green: `tsc --noEmit` exit 0; full `npm test` 224 files / 1963 passed / 9 skipped (was 1962 - the +1 is the strengthened loader test below); runtime row + `i18n_emit_shape` 6 files / 53 passed; `i18n:hash --check` OK at `3254ea95..` (the committed baseline - SHA did NOT move during QA); `I18N_RELEASE_TIER=1` registry gate 14/14 with **pending=0** (verified across 33,592 rows incl. admin); `i18n:build`+`i18n:admin`+`i18n:scan` regen byte-identical (`git diff --exit-code` clean - no hand-edits); `npm run build` green (main chunk 4.16 MB raw / ~1.255 MB gzip by direct `gzip -c`; the expected slight tick-up, NOT a win). Resolved slices verified +5/-0 additive across all 15 (the 3-key fill only); dialect inheritance correct (en_CA=English, es_ES inherits es, fr_CA inherits fr_FR, en_XA pseudo); the new top-level `en.settings` is a single non-duplicate literal (distinct from `gameStrings.settings` -> `game.settings.*`), no spread collision. 4 review agents (correctness PASS-WITH-FOLLOWUPS, qa-checklist PASS, test-coverage PASS-WITH-FOLLOWUPS, dead-code PASS) returned 0 BLOCKING / 0 SHOULD-FIX except the one test gap below.
  - **SHOULD-FIX applied** (test-coverage): the "coalesces concurrent loads" test did not actually prove coalescing - deleting the `inflight` short-circuit would still pass it. Strengthened in `tests/i18n_lazy_loader.test.ts` to prove the property via a loader-call-count spy (`vi.spyOn(LOCALE_LOADERS,'fr_FR')` -> `toHaveBeenCalledTimes(1)`; spy-through so fr_FR still becomes resident), with a `isLocaleResident('fr_FR')===false` precondition. NB: the agent's first suggested fix `expect(p2).toBe(p1)` is UNSOUND - `ensureLocaleLoaded` is `async`, so each call returns a fresh wrapper promise and outer-promise identity can never hold (it failed when tried). Also added a load-vs-select decoupling test (loading ja_JP while on en leaves `t()` English). Committed separately from this doc.
  - **Phase 3 handoffs surfaced by QA** (NOT Phase 2 defects - all no-ops while everything is static): (a) `tableFor` (`src/ui/i18n.ts:262`) `translations[lang]` middle term + the boot pre-seed (`:143`) must be dropped together with the static barrel import when the flip lands; (b) `startGame` boot-await (`src/main.ts:547`) has no try/catch and `startGame` is invoked as `void startGame(...)` with no `.catch`, so a Phase-3 real boot-locale fetch reject would be an UNHANDLED rejection (the picker and homepage shell already handle reject) - wrap it (English fallback + continue) in Phase 3; (c) the homepage shell await (`src/main.ts:2721`) is NOT behind any loading screen, so a Phase-3 stored non-en locale could flash English on the homepage before the fetch resolves - gate the localized homepage regions until the boot locale resolves; (d) add a loader-rejection (simulated 404) test once the flip makes a thunk failable - English fallback, no crash, retry possible, picker shows `settings.languageLoadFailed`.
- Phase 3: _pending_ (record the 3a-vs-3b probe outcome here)
- Phase 4: _pending_
- Phase 5: _pending_
- Phase 6: _pending_
