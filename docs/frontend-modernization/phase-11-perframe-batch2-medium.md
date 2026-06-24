# Phase P11: Per-frame batch 2 (MEDIUM): cast bars + target/party as unit_frame instances

Unify the player and target cast bars on the existing castBarState core (adding eat/drink to the
core), and reshape the target frame and the party frames as INSTANCES of the unit_frame FAMILY
landed in P10 (player was its first instance), not bespoke target/party cores. The risk step up
from P10 is the party innerHTML-wipe to keyed-node-pool rewrite plus the target frame's portrait
change-gate and combo-pip lazy-build, any of which can silently drop listeners, tooltips, or
skip-rate.

## Starter Prompt

```
This is Phase P11 of the Frontend Modernization v0.16.0 packet: Per-frame batch 2 (MEDIUM): cast bars + target/party as unit_frame instances.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: yes. This is a batch of three independent hot elements, each a core+painter slice; fan out the slices in parallel and adversarially verify against the perf gate and the no-duplicate-listener test. It is a per-frame batch, the exact case state.md names for ultracode + Workflow, and one of the pre-flagged split-watch phases.

Goal: Move the player and target cast bars, the target frame, and the party frames out of hud.ts onto the repo's per-frame Humble Object pattern (pure allocation-light core from IWorld + thin painter routing every DOM write through the host's elided writers). Two specifics drive this phase:
1. Cast bars: unify BOTH bars on the EXISTING castBarState core, adding eat/drink to the core (so the core, not the painter, owns the cast/channel/eat-drink display state).
2. Target frame and party frames become INSTANCES of the unit_frame FAMILY built in P10 (decision 9), NOT new bespoke target_frame_view/party cores. P10 landed unit_frame as a parameterized core+painter with the player as its first instance; P11 adds the target instance and the party instances. The target instance carries target-only concerns (elite/boss tag, target debuffs via the auras paint, the target cast bar, combo-pip lazy-build, the lastPortraitTarget portrait change-gate); party is N keyed-pool instances over the party container.

No behavior change, presentation-only, with a hard perf gate, WCAG 2.2 AA labelling on the new frames, and token-driven painter values.

STEP 0 - PRE-FLIGHT:
- git status must be clean. This checkout is shared with concurrent sessions; if it is dirty, STOP and ask the user before touching anything.
- Confirm you are in /Users/fernando/Documents/wocc-v0.16.0 on branch feature/frontend-modernization-v016.
- Memory scan: read MEMORY.md and the relevant entries. Relevant: [[frontend-phase7-hud-window-extraction]] (Humble Object pure-core-plus-painter behind PainterHost; the purity-guard perturbation must inject a REAL code line, not a comment, since stripComments removes comments), [[frontend-phase8-graphics-tier-effects]] (write-elision and applier wiring; live computed-style proofs), [[phased-packet-qa-cadence]] (never skip the QA pass after this phase), [[no-em-dashes-or-emojis]], [[shared-worktree-commit-care]], and this packet's state.md locked decisions (esp. 9 component contract / unit_frame family, 10 accessibility, 12 no-magic-values-in-painters).
- This phase depends on P10: confirm the unit_frame family core+painter exist (player is its first instance) and the perf baseline from P0 is recorded; the cast_bar (castBarState), absorbBarView, and selectPartyFrameMembers cores exist on V16. If the unit_frame family or the P0 perf baseline is missing, STOP: P11 builds the target/party instances ON the family and gates against the baseline.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn one Explore agent to read + summarize, returning a compact orchestrator brief (not raw dumps):
- docs/frontend-modernization/state.md (locked decisions 3, 5, 9, 10, 12; the non-negotiable constraints; the per-frame perf-gate row AND the WINDOW/CONTROL a11y row of the validation matrix; the Review Dispatch Matrix; the write-elision file refs).
- This phase file.
- The '### P11' section of docs/frontend-modernization/v016-recon-and-packet.md, plus the "Load-bearing structural findings" and "Top risks" sections (risks 1 and 3 are this phase's).
- The unit_frame FAMILY core+painter as P10 landed it (the parameterized instance shape: how the player instance is constructed, the per-instance descriptor, where the family registers in UI_PURE_CORES) so the target/party instances match it. Do NOT re-derive the family.
- The SPECIFIC V16 source ranges this phase touches, by exact line number:
  - Hud.update() entry + frame divider: src/ui/hud.ts:3627 (every-frame + fastHud >=100ms + mediumHud >=250ms + slowHud >=500ms tiers).
  - Write-elision helpers + cache: src/ui/hud.ts:1322-1372 (setText/setDisplay/setTransform/setWidth + hotWriteCache) and perfStats() (hotDomWrites/hotDomSkippedWrites/hotDomSkipRate).
  - Target frame: src/ui/hud.ts:3672-3749 (incl the elite/boss tag, the target debuffs render, the lastPortraitTarget portrait change-gate, and the combo-pip lazy-build).
  - Target cast bar: the cast-bar block within the target frame at src/ui/hud.ts:3712-3727.
  - Player cast bar: src/ui/hud.ts:3752-3798.
  - Party frames: src/ui/hud.ts:11508-11562 (the inline innerHTML-wipe + per-rebuild click/contextmenu re-attach); the pure selector selectPartyFrameMembers is at src/ui/hud.ts:11520 (already pure, do NOT rewrite it).
  - The existing cores to REUSE: castBarState (render), absorbBarView, selectPartyFrameMembers (party selector), and the unit_frame family from P10. Do NOT re-derive these.
The orchestrator keeps the summary.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
ultracode + a Workflow, three parallel slices (one per element). Because the slices all edit hud.ts, use isolation: "worktree" for the parallel build, then the orchestrator integrates the three diffs sequentially (re-running tsc after each merge) to avoid clobbering.

  Slice A - Cast bars (player + target), unify on castBarState.
  - REUSE the existing castBarState core. Add eat/drink to the core (so the core, not the painter, decides the cast/channel/eat-drink display state); keep it a pure function of IWorld, allocation-light, DOM/Three-free. Same input gives same output.
  - Build a cast_bar painter (src/ui/cast_bar_painter.ts) that drives BOTH the player cast bar (hud.ts:3752-3798) and the target's cast bar within the target frame block (hud.ts:3712-3727), instance-parameterized per decision 9 (the same painter, two instances, no hardcoded element ids). Route width/text/visibility writes through the host's elided writers (setWidth/setText/setDisplay), never raw style/textContent/setAttribute.
  - Painter values are token-driven (decision 12): the cast-vs-channel-vs-eat-drink fill color and any named threshold come from CSS custom properties / named constants, never a literal hex/px in TS.
  - Add tests/cast_bar.test.ts coverage for the new eat/drink branch (same-input-same-output) on top of the existing cast/channel coverage.

  Slice B - Target frame AS a unit_frame INSTANCE (NOT a bespoke target_frame_view core).
  - Construct the target frame as an INSTANCE of the P10 unit_frame family core+painter (the player was the first instance). Pass a target-instance descriptor; do NOT add a parallel target_frame_view module. If the family genuinely cannot express a target-only field without a change, EXTEND the family's instance descriptor (one shared family), do not fork it.
  - The target instance adds target-only concerns layered on the shared frame: the elite/boss tag, the target debuffs (rendered via the auras paint, not re-derived here), the target cast bar (driven by Slice A's painter as the target cast instance), the combo-pip lazy-build (pips built once, then updated, not rebuilt per frame), and the lastPortraitTarget portrait change-gate (portrait redraws ONLY when the target id changes, not every frame).
  - Reuse absorbBarView for the target absorb overlay rather than re-deriving it. All writes through the elided writers; painter values token-driven (decision 12).
  - Tests: extend the unit_frame family core test for the target instance (the target-only fields it now returns), assert the family stays registered in UI_PURE_CORES, and add a target-painter test that the portrait redraws ONLY on a target-id change and the combo pips are built once then updated (no per-frame rebuild).

  Slice C - Party frames as N keyed-pool unit_frame INSTANCES (selector already pure).
  - selectPartyFrameMembers (hud.ts:11520) is already the pure selector; do NOT rewrite it. Build the party-frames PAINTER that renders each party member as a unit_frame family INSTANCE (decision 9: N instances, no single-instance assumption) over the party container, replacing the inline innerHTML-wipe + per-rebuild listener re-attach (hud.ts:11508-11562) with a KEYED node pool: one persistent node per member key, reused across frames, click/contextmenu (and tooltip) attached ONCE per pooled node, never re-attached on rebuild.
  - Hoist the selector allocation to AFTER the per-frame signature short-circuit, so an unchanged party allocates nothing (no selector alloc before the sig check).
  - Add a test asserting the painter does NOT duplicate click/contextmenu (or tooltip) handlers across rebuilds and drops no member-row listener, plus a test that the selector is not allocated before the sig short-circuit.

A11y (decision 10, the WINDOW/CONTROL row): the target frame and each party-member frame get an accessible name (role + aria-label via a t() key; never concat or a ?? fallback). Each party-member frame is keyboard-focusable and a valid click target reachable in tab order, meeting the target-size minimum (SC 2.5.8, >=24px or adequate spacing). The target-change live-region announcement is a CANDIDATE here: implement a single polite live region announcing the new target name if it lands cleanly inside this phase; otherwise DEFER the live region to P15 (the consolidated Accessibility phase) and state that deferral explicitly in the final response. Do NOT make the 3D canvas screen-readable (out of scope, state the boundary).

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- Presentation-only. Consume V16's already-landed IWorld; do NOT extend IWorld or touch src/sim, server, src/net, headless. If a slice finds it needs to, STOP and surface it (scope change). (Extending the unit_frame family's own instance descriptor is in scope; extending IWorld is not.)
- Component contract (decision 9): target and party are INSTANCES of the ONE unit_frame family core+painter, instance-parameterized (no hardcoded element ids, no single-instance assumption), NOT bespoke per-instance modules. Reuse the family, do not fork it.
- Per-frame write-elision (decisions 3, 5): every imperative DOM write goes through the host's elided writers (setText/setDisplay/setTransform/setWidth reading hotWriteCache); the cache keys on the EXACT string, so producing a non-byte-identical key or writing el.style/textContent/setAttribute directly silently collapses the skip-rate. No raw writes in any painter.
- No magic values in painters (decision 12): painter color/size/threshold values are CSS custom properties or named constants, never a literal hex/px/color in TS.
- Determinism for cores: the cast_bar core, the unit_frame family core, and the party selector stay DOM/Three-free with no Math.random/Date.now/performance.now. Same input gives same output.
- Accessibility (decision 10): the new frames are labelled with t() keys; party members are focusable and meet target-size; the canvas stays out of a11y scope.
- i18n: any new player-visible label (frame aria-label, live-region text) is a t() key in src/ui/i18n.catalog/hud_chrome.ts (English-only). Never edit i18n.locales/<lang>.ts. Reuse existing keys where they exist.
- No em dashes, en dashes, or emojis anywhere (code, comments, docs, commits).
- Shared worktree: commit with EXPLICIT paths, never git add -A.

Out of scope (do NOT do in this phase):
- Action bar (multi-bar parameterized), auras pool, minimap markers (P12). (You CONSUME the existing auras render for target debuffs; you do not rewrite the auras pool here.)
- FCT pool + per-frame driver (P13).
- Per-element graphics tiering and nameplate formalization (P14).
- The consolidated cross-window a11y audit + skip links + global focus management (P15); only the per-frame labelling/focus/target-size for THESE frames lands here.
- xp bar, swing timer, player frame, and the unit_frame family itself (P10, already done; you instantiate it, you do not rebuild it).
- Any IWorld extension, sim/server/net edit, or new graphics-governor wiring.

STEP 3 - VALIDATION + REVIEW:
Validation-matrix rows (state.md):
- Baseline: npx tsc --noEmit.
- Pure cores added/changed: npx vitest run tests/cast_bar.test.ts + the unit_frame family core test (target instance) + npx vitest run tests/architecture.test.ts (the UI-purity guard; the family stays in UI_PURE_CORES, and the guard FAILS on an injected REAL DOM-import line in a registered core, not a // comment) + a same-input-same-output assertion per core.
- PER-FRAME perf gate: run the perf_tour harness (scripts/perf_tour.mjs) desktop + mobile and assert frameP95 <= the P0 baseline AND hudHotDomSkipRate >= the P0 baseline (party + target + cast writes are now counted/elided, so skip-rate should hold or improve). Plus a unit test that each painter routes ALL writes through the host's elided writers (no raw style/textContent/setAttribute). Plus the phase-specific bounded assertions: party painter does NOT duplicate click/contextmenu/tooltip (Slice C test), portrait redraws only on target-id change + combo pips built once then updated (Slice B test), no selector alloc before the party sig short-circuit.
- WINDOW/CONTROL a11y row (for the target + party frames): automated axe-core (or equivalent) over the built frames clean; the frames are labelled (t() key); party members keyboard-reachable + target-size >=24px (or adequate spacing); visible :focus-visible never animated away. Plus the no-magic-values painter guard (painters reference tokens/vars, not literal hex/px).
Review dispatch (spawn ONLY matching rows): qa-checklist only. This diff is presentation-only and does not touch server/, src/admin/, src/net/, src/world_api.ts, src/sim/, or migrations, so privacy-security-review, migration-safety, and cross-platform-sync do NOT fire. Prompt the reviewer for COVERAGE, not filtering; resume a truncated reviewer per the state.md script; do not commit until it reports no BLOCKING.

STEP 4 - COMMIT CADENCE:
2-5 Conventional Commits, scoped, EXPLICIT paths. Suggested:
- feat(ui): unify player and target cast bars on castBarState core with eat/drink (src/ui/cast_bar.ts, src/ui/cast_bar_painter.ts, src/ui/hud.ts, tests/cast_bar.test.ts)
- feat(ui): render the target frame as a unit_frame instance with portrait change-gate and combo pips (src/ui/unit_frame*.ts, src/ui/hud.ts, tests/unit_frame*.test.ts, tests/architecture.test.ts)
- feat(ui): keyed-pool party frames as unit_frame instances, hoist selector after sig check (src/ui/party_frames_painter.ts, src/ui/hud.ts, tests/party_frames_painter.test.ts)
- feat(ui): a11y labels + focus + target-size on target and party frames (src/ui/*, src/ui/i18n.catalog/hud_chrome.ts)
- docs(frontend): update progress.md + state.md ledger for P11 (docs/frontend-modernization/progress.md, docs/frontend-modernization/state.md)

STEP 5 - ACCEPTANCE CRITERIA (all verifiable and green):
- [ ] npx tsc --noEmit passes.
- [ ] Both cast bars are driven by ONE cast_bar painter over the castBarState core, instance-parameterized (player + target instances); the core now owns the eat/drink display state; the inline blocks at hud.ts:3752-3798 (player) and 3712-3727 (target) are replaced by painter calls.
- [ ] The target frame and each party-member frame are INSTANCES of the P10 unit_frame family (no bespoke target_frame_view/party core was added; the family is reused, extended only at its instance descriptor if needed).
- [ ] The target instance preserves the lastPortraitTarget portrait change-gate (portrait redraws only on target-id change) and the combo-pip lazy-build (built once, then updated); the elite/boss tag and target debuffs render via the existing paints.
- [ ] The party painter uses a keyed node pool: one persistent node per member key, click/contextmenu/tooltip attached ONCE per node, no per-rebuild re-attach, no dropped member-row listener; a test proves no handler duplication across rebuilds.
- [ ] The party selector is NOT allocated before the per-frame signature short-circuit (hoisted after the sig check); a test proves an unchanged party allocates nothing.
- [ ] Every painter routes ALL writes through the elided writers (no raw style/textContent/setAttribute); a routing test asserts it.
- [ ] No magic values in the new painters: color/size/threshold values are CSS custom properties or named constants; the no-magic-values guard passes.
- [ ] A11y: the target frame and each party-member frame are labelled with a t() key (no concat / ?? fallback); party members are keyboard-focusable, in tab order, and meet target-size >=24px (or adequate spacing); axe-core over the built frames is clean; the target-change live region is either implemented OR explicitly deferred to P15.
- [ ] The cast_bar and unit_frame family cores stay registered in UI_PURE_CORES; tests/architecture.test.ts passes and FAILS on an injected real DOM-import line; no Math.random/Date.now/performance.now in any core.
- [ ] PERF GATE: scripts/perf_tour.mjs desktop AND mobile show frameP95 <= P0 baseline AND hudHotDomSkipRate >= P0 baseline; the new skip-rate is recorded.
- [ ] qa-checklist reviewer reports no BLOCKING.
- [ ] No IWorld / sim / server / net / CSS-rule changes; any new label is a single English-only hud_chrome.ts key.

STEP 6 - DOC UPDATES + MEMORY:
- Update progress.md (P11 row: the new modules, the target/party-as-instances decision, the recorded hudHotDomSkipRate, whether the live region landed or deferred to P15).
- Update state.md ledger (new files: src/ui/cast_bar_painter.ts, src/ui/party_frames_painter.ts, and any unit_frame instance/descriptor additions + the new tests; the eat/drink addition to castBarState; the target/party unit_frame instances; perf-gate result vs baseline; the a11y additions).
- Record surprising rules in memory: any cast-bar eat/drink edge case, the party keyed-pool listener-once pattern, the unit_frame instance descriptor shape for target vs party, any skip-rate movement, the worktree-isolation integration order, and the live-region land-or-defer outcome.

STEP 7 - FINAL RESPONSE:
Report status, files changed (absolute paths), validation results (tsc, the cast_bar + unit_frame family core tests, architecture guard, perf_tour frameP95 + skip-rate vs baseline, the a11y/axe result), reviewer verdict, and deferrals (incl whether the target-change live region landed or moved to P15). End with exactly:
Next: phase-12-perframe-batch3-hard.md

STOPPING RULES:
- STOP if any per-frame extraction regresses perf_tour frameP95 above the P0 baseline OR drops hudHotDomSkipRate below the P0 baseline; do not commit a perf regression, diagnose the raw-write or cache-key cause first.
- STOP if the party keyed-pool rewrite cannot preserve the click/contextmenu/tooltip listeners without duplication, or the target-frame portrait change-gate / combo-pip lazy-build cannot be preserved; surface it rather than ship a listener leak or a per-frame portrait redraw.
- STOP if the target or party frame cannot be expressed as a unit_frame INSTANCE without forking the family into a bespoke core; surface it as a component-contract (decision 9) gap rather than adding a parallel module.
- STOP and surface (scope change) if a slice finds it needs to extend IWorld or touch sim/server/net.
- STOP if the working set approaches the ~40% context ceiling; split this phase per element (cast bars / target frame / party frames) as the recon pre-flags.
```

## Notes for the planner

This phase is the middle rung of the per-frame ladder: harder than P10's leak-fix wins, easier than
P12's multi-bar action-bar aria-label and auras pool. It is shaped as three independent core+painter
slices so the Workflow can fan out, with sequential integration because all three edit hud.ts. The
delta from the earlier framing is decision 9: target and party are now INSTANCES of the ONE
unit_frame family P10 landed (player was its first instance), not bespoke target_frame_view/party
cores. That is the whole point of the family contract, and proving target (one richer instance with
the portrait gate, combo pips, elite/boss tag, target debuffs, and the target cast bar) plus party
(N keyed-pool instances) here is what readies the seam for the focus/raid/boss frames a later FEATURE
adds. The load-bearing risks are risk 3 (the party innerHTML-wipe to keyed-pool rewrite and the
target portrait gate silently dropping listeners, tooltips, or skip-rate) and risk 1 (write-elision
cache-key byte-identity), so the perf gate and the explicit no-duplicate-listener test are
non-optional. Decision 10 (frames labelled, party focusable + target-size) and decision 12
(token-driven painter values) land per-frame here and are consolidated in P15. Getting the keyed-pool
pattern right de-risks the larger auras pool (P12) and the FCT pool (P13), which reuse the same
pooled-node discipline under worse worst-case churn.
