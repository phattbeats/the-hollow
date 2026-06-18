# implementation-plan.md - i18n Lazy Locales

TOC + the canonical per-phase workflow + the phase summary table. Per-phase detail lives in the `phase-NN-*.md` files (self-contained starter prompts). This file is the map; the phase files are the territory.

## Phase summary table
| # | Phase | Implements | Risk | Reviewers triggered | Starter |
|---|-------|-----------|------|---------------------|---------|
| 1 | Per-locale emit split | Doc Step 1 | Low (producer-only, byte-identical) | qa-checklist | [phase-01](phase-01-emit-split.md) / [QA](phase-01-qa.md) |
| 2 | Async loader + bootstrap | Doc Step 2 | Medium (additive, behavior unchanged) | qa-checklist | [phase-02](phase-02-async-loader.md) / [QA](phase-02-qa.md) |
| 3 | The lazy flip | Doc Step 3 | **High (the payload flip; tree-shake probe)** | qa-checklist | [phase-03](phase-03-lazy-flip.md) / [QA](phase-03-qa.md) |
| 4 | Modulepreload + first-paint perf | Doc Step 4 (preload deliverable) | Medium (HTML + build hook) | qa-checklist; optional privacy-security (inline script/CSP) | [phase-04](phase-04-modulepreload.md) / [QA](phase-04-qa.md) |
| 5 | Artifact / CI / determinism hygiene | Doc Step 4 (CI/git) | Low-Medium (mechanical) | **privacy-security** (CI yml); qa-checklist | [phase-05](phase-05-artifact-ci-hygiene.md) / [QA](phase-05-qa.md) |
| 6 | `i18n.en.ts` directory split | Doc Q6 / Section 4.4.3 | Low (byte-identical, surface unchanged) | qa-checklist | [phase-06](phase-06-en-split.md) / [QA](phase-06-qa.md) |

Sequencing rule (design doc Section 6): change the producer before the consumer; keep a back-compat surface until the consumer is migrated; flip the consumer last; do CI/git/docs last so a revert of the risky middle (Phase 3) never strands the gate. Phase 6 is orthogonal and may land any time after Phase 1, but is sequenced last because it is the largest human-source change.

## Model + orchestration
Every phase runs on **Opus 4.8, max effort**, in Claude Code, each a fresh session (the whole point: per-phase context savings). These phases are **surgical code edits, not content sweeps** - the default tool is a small parallel Agent fan-out (1 agent per vertical slice) or direct edits, NOT a Workflow. Only Phase 1 and Phase 6 (uniform per-locale / per-module transforms) might warrant `ultracode` + a Workflow, and only if the implementer judges the per-item count high enough; the phase files note this. Always request fan-out explicitly (Opus 4.8 will not self-initiate it). Give each agent ONLY the Explore summary, never the raw planning docs.

## Canonical per-phase workflow (every `phase-NN-*.md` follows this)
**STEP 0 - PRE-FLIGHT.** Verify `git status` is clean (a concurrent session may share this checkout - if dirty, ask). Confirm you are on `feature/i18n-lazy-locales` (create it off `release/v0.9` if it does not exist yet: `git switch -c feature/i18n-lazy-locales`). Scan Claude Code memory for the i18n domain (`MEMORY.md` + `i18n-resolved-baseline-and-assembly`, `i18n-phase3-lazy-locales-plan`, `shared-worktree-commit-care`).

**STEP 1 - LOAD CONTEXT (do NOT read planning docs directly).** Spawn ONE Explore agent to read and summarize `state.md`, the relevant `progress.md` rows, this phase's `phase-NN-*.md`, the specific source files the phase touches, and the relevant CLAUDE.md files. It returns a focused summary; you keep the conclusions.

**STEP 2 - CHOOSE ORCHESTRATION + EXECUTE.** Pick the lightest tool. Default to direct edits or a small fan-out (one agent per vertical slice). Request fan-out explicitly. Never `mode: "plan"` on teammates. Use `isolation: "worktree"` only if agents edit overlapping files in parallel (rare here).

**STEP 3 - VALIDATION + REVIEW.** Run the phase's validation row from `state.md`. Then spawn review agents ONLY for surfaces this diff touches (matrix below). Prompt every review agent for COVERAGE not filtering ("report every issue including low-severity and uncertain ones; ranking happens later"). Resume any that truncates with: *"Stop reading more files. Output the full report now based on what you have already seen. No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."* Do not commit until each reports no BLOCKING issues.

**STEP 4 - COMMIT.** Conventional Commits with a scope (`feat(i18n): ...`, `fix(build): ...`, `test(i18n): ...`), EXPLICIT paths (never `git add -A`), no em dashes/emojis. Commit doc updates (`progress.md`, `state.md`) in the same logical commit as the code.

**STEP 5 - ACCEPTANCE + DOC + MEMORY + HANDOFF.** Tick the phase's acceptance checklist; update `progress.md` (status + deferrals) and `state.md` (new symbols, locked decisions); record any surprising rule in Claude Code memory; end with phase status, files touched, validation results, review verdicts, deferrals, and a one-line handoff for the QA session.

## Review Dispatch Matrix (tailored to THIS packet's scope)
Because this feature touches only `src/ui` (i18n runtime) + `scripts/` (build) + `src/main.ts` + `index.html` + CI/git + `tests/`, most rows never fire. Spawn an agent ONLY when its row matches the diff (`git diff --name-only` vs the phase-start commit):

| Agent | Fires in this packet when | Which phases |
|-------|---------------------------|--------------|
| `privacy-security-review` | the diff edits `.github/workflows/ci.yml` (a CI file) or adds an inline `<script>` worth a CSP look | **Phase 5** (required); Phase 4 (optional, light) |
| `migration-safety` | NEVER (no DDL, no `characters.state` shape change) | none |
| `cross-platform-sync` | NEVER (no `src/sim` behavior, no IWorld, no wire, no `sim_i18n`/`server_i18n` matcher; the 3 new keys are pure client `main`-scope) | none |
| `qa-checklist` | a phase / deliverable set is COMPLETE | every phase (at completion) |

If a phase's diff matches no row beyond `qa-checklist`, spawn only `qa-checklist`. Do not default to running `privacy-security` "anyway." Every phase ALSO gets the correctness / test-coverage / dead-code passes built into its QA phase regardless of the matrix.

## Invariants every phase keeps
- **`t()` stays synchronous.** Never async. The only async surface is `ensureLocaleLoaded` at bootstrap + picker.
- **Determinism / reproducibility:** generators are pure functions of source; same input -> byte-identical output. No timestamps in emitted output.
- **The resolved-table SHA must not move** (`npm run i18n:hash -- --check` green at every step). Never re-baseline to silence a red gate.
- **No generated-file hand-edits.** Regenerate via the build.
- **i18n completeness:** new player strings are `t()` keys in `en` first; release-tier gate hard-fails on `pending`.
- **No `src/sim` / `server` / `src/net` / IWorld / wire / persistence change** (out of scope - if a phase seems to need one, stop and ask).
- Shared worktree: EXPLICIT paths, never `git add -A`. No em dashes/emojis.

## Code hygiene every phase enforces
- New code gets tests (loader behavior, fallback, determinism, the bundle-shape assertions).
- Determinism tests for any generator change (double-generate -> byte-identical).
- Update/remove tests when changing behavior; never leave orphaned or broken tests.
- Delete fully-replaced code (the single-file emit, the static import once flipped); zero unused imports/types.
- Uphold the import invariant: `src/sim/` imports nothing from `render/ui/game/net` and has no DOM/Three (n/a here, but do not introduce a violation).
- No generated-file hand-edits.

## Acceptance gates for the whole feature
See `qa-checklist.md`. Headline: (1) `i18n:hash --check` OK at every step; (2) PR-tier + release-tier `npm test` green, gate-teeth still bite a synthetic pending row; (3) `npm run build` + `tsc --noEmit` green; (4) a default-English visitor downloads ZERO non-English locale bytes; (5) `?lang=es` + one CJK locale render with no flash / no layout shift; (6) loader rejection degrades to English with no crash; (7) `?lang=en_XA` works in dev, absent from the prod bundle; (8) both canary tests green under the new seam.
