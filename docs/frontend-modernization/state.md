# Frontend Modernization v0.16.0: State (cross-phase cheat sheet)

The single reference every phase loads first. Holds locked decisions, the canonical workflow
blocks, the validation matrix, and the running ledger of what each phase adds. Update this at the
end of every phase (Step 6).

Branch: `feature/frontend-modernization-v016` (worktree `/Users/fernando/Documents/wocc-v0.16.0`),
branched off `origin/release/v0.16.0` (`e31eb05d`).
Current phase: PACKET AUTHORED + AMENDED + fidelity-reviewed (2026-06-24, FAITHFUL, 0 BLOCKING;
every cited V16 line number verified against live source). Now 18 phases (P0-P17): the amendment
added decisions 9-14 (component contract incl the parameterized unit_frame family + multi-bar action
bar; WCAG 2.2 AA chrome; dark-only + forced-colors; no-magic-values painters; bundle discipline; the
browser matrix), a new P15 Accessibility phase, a new P16 Standards-codification phase, and renumbered
the close to P17 (bundle-budget + selective lazy-load + cross-engine E2E). Pre-P0, no code has moved.
Awaiting the go to start P0. Docs are untracked (not committed) pending the user's word.

## Provenance (read these once for the why)

This packet is a RESTART of the completed `feature/frontend-modernization` (FB) refactor onto the
much larger `release/v0.16.0`. The decision and its evidence:
- `feasibility-v0.16.0.md`: why we restart (Option B) instead of merging FB forward.
- `v016-restart-direction.md`: the expanded scope (per-frame extraction + per-element perf) and the
  process learnings (smaller phases for the 40% rule; perf-gated acceptance for hot-path work).
- `v016-recon-and-packet.md`: the deep recon of v0.16.0's frontend (the real line numbers) and the
  full 16-phase design. THIS is the authoritative source the phase files elaborate.

FB itself is a read-only SOURCE: ~70% of its artifacts port forward file-for-file (build config,
`src/styles/*.css` shape, the cold-window cores/painters V16 lacks, the three pure cores, the
guards). "Restart" = re-run the extraction on the bigger base, reusing FB's files where they fit;
it is NOT a retype-from-scratch.

---

## Locked decisions (record once, never re-litigate)

1. Vanilla HTML/CSS/TS. No Svelte/React/Tailwind/Lit/signals. One build-time dependency added:
   Lightning CSS (devDependency). The per-frame HUD stays framework-free.
2. This packet supersedes the FB packet for v0.16.0. It is the only frontend plan going forward.
3. The per-frame HUD stays framework-free with a hard perf gate; imperative DOM writes go through
   the existing write-elision cache (`hotWriteCache` + `setText`/`setDisplay`/`setTransform`/
   `setWidth`, `hud.ts:1322-1372`) reading `IWorld`. No reactivity, no Shadow DOM, no signals.
4. HUD cold-window extraction is PRESENTATION-ONLY: consume V16's already-extended `IWorld`; the
   only signature consumed that changed is `leaderboard(): Promise<LeaderboardPage>` (one painter,
   P9). Do not extend `IWorld` or touch `src/sim`/`server`/`src/net`/`headless`. If a phase finds
   it needs to, STOP and surface it (scope change).
5. Per-frame extraction uses the same Humble Object pattern (pure core from `IWorld` + thin painter)
   but HOT path: the pure core is allocation-light (no per-frame garbage); the painter preserves
   write-elision (DOM write only on change, routed through the host's elided writers); every
   per-frame phase carries a frame-budget perf gate, not just tsc + tests.
6. Graphics-tier UI is driven from the STATIC preset (`graphicsPresetLabel`), NEVER the FPS
   governor (two-controller hazard; the `ui` gfx bucket stays `governable:false`). `data-fx-level`
   + `--fx-*` are INTERNAL (no `t()`).
7. Encapsulation is a CSS problem: `@layer` + `#id`-prefix isolation (the `@scope` future-layer is
   deferred on the browser floor, as in FB). 
8. The four design decisions are settled as defaults (revisit only at the named phase):
   - 'advanced' graphics preset -> HUD fx: HONOR its `effectsQuality` slider for a distinct HUD-fx
     level (not collapse to 'high'), so the expert path sheds HUD cost independently. (P5)
   - PainterHost: a THIN shared host that the already-tested bespoke windows (vendor/lockpick/raid)
     COMPOSE into, not a unified bag they migrate onto. (P6)
   - FCT per-frame driver: fold into `hud.update()` so the existing `hud` perf bucket covers it,
     not a second rAF. (P13)
   - Every tier knob reads the static preset, never `governor.state().levels`. (P5/P14)
9. COMPONENT CONTRACT (every extracted component). Pure view-core (DOM/Three-free, Node-tested,
   allocation-light if hot) + thin write-elided painter + INSTANCE-PARAMETERIZED for reuse and
   multiplicity (no hardcoded element ids, no single-instance assumptions). Build reusable FAMILIES,
   not bespoke per-instance modules, on the rule of three: ONE `unit_frame` core+painter reused
   across player/target/party (ready for focus/raid/boss); the action bar instance-parameterized so
   a second/third bar is `new ActionBarPainter(barDescriptor)`. Actually ADDING the extra bars or
   raid frames is a follow-on FEATURE that inherits this seam, NOT part of this refactor.
10. ACCESSIBILITY (WCAG 2.2 AA on the HUD CHROME). Windows, buttons, forms, menus, chat, tooltips:
    semantic roles + aria, focus management (trap + return on window open/close), visible
    `:focus-visible` never animated away, skip links, live regions for chat + combat text,
    target-size minimums (SC 2.5.8, >=24px or adequate spacing). The 3D world/canvas is OUT of scope
    (not screen-readable); state the boundary honestly. A11y is built IN per window/element phase
    (acceptance below) and consolidated + audited in the dedicated Accessibility phase (P15).
11. THEMING. ONE dark MMORPG aesthetic (theme.ts runtime `--color-*` accent theming stays). NO
    light / `prefers-color-scheme` theme. DO support `forced-colors: active` (Windows high-contrast):
    borders/focus survive, meaning is never carried by a background-image alone.
12. NO MAGIC VALUES IN PAINTERS. Painters drive CSS custom properties / tokens, never a literal
    hex/px/color in TS; thresholds + cadences (the 100/250/500ms frame-divider, breakpoints) are
    named constants. A guard enforces it.
13. BUNDLE DISCIPLINE. A JS bundle-budget CI gate (sibling to `asset:budget`). Measure the
    cold-window cost first, then SELECTIVELY lazy-load (dynamic import) only the genuinely heavy +
    rarely-opened cold windows (options/market/leaderboard are candidates) while keeping
    frequently-opened ones (bags/char) eager. Evidence-driven, never blanket splitting.
14. BROWSER MATRIX. Big-3 desktop PLUS mobile Safari/WebKit as a first-class target (the game is
    mobile-playable); a `forced-colors` pass; a MINIMAL `@media print` reset (hide the canvas, a
    full-screen game has no print layout). Cross-engine E2E incl WebKit is wired into CI in the close
    phase (P17), closing FB's open webkit-in-CI item.

## Non-negotiable constraints (carry every phase)

- Determinism: pure cores stay DOM/Three-free; no `Math.random`/`Date.now`/`performance.now` in any
  registered pure core. (The FCT painter MAY use `Math.random` for jitter; the FCT CORE may not.)
- Server authority untouched; do not move any outcome to the client.
- i18n: every NEW player-visible string is a `t()` key; new control labels go in
  `src/ui/i18n.catalog/hud_chrome.ts` (English-only). Never edit `i18n.locales/<lang>.ts`. The
  action-bar aria-label elision (P12) must keep the `t()` call (no concat / `??` fallback).
- No generated-file hand-edits; regenerate via the build.
- Shared worktree: commit with EXPLICIT paths, never `git add -A`.
- No em dashes, en dashes, or emojis anywhere.

---

## Canonical workflow (every implementation phase follows this)

Every phase runs on Opus 4.8, xhigh effort. Batch-heavy phases (CSS B1/B2/C; cold-window batches;
the per-frame batches) use `ultracode` + a Workflow (parallel fan-out + adversarial verify).

- STEP 0 Pre-flight: `git status` clean (ask the user if not; concurrent session may share the
  checkout). Memory scan (MEMORY.md + the entries the phase lists). Confirm you are in the
  `feature/frontend-modernization-v016` worktree.
- STEP 1 Load context (do NOT read `hud.ts` (14,377 lines) or the HTML entries whole): spawn an
  Explore agent to read+summarize this `state.md`, the phase's `progress.md` row, the phase file,
  `v016-recon-and-packet.md` (the line numbers), and the specific source ranges the phase lists.
  The orchestrator keeps the summary, not raw dumps. THE 40% RULE: scope the working set so the
  orchestrator stays well under ~40% context; if a phase's load approaches it, SPLIT the phase
  (the per-frame batches P10-P13 are pre-flagged to split per-element if needed).
- STEP 2 Choose orchestration + execute: pick the lightest tool. Default to parallel Agent/Workflow
  fan-out, one slice per window/element. Use `isolation: "worktree"` only if agents edit
  overlapping files. Request fan-out EXPLICITLY.
- STEP 3 Validation + review dispatch: run the validation-matrix rows for the change type. Spawn
  review agents only for the surface the diff touches (Review Dispatch Matrix). Prompt each for
  COVERAGE not filtering; do not commit until each reports no BLOCKING. Resume a truncated reviewer
  with: "Stop reading more files. Output the full report now based on what you've already seen. No
  more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."
- STEP 4 Commit cadence: 2-5 Conventional Commits with a scope, EXPLICIT paths.
- STEP 5 Acceptance: the phase file's checklist, all items verifiable and green (incl the perf gate
  for per-frame phases).
- STEP 6 Docs + memory: update `progress.md` and this `state.md` (new files, tokens, decisions).
  Record surprising rules in memory.
- STEP 7 Final response: status, files, validation results, reviewer verdict, deferrals, and the
  one-line handoff naming the next phase file.

Each implementation phase is followed by a QA pass using `qa-checklist.md` (the shared QA starter:
correctness + test-coverage + dead-code agents, then the dispatch matrix, then fix BLOCKING/
SHOULD-FIX, then update docs). Never skip QA; end each phase by naming the next.

---

## Validation matrix (run the rows that match the change type)

- Baseline (every phase): `npx tsc --noEmit`.
- Pure core added/changed: `npx vitest run tests/<core>.test.ts` + `npx vitest run
  tests/architecture.test.ts` (the UI-purity guard) + a same-input-same-output assertion.
- CSS / HTML entry changed: `npx vitest run tests/css_corpus.test.ts` (the completeness guard) +
  `npx vitest run tests/client_shell.test.ts` + `npm run build` (all 4 entries) + the
  backdrop-filter survival check + `biome check` on the new `.css`.
- PER-FRAME phase (P10-P14): `npm run` the perf_tour harness and assert frameP95 <= the P0 baseline
  AND hudHotDomSkipRate >= the P0 baseline; for P12, the allocation-budget assertion; for P13, the
  bounded-node-count AoE-burst assertion. A unit test that the painter routes ALL writes through the
  host's elided writers (no raw `style`/`textContent`/`setAttribute`).
- WINDOW or CONTROL changed (every cold-window + chrome phase): the WCAG 2.2 AA chrome checks
  (automated axe-core or equivalent over the built window; keyboard reachability + focus-return; a
  `forced-colors: active` snapshot; visible `:focus-visible`; target-size >=24px). Plus the
  no-magic-values painter guard (painters reference tokens/vars, not literal hex/px). The full
  cross-window a11y audit (skip links, global focus management, live regions) runs in P15.
- BUNDLE changed (cold-window phases + P17): the JS bundle-budget gate; for any window switched to a
  dynamic import, the initial bundle shrinks by its measured cost and the window still opens (with a
  loading state) on first use.
- Player text changed (rare): `npx vitest run tests/localization_fixes.test.ts`. New label in
  `hud_chrome.ts` (English-only) does not trip the release tier.
- Pre-merge / CI mirror: `npm run i18n:gen && npm test && npx tsc --noEmit && npm run build:env &&
  npm run build:server && npm run build`, then the i18n freshness check; on `release/**` the
  release-tier gate (`I18N_RELEASE_TIER=1`) pending=0; and `biome ci --changed` (the forward
  ratchet that lints the new files).

## Review Dispatch Matrix (spawn ONLY the rows the diff touches)

- `privacy-security-review`: only if the diff touches `server/`, `src/admin/`, `src/net/`, a
  deploy/secret file, or introduces SQL/auth/secret/new `Math.random`|`Date.now`|`performance.now`
  in `src/sim/` or a pure core. Should rarely fire (presentation-only).
- `migration-safety`: only if `server/*_db.ts` DDL or `characters.state` JSONB changed. Never here.
- `cross-platform-sync`: only if `src/world_api.ts` (IWorld), `src/sim/`, `src/net/online.ts`,
  `server/game.ts` wire/dispatch, or the i18n matchers changed. Consuming the already-landed IWorld
  in a painter does NOT change it; this should not fire.
- `qa-checklist`: every phase that completes a deliverable set (the default reviewer).

If no row matches (docs/test-only), spawn no review agent.

---

## Phase ledger (18 phases; fill in as phases complete)

Full per-phase scope/acceptance is in `v016-recon-and-packet.md` and the `phase-NN-*.md` files.

| Phase | Title | Risk | Kind | Status |
|---|---|---|---|---|
| P0 | Foundation gates: CSS-corpus + UI-purity guard + perf baseline | low | port+extend | pending |
| P1 | CSS A: Lightning flip + tokens + base | low | port | pending |
| P2 | CSS B1: in-world HUD chrome | medium | port | pending |
| P3 | CSS B2: modal + feature windows | medium | port | pending |
| P4 | CSS C: shell + mobile + per-entry .extra | medium | port | pending |
| P5 | ui_effects_profile resolver + applier | low | port+extend | pending |
| P6 | PainterHost seam + cold-window pilot | low | port+extend | pending |
| P7 | Cold-window batch 1: talents, social, bags | medium | port | pending |
| P8 | Cold-window batch 2: options, market, char | medium | port | pending |
| P9 | Cold-window batch 3: map, arena, questlog, leaderboard, spellbook | medium | port | pending |
| P10 | Per-frame batch 1 (EASY): xp bar, swing timer + the unit_frame family core (player as first instance) | high (split-watch) | port+extend | pending |
| P11 | Per-frame batch 2 (MEDIUM): cast bars + target/party as unit_frame instances | high (split-watch) | port+extend | pending |
| P12 | Per-frame batch 3 (HARD): action bar (multi-bar parameterized), auras pool, minimap markers | high (split-watch) | port+extend | pending |
| P13 | Per-frame batch 4 (HIGHEST RISK): FCT pool + per-frame driver | high (split-watch) | new | pending |
| P14 | Per-element graphics tiering + nameplate formalization | medium | port+extend | pending |
| P15 | Accessibility (WCAG 2.2 AA chrome) + forced-colors + skip links + minimal print | medium | new | pending |
| P16 | Standards codification into CLAUDE.md (component/token/a11y/perf/browser contracts) | low | new | pending |
| P17 | Harness re-author + bundle-budget + cross-engine E2E + perf assertion + packet close | low | port+extend | pending |

### New `IWorld` members / `SimEvent`s / wire fields / endpoints / DB tables
None. This packet adds none. It CONSUMES V16's already-landed IWorld (delve/lockpick/raid + the
paged `leaderboard()`); the only change vs FB is one painter consuming the paged leaderboard (P9).

### New i18n keys
None expected. Any new control label -> `src/ui/i18n.catalog/hud_chrome.ts` (English-only).

### Key file paths (V16 line numbers from the recon)
- Per-frame entry: `Hud.update()` at `src/ui/hud.ts:3627` (frame-divider: every-frame +
  fast >=100ms + medium >=250ms + slow >=500ms). Write-elision: `hud.ts:1322-1372` + `perfStats()`.
- Hot elements: player frame 3656-3667, buff bar 3670 (renderAuras 4186-4245), target frame
  3672-3749, player cast bar 3752-3798, swing timer 3800-3827, action bar 3829-3931, xp bar
  3933-3952; minimap 5022-5258; party frames 11508-11562; FCT `fct()` 7258-7276 + spawn sites
  6100-6422; nameplates `renderer.ts` updateNameplates 4413.
- Cold windows (inline unless noted): renderVendor 8126 (ALREADY delegates to vendor_window),
  renderMarket 8343, renderBags 8839, renderChar 9116, renderLeaderboard 10673 (async),
  renderSpellbook 10766, renderTalents 10909, renderQuestLog 11398, renderSocial 12025,
  renderOptions 12783, updateMapWindow 5561, renderArenaWindow 5300.
- Existing pure cores to REUSE: `xp_bar`, `cast_bar` (render), `absorb_bar`, `party_frames`
  (selector), `rest_indicator`, `low_health`, `low_resource`, `clock`, `compass`, `coords`,
  `quest_tracker`, `delve_map`, `raid_lockout_view`, `vendor_view`; nameplate cores in `src/render`.
- Build: `vite.config.ts` (flip in P1), `package.json`, `.browserslistrc` (new P1), `biome.json`
  (the ratchet), `tsconfig.json`. CSS (new): `src/styles/{tokens,base,layout,components,hud,
  hud.mobile,shell,index.extra,play.extra}.css`. Entries: `index.html`, `play.html`, `admin.html`,
  `guide.html`.
- Guards: `tests/client_shell.test.ts`, `tests/architecture.test.ts`, `tests/css_corpus.test.ts`
  (new), `tests/hud_perf_budget.test.ts` (new), `scripts/perf_tour.mjs`.
- Tier: `src/render/gfx.ts` (`graphicsPresetLabel`, `GFX_BUCKET_BANDS`, `ui` band `governable:false`),
  `src/game/settings.ts`, `src/ui/ui_effects_profile.ts` (new P5), `src/ui/theme.ts` (applier shape).

## Top risks (full detail in `v016-recon-and-packet.md`)
1. Per-frame write-elision regression (non-byte-identical cache keys / raw writes silently collapse
   the skip-rate). Mitigation: route all painter writes through PainterHost + a unit test rejecting
   raw writes + the skip-rate perf gate every per-frame phase.
2. FCT extraction (P13): net-new pool + per-frame driver; pool lifecycle errors drop/duplicate text;
   AoE worst-case is the perf-gate scenario. Isolated last.
3. innerHTML-wipe -> keyed-pool rewrites (auras P12, party P11) silently dropping listeners/tooltips.
4. Action-bar aria-label (P12): per-frame i18n+a11y+allocation triple-hazard; elide WITHOUT dropping
   `t()` or adding a fallback.
5. Two-controller hazard (P5/P14): tier knobs read the static preset, never the governor.
6. CSS cascade/rule-drop (P2-P4): mitigated by the css_corpus section-by-section guard every CSS
   phase + the backdrop -webkit-first gotcha + JS-written custom props kept in `:root`.
7. Scope creep into sim/server/net: the only IWorld interaction is consuming V16's landed members.
