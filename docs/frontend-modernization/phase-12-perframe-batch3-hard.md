# Phase P12: Per-frame batch 3 (HARD): action bar (multi-bar parameterized), auras pool, minimap markers

Lift the three hardest per-frame HUD elements into pure core + thin painter behind the elision
cache: the action bar (built THROUGH a bar-descriptor seam so a 2nd/3rd bar is later a one-liner,
with its per-frame aria-label + icon + cooldown writes), the buff/debuff auras pool (innerHTML-wipe
to a keyed node pool), and the minimap markers (off-hot-path Set building + a thin canvas painter
keeping the 10Hz gate). This batch carries the three named top-risks: aria-label i18n+a11y+allocation
elision, innerHTML-wipe to keyed-pool listener/tooltip preservation, and the per-frame write-elision
regression. It also introduces the new allocation-budget perf assertion.

## Starter Prompt

```
This is Phase P12 of the Frontend Modernization v0.16.0 packet: Per-frame extraction batch 3
(HARD): action bar (multi-bar parameterized), auras pool, minimap markers.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off
release/v0.16.0).

ULTRACODE: yes. This is a per-frame batch (three independent hot elements, each its own core +
painter + tests). Fan out one slice per element with adversarial verify; the three slices touch
disjoint hud.ts ranges and disjoint new modules, so parallel work is safe and the perf gate is the
shared acceptance.

Goal: Extract the action bar (hud.ts:3829-3931), the buff/debuff auras (renderAuras
hud.ts:4186-4245), and the minimap markers (hud.ts:5022-5258) out of the Hud monolith into pure
cores plus thin painters, each routing every DOM write through the existing write-elision helpers
(hud.ts:1322-1372). The action bar is built THROUGH a BAR DESCRIPTOR seam (the slot set, the keybind
set, the container element) so a 2nd/3rd bar later is "new ActionBarPainter(descriptor)" with no
code change; this phase builds ONLY the existing single bar through that seam (no new bars). The
action-bar painter elides the aria-label via a per-button cache keyed on the rendered t() string
while KEEPING the t() call (no concat, no ?? fallback). The auras painter replaces the __sig +
innerHTML-wipe with a typed keyed per-aura node pool that drops no tooltip or listener, with the
debuff allowlist moved into the core. The minimap core builds the friend/guild/party Sets off the
hot path and collapses the double-scan, feeding a thin canvas painter that keeps the 10Hz gate and
the cached background. Reuse the existing elision helpers and PainterHost from P6; do not re-derive
infra.

STEP 0 - PRE-FLIGHT:
- git status MUST be clean. This worktree may be shared by a concurrent session; if it is dirty,
  STOP and ask the user before touching anything.
- Confirm you are in /Users/fernando/Documents/wocc-v0.16.0 on branch
  feature/frontend-modernization-v016.
- Memory scan: read MEMORY.md and the frontend phase entries, especially
  [Frontend Phase 7 HUD window extraction] (PainterHost seam + the forbiddenUiCoreImport guard +
  the "inject a REAL code line, a // comment is stripped" purity-guard gotcha + run the FULL suite
  for source-guards), [Frontend Phase 8 graphics-tier effects] (two-controller hazard, static
  preset never the governor), and [Phased-packet QA cadence] (phase then its QA, never skip). Note
  [No em dashes or emojis].

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read and summarize, returning a compact brief (not raw dumps):
- docs/frontend-modernization/state.md (locked decisions 3, 5, 9, 10, 12; non-negotiable
  constraints, esp. the action-bar aria-label t()-must-survive rule; decision 9's
  instance-parameterized FAMILY contract (the action bar descriptor-seam, second/third bar is a
  follow-on FEATURE not this phase); decision 10's WCAG 2.2 AA controls + target-size >=24px;
  decision 12's no-magic-values-in-painters; the canonical workflow STEP 0-7; the validation matrix
  incl the PER-FRAME row, the P12 allocation-budget assertion, the WINDOW/CONTROL a11y row, and the
  no-magic-values painter guard; the Review Dispatch Matrix; Top risks 1, 3, 4).
- docs/frontend-modernization/phase-12-perframe-batch3-hard.md (this file).
- The "### P12" section of docs/frontend-modernization/v016-recon-and-packet.md, plus the
  "Load-bearing structural findings" and "Top risks" sections.
- The specific V16 source ranges this phase touches, read narrowly with offset+limit:
  - hud.ts:1322-1372 (the write-elision helpers setText/setDisplay/setTransform/setWidth +
    hotWriteCache) and perfStats() / perfStats counters.
  - hud.ts:3627 (Hud.update frame divider) and how the every-frame / fastHud (>=100ms) /
    mediumHud (>=250ms) / slowHud (>=500ms) tiers gate the three target blocks.
  - hud.ts:3829-3931 (action bar: slot iteration, icon write, cooldown overlay, the per-frame
    aria-label setAttribute via t(); the keybind label; the slot container/element ids the
    descriptor must capture).
  - hud.ts:4186-4245 (renderAuras: the __sig cache, the innerHTML wipe, the debuff allowlist, the
    attachTooltip closures, any click/hover listeners).
  - hud.ts:5022-5258 (minimap: the friend/guild/party Set building, the double-scan, the 10Hz
    cadence gate, the cached background canvas, the marker draw loop).
  - src/ui/painter_host.ts (the P6 dep-bag: icon/money/tooltip helpers + the elided writers).
  - tests/architecture.test.ts (UI_PURE_CORES allowlist + forbiddenUiCoreImport + the
    no-magic-values painter guard) and tests/hud_perf_budget.test.ts + scripts/perf_tour.mjs
    (the P0 baseline + skip-rate counters).
The orchestrator keeps the summary.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
Use ultracode with a Workflow fan-out, one slice per element (three slices). The slices touch
disjoint hud.ts ranges and create disjoint new modules, so run them in parallel; integrate
sequentially into hud.ts at the end (the only shared file). If the combined working set approaches
the ~40% context ceiling, SPLIT this phase per element into P12a/P12b/P12c and execute serially
(the recon pre-flags P10-P13 for per-element splitting).

Slice A - Action bar (hud.ts:3829-3931), built through the multi-bar descriptor seam:
- Add src/ui/action_bar_view.ts: a pure core taking a BAR DESCRIPTOR (the slot set: each slot's
  ability id source; the keybind set: per-slot keybind label; NO DOM in the core, the descriptor
  carries slot identity not element refs) plus IWorld, and returning a REUSED preallocated per-slot
  state array (mutate in place, no per-frame array/object garbage). Each slot state carries the
  ability id, icon key, cooldown remaining/total, usable/range state, the keybind label, and the
  rendered aria-label string (the core resolves the string via the injected t() so the painter
  never concats). The descriptor is the FAMILY parameter (decision 9): the core is instance-free,
  so a 2nd/3rd bar is another descriptor, not a code fork. Register in the UI_PURE_CORES allowlist.
- Add src/ui/action_bar_painter.ts: a thin painter consuming the core via PainterHost, constructed
  as new ActionBarPainter(descriptor) (the descriptor carries the container element + the per-slot
  button elements + the keybind set), so multiplicity is a constructor arg, not a hardcoded id.
  It elides the aria-label via a per-button cache keyed on the rendered t() string (the core
  supplies the string; the painter compares to the cached value and only setAttribute on change).
  KEEP the t() call (no concat, no ?? 'English' fallback, no default param). Elide icon writes
  (cache lastIcon) and cooldown overlay writes (cache cdOverlay) through the host's elided writers.
  No raw el.style / el.textContent / el.setAttribute that the helpers do not own.
- A11y (decision 10, WCAG 2.2 AA): each action button is a proper control (role="button" or a real
  <button>, the elided aria-label, keyboard-activatable, :focus-visible never animated away) with a
  target-size >=24px (or adequate spacing). If the existing markup is already a button, KEEP its
  semantics and only ensure the label/focus/target-size hold; do not regress them.
- No-magic-values (decision 12): the painter drives tokens / CSS custom properties, never a literal
  hex/px/color in TS; any threshold (cooldown sweep cutoff, the 24px target-size floor, dim/usable
  opacity) is a NAMED CONSTANT, not an inline number. The no-magic-values painter guard must pass.
- Add tests/action_bar_view.test.ts: same-input-same-output; the returned array is the SAME
  reference across calls (no realloc); a SECOND descriptor produces an independent core/state (proves
  the family seam, no single-instance global); and an aria-label elision test asserting no per-frame
  setAttribute when the rendered string is unchanged while t() is still invoked.

Slice B - Auras pool (renderAuras, hud.ts:4186-4245):
- Add src/ui/auras_view.ts: a pure core taking IWorld returning the ordered keyed aura list
  (buff/debuff), with the DEBUFF ALLOWLIST moved into the core (it is presentation/domain
  classification, lift it out of the painter). Register in UI_PURE_CORES. Allocation-light: stable
  keys, no per-frame garbage churn.
- Add src/ui/auras_painter.ts: replace the __sig + innerHTML wipe with a typed keyed per-aura node
  pool. Reuse existing DOM nodes keyed by aura key; create on first appearance, recycle on
  disappearance; NEVER innerHTML-wipe. Preserve the attachTooltip closures and any hover/click
  listeners WITHOUT duplicating them on rebuild (attach once per pooled node, update data in
  place). Route stack-count / duration / icon writes through the elided helpers. No-magic-values
  (decision 12): no literal hex/px in the painter; any threshold (duration warn cutoff, max visible
  count) is a named constant.
- Add tests/auras_view.test.ts: same-input-same-output + the debuff allowlist classification. Add a
  painter-level test (or a DOM-light harness) asserting the keyed pool drops no tooltip and does not
  re-attach a duplicate listener across rebuilds.

Slice C - Minimap markers (hud.ts:5022-5258):
- Add src/ui/minimap_markers.ts: a pure core minimapMarkers(world, viewport) -> Marker[] that
  builds the friend/guild/party membership Sets OFF the hot path (cache the Sets, rebuild only on
  roster change, not every marker) and COLLAPSES the existing double-scan into a single pass.
  Register in UI_PURE_CORES. Marker[] is a reused preallocated buffer where feasible (or document
  why a fresh array is acceptable here vs the action-bar/aura budget).
- Add src/ui/minimap_painter.ts (a thin canvas painter): consumes the core; KEEPS the existing
  10Hz cadence gate and the cached background canvas; draws markers via the host. No behavioral
  change to cadence or visuals. No-magic-values (decision 12): the marker colors come from tokens /
  CSS custom properties read once, never inline hex in TS; the 10Hz cadence and any marker-size /
  radius are NAMED CONSTANTS, not inline numbers.
- Add tests/minimap_markers.test.ts: same-input-same-output; single-pass (the friend/guild/party
  Sets are built once per roster, not per marker); membership classification correct.

Then integrate all three into hud.ts: replace the inline blocks at 3829-3931, 4186-4245, and
5022-5258 with calls into the new painters wired through PainterHost (the action-bar painter
constructed with the single existing bar's descriptor), removing the dead inline code and the
ad-hoc __sig cache. Update client_shell.test.ts if any DOM id moved into a painter.

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- Presentation-only. CONSUME V16's already-landed IWorld; do NOT extend IWorld or touch
  src/sim / server / src/net / headless. If you find you need to, STOP and surface it (scope change).
- Per-frame writes route through the existing write-elision cache (hotWriteCache +
  setText/setDisplay/setTransform/setWidth, hud.ts:1322-1372) via PainterHost. No raw
  style/textContent/setAttribute the helpers do not own. No reactivity, Shadow DOM, or signals.
- Pure cores are allocation-light (no per-frame garbage) and DOM/Three-free; no Math.random /
  Date.now / performance.now in any registered core (guarded by tests/architecture.test.ts).
- DECISION 9 (component contract): the action_bar core + painter are INSTANCE-PARAMETERIZED by a bar
  descriptor (no hardcoded element ids, no single-instance assumption). This phase builds ONLY the
  one existing bar through that seam. It does NOT add a second/third bar (that is a follow-on FEATURE
  inheriting this seam; out of scope, see below).
- DECISION 10 (WCAG 2.2 AA chrome): action buttons are proper controls (role/label/keyboard,
  visible :focus-visible, target-size >=24px). The aria-label elision KEEPS the t() call: no concat,
  no ?? 'English' fallback, no default param, no setAttribute('aria-label', ...) outside the elided
  path. New control labels (if any) go in src/ui/i18n.catalog/hud_chrome.ts (English-only); never
  edit i18n.locales/<lang>.ts.
- DECISION 12 (no magic values in painters): the action-bar and minimap painters drive
  tokens / CSS custom properties, never a literal hex/px/color in TS; every threshold and cadence is
  a NAMED CONSTANT. The no-magic-values painter guard must pass.
- No generated-file hand-edits; regenerate via the build.
- Shared worktree: commit with EXPLICIT paths, never git add -A.
- No em dashes, en dashes, or emojis anywhere (code, comments, docs, commits).

Out of scope (do NOT do in this phase):
- ADDING a second/third action bar or any new bar instance: the descriptor seam is built here, but
  actually wiring extra bars / extra slot sets is a follow-on FEATURE that inherits this seam (per
  decision 9), NOT this refactor. Build the one existing bar only.
- FCT pool + per-frame driver (P13).
- Per-element graphics tiering of these elements (FCT/minimap/aura tier knobs) and nameplate
  formalization (P14). This phase keeps the existing 10Hz minimap cadence and existing aura
  visible-count; tiering them per fxLevel is P14.
- xp bar / swing timer / player frame + the unit_frame family core (P10), cast bars / target frame /
  party frames as unit_frame instances (P11).
- Any CSS changes (P1-P4) or ui_effects_profile changes (P5).
- Extending IWorld or any sim/server/net change.

STEP 3 - VALIDATION + REVIEW:
Validation-matrix rows that match (state.md):
- Baseline: npx tsc --noEmit.
- Pure cores added: npx vitest run tests/action_bar_view.test.ts tests/auras_view.test.ts
  tests/minimap_markers.test.ts + npx vitest run tests/architecture.test.ts (UI-purity guard +
  no-magic-values painter guard) + the same-input-same-output assertions.
- WINDOW/CONTROL a11y row (the action buttons are CONTROLS): the WCAG 2.2 AA checks on the action
  buttons (automated axe-core or equivalent over the built bar; keyboard reachability +
  :focus-visible; a forced-colors: active snapshot; target-size >=24px) + the no-magic-values
  painter guard (action-bar + minimap painters reference tokens/vars, not literal hex/px).
- PER-FRAME perf gate: npm run the perf_tour harness (desktop + mobile) and assert
  frameP95 <= the P0 baseline AND hudHotDomSkipRate >= the P0 baseline. PLUS the P12 NEW
  allocation-budget assertion: action-bar + aura per-frame garbage is measurably reduced (use the
  Node-measurable proxy spiked in this phase; if no in-process proxy is viable, document it and fall
  back to perf_tour frameP95 + longtasks per recon open-decision 4).
- A unit test that EACH painter routes ALL writes through the host's elided writers (no raw
  style / textContent / setAttribute), and the aria-label elision test (no per-frame setAttribute
  when unchanged, t() still called).
- Verify the purity guard FAILS when you inject a real DOM/import line into a core (a // comment is
  stripped by stripComments; inject an actual code line).
Review dispatch (Review Dispatch Matrix): qa-checklist only. This is presentation-only; it consumes
the already-landed IWorld in painters, so cross-platform-sync, privacy-security-review, and
migration-safety do NOT fire. Prompt the reviewer for COVERAGE not filtering; do not commit until
it reports no BLOCKING.

STEP 4 - COMMIT CADENCE:
2-5 Conventional Commits, scoped, EXPLICIT paths (no git add -A). Suggested:
- feat(ui): extract action_bar_view core + painter, descriptor-parameterized, elided aria-label
  (src/ui/action_bar_view.ts src/ui/action_bar_painter.ts tests/action_bar_view.test.ts)
- feat(ui): replace auras innerHTML-wipe with keyed pool core + painter
  (src/ui/auras_view.ts src/ui/auras_painter.ts tests/auras_view.test.ts)
- feat(ui): extract minimapMarkers core + thin canvas painter, single-pass Sets
  (src/ui/minimap_markers.ts src/ui/minimap_painter.ts tests/minimap_markers.test.ts)
- refactor(ui): wire action bar, auras, minimap painters into hud.update, drop inline blocks
  (src/ui/hud.ts tests/client_shell.test.ts tests/architecture.test.ts)
- docs(frontend): record P12 in progress.md + state.md ledger
  (docs/frontend-modernization/progress.md docs/frontend-modernization/state.md)

STEP 5 - ACCEPTANCE CRITERIA: see the checklist below.

STEP 6 - DOC UPDATES + MEMORY:
- progress.md: mark P12 done with the new files (action_bar_view/painter, auras_view/painter,
  minimap_markers/painter + tests), the perf-gate numbers vs the P0 baseline, and the
  allocation-budget proxy used.
- state.md: update the phase ledger row P12 to done; add the three new cores to the "Existing pure
  cores to REUSE" list for later phases; note the action-bar descriptor seam is in place (decision 9
  multiplicity ready, extra bars are a follow-on feature); note the allocation-budget proxy decision
  (recon open-decision 4) so P13/P15 reuse it.
- Memory: record any surprising rule (e.g. the exact aria-label elision shape that keeps t(); the
  bar-descriptor seam shape; the keyed-pool listener-once pattern; whether a Node-measurable
  allocation proxy was viable).

STEP 7 - FINAL RESPONSE:
Report status, the files changed (absolute paths), validation results (tsc, the three core test
files, architecture guard incl no-magic-values, the a11y checks on the action buttons, the perf
gate numbers incl the allocation-budget assertion), the qa-checklist verdict, and any deferrals
(adding extra bars + per-element tiering -> follow-on / P14). End with exactly:
Next: phase-13-perframe-batch4-fct.md

STOPPING RULES:
- STOP if any per-frame extraction regresses perf_tour frameP95 above the P0 baseline OR drops
  hudHotDomSkipRate below the P0 baseline; do not commit a perf regression.
- STOP if the action-bar aria-label cannot be elided without dropping the t() call or adding a
  concat / ?? fallback; the t() must survive.
- STOP if the auras keyed pool drops or duplicates a tooltip or listener and you cannot fix it
  inside the pool; do not ship an innerHTML-wipe regression.
- STOP if no Node-measurable allocation proxy is viable AND perf_tour cannot demonstrate the
  garbage reduction; surface it (recon open-decision 4) rather than claim the budget green.
- STOP and surface a scope change if the phase finds it needs to extend IWorld or touch
  sim/server/net, OR if building the descriptor seam tempts you to add a real second bar (that is a
  follow-on feature, not this phase).
- If the working set approaches the ~40% context ceiling, STOP and split into per-element
  sub-phases (P12a/P12b/P12c) before continuing.
```

## Notes for the planner

This phase is shaped as three disjoint per-element slices because it carries three of the packet's
named top-risks (aria-label i18n+a11y+allocation elision, innerHTML-wipe to keyed-pool
listener/tooltip preservation, and the write-elision regression), and isolating them keeps each fix
independently testable and the perf gate the single shared acceptance. The new framing vs the recon
is decision 9 multiplicity: the action bar lands as an instance-parameterized FAMILY (core + painter
take a bar descriptor) so a 2nd/3rd bar later is `new ActionBarPainter(descriptor)`, but this phase
builds ONLY the one existing bar through that seam; adding bars is a follow-on feature. The key risk
is silent correctness loss that tsc and unit tests do not catch: a non-byte-identical cache key
collapsing the skip-rate, a duplicated listener on a rebuilt aura node, or an aria-label that loses
its t() call; the perf gate plus the keyed-pool and elision tests target exactly these, and the
decision 10 a11y checks + decision 12 no-magic-values guard now gate the controls and painters too.
It de-risks P13 (FCT pool) by proving the keyed-pool and allocation-budget patterns on a lower-risk
surface first, and it de-risks P14 by leaving every element here as a clean core+painter (the action
bar already descriptor-parameterized) that P14 can attach a static-preset tier knob to without
re-touching the hot path.
