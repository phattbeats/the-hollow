# Phase 5 - Artifact / CI / determinism hygiene (Doc Step 4 CI/git)

Final storage + CI hygiene. Gitignore the 4.46 MB build-only registry, install the determinism gate that replaces its committed-bytes freshness check, mark the generated directories as `linguist-generated`, and add one i18n generation step to both CI jobs. Pure hygiene: zero runtime change, zero bundle change, resolved table byte-identical, SHA unchanged. This is sequenced AFTER Phase 3 (the lazy flip) has soaked clean on a preview deploy for a release cycle. Do NOT bundle it with the Phase 3 runtime flip.

Copy the block below into a fresh Opus 4.8 session.

### Starter Prompt
```
This is Phase 5 of the i18n Lazy Locales feature: Artifact / CI / determinism hygiene.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: NOT needed. This is gitignore + .gitattributes + two CI step inserts + one test
helper + repointing two reproducibility sub-suites. Direct edits + a small fan-out at most. Do
NOT spin up a Workflow.

Goal: gitignore the build-only src/ui/i18n.status.json (4.46 MB, never shipped); install the
`assertDeterministic` double-generation gate and swap it in for the status.json committed-bytes
freshness check; mark the generated resolved directories `linguist-generated`; add an i18n:gen
aggregate script and a `Generate i18n artifacts` step to BOTH CI jobs; and ship a small committed
summary registry so the audit trail survives gitignoring the full one. No runtime change.

PRECONDITION: Phase 3 (the lazy flip) has soaked clean on a preview deploy for a release cycle.
This phase must NOT be bundled with the Phase 3 runtime flip - the phases are sequenced so a revert
of the risky middle never strands the CI gate. If Phase 3 has not soaked, STOP and ask.

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean. If not, ask the user (a concurrent session may share this checkout).
- Ensure you are on branch `feature/i18n-lazy-locales` with Phases 1-4 landed. If switching branches
  would disrupt a concurrent session, ask first.
- Memory scan: check your MEMORY.md index + the entries `i18n-resolved-baseline-and-assembly`,
  `i18n-phase3-lazy-locales-plan`, and `shared-worktree-commit-care`.

STEP 1 - LOAD CONTEXT (do NOT read i18n.status.json or i18n.resolved.generated/ directly - they are huge):
Spawn ONE Explore agent to read and summarize:
- docs/i18n-scaling/lazy-locales/state.md (locked decisions, scope boundary, validation matrix, the
  three reproducibility properties, file paths)
- docs/i18n-scaling/lazy-locales/progress.md (Phase 5 deliverables + acceptance checklist)
- docs/i18n-scaling/lazy-locales/phase-05-artifact-ci-hygiene.md (this prompt)
- .github/workflows/ci.yml (the EXACT step list of both jobs: `pr-gate` ~lines 35-66 and
  `release-gate` ~68-103; find where `npm ci` ends and the typecheck/build steps begin in each)
- package.json (the scripts block, esp. `pretest` line 12, `build` line 10, the `i18n:*` scripts 14-18)
- .gitignore (current i18n entries ~lines 15-16) and confirm whether .gitattributes exists / is EMPTY
- scripts/i18n_scan.mjs (how it writes src/ui/i18n.status.json; whether it can also emit a summary;
  whether I18N_OUT_DIR is already honored from Phase 1)
- tests/i18n_status_registry.test.ts (which sub-suite asserts reproducibility via a committed-bytes
  `git diff`, and which sub-suites VALIDATE the registry - the release-tier `pending===0` assertion
  and the gate-teeth synthetic-pending check MUST be kept)
- tests/i18n_resolved_equivalence.test.ts (the directory-path tracking / `git diff` freshness check -
  it should already point at the new i18n.resolved.generated/ dirs from Phase 1)
- CLAUDE.md (root)
The agent should return: the exact current CI step list of BOTH jobs and the precise insertion point
for the i18n:gen step (after `npm ci`, before typecheck/build); the current `pretest`/`build` chains;
and exactly what the two reproducibility sub-suites assert today.

STEP 2 - EXECUTE (direct edits; an Agent for the test-helper work if you want parallelism):

(a) Gitignore the build-only registry:
- `git rm --cached src/ui/i18n.status.json` (it is 4.46 MB, build/test-only, never shipped; its
  176k-line diff has zero review value - `pretest` and the CI i18n:gen step regenerate it before any
  test reads it).
- Add `src/ui/i18n.status.json` to .gitignore (next to the existing i18n entries).
- FIRST find the test that reads its committed bytes and fix that read before the rm lands a red
  tree - it is the status_registry reproducibility sub-suite (Step 2d). The validation sub-suites
  read the file CONTENT at runtime (after pretest regenerates it), which is fine; only the
  committed-bytes `git diff` / `git ls-files` reproducibility assertions break on a gitignored file.

(b) .gitattributes (currently EMPTY - create or extend it):
- Mark `src/ui/i18n.resolved.generated/**` and `src/admin/i18n.resolved.generated/**` as
  `linguist-generated` so GitHub collapses them in PR diffs. (These dirs STAY committed - this is
  display hygiene, not removal.)

(c) package.json:
- Add `"i18n:gen": "npm run i18n:build && npm run i18n:admin && npm run i18n:scan"` to the scripts
  block. Do NOT change `pretest` or `build` - they already run the same three generators inline.

(d) tests/helpers/i18n_determinism.ts (NEW):
- `export function assertDeterministic({ script, outFiles, env? })` that generates TWICE into two
  separate temp dirs via the `I18N_OUT_DIR` override (added in Phase 1) and asserts the named
  outFiles are byte-identical across the two runs.
- Harden it against same-machine blind spots: pin the Node version + lockfile context (the generators
  bundle TS with esbuild from this tree), and PERTURB `TZ`, `LC_ALL`, and the temp-dir path between the
  two generations so a hidden locale/timezone/path dependency in the emit would surface as a diff.
- A real determinism bug must make it THROW. Keep it dependency-free (node:fs / node:os / node:child_process).

(e) tests/i18n_status_registry.test.ts:
- REPLACE the "reproducibility" sub-suite (the committed-bytes `git ls-files` + `git diff --exit-code`
  on src/ui/i18n.status.json) with the `assertDeterministic` double-generation check on the scanner
  (status.json is now gitignored, so there are no committed bytes to diff - it swaps freshness for
  determinism).
- KEEP every validation sub-suite unchanged: universe coverage, enHash re-derivation, counts
  consistency, blocked-row load-bearing, hash sensitivity, AND the release-tier `it.runIf(RELEASE_TIER)`
  pending===0 assertion. Also KEEP / add the gate-teeth check: a synthetic pending row must throw under
  I18N_RELEASE_TIER=1. These read the file at runtime (after pretest regenerates it), which still works.

(f) tests/i18n_resolved_equivalence.test.ts:
- Repoint any directory-path tracking / `git diff` freshness check to the committed
  i18n.resolved.generated/ directories (this should already be the Phase 1 shape). These dirs are
  STILL committed, so they KEEP the `git diff` freshness check AND gain an `assertDeterministic` check.
- Only the gitignored status.json swaps freshness for determinism; the committed resolved dirs keep both.

(g) src/ui/i18n.status.summary.json (NEW, committed, a few KB):
- Have scripts/i18n_scan.mjs ALSO emit a small summary alongside the full status.json: counts
  (keys, rows, translated, pending, blocked, blockedSource), a per-locale rollup, and the universeHash.
  NO per-key bodies. This is committed and restores the audit trail lost by gitignoring the full file.
- tests/i18n_status_registry.test.ts cross-checks the summary against the full registry (counts match,
  per-locale rollup tallies, universeHash matches). Keep the summary a PURE function of source (no
  timestamps) so it regenerates byte-identically and can carry its own determinism / freshness check.

(h) Optional: lower `chunkSizeWarningLimit` in vite.config.ts now that the main chunk dropped (Phase 3).

INVARIANTS THIS PHASE MUST KEEP:
- Determinism: `assertDeterministic` must produce byte-identical output across the two perturbed-env
  generations. A diff is a real bug.
- The resolved-table SHA must NOT move: `npm run i18n:hash -- --check` stays green (baseline d74aeb6..).
  This phase touches no emitted resolved content - a moved SHA here is a real bug, never a re-baseline.
- The release-tier gate must still BITE: a synthetic `pending` row throws under I18N_RELEASE_TIER=1.
- The two-tier CI structure (job split by git ref, I18N_RELEASE_TIER=1 on the release job) is UNTOUCHED.
  The generators do NOT branch on the tier flag - i18n:gen is identical in both jobs.
- No generated-file hand-edits: regenerate via the build; commit the regenerated summary + dirs.
- Shared worktree: EXPLICIT paths, never `git add -A`. No em dashes / emojis.

Out of scope (do NOT do in this phase):
- No runtime loader change (Phase 2/3).
- No modulepreload / index.html change (Phase 4).
- No i18n.en.ts split (Phase 6).
- Do NOT touch the resolve/merge/dialect/pending/pseudo logic or the emitted resolved content.
- Do NOT change the two-tier gate structure or make any generator branch on I18N_RELEASE_TIER.

STEP 3 - VALIDATION + REVIEW:
- Fresh-clone proof (the load-bearing acceptance): from a clean tree with src/ui/i18n.status.json
  ABSENT (it is now gitignored), run `npm ci && npm test` - green proves `pretest` regenerates it.
- `I18N_RELEASE_TIER=1 npm test` - green on the translated tree, and RED on a synthetic pending row
  (confirm the gate teeth still bite; restore the tree after).
- `npm run i18n:hash -- --check` - SHA unchanged (d74aeb6..).
- `git status` is clean after a build with NO megabyte file tracked (status.json gone from the index).
- Confirm the `Generate i18n artifacts` step is present in BOTH CI jobs, AFTER `npm ci`, BEFORE the
  typecheck/build steps, in both `pr-gate` and `release-gate`.
- Review agents: this diff edits .github/workflows/ci.yml (a CI file in the dispatch matrix), so
  per the matrix in state.md spawn `privacy-security-review` (verify no secret leak, no
  ALLOW_DEV_COMMANDS, the i18n:gen step is benign) AND `qa-checklist` at completion. Do NOT spawn
  migration-safety or cross-platform-sync (no DDL, no sim/server/wire/matcher change).
- Prompt each agent for COVERAGE not filtering. Resume any that truncates with:
  "Stop reading more files. Output the full report now based on what you have already seen.
   No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."
- Do not commit until no BLOCKING issues remain.

STEP 4 - COMMIT CADENCE (Conventional Commits, scope, EXPLICIT paths, no em dashes/emojis):
- chore(i18n): gitignore i18n.status.json + mark generated dirs linguist-generated
  (the `git rm --cached`, the .gitignore entry, and .gitattributes)
- ci(i18n): add i18n:gen aggregate script + Generate i18n artifacts step to both jobs
  (package.json + .github/workflows/ci.yml)
- test(i18n): add assertDeterministic helper + repoint reproducibility suites
  (tests/helpers/i18n_determinism.ts + the two repointed test files)
- feat(i18n): emit + commit i18n.status.summary.json
  (scripts/i18n_scan.mjs + the committed src/ui/i18n.status.summary.json + its cross-check)
- docs(i18n): Phase 5 progress + state

STEP 5 - ACCEPTANCE CRITERIA (do not mark complete until all check):
- [ ] src/ui/i18n.status.json is gitignored and `git rm --cached`'d (no longer tracked); a fresh
      clone has it ABSENT pre-build.
- [ ] Fresh clone -> `npm ci && npm test` is green (proves `pretest` regenerates status.json).
- [ ] .gitattributes marks src/ui/i18n.resolved.generated/** and src/admin/i18n.resolved.generated/**
      `linguist-generated`.
- [ ] package.json has `i18n:gen` (build + admin + scan).
- [ ] `Generate i18n artifacts` (`npm run i18n:gen`) is in BOTH jobs, after `npm ci`, before typecheck/build.
- [ ] tests/helpers/i18n_determinism.ts exists; `assertDeterministic` double-generates with perturbed
      TZ/LC_ALL/temp-path and asserts byte-identity.
- [ ] The status.json reproducibility sub-suite now uses assertDeterministic; the resolved-dir freshness
      checks still use `git diff` AND gain a determinism check.
- [ ] src/ui/i18n.status.summary.json is committed (counts + per-locale rollup + universeHash, no bodies)
      and cross-checked by the registry test.
- [ ] `I18N_RELEASE_TIER=1 npm test` green on the translated tree; RED on a synthetic pending row.
- [ ] `npm run i18n:hash -- --check` OK (SHA d74aeb6.. unchanged); `git status` clean after build with no
      megabyte file tracked.

STEP 6 - DOC UPDATES + MEMORY:
- Update docs/i18n-scaling/lazy-locales/progress.md (Phase 5 status + ticks; note any deferral).
- Update docs/i18n-scaling/lazy-locales/state.md if any path/symbol drifted (esp. the summary.json path
  and the swapped reproducibility property for status.json).
- Record in Claude Code memory any surprising rule (e.g. a gitignored file still needing a runtime read,
  or a CI cache wrinkle).

STEP 7 - FINAL RESPONSE FORMAT:
End with: phase status, files touched, validation results (esp. the fresh-clone green with status.json
absent, the SHA check, and the release-tier gate-teeth result), the privacy-security + qa-checklist
verdicts, any deferred items, and a one-line handoff for Phase 5 QA.

STOPPING RULES:
- STOP if removing status.json from git breaks a test that reads its COMMITTED bytes - find and fix
  that read FIRST (it is the equivalence/registry reproducibility sub-suite); do not leave a red tree.
- STOP if the release-tier gate stops biting a synthetic pending row (the teeth are non-negotiable).
- STOP if the resolved-table SHA moves (a moved SHA = a real bug, never a re-baseline - surface it).
```
