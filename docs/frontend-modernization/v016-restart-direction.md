# Frontend Modernization v0.16.0: restart direction and expanded scope

Decision (2026-06-24): adopt Option B from `feasibility-v0.16.0.md`. Restart the refactor on
`release/v0.16.0`. This doc records what "restart" means, the process learnings we are folding
in, and the expanded scope (per-frame extraction + deeper graphics-tier performance). It does
not replace the feasibility verdict; it builds on it.

## What "restart" means (and what it does NOT mean)

- New branch `feature/frontend-modernization-v016` off `origin/release/v0.16.0`.
- KEEP `feature/frontend-modernization` (FB) as a read-only SOURCE, not something to delete or
  reset. Roughly 70% of FB's artifacts port forward file-for-file: the build config
  (`vite.config.ts` is byte-identical on v0.16.0), `.browserslistrc`, the `src/styles/*.css`
  modules, the cold-window pure cores + painters for windows V16 did not independently extract,
  the pure cores (`hud_scale`, `breakpoints`, `ui_effects_profile`), and most tests. "Restart"
  means re-run the EXTRACTION against V16's larger code, reusing FB's actual files wherever they
  still fit. It is NOT a retype-from-scratch.
- Re-author the phase packets. The method transfers; the line-refs, file lists, and per-phase
  scope are stale against V16's 14,377-line `hud.ts` and 17 new `src/ui` modules.

## Process learnings to fold in

1. **Smaller phases (the 40% rule).** Opus 4.8 degrades once context passes roughly 40% of the
   window. Scope each phase so its Explore-summary plus working set stays well under that, and
   SPLIT the heavy ones. On FB the heaviest were Phase 2 (CSS extraction) and Phase 7 (HUD
   extraction); both are larger on V16 and MUST split into per-batch or per-window sub-phases.
   Push heavy extraction through Workflow fan-out so tool output stays OUT of the orchestrator's
   context.
2. **Perf-gated acceptance for hot-path work (new).** Cold-window phases accepted on "world_api
   unchanged + tsc + tests." Per-frame work needs a frame-budget gate (`perf:tour` plus
   before/after frame-time assertions) as a first-class acceptance check, not an afterthought.
3. **Reuse-first phases.** Each ported phase starts by cherry-picking FB's file, then reconciling
   against V16, rather than re-deriving from the monolith.

## Expanded scope (new vs the FB packet)

**A. Per-frame HUD layer extraction (the deliberately-deferred set).** Health/cast bars,
party/target frames, nameplates, minimap, FCT, action bar. Same Humble Object pattern (pure
view-core computed from `IWorld`, thin painter doing the DOM writes), but this is the HOT path,
so the discipline is stricter than for cold windows:
- The pure core must be allocation-light (no per-frame garbage).
- The painter must preserve the existing write-elision (touch the DOM only when a value changed).
- Every element needs a per-frame perf gate.
This makes the per-frame logic unit-testable AND is the enabler for (B). It is a higher risk
class than cold windows, so plan it as its own mini-packet of small, individually perf-gated
phases (one element or small batch each), landed after the cold-window seam is back in place.

**B. Deeper graphics-tier performance (low/medium/high/ultra).** Phase 8 built HUD-effects
tiering (glass/glow/ambient/motion via `ui_effects_profile` -> `data-fx-level`/`--fx-*`). Extend
it to per-element cost-shedding once (A) makes each element a core+painter: tier-aware update
frequency and fidelity (for example simplified nameplates, reduced FCT, lower minimap redraw
cadence at the low tier). Keep the two-controller discipline (the static preset drives UI fx,
never the FPS governor; locked decision #6) and keep it data-driven through `ui_effects_profile`,
not scattered conditionals. (A) and (B) reinforce each other: the extraction is what makes real
per-element tiering possible.

## Proposed re-scoped packet shape (smaller phases; the recon re-prices each)

- P1 to P6 Foundation -> Encapsulation: re-apply; split CSS extraction into 2-3 phases
  (tokens/base; components; entry-specific + new-feature CSS). Roughly 7-8 small phases.
- P7 Cold-window extraction: split per-batch; fold in the vendor reconciliation (adopt V16's
  `vendor_view`/`vendor_window`) and normalize lockpick/delve/raid into the seam. 4-5 sub-phases.
- P8 Graphics-tier HUD effects: re-apply + extend.
- P9+ Per-frame layer extraction (NEW mini-packet): one small perf-gated phase per element/batch.
- P10+ Per-element graphics-tier perf (NEW): tier-aware budgets, built on P9.
- Pn Testing + docs + Biome compliance sweep.

## Sequencing decision (recorded 2026-06-24)

The freeze is NOT a binding constraint (the team is working on other things; this refactor is
the priority). The directive is to do what is absolutely best for the project: this is meant to
be the foundation that lets the game scale, so optimize for correctness and ambition, not speed
to unfreeze.

DECISION: ONE comprehensive packet (port + per-frame extraction + per-element perf tiers), with
an internal ordering that de-risks the ambition by landing each layer on a validated base:
1. Re-establish the proven cold-window seam on v0.16.0 (CSS modernization + cold-window
   extraction + vendor/lockpick/delve/raid reconciliation). This restores the PainterHost seam
   and the graphics-tier HUD effects.
2. Per-frame layer extraction (depends on the seam from 1 being solid), each element gated on a
   frame budget.
3. Per-element graphics-tier perf (depends on the per-frame cores from 2 existing).
Every phase still lands green; the comprehensiveness is in the scope, the safety is in the order.

## Next step

A fresh v0.16.0 frontend recon (Workflow): map V16's current `hud.ts` structure, the per-frame
layer's current shape + per-frame update path + write-elision caches, the graphics-tier system's
current state, and what V16 already extracted. Then re-author the phase packets from that map.
The recon's depth on the per-frame layer and graphics tiers depends on the sequencing decision.
