# Phase P17: Harness re-author + bundle-budget + cross-engine E2E + perf assertion + packet close

Re-author the test harness around the new painter layout, stand up a permanent per-frame
write-elision/allocation budget test, add the JS bundle-budget CI gate (then selectively lazy-load
the measured-heavy cold windows), wire cross-engine E2E incl mobile Safari/WebKit + a standing axe
a11y gate into CI, do a final UI-purity allowlist sweep, and close the packet (ledger + CLAUDE.md).
The only source behavior change is the selective dynamic-import of measured-heavy cold windows;
everything else locks in what P0-P16 built.

## Starter Prompt

```
This is Phase P17 of the Frontend Modernization v0.16.0 packet: Harness re-author + bundle-budget +
cross-engine E2E + perf assertion + packet close. Deps: P0-P16.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: no. This is a surgical close-out phase (re-author one guard test, add the standing budget
test, add the bundle-budget gate + selective lazy-load, wire the CI E2E + axe jobs, one allowlist
sweep, docs). The lazy-load slice is the only source touch and is evidence-driven (measure first).
No batch fan-out; the slices share the test files and the same moved-id + bundle-cost audit. A single
review pass at the end.

Goal: make the harness reflect the post-extraction reality and become the standing floor for it, and
close the two open infrastructure items (bundle discipline, decision 13; cross-engine + webkit-in-CI,
decision 14). Concretely:
- Re-author tests/client_shell.test.ts where it greps hud.ts for DOM ids that now live in painters
  (the ids moved P7-P14; the grep targets must follow them into the painter modules).
- Add a standing tests/hud_perf_budget.test.ts that asserts the write-elision and allocation budgets
  every CI run (codify the per-frame invariants P10-P13 proved so they cannot silently regress).
- Add a JS bundle-budget CI gate (sibling to asset:budget); MEASURE the cold-window cost first, then
  SELECTIVELY apply dynamic-import lazy-loading only to the measured-heavy + rarely-opened cold
  windows (options/market/leaderboard are candidates) while keeping frequently-opened ones (bags/char)
  eager. The budget proves the initial-bundle shrink and each lazy window still opens (loading state)
  on first use.
- Wire CROSS-ENGINE E2E incl mobile Safari/WebKit into CI (close FB's open webkit-in-CI item): the
  opt-in browser-mode suite + the per-window axe a11y checks become a standing (or scheduled) CI job.
- Add a standing a11y regression gate (axe in CI) so a future change cannot silently break the WCAG
  2.2 AA chrome P15 consolidated.
- Do a final UI-purity allowlist sweep so UI_PURE_CORES lists every core registered across P5-P14 and
  the guard still rejects three/*_painter/painter_host/DOM-global imports.
- Update progress.md, state.md ledger, and CLAUDE.md pointers.
- Run the full validation matrix (npm test, build all 4 entries, biome ci --changed, perf_tour
  desktop+mobile within the P0 thresholds, the bundle-budget gate, the cross-engine + axe CI job).

STEP 0 - PRE-FLIGHT:
- git status clean. If not clean, ASK the user (this is a shared checkout; a concurrent session may
  share the tree). Stage only this phase's explicit paths, never git add -A.
- Memory scan: MEMORY.md plus the FB-equivalent close entries: [[frontend-phase9-testing-docs-sweep]]
  (the FB Phase 9 final-impl + QA, the closest analog; note the vitest exact-pin lesson, the OPT-IN
  browser-mode split = a SEPARATE vitest.browser.config.ts + npm run test:browser so bare vitest run
  cannot launch a browser, the @vitest/browser-playwright provider() function + browser.instances
  array config, the EXACT peer pin on vitest + required playwright peer, no install hook so npm ci
  never downloads browsers = npx playwright install to provision, and the OPEN webkit-in-CI item this
  phase closes), [[frontend-phase7-hud-window-extraction]] (the forbiddenUiCoreImport guard hardening
  that also rejects a pure core importing a *_painter/painter_host, and the "purity-guard perturbation
  must inject a REAL code line, a // comment is stripped by stripComments" gotcha),
  [[frontend-phase8-graphics-tier-effects]] (live computed-style proof + governor two-controller
  guard). Also [[phased-packet-qa-cadence]].
- Confirm you are in the feature/frontend-modernization-v016 worktree.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read and summarize, and keep its summary (not raw dumps):
- docs/frontend-modernization/state.md (locked decisions 9-14, the validation matrix incl the
  WINDOW/CONTROL a11y row and the BUNDLE row, the review dispatch matrix, the perf-gate rows, the
  Key file paths list).
- This phase file.
- The "### P17" / "### P15" close-out section of v016-recon-and-packet.md plus the "Load-bearing
  structural findings" (esp. the perf-harness + cold-window seam findings) and "Top risks" sections.
- The CURRENT shape of tests/client_shell.test.ts: every place it greps hud.ts for a DOM id, and
  which of those ids the P7-P14 painters now own (cross-reference the recon Key-file-paths cold-window
  list and per-frame element list). Have the agent list each grepped id and where it moved.
- tests/architecture.test.ts: the UI_PURE_CORES allowlist + forbiddenUiCoreImport guard as they stand
  after P0/P5-P14 (every core that should be registered; what the guard rejects).
- tests/css_corpus.test.ts and tests/hud_perf_budget.test.ts if a stub exists yet (P0 created the perf
  baseline; this phase makes the budget test STANDING).
- scripts/perf_tour.mjs: the recorded P0 baseline fields (frameP95, inputIntentToFrameP95,
  hudHotDomSkipRate) and how to invoke desktop + mobile.
- The bundle surface: how the build emits the 4 entries (vite.config.ts, the game + admin + guide +
  play chunks), any existing asset:budget gate in package.json/scripts (the sibling this gate
  mirrors), and which cold-window painter modules (P7-P9) are the bundle-cost candidates (options,
  market, leaderboard vs the eager bags/char).
- The cross-engine E2E surface: the opt-in browser-mode config FB stood up (the SEPARATE
  vitest.browser.config.ts + npm run test:browser + tests/browser/*.browser.test.ts) and the per-window
  axe a11y checks P15 added, and how ci.yml runs (or does not yet run) them.
- The write-elision surface: hud.ts:1322-1372 (setText/setDisplay/setTransform/setWidth +
  hotWriteCache) and perfStats() (hotDomWrites/hotDomSkippedWrites/hotDomSkipRate).
THE 40% RULE: keep the working set small; this is a close-out, the orchestrator should stay well under
the ceiling. If the client_shell grep audit or the bundle-cost audit is large, have the agent return
only the moved-id table + the per-window measured byte cost, not file bodies.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
Sequential, five slices (no fan-out; they share the test files and depend on the same moved-id +
bundle-cost audit):
- Slice A - client_shell.test.ts re-author: for each DOM id the test greps in hud.ts that a P7-P14
  painter now owns, repoint the grep at the painter module that renders it (the recon Key-file-paths
  list names where each window/element moved). Ids still produced inline stay pointed at hud.ts. Keep
  the test's intent (the id exists and is wired) identical; only the file it asserts against changes.
  Do NOT loosen an assertion to make it pass; if an id is genuinely gone (folded into a pool/keyed
  node), update the assertion to match the new structure and note it.
- Slice B - hud_perf_budget.test.ts (standing): codify the per-frame invariants P10-P13 proved into a
  permanent test. Assert: (1) the painters route ALL writes through the host's elided writers (no raw
  style/textContent/setAttribute on the hot path) by the same static/structural check the per-frame
  phases used; (2) a write-elision budget: hotDomSkipRate from perfStats() stays >= the P0 baseline
  under a scripted update loop; (3) the allocation-budget proxy the P12 spike settled on (action-bar +
  aura per-frame garbage bounded) and the P13 bounded-node-count cap (FCT pool never exceeds
  max-concurrent under an AoE/boss burst). Reuse the perf_tour harness + the live skip-rate counters;
  do not invent a new measurement path.
- Slice C - JS bundle-budget gate + selective lazy-load (decision 13; the only source touch):
  - First MEASURE: build (4 entries) and record each cold-window painter module's contribution to the
    initial bundle (the per-window cost). Identify the genuinely heavy + rarely-opened windows
    (options/market/leaderboard are candidates) vs the frequently-opened eager ones (bags/char).
  - Add the JS bundle-budget gate as a sibling to asset:budget (an npm script + a CI step that fails
    when the initial bundle exceeds the budget). Set the budget from the measured post-lazy-load size,
    with the same fail-on-exceed shape as asset:budget.
  - SELECTIVELY convert the measured-heavy + rarely-opened windows to dynamic import (the painter
    module loads on first window-open, behind a loading state); keep bags/char eager. This is the only
    behavior-affecting edit in this phase; route it through the existing window-open path, do not
    invent a new seam.
  - Prove: the initial bundle shrinks by the measured cost of each lazy window, and each lazy window
    still OPENS (its loading state shows, then content) on first use. Add the proof to the standing
    suite (a build-size assertion + a browser-mode open-on-first-use test per lazy window).
- Slice D - cross-engine E2E + standing a11y gate into CI (decision 14, closing FB's webkit-in-CI
  item): wire the opt-in browser-mode suite (vitest.browser.config.ts + npm run test:browser +
  tests/browser/*.browser.test.ts) AND the per-window axe a11y checks P15 added into a STANDING (or
  scheduled) CI job in ci.yml, with mobile Safari/WebKit as a first-class instance alongside the big-3
  desktop engines (the browser.instances array). Provision browsers in the CI job (npx playwright
  install; there is no install hook by design). The axe checks run as a standing a11y regression gate
  so a future change cannot silently break the WCAG 2.2 AA chrome. Keep the suite OPT-IN locally (bare
  vitest run must NOT launch a browser); CI invokes it explicitly.
- Slice E - final UI-purity allowlist sweep: make UI_PURE_CORES in tests/architecture.test.ts list
  EVERY pure core registered across P5-P14 (the *_view cores from P7-P9, swing_timer/player_frame /
  the unit_frame family P10, target/party unit_frame instances P11, minimapMarkers P12, fct_core P13,
  nameplate_view P14, ui_effects_profile P5, plus the reused V16 cores). Confirm forbiddenUiCoreImport
  still rejects three / *_painter / painter_host / DOM globals; verify by injecting a REAL code line
  (an actual import statement, NOT a // comment, which stripComments removes) and confirming the guard
  fails, then revert the injection.
Then the docs slice (STEP 6).

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- Presentation-only: do NOT extend IWorld or touch src/sim / server / src/net / headless. The only
  source edit is the selective dynamic-import of measured-heavy cold-window painters (Slice C), routed
  through the existing window-open path; if anything else seems to need a source change, STOP (scope
  change).
- Determinism: pure cores stay DOM/Three-free; no Math.random/Date.now/performance.now in any
  registered pure core (the allowlist sweep re-checks this). The FCT painter may use Math.random for
  jitter; the fct_core may not.
- Write-elision routing: the budget test must verify the hot path routes through the elided writers
  (hud.ts:1322-1372), the exact invariant that keeps the skip-rate from silently collapsing.
- Lazy-load discipline (decision 13): evidence-driven, never blanket splitting. Only the MEASURED-heavy
  + rarely-opened windows go dynamic; frequently-opened ones (bags/char) stay eager. The budget gate
  proves both the shrink and that each lazy window still opens on first use.
- Browser matrix (decision 14): mobile Safari/WebKit is a first-class CI instance; the opt-in suite
  stays opt-in locally (bare vitest run cannot launch a browser); CI provisions browsers explicitly.
- i18n: any label assertion still expects the t() key path; the action-bar aria-label test keeps the
  t() call (no concat / ?? fallback). No new player strings here; a lazy-window loading-state label, if
  any, is a t() key in src/ui/i18n.catalog/hud_chrome.ts (English-only).
- No generated-file hand-edits; regenerate via the build if anything generated drifts.
- Shared worktree: commit with EXPLICIT paths, never git add -A.
- No em dashes, en dashes, or emojis anywhere (code, comments, docs, commits).

Out of scope (do NOT do in this phase):
- Any new extraction or any hud.ts/CSS/painter source edit BEYOND the Slice C selective lazy-load.
  Every element and window was extracted in P6-P14; this phase re-authors the harness around them and
  only switches the load timing of the measured-heavy cold windows.
- Any per-element tiering change (P14 owns it) or new perf optimization. The budget test ASSERTS the
  existing budget, it does not tighten it.
- Blanket route-splitting or lazy-loading windows that measure cheap or open frequently (decision 13
  forbids it).
- New a11y FIXES (P15 owns the WCAG 2.2 AA chrome work); this phase only wires the axe gate that
  guards P15's result.
- The full QA pass: that is the separate qa-checklist run that follows this phase (the packet's final
  QA). This phase delivers the implementation; QA reviews it.

STEP 3 - VALIDATION + REVIEW:
Validation-matrix rows that match (from state.md):
- Baseline: npx tsc --noEmit.
- Test-harness change: npx vitest run tests/client_shell.test.ts + npx vitest run
  tests/architecture.test.ts (the UI-purity guard, after the allowlist sweep) + npx vitest run
  tests/hud_perf_budget.test.ts.
- PERF GATE (this phase makes it standing): npm run the perf_tour harness desktop AND mobile and
  assert frameP95 <= the P0 baseline AND hudHotDomSkipRate >= the P0 baseline; the new
  hud_perf_budget.test.ts must encode the allocation-budget assertion (action-bar + aura garbage
  bounded) and the P13 bounded-node-count cap (FCT pool <= max-concurrent under the scripted AoE
  burst), plus the raw-write rejection (no raw style/textContent/setAttribute on the hot path).
- BUNDLE GATE (decision 13, state.md BUNDLE row): the JS bundle-budget gate passes; for each window
  switched to a dynamic import, the initial bundle shrinks by its measured cost and the window still
  opens (with a loading state) on first use.
- CROSS-ENGINE + A11Y (decision 14, state.md WINDOW/CONTROL row): the standing CI job runs the opt-in
  browser-mode suite across the big-3 desktop + mobile Safari/WebKit AND the per-window axe a11y checks;
  bare vitest run still does NOT launch a browser.
- Pre-merge / CI mirror: npm run i18n:gen && npm test && npx tsc --noEmit && npm run build:env &&
  npm run build:server && npm run build (all 4 entries), then the bundle-budget gate, then the
  cross-engine + axe CI job, then biome ci --changed (lints the new tests/hud_perf_budget.test.ts and
  the bundle-gate script).
Review dispatch (spawn ONLY matching rows): qa-checklist only. No privacy-security-review (no
server/admin/net/secret/Math.random in sim), no migration-safety (no DDL/JSONB), no
cross-platform-sync (IWorld untouched; consuming a landed member and changing a window's load timing
is not an IWorld change). Prompt the reviewer for COVERAGE not filtering; do not commit until it
reports no BLOCKING. If it truncates, resume with the state.md STEP 3 resume line.

STEP 4 - COMMIT CADENCE (2-6 Conventional Commits, scope + EXPLICIT paths):
- test(ui): repoint client_shell DOM-id greps at the painter modules
  (tests/client_shell.test.ts)
- test(ui): add standing hud_perf_budget write-elision + allocation budget
  (tests/hud_perf_budget.test.ts)
- perf(ui): lazy-load measured-heavy cold windows + add JS bundle-budget gate
  (package.json, vite.config.ts, scripts/bundle_budget.mjs, src/ui/hud.ts, tests/bundle_budget.test.ts)
- ci(ui): run cross-engine browser-mode + axe a11y as a standing CI job
  (.github/workflows/ci.yml, vitest.browser.config.ts, tests/browser/)
- test(ui): complete the UI_PURE_CORES allowlist across P5-P14
  (tests/architecture.test.ts)
- docs(frontend): close the v0.16.0 packet ledger
  (docs/frontend-modernization/progress.md, docs/frontend-modernization/state.md, CLAUDE.md)

STEP 5 - ACCEPTANCE CRITERIA:
(see the checkbox list below)

STEP 6 - DOC UPDATES + MEMORY:
- progress.md: mark P17 done; mark the packet implementation-complete (P0-P17) and name the final QA
  as the only remaining step.
- state.md: update the phase ledger (P17 status), the Key-file-paths list (note hud_perf_budget.test.ts
  is STANDING, client_shell greps the painters, the bundle-budget gate + which windows are now lazy,
  and the cross-engine + axe CI job), and the "Current phase" line to PACKET COMPLETE, pre-final-QA.
- CLAUDE.md: update the pointers / guard list so a future contributor knows client_shell greps
  painters, UI_PURE_CORES is the full per-element allowlist, hud_perf_budget is the standing per-frame
  floor, the JS bundle-budget gate guards initial-bundle size (and which windows are lazy), and the
  cross-engine + axe job is the standing browser/a11y gate.
- Memory: record any surprising rule (an id that fully dissolved into a keyed pool so the grep had to
  change shape not just target; the perf_tour mobile invocation; the allocation-budget proxy the P12
  spike settled on; the measured per-window bundle cost + which windows went lazy; the CI browser
  provisioning step).

STEP 7 - FINAL RESPONSE:
Report status, the files changed (absolute paths), the validation results (tsc, the vitest files,
perf_tour desktop+mobile numbers vs the P0 baseline, the bundle-budget shrink per lazy window, the
cross-engine + axe CI job result, build all 4 entries, biome ci --changed), the qa-checklist reviewer
verdict, and any deferrals. End with:
Next: (packet complete; run the final QA over the closed packet)

STOPPING RULES (phase-specific):
- STOP if a perf_tour run shows frameP95 above the P0 baseline OR hudHotDomSkipRate below it: that is a
  real per-frame regression from an earlier phase that this close-out has surfaced, not a harness bug.
  Report which element/phase regressed; do NOT relax the budget test to make it pass.
- STOP if making client_shell or the purity guard green would require editing a source/painter file
  (not a test) BEYOND the Slice C lazy-load: that is a scope change. Surface it.
- STOP if the bundle measurement shows a candidate window (options/market/leaderboard) is NOT actually
  heavy, or a "frequently opened" window IS heavy: follow the evidence (decision 13), do not lazy-load
  a cheap window and do not blanket-split; record the measured costs and the decision.
- STOP if a lazy window does NOT open on first use (the loading state never resolves to content): the
  dynamic-import wiring is broken, fix it before committing; never ship a window that cannot open.
- STOP if the allocation-budget proxy cannot be measured in Node (the P12 open decision degraded to
  perf_tour-only): record that the budget test asserts frameP95/longtasks + the bounded-node cap rather
  than a Node-measured byte count, and proceed; do not invent a new measurement harness.
- STOP if a purity-guard injection (the REAL import line) does NOT make the guard fail: the guard is
  broken, fix the guard (it is a test file, in scope) before relying on it for the sweep.
- STOP if wiring the cross-engine job makes bare vitest run launch a browser: the opt-in split is
  broken (the suite must stay a SEPARATE config); restore the split before committing.
```

## STEP 5 acceptance criteria

- [ ] `tests/client_shell.test.ts` greps each moved DOM id against the painter module that now owns it (P7-P14); ids still produced inline stay pointed at `hud.ts`; no assertion was loosened to pass, and any id that dissolved into a keyed pool has its assertion updated to the new structure (and noted).
- [ ] `tests/hud_perf_budget.test.ts` exists and is STANDING (runs in `npm test`): it asserts the hot path routes ALL writes through the host's elided writers (no raw `style`/`textContent`/`setAttribute`), `hotDomSkipRate` from `perfStats()` stays >= the P0 baseline under a scripted update loop, the P12 allocation-budget proxy (action-bar + aura per-frame garbage bounded), and the P13 FCT pool never exceeds its max-concurrent cap under a scripted AoE/boss burst.
- [ ] The JS bundle-budget gate exists as a sibling to `asset:budget` (npm script + CI step, fail-on-exceed): the cold-window cost was MEASURED first; only the measured-heavy + rarely-opened windows (options/market/leaderboard candidates) became dynamic imports; bags/char stay eager; the initial bundle shrinks by each lazy window's measured cost; and each lazy window still OPENS (loading state then content) on first use, proven in the standing suite.
- [ ] The cross-engine E2E job is wired into CI (closing FB's webkit-in-CI item): the opt-in browser-mode suite runs across the big-3 desktop PLUS mobile Safari/WebKit, plus the per-window axe a11y checks, as a standing (or scheduled) CI job; bare `vitest run` still does NOT launch a browser (the SEPARATE config is intact); CI provisions browsers explicitly (`npx playwright install`).
- [ ] A standing a11y regression gate (axe in CI) guards the WCAG 2.2 AA chrome P15 consolidated; no new a11y fixes were made here (this phase only wires the gate).
- [ ] `UI_PURE_CORES` in `tests/architecture.test.ts` lists EVERY pure core registered across P5-P14 (the `*_view` cores P7-P9, the `unit_frame` family / `swing_timer` P10, target/party unit_frame instances P11, `minimapMarkers` P12, `fct_core` P13, `nameplate_view` P14, `ui_effects_profile` P5, plus the reused V16 cores); `forbiddenUiCoreImport` still rejects `three`/`*_painter`/`painter_host`/DOM-global imports, verified by a REAL injected import line making it fail and reverted.
- [ ] No source change beyond the Slice C selective lazy-load: only `tests/`, `docs/frontend-modernization/`, `CLAUDE.md`, the bundle-gate script + `package.json`/`vite.config.ts`, `ci.yml`/the browser config, and the lazy-load window-open wiring in `hud.ts` were edited; IWorld and `src/sim`/`server`/`src/net`/`headless` untouched; no new player-visible strings beyond an English-only loading label in `hud_chrome.ts` if needed.
- [ ] `npx tsc --noEmit` clean; `npx vitest run tests/client_shell.test.ts tests/architecture.test.ts tests/hud_perf_budget.test.ts` green; full `npm test` green.
- [ ] PERF GATE: `perf_tour` desktop AND mobile both show frameP95 <= the P0 baseline AND hudHotDomSkipRate >= the P0 baseline.
- [ ] `npm run build` builds all 4 entries; the bundle-budget gate passes; the cross-engine + axe CI job passes; `biome ci --changed` clean on the new/edited files.
- [ ] `qa-checklist` reviewer reports no BLOCKING.
- [ ] `progress.md`, `state.md` ledger, and `CLAUDE.md` updated; packet marked implementation-complete (P0-P17) with the final QA as the only remaining step.

## Notes for the planner

This phase is the packet close-out: it converts the per-frame invariants P10-P13 each proved once at
their perf gate into a STANDING floor (`hud_perf_budget.test.ts`), points the harness at the new
painter layout (`client_shell`), and lands the two open infrastructure items the packet committed to:
bundle discipline (decision 13) and the cross-engine + webkit-in-CI matrix (decision 14). It is mostly
test/docs/CI, so it carries little per-frame source risk of its own, which is why ULTRACODE and fan-out
are unnecessary (the five slices share the same moved-id + bundle-cost audit and the same test files).

The one behavior-affecting slice is the selective lazy-load, and it is deliberately evidence-driven:
measure the cold-window cost first, then split ONLY the genuinely heavy + rarely-opened windows
(options/market/leaderboard are candidates, not a mandate), keeping bags/char eager. The candidate
list is a hypothesis the measurement confirms or refutes; the stopping rule routes a surprise (a cheap
candidate or a heavy frequent window) back to the evidence rather than letting the phase blanket-split.
The cross-engine job reuses FB's opt-in browser-mode split exactly (a SEPARATE
`vitest.browser.config.ts` so bare `vitest run` never launches a browser) and adds mobile WebKit as a
first-class instance plus the standing axe gate, so a future change cannot silently break the WCAG 2.2
AA chrome or a target engine.

The standing risk this phase surfaces is that the perf_tour run here is the first time all extractions
are measured together: if it surfaces a regression, the stopping rule routes it back to the offending
phase rather than letting the close-out paper over it. By the end, every per-frame invariant is
machine-checked, the bundle has a budget, the browser matrix is in CI, the allowlist is complete, and
the only remaining step is the packet's final QA.
