# brainstorm.md - i18n Lazy Locales

> This is NOT a re-derivation of the design. The full, audited engineering design (818 lines, web-validated + adversarially verified on 2026-06-17) lives at [`../phase-3-lazy-locales-and-contributor-workflow.md`](../phase-3-lazy-locales-and-contributor-workflow.md). Read it for the deep rationale. This file captures only the vision, the current-state delta a fresh session needs, the reusable pieces, the locked decisions, and the OPEN items.

## Vision
Today the client ships ALL 14 locales inlined in one dense ~2.1 MB / 583 KB-gzip resolved table baked into the main chunk. A player who only ever sees English still downloads 13 locales they will never use (~540 KB gzip, ~48% of the main chunk's i18n cost). The vision: ship English eagerly, lazy-load each non-English locale as its own content-hashed chunk fetched only when selected, and keep the entire `t()` call surface synchronous and unchanged. Net: main client chunk 1.13 MB -> ~590 KB gzip, with no behavior change and no first-paint flash.

This is the load-bearing payload win of the whole i18n-scaling program, plus the contributor-workflow change (English-only PRs, maintainer fills at release) that already landed.

## Current state (verified 2026-06-17 against `release/v0.9`)
The codebase is entirely on the eager / single-dense-file / synchronous-`t()` model. None of the lazy machinery exists:
- `scripts/i18n_build.mjs` + `scripts/i18n_admin_build.mjs` each emit ONE dense `*.resolved.generated.ts` with all 14 locales inlined. No per-locale split, no `I18N_OUT_DIR`, no barrel.
- `src/ui/i18n.ts` static-imports that file and reads it synchronously. No `ensureLocaleLoaded` / `resident` / `inflight` / dynamic `import()`. localStorage key is `"locale"`; the picker uses `setLanguage` (there is no `switchLanguage`).
- `src/main.ts` `startGame` (async, line 525) calls `t()` immediately (line 529) with no await; the picker handler (3398-3412) is fully synchronous.
- `index.html` has no `<link rel=modulepreload>` and no inline locale boot script.
- CI (`.github/workflows/ci.yml`) has no i18n step; generation runs only transitively via `pretest`/`build`. `i18n:hash` is manual + test-verified.
- `src/ui/i18n.status.json` (4.46 MB) is git-tracked; `.gitattributes` is empty.
- Both canary tests exist and assert the eager/sync model: `tests/homepage_foundation.test.ts` (sync `t()` right after `setLanguage` across 12 locales) and `tests/i18n_t_behavior.test.ts` (mocks the single-file `i18n.resolved.generated` module to inject a synthetic pending key).
- SHA gate `scripts/i18n_resolved_hash.mjs` hashes `i18n.ts` EXPORTS (split-invariant). `release/v0.9` baseline: `d74aeb6..b2e4d`.

What already landed (do NOT redo): the entire contributor-policy package in commit `a36a94c7` (root + `src/ui` + `src/admin` CLAUDE.md edits, and `../translation-workflow.md`). Phase 5 of the design doc (docs) is otherwise just a worklist-index tidy.

## Reusable pieces (lean on these, do not reinvent)
- **The emit/resolve pipeline** in `scripts/i18n_build.mjs` (resolve, deep-merge each locale onto `en`, dialect base resolution, pending computation, `en_XA` pseudo-localize) is correct and stays untouched - only the EMIT stage changes (one file -> a directory of modules).
- **The SHA gate** (`i18n_resolved_hash.mjs`) already hashes exports, so it is invariant under the split; no harness change needed (Option 3a).
- **The `en_XA` dev pseudo-locale machinery** (separate export, prod tree-shake via `import.meta.env.PROD`) is the proven pattern the lazy flip mirrors for dev-only exclusion.
- **The two-tier i18n gate** (PR-tier permissive, release-tier `pending===0`) and the registry/scanner stay; Phase 5 only swaps `status.json`'s freshness check for a determinism check.
- **The proven industry pattern** (i18next `partialBundledLanguages` + `fallbackLng`, vue-i18n load-then-flip so `$t` stays sync) - the design is a hand-rolled instance of it; the audit confirmed parity with best practice on every axis.

## New work needed (by surface)
- **build (scripts/):** per-locale directory emit + barrel + `loaders.ts` + `pending.ts` + `I18N_OUT_DIR`, mirrored in admin (Phase 1, 5).
- **ui runtime (src/ui/i18n.ts):** the async loader surface, then the static->lazy flip (Phase 2, 3); 3 new `t()` keys (Phase 2); the `i18n.en.ts` module split (Phase 6).
- **bootstrap (src/main.ts):** await before first paint + await in the picker (Phase 2).
- **client HTML (index.html):** modulepreload + inline boot script (Phase 4).
- **CI / git (.github, .gitignore, .gitattributes, package.json):** `i18n:gen` step, gitignore `status.json`, `linguist-generated`, `assertDeterministic` (Phase 5).
- **admin:** structural mirror of the file split + async surface, but NO lazy flip (deferred by decision).
- **headless / RL:** none (out of scope).

## Decisions locked in this packet
- **Q6 (the `i18n.en.ts` directory split): IN, as Phase 6.** The maintainer chose to finish the whole design in one packet rather than spin a follow-up. It is byte-identical and public-surface-preserving, so it carries low risk; it is sequenced last because it is the largest human-source change and orthogonal to the bundle win.
- **Integration: `feature/i18n-lazy-locales` -> PR into `release/v0.9`.** Keeps the work on the active release line where the design doc and all prior i18n work live; the release-tier gate validates completeness.
- All other design-doc open questions (Q1-Q5) were already closed in the doc: admin lazy-load deferred; ship `status.summary.json`; prefer Option 3a with a 3b fallback; ship both modulepreload and runtime prefetch; keep the glossary at `scripts/i18n_glossary.json`.

## OPEN items (carry into the phases)
- **Release-tier fill of the 3 Phase 2 keys** - maintainer action (Fernando), gates the release-tier merge not the PR. Recommended to do inside Phase 2.
- **The tree-shake probe in Phase 3 is the one place reality could diverge from plan.** If Rollup does not drop the re-exported dense consts from the app chunk (the `gameStrings = en.game` indirection exists precisely because this hazard bit before), Phase 3 falls to Option 3b. That fallback is fully specified; it is not a blocker, just a branch.
- **Soak cadence:** the design doc wants Phase 3 to soak on a preview deploy for a release cycle before Phase 4/5. The packet sequences phases so this is natural (Phase 3 is independently revertible), but the maintainer controls when each later phase session starts.

## Out of scope (explicit)
- Admin lazy-loading (file split only).
- Any `src/sim/` / `server/` / `src/net/` / IWorld / wire / persistence change.
- The pre-existing hardcoded-literal follow-ups surfaced by `en_XA` in the earlier pseudo-locale work (minimap/swatch aria-labels, chat tip, version-footer "build"). Those belong to the pseudo-locale effort, not this packet; tracked there.
- Adopting a TMS (Crowdin/Weblate/etc.) or an RTL/fake-bidi pseudo-locale - forward notes only.
