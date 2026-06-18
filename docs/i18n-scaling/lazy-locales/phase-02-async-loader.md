# Phase 2 - Async loader + bootstrap (Doc Step 2)

Additive runtime change: land the async locale-loader surface (`ensureLocaleLoaded` + a resident-table map + an English fallback) and await it at the two boundaries that select a language (bootstrap + the picker), WITHOUT flipping any import to lazy. Everything still static-imports through the Phase 1 barrel, so the new awaits resolve instantly and behavior is unchanged. This wires the seam the lazy flip (Phase 3) needs; nothing downloads on demand yet.

Copy the block below into a fresh Opus 4.8 session.

### Starter Prompt
```
This is Phase 2 of the i18n Lazy Locales feature: Async loader + bootstrap.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: NOT needed. This is a focused runtime change in i18n.ts plus two await
insertions (mirrored in admin), not a content sweep. Do it with direct edits + a small
fan-out at most. Do NOT spin up a Workflow.

Goal: Add the runtime async loader surface to src/ui/i18n.ts - a `resident` table, an
`inflight` coalescing map, `ensureLocaleLoaded(lang)`, `isLocaleResident(lang)`, a soft
failure hook, and an English fallback in `tableFor()` - and await `ensureLocaleLoaded` at
the bootstrap (startGame, behind the loading screen) and the language picker, plus the
admin mirror. This phase is PURELY ADDITIVE: everything still static-imports through the
Phase 1 barrel, so the new awaits are no-ops and behavior is byte-for-byte unchanged. Do
NOT flip any import to lazy - that is Phase 3.

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean. If not, ask the user (a concurrent session may share this checkout).
- Ensure you are on branch `feature/i18n-lazy-locales` (Phase 1 landed there). If it does not
  exist, create it off the current `release/v0.9`: `git switch -c feature/i18n-lazy-locales`.
  If switching branches would disrupt a concurrent session, ask first.
- Memory scan: check your MEMORY.md index + the entries `i18n-resolved-baseline-and-assembly`,
  `i18n-phase3-lazy-locales-plan`, and `shared-worktree-commit-care`.

STEP 1 - LOAD CONTEXT (i18n.ts is small enough to read whole; i18n.en.ts is ~1 MB - grep it, never read it whole):
Spawn ONE Explore agent to read and summarize:
- docs/i18n-scaling/lazy-locales/state.md (locked decisions, scope boundary, validation matrix, new symbols)
- docs/i18n-scaling/lazy-locales/progress.md (the Phase 2 rows + acceptance checklist)
- docs/i18n-scaling/lazy-locales/phase-02-async-loader.md (this prompt)
- src/ui/i18n.ts (FULL - it is only ~275 lines): return the exact current `tableFor`, `setLanguage`,
  `currentLanguage`/`getLanguage` state, the static import surface from the barrel, the en_XA dev
  branch + its `!import.meta.env.PROD` (or `isReleaseBuild()`) guard, and how `supportedLanguages`
  is currently derived.
- src/main.ts - ONLY `startGame` (~520-550, async at 525, first t() at 529) and the picker change
  handler (~3394-3412; there is NO `switchLanguage`, only `setLanguage`). Return the exact insertion
  points: where the loading screen is painted, where mountGameUi() is called, where the picker
  validates `selected` and where it calls `setLanguage`. Also locate the homepage-shell language path.
- src/admin/i18n.ts + src/admin/main.ts - the `localizeStatic()` call site (where admin paints its
  static UI). Return the exact spot to await an admin loader before it.
- src/ui/i18n.en.ts - do NOT read it whole; grep for the `settings` block to find where the 3 new
  keys go and what the surrounding entries look like.
- CLAUDE.md (root) + src/ui/CLAUDE.md.
The agent returns: the exact current tableFor/setLanguage/currentLanguage code, the startGame +
picker insertion points (with line anchors), and the admin localizeStatic call site.

STEP 2 - EXECUTE (direct edits; one Agent for the admin mirror if you want parallelism):

src/ui/i18n.ts (the async surface - this is the heart of the phase):
- Add `const resident: Partial<Record<SupportedLanguage, EnTranslations>> = { en }` (English is
  always resident, statically imported).
- Add `const inflight = new Map<SupportedLanguage, Promise<void>>()` (one in-flight promise per lang).
- Add `export async function ensureLocaleLoaded(lang: SupportedLanguage): Promise<void>`:
  - English-instant: return early if `lang === 'en'` or `isLocaleResident(lang)`.
  - Coalescing: if `inflight.has(lang)`, `return inflight.get(lang)!` (do not start a second import).
  - Otherwise start the load, store the promise in `inflight`, await it, then clear it.
  - On success: `resident[lang] = mod.default ?? (mod as any)[lang]` - SHAPE-TOLERANT (see the
    test-env gotcha below; do NOT assume `mod.default` exists).
  - On error: `inflight.delete(lang)` so a retry is possible, call `reportLocaleLoadFailure(lang, err)`,
    then RETHROW (the caller decides UI - the picker shows `settings.languageLoadFailed`).
  - This phase, the load still comes through the static barrel (the dynamic-import thunk in
    `LOCALE_LOADERS` resolves an already-bundled module), so the await is a no-op. Do NOT remove the
    static barrel import.
- Add `export function isLocaleResident(lang: SupportedLanguage): boolean` returning
  `lang === 'en' || resident[lang] !== undefined`.
- Add `function reportLocaleLoadFailure(lang, err)`: console.warn in dev / telemetry hook in prod.
  Gate the dev/prod split with the existing `isReleaseBuild()` try-catch pattern, NOT a bare
  `import.meta.env.PROD` (see gotcha). Dev-channel only (console) - no player text here.
- `tableFor()`: keep the dev en_XA branch UNCHANGED behind its `!import.meta.env.PROD` / `isReleaseBuild()`
  guard; add as its FINAL line `return resident[lang] ?? resident.en!` (English fallback for an
  unresolved locale).
- Pre-populate `resident[currentLanguage]` synchronously from the still-static `translations` table so
  the bootstrap await is a guaranteed no-op THIS phase (the current language is already resident before
  any await runs).
- `setLanguage(lang)` stays SYNCHRONOUS and unchanged in signature - it does NOT load. Loading is the
  caller's job via `ensureLocaleLoaded`, awaited BEFORE `setLanguage`. `supportedLanguages` derives
  from the generated `SUPPORTED_LANGUAGES` (barrel/loaders export).

src/main.ts (bootstrap + picker wiring):
- startGame (~525, async): insert `await ensureLocaleLoaded(getLanguage())` between the loading-screen
  paint and `mountGameUi()`, i.e. BEFORE the first t() at ~529, so the await sits BEHIND the loading
  screen (no first-paint flash).
- Picker change handler (~3398-3412): insert `await ensureLocaleLoaded(selected)` between the
  validation (~3400) and `setLanguage` (~3401). There is NO `switchLanguage` - only `setLanguage`.
- Wire the homepage-shell language path the same way (await the load before it renders localized text).

src/admin/i18n.ts + src/admin/main.ts (mirror - async SURFACE only, admin does NOT go lazy):
- Add `ensureAdminLocaleLoaded` to src/admin/i18n.ts (same idempotent/coalescing/English-instant shape).
- In src/admin/main.ts, `await ensureAdminLocaleLoaded(<lang>)` BEFORE `localizeStatic()`.
- Admin keeps its static import; this is the async seam for parity, not a flip.

The 3 new player-visible keys (add to `en` FIRST, render via t()):
- `settings.languageLoadFailed` (load errored - shown by the picker on a caught rethrow).
- `settings.languageLoadUnavailable` (locale not available / not in SUPPORTED_LANGUAGES).
- `settings.languageLoading` (transient state while a locale chunk is in flight).
- Add them to the `settings` block of src/ui/i18n.en.ts and render each via t() at the call site
  (picker / status line). Do NOT hard-code the English literal anywhere - the rendered text comes
  from t().

Release-tier fill (recommended WITHIN this phase): because `release/**` runs `I18N_RELEASE_TIER=1`,
the release-tier gate hard-fails on any `pending` row. Fill these 3 keys in the 10 base/standalone
locales via their overlays: es, fr_FR, it_IT, de_DE, zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU
(es_ES / fr_CA inherit via DIALECT_BASE; en_CA stays English). Then regenerate:
`npm run i18n:build && npm run i18n:admin && npm run i18n:scan && npm run i18n:hash -- --write`.
The PR-tier gate (no env var) permits English-only, so the feature-branch PR is green either way;
filling now keeps the release-tier merge green without a maintainer follow-up.

INVARIANTS THIS PHASE MUST KEEP:
- `t()` stays SYNCHRONOUS. `ensureLocaleLoaded` is the ONLY async surface; never add `await` inside t()
  or setLanguage. (Locked decision 1 in state.md.)
- The resolved-table SHA must NOT move: `npm run i18n:hash -- --check` stays green (baseline d74aeb6..,
  re-baselined ONLY by the `--write` after the 3-key fill - and even then the hash gate is about the
  resolved content, so confirm the new SHA reflects exactly the 3 added keys and nothing else).
- The 3 new keys go to `en` FIRST and render via t(); never a literal, never English in a non-en overlay.
- Behavior is byte-for-byte unchanged because everything is still static-imported through the barrel.
- No generated-file hand-edits: edit the source overlays, then regenerate; commit the regenerated dirs.
- Shared worktree: stage EXPLICIT paths, never `git add -A`. No em dashes / emojis.

Out of scope (do NOT do in this phase):
- Do NOT flip imports to lazy / remove the static barrel import (that is Phase 3).
- Do NOT add `<link rel="modulepreload">` (that is Phase 4).
- Do NOT touch CI, .gitignore, .gitattributes, or the determinism helper (that is Phase 5).
- Do NOT advertise a bundle win. The bundle may tick UP slightly (loader code + lazy chunks emitted
  alongside the still-static statics); that is expected this phase.

TEST-ENV GOTCHAS (call these out in code comments at the read site):
- Under vitest (node, no DOM), `typeof window === "undefined"` and a dynamic `import('./es')` resolves
  the SOURCE .ts with NAMED exports, so `mod.default` is `undefined`. Hence the shape-tolerant read
  `mod.default ?? (mod as any)[lang]`.
- `import.meta.env.PROD` is NOT statically replaced under raw vitest. Reuse the existing
  `isReleaseBuild()` try-catch pattern for the dev/prod split, not a bare `import.meta.env.PROD`.

STEP 3 - VALIDATION + REVIEW:
- Run the runtime-i18n validation row: `npx tsc --noEmit` + `npm run i18n:hash -- --check` +
  `npx vitest run tests/i18n_t_behavior.test.ts tests/homepage_foundation.test.ts
  tests/localization_fixes.test.ts tests/i18n_resolved_equivalence.test.ts`, then `npm test`.
- RUN the S3 guard explicitly: `npx vitest run tests/localization_fixes.test.ts` (player text was
  added - this guard is mandatory even though the 3 keys are pure client main-scope t() keys with no
  sim_i18n / server_i18n matcher change).
- Add a NEW test asserting t() is SYNCHRONOUS and correct for a non-en `currentLanguage` BOTH before
  AND after an awaited `ensureLocaleLoaded` (set currentLanguage to a non-en locale, assert t() returns
  the localized string synchronously pre-await, await ensureLocaleLoaded(thatLang), assert it is still
  correct and still synchronous post-await). This proves the await is a no-op this phase.
- Manual: load `?lang=es` and confirm NO flash of English and NO console error (the await sits behind
  the loading screen).
- `npm run build` to confirm it stays green; note the gzip number but do NOT advertise a win.
- Review agents: per the dispatch matrix in state.md, spawn `qa-checklist` at completion. Do NOT spawn
  cross-platform-sync (the 3 new keys are pure client main-scope t() keys, NOT sim/server emits, so no
  sim_i18n/server_i18n matcher change), privacy-security (no CI/secret/server change), or
  migration-safety (no DDL / persisted-state change).
- Prompt qa-checklist for COVERAGE not filtering. Resume it if it truncates with:
  "Stop reading more files. Output the full report now based on what you have already seen.
   No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."
- Do not commit until no BLOCKING issues remain.

STEP 4 - COMMIT CADENCE (Conventional Commits, scope, EXPLICIT paths, no em dashes/emojis):
- feat(i18n): add async ensureLocaleLoaded + resident table to i18n.ts
  (src/ui/i18n.ts: resident/inflight maps, ensureLocaleLoaded, isLocaleResident,
   reportLocaleLoadFailure, tableFor English fallback; plus the new sync before/after-await test)
- feat(i18n): await locale load in startGame + language picker (+ admin ensureAdminLocaleLoaded mirror)
  (src/main.ts bootstrap + picker + homepage shell; src/admin/i18n.ts + src/admin/main.ts)
- feat(i18n): add 3 language-load status keys to en + fill 10 base locales
  (src/ui/i18n.en.ts + the 10 base overlays + the regenerated resolved dirs + i18n.status.json +
   the re-written i18n.resolved.sha256)
- docs(i18n): mark Phase 2 progress + state

STEP 5 - ACCEPTANCE CRITERIA (do not mark complete until all check - this is the Phase 2 list from progress.md):
- [ ] src/ui/i18n.ts: `resident` map (seeded `{ en }` + the current language synchronously), `inflight`
      map, `ensureLocaleLoaded(lang)` (idempotent, coalescing, English-instant, failure-soft,
      shape-tolerant read `mod.default ?? mod[lang]`), `isLocaleResident(lang)`,
      `reportLocaleLoadFailure`; `tableFor()` final line `resident[lang] ?? resident.en!`.
- [ ] `setLanguage` stays synchronous and unchanged in signature (does NOT load); `supportedLanguages`
      derives from `SUPPORTED_LANGUAGES`.
- [ ] src/main.ts: `await ensureLocaleLoaded(getLanguage())` before the first t() in startGame (behind
      the loading screen); `await ensureLocaleLoaded(selected)` in the picker handler before setLanguage.
- [ ] 3 new `en` keys: settings.languageLoadFailed, settings.languageLoadUnavailable,
      settings.languageLoading (rendered via t()).
- [ ] Admin mirror: `ensureAdminLocaleLoaded` before `localizeStatic()` (async surface only; no lazy flip).
- [ ] Maintainer fills the 3 keys in the 10 base locales so the release-tier gate stays green
      (recommended within this phase).
- [ ] `npm test` + a new test: t() is synchronous and correct for a non-en currentLanguage before AND
      after an awaited ensureLocaleLoaded.
- [ ] `?lang=es` shows no flash / no console error; `i18n:hash --check` OK; `tsc --noEmit` green.
- [ ] Bundle may tick up slightly (loaders + lazy chunks emitted alongside still-static statics) - do
      NOT advertise a bundle win yet.

STEP 6 - DOC UPDATES + MEMORY:
- Update docs/i18n-scaling/lazy-locales/progress.md (Phase 2 status + ticks; note the release-tier fill
  outcome - filled or deferred, and the new SHA if you re-wrote it).
- Update docs/i18n-scaling/lazy-locales/state.md if any path/symbol/line-anchor drifted (esp. the
  startGame / picker / localizeStatic anchors, and the SHA if re-baselined by the 3-key fill).
- Record in Claude Code memory any surprising rule (e.g. the vitest named-export import shape, or the
  homepage-shell await path if it differed from the picker).

STEP 7 - FINAL RESPONSE FORMAT:
End with: phase status, files touched, validation results (the SHA check, tsc, the new sync test
result, the S3 guard result, and the build gzip number with the explicit note that the tick-up is
expected), whether the 3-key release-tier fill was done, the qa-checklist verdict, any deferred items,
and a one-line handoff for Phase 2 QA.

STOPPING RULES:
- STOP if t() cannot stay synchronous (e.g. the only way to make a non-en current language render is to
  await inside t()) - that breaks locked decision 1; surface it.
- STOP if the bootstrap await introduces a first-paint flash that cannot be hidden behind the loading
  screen.
- STOP if the resolved-table SHA moves for any reason OTHER than the intended 3-key fill (a move that
  is not exactly those 3 keys is a real bug; do NOT re-baseline to make it green - surface it).
```
