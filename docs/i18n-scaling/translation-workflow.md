# i18n Translation Workflow

Contributors add **English strings only**; the maintainer fills every locale
before release. This is the canonical roles reference; the root `CLAUDE.md` and
`src/ui/CLAUDE.md` i18n sections point here.

The reason for the split is practical: translating all 13 non-English locales on
every PR would drain the token budget of contributors on smaller Claude Code
plans and bloat each diff with machine translations the maintainer re-does at
release anyway. The sparse-overlay model plus the two-tier release gate make an
English-only PR correct and safe, so that is the contract.

## Roles at a glance

| Role | Does | Does NOT |
|---|---|---|
| **Contributor** (incl. small-plan Claude Code agents) | Add the key to `en` (`src/ui/i18n.en.ts`, or `src/admin/i18n.en.ts` for the admin app); render it via `t()`. For text emitted from `src/sim/` or `server/`, register the matcher RULE in `src/ui/sim_i18n.ts` / `src/ui/server_i18n.ts` in the same change. Regenerate and commit the generated artifacts. | Touch the 13 `i18n.locales/<lang>.ts` overlays. Write any non-English translation. Put English copy, a placeholder, or `// TODO` into an overlay as a stand-in translation. Hand-edit `*.resolved.generated*` or `i18n.status.json`. |
| **Maintainer** (Fernando) | Fill all non-English overlays before release via `npm run i18n:worklist`; regenerate; update the SHA baseline; ship from a `release/**` branch. | n/a |

Translating your own locale is **permitted but never required** of a contributor.

## Adding a player-visible string

1. Add the key to `en` (`src/ui/i18n.en.ts`) and render it through `t()`. Never
   edit the 13 `src/ui/i18n.locales/<lang>.ts` overlays, and never fake a
   translation by putting English / `// TODO` / a placeholder into one. Leave the
   key omitted: the build English-fills it and the registry marks it `pending`.
2. If the string originates in `src/sim/` or `server/` (which stay
   language-agnostic), register a matcher RULE matching the emit's origin
   (`sim_i18n.ts` for a `src/sim/` emit, `server_i18n.ts` for a `server/` emit) in
   the same change. The S3 guard (`tests/localization_fixes.test.ts`) accepts
   recognition by either matcher and fails if a new emit is recognized by neither.
3. Run `npm run i18n:scan` (and `npm run i18n:build`; if the resolved table
   changed, also `npm run i18n:hash -- --write`) and commit the regenerated files.
4. Open the PR. It is green at the PR-tier gate, which does not require
   translations; `tsc` and the `t()` untracked-key throw still guarantee English
   completeness.

## The two-tier gate

CI is split by git ref (`.github/workflows/ci.yml`):

- **PR-tier gate** (pull requests, pushes to `main` / `dev-*`): runs `npm test`
  without `I18N_RELEASE_TIER`. An English-only change is legal here. A key the
  active locale has not translated is English-filled and marked `pending`, which
  passes.
- **Release-tier gate** (pushes to `release/**`): sets `I18N_RELEASE_TIER=1`,
  which turns on the release-only checks, including the empty-`pending` assertion.
  A single untranslated row fails it.

Dry-run the release gate locally with `I18N_RELEASE_TIER=1 npm test`.

## The pending set and the en_XA pseudo-locale

- A `pending` key renders English on non-release builds (so dev / pre-release is
  fully usable) and **hard-fails on a release build** (`t()` throws when
  `import.meta.env.PROD` or `I18N_RELEASE=1`), so English can never silently ship
  to a translated player.
- `en_XA` is a dev-only pseudo-locale (accented + bracketed English with
  placeholders preserved). Select it with `?lang=en_XA` on a non-release build:
  any on-screen text that stays plain ASCII with no brackets is a hard-coded
  literal that never became a `t()` key. It is excluded from `supportedLanguages`
  and tree-shaken out of production.

## Maintainer release workflow

1. `npm run i18n:worklist` produces per-language fill batches (it ships the
   locked-terms glossary verbatim with every batch so terminology does not drift).
2. Fill the non-English overlays in `src/ui/i18n.locales/` (and
   `src/admin/i18n.locales/` for the admin app).
3. `npm run i18n:build && npm run i18n:admin && npm run i18n:scan` to regenerate
   the resolved tables and the status registry.
4. `npm run i18n:hash -- --write` to update the resolved-table SHA baseline.
5. Commit, then ship from a `release/**` branch where the release-tier gate
   enforces `pending = 0`.

## Admin parity

The admin dashboard has its own, independent sparse-overlay set
(`src/admin/i18n.en.ts` is flat dotted keys; overlays live in
`src/admin/i18n.locales/`). The same English-only contributor rule applies.
Regenerate the admin resolved table with `npm run i18n:admin`. The release-tier
gate also enforces no `pending` admin rows.

## Locked-terms glossary

`scripts/i18n_glossary.json` (hand-maintained) is the canonical list of brand /
proper-noun terms kept verbatim across locales (for example
"World of ClaudeCraft") plus category key-patterns (class names, ability names,
zone and dungeon names) whose established localized form must be reused rather
than re-coined. `npm run i18n:worklist` ships it verbatim with every per-language
batch. Edit this file to change which terms are locked; do not change tool logic.

## Adding a new locale

1. Create the overlay files (`src/ui/i18n.locales/<code>.ts` and
   `src/admin/i18n.locales/<code>.ts`).
2. Add the locale to the build's locale set and to the runtime `translations`
   map so it becomes selectable in `supportedLanguages`.
3. Regenerate with `npm run i18n:build && npm run i18n:admin && npm run i18n:scan`
   and update the SHA baseline.
