# Phase P4: CSS C: pre-game shell + mobile + per-entry .extra

Move the last big CSS block (pre-game shell, mobile touch, char-select) out of the inline
`<style>` of `index.html`/`play.html` into `shell.css` + `hud.mobile.css`, then diff the two
entries and split the index-only and play-only deltas into `index.extra.css`/`play.extra.css`.
This empties both inline `<style>` blocks and completes the CSS extraction (P1-P4).

## Starter Prompt

```
This is Phase P4 of the Frontend Modernization v0.16.0 packet: CSS C: pre-game shell + mobile + per-entry .extra.

Model: Opus 4.8, xhigh effort. Harness: Claude Code.

Worktree: /Users/fernando/Documents/wocc-v0.16.0 (branch feature/frontend-modernization-v016, off release/v0.16.0).

ULTRACODE: yes. This is a batch-heavy CSS-C move (shell + mobile + char-select, ~6k lines of index 2456-8274) plus a two-entry diff/split; fan out parallel slices with adversarial section-by-section verification against the css_corpus guard.

Goal: Extract the pre-game shell and mobile CSS out of the inline <style> of index.html (and the play.html equivalents) into src/styles/shell.css and src/styles/hud.mobile.css, then diff index.html vs play.html and split the index-only (~976 lines) and play-only (~60 lines) deltas into index.extra.css and play.extra.css using the preserve-both-exactly rule. After this phase both inline <style> blocks are empty and all CSS lives under the single @layer order from P1. Zero rule loss: the css_corpus section-by-section guard must account for every moved section and the rendered cascade must be byte-identical.

STEP 0 - PRE-FLIGHT:
- Run `git status`. It must be clean. If it is not, STOP and ask the user (this checkout is shared with concurrent sessions).
- Confirm you are in the /Users/fernando/Documents/wocc-v0.16.0 worktree on branch feature/frontend-modernization-v016.
- Memory scan: read MEMORY.md and the relevant entries:
  - frontend-phase2-css-extraction (play.html preserve-both-exactly: index.extra/play.extra split, single @layer order)
  - frontend-phase5-mobile-landscape (mobile-landscape rules: canvas carve-out, 16px anti-zoom floor, dvh-vs-svh, --keyboard-inset chat lift, CDP-real-insets E2E gotcha)
  - frontend-phase4-lightningcss-flip (backdrop-filter -webkit-first minify gotcha, big-3 .browserslistrc floor)
  - frontend-architecture-vanilla-stack (vanilla direction, src/styles module shape)
  - phased-packet-qa-cadence (always run the phase-NN-qa pass after impl)

STEP 1 - LOAD CONTEXT (do NOT read hud.ts (14,377 lines) or the HTML entries whole):
Spawn ONE Explore agent to read and summarize, returning a compact summary to the orchestrator (not raw dumps):
- docs/frontend-modernization/state.md (locked decisions 1,2,7; non-negotiable constraints; canonical workflow; validation matrix CSS row; Top risk 6 CSS cascade).
- docs/frontend-modernization/phase-04-css-shell-mobile-extra.md (this file).
- The "### P4" section of docs/frontend-modernization/v016-recon-and-packet.md plus "Load-bearing structural findings", "Reuse from FB", and Top risk 6.
- The SPECIFIC source ranges this phase touches: index.html inline <style> lines 2456-8274 (start screen, loading, login, backdrop, chat, party frames, context menu, trade, controls drawer, mobile touch 5758-7027, char-select); and the play.html inline <style> block (to diff against index.html). Have the agent emit the `/* ---- name ---- */` section list across that range and the index-vs-play delta map, NOT the full CSS text.
- The FB source files to port: src/styles/shell.css, src/styles/hud.mobile.css, src/styles/index.extra.css, src/styles/play.extra.css from the completed feature/frontend-modernization branch (read-only SOURCE; ~70% ports file-for-file, but re-derive against V16's actual section list since V16 is the larger base).
The orchestrator keeps the section list + delta map.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE:
Default to parallel fan-out, one slice per cohesive CSS cohort. Concrete slices (all keyed on the `/* ---- name ---- */` section comments from index 2456-8274):
- Slice A (shell.css desktop): start screen, loading screen, login/auth, backdrop, chat, party frames CSS, context menu, trade window, controls drawer, char-select. Move every desktop shell section verbatim into src/styles/shell.css under the P1 @layer order, preserving source order within a layer.
- Slice B (hud.mobile.css): the mobile touch block 5758-7027 (touch controls, mobile layout, landscape rules). Move verbatim into src/styles/hud.mobile.css. Keep the dvh-vs-svh split, the 16px anti-zoom floor, --keyboard-inset, and orientation-lock rules exactly (see frontend-phase5 memory).
- Slice C (per-entry .extra split): diff index.html vs play.html inline <style>. Put shared rules in shell.css/hud.mobile.css; put index-only deltas (~976 lines) in src/styles/index.extra.css and play-only deltas (~60 lines) in src/styles/play.extra.css. PRESERVE BOTH EXACTLY: never collapse an index rule onto play or vice versa; if a selector differs by one property, the differing rule goes to the matching .extra file. Wire each entry's <link>/import so index gets index.extra and play gets play.extra; both get shell + hud.mobile.
- Integration (sequential, after A/B/C): empty both inline <style> blocks, wire the new files into the @layer order from P1, run the css_corpus guard, reconcile any section the guard reports as unaccounted.
Request fan-out EXPLICITLY: spawn Slice A, B, C in parallel (use isolation: "worktree" if they touch the same index.html lines; otherwise plain agents writing distinct src/styles/*.css). Reserve index.html/play.html edits (the <style> emptying + <link> wiring) for the sequential integration step so the agents do not race the entry files.

INVARIANTS THIS PHASE MUST KEEP (from state.md):
- CSS-only, presentation-only: no behavior change, no hud.ts edit, no IWorld touch, no sim/server/net.
- Zero rule loss and zero cascade change: source order within a @layer is preserved; JS-written custom props (--range-fill/--app-vw/--app-vh, theme.ts --color-*) stay as :root defaults (do not move or drop them). Top risk 6.
- backdrop-filter must be emitted -webkit-first (Lightning minify gotcha); keep -webkit-backdrop-filter before backdrop-filter in any moved rule.
- preserve-both-exactly: index and play inline blocks are NOT merged; their deltas split into the matching .extra file.
- Single @layer order from P1; do not introduce a new layer.
- No new player-visible strings, so no t() work; if a moved rule references a label, that label stays in hud_chrome.ts (English-only) and is untouched here.
- No em dashes, en dashes, or emojis in CSS, comments, or commits.
- Shared worktree: commit with EXPLICIT paths, never git add -A.

Out of scope (do NOT do in this phase):
- Any per-frame or hot-path work (P10-P14).
- The ui_effects_profile resolver / --fx-* consumption (P5); do not add --fx-* hooks to moved rules.
- HUD chrome CSS (P2) and modal/feature-window CSS (P3); those blocks are already extracted by the prior phases. If you find a chrome/window section still inline, it belongs to P2/P3, not here. Move ONLY the shell/mobile/char-select sections in 2456-8274.
- PainterHost / cold-window extraction (P6-P9).
- Any mobile-landscape behavior change beyond moving the existing rules verbatim.

STEP 3 - VALIDATION + REVIEW:
Run the CSS / HTML-entry validation-matrix rows (state.md):
- `npx tsc --noEmit` (baseline).
- `npx vitest run tests/css_corpus.test.ts` (the section-by-section completeness guard: every moved section must be accounted for, zero rule loss).
- `npx vitest run tests/client_shell.test.ts` (entry/shell DOM integrity).
- `npm run build` (all 4 entries: index, play, admin, guide) resolves under @layer.
- The backdrop-filter survival check (moved rules still emit -webkit-first after Lightning minify).
- `biome check` on the new/changed .css files.
- Smoke: shell (start screen, loading, login, char-select) and mobile (touch controls, landscape) render unchanged; both inline <style> blocks are empty.
Review dispatch (Review Dispatch Matrix): qa-checklist only. No server/admin/net/IWorld/sim surface is touched, so privacy-security-review, migration-safety, and cross-platform-sync do NOT fire. Prompt the reviewer for COVERAGE (every dropped/reordered rule, every cascade or .extra-split error), not filtering; do not commit until it reports no BLOCKING. Resume a truncated reviewer with the standard "Stop reading more files, output the full report now" prompt.

STEP 4 - COMMIT CADENCE:
2-5 Conventional Commits, scope `css`, EXPLICIT paths. Example messages:
- `style(css): extract pre-game shell into src/styles/shell.css` (paths: src/styles/shell.css)
- `style(css): extract mobile touch CSS into src/styles/hud.mobile.css` (paths: src/styles/hud.mobile.css)
- `style(css): split index-only/play-only deltas into per-entry .extra` (paths: src/styles/index.extra.css, src/styles/play.extra.css)
- `refactor(css): empty inline <style> blocks and wire shell/mobile/.extra under @layer` (paths: index.html, play.html, and any @layer index file)
- `test(css): account for shell/mobile/.extra sections in css_corpus` (paths: tests/css_corpus.test.ts if the guard needs the new sections registered)

STEP 5 - ACCEPTANCE CRITERIA:
- [ ] index.html and play.html inline `<style>` blocks are both EMPTY (all shell/mobile/char-select CSS moved out).
- [ ] index 2456-8274 sections (start screen, loading, login, backdrop, chat, party frames, context menu, trade, controls drawer, mobile touch 5758-7027, char-select) are moved into src/styles/shell.css + src/styles/hud.mobile.css, verbatim, source order preserved within each @layer.
- [ ] index-only deltas (~976 lines) live in src/styles/index.extra.css and play-only deltas (~60 lines) in src/styles/play.extra.css; preserve-both-exactly (no index rule merged onto play or vice versa).
- [ ] `npx vitest run tests/css_corpus.test.ts` is green and accounts for 100% of the moved sections (zero rule loss).
- [ ] `npx vitest run tests/client_shell.test.ts` green.
- [ ] `npm run build` resolves all 4 entries (index, play, admin, guide) under the single @layer order.
- [ ] `biome check` clean on the new/changed .css.
- [ ] backdrop-filter rules still emit -webkit-first after Lightning minify (survival check passes).
- [ ] JS-written custom props (--range-fill/--app-vw/--app-vh, theme.ts --color-*) remain :root defaults; none dropped or reparented.
- [ ] Shell + mobile + char-select smoke render unchanged (no visual/cascade diff).
- [ ] `npx tsc --noEmit` green.

STEP 6 - DOC UPDATES + MEMORY:
- Update progress.md: mark P4 complete, list the new files (shell.css, hud.mobile.css, index.extra.css, play.extra.css), and note both inline <style> blocks are now empty (CSS extraction P1-P4 done).
- Update the state.md ledger: P4 row to done; note in the Key file paths that the inline entry styles are emptied and the full src/styles set exists.
- Record surprising rules in memory: any V16-vs-FB section drift in the shell/mobile range, any new index-only or play-only delta the FB split did not have, and any css_corpus section the guard required registering.

STEP 7 - FINAL RESPONSE:
Report status, the files changed (absolute paths), validation results (tsc, css_corpus, client_shell, build x4, biome, backdrop survival), the qa-checklist reviewer verdict, and any deferrals. End with exactly:
Next: phase-05-ui-effects-profile.md

STOPPING RULES:
- STOP if a CSS rule cannot be moved out of the inline <style> without changing the rendered cascade (order-of-declaration or specificity dependency you cannot preserve under @layer). Surface it; do not guess a reorder.
- STOP if the css_corpus guard reports a section it cannot account for after a good-faith reconcile (it means a rule was dropped or duplicated).
- STOP if the index-vs-play diff is ambiguous (a rule that is "almost" shared): default to the safe split (put it in BOTH .extra files exactly as each entry had it) rather than merging, and note it.
- STOP and surface as a scope change if the phase appears to need a hud.ts edit, an IWorld extension, or any non-CSS source change.
- STOP if backdrop-filter survival regresses (emitted -webkit-last after minify).
```

## Notes for the planner

This phase is shaped as the third and final CSS-extraction move (after P2 chrome and P3 windows),
so it inherits the proven preserve-both-exactly index/play split and the section-by-section
css_corpus guard rather than reinventing them; the only genuinely new judgement is the two-entry
delta map on the larger V16 base, which is why the per-entry .extra split is its own slice with an
explicit "split, never merge" rule. The key risk is silent cascade change from reordering or
dropping one of the ~6k lines in 2456-8274 (Top risk 6), de-risked by moving sections verbatim in
source order and letting the css_corpus guard prove completeness section by section. Completing P4
empties both inline `<style>` blocks, which is the precondition that lets P5 add `--fx-*`
consumption to clean, layered CSS files instead of an inline monolith.
