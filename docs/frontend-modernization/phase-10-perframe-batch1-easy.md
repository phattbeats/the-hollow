# Phase P10: Per-frame batch 1 (EASY): xp bar, swing timer + the unit_frame family core (player as first instance)

Lift the lowest-risk hot HUD elements into pure core + thin write-elided painter, fix the swing-timer
write-elision leak as a measurable perf win, AND introduce the parameterized unit_frame FAMILY (one
core+painter taking a unit descriptor) with the PLAYER frame as its first instance. This is the first
per-frame phase: it proves the core+painter pattern, the perf gate, AND the reusable-family contract
(decision 9) on the safest surface before target/party reuse the same seam in P11.

## Starter Prompt

```
This is Phase P10 of the Frontend Modernization v0.16.0 packet: Per-frame batch 1 (EASY): xp bar,
swing timer + the unit_frame family core (player as first instance).

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off
release/v0.16.0).

ULTRACODE: yes. This is a per-frame batch (three independent hot slices, each its own core+painter
slice) and one of the pre-flagged split-watch phases; fan out one slice per element with adversarial
verify, and gate on the perf harness.

Goal: Move three lowest-risk per-frame hot elements (xp bar, swing timer, player frame) out of the
inline Hud.update() path onto the Humble-Object pattern: a pure, allocation-light core that reads
IWorld plus a thin painter that writes DOM ONLY through the host's elided writers (setText/setDisplay/
setTransform/setWidth, hud.ts:1322-1372). Reuse the EXISTING xpBarView and absorbBarView cores; add
swing_timer.ts; and introduce the PARAMETERIZED unit_frame FAMILY (decision 9): one unit_frame.ts
core + one unit_frame_painter.ts painter that take a UNIT DESCRIPTOR, with the player frame as the
FIRST instance through that seam (NOT a bespoke player_frame core). While here, FIX the known
write-elision leak: the swing-timer block (hud.ts:3800-3827) caches #swingbar via per-frame
querySelector and writes style directly. Routing it through the helpers should IMPROVE
hudHotDomSkipRate, which is the whole reason this is the first per-frame phase.

STEP 0 - PRE-FLIGHT:
- Run git status; it MUST be clean. This is a shared checkout (concurrent sessions). If it is not
  clean, STOP and ask the user before touching anything.
- Confirm you are in the /Users/fernando/Documents/wocc-v0.16.0 worktree on branch
  feature/frontend-modernization-v016.
- Memory scan: read MEMORY.md and the frontend ledger entries. The directly relevant prior-art is FB
  Phase 7 HUD window extraction (the pure-core + painter + PainterHost seam template and the
  purity-guard perturbation gotcha: inject a REAL code line, a // comment is stripped by stripComments),
  FB Phase 8 graphics-tier effects (write-elision + live computed-style proof discipline), and the
  phased-packet QA cadence note (every phase is followed by its own QA pass; never skip).
- This phase depends on P0 (gates + perf baseline recorded) and P6 (PainterHost seam present). Confirm
  both landed: tests/css_corpus.test.ts + the UI-purity allowlist exist, scripts/perf_tour.mjs has a
  recorded baseline, and src/ui/painter_host.ts exists. If P0's perf baseline is not recorded, STOP:
  you cannot run the perf gate.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read and summarize, returning a tight summary (not raw dumps) the
orchestrator keeps:
- docs/frontend-modernization/state.md (locked decisions 3, 5, 9, 10, 12; the non-negotiable
  constraints; the canonical workflow; the validation matrix incl the PER-FRAME row AND the WINDOW/
  CONTROL a11y row AND the no-magic-values painter guard; the Review Dispatch Matrix). Do not re-derive
  these; cite state.md.
- This phase file.
- The '### P10' section of docs/frontend-modernization/v016-recon-and-packet.md, plus the
  "Load-bearing structural findings" and "Top risks" sections (especially risk 1: write-elision
  regression). The recon's '### P11' section describes target/party reusing the same unit_frame seam
  you build here; design the descriptor so P11 needs no core change. (Reference recon sections by
  NAME; its line numbers shifted after the AMENDED note block was inserted near the top.)
- The SPECIFIC V16 source ranges this phase touches, by exact line number:
  - Write-elision helpers + hotWriteCache: hud.ts:1322-1372, and perfStats() (hotDomWrites /
    hotDomSkippedWrites / hotDomSkipRate).
  - Hud.update() frame entry + divider: hud.ts:3627 (every-frame + fastHud >=100ms + mediumHud
    >=250ms + slowHud >=500ms; called from main.ts:2079 offline / 2171 online).
  - Player frame block: hud.ts:3656-3667 (and its absorb-bar use of absorbBarView).
  - Swing timer block: hud.ts:3800-3827 (the #swingbar per-frame querySelector + raw style leak).
  - Xp bar block: hud.ts:3933-3952 (consumes xpBarView).
  - The existing reused cores: xpBarView, absorbBarView (and how hud.ts imports them today).
  - src/ui/painter_host.ts (the PainterHost dep-bag shape from P6: icon/money/tooltip helpers + the
    elided writers).
  - tests/architecture.test.ts UI_PURE_CORES allowlist + forbiddenUiCoreImport (where to register
    new cores).

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
ultracode + a Workflow. Three independent slices, fan out EXPLICITLY (one subagent per element), then
sequentially integrate into Hud.update() (they share the single hud.ts monolith, so integration is
serialized to avoid clobbering edits; use isolation: "worktree" for the parallel slice work if agents
touch overlapping hud.ts regions, then the orchestrator merges).

  - Slice A (xp bar): build xp_bar_painter.ts consuming the EXISTING xpBarView core (do NOT re-derive
    the core). Replace the inline hud.ts:3933-3952 block with a painter call that writes width/text/
    visibility ONLY through setWidth/setText/setDisplay. Any rest/xp label stays a t() key.
  - Slice B (swing timer): add src/ui/swing_timer.ts pure core (IWorld -> swing state: progress,
    visible, mainhand/offhand phase as the inline block computes). Build swing_timer_painter.ts. FIX
    the leak: cache the #swingbar element reference once (not per-frame $()), and route every write
    through the elided helpers, replacing hud.ts:3800-3827. This is the headline leak-fix; the
    skip-rate must improve.
  - Slice C (unit_frame FAMILY, player as first instance): introduce the parameterized family that
    P11 reuses for target and party. Create:
      - src/ui/unit_frame.ts: a PURE, allocation-light core that takes a UNIT DESCRIPTOR (which unit
        + the fields the inline player block at hud.ts:3656-3667 computes: hpFrac, hpText, resFrac,
        resClass, level, name, portraitKey, plus the absorb fraction via the existing absorbBarView).
        The core is INSTANCE-PARAMETERIZED: NO hardcoded #player-frame id, NO single-instance
        assumption. Same descriptor input gives the same output. The descriptor shape must be the one
        target/party can fill in P11 with no core change.
      - src/ui/unit_frame_painter.ts: a THIN, write-elided painter constructed against a frame's
        element set (the player frame's elements for THIS instance), writing hp/resource width+text,
        level, name, portrait, and absorb ONLY through the host's elided writers. The PLAYER frame is
        the first `new UnitFramePainter(playerDescriptor.elements)`; it is NOT a bespoke player_frame
        module. Replace the inline hud.ts:3656-3667 block with the player instance's paint() call.

Register the two NEW cores (swing_timer, unit_frame) in the UI_PURE_CORES allowlist in
tests/architecture.test.ts. Each painter composes the P6 PainterHost (it is the source of the elided
writers + tooltip/icon helpers); painters never reach into Hud private state directly beyond the host
bag.

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- Presentation-only (decision 4). Consume V16's already-landed IWorld; do NOT extend IWorld or touch
  src/sim, server, src/net, or headless. If a slice finds it needs a new IWorld member, STOP and
  surface it (scope change).
- Per-frame routing (decisions 3 and 5): every imperative DOM write goes through the host's elided
  writers (setText/setDisplay/setTransform/setWidth reading hotWriteCache). No raw el.style /
  textContent / setAttribute on the hot path. No reactivity, no Shadow DOM, no signals.
- Component contract (decision 9): the unit_frame core+painter is a parameterized FAMILY, not a
  bespoke per-instance module. The core carries NO hardcoded element id and NO single-instance
  assumption; the player frame is one instance constructed from a descriptor. Building target/party
  instances is P11; do NOT add them here, but the seam must be ready for them with no core change.
- Pure cores stay DOM/Three-free and allocation-light (no per-frame garbage); no Math.random /
  Date.now / performance.now in any registered core. Same input gives same output.
- ACCESSIBILITY (decision 10, WCAG 2.2 AA chrome). The unit frame is a LABELLED GROUP with the right
  role/aria (e.g. group with an accessible name; hp and resource conveyed as TEXT in the frame, never
  color alone, so forced-colors and screen-reader users get meaning). Any focusable control in the
  frame has a visible :focus-visible never animated away; if a frame element is interactive its
  target-size meets SC 2.5.8 (>=24px or adequate spacing). The 3D canvas stays out of a11y scope. The
  full cross-window a11y audit is P15; build the per-frame contract IN here.
- NO MAGIC VALUES IN PAINTERS (decision 12): the painters drive CSS custom properties / tokens, never
  a literal hex / px / color in TS. Any threshold or cadence is a named constant. The no-magic-values
  guard must pass on the new painters.
- i18n: any player-visible label still comes from a t() key; do not concat, do not add a ?? 'English'
  fallback. (No new labels expected; hp/resource/xp text is values not labels. If a label or an
  aria-name is unavoidable, it is a single English-only key in src/ui/i18n.catalog/hud_chrome.ts and
  the action-bar-style elision rule applies: keep the t() call.)
- No em dashes, en dashes, or emojis anywhere.
- Shared worktree: commit with EXPLICIT paths, never git add -A.

Out of scope (do NOT do in this phase):
- Target frame, party frames, cast bars (P11) -> they REUSE the unit_frame family you build here; do
  not build their instances now.
- Action bar, auras pool, minimap markers (P12).
- FCT pool + per-frame driver (P13).
- Per-element graphics tiering / nameplate formalization (P14).
- The consolidated cross-window a11y audit (skip links, global focus management, live regions) (P15).
- Any new IWorld member, sim/server/net change, or CSS rule move.

STEP 3 - VALIDATION + REVIEW:
Run the validation-matrix rows that match (per-frame + pure-core added + a control/frame a11y surface):
- Baseline: npx tsc --noEmit.
- Pure core: npx vitest run tests for swing_timer + unit_frame cores, plus npx vitest run
  tests/architecture.test.ts (the UI-purity guard), plus a same-input-same-output assertion per new
  core. unit_frame: assert the SAME descriptor gives the same output AND that two DIFFERENT descriptors
  (player-shaped vs a target-shaped stub) both drive the core with no id assumptions (proves the family
  is instance-parameterized for P11). Verify the purity guard FAILS when you inject a real DOM-import
  line into a registered core (perturbation must be a real code line, not a // comment which
  stripComments removes).
- PER-FRAME PERF GATE (mandatory): run scripts/perf_tour.mjs desktop AND mobile and assert frameP95
  <= the P0 baseline AND hudHotDomSkipRate >= the P0 baseline. Because the swing writes are now COUNTED
  through the helpers (previously raw and uncounted), the skip-rate should IMPROVE, not merely hold;
  record the new number.
- WINDOW/CONTROL A11Y ROW (the unit frame is HUD chrome): the WCAG 2.2 AA chrome checks over the built
  player frame (axe-core or equivalent: the frame is a labelled group; hp/resource conveyed as text;
  a forced-colors: active snapshot keeps borders/meaning; visible :focus-visible on any focusable;
  target-size >=24px if interactive). Plus the no-magic-values painter guard (the new painters
  reference tokens/vars, not literal hex/px).
- Painter routing test: a unit test asserting each painter routes ALL writes through the host's elided
  writers (no raw style / textContent / setAttribute on the hot path).
Review dispatch: qa-checklist only (presentation-only; no server/net/IWorld surface; consuming the
already-landed IWorld in a painter does NOT change it). Do NOT spawn privacy-security-review,
migration-safety, or cross-platform-sync; none of their trigger rows are touched. Prompt the reviewer
for COVERAGE, not filtering; resume a truncated reviewer per the state.md script. Do not commit until
it reports no BLOCKING.

STEP 4 - COMMIT CADENCE:
2-5 Conventional Commits, scoped, EXPLICIT paths. Suggested:
- refactor(ui): extract xp bar to painter over xpBarView (paths: src/ui/xp_bar_painter.ts,
  src/ui/hud.ts)
- fix(ui): cache #swingbar and route swing-timer writes through elided helpers (paths:
  src/ui/swing_timer.ts, src/ui/swing_timer_painter.ts, src/ui/hud.ts)
- feat(ui): add parameterized unit_frame family, player as first instance (paths:
  src/ui/unit_frame.ts, src/ui/unit_frame_painter.ts, src/ui/hud.ts)
- test(ui): swing/unit_frame core tests + painter no-raw-write guard + frame a11y + UI_PURE_CORES
  allowlist (paths: tests/*, tests/architecture.test.ts)

STEP 5 - ACCEPTANCE CRITERIA (all verifiable and green):
- [ ] npx tsc --noEmit passes.
- [ ] xp bar, swing timer, and the PLAYER frame are each driven by a pure core (xpBarView /
  swing_timer / unit_frame; player frame absorb via absorbBarView) plus a thin painter; the inline
  blocks at hud.ts:3656-3667, 3800-3827, 3933-3952 are replaced by painter calls.
- [ ] The unit_frame core+painter is a PARAMETERIZED FAMILY (decision 9): it takes a UNIT DESCRIPTOR
  (hpFrac, hpText, resFrac, resClass, level, name, portraitKey, absorb), has NO hardcoded #player-frame
  id and NO single-instance assumption, and the player frame is the FIRST instance through it (not a
  bespoke player_frame core). A test drives the core with both a player-shaped and a target-shaped stub
  descriptor (proves P11 reuse needs no core change).
- [ ] The swing-timer leak is fixed: #swingbar is cached once (no per-frame querySelector) and all
  swing writes go through the elided helpers.
- [ ] swing_timer and unit_frame cores are registered in the UI_PURE_CORES allowlist; npx vitest run
  tests/architecture.test.ts passes, and the purity guard provably FAILS on an injected real
  DOM-import line in a registered core.
- [ ] New core unit tests pass with a same-input-same-output assertion; no Math.random / Date.now /
  performance.now in either core.
- [ ] A painter routing test asserts no raw style / textContent / setAttribute on the hot path for all
  three painters.
- [ ] A11Y (decision 10): the player frame is a labelled group with hp/resource conveyed as text (not
  color alone); the forced-colors snapshot keeps borders/meaning; any focusable element has a visible
  :focus-visible and >=24px target-size. The chrome a11y checks pass.
- [ ] NO MAGIC VALUES (decision 12): the new painters drive tokens / CSS custom properties, with no
  literal hex / px / color in TS; the no-magic-values painter guard passes.
- [ ] PERF GATE: scripts/perf_tour.mjs desktop AND mobile show frameP95 <= P0 baseline AND
  hudHotDomSkipRate >= P0 baseline (skip-rate should improve now that swing is counted); the new
  skip-rate is recorded.
- [ ] qa-checklist reviewer reports no BLOCKING.
- [ ] No IWorld / sim / server / net / CSS-rule changes; no new i18n keys (or a single English-only
  hud_chrome.ts key if a label/aria-name was unavoidable).

STEP 6 - DOC UPDATES + MEMORY:
- Update progress.md (mark P10 status, list the new modules, record the new hudHotDomSkipRate).
- Update state.md: ledger row P10 -> done; add src/ui/{xp_bar_painter,swing_timer,swing_timer_painter,
  unit_frame,unit_frame_painter}.ts to the file map; note the two new registered cores in the purity
  allowlist; note that the unit_frame FAMILY is now the seam P11 reuses for target/party; and record
  the perf-gate delta.
- Record any surprising rule in memory (e.g. the exact write-elision cache-key sensitivity, the
  swing-timer phase boundary edge case, or the unit-frame descriptor field set that target/party need).

STEP 7 - FINAL RESPONSE:
Report status, the files changed (absolute paths), the validation results (tsc, core tests,
architecture guard, the frame a11y + no-magic-values guards, the perf_tour frameP95 + skip-rate
numbers vs baseline), the qa-checklist verdict, and any deferrals. End with exactly:
Next: phase-11-perframe-batch2-medium.md

STOPPING RULES:
- STOP if any per-frame extraction regresses frameP95 above the P0 baseline OR drops hudHotDomSkipRate
  below the P0 baseline; do not commit a perf regression, diagnose the raw-write or cache-key cause
  first.
- STOP if the P0 perf baseline is missing (the gate cannot run).
- STOP if the unit_frame core bakes in a #player-frame id or a single-instance assumption (it would
  break P11's target/party reuse); re-shape the descriptor before proceeding.
- STOP and surface it as a scope change if a slice finds it needs to extend IWorld or touch
  sim/server/net.
- STOP if a write cannot be routed through the elided helpers without changing the rendered string (a
  non-byte-identical cache key silently collapses the skip-rate); resolve the key, do not bypass the
  helper.
- If the working set approaches the ~40% context ceiling, SPLIT this phase per-element (it is
  pre-flagged for this) and run the slices as separate sub-phases.
```

## Notes for the planner

This phase is shaped as three independent element slices because xp bar, swing timer, and the player
frame share no state and each reuses or adds one small core, so they fan out cleanly; only the final
integration into the single hud.ts monolith is serialized. It is deliberately first among the
per-frame batches for two reasons. First, the swing-timer block (hud.ts:3800-3827) currently LEAKS the
write-elision cache via a per-frame querySelector + raw style writes, so routing it through the helpers
is a measurable perf WIN rather than a risk (recon "Load-bearing structural findings" section).
Second, the player frame is the cheapest, safest place to stand up the PARAMETERIZED unit_frame FAMILY
(decision 9): one core+painter taking a unit descriptor, with the player as the first instance. P11
then builds target and party as further instances of that exact seam (recon '### P11' section), so
getting the descriptor field set right here (hpFrac, hpText, resFrac, resClass, level, name,
portraitKey, absorb) is the load-bearing decision; a #player-frame id baked into the core would force a
rewrite in P11. The key risk remains write-elision regression (Top risk 1): a painter that produces a
non-byte-identical cache key or bypasses a helper silently collapses the skip-rate, so the routing unit
test plus the skip-rate gate are non-optional. The a11y (decision 10) and no-magic-values (decision 12)
contracts are built IN here per-frame, not deferred wholesale to P15, so the first unit_frame instance
sets the bar every later instance inherits. De-risking the pattern, the family seam, and the gate now
is what makes the medium (P11), hard (P12), and highest-risk FCT (P13) batches tractable.
