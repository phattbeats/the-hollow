# Phase P5: ui_effects_profile resolver + token applier

Re-introduce FB's single governor-independent effects resolver (presetLabel x effectsQuality x
reduceMotion -> {fxLevel, tokens}) and a dumb theme.ts-style applier that sets `data-fx-level` +
`--fx-*`, then wire the extracted CSS (glass/glow/FCT-crit/vignette) to consume those custom props.
Presentation-only, governor-independent; no per-frame work.

## Starter Prompt

```
This is Phase P5 of the Frontend Modernization v0.16.0 packet: ui_effects_profile resolver + token applier.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: no. This is a small surgical phase (one new pure module + one dumb applier + a focused CSS wiring pass over already-extracted files). It is not a batch-heavy CSS or cold-window or per-frame phase, so a single orchestrated pass with one review agent is the right weight. Do not fan out.

Goal: Port FB's `src/ui/ui_effects_profile.ts` as the one static-tier effects resolver: a pure function of (graphicsPresetLabel, effectsQuality, reduceMotion) returning {fxLevel, tokens}. It reads the STATIC preset, NEVER the FPS governor. Honor the locked 'advanced' decision: do NOT collapse 'advanced' to 'high'; honor its effectsQuality slider for a distinct HUD-fx level so the expert path sheds HUD cost independently. Add a dumb theme.ts-style applier that sets `data-fx-level` + `--fx-*` custom props on the document, reconciled with the existing `body.reduce-motion` toggle (main.ts:1236) so the two do not fight. Then wire the `--fx-*` custom props into the CSS extracted in P2/P3 (glass, glow, FCT-crit, vignette). `data-fx-level` and `--fx-*` are INTERNAL, no t().

STEP 0 - PRE-FLIGHT:
- `git status` must be clean. This worktree is a shared checkout; if it is dirty, STOP and ask the user before touching anything.
- Confirm you are in /Users/fernando/Documents/wocc-v0.16.0 on branch feature/frontend-modernization-v016.
- Memory scan: read MEMORY.md and these entries: [[frontend-phase8-graphics-tier-effects]] (the FB resolver/applier shape, the EFFECTS_QUALITY_LOW_CUTOFF shared with gfx.ts, the two-controller hazard, paused-vignette special case, the bucket-set B1-B7 mapping), [[frontend-phase9-testing-docs-sweep]] (gfx.ts shares EFFECTS_QUALITY_LOW_CUTOFF, the deferred render->game leaf import note), [[frontend-architecture-vanilla-stack]] (vanilla stack, --fx-* internal).

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read and summarize: state.md (locked decisions 6 and 8, non-negotiable constraints, validation matrix, review dispatch), this phase file, the "### P5" section of v016-recon-and-packet.md plus open-decision 1 and top-risk 5, and these SPECIFIC V16 source ranges:
- `src/render/gfx.ts`: `graphicsPresetLabel` at line 245 (returns 5 labels: low/medium/high/ultra/advanced; the PRESET_ADVANCED case arm is at 251, the constant itself at gfx.ts:107), `effectsQuality?` field at line 55, `GfxTier` at line 12 (4 labels), `GFX_BUCKET_BANDS` 169+ (the `ui` band is governable:false; do not touch it).
- `src/game/settings.ts`: `reduceMotion` at line 141.
- `src/main.ts`: the existing `body.reduce-motion` toggle at line 1236 (settings('reduceMotion') -> classList.toggle).
- `src/ui/theme.ts`: the applier shape (how it writes `--color-*` custom props at runtime) to mirror for the dumb applier.
- The P2/P3-extracted CSS files (`src/styles/hud.css`, `src/styles/components.css`) where glass/glow/FCT-crit/vignette rules now live (grep for backdrop-filter, the glow box-shadows, the FCT crit selector, the vignette/death overlay).
- FB's `src/ui/ui_effects_profile.ts`, `tests/ui_effects_profile.test.ts`, and the FB applier wiring as the PORT SOURCE (read-only; locate the FB tree, it is the completed feature/frontend-modernization branch/worktree).
The orchestrator keeps the summary, not raw dumps.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE: single orchestrated pass, three sequential slices.
- Slice A (resolver, the core): create `src/ui/ui_effects_profile.ts` as a PURE module: `resolveUiEffectsProfile({presetLabel, effectsQuality, reduceMotion}) -> {fxLevel, tokens}`. fxLevel is the internal HUD-fx level derived from the 5 preset labels collapsed against effectsQuality (advanced HONORS effectsQuality below the shared EFFECTS_QUALITY_LOW_CUTOFF for a distinct level, per locked decision 8 and open-decision 1; do NOT collapse advanced->high). reduceMotion forces motion-related tokens off. tokens is the flat `--fx-*` map the applier writes. Import EFFECTS_QUALITY_LOW_CUTOFF from gfx.ts (do not redefine the cutoff). No DOM, no Three, no governor import (this is the import-absence assertion target). Register it in the P0 `UI_PURE_CORES` purity allowlist.
- Slice B (applier, the dumb host): add a theme.ts-style applier (mirror theme.ts's runtime custom-prop write) that takes the resolved profile and sets `data-fx-level` on the document element + each `--fx-*` token on `:root`. Wire it to run wherever the graphics preset / effectsQuality / reduceMotion settings change. RECONCILE with the existing `body.reduce-motion` toggle at main.ts:1236: the resolver already accounts for reduceMotion, so ensure the two do not double-apply or contradict (single source of truth for motion: route reduceMotion through the resolver+applier, keep the body class only as the CSS hook it already is; do not invent a second motion flag).
- Slice C (CSS consumption): in the P2/P3-extracted CSS, replace the relevant hardcoded glass/glow/FCT-crit/vignette values with `var(--fx-*)` reads so the applier's tokens take effect. Keep JS-written custom props as `:root` defaults (a sensible default when the applier has not run). Match the FB bucket-set mapping (B1 glass / B2 vignette + ambient / B4 glow / B6 FCT crit) from memory [[frontend-phase8-graphics-tier-effects]]; honor the paused-vignette special case (paused vignette holds the 55% 0%-keyframe, not full tint). backdrop-filter stays -webkit-first (the Lightning minify gotcha).

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- Two-controller hazard (locked decision 6, top-risk 5): the resolver reads the STATIC graphicsPresetLabel ONLY; it MUST NOT import or read `governor.state().levels`. Assert by import-absence.
- The `ui` gfx bucket stays governable:false; do not edit GFX_BUCKET_BANDS.
- `data-fx-level` and `--fx-*` are INTERNAL strings: NO t() (locked decision 6). (No new player-visible label is expected this phase; if one appears, it goes English-only in src/ui/i18n.catalog/hud_chrome.ts and never into i18n.locales.)
- Pure core stays DOM/Three-free and deterministic: no Math.random / Date.now / performance.now in ui_effects_profile.ts.
- Presentation-only: do not touch src/sim, server, src/net, headless, or src/world_api.ts (IWorld).
- Shared worktree: commit with EXPLICIT paths, never git add -A.
- No em dashes, en dashes, or emojis anywhere.

Out of scope (do NOT do in this phase):
- Per-element graphics tiering (FCT max-concurrent, minimap cadence, aura visible-count, party/target cadence) and nameplate formalization: that is P14, which CONSUMES this resolver's fxLevel. P5 only ships the resolver + applier + CSS token wiring.
- Any per-frame extraction or write-elision work (P10-P13).
- Any cold-window or PainterHost work (P6-P9).
- Extending IWorld or any sim/server change.

STEP 3 - VALIDATION + REVIEW:
Validation-matrix rows that match (state.md):
- Baseline: `npx tsc --noEmit`.
- Pure core added: `npx vitest run tests/ui_effects_profile.test.ts` + `npx vitest run tests/architecture.test.ts` (UI-purity guard) + a same-input-same-output assertion in the test.
- CSS changed: `npx vitest run tests/css_corpus.test.ts` + `npx vitest run tests/client_shell.test.ts` + `npm run build` (all 4 entries) + the backdrop-filter -webkit-first survival check + `biome check` on the touched CSS.
- No per-frame phase here, so NO perf gate is required for P5.
Review dispatch (state.md Review Dispatch Matrix): `qa-checklist` only. Nothing touches server/net/admin/sim/world_api, so privacy-security-review, migration-safety, and cross-platform-sync do NOT fire. Prompt the reviewer for COVERAGE (every correctness/requirement gap with confidence + severity), not filtering. Do not commit until it reports no BLOCKING.

STEP 4 - COMMIT CADENCE: 2 to 4 Conventional Commits with scope and EXPLICIT paths. Examples:
- `feat(ui): add ui_effects_profile static-tier effects resolver` -- src/ui/ui_effects_profile.ts, tests/ui_effects_profile.test.ts, tests/architecture.test.ts (allowlist)
- `feat(ui): apply data-fx-level + --fx-* tokens from the resolver` -- the applier module + its wiring + main.ts (reduce-motion reconcile)
- `style(css): consume --fx-* in glass/glow/fct-crit/vignette rules` -- src/styles/hud.css, src/styles/components.css
- `docs(frontend): record P5 in progress.md + state.md ledger` -- docs/frontend-modernization/progress.md, docs/frontend-modernization/state.md

STEP 5 - ACCEPTANCE CRITERIA (every item verifiable and green):
- [ ] `src/ui/ui_effects_profile.ts` exists as a pure module: resolveUiEffectsProfile(presetLabel x effectsQuality x reduceMotion) -> {fxLevel, tokens}; no DOM, no Three, no Math.random/Date.now/performance.now; registered in the P0 UI_PURE_CORES allowlist; tests/architecture.test.ts passes.
- [ ] `tests/ui_effects_profile.test.ts` covers ALL tiers x reduce-motion x effectsQuality, INCLUDING the advanced-honors-effectsQuality decision (advanced is NOT collapsed to high), plus a same-input-same-output (determinism) assertion.
- [ ] The resolver provably reads graphicsPresetLabel and NOT the governor: an import-absence assertion proves it does not import or read governor.state().levels.
- [ ] The dumb applier sets data-fx-level + every --fx-* token; it mirrors theme.ts's runtime custom-prop write; data-fx-level and --fx-* carry NO t() (internal).
- [ ] reduce-motion and data-fx-level coexist: the existing body.reduce-motion toggle (main.ts:1236) and the resolver-driven motion tokens are a single source of truth and do not fight (no second motion flag).
- [ ] The extracted CSS (glass/glow/FCT-crit/vignette in src/styles/hud.css + components.css) consumes var(--fx-*); JS-written custom props remain :root defaults; backdrop-filter stays -webkit-first; the paused-vignette special case is preserved.
- [ ] `npx tsc --noEmit` clean; `npx vitest run tests/ui_effects_profile.test.ts` + `tests/architecture.test.ts` + `tests/css_corpus.test.ts` + `tests/client_shell.test.ts` green; `npm run build` (all 4 entries) green; `biome check` clean on the touched CSS.
- [ ] qa-checklist reviewer reports no BLOCKING.
- [ ] The `ui` gfx bucket is still governable:false (GFX_BUCKET_BANDS untouched); no sim/server/net/IWorld change.

STEP 6 - DOC UPDATES + MEMORY: update progress.md (mark P5 done with the files added) and state.md (set P5 status in the ledger, list src/ui/ui_effects_profile.ts + the applier as new tokens, note the advanced-honors-effectsQuality decision is now realized in code). Record any surprising rule in memory (e.g. the exact advanced collapse boundary, the reduce-motion single-source reconcile, the paused-vignette special case if it bit).

STEP 7 - FINAL RESPONSE: status, files changed, validation results (tsc, the three vitest runs, build x4, biome), reviewer verdict, any deferrals (e.g. tier knobs left for P14), and end with: Next: phase-06-painterhost-seam-pilot.md

STOPPING RULES:
- STOP if the resolver cannot derive fxLevel without reading the governor (you would be forced to import governor state): that is a design break, surface it.
- STOP if a CSS rule cannot be converted to a `var(--fx-*)` read without changing the cascade or default appearance (css_corpus or a visual diff regresses): leave it hardcoded and report it rather than altering the cascade.
- STOP and surface as a SCOPE CHANGE if the phase finds it needs to extend IWorld or touch src/sim / server / src/net.
- STOP if the reduce-motion reconcile would require a second motion flag or contradicts the existing body.reduce-motion CSS hook.
```

## Notes for the planner

P5 is small and surgical on purpose: it ships only the resolver, the dumb applier, and the CSS token
wiring, deliberately leaving every cost knob (FCT concurrency, minimap cadence, aura count, frame
cadence, nameplates) to P14 which consumes this `fxLevel`. The single load-bearing risk is the
two-controller hazard (top-risk 5): if the resolver ever reads the FPS governor instead of the static
`graphicsPresetLabel`, HUD fx scales the wrong way, so the import-absence assertion is the heart of
the acceptance. It de-risks P14 (a clean static `fxLevel` to drive per-element tiering) and depends on
P1/P2/P3 having already extracted the glass/glow/FCT-crit/vignette CSS that this phase points at
`--fx-*`. It carries no perf gate because nothing here runs per frame.
