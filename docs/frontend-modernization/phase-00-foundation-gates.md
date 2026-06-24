# Phase P0: Foundation Gates: CSS-corpus + UI-purity guard + perf baseline

Re-establish the three verifiable gates the whole packet leans on, on a green v0.16.0, before any
HUD or CSS code moves: the CSS-corpus completeness guard, the UI-purity import guard, and a recorded
perf_tour baseline that every later per-frame phase regresses against.

## Starter Prompt

```
This is Phase P0 of the Frontend Modernization v0.16.0 packet: Foundation Gates (CSS-corpus + UI-purity guard + perf baseline).

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: no. Three independent but small surgical artifacts (one new test file, one parameterized guard, one recorded baseline); a single sequential orchestrator with at most a 3-way Agent fan-out is enough. No batch fan-out, no adversarial verify loop.

Goal: Stand up the gates the packet's acceptance criteria depend on, while moving ZERO product code. Add tests/css_corpus.test.ts (a section-by-section completeness guard over the inline <style> blocks in index.html and play.html, keyed on the `/* ---- name ---- */` section comments) so later CSS phases can prove no rule was dropped. Parameterize the existing UI-purity machinery in tests/architecture.test.ts into a UI_PURE_CORES allowlist that rejects three / *_painter / painter_host / DOM-global imports inside a registered pure core, seeded with V16's already-existing cores. Record a perf_tour baseline (frameP95, inputIntentToFrameP95, hudHotDomSkipRate) on desktop and mobile as the non-regression floor every per-frame phase (P10-P14) will gate against. Leave the baseline reproducible and checked in as a doc artifact.

STEP 0 - PRE-FLIGHT:
- Run `git status`. It MUST be clean. This worktree is a shared checkout; if it is dirty, STOP and ask the user before touching anything.
- Confirm you are on branch feature/frontend-modernization-v016 in /Users/fernando/Documents/wocc-v0.16.0.
- Memory scan: read MEMORY.md and the Frontend Phase 1 foundation-gates entry (frontend-phase1-foundation-gates.md: cssCorpus/normalizeCss CSS tests + the vite/lightningcss pin), the Phase 7 entry (frontend-phase7-hud-window-extraction.md: the forbiddenUiCoreImport / UI_PURE_CORES guard shape, the "guard perturbation must inject a REAL code line, a // comment is stripped by stripComments" gotcha, and "run the FULL suite for source-guards"), and the phased-packet QA cadence entry. These are the FB originals this phase ports forward.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read and summarize:
- state.md (locked decisions, non-negotiable constraints, the canonical workflow, the validation matrix, the review dispatch matrix).
- this phase file.
- the `### P0` section of v016-recon-and-packet.md plus its "Load-bearing structural findings", "Reuse from FB", and "Top risks" sections.
- the SPECIFIC source ranges: in tests/architecture.test.ts the existing walk() / stripComments() / IMPORT_RE machinery and any existing sim-purity scan it parameterizes; the inline <style> sections of index.html and play.html ONLY to enumerate the `/* ---- name ---- */` section-comment markers (do not dump the CSS bodies); scripts/perf_tour.mjs (its current output keys: frameP95, inputIntentToFrameP95, hudHotDomSkipRate) and the hud perf bucket + perfStats() at hud.ts:1322-1372; the FB originals of css_corpus.test.ts and the cssCorpus/normalizeCss helpers and the FB UI_PURE_CORES guard to port them forward.
The orchestrator KEEPS the distilled summary (section-marker list, guard machinery shape, perf_tour output schema), not raw dumps.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
Three slices. They touch disjoint files, so fan out up to 3 Agents in parallel (no shared-file overlap, so no worktree isolation needed), then the orchestrator integrates and runs the suite.
- Slice A (css_corpus guard): port FB's tests/css_corpus.test.ts + the cssCorpus / normalizeCss helpers forward. The guard reads the inline <style> of index.html and play.html, splits each into sections on the `/* ---- name ---- */` markers, normalizes (whitespace/comment-insensitive but rule-preserving), and asserts every section is accounted for. Today every section lives inline; the guard must pass NOW (full corpus inline) and stay meaningful as P1-P4 move sections into src/styles/. Enumerate the real section markers from the STEP 1 summary; do NOT invent section names.
- Slice B (UI-purity guard): in tests/architecture.test.ts, parameterize the existing walk() / stripComments() / IMPORT_RE scan into a UI_PURE_CORES allowlist. A registered pure core MUST NOT import three (or three/*), any *_painter module, painter_host, or DOM globals (document/window/HTMLElement/etc). Seed the allowlist with V16's already-existing per-element + window cores listed in the recon (xp_bar, cast_bar, absorb_bar, party_frames selector, rest_indicator, low_health, low_resource, clock, compass, coords, quest_tracker, delve_map, raid_lockout_view, vendor_view, and the existing *_view cores). The guard is over the EXISTING green cores, so it MUST pass with no edits to product code.
- Slice C (perf baseline): run scripts/perf_tour.mjs in both desktop and mobile profiles, capture frameP95, inputIntentToFrameP95, hudHotDomSkipRate, and write them as the recorded non-regression floor into a checked-in doc artifact (docs/frontend-modernization/perf-baseline-v016.md) with the exact command, profile flags, and machine note so a later phase can reproduce. This is the number P10-P14 gate against. Do NOT edit perf_tour itself in P0 (its re-author is P15); only run and record.

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- Presentation/test-only: move ZERO product code. No hud.ts, no CSS, no src/sim / server / src/net / headless edits. If a gate cannot pass without a product-code change, STOP and surface it (scope change).
- Determinism: the guards and any test helper stay DOM/Three-free and use no Math.random / Date.now / performance.now in registered-core scanning logic.
- i18n: no new player-visible strings in this phase (gates only).
- No generated-file hand-edits; if a guard reads a generated artifact, read it, never edit it.
- Shared worktree: commit with EXPLICIT paths, never `git add -A`.
- No em dashes, en dashes, or emojis anywhere (code, comments, docs, commit text).

Out of scope (do NOT do in this phase):
- The Lightning CSS flip, .browserslistrc, the @layer order, and any src/styles/* extraction (all P1+).
- Moving any CSS section out of the inline <style> blocks (P1-P4); the corpus guard must pass with everything STILL inline.
- ui_effects_profile.ts and the data-fx-level applier (P5).
- PainterHost and any window/per-frame extraction (P6+).
- Re-authoring perf_tour.mjs or adding the standing hud_perf_budget.test.ts (P15).

STEP 3 - VALIDATION + REVIEW:
Validation-matrix rows that match (state.md):
- Baseline: `npx tsc --noEmit`.
- CSS/test guard added: `npx vitest run tests/css_corpus.test.ts` (passes with the full corpus inline).
- Purity guard added: `npx vitest run tests/architecture.test.ts`.
- Run the FULL suite for source-grep guards: `npm test` green (architecture/source guards can false-pass on a narrow run).
- NEGATIVE PROOF (required): perturb each new guard and confirm it FAILS, then revert.
  - css_corpus: delete one section's content from the corpus fixture and confirm the section-loss assertion fires; restore.
  - UI-purity: inject a REAL import line `import './x_painter'` (NOT a // comment, which stripComments removes per the Phase 7 gotcha) into a registered core, confirm the guard fails, then revert.
- No PER-FRAME perf gate runs as an acceptance bar here (P0 only RECORDS the baseline; it has no baseline to beat). Capturing the baseline IS the deliverable.
Review dispatch (state.md Review Dispatch Matrix): this is test/doc-only, presentation-adjacent. Spawn qa-checklist ONLY (correctness + test-coverage + dead-code), prompted for COVERAGE. No privacy-security-review / migration-safety / cross-platform-sync (no server/net/IWorld/sim surface touched). Do not commit until qa-checklist reports no BLOCKING.

STEP 4 - COMMIT CADENCE: 2-5 Conventional Commits, scoped, EXPLICIT paths. Example:
- `test(css): add css_corpus section-completeness guard (tests/css_corpus.test.ts)`
- `test(arch): parameterize UI-purity guard with UI_PURE_CORES allowlist (tests/architecture.test.ts)`
- `docs(frontend): record v0.16.0 perf_tour baseline (docs/frontend-modernization/perf-baseline-v016.md)`
- `docs(frontend): update progress.md + state.md ledger for P0`

STEP 5 - ACCEPTANCE CRITERIA: the checklist below; every item green and verifiable.

STEP 6 - DOC UPDATES + MEMORY: update progress.md (P0 row -> done, with the baseline numbers) and state.md (mark P0 status done in the ledger; note the recorded baseline file path; record the gate file names so later phases cite them). Record surprising rules in memory (the stripComments-strips-comments perturbation gotcha if re-hit; the exact perf_tour command + profile flags used).

STEP 7 - FINAL RESPONSE: status, files changed/added, validation results (tsc, both guards green + each negative proof fired then reverted, qa-checklist verdict), the recorded baseline numbers, any deferrals, and end with the handoff line: "Next: phase-01-css-lightning-tokens-base.md".

STOPPING RULES:
- STOP and surface if either guard cannot pass on the current green tree WITHOUT editing product code (means an existing core already violates purity, or a CSS section is unaccounted for; that is a finding, not a fix-it-here task).
- STOP if perf_tour cannot run in a given profile (desktop or mobile) and record which profile is missing rather than fabricating a number.
- STOP if implementing a gate requires extending IWorld or touching src/sim / server / src/net (scope change per state.md decision 4).
```

## Notes for the planner

P0 is shaped as gates-before-motion because every later phase's acceptance ("css_corpus zero rule
loss", "purity guard passes", "frameP95 <= the P0 baseline") is meaningless until these three
artifacts exist and are proven to bite. The key risk is a false-green guard: a corpus check that
passes vacuously, or a purity scan whose perturbation is silently stripped (the Phase 7 stripComments
gotcha), so the negative-proof step is a hard acceptance bar, not a nicety. Keeping it strictly
test/doc-only de-risks every downstream phase: P1-P4 inherit a corpus guard that catches a dropped
CSS rule, P6-P9 inherit a purity allowlist that catches a core importing a painter, and P10-P14
inherit a recorded floor to regress frameP95 and the DOM skip-rate against.
