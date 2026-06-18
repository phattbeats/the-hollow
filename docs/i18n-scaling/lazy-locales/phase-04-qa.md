# Phase 4 QA - Verify modulepreload + first-paint perf

Audit Phase 4 for a clean stored-locale request (high-priority, parser-discoverable, no double-fetch, no main-then-locale waterfall), correct hashed-filename resolution from the Vite manifest, en_XA still tree-shaken from prod, a safe inline boot script (reads only localStorage.locale, injects only a same-origin preload), the testable build-hook logic, the throttled TTI / no-layout-shift checks, and no leftover speculative-preload code. Copy the block below into a fresh Opus 4.8 session.

### QA Starter Prompt
```
This is Phase 4 QA of the i18n Lazy Locales feature: Verify modulepreload + first-paint perf.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: not needed (single-phase verification). Use direct checks + parallel review agents.

Goal: Audit the Phase 4 modulepreload work for correctness - no waterfall and no double-fetch in
a stored-locale trace, the hashed locale-chunk filename resolved correctly from
dist/.vite/manifest.json, en_XA still tree-shaken from prod, the inline boot script reads ONLY
localStorage.locale and injects ONLY a same-origin preload, BOTH the <link> and the runtime
prefetch shipped, and no speculative preload of other locales - plus missing tests and dead code.

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean (Phase 4 should be committed on feature/i18n-lazy-locales). If dirty, ask.
- Memory scan: i18n-resolved-baseline-and-assembly, i18n-phase3-lazy-locales-plan, shared-worktree-commit-care.

STEP 1 - LOAD CONTEXT:
- docs/i18n-scaling/lazy-locales/state.md + progress.md (Phase 4 deliverables + acceptance; locked
  decision 8 - ship BOTH; the index.html/modulepreload validation row; the manifest-resolution +
  R11 stale-chunk gotchas)
- docs/i18n-scaling/lazy-locales/phase-04-modulepreload.md (what was promised)
- All files changed in Phase 4 (`git diff --name-only <phase-4-start-commit>..HEAD`) - esp.
  index.html (the inline boot script + the templated lookup), the post-build hook (a scripts/*.mjs
  step or a Vite plugin), vite.config.ts (manifest enable), and src/ui/i18n.ts (the prefetch helper)
- CLAUDE.md (root)
Return: the full Phase 4 deliverable list, all changed files, and any known issues / deferrals.

STEP 2 - QA AUDIT (spawn parallel review agents using the load summary; prompt each for COVERAGE
not filtering - "report every issue including low-severity and uncertain ones"):

Correctness agent:
- Run a network trace (scripts/*.mjs browser E2E) for a STORED non-en locale (localStorage.locale
  = "es", reload): is the locale chunk a HIGH-PRIORITY, parser-discoverable request? Is there NO
  double-fetch (crossorigin matches the module request)? Is there NO main-then-locale waterfall (the
  chunk is requested in parallel with / before main, not discovered only after main parses)?
- Confirm a default-English visitor (no stored locale) still fetches ZERO non-en chunks - the inline
  script must inject nothing when there is no stored non-en locale.
- Verify the post-build hook resolves the CORRECT hashed locale-chunk filename from
  dist/.vite/manifest.json (spot-check a couple of locales against the actual dist/assets filenames).
- Confirm the inline boot <script> reads ONLY localStorage.locale and injects ONLY a same-origin
  modulepreload - no third-party origin, no other side effects, no extra network.
- `npm run build` green; `npm run i18n:hash -- --check` (SHA unchanged after enabling the manifest -
  the manifest must not have perturbed the bundle's hashed content).
- Confirm en_XA is still tree-shaken from prod (grep dist/assets chunks for en_XA / pseudo content -
  it must not appear).

Test coverage agent:
- Does any TESTABLE build-hook logic (the manifest -> hashed-URL resolution, the index.html
  templating) have a unit test? If it is only covered transitively, add a focused test (given a
  sample manifest, the hook resolves the expected hashed URL per locale; an unknown/missing locale
  is handled safely).
- Confirm the TTI probe and the no-layout-shift screenshot check are run via scripts/*.mjs (Slow-4G
  + 4x CPU, median of N vs the no-preload baseline) and that the result was recorded.

Dead code & cleanup agent:
- Confirm there is NO leftover speculative-preload code (no loop injecting links for all locales, no
  prefetch of locales other than the stored one).
- No orphaned manifest-reading code; no commented-out experiments; the prefetch helper is wired and
  used, not dead.
- Confirm t() was not touched (it stays synchronous) and the Phase 3 loader logic is unchanged beyond
  the added prefetch entry point.

Multi-agent review dispatch (check `git diff --name-only` vs the phase-start commit):
- qa-checklist: YES (phase-completion gate).
- privacy-security-review: OPTIONAL - a LIGHT pass for the inline <script> / CSP angle (does it read
  ONLY localStorage.locale, inject ONLY a same-origin preload, introduce no `script-src` regression).
  The strict matrix does not require it for Phase 4, but the inline script is worth a quick look.
- migration-safety: do NOT spawn (no DDL / persisted-state change).
- cross-platform-sync: do NOT spawn (no sim/server/wire/matcher change; client + build only).
Resume any agent that truncates with: "Stop reading more files. Output the full report now.
No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."

STEP 3 - FIX: Apply all BLOCKING + SHOULD-FIX items. Re-run the validation matrix (the stored-locale
trace, the default-English zero-non-en trace, the manifest resolution, the SHA check, the build, the
TTI probe). Commit fixes in commits SEPARATE from the QA verdict (EXPLICIT paths, no em dashes/emojis).

STEP 4 - UPDATE DOCS + MEMORY:
- progress.md: mark Phase 4 QA complete; confirm the TTI delta vs the no-preload baseline; note any
  item deferred to a follow-up.
- state.md: record any drift discovered.
- Memory: record anything surprising (e.g. a crossorigin double-fetch gotcha, a manifest path quirk,
  a CSP note for the inline script).

STEP 5 - PACKET TEARDOWN: skip (not the final phase).

STEP 6 - FINAL RESPONSE FORMAT:
End with: QA verdict (PASS / PASS-WITH-FOLLOWUPS / FAIL), the stored-locale trace result (high-priority,
no double-fetch, no waterfall), the TTI delta, counts of BLOCKING/SHOULD-FIX/NICE-TO-HAVE found and
fixed, the optional privacy-security note if run, deferred items, and a one-line handoff for Phase 5
(artifact / CI / determinism hygiene).

STOPPING RULES:
- STOP and surface if the stored-locale trace shows a double-fetch (the crossorigin match is the fix;
  shipping a wasteful second download is not acceptable).
- STOP and surface if the trace still shows a main-then-locale waterfall (the preload link is not
  doing its job - the whole point of the phase failed).
- STOP and surface if the build hook resolves the wrong hashed filename (a preload for a stale/wrong
  chunk is worse than none - it warms the wrong cache entry).
- STOP and surface if enabling the Vite manifest moved the resolved-table SHA, or if en_XA leaked into
  a prod chunk.
```
