# Phase 5 QA - Verify the artifact / CI / determinism hygiene

Audit Phase 5 for the fresh-clone green path (status.json absent pre-build), the determinism gate that replaced the committed-bytes freshness check, the i18n:gen CI step in BOTH jobs, the `linguist-generated` marks, the committed summary cross-check, an unmoved SHA, and intact release-tier gate teeth - plus a security pass on the CI change and missing tests / dead code (the old committed-bytes checks). Copy the block below into a fresh Opus 4.8 session.

### QA Starter Prompt
```
This is Phase 5 QA of the i18n Lazy Locales feature: Verify the artifact / CI / determinism hygiene.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: not needed (single-phase verification). Use direct checks + parallel review agents.

Goal: Audit the Phase 5 hygiene change for correctness (fresh-clone green with status.json absent
pre-build; the i18n:gen step in both CI jobs in the right position; .gitattributes marks the generated
dirs; the summary.json is cross-checked; SHA unchanged; git status clean post-build), determinism (the
new assertDeterministic check actually BITES a forced non-determinism), intact release-tier gate teeth,
plus missing tests and dead code (any leftover committed-bytes check for the now-gitignored status.json).

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean (Phase 5 should be committed on feature/i18n-lazy-locales). If dirty, ask.
- Memory scan: i18n-resolved-baseline-and-assembly, i18n-phase3-lazy-locales-plan, shared-worktree-commit-care.

STEP 1 - LOAD CONTEXT (do NOT read i18n.status.json or the generated dirs directly):
Spawn ONE Explore agent to summarize:
- docs/i18n-scaling/lazy-locales/state.md + progress.md (Phase 5 deliverables + acceptance; the three
  reproducibility properties; which one status.json swapped)
- docs/i18n-scaling/lazy-locales/phase-05-artifact-ci-hygiene.md (what was promised)
- All files changed in Phase 5 (`git diff --name-only <phase-5-start-commit>..HEAD`) - esp.
  .gitignore, .gitattributes, .github/workflows/ci.yml, package.json, scripts/i18n_scan.mjs,
  tests/helpers/i18n_determinism.ts, tests/i18n_status_registry.test.ts, tests/i18n_resolved_equivalence.test.ts,
  and the committed src/ui/i18n.status.summary.json
- CLAUDE.md (root)
Return: the full Phase 5 deliverable list, all changed files, the exact CI step order of both jobs, and
any known issues.

STEP 2 - QA AUDIT (spawn parallel review agents using the Explore summary; prompt each for COVERAGE not
filtering - "report every issue including low-severity and uncertain ones"):

Correctness agent:
- Fresh-clone proof: in a clean checkout (or a clean temp worktree) confirm src/ui/i18n.status.json is
  ABSENT before any build (it is gitignored + `git rm --cached`'d), then `npm ci && npm test` is green -
  proving `pretest` regenerates it.
- `I18N_RELEASE_TIER=1 npm test` - green on the translated tree, and confirm the gate STILL BITES: inject
  a synthetic `pending` row and verify the release-tier assertion throws; restore the tree after.
- The `Generate i18n artifacts` (`npm run i18n:gen`) step is present in BOTH jobs (`pr-gate` and
  `release-gate`), AFTER `npm ci`, BEFORE the typecheck/build steps, in the right position. The two-tier
  structure (job split by git ref, I18N_RELEASE_TIER=1 on release) is untouched; i18n:gen does not branch
  on the tier flag.
- .gitattributes marks src/ui/i18n.resolved.generated/** and src/admin/i18n.resolved.generated/**
  `linguist-generated`.
- src/ui/i18n.status.summary.json is committed and cross-checked by tests/i18n_status_registry.test.ts
  (counts match the full registry, per-locale rollup tallies, universeHash matches).
- `npm run i18n:hash -- --check` - SHA still d74aeb6.. (did NOT move).
- `git status` is clean after a build, with NO megabyte file tracked (status.json out of the index).

Test coverage agent:
- Force a non-determinism in a generator (e.g. inject a timestamp or a locale-ordering perturbation into
  the scanner's output temporarily) and confirm `assertDeterministic` actually BITES (the test goes RED).
  Revert the injection. A determinism gate that cannot fail is theater.
- Confirm the repointed equivalence/registry suites still validate FRESHNESS for the COMMITTED dirs
  (the `git diff --exit-code` against i18n.resolved.generated/ still runs and would catch a stale commit),
  in addition to the new determinism check.
- Confirm the release-tier `pending===0` assertion and the synthetic-pending gate-teeth check survived the
  reproducibility-suite swap (they must NOT have been removed alongside the committed-bytes check).
- Confirm assertDeterministic perturbs TZ / LC_ALL / temp-path and generates into separate temp dirs via
  I18N_OUT_DIR (not a no-op that compares a dir to itself).

Dead code & cleanup agent:
- Confirm NO leftover committed-bytes reproducibility check remains for the now-gitignored
  src/ui/i18n.status.json (no orphaned `git ls-files --error-unmatch` / `git diff --exit-code` on that
  path - it would now fail or be meaningless).
- No orphaned helpers; no unused imports in the touched test files; no commented-out old reproducibility code.
- Confirm i18n:gen is not duplicated logic that drifts from `pretest` / `build` (all three call the same
  three generators; that is intentional, but flag any divergence).

Multi-agent review dispatch (check `git diff --name-only` vs the phase-start commit):
- privacy-security-review: YES - the diff edits .github/workflows/ci.yml (a CI file in the matrix).
  Verify no secret leak, no ALLOW_DEV_COMMANDS, the i18n:gen step is safe (no network, no untrusted input,
  no elevation), and the `permissions: contents: read` posture is preserved.
- qa-checklist: yes (phase-completion gate).
- migration-safety: do NOT spawn (no DDL / persisted-state change).
- cross-platform-sync: do NOT spawn (no sim/IWorld/wire/matcher change).
Resume any agent that truncates with: "Stop reading more files. Output the full report now.
No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."

STEP 3 - FIX: Apply all BLOCKING + SHOULD-FIX items. Re-run the validation matrix (the fresh-clone green
with status.json absent, the determinism double-generation, the SHA check, the release-tier gate-teeth
check, tsc, npm test, the build). Commit fixes in commits SEPARATE from the QA verdict (EXPLICIT paths).

STEP 4 - UPDATE DOCS + MEMORY:
- progress.md: mark Phase 5 QA complete; note any item deferred to a follow-up.
- state.md: record any drift discovered (esp. around the summary.json or the swapped reproducibility property).
- Memory: record anything surprising (e.g. a CI cache interaction with the gitignored regenerated file).

STEP 5 - PACKET TEARDOWN: skip (not the final phase).

STEP 6 - FINAL RESPONSE FORMAT:
End with: QA verdict (PASS / PASS-WITH-FOLLOWUPS / FAIL), counts of BLOCKING/SHOULD-FIX/NICE-TO-HAVE found
and fixed, the privacy-security verdict on the CI change, deferred items, and a one-line handoff for
Phase 6 (the i18n.en.ts directory split).

STOPPING RULES:
- STOP and surface if the fresh clone cannot go green with status.json absent (something other than
  `pretest` is reading committed status.json bytes).
- STOP if the release-tier gate no longer bites a synthetic pending row (the teeth regressed).
- STOP if assertDeterministic cannot be made to fail on a forced non-determinism (the gate is inert).
- STOP if the resolved-table SHA moved (this phase changed emitted content, which it must not).
```
