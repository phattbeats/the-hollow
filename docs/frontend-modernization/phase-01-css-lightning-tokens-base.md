# Phase P1: CSS A: Lightning CSS flip + tokens + base

Flip the Vite CSS pipeline to Lightning CSS, declare the single `@layer` order, set the big-3
browser floor, and lift the design tokens (`:root` custom properties) and the reset/forms/base
layer out of the inline `<style>` into `src/styles/tokens.css` + `src/styles/base.css`. Presentation
only; no HUD logic, no cascade change.

## Starter Prompt

```
This is Phase P1 of the Frontend Modernization v0.16.0 packet: CSS A: Lightning CSS flip + tokens + base.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: no. This is a small, surgical, sequential CSS lift (two files, one build-config flip, one
order declaration). It is not batch-heavy: tokens and base are one contiguous slice each and must be
diffed against the inline source rule-for-rule, so a single careful orchestrator beats fan-out here.

Goal: re-establish the Lightning CSS build and the foundational style layer FB invented, on the
larger v0.16.0 base. Flip `vite.config.ts` to Lightning CSS (minifier + targets), add a
`.browserslistrc` big-3 floor, declare the single `@layer` order one time, and extract the design
tokens (the index `:root` block, KEEPING the JS-written custom props as `:root` defaults so theme.ts
and the runtime resizers still apply) into `src/styles/tokens.css`, and the reset / scrollbar /
`@supports` / forms block into `src/styles/base.css`. The visual result must be byte-for-byte
unchanged; this phase only relocates rules and wires the pipeline. P0's css_corpus guard must account
for the two new sections.

STEP 0 - PRE-FLIGHT:
- `git status` must be clean. This is a SHARED checkout; if it is dirty, STOP and ask the user before
  touching anything (a concurrent session may own those changes).
- Confirm you are in the `/Users/fernando/Documents/wocc-v0.16.0` worktree on branch
  `feature/frontend-modernization-v016`.
- Memory scan: read MEMORY.md and the relevant entries:
  - "Frontend Phase 4 Lightning CSS flip" (pr759 / frontend-phase4-lightningcss-flip): the
    lightningcss Vite config, the big-3 `.browserslistrc` floor, and the backdrop-filter
    -webkit-first minify gotcha. Port that shape.
  - "Frontend Phase 2 CSS extraction" (frontend-phase2-css-extraction): the play.html
    preserve-both-exactly discipline (NOTE: the per-entry .extra split is P4, not here) and the single
    `@layer components` order convention.
  - "Frontend Phase 1 foundation gates" (frontend-phase1-foundation-gates): cssCorpus/normalizeCss
    pinning and the lightningcss 1.32.0 pin.
- Confirm P0 is landed (css_corpus guard + UI-purity guard + perf baseline exist and are green); P1
  depends on P0.

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read and summarize, returning a compact brief (not raw dumps):
- `docs/frontend-modernization/state.md` (locked decisions, the validation matrix CSS row, the
  Review Dispatch Matrix, the Key file paths block).
- THIS phase file.
- The `### P1 CSS A` section of `docs/frontend-modernization/v016-recon-and-packet.md` plus the
  "Reuse from FB" paragraph and Top risk #6 (CSS cascade/rule-drop + JS-written custom props in
  `:root`).
- The EXACT source ranges this phase touches, read with offsets only (never the whole file):
  - `index.html` inline `<style>`: the tokens block `:root` at lines 186-269, and the
    reset/scrollbar/@supports/forms block at lines 270-625. Capture every selector and declaration
    verbatim, and note which custom properties are written by JS at runtime (`--range-fill`,
    `--app-vw`, `--app-vh`) and which come from `src/ui/theme.ts` (`--color-*`).
  - `vite.config.ts` (current CSS handling, the entries map).
  - `src/ui/theme.ts` (which `--color-*` vars it sets at runtime, and the `:root` target).
  - Whether `src/styles/` exists yet (FB created it; on V16 it likely does not).
The orchestrator KEEPS the summary; do not re-read these whole afterward.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE (sequential, single orchestrator; no fan-out):
Slice 1 - Build pipeline flip (`vite.config.ts`, `.browserslistrc`, `package.json`, `tsconfig.json`):
  - Add Lightning CSS as a devDependency (pin to the version FB used, 1.32.0 per memory) and flip
    Vite's CSS transformer to `lightningcss` (set `css.transformer: 'lightningcss'` and
    `css.lightningcss.targets` derived from the browserslist; mirror FB's vite.config exactly).
  - Add `.browserslistrc` with the big-3 floor (the same Chrome/Firefox/Safari minimums FB shipped).
  - Do NOT change the entries map or any non-CSS Vite option.
Slice 2 - `@layer` order declaration:
  - Declare the single canonical `@layer` order ONE time (the FB order: tokens, base, layout,
    components, hud, then the per-entry extras as named in state.md's CSS module list). Only `tokens`
    and `base` get content THIS phase; the later layers are declared-but-empty placeholders so the
    cascade order is fixed up front and P2-P4 only fill them. Put the `@layer` statement where every
    entry's CSS will import in order (match FB's placement).
Slice 3 - `src/styles/tokens.css`:
  - Move the `:root` custom-property block (index 186-269) verbatim into `tokens.css` under
    `@layer tokens`.
  - KEEP the JS-written custom props as `:root` DEFAULTS in tokens.css: `--range-fill`, `--app-vw`,
    `--app-vh`, and theme.ts's `--color-*`. They must remain present as defaults so the runtime
    overrides (theme.ts inline `:root` writes + the resizer) still cascade on top. Do NOT delete them
    and do NOT move them out of `:root`.
  - Wire the entry/entries to load `tokens.css` (import in the order the `@layer` statement fixed).
Slice 4 - `src/styles/base.css`:
  - Move the reset / scrollbar / `@supports` / forms block (index 270-625) verbatim into `base.css`
    under `@layer base`.
  - Any `backdrop-filter` declaration must be emitted -webkit-first (`-webkit-backdrop-filter` BEFORE
    `backdrop-filter`) to survive the Lightning minify reorder gotcha; verify after build.
  - Remove the now-moved blocks from `index.html`'s inline `<style>` (and play.html if it shares the
    identical token/base block; if play.html differs, DO NOT reconcile here, that delta is P4's
    .extra split). Leave the rest of the inline `<style>` intact for P2-P4.

INVARIANTS THIS PHASE MUST KEEP (from state.md locked decisions + non-negotiable constraints):
- Presentation only: no `hud.ts` logic edit, no `IWorld` change, no `src/sim`/`server`/`src/net`/
  `headless` touch. If you find you need any of these, STOP (scope change).
- Vanilla only: the one allowed build-time dependency is Lightning CSS (devDependency). Add nothing
  else.
- Encapsulation is `@layer` + `#id`-prefix; the `@scope` future-layer stays deferred (browser floor).
- Keep JS-written custom props (`--range-fill`/`--app-vw`/`--app-vh`/theme.ts `--color-*`) present in
  `:root` so runtime overrides still apply (Top risk #6).
- backdrop-filter emitted -webkit-first (Lightning minify gotcha).
- No new player-visible strings in this phase, so no `t()` work; if you somehow touch a label, it is a
  `t()` key in `src/ui/i18n.catalog/hud_chrome.ts` (English-only) and never an `i18n.locales` edit.
- Shared worktree: commit with EXPLICIT paths, never `git add -A`.
- No em dashes, en dashes, or emojis anywhere (CSS, comments, commits, docs).

Out of scope (do NOT do in this phase):
- The in-world HUD chrome CSS (frames/bars/nameplates/FCT/vignette) -> P2.
- Modal + feature-window CSS -> P3.
- The pre-game shell + mobile CSS, and the index.extra/play.extra preserve-both-exactly split -> P4.
- The `ui_effects_profile` resolver, `data-fx-level`, `--fx-*` consumption -> P5.
- Any per-frame / painter / PainterHost work -> P6+.
- Emptying the inline `<style>` blocks fully; this phase only removes the tokens+base sections.

STEP 3 - VALIDATION + REVIEW:
Run the CSS / HTML-entry row of the state.md validation matrix:
- `npx tsc --noEmit` (baseline).
- `npx vitest run tests/css_corpus.test.ts` (the P0 completeness guard now accounts for tokens+base).
- `npx vitest run tests/client_shell.test.ts`.
- `npm run build` (all 4 entries: index, play, admin, guide) resolves under the `@layer` order.
- backdrop-filter survival check: grep the built CSS to confirm `-webkit-backdrop-filter` is emitted
  before `backdrop-filter` and neither was dropped by the minifier.
- `biome check` on the new `src/styles/*.css`.
- Confirm theme.ts runtime overrides still apply (the `--color-*` defaults in tokens.css are
  overridden by theme.ts's `:root` writes; the `--range-fill`/`--app-vw`/`--app-vh` defaults remain
  writable at runtime).
This is NOT a per-frame phase, so NO perf gate runs here.
Review dispatch: `qa-checklist` only. No `privacy-security-review` (no server/net/admin/secret/sim
touch), no `migration-safety` (no DDL), no `cross-platform-sync` (no IWorld/sim/wire/i18n-matcher
change). Prompt the reviewer for COVERAGE; do not commit until it reports no BLOCKING.

STEP 4 - COMMIT CADENCE (2-5 Conventional Commits, scope + explicit paths; never `git add -A`):
- `build(css): flip Vite to Lightning CSS + big-3 browserslist floor`
  paths: `vite.config.ts .browserslistrc package.json package-lock.json tsconfig.json`
- `style(css): declare the single @layer order (tokens/base/layout/components/hud/extras)`
  paths: the entry that hosts the `@layer` statement + any new `src/styles/index` barrel if used
- `refactor(css): extract :root design tokens into src/styles/tokens.css`
  paths: `src/styles/tokens.css index.html`
- `refactor(css): extract reset/scrollbar/@supports/forms into src/styles/base.css`
  paths: `src/styles/base.css index.html`
Keep each commit to its explicit file list.

STEP 5 - ACCEPTANCE CRITERIA (all verifiable and green):
[ ] `npx tsc --noEmit` clean.
[ ] `vite.config.ts` uses the Lightning CSS transformer; `.browserslistrc` exists with the big-3
    floor; Lightning CSS is a devDependency only (no other new dependency).
[ ] The single `@layer` order is declared exactly once (tokens, base, layout, components, hud, then
    the per-entry extras), with tokens+base filled and the later layers declared-but-empty.
[ ] `src/styles/tokens.css` holds the index 186-269 `:root` tokens verbatim under `@layer tokens`;
    the JS-written custom props (`--range-fill`, `--app-vw`, `--app-vh`) and theme.ts `--color-*`
    remain as `:root` defaults and are NOT removed or relocated.
[ ] `src/styles/base.css` holds the index 270-625 reset/scrollbar/@supports/forms verbatim under
    `@layer base`.
[ ] The tokens and base blocks are removed from the inline `<style>` and now load from `src/styles/`;
    the rest of the inline `<style>` (HUD/windows/shell) is untouched.
[ ] `npx vitest run tests/css_corpus.test.ts` green: the corpus accounts for the tokens + base
    sections (zero rule loss vs the inline source).
[ ] `npx vitest run tests/client_shell.test.ts` green.
[ ] `npm run build` builds all 4 entries (index, play, admin, guide) and resolves under `@layer`.
[ ] backdrop-filter is emitted -webkit-first in the built CSS and no backdrop-filter rule was dropped.
[ ] `biome check` clean on `src/styles/*.css`.
[ ] theme.ts runtime `--color-*` overrides and the `--range-fill`/`--app-vw`/`--app-vh` runtime writes
    still apply (defaults present, overridable).
[ ] `qa-checklist` reviewer verdict: no BLOCKING.

STEP 6 - DOC UPDATES + MEMORY:
- Update `progress.md`: mark P1 done, record the new files (`src/styles/tokens.css`,
  `src/styles/base.css`, `.browserslistrc`), the Lightning CSS pin, and the declared `@layer` order.
- Update `state.md`: flip the P1 ledger row to done; note in the Key file paths block that the
  Lightning flip and `.browserslistrc` have landed and that the `@layer` order is now declared (later
  CSS phases only fill layers).
- Record any surprising rule in memory (e.g. a Lightning targets value V16 needs that FB did not, or a
  token V16 added since FB that must stay a `:root` default).

STEP 7 - FINAL RESPONSE:
Report: status (done / blocked), the files changed (absolute paths), the validation results (tsc,
css_corpus, client_shell, build x4, backdrop survival, biome), the `qa-checklist` reviewer verdict,
and any deferrals. End with exactly:
Next: phase-02-css-hud-chrome.md

STOPPING RULES (phase-specific):
- STOP if a token or base rule cannot be moved without changing the cascade (a duplicate selector, an
  ordering dependency on a later block, or a specificity that the `@layer` order would alter). Surface
  it; do not silently reorder.
- STOP and ask if `git status` is dirty at pre-flight (shared checkout).
- STOP (scope change) if the work appears to require editing `hud.ts`, `IWorld`, `src/sim`,
  `server`, `src/net`, or `headless`, or adding any dependency other than Lightning CSS.
- STOP if play.html's token/base block diverges from index.html's: do NOT reconcile it here, that
  delta belongs to P4's index.extra/play.extra split. Note it and move on.
- STOP if css_corpus cannot be made green without weakening the guard; the guard is the safety net,
  not an obstacle to route around.
```

## Notes for the planner

P1 is shaped as the smallest, lowest-risk CSS slice on purpose: it lands the build pipeline (Lightning
flip) and the cascade contract (the one `@layer` order, declared but mostly empty) so that P2-P4 each
just fill a layer against a fixed order, never re-litigating cascade. The key risk is silent
cascade/rule-drop (Top risk #6): moving the `:root` tokens while keeping the JS-written and theme.ts
custom props as overridable `:root` defaults, and emitting backdrop-filter -webkit-first through
Lightning's minifier. It is intentionally NOT ultracode and NOT fanned out, because tokens and base are
two contiguous blocks that must be diffed rule-for-rule against the inline source, which a single
careful orchestrator does better than parallel agents. De-risks every later CSS phase by proving the
Lightning build, the css_corpus accounting, and the layer order before any HUD/window CSS moves.
