# i18n Lazy Locales - implementation packet

Ship English eagerly and lazy-load every non-English locale as its own content-hashed chunk, so a default-English visitor downloads zero non-English locale bytes (main client chunk 1.13 MB -> ~590 KB gzip, ~540 KB dropped) while `t()` stays synchronous. This packet operationalizes the audited design doc into 6 implementation phases, each followed by a QA phase, each a fresh Opus 4.8 session.

This is the work the broader team calls "i18n Phase 3." The canonical engineering design lives one level up in [`../phase-3-lazy-locales-and-contributor-workflow.md`](../phase-3-lazy-locales-and-contributor-workflow.md) (818 lines, audited 2026-06-17); its Section 5 contributor policy already landed in commit `a36a94c7`. This packet is the per-phase scaffolding that turns its code Steps 1-4 (plus its open Q6) into executable sessions. The scaffolding is removed at teardown; the design doc and [`../translation-workflow.md`](../translation-workflow.md) survive as shipping reference.

## Read these first (cross-cutting)
- [brainstorm.md](brainstorm.md) - vision, current-state delta, reusable pieces, decisions, OPEN items.
- [implementation-plan.md](implementation-plan.md) - TOC, the canonical per-phase workflow, and the phase summary table.
- [state.md](state.md) - the cross-phase contract: locked decisions, scope boundary, validation matrix, file paths, new symbols, gotchas.
- [progress.md](progress.md) - live status table + per-phase deliverable/acceptance checklists.
- [qa-checklist.md](qa-checklist.md) - whole-feature integration matrix verified at packet completion.

## Phase index (implement -> QA pairs)
1. [phase-01-emit-split.md](phase-01-emit-split.md) - per-locale emit split + back-compat barrel + `I18N_OUT_DIR` (producer only, byte-identical) - [QA](phase-01-qa.md)
2. [phase-02-async-loader.md](phase-02-async-loader.md) - async loader + bootstrap awaits + 3 new keys (additive, behavior unchanged) - [QA](phase-02-qa.md)
3. [phase-03-lazy-flip.md](phase-03-lazy-flip.md) - the lazy flip (3a/3b tree-shake probe), fix the 2 canary tests, the ~540 KB win - [QA](phase-03-qa.md)
4. [phase-04-modulepreload.md](phase-04-modulepreload.md) - `<link rel=modulepreload>` + inline boot script + runtime prefetch (kills the waterfall) - [QA](phase-04-qa.md)
5. [phase-05-artifact-ci-hygiene.md](phase-05-artifact-ci-hygiene.md) - gitignore `status.json`, `i18n:gen` CI step, `assertDeterministic`, `.gitattributes` - [QA](phase-05-qa.md)
6. [phase-06-en-split.md](phase-06-en-split.md) - split `i18n.en.ts` into `src/ui/i18n.en/` (byte-identical, public surface unchanged) - [QA](phase-06-qa.md)

## How to start a phase
Open the phase file, copy its `### Starter Prompt` block verbatim into a fresh Opus 4.8 session (max effort; add `ultracode` only if the phase file says the phase is batch-heavy - most are surgical and do not need it), and run. Each starter prompt is self-contained: it spawns its own Explore agent to load context, so you never paste planning docs by hand.

## Branch / integration
All code work runs on `feature/i18n-lazy-locales` (cut off `release/v0.9`), PR'd back into `release/v0.9`. `release/**` runs the i18n RELEASE-TIER gate (`I18N_RELEASE_TIER=1`), so the 3 new keys from Phase 2 must be filled in the 10 base locales before that gate passes (see state.md). The final QA phase offers to delete this `lazy-locales/` directory before the PR settles.
