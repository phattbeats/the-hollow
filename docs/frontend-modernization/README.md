# Frontend Modernization v0.16.0 (feature/frontend-modernization-v016, off release/v0.16.0)

Make World of ClaudeCraft's UI clean, scalable, responsive (mobile-landscape first), and fast on
the big-3 browsers WITHOUT a JS framework: stay vanilla HTML/CSS/TS and let the modern web platform
plus one build tool (Lightning CSS) do the work. This is the definitive version of the refactor,
rebuilt on `release/v0.16.0` and EXPANDED beyond the original: it extracts the giant inline
`<style>` blocks into a real CSS pipeline with tiered tokens and `@layer`, ships the graphics-tier
HUD effects resolver, extracts the remaining cold windows out of the 14,377-line `hud.ts` behind
`IWorld`, AND for the first time extracts the per-frame HUD layer (bars, frames, nameplates,
minimap, FCT, action bar) into testable cores + write-elided painters, then drives per-element
graphics-quality tiering off the static preset. All behind the project's determinism,
server-authority, i18n, and per-frame perf gates.

This is a RESTART of the completed `feature/frontend-modernization` (FB) packet, which targeted the
older `release/v0.14.1`. The restart decision (Option B) and its evidence are in
`feasibility-v0.16.0.md`; the why-and-scope is in `v016-restart-direction.md`. FB is a read-only
SOURCE: most of its artifacts port forward file-for-file (see `state.md` "Provenance" and the
"Reuse from FB" section of `v016-recon-and-packet.md`).

This packet is the SINGLE source of truth for the frontend direction on v0.16.0.

## Start here

Each phase is its own fresh Claude Code session (Opus 4.8, xhigh effort). To begin a phase, open
its `phase-NN-*.md` and paste the Starter Prompt into a new session. Run the QA pass
(`qa-checklist.md`, instantiated for the phase) immediately after each implementation phase. Never
skip QA. The per-frame batches (P10-P13) are flagged to SPLIT per-element if a session's context
approaches the ~40% Opus-degradation ceiling.

## Index

Cross-cutting docs (decision + design lineage):
- `feasibility-v0.16.0.md` - the Option B verdict (restart, not merge) with the merge dry-run.
- `v016-restart-direction.md` - the expanded scope + the process learnings (smaller phases, perf
  gates).
- `v016-recon-and-packet.md` - the deep recon of v0.16.0's frontend (the real line numbers) and the
  full 16-phase design. THE authoritative source the phase files elaborate.
- `state.md` - locked decisions, the 4 design decisions, canonical workflow, validation matrix,
  review dispatch matrix, the running phase ledger. LOADED FIRST by every phase.
- `progress.md` - status table + per-phase deliverable checklists.
- `qa-checklist.md` - whole-feature integration QA matrix + the per-phase QA starter.

Phases (implement, then QA):
- P0 `phase-00-foundation-gates.md`
- P1 `phase-01-css-lightning-tokens-base.md`
- P2 `phase-02-css-hud-chrome.md` (ULTRACODE)
- P3 `phase-03-css-windows.md` (ULTRACODE)
- P4 `phase-04-css-shell-mobile-extra.md` (ULTRACODE)
- P5 `phase-05-ui-effects-profile.md`
- P6 `phase-06-painterhost-seam-pilot.md`
- P7 `phase-07-coldwindow-batch1.md` (ULTRACODE)
- P8 `phase-08-coldwindow-batch2.md` (ULTRACODE)
- P9 `phase-09-coldwindow-batch3.md` (ULTRACODE)
- P10 `phase-10-perframe-batch1-easy.md` (ULTRACODE, split-watch; lands the unit_frame family)
- P11 `phase-11-perframe-batch2-medium.md` (ULTRACODE, split-watch; target/party reuse unit_frame)
- P12 `phase-12-perframe-batch3-hard.md` (ULTRACODE, split-watch; multi-bar action bar)
- P13 `phase-13-perframe-batch4-fct.md` (ULTRACODE, split-watch)
- P14 `phase-14-graphics-tiering.md`
- P15 `phase-15-accessibility.md` (WCAG 2.2 AA chrome + forced-colors + skip links + minimal print)
- P16 `phase-16-standards-codification.md` (codify the contracts into the CLAUDE.md files)
- P17 `phase-17-harness-close.md` (bundle-budget + cross-engine E2E + packet close + final QA)

## Non-negotiables (full detail in state.md)

Vanilla only (one new devDep: Lightning CSS). The per-frame HUD stays framework-free with a hard
perf gate; per-frame painters route every DOM write through the existing write-elision cache. HUD
extraction is presentation-only (consume V16's already-extended `IWorld`; one painter consumes the
paged `leaderboard()`). New pure cores stay DOM/Three-free and deterministic. Graphics-tier UI is
driven from the static preset, never the FPS governor. New control labels go in the English-only
`hud_chrome.ts`. Commit with explicit paths (shared worktree). No em dashes, en dashes, or emojis
anywhere.
