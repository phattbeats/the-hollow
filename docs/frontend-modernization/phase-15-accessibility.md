# Phase P15: Accessibility (WCAG 2.2 AA chrome) + forced-colors + skip links + minimal print

Cross-cutting accessibility consolidation + audit AFTER every window and per-frame component exists.
Per-window a11y was built IN during P7-P14 (the state.md WINDOW/CONTROL acceptance row); this phase
does the GLOBAL work (one shared focus manager, skip links, live regions, forced-colors, minimal
print) and the chrome-wide audit (axe-core + keyboard E2E) that catches the gaps the per-window
passes missed. The 3D world/canvas stays OUT of scope (not screen-readable) and that boundary is
stated honestly, not papered over.

## Starter Prompt

```
This is Phase P15 of the Frontend Modernization v0.16.0 packet: Accessibility (WCAG 2.2 AA chrome) +
forced-colors + skip links + minimal print.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off
release/v0.16.0).

ULTRACODE: yes for the audit fan-out (STEP 2 is a multi-slice audit-then-fix, one slice per
window-group plus a chrome-wide slice). Use ultracode + a Workflow: parallel auditors over the
extracted windows/controls + the chrome-wide work, then adversarial verify. The shared-infra slices
(focus manager, skip links, live regions, forced-colors CSS, print reset) integrate sequentially.

Goal: consolidate accessibility into ONE coherent chrome-wide layer and AUDIT every extracted window
and per-frame control to WCAG 2.2 AA (locked decisions 10, 11, 14). Per-window roles/aria were built
in during P7-P14 via the WINDOW/CONTROL acceptance row; this phase (1) adds the GLOBAL pieces that no
single window owns - a shared focus manager (trap + return-to-opener + Esc), skip links, live regions
for chat + combat text, a forced-colors pass, a minimal print reset - and (2) runs the automated +
keyboard audit across the whole HUD chrome and FIXES the gaps it surfaces. The 3D world/canvas is OUT
of scope (not screen-readable); state that boundary honestly in code comments and the docs, do not
fake aria over the game world.

STEP 0 - PRE-FLIGHT:
- `git status` must be clean. This worktree is a shared checkout; if it is dirty, STOP and ask the
  user before touching anything. Do not stash or revert a concurrent session's work.
- Confirm you are in /Users/fernando/Documents/wocc-v0.16.0 on branch
  feature/frontend-modernization-v016.
- Memory scan: read MEMORY.md plus the frontend-modernization entries: the per-window/per-frame
  phase entries for what a11y each window already carries (P7-P14), frontend-architecture-vanilla-stack
  (the opt-in Vitest 4 Browser Mode suite at vitest.browser.config.ts / npm run test:browser, the
  axe wiring lands there), phased-packet-qa-cadence, no-em-dashes-or-emojis, and
  shared-worktree-commit-care. KEY FB LESSON to carry: a visible :focus-visible ring must NEVER be
  animated, blurred, or transitioned away (the FB focus-ring lesson); guard it.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read + summarize back (the orchestrator keeps the summary, not raw dumps):
- docs/frontend-modernization/state.md - locked decisions 10 (accessibility scope + the per-window
  vs P15-consolidation split), 11 (forced-colors support, no light theme), 14 (browser matrix +
  minimal print), the non-negotiable constraints (presentation-only, i18n), the validation matrix
  WINDOW/CONTROL a11y row + the canonical workflow + the Review Dispatch Matrix.
- docs/frontend-modernization/progress.md - the P7-P14 rows (what a11y each extracted window/control
  already carries) so this phase AUDITS and fills gaps rather than re-building what is done.
- this phase file in full.
- v016-recon-and-packet.md "Load-bearing structural findings" + the P7-P9 / P10-P14 detail
  (the windows + controls that now exist as painters), for the inventory of what to audit.
- the SPECIFIC V16 source ranges only, read narrowly by line range:
  - The existing ad-hoc focus helpers already on V16, which the shared manager UNIFIES (do not leave
    two systems): src/ui/hud.ts:2570-2604 (canRestoreFocusTo, currentFocusableElement, restoreFocus,
    focusFirstInteractive incl the canonical focusable selector at 2598). The per-window restoreFocus
    callers (closeDelveBoard 4513, closeLockpick 4675, closeQuestDialog 7894, closePlayerCardModal
    10004, closeQuestLog 11390, the options-menu close 10504) so the manager replaces them.
  - The per-window Escape handlers already present (lockpick 4621/4640, the inline close() patterns
    9044/9090) so Esc-closes is unified, not duplicated.
  - The chat + combat panes that become live regions: #chatlog and #combatlog
    (play.html:7440-7441, index.html:8407-8408), the combatLog() emitter (src/ui/hud.ts:7226), and
    the FCT path landed in P13 (src/ui/fct_painter.ts) for the combat-text announcement question.
  - The existing aria-live nodes to RECONCILE (do not double-announce): hud.ts:7923, 9859, 11874
    (role=alert), 13129/13373; play.html login/charselect aria-live fields 7634-7849.
  - The focus-visible CSS already extracted to src/styles in P1-P4 (FB shipped the .x-btn /
    .action-btn / .chat-tab / range / checkbox focus-visible rules; verify the ported rules at the
    index.html:393-613 / 1327-1419 precedents now live in components.css/base.css) so this phase
    EXTENDS them (skip-link, forced-colors, print) rather than re-authoring.
  - tests/architecture.test.ts UI_PURE_CORES allowlist (any new pure helper this phase adds, e.g. a
    live-region politeness resolver, registers here), tests/css_corpus.test.ts (the new
    forced-colors + print + skip-link CSS sections must be accounted for), tests/client_shell.test.ts
    (skip-link + live-region DOM ids), and vitest.browser.config.ts / tests/browser/*.browser.test.ts
    (where the axe-core + keyboard-nav E2E lands).
Apply THE 40% RULE: if loading the full audit inventory pushes the orchestrator near ~40% context,
SPLIT this phase (shared-infra slice first: focus manager + skip links + live regions + forced-colors
+ print; then the per-window-group audit + fixes as a second sub-phase).

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE (ultracode Workflow, fan out EXPLICITLY):
Shared-infra slices (integrate sequentially; these are the GLOBAL work no window owns):
  INFRA-1 Focus manager (src/ui/focus_manager.ts): a single small module that, on window OPEN,
    records the opener (reuse currentFocusableElement, hud.ts:2575), TRAPS Tab/Shift+Tab within the
    open window's focusable set (reuse the canonical focusable selector, hud.ts:2598 - lift it to one
    named constant, do not re-spell it), routes Esc to close, and RETURNS focus to the opener on
    close (subsume the ad-hoc restoreFocus, hud.ts:2583, and the per-window close() callers above so
    there is ONE system, not two). Logical tab order: ensure the trap order matches reading order.
    A pure helper (e.g. the focusable-order resolver, or the live-region politeness picker) is
    DOM-free and registered in UI_PURE_CORES; the trap itself touches document.activeElement so it is
    NOT a registered pure core (it is wiring), document that split.
  INFRA-2 Skip links: add "skip to main HUD" and "skip to chat" links as the first focusable elements
    in play.html + index.html, visually hidden until :focus-visible (label text via t() in
    hud_chrome.ts, English-only; targets are the main HUD container + #chatlog). CSS for the
    visible-on-focus skip-link goes in the extracted src/styles (a new accounted css_corpus section),
    NOT inline.
  INFRA-3 Live regions: make chat (#chatlog) and combat text announced. Chat messages = polite;
    combat log / FCT-relevant alerts = choose politeness PER TYPE honestly (routine combat damage is
    visual-only and noisy: announce sparingly or via an off-screen polite combat summary, NOT
    assertive spam; reserve assertive for genuinely urgent alerts already using role=alert at
    hud.ts:11874/13129). Reconcile with the EXISTING aria-live nodes (hud.ts:7923, 9859; play.html
    7634-7849) so nothing double-announces. The 3D world stays OUT (not screen-readable) - state it.
  INFRA-4 forced-colors (locked decision 11): a `@media (forced-colors: active)` block in the
    extracted CSS so borders + the focus ring SURVIVE high-contrast, no meaning is carried by a
    background-image / background-color alone (icons that encode state get a text/border fallback),
    and system-color keywords (CanvasText, Highlight, ButtonBorder) are used where a forced palette
    applies. A snapshot test asserts the block is present + shape-correct.
  INFRA-5 Minimal print (locked decision 14): a `@media print` reset that HIDES the canvas + HUD
    chrome (a full-screen game has no print layout). Minimal by design - hide, do not reflow.
Audit-and-fix slices (PARALLEL, one per window-GROUP plus a chrome-wide slice; fix the gaps each
finds, fold the fixes into the right shared-infra or per-window module):
  AUDIT-A Cold windows group 1 (P7: talents, social, bags) - roles/aria/labels/target-size audit.
  AUDIT-B Cold windows group 2 (P8: options, market, char) - same.
  AUDIT-C Cold windows group 3 (P9: map, arena, questlog, leaderboard, spellbook; the two canvas
    windows get an honest "canvas not screen-readable, label + summary only" boundary) - same.
  AUDIT-D Per-frame controls (P10-P14: player/target/party unit frames, cast/swing/xp bars, action
    bar incl the elided aria-label, auras, minimap, FCT, nameplates) - roles/aria, target-size SC
    2.5.8 (>=24px CSS or adequate spacing) on the action-bar buttons + every clickable frame.
  AUDIT-E Chrome-wide slice: skip links reachable + ordered; focus trap + return on every open
    window; :focus-visible present on EVERY interactive element and NEVER animated/blurred/
    transitioned away (the FB lesson - grep the extracted CSS for a transition/animation/filter on a
    :focus-visible selector and assert none); live regions announce; forced-colors survives; print
    reset present.
Tooling slice (wire the automated gate):
  TOOL-1 Wire axe-core (or an equivalent vanilla a11y checker) into the opt-in browser-mode/E2E suite
    (vitest.browser.config.ts + tests/browser/*.browser.test.ts) so axe runs over each BUILT window
    (open the window, run axe, assert zero serious/critical violations). Add a keyboard-navigation
    E2E: Tab through a representative open window, assert the trap holds, Esc closes, focus returns to
    the opener. axe + Playwright go in the OPT-IN suite (npm run test:browser), NOT inline test
    projects, so a bare `vitest run` never launches a browser (the FB browser-mode pattern).

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- PRESENTATION-ONLY: no IWorld / src/sim / server / src/net / headless change. A11y is DOM + CSS +
  presentation wiring only. Server authority untouched. If a slice finds it needs to extend IWorld or
  touch sim/server, STOP and surface it (scope change).
- i18n: every NEW aria / label / skip-link / live-region-prefix string is a t() key in
  src/ui/i18n.catalog/hud_chrome.ts (English-only; control labels are the hud_chrome English-only
  exception). Never edit i18n.locales/<lang>.ts. The action-bar aria-label elision landed in P12 must
  KEEP its t() call (no concat, no `??` fallback, no default param) - this phase must not regress it.
- forced-colors SUPPORTS high-contrast but there is NO light theme and NO prefers-color-scheme branch
  (locked decision 11): the one dark aesthetic stays; forced-colors is the only contrast adaptation.
- :focus-visible is visible on every interactive element and is NEVER animated, blurred, transitioned,
  or filtered away (the FB lesson) - guard it.
- No-magic-values still applies to any CSS this phase adds: skip-link / forced-colors / print rules
  reference tokens/vars, not literal hex/px where a token exists (the painter guard is for TS; CSS
  uses the token vars).
- The 3D world/canvas is OUT of a11y scope (not screen-readable). Do NOT invent fake aria over the
  game world; state the boundary in a comment + the docs.
- No em dashes, en dashes, or emojis anywhere (code, comments, commits). Commit with EXPLICIT paths,
  never git add -A.

Out of scope (do NOT do in this phase):
- Re-building per-window roles/aria that P7-P14 already shipped: AUDIT and fill GAPS, do not redo
  green work.
- Any new IWorld member, wire field, sim/server/net change (none in this packet).
- Per-element graphics tiering (P14, done) or any per-frame perf-budget rework.
- A light theme / prefers-color-scheme (locked decision 11 forbids it) - forced-colors only.
- Standards codification into CLAUDE.md (the a11y contract write-up) - that is P16.
- Cross-engine WebKit-in-CI wiring of the whole suite + bundle-budget close - P17. (This phase only
  ADDS the axe + keyboard-nav tests to the opt-in browser suite; turning that suite on in CI across
  engines is P17.)

STEP 3 - VALIDATION + REVIEW:
Run the validation-matrix rows that match (state.md):
- Baseline: `npx tsc --noEmit`.
- WINDOW/CONTROL a11y row (this is the whole phase): the automated axe-core check zero-violations on
  EVERY built window (npm run test:browser); keyboard reachability + focus-return on close (the
  keyboard-nav E2E); the forced-colors: active snapshot passes; visible :focus-visible present (and
  the no-animated-focus guard); the target-size >=24px audit passes.
- Pure helper added (if any, e.g. a politeness resolver / focusable-order resolver): `npx vitest run
  tests/<helper>.test.ts` + `npx vitest run tests/architecture.test.ts` (UI-purity guard;
  focus_manager wiring is NOT a registered core, the pure helper IS) + a same-input-same-output
  assertion.
- CSS changed (skip-link + forced-colors + print sections): `npx vitest run tests/css_corpus.test.ts`
  (the new sections accounted for) + `npx vitest run tests/client_shell.test.ts` (skip-link +
  live-region DOM ids) + `npm run build` (all 4 entries) + biome check on the new CSS.
- Player text changed (new aria/skip-link labels in hud_chrome.ts, English-only): `npx vitest run
  tests/localization_fixes.test.ts` - a new label in hud_chrome.ts must NOT trip the release tier.
- Whole-suite + build: `npm test` and `npm run build` (4 entries) green.
Review dispatch (only the rows the diff touches): qa-checklist (default; this completes a deliverable
set). privacy-security-review does NOT fire (no server/net/admin, no new randomness in sim/a core).
cross-platform-sync does NOT fire (IWorld unchanged). migration-safety N/A. Prompt the reviewer for
COVERAGE not filtering; resume a truncated reviewer with the state.md resume line. Do not commit until
it reports no BLOCKING.

STEP 4 - COMMIT CADENCE (2-5 Conventional Commits, scope + EXPLICIT paths, never git add -A):
- feat(ui): add shared focus manager (trap + return-to-opener + Esc) unifying ad-hoc helpers
  (src/ui/focus_manager.ts, tests, src/ui/hud.ts wiring)
- feat(ui): add skip links + chat/combat live regions
  (index.html, play.html, src/ui/hud.ts, src/ui/i18n.catalog/hud_chrome.ts, src/styles/*.css)
- feat(ui): forced-colors pass + minimal print reset
  (src/styles/*.css, tests/css_corpus.test.ts)
- test(ui): axe-core + keyboard-nav E2E over every built window
  (vitest.browser.config.ts, tests/browser/*.browser.test.ts)
- docs(frontend): record P15 a11y consolidation in progress.md + state.md ledger
  (docs/frontend-modernization/progress.md, docs/frontend-modernization/state.md)

STEP 5 - ACCEPTANCE CRITERIA (all verifiable + green):
[ ] npx tsc --noEmit passes.
[ ] axe-core (or equivalent) runs over EVERY built window in the opt-in browser suite and reports
    ZERO serious/critical violations (npm run test:browser).
[ ] One shared focus manager: every open window TRAPS focus (Tab/Shift+Tab cycle inside), Esc closes,
    and focus RETURNS to the opener on close; the per-window ad-hoc restoreFocus callers now route
    through it (no two systems). A keyboard-nav E2E proves trap + Esc + return.
[ ] Skip links ("skip to main HUD", "skip to chat") are the first focusable elements, visually hidden
    until :focus-visible, labels via t() (hud_chrome.ts English-only), targets reachable.
[ ] Live regions: chat (#chatlog) announces polite; combat text politeness is chosen PER TYPE
    (routine damage not assertive-spammed; assertive reserved for the existing role=alert urgents);
    no double-announce against the existing aria-live nodes.
[ ] :focus-visible is present on every interactive element and is NEVER animated/blurred/transitioned/
    filtered away (a guard asserts no such property on a :focus-visible selector in the extracted CSS).
[ ] Target-size audit (SC 2.5.8): every control is >=24px CSS or has adequate spacing (the action-bar
    buttons + clickable frames verified).
[ ] forced-colors: active snapshot passes - borders + focus survive, no meaning carried by a
    background-image/background-color alone.
[ ] A minimal @media print reset hides the canvas + HUD chrome (no print layout for a full-screen game).
[ ] The 3D world/canvas is documented OUT of a11y scope (not screen-readable); no fake aria over it.
[ ] PRESENTATION-ONLY held: no IWorld/sim/server/net change; the P12 action-bar aria-label still
    routes through t() (no concat/fallback).
[ ] css_corpus, client_shell, architecture, localization_fixes, full npm test, and npm run build
    (4 entries) all green; biome clean on new CSS.
[ ] qa-checklist reviewer reports no BLOCKING.

STEP 6 - DOC UPDATES + MEMORY:
- progress.md: mark P15 done; list the new modules (focus_manager.ts, any pure helper), the skip-link
  + live-region + forced-colors + print additions, and the axe + keyboard-nav E2E.
- state.md: update the ledger row P15 -> done; note the shared focus manager subsumes the ad-hoc
  restoreFocus helpers (hud.ts:2570-2604), the chosen combat-text politeness policy, and that the
  axe suite is OPT-IN (npm run test:browser), with cross-engine CI turn-on deferred to P17.
- Memory: record surprising rules (e.g. the combat-text politeness decision, the forced-colors
  system-color keyword set used, the no-animated-focus guard mechanism, the canvas-out-of-scope
  boundary wording).

STEP 7 - FINAL RESPONSE:
Report status, files changed (absolute paths), validation results (tsc, axe per-window, keyboard-nav
E2E, forced-colors snapshot, target-size audit, css_corpus/client_shell/architecture/localization
tests, full npm test, build), the qa-checklist verdict, any deferrals (cross-engine CI turn-on -> P17;
CLAUDE.md a11y contract -> P16), and end with exactly:
Next: phase-16-standards-codification.md

STOPPING RULES (phase-specific):
- STOP and surface a scope change if any slice finds it needs to EXTEND IWorld or touch
  src/sim / server / src/net / headless (presentation-only is a hard line).
- STOP if making chat/combat a live region would announce routine combat damage assertively (the spam
  hazard): re-pick politeness per type before shipping; never assertive-spam.
- STOP if a :focus-visible ring is animated/blurred/transitioned/filtered away anywhere (the FB
  lesson): fix it before committing; the focus ring must be steady and visible.
- STOP if the only way to pass axe on a window is faking aria over the 3D canvas: the canvas is OUT of
  scope by decision; state the boundary, do not invent screen-reader text for the game world.
- STOP if unifying the focus manager would leave TWO focus systems live at once (the new manager and a
  surviving ad-hoc restoreFocus caller): migrate the callers or surface why one must stay.
- STOP if loading the audit inventory approaches ~40% context: SPLIT into a shared-infra sub-phase
  then a per-window-group audit sub-phase (per state.md THE 40% RULE).
```

## Notes for the planner

P15 is the cross-cutting a11y consolidation, deliberately placed AFTER P7-P14 so every window and
per-frame control already exists and already carries its own roles/aria (built in via the state.md
WINDOW/CONTROL acceptance row on each of those phases). This phase therefore does TWO things that no
single earlier phase could: it adds the GLOBAL pieces no window owns (one shared focus manager that
unifies V16's ad-hoc restoreFocus/focusFirstInteractive helpers at hud.ts:2570-2604 into a real
trap-plus-return system; skip links; chat/combat live regions; a forced-colors pass; a minimal print
reset), and it AUDITS the whole chrome with automated axe-core plus a keyboard-nav E2E to catch the
gaps the per-window passes missed. V16 already ships a strong a11y baseline (200+ aria/role/tabindex
uses in hud.ts, focus-visible CSS for the chrome controls, per-window Esc + restoreFocus, several
aria-live nodes), so the work is genuinely consolidate-and-audit, not build-from-zero. The two
load-bearing honesty constraints: the combat-text live region must pick politeness per type (routine
damage is visual, never assertive-spam) and the 3D world/canvas is OUT of scope (not screen-readable,
no fake aria) - both are stated plainly rather than gamed to pass axe. The :focus-visible-never-
animated rule is the carried FB lesson and gets an explicit guard. Everything here is presentation-
only (no IWorld/sim/server touch) and any new label is hud_chrome English-only, so the review surface
is qa-checklist alone. The axe + keyboard E2E land in the OPT-IN browser suite (npm run test:browser,
not inline projects, matching the FB browser-mode pattern); turning that suite on across engines in CI
is explicitly P17, and the CLAUDE.md a11y contract write-up is P16.
