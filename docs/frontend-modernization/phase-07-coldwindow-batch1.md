# Phase P7: Cold-window extraction batch 1: talents, social, bags

Extract three of the ten still-inline classic windows (talents, social, bags) out of the `hud.ts`
monolith into a pure `*_view.ts` core plus a thin painter composed through the PainterHost seam P6
introduced. Presentation-only: consume V16's already-extended `IWorld`, do not touch sim/server/net.

## Starter Prompt

```
This is Phase P7 of the Frontend Modernization v0.16.0 packet: Cold-window extraction batch 1 (talents, social, bags).

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: yes. This is a cold-window batch (3 independent windows), the exact phase shape state.md flags for ultracode + a Workflow (parallel fan-out, one slice per window, plus adversarial verify). The windows touch disjoint hud.ts ranges so they parallelize cleanly.

Goal: Move renderTalents (hud.ts:10909), renderSocial (hud.ts:12025), and renderBags (hud.ts:8839) out of the hud.ts monolith into the FB Humble-Object shape: a pure host-agnostic `*_view.ts` core that derives a render model from IWorld (registered in the P0 UI-purity allowlist), plus a thin painter that paints that model into the DOM through the PainterHost dep-bag from P6 (icon/money/tooltip helpers + the elided writers). Each window is presentation-only: it consumes V16's already-landed IWorld and changes no signature. Preserve the load-bearing behaviors exactly: talentStage gating (which talent tiers/points are spendable), social-list event listeners not duplicated on re-render, and bag filtering (bag_filter is already extracted on V16, reuse it). client_shell.test.ts must be updated for any DOM ids that move from hud.ts into a painter.

STEP 0 - PRE-FLIGHT:
- `git status` must be clean. This is a shared checkout; if it is not clean, STOP and ask the user before touching anything.
- Memory scan: read MEMORY.md and the entries [[frontend-phase7-hud-window-extraction]] (the FB cold-window extraction, the proven core+painter+PainterHost seam pattern, the purity-guard hardening that rejects a pure core importing a *_painter/painter_host, and the sed-clip hazard), [[frontend-phase6-window-encapsulation]] (window @layer/#id isolation), and [[pr741-sunder-armor-display]] (aura stack display) for any prior talents/social/bags notes.
- Confirm you are in the feature/frontend-modernization-v016 worktree (off release/v0.16.0).

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read and summarize, returning a compact brief (not raw dumps):
- docs/frontend-modernization/state.md (locked decisions, non-negotiable constraints, validation matrix, review dispatch matrix, key file paths).
- This phase file (phase-07-coldwindow-batch1.md).
- The "### P7-P9 Cold-window extraction" section of docs/frontend-modernization/v016-recon-and-packet.md plus the "Load-bearing structural findings" + "Top risks" sections.
- The SPECIFIC source ranges this phase touches, with their real V16 line numbers:
  - renderBags: hud.ts:8839 (and the already-extracted bag_filter.ts it must reuse).
  - renderTalents: hud.ts:10909 (find the talentStage gating logic it reads off IWorld).
  - renderSocial: hud.ts:12025 (find where it attaches click/contextmenu/etc listeners to social rows).
  - For the seam: src/ui/painter_host.ts (from P6) and the FB-ported vendor_window.ts/vendor_view.ts as the template the new windows must match.
  - tests/architecture.test.ts UI_PURE_CORES allowlist (where each new *_view core is registered) and tests/client_shell.test.ts (where moved DOM ids are asserted).
The orchestrator keeps the summary, not the raw file dumps. Watch the 40% rule: three windows is the planned batch size; if the working set approaches ~40% context, finish talents+social and split bags into a follow-up slice rather than degrade.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
ultracode Workflow, fan out THREE parallel slices (request fan-out explicitly), one per window, because the three hud.ts ranges are disjoint and the windows share no private state. Use isolation: "worktree" only if two slices would edit the same shared file concurrently (architecture.test.ts allowlist and client_shell.test.ts are shared sink files; have the slices return their allowlist/id edits and let the orchestrator apply them serially, OR isolate). Each slice:
  - Slice A - TALENTS (hud.ts:10909): create src/ui/talents_view.ts (pure core: derive the talent-tree render model from IWorld incl the talentStage gating that decides which tiers/points are spendable, host-agnostic, no DOM/Three) + src/ui/talents_window.ts (thin painter via PainterHost: icon/tooltip helpers + elided writers). Register talents_view in UI_PURE_CORES. Replace the inline renderTalents body with a delegate call. Add tests/talents_view.test.ts (same-input-same-output on the gating model).
  - Slice B - SOCIAL (hud.ts:12025): create src/ui/social_view.ts (pure core: derive the friends/guild/ignore list render model from IWorld) + src/ui/social_window.ts (thin painter). CRITICAL: the painter must NOT duplicate the row click/contextmenu listeners on re-render (the innerHTML-wipe -> listener-churn hazard from the recon Top risks); attach once or use a keyed/delegated pattern. Register social_view in UI_PURE_CORES. Add tests/social_view.test.ts.
  - Slice C - BAGS (hud.ts:8839): create src/ui/bags_view.ts (pure core: derive the bag-grid render model from IWorld) + src/ui/bags_window.ts (thin painter). REUSE the already-extracted bag_filter.ts for filtering, do not re-derive it. Register bags_view in UI_PURE_CORES. Add tests/bags_view.test.ts (filtering preserved).
After fan-out, the orchestrator integrates serially: apply each slice, run tsc after each (the FB lesson: interleaved sed-style clips compile-break silently, so tsc x N), wire the delegate calls in hud.ts, and reconcile the shared sink edits (UI_PURE_CORES allowlist + client_shell.test.ts ids).

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- PRESENTATION-ONLY (locked decision 4): consume V16's already-extended IWorld; do NOT extend IWorld or touch src/sim, server, src/net, or headless. If a window appears to need a new IWorld member, STOP and surface it as a scope change.
- PainterHost is a THIN compose-in host (locked decision, P6): the new windows compose the PainterHost dep-bag (icon/money/tooltip + elided writers); do not invent a new seam.
- Pure cores stay DOM/Three-free and deterministic: no Math.random / Date.now / performance.now in any registered *_view core (guarded by tests/architecture.test.ts + the UI_PURE_CORES allowlist; the purity guard also rejects a pure core importing a *_painter or painter_host).
- i18n: every player-visible label rendered by these windows stays a t() key; any NEW control label goes in src/ui/i18n.catalog/hud_chrome.ts (English-only). Never edit i18n.locales/<lang>.ts. No concat, no `?? 'English'` fallback for labels.
- No em dashes, en dashes, or emojis anywhere (code, comments, commits).
- Shared worktree: commit with EXPLICIT paths, never `git add -A`.

Out of scope (do NOT do in this phase):
- The other 7 inline windows: options/market/char are P8; map/arena/questlog/leaderboard/spellbook are P9 (leaderboard's async paged-leaderboard painter fix is P9, not here).
- Any per-frame / hot-path element (xp bar, frames, bars, action bar, auras, minimap, FCT) = P10-P13. These three windows are COLD (open-on-demand), not per-frame; do not add them to hud.update()'s frame divider.
- CSS extraction for these windows (already handled in the P3 components.css pass); do not move CSS here.
- Per-element graphics tiering (P14). No fxLevel knobs on these windows.

STEP 3 - VALIDATION + REVIEW:
Run the validation-matrix rows that match (state.md "Validation matrix"):
- Baseline: `npx tsc --noEmit`.
- Pure core added (three of them): `npx vitest run tests/talents_view.test.ts tests/social_view.test.ts tests/bags_view.test.ts` + `npx vitest run tests/architecture.test.ts` (UI-purity guard, confirms the three new cores are in UI_PURE_CORES and DOM/Three-free) + a same-input-same-output assertion per core.
- DOM ids moved: `npx vitest run tests/client_shell.test.ts` (update the greps for any id now living in a painter).
- Full pre-commit sanity: `npm test` (the guards live in the suite).
This is NOT a per-frame phase, so there is NO perf gate (no perf_tour, no skip-rate assertion): these windows are cold/open-on-demand, not in hud.update()'s every-frame path.
Review dispatch (state.md Review Dispatch Matrix): spawn qa-checklist only. privacy-security-review / migration-safety / cross-platform-sync do NOT fire (no server/net/IWorld/sim/wire change; consuming the already-landed IWorld in a painter is not an IWorld change). Prompt the reviewer for COVERAGE not filtering; do not commit until it reports no BLOCKING.

STEP 4 - COMMIT CADENCE:
2 to 5 Conventional Commits with a scope and EXPLICIT paths (never `git add -A`). Suggested:
- `refactor(ui): extract talents window to talents_view core + painter` (src/ui/talents_view.ts src/ui/talents_window.ts src/ui/hud.ts tests/talents_view.test.ts).
- `refactor(ui): extract social window to social_view core + painter` (src/ui/social_view.ts src/ui/social_window.ts src/ui/hud.ts tests/social_view.test.ts).
- `refactor(ui): extract bags window to bags_view core + painter` (src/ui/bags_view.ts src/ui/bags_window.ts src/ui/hud.ts tests/bags_view.test.ts).
- `test(ui): register batch-1 view cores in UI_PURE_CORES, update client_shell ids` (tests/architecture.test.ts tests/client_shell.test.ts).
- `docs(frontend): record P7 cold-window batch 1 in progress.md + state.md ledger`.

STEP 5 - ACCEPTANCE CRITERIA:
- [ ] `npx tsc --noEmit` is clean.
- [ ] talents, social, and bags each have a pure `src/ui/<name>_view.ts` core (no DOM/Three import, no Math.random/Date.now/performance.now) and a thin `src/ui/<name>_window.ts` painter composed through PainterHost.
- [ ] All three new view cores are registered in the UI_PURE_CORES allowlist and `npx vitest run tests/architecture.test.ts` passes (purity guard green, incl rejecting a *_painter/painter_host import from a core).
- [ ] tests/talents_view.test.ts, tests/social_view.test.ts, tests/bags_view.test.ts each pass with a same-input-same-output assertion.
- [ ] talentStage gating is preserved: the talents core decides spendable tiers/points identically to the inline version (covered by a test).
- [ ] The social painter does NOT duplicate row click/contextmenu listeners across re-renders (covered by a test or an attach-once design verified in review).
- [ ] Bag filtering is preserved by reusing the existing bag_filter.ts (not re-derived); bags_view test exercises a filtered render.
- [ ] `npx vitest run tests/client_shell.test.ts` passes with any moved DOM ids updated.
- [ ] `npm test` is green.
- [ ] qa-checklist reviewer reports no BLOCKING.
- [ ] hud.ts renderTalents/renderSocial/renderBags are now thin delegates; no IWorld/sim/server/net/headless file changed; no i18n.locales overlay edited.

STEP 6 - DOC UPDATES + MEMORY:
- Update progress.md: mark P7 complete with the new module list (talents_view/window, social_view/window, bags_view/window), the test files, the hud.ts line-count delta, and any deferral.
- Update state.md: flip the P7 ledger row to done; if the UI_PURE_CORES allowlist or client_shell id list grew, note it in the Key file paths / ledger.
- Record surprising rules in memory: any non-obvious talentStage gating coupling, the exact social listener-attach pattern chosen (attach-once vs delegated), whether any window needed isolation: "worktree" to avoid a shared-sink-file clash, and any sed-clip / interleaved-edit hazard hit.

STEP 7 - FINAL RESPONSE:
Report: status (done / done-with-deferral), the files created/changed (absolute paths), validation results (tsc, the three core tests, architecture guard, client_shell, npm test), the qa-checklist verdict, and any deferral. End with exactly:
Next: phase-08-coldwindow-batch2.md

STOPPING RULES:
- STOP and surface a scope change if any of the three windows appears to need a NEW IWorld member or a sim/server/net change (the phase is presentation-only; consuming the landed IWorld is fine, extending it is not).
- STOP if a window cannot be made a pure core + thin painter without leaking DOM/Three into the core (do not weaken the purity guard to make it pass).
- STOP and split the phase if the working set approaches the ~40% context ceiling (finish talents+social, defer bags to a follow-up slice).
- Do NOT touch any per-frame / hot path; if you find yourself editing hud.update()'s frame divider, you are in the wrong phase.
```

## Notes for the planner

P7 is the first of three cold-window batches and inherits the exact Humble-Object shape FB proved
(core + painter + PainterHost), so the work is a port-and-adapt, not a redesign; that is why it is
medium risk and ultracode-parallelizable across three disjoint `hud.ts` ranges. The key risk is the
innerHTML-wipe to listener-churn hazard on the social list (re-attaching click/contextmenu every
render) and preserving talentStage gating exactly; both are caught by a per-window test plus the
purity guard. Landing these three first de-risks P8/P9 by validating the P6 PainterHost seam under
real cold-window load and confirming the UI_PURE_CORES allowlist + client_shell id-move workflow
before the remaining seven windows (including P9's async paged-leaderboard painter) follow.
