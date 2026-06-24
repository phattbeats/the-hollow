# Phase P16: Standards codification into CLAUDE.md (component / token / a11y / perf / browser contracts)

Write the now-PROVEN frontend contracts (component, token, a11y, perf, browser, bundle) into the
relevant `CLAUDE.md` files, each pointing at the real guard test that enforces it. This is a
DOCS-ONLY phase: no product code moves. Because this is a 100% AI-authored codebase, codifying the
contracts the packet actually built is the leverage multiplier, every future AI-authored feature
then inherits them by default.

## Starter Prompt

```
This is Phase P16 of the Frontend Modernization v0.16.0 packet: Standards codification into CLAUDE.md.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: no. This is a small DOCS-ONLY phase (a handful of CLAUDE.md edits). Do it sequentially with one verification subagent at the end; do not fan out, there is nothing parallelizable and the risk is documenting a rule the code does not enforce, which a single careful pass plus an adversarial check catches better than fan-out.

Goal: codify the contracts P0-P15 actually built into the CLAUDE.md files that future AI authors read, with each documented contract naming its enforcing guard/test. The audience is the NEXT AI feature author: the codified rules must be the ones the code really enforces, never aspirational. Edit (and where missing, create) the relevant CLAUDE.md files; add a short "Authoring a new HUD component" recipe; cross-link the files so a reader lands on the right one. DOCS-ONLY: do NOT touch any product code, test, or generated file.

STEP 0 - PRE-FLIGHT:
- `git status` must be clean. This worktree is a shared checkout; if it is dirty, STOP and ask the user before touching anything.
- Confirm you are in /Users/fernando/Documents/wocc-v0.16.0 on branch feature/frontend-modernization-v016.
- Memory scan: read MEMORY.md plus the instruction-files policy entry [[instruction-files-policy]] (CLAUDE.md is the canonical Opus-4.8-targeted instruction file with a Sonnet baseline; i18n detail lives in src/ui), and [[ai-architecture-opus48-overhaul]] (module-first doctrine + the tests/architecture.test.ts sim/UI purity guard). Also no-em-dashes-or-emojis and shared-worktree-commit-care.

STEP 1 - LOAD CONTEXT:
Spawn ONE Explore agent to read + summarize back (the orchestrator keeps the summary, not raw dumps):
- docs/frontend-modernization/state.md: the locked decisions 9-14 (the COMPONENT CONTRACT incl the parameterized unit_frame FAMILY + multi-bar action bar; WCAG 2.2 AA chrome; theming dark-only + forced-colors; no-magic-values-in-painters; bundle discipline; browser matrix), the validation matrix (the WINDOW/CONTROL a11y row + the BUNDLE row + the PER-FRAME perf row), and the non-negotiable constraints block.
- docs/frontend-modernization/progress.md: the rows for P0 (the guards), P5 (ui_effects_profile), P6 (PainterHost), P7-P9 (cold windows), P10-P14 (per-frame + tiering), P15 (a11y) so you cite what those phases actually LANDED, not what they planned.
- docs/frontend-modernization/v016-recon-and-packet.md: the "Load-bearing structural findings" + "Reuse from FB" sections (so the codified wording matches the real seam names: hotWriteCache, PainterHost, UI_PURE_CORES, the perf_tour harness).
- This phase file in full.
- The actual artifacts to cite (read the SHAPE/anchors only, do not rewrite them):
  - tests/architecture.test.ts: the UI-purity guard (forbiddenUiCoreImport + the UI_PURE_CORES allowlist) and the no-magic-values painter guard, whichever names P0/P5/P12 gave them.
  - tests/css_corpus.test.ts (the CSS completeness guard), tests/client_shell.test.ts (the moved-DOM-id grep), tests/hud_perf_budget.test.ts and scripts/perf_tour.mjs (the perf gate: frameP95 + hudHotDomSkipRate + allocation/bounded-node assertions), and whatever P15 added for axe-core/keyboard/forced-colors and P17-pending bundle-budget (note which gate is LANDED vs deferred to P17).
  - src/ui/painter_host.ts (the PainterHost seam surface), src/ui/ui_effects_profile.ts (the static-preset resolver), src/ui/theme.ts (runtime --color-* applier), and one unit_frame family core + painter (the parameterized FAMILY proof) so the recipe and the component-contract wording match the real signatures.
  - The CLAUDE.md files to edit: the root CLAUDE.md, src/ui/CLAUDE.md (it already has a "## UI/UX, mobile & accessibility standards" section at ~22 and an "### Extracting a HUD window (the recipe)" at ~88 to EXTEND, not duplicate), and src/styles/CLAUDE.md (CREATE if absent; src/styles/ is new this packet). Check for any new component-dir barrel (e.g. a src/ui/components/ or unit_frame dir) that earned its own CLAUDE.md per the repo's "directory with an index.ts barrel + local CLAUDE.md" rule.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE (sequential, no fan-out):
Make the documentation edits. The six contracts to codify, each with a pointer to its REAL enforcing guard/test:

1. COMPONENT CONTRACT (root CLAUDE.md "Modularity" section + src/ui/CLAUDE.md):
   - Pure view-core (DOM/Three-free, Node-tested, allocation-light if hot) + thin write-elided painter + INSTANCE-PARAMETERIZED (no hardcoded element ids, no single-instance assumptions).
   - The reusable FAMILIES the packet built: ONE unit_frame core+painter reused across player/target/party (ready for focus/raid/boss); the action bar instance-parameterized so a second/third bar is `new ActionBarPainter(barDescriptor)`. State that ADDING the extra bars/raid frames is a follow-on FEATURE that inherits the seam, not part of the refactor (do not over-claim).
   - The PainterHost seam (src/ui/painter_host.ts): the thin shared dep-bag (icon/money/tooltip helpers + Hud's elided writers) painters compose into.
   - Enforced by: the UI-purity guard in tests/architecture.test.ts (forbiddenUiCoreImport + UI_PURE_CORES) - a registered core may not import three, a *_painter, painter_host, or DOM globals.

2. TOKEN SYSTEM (src/styles/CLAUDE.md, CREATE; cross-linked from root + src/ui):
   - Tiered tokens + the single @layer order; the src/styles module shape (tokens/base/layout/components/hud/hud.mobile + per-entry .extra) as P1-P4 landed it.
   - NO magic values in painters: painters drive CSS custom properties / tokens, never a literal hex/px/color in TS; thresholds + cadences (the 100/250/500ms frame-divider, breakpoints) are named constants.
   - theme.ts runtime --color-* accent theming (the ONE dark aesthetic; no light/prefers-color-scheme theme).
   - Enforced by: the no-magic-values painter guard in tests/architecture.test.ts (name it exactly as P12 named it) + tests/css_corpus.test.ts (the section-by-section CSS completeness guard).

3. A11Y baseline (src/ui/CLAUDE.md "UI/UX, mobile & accessibility standards", EXTEND the existing section):
   - The WCAG 2.2 AA chrome checklist as P15 actually implemented it: semantic roles + aria, focus management (trap + return on window open/close), visible :focus-visible never animated away, skip links, live regions for chat + combat text, target-size minimums (SC 2.5.8, >=24px or adequate spacing), forced-colors: active support (borders/focus survive, meaning never carried by background-image alone).
   - The SCOPE BOUNDARY stated honestly: the HUD chrome (windows/buttons/forms/menus/chat/tooltips) is in scope; the 3D world/canvas is OUT of scope (not screen-readable).
   - Enforced by: the axe-core (or equivalent) + keyboard-reachability + forced-colors gates P15 landed (name the real test files).

4. PERF gate (src/ui/CLAUDE.md + cross-link from root):
   - Write-elision: hotWriteCache + setText/setDisplay/setTransform/setWidth (hud.ts:1322-1372); per-frame painter writes go ONLY through the host's elided writers, cache keys byte-identical.
   - The per-frame core is allocation-light (no per-frame garbage).
   - The perf_tour baseline + the standing gate: frameP95 <= baseline AND hudHotDomSkipRate >= baseline (+ the P12 allocation-budget and P13 bounded-node assertions).
   - The two-controller rule: HUD tier knobs read the STATIC graphicsPresetLabel via ui_effects_profile, NEVER governor.state().levels (the ui gfx bucket stays governable:false).
   - Enforced by: tests/hud_perf_budget.test.ts + scripts/perf_tour.mjs (the perf gate) + the import-absence/behavioral assertion P14 used for the two-controller rule.

5. BROWSER matrix (src/styles/CLAUDE.md or root, whichever the .browserslistrc lives nearest):
   - Big-3 desktop PLUS mobile Safari/WebKit as a first-class target; a forced-colors pass; a MINIMAL @media print reset (hide the canvas, a full-screen game has no print layout).
   - Enforced by: the .browserslistrc floor + the cross-engine E2E (note: the WebKit-in-CI wiring is P17, so document it as "landed in P17" or "pending P17" to match reality, do NOT claim CI WebKit if it is not yet wired when you write this).

6. BUNDLE discipline (src/styles/CLAUDE.md or root):
   - The JS bundle-budget CI gate (sibling to asset:budget); the SELECTIVE lazy-load policy (measure cold-window cost first, then dynamic-import only the genuinely heavy + rarely-opened windows; keep frequently-opened ones eager). Evidence-driven, never blanket splitting.
   - Enforced by: the bundle-budget gate (name it; note if it lands here as docs vs in P17 as the actual CI gate, and write only what is true at codification time).

7. "Authoring a new HUD component" RECIPE (src/ui/CLAUDE.md, fold into / replace the existing "### Extracting a HUD window (the recipe)" so there is ONE recipe, not two):
   The ordered steps a future feature follows:
   (a) Write the pure view-core in src/ui/<name>_view.ts: map IWorld -> a render model; instance-parameterized (take a descriptor/id, no hardcoded element id). Register it in the UI_PURE_CORES allowlist in tests/architecture.test.ts.
   (b) Add tests/<name>_view.test.ts: same-input-same-output; no Math.random/Date.now/performance.now; no DOM import.
   (c) Write the thin painter on the PainterHost seam: all DOM writes through the elided writers; drive tokens/vars, no literal hex/px (the no-magic-values guard).
   (d) For chrome (a window/control): satisfy the WCAG 2.2 AA checklist (roles/aria/focus-return/:focus-visible/target-size/forced-colors).
   (e) For a hot (per-frame) component: allocation-light core, the perf gate (frameP95 + skip-rate), tier knobs read the static preset not the governor.
   (f) Reuse a FAMILY before building bespoke: a unit-style frame is a unit_frame instance; an extra action bar is a new ActionBarPainter(descriptor).
   (g) Run the matching validation-matrix rows (state.md) before committing.

Cross-link every edited CLAUDE.md to the others (root -> src/ui + src/styles for the frontend contracts; src/ui <-> src/styles). Keep each addition concise and pointer-heavy; do not restate the whole packet, point at state.md and the guard tests.

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- DOCS-ONLY. Edit ONLY CLAUDE.md files (and create src/styles/CLAUDE.md + any earned component-dir CLAUDE.md). Do NOT touch any .ts/.css/.html/test/generated file. If codifying a rule reveals the code does not actually enforce it, do NOT add product code to make it true here; record it as a deferral/gap and surface it (a contract is only codified if a guard already enforces it).
- FAITHFUL, not aspirational: every documented contract names a guard/test that REALLY exists and enforces it as written. If a gate is deferred to P17 (WebKit-in-CI, bundle-budget CI), say so plainly; do not document it as already-enforcing.
- Do not duplicate: EXTEND the existing src/ui/CLAUDE.md a11y section and FOLD the existing window-extraction recipe into the new recipe; do not leave two competing recipes or two a11y lists.
- Respect the instruction-files policy: CLAUDE.md is the canonical Opus-4.8-targeted file with a Sonnet baseline; keep i18n detail in src/ui (do not move it). Match each file's existing voice and section style.
- No em dashes, en dashes, or emojis anywhere (docs, comments, commits). ASCII only.
- Shared worktree: commit with EXPLICIT paths, never git add -A.

Out of scope (do NOT do in this phase):
- Any product-code change, new test, new guard, or generated-file edit. If a contract lacks a guard, this phase records the GAP; it does not write the guard (that would be a code phase, not codification).
- The harness re-author, bundle-budget CI gate, cross-engine E2E wiring, final perf assertion -> P17 (phase-17-harness-close.md). This phase only DOCUMENTS those; it does not wire them.
- The accessibility implementation itself -> P15. This phase documents the a11y baseline P15 built; it does not add a11y behavior.
- i18n catalog/locale edits; sim/server/net/headless; CSS/HTML entries.

STEP 3 - VALIDATION + REVIEW:
This is docs-only, so per the validation matrix the CODE rows do NOT apply. Run only:
- A markdown sanity pass: no em/en dashes or emojis (grep the edited files), all cross-links resolve to real files, every cited guard/test path exists (test the paths with a quick ls).
- Confirm no non-CLAUDE.md file is in the diff (`git status` shows ONLY CLAUDE.md files added/modified).
Review dispatch (state.md Review Dispatch Matrix): this is docs/CLAUDE.md-only, which matches NO review row (no server/net/admin, no IWorld/sim/wire, no DDL), so spawn NO standing reviewer. INSTEAD spawn ONE fresh subagent for the phase-specific acceptance check: its sole job is to verify FAITHFULNESS - for each documented contract, confirm the named guard/test exists and actually enforces the rule as written (read the guard, not just its filename), and flag any rule documented that the code does NOT enforce. Prompt it for COVERAGE not filtering; do not commit until it reports no rule is over-claimed.

STEP 4 - COMMIT CADENCE (2-4 Conventional Commits, scope + EXPLICIT paths, never git add -A):
- docs(ui): codify component + a11y + perf contracts and authoring recipe (CLAUDE.md, src/ui/CLAUDE.md)
- docs(styles): add src/styles/CLAUDE.md (token system + browser matrix + bundle discipline) (src/styles/CLAUDE.md, plus any component-dir CLAUDE.md)
- docs(frontend): mark P16 complete in progress.md + state.md ledger (docs/frontend-modernization/progress.md, docs/frontend-modernization/state.md)

STEP 5 - ACCEPTANCE CRITERIA: see the checklist below; every item green before the phase is done.

STEP 6 - DOC UPDATES + MEMORY:
Update progress.md (mark P16 done; list each CLAUDE.md touched/created and the contract it now codifies) and the state.md ledger (P16 -> done; note that the six contracts are now codified, each pointing at its guard, and any contract whose CI gate is still pending P17). Record in memory the surprising finding if any (e.g. a contract that turned out to have NO enforcing guard and was recorded as a gap rather than codified as enforced).

STEP 7 - FINAL RESPONSE: report status, the CLAUDE.md files edited/created (absolute paths), the validation results (markdown sanity + faithfulness-reviewer verdict), any contract recorded as a GAP (documented-but-not-yet-enforced, deferred to a code phase), and end with exactly:
Next: phase-17-harness-close.md

STOPPING RULES (phase-specific):
- STOP and record a GAP (do not invent a guard) if a contract you are about to codify has NO existing enforcing guard/test: document it as a known gap with the phase that should add the guard, never as an enforced rule.
- STOP and ask the user if codifying a contract would require editing any non-CLAUDE.md file (this phase is docs-only by definition; a product-code change means the prior phase did not finish).
- STOP if the existing src/ui/CLAUDE.md a11y section or window-extraction recipe conflicts with what P15/P6-P9 actually built: reconcile to the SHIPPED reality (the code is the source of truth), do not preserve a stale doc rule.
- STOP if any cited guard/test path does not exist: fix the citation (or downgrade the contract to a gap), never cite a guard that is not there.
```

## Notes for the planner

P16 is deliberately a low-risk docs-only phase placed AFTER the implementation (deps P0-P15) because
a contract is only worth codifying once a guard test actually enforces it: the whole value is that a
100% AI-authored codebase inherits the proven rules by default, so documenting an aspirational rule
the code does not enforce would actively mislead the next author. The single real hazard is exactly
that - over-claiming - which is why the only review for this phase is a faithfulness subagent that
reads each named guard and confirms it enforces the documented rule, not a standing code reviewer
(no code surface is touched, so the Review Dispatch Matrix matches no row). The phase EXTENDS the
already-present src/ui/CLAUDE.md a11y section (~22) and FOLDS the existing window-extraction recipe
(~88) into the one authoring recipe rather than adding parallel copies, and it CREATES src/styles/CLAUDE.md
because src/styles/ is new this packet (P1-P4). Two contracts have CI gates that land in P17 (WebKit-in-CI
and the bundle-budget CI gate), so the phase must document those as pending-P17, not as already-enforcing;
the stopping rules make recording a gap, never inventing a guard, the safe default. See state.md for the
locked decisions, the validation matrix, and the workflow; this phase does not re-derive them.
