# Phase P13: Per-frame extraction batch 4 (HIGHEST RISK): FCT pool + per-frame driver

Replace the event-driven `createElement`+`setTimeout` floating combat text (FCT) with a pure
spawn-descriptor core plus a painter that owns a fixed-size pooled-div ring, projected and
recycled by a NEW per-frame FCT driver folded into `hud.update()`. This is the single highest-risk
per-frame phase: it introduces net-new infra where today there is none.

## Starter Prompt

```
This is Phase P13 of the Frontend Modernization v0.16.0 packet: Per-frame extraction batch 4
(HIGHEST RISK): FCT pool + per-frame driver.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016,
off release/v0.16.0).

ULTRACODE: yes. This is a net-new per-frame subsystem (pool + driver) carrying the worst-case
perf gate (AoE/boss burst). Use ultracode + a Workflow: one slice builds the pure core, one
builds the painter+pool, one wires the driver into hud.update() and migrates the 8 spawn sites,
then an adversarial verify pass over pool lifecycle (drop/duplicate) and the bounded-node gate.

Goal: lift FCT off the per-event createElement+setTimeout path onto the repo's per-frame Humble
Object pattern. A pure spawn-descriptor core (jitter INJECTED, no Math.random in the core) emits
descriptors for each combat-text event; a painter owns a fixed-size pooled-div ring that
positions each live entry every frame via renderer.worldToScreen, recycles entries on TTL, and
caps max-concurrent so an AoE burst can never grow the DOM unbounded. A NEW per-frame FCT driver
(none exists today) folds into hud.update() so the existing `hud` perf bucket and its gate cover
it (no second rAF). Math.random for jitter is allowed ON THE PAINTER only.

STEP 0 - PRE-FLIGHT:
- git status clean. If not clean, ASK the user (this checkout may be shared by a concurrent
  session); do not stash or revert someone else's work.
- Memory scan: read MEMORY.md plus the frontend-modernization entries:
  frontend-architecture-vanilla-stack, phased-packet-qa-cadence, and the prior per-frame batch
  entries P10/P11/P12 if recorded (write-elision + keyed-pool lessons). Also no-em-dashes-or-emojis
  and shared-worktree-commit-care.
- Confirm you are in the feature/frontend-modernization-v016 worktree (branch + path above).

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read and summarize back (the orchestrator keeps the summary, not raw
dumps):
- docs/frontend-modernization/state.md (locked decisions, non-negotiable constraints, validation
  matrix, review dispatch matrix).
- this phase file.
- the "### P13" section of docs/frontend-modernization/v016-recon-and-packet.md, plus the
  "Load-bearing structural findings" and "Top risks" sections (risk #2 is this phase).
- the SPECIFIC V16 source ranges only:
  - the current FCT helper fct() at src/ui/hud.ts:7258-7276.
  - the 8 SimEvent FCT spawn sites at src/ui/hud.ts:6100-6422 (enumerate which events spawn text:
    damage, heal, crit, miss/dodge/parry, xp, etc., and the args each passes to fct()).
  - the per-frame entry Hud.update() at src/ui/hud.ts:3627 (the frame-divider: every-frame +
    fastHud >=100ms + mediumHud >=250ms + slowHud >=500ms) so you know where to fold the driver.
  - the write-elision helpers at src/ui/hud.ts:1322-1372 (setText/setDisplay/setTransform/
    setWidth + hotWriteCache) and perfStats().
  - renderer.worldToScreen (signature + return shape) so the painter can project world points.
  - the existing per-frame painter pattern landed by P10-P12 (how a painter receives PainterHost
    and the elided writers) so this painter matches it.
Apply THE 40% RULE: if loading this set pushes the orchestrator near ~40% context, SPLIT this
phase (e.g. core+driver first, then painter+pool+spawn-site migration) per state.md.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE (ultracode Workflow, fan out explicitly):
Slice A (pure core, src/ui/fct_core.ts):
- A host-agnostic, allocation-light pure core: input is an FCT event (kind + amount/text + world
  anchor + flags like crit/school) plus an injected jitter value (0..1) and any injected
  per-frame clock/dt; output is a spawn DESCRIPTOR (text string already resolved to a t() key
  value by the caller, color/class token, rise distance, ttl, horizontal jitter offset). NO
  Math.random, NO Date.now/performance.now in the core (determinism for cores). NO DOM.
- Register fct_core in the UI_PURE_CORES allowlist (tests/architecture.test.ts).
- Add tests/fct_core.test.ts: same input + same injected jitter => same descriptor; crit vs
  non-crit differs by class token; descriptor ttl/rise are pure functions of kind.
Slice B (painter + pool, src/ui/fct_painter.ts):
- A painter built on the PainterHost seam (P6) + the elided writers. Owns a FIXED-SIZE pooled-div
  ring (preallocated DOM nodes, no per-event createElement). spawn(descriptor) claims a free pool
  slot (or evicts the oldest when at cap); a per-frame step(now) advances each live entry, positions
  it via renderer.worldToScreen routed through the host's elided setTransform/setText/setDisplay
  (no raw style/textContent/setAttribute), and recycles on TTL. Hard cap on max-concurrent; over-cap
  spawns reuse the oldest slot (graceful, never grow the DOM).
- Math.random for horizontal jitter is allowed HERE (painter), feeding the injected value into the
  core. Document that the core stays Math.random-free.
Slice C (driver wiring + spawn-site migration):
- Introduce the per-frame FCT driver by calling fctPainter.step(now) from Hud.update()
  (src/ui/hud.ts:3627) on the EVERY-FRAME tier (FCT must animate every frame); do NOT add a second
  rAF (locked decision: fold into hud.update() so the `hud` perf bucket covers it).
- Migrate the 8 spawn sites (hud.ts:6100-6422): each event now resolves its text (via t() where
  player-visible) and calls fctPainter.spawn(fct_core.describe(event, host.jitter())) instead of
  the old fct() createElement+setTimeout. Remove the dead fct() helper (7258-7276) and any
  setTimeout-based teardown once nothing references it.
Verify pass (adversarial): a fresh subagent reviews the diff for pool lifecycle correctness (no
dropped or duplicated text under rapid spawn; correct recycle on TTL; cap never exceeded) and that
EVERY painter write goes through the host's elided writers.

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- PRESENTATION-ONLY: consume V16's already-landed IWorld; do NOT extend IWorld or touch src/sim,
  server, src/net, or headless. Server authority untouched. If this phase finds it needs to extend
  IWorld, STOP and surface it (scope change).
- Determinism for cores: the FCT CORE has no Math.random/Date.now/performance.now and no DOM; it is
  registered in UI_PURE_CORES. The FCT PAINTER MAY use Math.random for jitter (explicitly allowed).
- Write-elision routing: ALL painter DOM writes go through the host's elided writers
  (setText/setDisplay/setTransform/setWidth via hotWriteCache, hud.ts:1322-1372). No raw
  el.style/textContent/setAttribute on the per-frame path; cache keys stay byte-identical.
- i18n: any player-visible FCT text is a t() key; new control labels (none expected) go in
  src/ui/i18n.catalog/hud_chrome.ts (English-only). Never edit i18n.locales/<lang>.ts.
- Fold the driver into hud.update() (locked decision); NO second rAF.
- No em dashes, en dashes, or emojis anywhere. Commit with EXPLICIT paths, never git add -A.

Out of scope (do NOT do in this phase):
- Per-element graphics tiering of FCT (max-concurrent/lifetime/drop-non-crit per fxLevel) -> P14.
- Nameplate formalization -> P14.
- Any cold-window or CSS work (P1-P9). Any new IWorld member or wire field (none in this packet).
- The standing hud_perf_budget.test.ts and final purity sweep -> P15.

STEP 3 - VALIDATION + REVIEW:
Run the validation-matrix rows that match (state.md):
- Baseline: npx tsc --noEmit.
- Pure core added: npx vitest run tests/fct_core.test.ts + npx vitest run
  tests/architecture.test.ts (UI-purity guard; fct_core in the allowlist, painter NOT) +
  the same-input-same-output (injected-jitter) assertion.
- PER-FRAME perf gate (P10-P14 row): run the perf_tour harness and assert
  frameP95 <= the P0 baseline AND hudHotDomSkipRate >= the P0 baseline. PLUS the P13-specific
  bounded-node-count AoE-burst assertion: a scripted AoE/boss burst shows the live FCT node count
  bounded by the pool cap (never grows unbounded) and frameP95 <= baseline (the old unbounded
  createElement churn is eliminated).
- A unit test that the painter routes ALL writes through the host's elided writers (no raw
  style/textContent/setAttribute on the FCT path).
Review dispatch (only the rows the diff touches): qa-checklist (default; this completes a
deliverable set). privacy-security-review does NOT fire (no server/net/admin; the new Math.random
is on a UI painter, not src/sim or a registered pure core). cross-platform-sync does NOT fire
(IWorld unchanged). migration-safety N/A. Prompt the reviewer for COVERAGE not filtering; resume a
truncated reviewer per the state.md script. Do not commit until it reports no BLOCKING.

STEP 4 - COMMIT CADENCE (2-5 Conventional Commits, scope + EXPLICIT paths):
- feat(ui): add fct_core pure spawn-descriptor with injected jitter
  (src/ui/fct_core.ts, tests/fct_core.test.ts, tests/architecture.test.ts)
- feat(ui): add pooled FCT painter with fixed-size recycling ring
  (src/ui/fct_painter.ts, tests/fct_painter.test.ts)
- refactor(ui): drive FCT per-frame from hud.update and migrate spawn sites
  (src/ui/hud.ts)
- test(ui): perf-gate FCT AoE burst bounded-node count
  (scripts/perf_tour.mjs, tests/hud_perf_budget.test.ts if a row is added here)
- docs(frontend): record P13 in progress.md and state.md ledger
  (docs/frontend-modernization/progress.md, docs/frontend-modernization/state.md)

STEP 5 - ACCEPTANCE CRITERIA (all verifiable + green):
[ ] npx tsc --noEmit passes.
[ ] tests/fct_core.test.ts green: a pure fct_core with INJECTED jitter (same input + same
    injected jitter => same descriptor), no Math.random/Date.now/performance.now, no DOM.
[ ] tests/architecture.test.ts green: fct_core registered in UI_PURE_CORES and passing the
    purity guard; fct_painter is NOT in the allowlist (its Math.random jitter is allowed).
[ ] The painter owns a FIXED-SIZE pooled-div ring (no per-event createElement); the live FCT
    node count NEVER exceeds the pool cap.
[ ] All 8 SimEvent spawn sites (hud.ts:6100-6422) migrated to fctPainter.spawn(...); the old
    fct() helper (7258-7276) and its setTimeout teardown are removed.
[ ] The per-frame FCT driver runs from Hud.update() (every-frame tier); NO second rAF.
[ ] A unit test asserts the painter routes ALL writes through the host's elided writers (no raw
    style/textContent/setAttribute on the FCT path).
[ ] Pool lifecycle: no dropped or duplicated combat text under rapid spawn; correct TTL recycle;
    over-cap spawns reuse the oldest slot.
[ ] Any player-visible FCT text remains a t() key; no new label leaks outside hud_chrome.ts.
[ ] PERF GATE: perf_tour frameP95 <= the P0 baseline AND hudHotDomSkipRate >= the P0 baseline.
[ ] PERF GATE (P13-specific): a scripted AoE/boss burst shows the live FCT node count bounded by
    the pool cap (unbounded createElement churn eliminated) with frameP95 <= baseline.
[ ] qa-checklist reviewer reports no BLOCKING.

STEP 6 - DOC UPDATES + MEMORY:
- progress.md: mark P13 done; record files added (fct_core.ts, fct_painter.ts, tests) and the
  perf_tour AoE-burst numbers vs the P0 baseline.
- state.md: update the ledger row P13 -> done; note the per-frame FCT driver now lives in
  hud.update() (every-frame tier), the painter pool cap value chosen, and that fct() (7258-7276)
  is removed.
- Memory: record any surprising rule (e.g. the exact worldToScreen return shape; the spawn-site
  enumeration; that the core stays Math.random-free while the painter jitters; the pool eviction
  policy under cap).

STEP 7 - FINAL RESPONSE:
Report status, files changed (absolute paths), validation results (tsc, fct_core + architecture
tests, the perf gate numbers incl bounded-node AoE assertion and skip-rate), reviewer verdict,
and any deferrals (tiering of FCT cost knobs -> P14). End with exactly:
Next: phase-14-graphics-tiering.md

STOPPING RULES (phase-specific):
- STOP if the FCT extraction regresses frameP95 above the P0 baseline OR drops hudHotDomSkipRate
  below it; investigate write-elision routing / cache-key byte-identity before proceeding.
- STOP if the AoE-burst node count is NOT bounded by the pool cap (pool lifecycle bug); fix the
  recycle/eviction before committing.
- STOP if pool lifecycle drops or duplicates combat text under rapid spawn; the keyed/slotted pool
  must spawn-without-loss and recycle-without-double.
- STOP if the phase finds it needs to extend IWorld or touch src/sim/server/net (scope change):
  surface it, do not proceed.
- STOP if loading the working set approaches ~40% context: SPLIT into core+driver, then
  painter+pool+spawn-migration (per state.md THE 40% RULE).
```

## Notes for the planner

P13 is isolated last because it is the only per-frame element with NO existing pure core or
painter on V16: today FCT is per-event `createElement`+`setTimeout`, so this phase INTRODUCES new
infra (a descriptor core, a pooled-div painter, and the first per-frame FCT driver). The dominant
risk is pool lifecycle: a recycle or TTL bug silently drops or duplicates combat text, and the
AoE/boss worst-case is exactly the bounded-node perf-gate scenario, so the gate is the real
acceptance bar, not tsc + tests. Folding the driver into `hud.update()` (locked decision) keeps it
inside the already-budgeted `hud` perf bucket rather than adding a second rAF to govern. Landing
this last de-risks P14, which only then turns the pool's cap/lifetime/drop-non-crit knobs into
pure functions of the static `fxLevel`.
