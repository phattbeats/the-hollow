# Frontend Modernization v0.16.0: Progress

Live status of the 18-phase restart packet on `feature/frontend-modernization-v016`
(off `release/v0.16.0`, `e31eb05d`). Update at the end of every phase (state.md STEP 6).
Full per-phase scope/acceptance: `v016-recon-and-packet.md` + each `phase-NN-*.md`.

## Status table

| Phase | Title | Layer | Status | Notes / deferrals |
|---|---|---|---|---|
| P0 | Foundation gates (CSS-corpus + UI-purity guard + perf baseline) | gates | pending | records the perf_tour non-regression floor every per-frame phase checks against |
| P1 | CSS A: Lightning flip + tokens + base | css | pending | |
| P2 | CSS B1: in-world HUD chrome | css | pending | ULTRACODE |
| P3 | CSS B2: modal + feature windows | css | pending | ULTRACODE |
| P4 | CSS C: shell + mobile + per-entry .extra | css | pending | ULTRACODE; closes the inline <style> blocks |
| P5 | ui_effects_profile resolver + applier | effects | pending | 'advanced' preset honors effectsQuality (decided) |
| P6 | PainterHost seam + cold-window pilot | seam | pending | thin compose-in host (decided); delve_map_painter dedupe |
| P7 | Cold-window batch 1: talents, social, bags | windows | pending | ULTRACODE, per-window fan-out |
| P8 | Cold-window batch 2: options, market, char | windows | pending | ULTRACODE |
| P9 | Cold-window batch 3: map, arena, questlog, leaderboard, spellbook | windows | pending | ULTRACODE; the one IWorld painter fix (paged leaderboard) |
| P10 | Per-frame batch 1 (EASY): xp, swing + unit_frame family core (player instance) | per-frame | pending | ULTRACODE; fixes swing/xp elision leaks; unit_frame FAMILY; PERF GATE |
| P11 | Per-frame batch 2 (MEDIUM): cast bars + target/party as unit_frame instances | per-frame | pending | ULTRACODE; split-watch; reuses P10 unit_frame; PERF GATE |
| P12 | Per-frame batch 3 (HARD): action bar (multi-bar param), auras pool, minimap | per-frame | pending | ULTRACODE; split-watch; instance-parameterized bars; PERF GATE + alloc budget |
| P13 | Per-frame batch 4 (HIGHEST RISK): FCT pool + driver | per-frame | pending | ULTRACODE; split-watch; PERF GATE (bounded AoE) |
| P14 | Per-element graphics tiering + nameplate formalization | tiering | pending | tier knobs read static preset only; nameplate core |
| P15 | Accessibility (WCAG 2.2 AA chrome) + forced-colors + skip links + minimal print | a11y | pending | NEW; axe + keyboard + focus-mgmt + live regions; chrome-only scope |
| P16 | Standards codification into CLAUDE.md | standards | pending | NEW; docs-only; the 100%-AI-codebase inheritance multiplier |
| P17 | Harness re-author + bundle-budget + cross-engine E2E + perf assertion + close | close | pending | bundle gate + selective lazy-load + mobile-Safari/WebKit E2E + final CI/perf exit |

Legend: pending / in-progress / complete / complete+QA.

## Layer gates (the de-risk ordering)

1. Gates + CSS + effects + cold-window seam (P0-P9) restore the proven FB architecture on v0.16.0.
2. Per-frame extraction (P10-P13) only starts once the seam (P6) and gates (P0) are green; P10 lands
   the parameterized unit_frame family that P11 reuses for target/party.
3. Per-element tiering (P14) only starts once every hot element is a core+painter (P10-P13).
4. Accessibility (P15) consolidates + audits a11y once every component exists (per-window a11y is
   built in during P7-P14 via the state.md WINDOW/CONTROL gate).
5. Standards codification (P16) writes the proven contracts into the CLAUDE.md files.
6. Close (P17) adds the bundle-budget gate + selective lazy-load + cross-engine E2E, re-authors the
   string-grep harness, and runs the final CI/perf exit gate.

## Per-phase deliverable checklists

Each phase's acceptance criteria live in its `phase-NN-*.md` STEP 5. This section accumulates the
ACTUAL outcome (files added, deferrals, commits, QA verdict) as phases complete. Empty until P0
starts.

- P0: _not started_
- P1: _not started_
- P2: _not started_
- P3: _not started_
- P4: _not started_
- P5: _not started_
- P6: _not started_
- P7: _not started_
- P8: _not started_
- P9: _not started_
- P10: _not started_
- P11: _not started_
- P12: _not started_
- P13: _not started_
- P14: _not started_
- P15: _not started_
- P16: _not started_
- P17: _not started_

## Open items / carry-forward
- The per-frame batches (P10-P13) are provisionally 3 elements each; split per-element if a session
  approaches the 40% context ceiling (state.md canonical workflow STEP 1).
- The allocation-budget assertion (P12) needs a spike: is there a Node-measurable per-frame-garbage
  proxy, or does it degrade to perf_tour frameP95/longtasks only?
- iOS real-device pass for the mobile-landscape CSS (carried from FB's Phase 5) remains a manual
  deliverable that cannot run in CI.
