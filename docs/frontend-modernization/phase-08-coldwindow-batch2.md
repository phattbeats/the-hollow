# Phase P8: Cold-window extraction batch 2: options, market, char

Extract three inline classic windows (`renderOptions`, `renderMarket`, `renderChar`) out of
`hud.ts` into pure `*_view.ts` cores plus thin painters composed through the P6 PainterHost,
presentation-only, consuming V16's already-landed `IWorld`.

## Starter Prompt

```
This is Phase P8 of the Frontend Modernization v0.16.0 packet: Cold-window extraction batch 2: options, market, char.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: yes. This is a batch of 3 independent cold windows; fan out one subagent per window (options, market, char) with parallel Workflow + adversarial verify, exactly as the canonical workflow prescribes for the cold-window batches.

Goal: Move three inline classic windows out of the hud.ts monolith into the repo's Humble-Object cold-window seam. For each of renderOptions (hud.ts:12783), renderMarket (hud.ts:8343), and renderChar (hud.ts:9116), add a pure src/ui/<name>_view.ts core (DOM/Three-free, registered in the UI-purity allowlist) that derives the window's view-model from IWorld, plus a thin painter that composes through the P6 PainterHost (icon/money/tooltip helpers + elided writers) and renders. This is PRESENTATION-ONLY: consume V16's already-extended IWorld; do not extend IWorld or touch src/sim, server, src/net, or headless. Preserve each window's specific behaviors: options control dispatch (every control's change/click handler still fires the same action), market filtering (reuse the already-extracted market_filters helper, do not re-derive it), and the char paperdoll (equipment slots, model/stat panel). These are cold (open-on-demand) windows, NOT per-frame; no perf gate applies, but they must not be wired into Hud.update().

STEP 0 - PRE-FLIGHT:
- git status must be clean. This is a shared checkout; if it is dirty, STOP and ask the user before touching anything.
- Confirm you are in the feature/frontend-modernization-v016 worktree (git branch --show-current).
- Memory scan: read MEMORY.md and the Frontend Phase 7 HUD window extraction entry (the FB cold-window cores+painters behind the PainterHost seam, the purity-guard hardening, the sed-clips-interleaved-keeps lesson) and the Frontend Phase 6 window-encapsulation entry (the #id-prefix isolation the windows rely on). These are the closest prior art for this seam.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
- Spawn ONE Explore agent to read and summarize: state.md (locked decisions, non-negotiable constraints, canonical workflow, validation matrix, review dispatch matrix, the V16 key file paths); this phase file; the "### P7-P9 Cold-window extraction" section of v016-recon-and-packet.md plus the "Load-bearing structural findings" and "Reuse from FB" sections; and ONLY these source ranges from hud.ts: renderOptions 12783 (read to its close), renderMarket 8343 (read to its close), renderChar 9116 (read to its close). Also have it locate and summarize the already-extracted market_filters helper and the P6 PainterHost surface (src/ui/painter_host.ts) and one existing reference pair (vendor_view.ts + vendor_window.ts) as the template.
- The orchestrator keeps the summary, not raw dumps. Keep the working set well under the ~40% context ceiling (the 40% rule); three windows is within budget, but if any single window's inline block is unexpectedly large, extract it in its own commit and re-summarize before the next.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE: three slices, fan out one subagent per window (request fan-out EXPLICITLY). Each slice produces a pure core + a thin painter + a core test, following the vendor_view/vendor_window template and composing through PainterHost.
- Slice A (options): extract renderOptions (hud.ts:12783) -> src/ui/options_view.ts (pure: derive the settings/control view-model from IWorld + the settings source) + src/ui/options_window.ts painter. PRESERVE control dispatch: every control's change/click handler must still fire the exact same action it does inline today (keybinds, graphics preset, language, toggles). Any control LABEL that is newly introduced goes in src/ui/i18n.catalog/hud_chrome.ts (English-only) via t(); do not hardcode and do not edit i18n.locales.
- Slice B (market): extract renderMarket (hud.ts:8343) -> src/ui/market_view.ts (pure) + src/ui/market_window.ts painter. REUSE the already-extracted market_filters helper for filtering; do not re-derive filter logic in the new core. Preserve buy/list/cancel actions and money formatting (route money/icon through PainterHost helpers).
- Slice C (char): extract renderChar (hud.ts:9116) -> src/ui/char_view.ts (pure: paperdoll slot/stat view-model from IWorld) + src/ui/char_window.ts painter. Preserve the paperdoll (equipment slots, the model/stat panel, slot tooltips routed through PainterHost's tooltip helper).
- Register each new *_view.ts core in the UI-purity allowlist (UI_PURE_CORES in tests/architecture.test.ts). Update tests/client_shell.test.ts for any DOM ids that moved from hud.ts into a painter.

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- PRESENTATION-ONLY (locked decision 4): consume V16's already-landed IWorld; do NOT extend IWorld or touch src/sim, server, src/net, or headless. If a slice finds it needs to extend IWorld, STOP and surface it (scope change).
- PainterHost is a THIN compose-in host (locked decision 8): the painters consume its dep-bag (icon/money/tooltip helpers + the elided writers Hud exposes); do not invent a new seam.
- Determinism / purity: each *_view.ts core is DOM/Three-free and has no Math.random / Date.now / performance.now. The purity guard (tests/architecture.test.ts) enforces this; register each core.
- i18n: every NEW player-visible label is a t() key in src/ui/i18n.catalog/hud_chrome.ts (English-only); never concat, never a ?? 'English' fallback, never edit i18n.locales/<lang>.ts.
- No generated-file hand-edits; regenerate via the build.
- Shared worktree: commit with EXPLICIT paths, never git add -A.
- No em dashes, en dashes, or emojis anywhere (code, comments, commits, docs).

Out of scope (do NOT do in this phase):
- The other cold windows: talents/social/bags are P7; map/arena/questlog/leaderboard/spellbook are P9 (P9 also owns the one leaderboard() Promise<LeaderboardPage> painter fix). Do not touch them.
- Any per-frame element (player/target frames, bars, action bar, auras, minimap, FCT, party): those are P10-P13. Do not wire any of these windows into Hud.update().
- Per-element graphics tiering (P14) and the ui_effects_profile applier (P5). Do not add tier knobs here.
- Any CSS move (P1-P4); this phase touches TS only. The window CSS already lives in the extracted stylesheets from the CSS phases.

STEP 3 - VALIDATION + REVIEW (validation-matrix rows that match a pure-core + UI change; no perf gate, these are cold windows):
- npx tsc --noEmit (baseline, every phase).
- Pure core added: npx vitest run tests/options_view.test.ts tests/market_view.test.ts tests/char_view.test.ts + npx vitest run tests/architecture.test.ts (the UI-purity guard must pass with the three new cores in the allowlist, and must still FAIL on an injected forbidden import) + a same-input-same-output assertion per core.
- UI change: npx vitest run tests/client_shell.test.ts (greps hud.ts for DOM ids; update where ids moved into painters) + npm run build (all 4 entries resolve).
- Behavioral assertions to lock in tests: options control dispatch (a changed control still invokes the same action), market filtering routes through market_filters (no duplicated filter logic), char paperdoll renders all equipment slots from the view-model.
- Review dispatch (spawn ONLY matching rows): qa-checklist (default reviewer for a completed deliverable set). Do NOT spawn cross-platform-sync (IWorld unchanged, consuming it in a painter does not change it), privacy-security-review (no server/net/admin/secret/RNG), or migration-safety (no DDL). Prompt the reviewer for COVERAGE not filtering; do not commit until it reports no BLOCKING.

STEP 4 - COMMIT CADENCE: 2-5 Conventional Commits with a scope and EXPLICIT paths. Suggested:
- refactor(ui): extract options window to options_view core + painter
  paths: src/ui/options_view.ts src/ui/options_window.ts src/ui/hud.ts tests/options_view.test.ts tests/architecture.test.ts
- refactor(ui): extract market window to market_view core + painter
  paths: src/ui/market_view.ts src/ui/market_window.ts src/ui/hud.ts tests/market_view.test.ts tests/architecture.test.ts
- refactor(ui): extract char paperdoll window to char_view core + painter
  paths: src/ui/char_view.ts src/ui/char_window.ts src/ui/hud.ts tests/char_view.test.ts tests/architecture.test.ts
- test(ui): update client_shell ids for moved cold windows
  paths: tests/client_shell.test.ts
- docs(frontend): record P8 cold-window batch 2 in progress + state ledger
  paths: docs/frontend-modernization/progress.md docs/frontend-modernization/state.md

STEP 5 - ACCEPTANCE CRITERIA (all verifiable and green):
- [ ] renderOptions, renderMarket, renderChar each delegate to a new *_view.ts pure core + a painter composed through PainterHost; the inline window bodies are gone from hud.ts.
- [ ] src/ui/options_view.ts, src/ui/market_view.ts, src/ui/char_view.ts are DOM/Three-free, registered in UI_PURE_CORES, and pass the purity guard; the guard still FAILS on an injected forbidden import.
- [ ] Each core has a test with a same-input-same-output (deterministic) assertion; all three core tests pass.
- [ ] Options: every control's change/click still fires the same action it did inline (dispatch test green); any new label is a hud_chrome.ts t() key (English-only).
- [ ] Market: filtering reuses the already-extracted market_filters helper (no duplicated filter logic); buy/list/cancel + money formatting preserved via PainterHost helpers.
- [ ] Char: paperdoll renders every equipment slot + the model/stat panel from the view-model; slot tooltips route through PainterHost's tooltip helper.
- [ ] IWorld is NOT extended; no edits under src/sim, server, src/net, headless.
- [ ] npx tsc --noEmit clean; npm test green incl architecture + client_shell; npm run build green on all 4 entries.
- [ ] qa-checklist reviewer reports no BLOCKING.

STEP 6 - DOC UPDATES + MEMORY:
- Update progress.md (P8 row -> done, list the new files + tokens) and state.md (mark P8 done in the ledger; add the three cores to the "Key file paths" reuse list; note any new hud_chrome label keys).
- Record surprising rules in memory: any control whose dispatch did not factor cleanly into a pure core, any market_filters edge the core had to respect, any DOM id the client_shell grep flagged.

STEP 7 - FINAL RESPONSE: status, the files changed (absolute paths), validation results (tsc / test / build / purity guard), the qa-checklist reviewer verdict, any deferrals, and end with: Next: phase-09-coldwindow-batch3.md

STOPPING RULES:
- STOP and surface as a scope change if any window cannot be extracted without extending IWorld or touching src/sim / server / src/net / headless.
- STOP if a control's behavior cannot be preserved through a pure core + PainterHost painter without changing what action it dispatches (do not silently alter dispatch).
- STOP if market filtering cannot reuse the existing market_filters helper without re-deriving it (surface why before duplicating).
- STOP if the purity guard cannot be made to pass with a core registered (means the core still has a DOM/Three/RNG dependency that must be lifted out first).
- STOP if a single window's inline block is large enough that loading it pushes the orchestrator toward the ~40% ceiling; extract that window in its own commit, re-summarize, then continue.
```

## Notes for the planner

This phase is shaped as a three-way fan-out because options, market, and char are independent
inline windows with no shared mutable state, so the proven cold-window template (pure `*_view`
core + thin PainterHost painter, exactly as P6's pilot and FB's Phase 7 established) applies
per-window with adversarial verify. The key risk is silent behavior loss in extraction: options
has the densest control-dispatch surface (every toggle and picker must keep firing the same
action), market must reuse the already-extracted `market_filters` rather than re-derive filtering,
and char's paperdoll has many slots and tooltips, so each slice carries an explicit
behavior-preservation test. It de-risks P9 (the last cold batch, including the one async
leaderboard painter) by proving the PainterHost seam scales to a second batch of varied windows,
and it keeps the per-frame phases (P10+) clean by confirming these windows stay OUT of
`Hud.update()`.
