# Phase 3 QA - Verify the lazy flip

Audit Phase 3 for the payload win (the HARD tree-shake probe), zero non-en bytes on a default load, the 13 + dialect chunks with `en` un-chunked, an unmoved resolved-table SHA, the canary re-points, the new loader-rejection / English-fallback tests, and no flash / no layout shift. Phase 3 is HIGH RISK, so the probe and the network trace are real gates, not formalities. Copy the block below into a fresh Opus 4.8 session.

### QA Starter Prompt
```
This is Phase 3 QA of the i18n Lazy Locales feature: Verify the lazy flip.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: OPTIONAL here. Because Phase 3 is the high-risk payload commit, you MAY run an
adversarial-verify Workflow (each finding independently confirmed by a second pass) rather
than direct checks. If you stay direct, use parallel review agents. Either is acceptable.

Goal: Audit the Phase 3 lazy flip for correctness - the byte win is real (a default-English
visitor downloads ZERO non-en locale bytes), the 13 + dialect chunks exist with `en` NOT
chunked, the resolved-table SHA did NOT move, t() is still synchronous, the two canary tests
were correctly re-pointed (not silently weakened), the new loader-rejection -> English-fallback
test exists, and there is no flash / no layout shift on first paint or in-session swap - plus
missing tests and dead code (the now-removed eager static imports under 3a, or the cleanly
repointed const-importers under 3b).

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean (Phase 3 should be committed on feature/i18n-lazy-locales). If dirty, ask.
- Memory scan: i18n-resolved-baseline-and-assembly, i18n-phase3-lazy-locales-plan, shared-worktree-commit-care.

STEP 1 - LOAD CONTEXT:
- docs/i18n-scaling/lazy-locales/state.md + progress.md (Phase 3 deliverables + acceptance; the
  lazy-flip-probe validation row; locked decisions 1, 2, 7, 10)
- docs/i18n-scaling/lazy-locales/phase-03-lazy-flip.md (what was promised, incl. the 3a-vs-3b gate)
- All files changed in Phase 3 (`git diff --name-only <phase-3-start-commit>..HEAD`) - esp.
  src/ui/i18n.ts (the flipped import + re-export surface), tests/homepage_foundation.test.ts,
  tests/i18n_t_behavior.test.ts, any new test file, and (3b only) the const-importers +
  scripts/i18n_resolved_hash.mjs
- CLAUDE.md (root) + src/ui/CLAUDE.md
Return: the full Phase 3 deliverable list, all changed files, whether the team recorded 3a-held
or fell to 3b, and any known issues / deferrals.

STEP 2 - QA AUDIT (spawn parallel review agents using the load summary; prompt each for COVERAGE
not filtering - "report every issue including low-severity and uncertain ones"):

Correctness agent:
- Re-run `npm run build`, then the HARD tree-shake probe `gzip -c dist/assets/main-*.js | wc -c`:
  is main-*.js gzip ~590 KB (<= ~0.62 MB)? A main still near 1.13 MB is a FAIL - the flip did not
  tree-shake and the phase did not deliver its point.
- `ls dist/assets/*-*.js`: are there 13 + dialect content-hashed locale chunks (~42 KB gzip each)?
  Is `en` NOT a separate chunk (English ships in main, eager)?
- Run a default-English load network trace (a throttled-mobile scripts/*.mjs browser E2E): confirm
  ZERO `es-*.js`..`ru_RU-*.js` requests and that no non-en locale data is baked into main-*.js.
- `npm run i18n:hash -- --check`: did the SHA stay put (did NOT move)? Under 3b the value must be
  identical (same translations hashed). A moved SHA is a real bug, not a re-baseline.
- Confirm t() is STILL SYNCHRONOUS (no `await` introduced in t()/setLanguage); the only async
  surface is ensureLocaleLoaded at the bootstrap + picker.
- Confirm 3a held (i18n.ts re-exports the dense consts, const-importers untouched) OR 3b was
  correctly applied as its OWN commit (const-importers + hash harness repointed at the generated
  index, no leftover dense re-export). Verify the recorded probe outcome matches the diff.
- Confirm no flash / no layout shift on a stored ?lang=es load AND on one CJK locale (e.g. zh_CN),
  on first paint and on in-session swap (the no-layout-shift E2E + a mobile screenshot).
- Confirm a loader rejection (simulated 404) falls back to English with NO crash.

Test coverage agent:
- Are the two canary tests correctly re-pointed AND still meaningful? homepage_foundation must
  `await ensureLocaleLoaded(lang.code)` before each synchronous t() assertion (not just deleted
  or made to pass trivially). i18n_t_behavior's pending mock must feed the synthetic key through
  the NEW seam (LOCALE_LOADERS.es / per-locale es module / a resident.es pre-seed) so it exercises
  the REAL pending branch - not onUntrackedKey by accident. If either silently asserts the wrong
  thing now, that is a BLOCKING coverage gap.
- Do the new tests exist and bite: loader-rejection -> English fallback (no crash), non-en current
  language renders translated SYNCHRONOUSLY after an awaited load, and the pending/release hard-fail
  still throws?
- Is the release-tier empty-pending assertion (realPending from the generated path) intact and unmoved?

Dead code & cleanup agent:
- Under 3a: confirm the eager static imports of the 13 non-en locales (for runtime use) are gone and
  no orphaned imports remain; the re-export line is intentional (tree-shaken) not accidental.
- Under 3b: confirm every `../src/ui/i18n` const-importer was cleanly repointed to the generated
  index, with no half-migrated importer still pulling consts from i18n.ts, and the hash harness
  reads the generated path.
- No commented-out old import code; no unused helpers left behind by the flip.

Multi-agent review dispatch (check `git diff --name-only` vs the phase-start commit):
- qa-checklist: YES (phase-completion gate).
- privacy-security-review: do NOT spawn (no CI/secret/server/net change this phase).
- migration-safety: do NOT spawn (no DDL / persisted-state change).
- cross-platform-sync: do NOT spawn (no sim/server/wire/matcher change; the i18n flip is client-only).
Resume any agent that truncates with: "Stop reading more files. Output the full report now.
No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."

STEP 3 - FIX: Apply all BLOCKING + SHOULD-FIX items. Re-run the validation matrix (the tree-shake
probe + the default-load trace, the SHA check, tsc, npm test, the no-layout-shift E2E). Commit fixes
in commits SEPARATE from the QA verdict (EXPLICIT paths, no em dashes/emojis).

STEP 4 - UPDATE DOCS + MEMORY:
- progress.md: mark Phase 3 QA complete; confirm the recorded 3a-vs-3b probe outcome + the main-chunk
  gzip number; note any item deferred to a follow-up.
- state.md: record any drift discovered (e.g. the real post-flip gzip vs the ~590 KB target).
- Memory: record anything surprising about the tree-shake behavior or the vitest dynamic-import shape.

STEP 5 - PACKET TEARDOWN: skip (not the final phase).

STEP 6 - FINAL RESPONSE FORMAT:
End with: QA verdict (PASS / PASS-WITH-FOLLOWUPS / FAIL), the tree-shake probe number + 3a-or-3b,
counts of BLOCKING/SHOULD-FIX/NICE-TO-HAVE found and fixed, deferred items, and a one-line handoff
for Phase 4 (modulepreload + first-paint perf).

STOPPING RULES:
- STOP and surface to the user if the tree-shake probe shows main-*.js still near 1.13 MB (the flip
  did not deliver the byte win - the central deliverable failed).
- STOP and surface if a default-English load still requests any non-en locale chunk (the
  zero-non-en-bytes guarantee is broken).
- STOP and surface if the resolved-table SHA moved and cannot be restored without changing emitted
  content (that means the flip changed the table, not just where the locales load from).
- STOP if t() is no longer synchronous, or a first-paint flash appears that the loading-screen gate
  does not hide.
```
