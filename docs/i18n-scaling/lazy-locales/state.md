# state.md - i18n Lazy Locales (cross-phase cheat sheet)

The single source of truth a fresh session reads before any phase. Record once, reference forever.

## Current status
- **Active phase:** Phase 1 (not started)
- **Branch:** all code work on `feature/i18n-lazy-locales` (cut off `release/v0.9`), PR'd back into `release/v0.9`. Planning docs were committed on `release/v0.9` directly.
- **Canonical design:** `docs/i18n-scaling/phase-3-lazy-locales-and-contributor-workflow.md` (818 lines, audited 2026-06-17). This packet decomposes that doc's code Steps 1-4 into Phases 1-5; Phase 6 is the doc's open Q6 (the `i18n.en.ts` directory split), which the maintainer chose to include.

## What this feature is
Ship English eagerly and lazy-load every non-English locale as its own content-hashed chunk. A default-English visitor downloads zero non-English locale bytes (~540 KB gzip dropped, main chunk 1.13 MB -> ~590 KB gzip). `t()` stays synchronous forever.

## Scope boundary (READ THIS - it changes which reviewers run)
This feature touches ONLY: `src/ui/i18n.ts` (runtime), `scripts/i18n_build.mjs` + `scripts/i18n_admin_build.mjs` + `scripts/i18n_scan.mjs` + `scripts/i18n_resolved_hash.mjs` (build), `src/main.ts` (bootstrap + picker), `src/admin/i18n.ts` + `src/admin/main.ts` (mirror), `index.html` (modulepreload), `.github/workflows/ci.yml` + `.gitignore` + `.gitattributes` + `package.json` (CI/hygiene), `tests/`, and (Phase 6) `src/ui/i18n.en.ts` -> `src/ui/i18n.en/`.

It does **NOT** touch `src/sim/`, `server/`, `src/net/`, `src/world_api.ts` (IWorld), the wire protocol, snapshots, persistence/DDL, or the RL surface. Consequently:
- **NO new IWorld members, SimEvents, wire fields, endpoints, or DB tables.**
- `cross-platform-sync` review is **NOT** triggered by any phase (no sim/server behavior, no `sim_i18n`/`server_i18n` matcher change). The 3 new keys in Phase 2 are pure client `main`-scope `t()` keys, not sim/server emits.
- `migration-safety` review is **NOT** triggered by any phase (no DDL, no `characters.state` shape change).
- `privacy-security-review` IS triggered by **Phase 5 only** (it edits `.github/workflows/ci.yml`, a CI file in the matrix). Phase 4 may optionally get a light privacy-security pass for the inline `<script>`/CSP angle (not required by the matrix).

## Locked design decisions (do not relitigate)
1. **`t()` stays synchronous forever.** Never make it async (would force `await` through 600+ call sites; determinism/timing hazard). The only async surface is `ensureLocaleLoaded` at the bootstrap + picker boundaries.
2. **Resident-table map + English fallback + await-before-paint.** `t()` reads `resident[lang] ?? resident.en!`. English is statically imported (eager default + universal sync fallback). Non-English chunks are dynamic-`import()`ed and awaited behind the loading screen before first paint.
3. **Per-locale emit split into a generated DIRECTORY with a back-compat barrel.** `src/ui/i18n.resolved.generated.ts` (single file) becomes `src/ui/i18n.resolved.generated/` with `index.ts` (barrel), `pending.ts`, `loaders.ts` (`LOCALE_LOADERS` + `SUPPORTED_LANGUAGES`), one dense `<lang>.ts` per locale, and `en_XA.ts`. Same for admin.
4. **Admin gets the file split for parity but NOT lazy-loading.** `src/admin/i18n.ts` keeps its static import (admin is ~38 KB gzip; operators are not the mobile target). The async surface is mirrored structurally; the static->lazy flip is deferred for admin.
5. **`en_XA` pseudo-locale:** re-exported by the barrel, absent from `LOCALE_LOADERS` / `translations` / `SUPPORTED_LANGUAGES`. Dev-only behind `!import.meta.env.PROD`, prod-tree-shaken. Do NOT route it through `LOCALE_LOADERS`.
6. **Dialects (`es_ES`, `fr_CA`, `en_CA`) stay build-time dense / standalone.** Each emitted `<dialect>.ts` is fully resolved (does NOT `import` its base and spread). No import-time composition (breaks determinism / double-downloads the base).
7. **Lazy flip = Option 3a, gated on a hard tree-shake probe.** Keep `i18n.ts` re-exporting the dense locale consts; verify Rollup drops them from the app chunk by measuring `dist/assets/main-*.js` gzip (~590 KB target). Fall to **Option 3b** (repoint const-importing tests + the hash harness at the generated `index.ts` directly) only if the probe fails. 3b is its own commit for bisect isolation.
8. **Ship BOTH** runtime prefetch AND an explicit `<link rel="modulepreload">` for the stored locale (Phase 4). The `<link>` is the only fix for the runtime-selected-locale request waterfall (Vite does not auto-hint dynamic, runtime-keyed imports).
9. **Gitignore `src/ui/i18n.status.json`** (4.46 MB, build/test-only). Replace its freshness `git diff` gate with the `assertDeterministic` double-generation check. The committed resolved directories keep `git diff` freshness AND gain the determinism check.
10. **Resolved-table SHA must NOT move.** The hash is invariant under the emit split (it hashes `i18n.ts` exports, not file bytes). Re-baselining to make a red gate green is forbidden. Current `release/v0.9` baseline: `d74aeb631f37f3d8a4374ff9940e450e062aa4062c821ab3349ae7ada28b2e4d` (`src/ui/i18n.resolved.sha256`).
11. **`i18n.en.ts` directory split = Phase 6** (the doc's Q6, decided IN). Public surface unchanged; resolved table byte-identical; SHA unchanged.

## Non-negotiable constraints
- Determinism / reproducibility: every generator is a pure function of source; same input -> byte-identical output (verified by `assertDeterministic` + `git diff --exit-code`).
- `t()` synchronous; never `Math.random`/`Date.now`/`performance.now` (n/a here, but generators stay deterministic - no timestamps in emitted output).
- i18n completeness: every player string is a `t()` key in `en` first; the release-tier gate (`I18N_RELEASE_TIER=1`, active on `release/**`) hard-fails on any `pending` row.
- No generated-file hand-edits: never hand-edit the emitted `i18n.resolved.generated/` modules or `i18n.status.json`; regenerate via the build.
- Shared worktree: stage EXPLICIT paths, never `git add -A`. A concurrent session may share this checkout.
- No em dashes, no emojis in any player-facing text or docs/commits.

## Validation matrix by change type
| Change type | Commands |
|---|---|
| **build-script / emit** (Phase 1, 6) | `npm run i18n:build && npm run i18n:admin && npm run i18n:scan && git diff --exit-code` (byte-identical regen) + `npm run i18n:hash -- --check` (SHA unchanged) + `npx tsc --noEmit` + `npm test` + `npm run build` (gzip within noise of 1.13 MB until Phase 3) |
| **runtime i18n.ts** (Phase 2, 3) | `npx tsc --noEmit` + `npx vitest run tests/i18n_t_behavior.test.ts tests/homepage_foundation.test.ts tests/localization_fixes.test.ts tests/i18n_resolved_equivalence.test.ts` + `npm run i18n:hash -- --check` |
| **lazy-flip probe** (Phase 3) | the runtime row PLUS `npm run build` then `gzip -c dist/assets/main-*.js | wc -c` (target <= ~0.62 MB) and `ls dist/assets/*-*.js` (13 + dialect locale chunks present; `en` not a separate chunk) and a default-load network trace (zero `es-*.js`..`ru_RU-*.js` requests) |
| **index.html / modulepreload** (Phase 4) | `npm run build` + no-double-fetch network check + correct hashed filename from `dist/.vite/manifest.json` + a mobile screenshot script + the throttled TTI probe (Slow-4G + 4x CPU, median of N, delta vs the `main` baseline) |
| **CI / git hygiene** (Phase 5) | fresh-clone `npm ci && npm test` with `src/ui/i18n.status.json` ABSENT pre-build (proves `pretest` regenerates it) + `I18N_RELEASE_TIER=1 npm test` (green on a translated tree, red on a synthetic `pending` row) + `git status` clean after build with no megabyte files tracked |
| **pre-merge full** (mirrors CI) | `npm test && npx tsc --noEmit && npm run build:env && npm run build:server && npm run build` |

## Key file paths
**Existing (touched):**
- `src/ui/i18n.ts` (275 lines) - runtime; static import at lines 1-6, `t()` sync at 188-205, `tableFor` at 181-186, lang state 31/87-103, `setLanguage` 109-113, localStorage key `"locale"`.
- `src/admin/i18n.ts` (161 lines) - admin runtime; static import line 1, `t()` 109-119.
- `scripts/i18n_build.mjs` (226 lines) - game emit; `OUT_PATH` line 30, `emit()` 134-164, `LOCALES` 38-53, `DIALECT_BASE` 63-67, `en_XA` 158-162/215-217.
- `scripts/i18n_admin_build.mjs` (171 lines) - admin emit twin; `OUT_PATH` 30, emit 80-107.
- `scripts/i18n_scan.mjs` - registry scanner -> `src/ui/i18n.status.json`.
- `scripts/i18n_resolved_hash.mjs` (90 lines) - SHA gate; hashes `i18n.ts` exports (lines 38-64), `--write`/`--check` CLI.
- `src/main.ts` (3522 lines) - `startGame` async at 525, first `t()` at 529; picker handler 3398-3412 (no `switchLanguage`, only `setLanguage`).
- `index.html` - head hreflang 26-40, `<html lang="en">`; no modulepreload, no inline boot script.
- `.github/workflows/ci.yml` - `pr-gate` 35-66, `release-gate` 68-103; no i18n step.
- `package.json` - `i18n:*` scripts lines 14-18; `pretest` line 12; `build` line 10.
- `.gitignore` - i18n entries lines 15-16 (only `worklist/` ignored). `.gitattributes` - EMPTY.
- `tests/homepage_foundation.test.ts` (186 lines), `tests/i18n_t_behavior.test.ts` (164 lines), `tests/i18n_resolved_equivalence.test.ts`, `tests/i18n_status_registry.test.ts`, `tests/localization_fixes.test.ts` (S3 guard).
- `src/ui/i18n.en.ts` (~1 MB English source) - Phase 6 split target.

**Created by this feature:**
- `src/ui/i18n.resolved.generated/` (dir: `index.ts`, `pending.ts`, `loaders.ts`, `en.ts`, `es.ts` .. `ru_RU.ts`, `en_XA.ts`) - replaces the single `.ts`.
- `src/admin/i18n.resolved.generated/` (same shape, admin) - replaces the single `.ts`.
- `tests/helpers/i18n_determinism.ts` - `assertDeterministic` helper (Phase 5).
- `src/ui/i18n.en/` (dir: `shell.ts`, `hud.ts`, `abilities.ts`, `quests.ts`, `items.ts`, `game.ts`, `_merge.ts`, `index.ts`) - Phase 6.

## New symbols added per phase
- **Phase 1:** `I18N_OUT_DIR` env var (both build scripts + scanner); generated `index.ts` barrel, `loaders.ts` (`export const LOCALE_LOADERS`, `export const SUPPORTED_LANGUAGES`), `pending.ts`.
- **Phase 2:** in `src/ui/i18n.ts`: `resident` map, `inflight` map, `export async function ensureLocaleLoaded(lang)`, `export function isLocaleResident(lang)`, `reportLocaleLoadFailure(lang, err)`; `tableFor()` gains the `resident[lang] ?? resident.en!` line. Admin: `ensureAdminLocaleLoaded`. New `en` keys: `settings.languageLoadFailed`, `settings.languageLoadUnavailable`, `settings.languageLoading`.
- **Phase 4:** inline boot `<script>` in `index.html`; a post-build hook to resolve the stored locale's hashed chunk from `dist/.vite/manifest.json`; runtime prefetch helper.
- **Phase 5:** `i18n:gen` package script (`i18n:build && i18n:admin && i18n:scan`); `assertDeterministic` in `tests/helpers/i18n_determinism.ts`; optional committed `src/ui/i18n.status.summary.json`.
- **Phase 6:** `src/ui/i18n.en/` modules + barrel; `i18n.en.ts` becomes a thin re-export (public surface unchanged).

## i18n keys added (Phase 2)
`settings.languageLoadFailed`, `settings.languageLoadUnavailable`, `settings.languageLoading` - added to `en` first. **Release-tier note:** because `release/**` runs `I18N_RELEASE_TIER=1`, these 3 keys must be filled in the 10 base/standalone locales before the release-tier gate passes (`es_ES`/`fr_CA` inherit via `DIALECT_BASE`, `en_CA` stays English). The PR-tier gate permits English-only, so the feature-branch PR stays green; the maintainer (Fernando) fills the 3 keys via the 10 base overlays + `npm run i18n:build`/`i18n:admin`/`i18n:scan`/`i18n:hash --write` (recommended: do it within Phase 2).

## Reproducibility / determinism gates (three distinct properties, all kept)
- **Determinism** (same input -> byte-identical output): `assertDeterministic({ script, outFiles, env? })` double-generates into temp dirs via `I18N_OUT_DIR`, perturbing `TZ`/`LC_ALL`/temp path between runs (Phase 5 installs the helper).
- **Freshness** (committed artifact == current output): `git diff --exit-code` against the committed `i18n.resolved.generated/` dirs. Swapped for determinism ONLY for the gitignored `status.json`.
- **Completeness** (every key exists in `en`): `tsc` over each locale's `: EnTranslations` annotation, per file.
- **SHA invariance:** `npm run i18n:hash -- --check` at every step (acceptance gate 1). Baseline `d74aeb6..` must not move.

## OPEN items / gotchas
- **Release-tier fill of the 3 Phase 2 keys** (above) - maintainer action; gates the release-tier merge, not the PR.
- **Test-env dynamic import shape:** under vitest (node, no DOM) `import('./es')` resolves the SOURCE `.ts` with named exports, so `mod.default` is `undefined`. The loader read must be shape-tolerant: `resident[lang] = mod.default ?? mod[lang]`.
- **`import.meta.env.PROD` is not statically replaced under raw vitest** - reuse the existing `isReleaseBuild()` try-catch pattern, not a bare `import.meta.env.PROD`.
- **Torn directory write:** the emit must compute every module fully in memory, then write all (or `rmSync` + recreate), so a crash never leaves a half-written generated dir.
- **Modulepreload manifest resolution (Phase 4):** read the hashed locale-chunk filename from Vite's post-build `manifest.json`; match `crossorigin` to the module request to avoid a double-fetch. Do NOT speculatively preload other locales.
- **Stale-chunk window on deploy (R11):** a returning user mid-deploy may 404 an old chunk hash; the immutable `/assets/*` cache + `no-cache` index.html + the loader's English-fallback covers it. No `server/static_cache.ts` change needed.
- **No `manualChunks` change in `vite.config.ts`** - Rollup auto-splits on the `loaders.ts` `import()` thunks.

## Architecture notes (locked)
- One sim, three hosts: untouched (this is client UI + build only).
- The resolved-table SHA gate is the determinism anchor; treat a moved SHA as a real bug, never a re-baseline.
- Soak gate: per the design doc, Phase 3 (the flip) should soak on a preview deploy for a release cycle before Phase 4/5 land. Phases are sequenced so a revert of the risky middle (Phase 3) never strands the CI gate.
