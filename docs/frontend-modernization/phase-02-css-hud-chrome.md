# Phase P2: CSS B1: in-world HUD chrome

Extract the in-world HUD chrome CSS (nameplates, unit frames, bars, FCT, the Interface/Comfort
adaptive-effects + perf overlay, and the vignette/death styles) from the inline `<style>` block in
`index.html` into `src/styles/hud.css`, under the `@layer` order P1 established, with zero rule
loss proven by the css_corpus section-by-section guard.

## Starter Prompt

```
This is Phase P2 of the Frontend Modernization v0.16.0 packet: CSS B1: in-world HUD chrome.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: yes. This is a CSS B-tier extraction over a large contiguous range (index 626-1268 minus
windows, plus four scattered blocks: FCT 2162, Interface/Comfort/adaptive-effects/perf overlay
2174-2302, vignette/death 2416-2455). Fan out per section with adversarial verify against the
css_corpus guard; the cascade-drop risk is the whole point of the parallel section-by-section check.

Goal: Move the in-world HUD chrome rules out of index.html's inline <style> into a new
src/styles/hud.css module under the single @layer order from P1, byte-for-byte (modulo Lightning's
deterministic minify), so the in-world HUD renders identically and css_corpus accounts for every
moved section. This is a pure CSS relocation: no selector rewrites, no value changes, no new tokens.
It de-risks the per-element work later by getting all hot-element styling into one reviewable module.

STEP 0 - PRE-FLIGHT:
- git status MUST be clean. This is a shared checkout; if dirty, ask the user before touching anything.
- Memory scan: MEMORY.md index plus the FB CSS-phase entries that carry the gotchas:
  [[frontend-phase2-css-extraction]] (play.html preserve-both-exactly, single @layer components
  order), [[frontend-phase4-lightningcss-flip]] (backdrop-filter -webkit-first minify gotcha),
  [[frontend-phase1-foundation-gates]] (cssCorpus/normalizeCss guard shape). These are FB-era but
  the rules port forward.
- Confirm you are in the feature/frontend-modernization-v016 worktree on the right branch.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read+summarize:
- docs/frontend-modernization/state.md (locked decisions 1,2,7; the CSS-row of the validation
  matrix; constraint: JS-written custom props stay in :root; no em dashes/emojis; explicit-path commits).
- this phase file (phase-02-css-hud-chrome.md).
- the "### P2" section of docs/frontend-modernization/v016-recon-and-packet.md plus the
  "Load-bearing structural findings" + risk 6 (CSS cascade/rule-drop) + "Reuse from FB" rows.
- the SPECIFIC index.html inline <style> ranges this phase moves: lines 626-1268 (HUD chrome, MINUS
  the windows block that P3 owns), FCT at 2162, Interface/Comfort/adaptive-effects/perf-overlay
  2174-2302, vignette/death 2416-2455. Read these ranges only, not the whole file.
- the P1 output: the @layer declaration, src/styles/tokens.css and base.css, and how css_corpus
  keys sections on the /* ---- name ---- */ comments.
The orchestrator keeps the section map (which /* ---- name ---- */ blocks fall in P2 vs P3), not raw dumps.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
Default parallel Workflow fan-out, one slice per source section. Use isolation: "worktree" only if
slices touch the same lines of index.html (they should not; each owns a disjoint range). Slices:
  1. HUD chrome main body: index 626-1268 MINUS the windows block (the windows centering/feature
     windows are P3 scope: nameplates, unit/player/target/party frames, cast/swing/xp bars, action
     bar, buff/debuff bars, minimap chrome, coords/clock/compass). Move each /* ---- name ---- */
     section verbatim into hud.css preserving order.
  2. FCT (floating combat text) block at index 2162.
  3. Interface/Comfort + adaptive-effects + perf-overlay block, index 2174-2302.
  4. Vignette + death overlay block, index 2416-2455.
Each slice: cut the rules from index.html's inline <style>, paste into src/styles/hud.css under the
correct @layer (the P1 component layer), keep the /* ---- name ---- */ section comments so css_corpus
can key on them, and emit backdrop-filter -webkit-first if any moved rule uses it (Lightning minify
gotcha). Do NOT alter selectors, values, or specificity. Do NOT move any window-shell rule (P3).

INVARIANTS THIS PHASE MUST KEEP:
- Presentation-only: no hud.ts/TS edit, no IWorld touch, no sim/server/net change. CSS relocation only.
- @layer order from P1 is the single source of cascade order; moved rules go in the layer P1 assigned
  the component tier. Do not introduce a new layer or reorder layers.
- JS-written custom props (--range-fill, --app-vw, --app-vh, theme.ts --color-*) stay declared as
  :root defaults (P1 owns :root in tokens.css); do not relocate any :root custom-prop default into hud.css.
- backdrop-filter rules emit -webkit-prefixed first (Lightning CSS minify gotcha).
- No new i18n strings (CSS only). No new tokens, no value changes.
- No em dashes, en dashes, or emojis anywhere.
- Commit with EXPLICIT paths (shared worktree), never git add -A.

Out of scope (do NOT do in this phase):
- The windows block: centering 1301-1432, char/spellbook/questlog/leaderboard/talents 1432-1597,
  modals/dropdown 1598-1696, vendor/bags/social/map/arena/auction/options/emote + delve board
  1051-1084 + lockpick 1085-1168. That is P3 (CSS B2). Leave those rules in place.
- Shell/mobile/per-entry .extra (P4). play.html (P4 diffs and splits it; do not touch it here).
- Wiring --fx-* consumption into these rules (P5). This phase only relocates existing rules.

STEP 3 - VALIDATION + REVIEW:
Run the CSS-row of the validation matrix:
- npx vitest run tests/css_corpus.test.ts (the completeness guard: every moved /* ---- name ---- */
  section must be accounted for, zero rule loss).
- npx vitest run tests/client_shell.test.ts.
- npm run build (all 4 entries resolve under @layer).
- the backdrop-filter survival check (moved backdrop rules still -webkit-first after Lightning minify).
- biome check on src/styles/hud.css.
- npx tsc --noEmit (baseline).
Review dispatch: qa-checklist only (presentation-only CSS; no server/net/IWorld/sim surface, so no
privacy-security-review, migration-safety, or cross-platform-sync). Prompt it for COVERAGE: did any
section get dropped, reordered into a different layer, or lose a backdrop -webkit prefix.

STEP 4 - COMMIT CADENCE: 2-5 Conventional Commits, scoped, explicit paths. Examples:
- style(css): extract in-world HUD chrome (frames, bars, nameplates) to hud.css
    -- src/styles/hud.css index.html
- style(css): move FCT + adaptive-effects/perf-overlay + vignette/death to hud.css
    -- src/styles/hud.css index.html
- test(css): cover hud.css sections in css_corpus guard
    -- tests/css_corpus.test.ts

STEP 5 - ACCEPTANCE CRITERIA: (see checklist below; all items verifiable and green)

STEP 6 - DOC UPDATES + MEMORY:
- Update progress.md (P2 row) and state.md ledger (mark P2 done; add src/styles/hud.css to the new
  CSS files list; note which sections moved here vs deferred to P3).
- Record any surprising rule in memory (e.g. a section that straddles the P2/P3 boundary, or a
  backdrop rule that needed manual -webkit ordering).

STEP 7 - FINAL RESPONSE: status, files changed (absolute paths), validation results (css_corpus +
client_shell + build all 4 entries + backdrop check + biome + tsc), qa-checklist verdict, any
deferrals, and end with: Next: phase-03-css-windows.md

STOPPING RULES:
- STOP if a rule cannot be moved without changing the cascade (specificity collision, source-order
  dependency a moved section relies on). Surface it; do not "fix" it by reordering.
- STOP if a section straddles the P2/P3 boundary (a selector mixes HUD chrome and a window shell).
  Surface the boundary; do not guess the split.
- STOP if css_corpus reports a section it cannot account for after the move (rule loss); fix the
  move, do not weaken the guard.
- STOP if this phase finds it needs any hud.ts/TS edit or an IWorld change. That is a scope change.
```

## Notes for the planner

P2 is shaped as a pure section-by-section relocation because the dominant risk (recon risk 6) is a
silent cascade or rule drop across the ~8.1k deduped CSS lines, and the only defense is the
css_corpus completeness guard keyed on the existing `/* ---- name ---- */` comments, so the phase
preserves those comments and moves whole sections rather than re-grouping rules. It is split from P3
along the windows boundary so each CSS phase has a tractable, guard-verifiable surface and the
boundary is explicit rather than guessed. Getting all in-world HUD chrome into one `hud.css` module
de-risks P5 (the `--fx-*` wiring lands in one place) and the per-frame phases (hot-element styling
is co-located and reviewable). The backdrop -webkit-first Lightning gotcha is the one easy-to-miss
correctness item, hence its own validation row.
