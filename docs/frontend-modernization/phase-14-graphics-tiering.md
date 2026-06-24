# Phase 14: Per-element graphics tiering + nameplate formalization

Drive each hot-element cost knob (FCT, minimap, auras, party/target cadence) from the STATIC
ui_effects_profile fxLevel, and formalize nameplates into a pure core + painter with a
tier-driven update interval. The static preset is the only controller; the FPS governor is
never read.

## Starter Prompt

```
This is Phase P14 of the Frontend Modernization v0.16.0 packet: Per-element graphics tiering + nameplate formalization.
Model: Opus 4.8, xhigh effort. Harness: Claude Code.
Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).
ULTRACODE: yes. This fans out across several independent hot elements (FCT, minimap, auras, party/target cadence) plus a separate nameplate extraction in src/render; parallel per-element slices + adversarial verify pay off, and every slice is per-frame so each needs the perf gate.

Goal: Now that every hot element is core+painter (P10-P13), make each per-element cost a pure function of the static ui_effects_profile.fxLevel (from P5): FCT max-concurrent / lifetime / drop-non-crit, minimap redraw cadence per tier (10Hz down to 4Hz), aura visible-count and tick granularity, and party/target non-self refresh cadence on low. Separately, formalize nameplates: lift renderer.ts updateNameplates (renderer.ts:4413) into a nameplate_view pure core plus a thin painter, and convert today's mobile-vs-desktop interval into a single tier-driven interval. Every knob reads the static graphicsPresetLabel-derived fxLevel and NEVER governor.state().levels. Ultra must stay byte-equivalent in HUD cost to pre-tiering; low must measurably shed HUD cost with frameP95 still within the P0 baseline on every tier.

STEP 0 - PRE-FLIGHT:
- git status clean. This is a shared checkout; if there are unexpected staged/modified files, ASK before touching anything. Confirm you are on branch feature/frontend-modernization-v016 in /Users/fernando/Documents/wocc-v0.16.0.
- Memory scan: read MEMORY.md, plus [[frontend-phase8-graphics-tier-effects]] (the FB tier resolver + two-controller hazard + paused-vignette special cases), [[frontend-phase9-testing-docs-sweep]] (perf/test cadence), and [[pr901-webgl-context-release]] (mobile-vs-desktop nameplate interval context). The two-controller hazard is the headline risk here.
- Confirm P5 (ui_effects_profile resolver + applier), P12 (action bar / auras pool / minimap markers core), and P13 (FCT pool + per-frame driver) are landed on this branch; P14 tiers the knobs those phases exposed. If any of those cores do not exist yet, STOP: P14 has nothing to tier.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read and summarize, returning a compact brief (not raw dumps):
- docs/frontend-modernization/state.md (locked decisions 6 and 8, the validation matrix PER-FRAME row + perf gate, the two-controller hazard in Top risks, the Tier key-file paths).
- This phase file.
- The "### P14" section of docs/frontend-modernization/v016-recon-and-packet.md, plus "Load-bearing structural findings" and "Top risks" (risk 5 two-controller, risk 1 write-elision).
- The SPECIFIC V16 source ranges P14 touches: ui_effects_profile.ts (the P5 resolver: fxLevel output + tokens); src/render/gfx.ts (graphicsPresetLabel, GFX_BUCKET_BANDS, the ui band governable:false); the P13 FCT pool/driver and fct() at hud.ts:7258-7276 + spawn sites 6100-6422 (for the max-concurrent/lifetime/drop-non-crit knobs); the P12 minimap core/painter (hud.ts:5022-5258, the 10Hz gate) and auras core/painter (renderAuras hud.ts:4186-4245, visible-count); the party-frames painter (hud.ts:11508-11562) and target frame (hud.ts:3672-3749) for non-self cadence; renderer.ts updateNameplates at renderer.ts:4413 and the existing nameplate pure cores in src/render.
The orchestrator keeps the summary.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
ULTRACODE Workflow, parallel fan-out, one slice per independent knob/element. Slices:
  Slice A - FCT tiering: route the P13 FCT painter's pool cap, per-text lifetime/TTL, and drop-non-crit gate from fxLevel (low sheds non-crit text, caps max-concurrent tighter, shortens TTL). Pure tier->knob mapping lives in a small host-agnostic function; the painter consumes it. Touches the P13 pool/driver.
  Slice B - Minimap cadence: convert the P12 minimap painter's fixed ~10Hz redraw gate (hud.ts:5022-5258) into a tier-driven cadence (10Hz at ultra/high down to ~4Hz at low). The marker pure core is unchanged; only the painter's redraw interval reads fxLevel.
  Slice C - Auras tiering: drive the P12 aura painter's visible-count cap and tick granularity from fxLevel (low shows fewer auras / coarser tick). The debuff allowlist already moved into the core in P12; here only the count/granularity is a function of fxLevel.
  Slice D - Party/target cadence: on low fxLevel, slow the NON-SELF party-frame (hud.ts:11508-11562) and target-frame (hud.ts:3672-3749) refresh cadence; self/player stays full-rate. Cadence is a pure function of fxLevel.
  Slice E - Nameplate formalization: extract renderer.ts updateNameplates (renderer.ts:4413) into a nameplate_view pure core (reuse the existing src/render nameplate cores) + a thin painter; replace the mobile-vs-desktop interval with a single tier-driven interval read from fxLevel.
Each tier->knob mapping is a PURE function of fxLevel that a Vitest imports directly; the painter is a thin consumer. Where two slices want the same mapping shape, follow rule-of-three: do not pre-abstract, but a single small tier-knobs module is acceptable if three or more knobs share it. Request the fan-out explicitly; use isolation: "worktree" only if two slices edit the same painter file.

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- Two-controller hazard (locked decision 6 + 8, Top risk 5): EVERY knob reads the static graphicsPresetLabel-derived ui_effects_profile fxLevel; NEVER governor.state().levels. The ui gfx bucket stays governable:false. Assert by import-absence (no governor import in the tier mapping) AND a behavioral test.
- Presentation-only: consume the already-landed IWorld; do NOT extend IWorld or touch src/sim, server, src/net, headless. If a knob seems to need new world state, STOP (scope change).
- Per-frame write-elision (locked decision 3/5, Top risk 1): every painter write still routes through the host's elided writers (setText/setDisplay/setTransform/setWidth via hotWriteCache); changing a cadence must not introduce a raw style/textContent/setAttribute write or a non-byte-identical cache key.
- Determinism: the tier-knob mapping and nameplate_view core are pure, DOM/Three-free, no Math.random/Date.now/performance.now (the FCT painter may keep its jitter; the cores may not).
- i18n: no new player-visible strings expected; data-fx-level + --fx-* are INTERNAL (no t()). If a label is unavoidable, English key in src/ui/i18n.catalog/hud_chrome.ts, never i18n.locales.
- ASCII only: no em dashes, en dashes, or emojis in code, comments, or docs.
- Shared worktree: commit with EXPLICIT paths, never git add -A.

Out of scope (do NOT do in this phase):
- Re-extracting any hot element into core+painter (that was P10-P13; here you only tier the knobs they exposed). Do not invent new cores beyond nameplate_view.
- The ui_effects_profile resolver/applier or the CSS --fx-* tokens (P5; here you consume fxLevel, you do not change how it is resolved).
- The standing hud_perf_budget.test.ts and the client_shell grep updates for moved DOM ids (P15).
- Any FPS-governor change or new gfx bucket; the ui band governable:false is fixed.

STEP 3 - VALIDATION + REVIEW:
Run the validation-matrix rows that match (state.md):
- Baseline: npx tsc --noEmit.
- Pure core added/changed: npx vitest run on the new tier-knobs core test(s) + the nameplate_view core test + npx vitest run tests/architecture.test.ts (the UI-purity guard; register nameplate_view and the tier-knobs core in the UI_PURE_CORES allowlist) + a same-input-same-output assertion per pure function.
- PER-FRAME phase (this is P14): run the perf_tour harness and assert frameP95 <= the P0 baseline AND hudHotDomSkipRate >= the P0 baseline, on EVERY tier (run perf_tour at low, high, ultra). Add the phase-specific assertions: low tier shows measurably reduced HUD cost vs ultra; ultra is byte-equivalent in HUD cost to pre-tiering (no new per-frame work on ultra). Keep the unit test that the touched painters route ALL writes through the host's elided writers (no raw style/textContent/setAttribute).
- Two-controller assertions: an import-absence test that the tier-knob mapping never imports the governor, plus a behavioral test that flipping the static preset (not the governor) is the only thing that changes a knob.
Review dispatch (state.md matrix): qa-checklist only. This is presentation-only and touches no server/net/admin/IWorld/sim, so privacy-security-review, migration-safety, and cross-platform-sync do NOT fire. Prompt the reviewer for COVERAGE, not filtering; do not commit until it reports no BLOCKING. If a reviewer truncates, resume with the state.md one-liner.

STEP 4 - COMMIT CADENCE: 2 to 5 Conventional Commits with a scope and EXPLICIT paths. Suggested:
- feat(ui): tier FCT pool cap, TTL, and drop-non-crit from static fxLevel
- feat(ui): tier minimap redraw cadence and aura visible-count from fxLevel
- feat(ui): slow non-self party/target refresh on low tier
- feat(render): extract nameplate_view core + tier-driven nameplate interval
- test(ui): tier-knob purity + import-absence + per-tier perf gate

STEP 5 - ACCEPTANCE CRITERIA: see the checklist below; every item must be green before you call the phase done.

STEP 6 - DOC UPDATES + MEMORY:
- Update docs/frontend-modernization/progress.md (P14 row: status, the new files, the per-tier perf numbers) and state.md (mark P14 done in the ledger, note the tier-knobs module + nameplate_view + their purity-allowlist registration, record the recorded low/high/ultra frameP95 deltas).
- Record surprising rules in memory: which knobs actually moved the perf needle on low, any paused/edge special case (the FB paused-vignette lesson), and any place the static-vs-governor wiring was tempting to cross.

STEP 7 - FINAL RESPONSE: status, files changed (absolute paths), validation results (tsc, vitest, the per-tier perf_tour numbers, the import-absence + behavioral two-controller tests), reviewer verdict, deferrals, and end with: Next: phase-15-accessibility.md

STOPPING RULES:
- STOP if tiering a knob regresses frameP95 above the P0 baseline on ANY tier, or drops hudHotDomSkipRate below the baseline; revert that slice and report.
- STOP if ultra is no longer byte-equivalent in HUD cost to pre-tiering (a tier branch added per-frame work on ultra); the tier branch must be a no-op at ultra.
- STOP if any knob cannot be driven without reading governor.state().levels, or if a knob needs new world state; that is a scope change (surface it, do not extend IWorld).
- STOP if nameplate extraction would require touching src/sim/server/net or extending IWorld.
- STOP if the working set approaches the ~40% context ceiling; split P14 per-slice (A-E are independent and split cleanly).
```

## Notes for the planner

P14 is the payoff of the per-frame layer: P10-P13 made every hot element a core+painter, so here
the work is pure knob-wiring plus one remaining extraction (nameplates), not new infrastructure.
It is shaped as independent per-element slices because the FCT, minimap, aura, cadence, and
nameplate knobs do not share state and fan out cleanly. The single load-bearing risk is the
two-controller hazard: every knob must read the static preset and never the FPS governor, so the
gate is an import-absence plus behavioral test on top of the per-tier perf gate. De-risking it now
leaves P15 a clean harness-and-close pass with no live tiering logic left to verify.
