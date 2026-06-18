# Phase 2 QA - Verify the async loader + bootstrap

Audit Phase 2 for a correct loader (idempotent, coalescing, English-instant, failure-soft, shape-tolerant), a synchronous `t()` with a working English fallback, the 3 new keys present in `en` and filled in the 10 base locales, unchanged behavior (everything still static-imported), and a no-flash `?lang=es` load - plus missing tests and dead code. Copy the block below into a fresh Opus 4.8 session.

### QA Starter Prompt
```
This is Phase 2 QA of the i18n Lazy Locales feature: Verify the async loader + bootstrap.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: not needed (single-phase verification). Use direct checks + parallel review agents.

Goal: Audit the Phase 2 async loader for correctness (idempotent / coalescing / English-instant /
failure-soft / shape-tolerant read), a SYNCHRONOUS t() with a working English fallback, the 3 new
keys present in `en` and filled in the 10 base locales, behavior unchanged (everything still
static-imported so the awaits are no-ops), a no-flash `?lang=es` load, an unmoved resolved-table SHA
(except the intended 3-key fill) - plus missing tests and dead code.

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean (Phase 2 should be committed on feature/i18n-lazy-locales). If dirty, ask.
- Memory scan: i18n-resolved-baseline-and-assembly, i18n-phase3-lazy-locales-plan, shared-worktree-commit-care.

STEP 1 - LOAD CONTEXT (i18n.ts is small enough to read whole; do NOT read i18n.en.ts whole - grep it):
Spawn ONE Explore agent to summarize:
- docs/i18n-scaling/lazy-locales/state.md + progress.md (the Phase 2 deliverables + acceptance rows)
- docs/i18n-scaling/lazy-locales/phase-02-async-loader.md (what was promised)
- All files changed in Phase 2 (`git diff --name-only <phase-2-start-commit>..HEAD`) - esp.
  src/ui/i18n.ts (the loader surface), src/main.ts (startGame + picker awaits), src/admin/i18n.ts +
  src/admin/main.ts (the mirror), src/ui/i18n.en.ts (the 3 new `settings` keys - grep, do not read
  whole), the 10 base overlays, and the regenerated resolved dirs + i18n.status.json + i18n.resolved.sha256
- CLAUDE.md (root) + src/ui/CLAUDE.md
Return: the full Phase 2 deliverable list, all changed files, the exact loader/tableFor/setLanguage
code, the two await insertion points, and any known issues or deferrals (esp. whether the release-tier
3-key fill was done).

STEP 2 - QA AUDIT (spawn parallel review agents using the Explore summary; prompt each for COVERAGE
not filtering - "report every issue including low-severity and uncertain ones"):

Correctness agent:
- Loader semantics in src/ui/i18n.ts:
  - IDEMPOTENT: a second `ensureLocaleLoaded(lang)` after success returns instantly (isLocaleResident
    short-circuits); it does not re-import.
  - COALESCING: two concurrent calls for the same lang share ONE in-flight promise (the inflight map is
    keyed by lang and read before starting a new import). Two calls -> one import.
  - ENGLISH-INSTANT: `ensureLocaleLoaded('en')` and any already-resident lang return early with no import.
  - FAILURE-SOFT: on a rejected import it `inflight.delete(lang)` (retry possible), calls
    reportLocaleLoadFailure, and RETHROWS so the caller can show settings.languageLoadFailed. Confirm the
    delete-on-error actually allows a subsequent retry to start a fresh import.
  - SHAPE-TOLERANT: the success read is `mod.default ?? (mod as any)[lang]` (NOT a bare `mod.default`),
    because under vitest the source .ts resolves with named exports and `mod.default` is undefined.
  - reportLocaleLoadFailure gates dev/prod via the existing `isReleaseBuild()` try-catch, NOT a bare
    `import.meta.env.PROD`; it is dev-channel only (console) - no player text leaks into it.
- t() stays SYNCHRONOUS: no `await` was added inside t() or setLanguage; setLanguage keeps its sync
  signature and does NOT load. The English fallback `return resident[lang] ?? resident.en!` is the final
  line of tableFor(), and the dev en_XA branch is unchanged behind its guard.
- `resident` is seeded `{ en }` PLUS the current language synchronously from the static table, so the
  bootstrap await is a guaranteed no-op this phase.
- The 3 keys: present in `en` (src/ui/i18n.en.ts `settings` block), rendered via t() at every call site
  (no hard-coded English literal, no English in a non-en overlay). Filled in the 10 base locales
  (es, fr_FR, it_IT, de_DE, zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU); es_ES/fr_CA inherit via
  DIALECT_BASE; en_CA stays English. If the fill was deferred, FLAG it (release-tier gate will be red).
- Behavior unchanged: confirm everything in i18n.ts still STATIC-imports through the Phase 1 barrel (the
  static barrel import is NOT removed - that is Phase 3). The awaits are no-ops because the current
  language is already resident.
- SHA: `npm run i18n:hash -- --check`. If the 3-key fill was done, the SHA moved by EXACTLY those 3 keys
  (verify the new sha256 reflects only the added keys, nothing else). If the fill was deferred, the SHA
  must be exactly the Phase 1 baseline d74aeb6.. - any other move is a real bug.
- Manual: load `?lang=es` - NO flash of English, NO console error (the await sits behind the loading
  screen). Confirm the picker path awaits before setLanguage.
- `npm run build` green; note the gzip (a slight tick-up is expected and must NOT be sold as a win).

Test coverage agent:
- Verify the NEW before/after-await sync test exists and is MEANINGFUL: it sets currentLanguage to a
  non-en locale, asserts t() returns the localized string synchronously BEFORE the await, awaits
  ensureLocaleLoaded(thatLang), and asserts it is still correct AND still synchronous AFTER. A test that
  only checks the post-await case does not prove the no-op property - flag it.
- Verify the existing runtime row still passes against the loader: `npx vitest run
  tests/i18n_t_behavior.test.ts tests/homepage_foundation.test.ts tests/localization_fixes.test.ts
  tests/i18n_resolved_equivalence.test.ts`.
- Loader-rejection path: is the failure-soft branch (import rejects -> English fallback, no crash,
  retry possible) covered by a test? If not feasible while everything is still static (the thunk cannot
  fail this phase), that is acceptable - FLAG it as a Phase 3 follow-up (the lazy flip makes a real 404
  simulable), do not force a brittle mock now.
- Release-tier: if the 3 keys were filled, `I18N_RELEASE_TIER=1 npx vitest run tests/i18n_status_registry.test.ts`
  (or the registry test) shows pending === 0 for those keys. If deferred, confirm the deferral is recorded.
- Remove or update any test that asserted setLanguage loads, or that hard-coded the pre-Phase-2 i18n.ts surface.

Dead code & cleanup agent:
- No leftover/duplicate loader helpers; no commented-out old code; no unused imports in i18n.ts /
  main.ts / the admin mirror.
- The static barrel import invariant is INTACT (Phase 2 must NOT have started the lazy flip early - the
  statics are still imported; resident is seeded from them).
- No DOM/Three/sim import crept into i18n.ts; no `t()` or DOM crept into sim/server (n/a here, but
  confirm the 3 keys are pure client main-scope, not a sim/server emit needing a matcher entry).
- The admin mirror added only the async surface (ensureAdminLocaleLoaded + the await before
  localizeStatic) - it did NOT flip admin to lazy.

Multi-agent review dispatch (check `git diff --name-only` vs the phase-start commit):
- qa-checklist: yes (phase-completion gate).
- privacy-security-review: do NOT spawn (no CI/secret/server/net change this phase).
- migration-safety: do NOT spawn (no DDL / persisted-state change).
- cross-platform-sync: do NOT spawn - the 3 new keys are pure client main-scope t() keys, NOT sim/server
  emits, so there is no sim_i18n/server_i18n matcher change and no IWorld/wire surface touched.
Resume any agent that truncates with: "Stop reading more files. Output the full report now.
No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."

STEP 3 - FIX: Apply all BLOCKING + SHOULD-FIX items. Re-run the runtime validation row (tsc, the
runtime vitest files, the S3 guard tests/localization_fixes.test.ts, npm test, i18n:hash --check) and
re-confirm `?lang=es` shows no flash. Commit fixes in commits SEPARATE from the QA verdict (EXPLICIT paths).

STEP 4 - UPDATE DOCS + MEMORY:
- progress.md: mark Phase 2 QA complete; note any item deferred to a follow-up (esp. the loader-rejection
  test deferred to Phase 3, or a deferred release-tier fill).
- state.md: record any drift discovered (path/symbol/line-anchor, or the new SHA if the fill re-baselined it).
- Memory: record anything surprising (e.g. the vitest named-export import shape biting a test, or the
  homepage-shell await path).

STEP 5 - PACKET TEARDOWN: skip (not the final phase).

STEP 6 - FINAL RESPONSE FORMAT:
End with: QA verdict (PASS / PASS-WITH-FOLLOWUPS / FAIL), counts of BLOCKING/SHOULD-FIX/NICE-TO-HAVE
found and fixed, the SHA-check result (and whether the 3-key fill moved it as intended), the
synchronous-t() before/after-await test result, deferred items, and a one-line handoff for Phase 3
(the lazy flip).

STOPPING RULES:
- STOP and surface to the user if t() is NOT synchronous (an await leaked into t() or setLanguage) -
  that breaks locked decision 1.
- STOP if the resolved-table SHA moved for any reason OTHER than the intended 3-key fill (a move that is
  not exactly those 3 keys means Phase 2 changed the resolved content; do NOT re-baseline to make it green).
- STOP if `?lang=es` shows a first-paint flash of English that the loading screen does not hide.
```
