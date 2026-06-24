# Phase P6: PainterHost seam + cold-window pilot

Re-introduce the FB `PainterHost` dep-bag as a THIN shared host that V16's already-tested bespoke
windows (vendor, lockpick, raid_lockout) COMPOSE into, then prove the seam by extracting the first
new painter (`delve_map_painter`) and deduping the two inline delve call sites. This is the pilot
that de-risks the cold-window batches P7-P9.

## Starter Prompt

```
This is Phase P6 of the Frontend Modernization v0.16.0 packet: PainterHost seam + cold-window pilot.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: no. This is a small surgical seam phase (one new host module + 3 windows adopting it +
one new painter and a dedupe). It does not warrant deterministic Workflow fan-out; a couple of
parallel Explore/Agent slices are enough.

Goal: Define `src/ui/painter_host.ts`, a thin shared dependency-bag exposing the icon/money/tooltip
helpers plus the elided writers `Hud` already owns (the `setText`/`setDisplay`/`setTransform`/
`setWidth` family at `hud.ts:1322-1372`). Have V16's existing bespoke windows COMPOSE their current
deps onto it (locked decision 8: a thin host the bespoke bags wrap, NOT a unified bag they migrate
onto), so the already-tested vendor (incl sell-junk), lockpick, and raid_lockout windows keep their
behavior. Then extract `src/ui/delve_map_painter.ts` from the two inline delve render sites and
delete the duplication. Presentation-only: consume V16's already-landed `IWorld`, do not extend it.

STEP 0 - PRE-FLIGHT:
- `git status` must be clean. This is a shared checkout; if it is dirty, STOP and ask the user
  before touching anything (a concurrent session may be mid-edit).
- Memory scan: read MEMORY.md plus the relevant entries:
  - [[frontend-phase7-hud-window-extraction]] (FB's PainterHost seam + the cold-window core+painter
    template + the purity-guard hardening that rejects a pure core importing a *_painter/painter_host).
  - [[frontend-architecture-vanilla-stack]] (the packet shape + worktree).
  - [[phased-packet-qa-cadence]] (phase -> its phase-NN-qa.md -> next).
  - [[pr901-webgl-context-release]] (delve "movement stick"/joystick vocab, only if any label surfaces).
- Confirm you are in the `feature/frontend-modernization-v016` worktree on the right branch.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read and summarize:
- `docs/frontend-modernization/state.md` (locked decisions, the canonical workflow, the validation
  matrix, the Review Dispatch Matrix, the key file paths).
- this phase file.
- the `### P6` section of `docs/frontend-modernization/v016-recon-and-packet.md` (the authoritative
  scope) plus the "Load-bearing structural findings" and "Top risks" sections.
- the SPECIFIC V16 source ranges this phase touches (read ONLY these ranges, not the whole files):
  - the elided writers + cache: `hud.ts:1322-1372` (`setText`/`setDisplay`/`setTransform`/`setWidth`
    + `hotWriteCache`) and `perfStats()` near it.
  - `renderVendor` at `hud.ts:8126` (ALREADY delegates to `vendor_window.ts`/`vendor_view.ts`; this
    is the template to follow, incl sell-junk) and its `VendorWindowDeps` shape.
  - the lockpick window: `src/ui/lockpick_window.ts` + `lockpick_panel.ts` and its deps.
  - the raid lockout: `src/ui/raid_lockout_view.ts` and where `hud.ts` calls it.
  - the two inline delve call sites to dedupe: minimap `hud.ts:5034-5106` and world-map
    `hud.ts:5584-5645`, plus the existing `delve_map` core they should both call through.
The orchestrator keeps the summary (file names, the real deps each window needs, the exact two
delve hunks), not raw dumps.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
Lightest tool: a short sequential build with two parallel read slices, no Workflow.
- Slice A (define the host): write `src/ui/painter_host.ts`. It is a THIN dep-bag interface +
  factory that exposes exactly: the icon helper, the money/format helper, the tooltip-attach helper,
  and the four elided writers Hud owns (`setText`/`setDisplay`/`setTransform`/`setWidth`) bound to
  Hud's `hotWriteCache`. No window-specific logic lives here. It is the shared base the bespoke
  window dep-bags (`VendorWindowDeps` etc.) COMPOSE into; it does NOT replace them.
- Slice B (adopt, 3 windows, can fan out one agent per window since they touch different files):
  - vendor: adopt V16's `vendor_window`/`vendor_view` AS-IS (do not re-derive); have its deps
    compose `PainterHost`. Keep sell-junk exactly. Call site `hud.ts:8126`.
  - lockpick: `lockpick_window`/`lockpick_panel` compose `PainterHost`; behavior unchanged.
  - raid_lockout: `raid_lockout_view` consumes `PainterHost` where it builds DOM.
- Slice C (the pilot painter + dedupe): extract `src/ui/delve_map_painter.ts` that paints from the
  existing `delve_map` pure core through `PainterHost`, then replace BOTH inline delve render sites
  (minimap `hud.ts:5034-5106`, world-map `hud.ts:5584-5645`) with calls to it. Delete the
  duplicated inline drawing. Add `tests/delve_map_painter.test.ts`.

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- PRESENTATION-ONLY (locked decision 4): consume V16's already-extended `IWorld` only. Do NOT
  extend `IWorld` or touch `src/sim`/`server`/`src/net`/`headless`. If you find you need to, STOP
  and surface it as a scope change.
- PainterHost is a THIN compose-in host (locked decision 8), not a unified bag the windows migrate
  onto. Minimize churn to the already-tested vendor/lockpick/raid windows.
- The four elided writers stay the single write path: anything PainterHost paints to the DOM routes
  through `setText`/`setDisplay`/`setTransform`/`setWidth` (the write-elision cache), never raw
  `style`/`textContent`/`setAttribute`. (This phase is cold-window, but the host contract it
  defines is what the per-frame phases P10-P13 depend on; keep it honest.)
- Determinism: `delve_map_painter` and any core stay DOM-free where they are cores; no
  `Math.random`/`Date.now`/`performance.now` in a registered pure core. The painter may touch the DOM.
- i18n: any NEW player-visible label goes in `src/ui/i18n.catalog/hud_chrome.ts` (English-only) via
  `t()`. Do not edit `i18n.locales/<lang>.ts`. None expected here (reusing existing windows).
- No em dashes, en dashes, or emojis anywhere (code, comments, docs, commits).
- Shared worktree: commit with EXPLICIT paths, never `git add -A`.

Out of scope (do NOT do in this phase):
- Extracting any of the 10 still-inline cold windows (talents/social/bags = P7; options/market/char
  = P8; map/arena/questlog/leaderboard/spellbook = P9). P6 only adopts the 3 ALREADY-extracted
  bespoke windows + the delve painter pilot.
- Any per-frame element (xp/swing/player/cast/target/party/action/auras/minimap/FCT = P10-P13).
- The `leaderboard()` paged-painter consume (P9). The effects resolver/applier (P5). Per-element
  tiering or nameplate formalization (P14).
- Any CSS work (P1-P4).

STEP 3 - VALIDATION + REVIEW:
Run the validation-matrix rows that match (a pure core/painter added + tests):
- `npx tsc --noEmit` (baseline, every phase).
- `npx vitest run tests/delve_map_painter.test.ts` (new) + the existing window tests
  (`vendor_window`/`vendor_view`, `lockpick`, `raid_lockout_view`) must stay green.
- `npx vitest run tests/architecture.test.ts` (the UI-purity guard: the new painter must not break
  it; a pure core must not import `painter_host`/a `*_painter`).
- `npx vitest run tests/client_shell.test.ts` if any DOM id moved into the painter.
- A same-input-same-output assertion for the `delve_map` core path (both call sites produce the
  identical paint from the same world+viewport).
- No PER-FRAME perf gate this phase (P6 is cold-window; the perf gate begins at P10). Do NOT skip it
  later: the host contract defined here is what those gates lean on.
Review dispatch (spawn ONLY the rows the diff touches): `qa-checklist` only. `cross-platform-sync`
should NOT fire (consuming the already-landed IWorld in a painter does not change it);
`privacy-security-review`/`migration-safety` do not apply (no server/net/admin/db/secret/RNG).
Prompt the reviewer for COVERAGE not filtering; do not commit until it reports no BLOCKING.

STEP 4 - COMMIT CADENCE (2-5 Conventional Commits, scoped, EXPLICIT paths):
- `feat(ui): add thin PainterHost dep-bag composing Hud elided writers` -- `src/ui/painter_host.ts`.
- `refactor(ui): compose PainterHost into vendor/lockpick/raid windows` -- `src/ui/vendor_window.ts`
  `src/ui/lockpick_window.ts` `src/ui/raid_lockout_view.ts` (+ the hud.ts call sites only).
- `refactor(ui): extract delve_map_painter and dedupe minimap+world-map delve` -- 
  `src/ui/delve_map_painter.ts` `src/ui/hud.ts` (the 5034-5106 + 5584-5645 hunks).
- `test(ui): cover delve_map_painter and host composition` -- `tests/delve_map_painter.test.ts`.
- `docs(frontend): record P6 PainterHost seam in state/progress` -- the two doc files (STEP 6).

STEP 5 - ACCEPTANCE CRITERIA: see the checklist below.

STEP 6 - DOC UPDATES + MEMORY:
- Update `docs/frontend-modernization/progress.md` (mark P6 done, list new files/tokens).
- Update `state.md`: ledger row P6 -> done; add `src/ui/painter_host.ts` + `delve_map_painter.ts`
  to the key file paths; note the PainterHost contract (the four elided writers + which windows
  compose it) for P7-P13 to reuse.
- Record any surprising rule in memory (e.g. a window dep-bag that could NOT cleanly compose the
  host, or a delve call-site difference between minimap and world-map that the dedupe had to keep).

STEP 7 - FINAL RESPONSE:
Report status (done / blocked), the files touched (absolute paths), validation results (tsc + each
vitest file + purity guard), the qa-checklist verdict, any deferrals, and end with:
Next: phase-07-coldwindow-batch1.md

STOPPING RULES:
- STOP and surface as a scope change if the phase finds it needs to extend `IWorld` or touch
  `src/sim`/`server`/`src/net`/`headless` to make a window compose the host (locked decision 4).
- STOP if a bespoke window's deps cannot compose the thin host WITHOUT migrating it onto a unified
  bag (that would violate locked decision 8); re-confirm the thin-host shape before forcing it.
- STOP if the two delve call sites are NOT actually duplicable (a real semantic difference between
  minimap and world-map paint) rather than papering over it; preserve both behaviors via the painter.
- STOP if adopting a window collapses or bypasses the write-elision path (raw style/textContent
  writes) instead of routing through the host's elided writers.
```

## Notes for the planner

P6 is shaped as a small surgical pilot, not a batch, because the three target windows are ALREADY
extracted on V16 (vendor incl sell-junk, lockpick, raid_lockout) so the real work is just defining
the thin host and proving one new painter (`delve_map_painter`) end to end. The key risk it retires
for P7-P9 is the PainterHost contract itself: locking that the host is a thin compose-in dep-bag
wrapping the elided writers (locked decision 8) means the cold-window batches inherit a validated
seam instead of inventing one mid-batch. The delve dedupe is the low-stakes place to discover any
call-site asymmetry before the higher-churn batches, and it keeps PainterHost honest about routing
every DOM write through Hud's write-elision cache, which is exactly the contract the per-frame
phases P10-P13 depend on.
