# Phase P3: CSS B2: modal + feature windows

Extract the modal and feature-window CSS out of the `index.html` inline `<style>` into
`src/styles/layout.css` (window centering + shells) and `src/styles/components.css` (the feature
windows themselves), with zero rule loss and no cascade change. Presentation-only, ported from FB
onto the larger v0.16.0 base.

## Starter Prompt

```
This is Phase P3 of the Frontend Modernization v0.16.0 packet: CSS B2: modal + feature windows.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: yes. This is a batch-heavy CSS extraction across many independent window sections
(char/spellbook/questlog/leaderboard/talents, modals/dropdown, vendor/bags/social/map/arena/
auction/options/emote, delve board, lockpick); fan out parallel slices + an adversarial
section-by-section completeness verify against css_corpus.

Goal: Move the windows block of index.html's inline <style> into two new layer-tagged CSS modules
under src/styles/ exactly as FB shaped them: layout.css (window centering + window shells) and
components.css (the feature-window bodies). This is a pure cut-and-relocate under the single @layer
order P1 declared. Every rule must survive byte-for-byte (modulo Lightning minification), the
cascade must not change, and every window must still open and render identically. This is CSS B2;
it lands on P2 (CSS B1, in-world HUD chrome) which already emptied 626-1268 minus the windows.

STEP 0 - PRE-FLIGHT:
- Run git status; the tree must be clean. This worktree is a shared checkout; if it is dirty, STOP
  and ask the user rather than stashing or resetting.
- Confirm you are in /Users/fernando/Documents/wocc-v0.16.0 on branch feature/frontend-modernization-v016.
- Memory scan: read MEMORY.md and the entries [[frontend-phase2-css-extraction]] (play.html
  preserve-both-exactly, single @layer components order), [[frontend-phase4-lightningcss-flip]]
  (backdrop-filter -webkit-first minify gotcha), [[frontend-phase6-window-encapsulation]] (the
  #id-prefix isolation is the load-bearing thing; @scope deferred), and [[frontend-phase1-foundation-gates]]
  (cssCorpus/normalizeCss guard). These are FB-era but the rules port forward.
- Confirm P1 (tokens.css/base.css + the @layer order) and P2 (hud.css) have already landed on this
  branch; P3 appends to the same @layer order, it does not redeclare it.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn one Explore agent to read and summarize, returning a tight digest (not raw dumps):
- state.md (locked decisions 1/2/7, the non-negotiable CSS constraints, the validation matrix CSS
  row, the review dispatch matrix).
- this phase file (phase-03-css-windows.md).
- the "### P3 CSS B2" section of v016-recon-and-packet.md plus the "Load-bearing structural findings"
  CSS items and "Top risks" item 6 (cascade/rule-drop) and item 2-bullet on backdrop -webkit-first.
- the SPECIFIC index.html <style> ranges this phase moves (real V16 line numbers from the recon):
  window centering 1301-1432; char/spellbook/questlog/leaderboard/talents 1432-1597; modals +
  dropdown 1598-1696; vendor/bags/social/map/arena/auction/options/emote bodies; delve board
  1051-1084; lockpick 1085-1168. Ask the agent to map each /* ---- name ---- */ section comment in
  these ranges to its destination file (layout.css vs components.css) and report the section list.
The orchestrator keeps the section map, not the raw CSS.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
ULTRACODE Workflow, fan out one slice per window-section group, then a single sequential integration
+ a section-by-section adversarial verify. Slices (each cuts its rules from index.html's inline
<style> and pastes them, unchanged, under the correct @layer in the destination file):
- Slice A (layout.css, window centering/shells): index 1301-1432, the generic window centering /
  modal-overlay / window-frame / titlebar / close-button shell rules shared by all windows.
- Slice B (components.css, classic stat windows): char/spellbook/questlog/leaderboard/talents
  bodies, index 1432-1597.
- Slice C (components.css, modals + dropdown): index 1598-1696 (confirm/prompt modals, dropdown
  menus, context-style popovers that belong to windows not the in-world HUD).
- Slice D (components.css, interaction windows): vendor/bags/social/map/arena/auction/options/emote
  window bodies (the per-window selectors in the windows block).
- Slice E (components.css, delve board + lockpick): delve board 1051-1084, lockpick 1085-1168.
Because all slices edit the same two new files + the same index.html <style>, run them with
isolation: "worktree" (overlapping edits) OR serialize the integration: have each slice EMIT its
exact cut-range + the destination-file text block, and let the orchestrator apply them in one
deterministic pass to avoid a merge race on index.html. After integration, run css_corpus and
diff each /* ---- name ---- */ section's normalized rule set old-vs-new.

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- Presentation-only. No hud.ts/sim/server/net/IWorld changes; this is CSS relocation only. If you
  find you need to touch JS to make a window render, STOP (scope change, surface it).
- One @layer order (P1's). Append window rules under the existing components / layout layers; do NOT
  introduce a new @layer name or reorder the cascade. #id-prefix isolation stays the load-bearing
  encapsulation; @scope stays deferred.
- Zero rule loss / zero cascade change: every selector, declaration, and source order preserved
  (Lightning minification aside). Keep any JS-written custom props (e.g. --range-fill set inline)
  resolving from :root as before.
- backdrop-filter must be emitted -webkit-first (Lightning minify gotcha) wherever a window body uses
  it (vendor/options glass etc.).
- i18n: no player-visible string changes here (CSS only); do not add any t() key.
- No em dashes, en dashes, or emojis in CSS comments or section banners.
- Shared worktree: commit with EXPLICIT paths, never git add -A.

Out of scope (do NOT do in this phase):
- The pre-game shell, login, chat, party-frame CSS, context menu, trade, controls drawer, mobile
  touch, char-select, and the per-entry index.extra/play.extra split: that is P4 (CSS C).
- The in-world HUD chrome (nameplates/frames/bars/FCT/vignette): that was P2 (CSS B1).
- tokens.css/base.css and the Lightning flip / @layer declaration: that was P1.
- Any window JS extraction into *_view cores or painters: that is P6-P9.
- The ui_effects_profile --fx-* consumption in window glass: that is P5.

STEP 3 - VALIDATION + REVIEW:
Run the CSS/HTML-entry row of the validation matrix (state.md):
- npx tsc --noEmit (baseline).
- npx vitest run tests/css_corpus.test.ts (the section-by-section completeness guard MUST account
  for every moved window section; this is the primary rule-drop catch).
- npx vitest run tests/client_shell.test.ts (window DOM ids unchanged).
- npm run build (all 4 entries resolve under @layer).
- the backdrop-filter survival check (grep the built CSS: -webkit-backdrop-filter precedes the
  unprefixed property for every window body that uses it).
- biome check on the new/changed .css (layout.css, components.css).
- Open-each-window smoke: confirm via the section map that every window section (char, spellbook,
  questlog, leaderboard, talents, vendor, bags, social, map, arena, auction, options, emote, delve
  board, lockpick, modals, dropdown) has its rules present in a built entry and centered correctly.
This is NOT a per-frame phase: no perf_tour gate.
Review dispatch: qa-checklist only (CSS-only, presentation surface; no server/net/IWorld/sim touch,
so privacy-security-review, migration-safety, and cross-platform-sync do not fire). Prompt the
reviewer for COVERAGE: every dropped/reordered rule, every section the css_corpus guard does not
cover, any backdrop-filter ordering miss. Do not commit until it reports no BLOCKING.

STEP 4 - COMMIT CADENCE (2-5 Conventional Commits, scope + EXPLICIT paths):
- style(css): extract window centering and shells into src/styles/layout.css
  (paths: src/styles/layout.css, index.html)
- style(css): extract feature-window bodies into src/styles/components.css
  (paths: src/styles/components.css, index.html)
- style(css): relocate delve board + lockpick window CSS into components.css
  (paths: src/styles/components.css, index.html)
- test(css): extend css_corpus sections for the windows block
  (paths: tests/css_corpus.test.ts)
- docs(frontend): record P3 in progress.md and state.md ledger
  (paths: docs/frontend-modernization/progress.md, docs/frontend-modernization/state.md)

STEP 5 - ACCEPTANCE CRITERIA (all verifiable + green):
[copied below into the final report]

STEP 6 - DOC UPDATES + MEMORY:
- progress.md: mark P3 done, list the two new CSS modules and the index.html line ranges emptied,
  note the section map (which window went to layout vs components).
- state.md: flip the P3 ledger row to done; under "Key file paths" note layout.css/components.css now
  carry the windows block; if you discovered a window section the recon range did not name, record it.
- Memory: record any surprising rule (e.g. a window that shares a selector with an in-world HUD rule
  already in hud.css, a modal that depends on cascade order with a P2 rule, or a backdrop-filter
  ordering case Lightning re-emitted).

STEP 7 - FINAL RESPONSE:
Status, files changed (absolute paths), validation results (tsc, css_corpus, client_shell, build x4,
biome, backdrop survival), reviewer verdict, any deferrals, and end with:
Next: phase-04-css-shell-mobile-extra.md

STOPPING RULES:
- STOP if a window rule cannot be moved without changing the cascade (a window selector whose
  specificity/order interacts with a rule still inline or already in hud.css): surface it, do not
  guess a reorder.
- STOP if css_corpus cannot be made to cover a moved section without weakening the guard (the guard
  must stay a real completeness check, not a rubber stamp).
- STOP and surface as a SCOPE CHANGE if making a window render correctly requires editing hud.ts,
  IWorld, or any JS (this phase is CSS-only).
- STOP if a window section in the recon ranges turns out to belong to the in-world HUD (P2) or the
  shell/mobile block (P4); re-classify rather than force it into B2.
```

## Notes for the planner

P3 is shaped as a parallel section-cut because the windows block is many independent named
sections (`/* ---- name ---- */`) with little cross-talk, which fans out cleanly and lets the
css_corpus guard verify each section old-vs-new. The split into layout.css (centering/shells, the
shared chrome every window reuses) versus components.css (per-window bodies) mirrors FB's proven
module shape, so the port is a relocate not a re-derive. The key risk is silent cascade drift
(item 6 in Top risks): a window rule that depended on source order with a hud.css rule (P2) or with
another window, plus the Lightning backdrop -webkit-first gotcha on glassy window bodies; the
section-by-section corpus diff plus the backdrop survival grep are the specific guards against it.
De-risking value: clearing the windows block out of inline `<style>` is the last big chunk before
P4 can finish emptying both HTML entries, and it leaves the window bodies in a real module that P5
(--fx-* glass) and P6-P9 (painter extraction) can target without re-touching HTML.
