# Phase P9: Cold-window extraction batch 3: map, arena, questlog, leaderboard, spellbook

Extract the last five inline classic windows into pure `*_view.ts` cores plus thin painters composed
through the P6 PainterHost. This batch finishes the cold-window seam and lands the one IWorld-painter
fix: `renderLeaderboard` consumes the paged `leaderboard(): Promise<LeaderboardPage>`.

## Starter Prompt

```
This is Phase P9 of the Frontend Modernization v0.16.0 packet: Cold-window extraction batch 3 (map, arena, questlog, leaderboard, spellbook).

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: yes. This is a 5-window batch with independent slices (one window each); fan out parallel subagents + adversarial verify, which is the proven cold-window cadence (P7/P8).

Goal: move the last five inline classic windows out of hud.ts into the Humble-Object shape this packet uses everywhere: a presentation-only `src/ui/<window>_view.ts` pure core (registered in the UI-purity allowlist) that maps IWorld state to a render model, plus a thin painter composed through the P6 PainterHost. This batch carries the single IWorld-painter touch of the packet: `renderLeaderboard` (hud.ts:10673, async) consumes V16's already-landed paged `leaderboard(): Promise<LeaderboardPage>`. The map and arena windows are canvas-drawing windows; the spellbook, questlog, and leaderboard are DOM windows. Preserve every behavior exactly: canvas redraw cadence and cached background for map/arena, async leaderboard paging, questlog rows + tracker linkage, spellbook layout. Presentation-only: do NOT extend IWorld or touch src/sim, server, src/net, or headless.

STEP 0 - PRE-FLIGHT:
- `git status` must be clean. This worktree is a shared checkout; if it is dirty, STOP and ask the user before touching anything.
- Confirm you are in /Users/fernando/Documents/wocc-v0.16.0 on branch feature/frontend-modernization-v016.
- Memory scan: read MEMORY.md plus the FB precedents that ported the cold-window cores: [[frontend-phase7-hud-window-extraction]] (the canonical pure-core + painter + PainterHost seam; the forbiddenUiCoreImport guard; the sed-clips-interleaved-keeps + run-FULL-suite-for-source-guards lessons), and [[frontend-phase8-graphics-tier-effects]] only for the purity-guard perturbation note. Note the FB lesson: equipItem EXISTS in IWorld but is unused (equip via useItem) - do not wire dead members.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn one Explore agent to read + summarize, returning a compact summary the orchestrator keeps (not raw dumps):
- docs/frontend-modernization/state.md (locked decisions, validation matrix, review dispatch matrix, the canonical workflow, the Key file paths block).
- docs/frontend-modernization/progress.md (the P9 row + the P6/P7/P8 rows for the established seam shape).
- This phase file in full.
- The "### P7-P9 Cold-window extraction" section of docs/frontend-modernization/v016-recon-and-packet.md, plus the "Load-bearing structural findings", "Reuse from FB", and "Top risks" sections.
- The SPECIFIC V16 source ranges this phase touches, read narrowly by line range only:
  - hud.ts updateMapWindow (5561) and renderArenaWindow (5300) - canvas windows.
  - hud.ts renderLeaderboard (10673, async; consumes the paged leaderboard()), renderSpellbook (10766), renderQuestLog (11398).
  - The P6-landed src/ui/painter_host.ts surface (the dep-bag + the elided writers Hud exposes).
  - One already-extracted reference: src/ui/vendor_view.ts + vendor_window.ts (the Humble-Object template) and any P7/P8 *_view.ts already landed in src/ui.
  - The IWorld leaderboard(): Promise<LeaderboardPage> signature in src/world_api.ts (read the type only; do NOT change it).
  - tests/architecture.test.ts UI_PURE_CORES allowlist + forbiddenUiCoreImport guard, and tests/client_shell.test.ts where it greps hud.ts for window DOM ids.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
Ultracode Workflow, five parallel slices (one window each). Each slice produces a pure core + a thin painter + a core test, then the orchestrator integrates sequentially (one window at a time) and runs tsc between integrations (the FB lesson: sed clips interleaved, keeps; verify each splice with tsc). Slices:
  1. MAP window (updateMapWindow, hud.ts:5561): extract map_window_view.ts producing the canvas draw model from IWorld; thin map_window painter doing the canvas draw + keeping the existing redraw cadence and cached background. This is a canvas window - the core is the data/geometry model, the painter owns the 2D context. Watch for shared delve_map_painter (landed P6) call sites - reuse, do not duplicate.
  2. ARENA window (renderArenaWindow, hud.ts:5300): extract arena_window_view.ts (the data model) + thin painter; canvas window, same canvas-context-stays-in-painter split as map.
  3. QUESTLOG window (renderQuestLog, hud.ts:11398): extract questlog_view.ts (rows, completion state, the quest_tracker linkage already pure) + thin painter; preserve row listeners (do not duplicate) and tracker linkage.
  4. LEADERBOARD window (renderLeaderboard, hud.ts:10673, ASYNC): extract leaderboard_view.ts mapping a resolved LeaderboardPage to the render model; thin painter that calls IWorld leaderboard() and renders the page. THIS slice carries the one IWorld-consume touch of the packet: consume the paged leaderboard(): Promise<LeaderboardPage> exactly as V16 already exposes it. Preserve async paging (page controls, in-flight/empty states).
  5. SPELLBOOK window (renderSpellbook, hud.ts:10766): extract spellbook_view.ts (the spell/ability grid model from IWorld) + thin painter; preserve layout and icon resolution via the PainterHost icon helper.
Register every new *_view.ts core in the tests/architecture.test.ts UI_PURE_CORES allowlist. Each painter composes through the P6 PainterHost (icon/money/tooltip helpers + the elided writers); do NOT invent a new seam.

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- PRESENTATION-ONLY (locked decision 4): consume V16's already-extended IWorld; the ONLY changed signature consumed is leaderboard(): Promise<LeaderboardPage>. Do NOT extend IWorld or touch src/sim, server, src/net, or headless. If a slice finds it needs to, STOP and surface it (scope change).
- Determinism / purity: every *_view.ts core is DOM/Three-free and has NO Math.random / Date.now / performance.now. The architecture purity guard (forbiddenUiCoreImport / UI_PURE_CORES) enforces this - the core must not import three, a *_painter, painter_host, or DOM globals.
- PainterHost is a THIN compose-in host (locked decision: bespoke deps compose into it, not a unified bag they migrate onto). The new painters CONSUME the P6 host, they do not reshape it.
- i18n: any new player-visible label is a t() key in src/ui/i18n.catalog/hud_chrome.ts (English-only). Never edit i18n.locales/<lang>.ts. (Expectation: none new; these windows already have their strings - keep the existing t() calls.)
- No em dashes, en dashes, or emojis anywhere (code, comments, commits).
- Shared worktree: commit with EXPLICIT paths, never git add -A.

Out of scope (do NOT do in this phase):
- Per-frame / hot-path extraction (xp bar, swing timer, player/target frames, cast bars, party frames, action bar, auras, minimap markers, FCT) - those are P10-P13. These five windows are COLD (open-on-demand) windows; do not touch hud.update()'s per-frame path.
- Per-element graphics tiering / fxLevel knobs - P14.
- Any IWorld extension, sim/server/net change, or new wire field. The leaderboard paging member already exists; consume it, do not modify it.
- CSS extraction for these windows (landed P3). Do not move CSS here.

STEP 3 - VALIDATION + REVIEW:
Validation-matrix rows that match (state.md):
- Baseline: `npx tsc --noEmit`.
- Pure core added (each of the 5): `npx vitest run tests/<core>.test.ts` for each new *_view core + `npx vitest run tests/architecture.test.ts` (the UI-purity guard) + a same-input-same-output assertion per core. Run the FULL suite at the end (FB lesson: source guards need the full suite to catch a perturbation, and a // comment is stripped by stripComments so any guard-perturbation proof must inject a REAL code line).
- DOM ids moved: `npx vitest run tests/client_shell.test.ts` (it greps hud.ts for the window DOM ids now living in painters; update its expectations for the moved ids).
- Whole-suite + build: `npm test` and `npm run build` (all 4 entries) green.
This is presentation-only and consumes an already-landed IWorld member, so per the Review Dispatch Matrix NO cross-platform-sync / privacy-security / migration row fires. Review dispatch: qa-checklist only (the default). Prompt it for COVERAGE not filtering; do not commit until it reports no BLOCKING. If a reviewer truncates, resume with the state.md resume line.

STEP 4 - COMMIT CADENCE:
2-5 Conventional Commits, scoped, EXPLICIT paths (never git add -A). Suggested split:
- `feat(ui): extract map and arena windows to view cores + painters` (src/ui/map_window_view.ts, src/ui/arena_window_view.ts, painters, hud.ts splice, tests).
- `feat(ui): extract questlog and spellbook windows to view cores + painters` (src/ui/questlog_view.ts, src/ui/spellbook_view.ts, painters, hud.ts splice, tests).
- `feat(ui): extract leaderboard window consuming paged leaderboard()` (src/ui/leaderboard_view.ts, painter, hud.ts splice, leaderboard core test).
- `test(ui): register batch-3 cores in UI-purity allowlist; update client_shell ids` (tests/architecture.test.ts, tests/client_shell.test.ts).
- `docs(frontend): mark P9 complete in progress.md + state.md ledger`.

STEP 5 - ACCEPTANCE CRITERIA: see the checklist below; every item must be green before the phase is done.

STEP 6 - DOC UPDATES + MEMORY:
Update progress.md (mark P9 done, list the 5 new cores + painters, note the cold-window seam is now complete) and the state.md phase ledger (P9 -> done; note leaderboard() is the only IWorld member consumed-new in the whole packet, and it is consumed not changed). Record any surprising rule in memory (e.g. a canvas-window split gotcha, or a client_shell id grep that needed widening).

STEP 7 - FINAL RESPONSE: report status, the new files (absolute paths), validation results (tsc, per-core tests, architecture guard, client_shell, full npm test, build), the qa-checklist verdict, any deferrals, and end with: "Next: phase-10-perframe-batch1-easy.md".

STOPPING RULES:
- STOP and surface a scope change if any slice finds it needs to EXTEND IWorld or touch src/sim / server / src/net / headless (presentation-only is a hard line; consuming leaderboard() is allowed, changing it is not).
- STOP if a canvas window (map/arena) cannot be split without the core touching a 2D context or a DOM global - the canvas context MUST stay in the painter; if the data model cannot be made DOM-free, surface it rather than weakening the purity guard.
- STOP if the purity guard cannot be made to pass for a core without removing it from the allowlist - the allowlist is the contract, not a place to except a leaky core.
- STOP if extracting a window would change observable behavior (lost row listener, broken async paging, dropped canvas redraw) you cannot preserve in the painter; report it rather than shipping a regression.
```

## Notes for the planner

This phase is shaped as a five-window parallel batch because each window is independent and the
Humble-Object split (pure `*_view.ts` core plus thin PainterHost painter) is already proven by P6's
pilot and the P7/P8 batches, so ultracode fan-out with sequential tsc-checked integration is the
right tool. The key risk is the two canvas windows (map at 5561, arena at 5300): the recon flags
them as "canvas windows", so the load-bearing discipline is keeping the 2D context in the painter
and making the core a pure data/geometry model, which the purity guard enforces. The one
genuinely-novel touch is the async leaderboard slice consuming `leaderboard(): Promise<LeaderboardPage>`,
the single new-IWorld-member-consumed in the whole packet (consumed, never changed). Completing this
batch de-risks the rest of the packet by closing the entire cold-window seam, so P10-P13 face only
the hot per-frame layer with no inline cold windows left to disturb.
