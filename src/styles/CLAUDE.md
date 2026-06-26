<!-- src/styles/ - extracted HUD CSS (tokens + @layer order). Local detail only; the
     no-em-dash/ASCII rule, the IWorld seam, and "files-can-be-huge" live in root
     CLAUDE.md. The painters that drive these tokens are in src/ui (see src/ui/CLAUDE.md). -->

# src/styles/ - extracted HUD CSS (tokens + layers)

All game CSS for the two game entries (`index.html` + `play.html`), extracted from the old
inline `<style>` blocks (P1-P4b) into one directory under a single `@layer` order, imported
once from `src/main.ts` via the `index.css` barrel (admin/guide keep their own entries). No
CSS framework; hand-authored, Lightning-compiled.

## Module shape and the @layer order
`index.css` is the barrel: it declares ONE `@layer` order and `@import`s every module in
that order. Modules, in cascade order:
| Layer | Module | What it is |
|---|---|---|
| `tokens` | `tokens.css` | `:root` design tokens + `--color-*` / `--fx-*` defaults |
| `base` | `base.css` | element + reset + base-tier glyph styling + the a11y skip/forced-colors/print sections |
| `layout` | `layout.css` | the generic `.window` centering/shell |
| `components` | `hud.css`, `components.css` | in-world HUD chrome; feature-window bodies |
| `hud-mobile` | `hud.mobile.css` | the in-game mobile-touch block |
| `shell` | `shell.css` | desktop pre-game shell + char-select |
| `index-extra` / `play-extra` | `index.extra.css` / `play.extra.css` | per-entry only: the `#rotate-device` orientation gate (decision 16a) |

Flat layer names (`hud-mobile`, not `hud.mobile`): a DOT in a `@layer` name is a SUBLAYER,
which silently reorders the cascade. The completeness of the section set is guarded by
`tests/css_corpus.test.ts` (the ten-dash `/* ---- name ---- */` banner manifest, corpus =
the inline `<style>` UNION `src/styles/*.css`); the barrel's `@import` set + order is
guarded by `tests/styles_extraction.test.ts`.

## Token system + NO magic values in painters
- **Tokens, not literals.** Colors, accents, and tunables live as `--color-*` / `--fx-*`
  custom properties in `tokens.css`. A painter (`src/ui/*_painter.ts`) drives those tokens /
  CSS vars and NEVER hard-codes a hex/px/color in TS; thresholds and cadences (the
  100/250/500ms frame dividers, breakpoints) are named constants. CANVAS painters
  (map/arena/minimap/delve/nameplate) resolve `--color-*` via `getComputedStyle` ONCE per
  redraw (cached), never per-marker. Guarded by the per-painter no-magic-values source
  guards (the painter tests that scan their source for raw hex/rgb/px, e.g.
  `tests/auras_painter.test.ts`, `tests/minimap_painter.test.ts`,
  `tests/action_bar_painter.test.ts`) and `tests/focus_visible_guard.test.ts` (focus rings
  drawn from a token / system color, never a raw hex). There is no single central
  no-magic-values guard; each migrated painter carries its own source scan.
- **One dark aesthetic.** `src/ui/theme.ts` computes the runtime `--color-*` accent vars
  (`themeCssVars`), applied by `applyTheme()` in `src/main.ts`. There is NO light theme and
  no `prefers-color-scheme` adaptation; the ONE contrast adaptation is
  `@media (forced-colors: active)` (borders + focus ring survive via system colors).

## Browser matrix
- **Floor (enforced today):** the big-3 desktop PLUS mobile Safari/WebKit as a first-class
  target, pinned in `.browserslistrc` (Chrome/FF/Safari/iOS minimums) and fed to Lightning
  via the zero-dep parser (`scripts/browserslist_targets.mjs`); no `browserslist` npm dep. A
  `forced-colors` pass and a MINIMAL `@media print` reset (hide `#game-canvas`/`#ui`/
  `#nameplates`, no reflow; a full-screen game has no print layout) ship in `base.css`.
- **Pending P17b:** the cross-engine E2E that actually RUNS the suite on WebKit/Firefox in
  CI is not wired yet (`vitest.browser.config.ts` lists chromium only). Documented here, not
  enforced today.

## Bundle discipline (pending P17b)
The intended policy (NO CI gate yet, documented only at P16 time): a JS bundle-budget CI
gate (sibling to `asset:budget` / `scripts/asset_budget.mjs`); then measure each
cold-window's cost FIRST and SELECTIVELY dynamic-import only the genuinely heavy +
rarely-opened windows (keep frequently-opened ones eager), each lazy window carrying an a11y
loading-state contract (aria-busy / role=status + focus-return across the async swap).
Evidence-driven, never blanket splitting. The gate, the selective lazy-load, and the
cross-engine E2E all land in P17b.

## Pointers
Root `CLAUDE.md` (repo-wide invariants incl gameplay-neutral graphics) ·
`src/ui/CLAUDE.md` (the painters that drive these tokens + the a11y/perf contracts) ·
`docs/frontend-modernization/state.md` (the locked decisions + validation matrix).
