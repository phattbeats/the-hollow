# Phase 1 - Per-locale emit split (Doc Step 1)

Producer-only refactor: turn the single dense `i18n.resolved.generated.ts` into a generated directory with one dense module per locale plus a back-compat barrel. Zero behavioral change, zero bundle change, byte-identical resolved table. This is the foundation the lazy flip (Phase 3) stands on; nothing here is lazy yet.

Copy the block below into a fresh Opus 4.8 session.

### Starter Prompt
```
This is Phase 1 of the i18n Lazy Locales feature: Per-locale emit split.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: NOT needed. This is one generator change (mirrored in admin), not a content
sweep. Do it with direct edits + a small fan-out at most. Do NOT spin up a Workflow.

Goal: Split the single dense src/ui/i18n.resolved.generated.ts into a generated DIRECTORY
src/ui/i18n.resolved.generated/ (one dense module per locale + a back-compat barrel + a
loaders module), mirrored in admin, with the resolved table byte-identical and the bundle
unchanged. Nothing becomes lazy in this phase.

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean. If not, ask the user (a concurrent session may share this checkout).
- Ensure you are on branch `feature/i18n-lazy-locales`. If it does not exist, create it off
  the current `release/v0.9`: `git switch -c feature/i18n-lazy-locales`. If switching branches
  would disrupt a concurrent session, ask first.
- Memory scan: check your MEMORY.md index + the entries `i18n-resolved-baseline-and-assembly`,
  `i18n-phase3-lazy-locales-plan`, and `shared-worktree-commit-care`.

STEP 1 - LOAD CONTEXT (do NOT read planning docs or i18n.resolved.generated.ts directly - they are huge):
Spawn ONE Explore agent to read and summarize:
- docs/i18n-scaling/lazy-locales/state.md (locked decisions, scope boundary, validation matrix, file paths)
- docs/i18n-scaling/lazy-locales/progress.md (Phase 1 deliverables + acceptance checklist)
- docs/i18n-scaling/lazy-locales/phase-01-emit-split.md (this prompt)
- scripts/i18n_build.mjs (focus the EMIT stage: OUT_PATH ~line 30, emit() ~134-164, LOCALES
  ~38-53, DIALECT_BASE ~63-67, en_XA emit ~158-162/215-217)
- scripts/i18n_admin_build.mjs (the admin twin: OUT_PATH ~30, emit ~80-107)
- scripts/i18n_scan.mjs (how it currently imports/reads the resolved table)
- src/ui/i18n.ts lines 1-30 ONLY (the static import + re-export surface the barrel must preserve)
- CLAUDE.md (root) + src/ui/CLAUDE.md
The agent should return: the exact current emit structure (what exports the single file produces,
in what order), how the scanner reads it, and the precise import surface src/ui/i18n.ts expects.

STEP 2 - EXECUTE (direct edits; one Agent for the admin mirror if you want parallelism):
Change ONLY the EMIT stage of the generators. The resolve/merge/dialect/pending/pseudo logic
is correct - do not touch it.

Game build (scripts/i18n_build.mjs):
- Emit src/ui/i18n.resolved.generated/ as a directory instead of one file:
  - One dense `<lang>.ts` per locale (en.ts, es.ts, es_ES.ts ... ru_RU.ts), each lifted VERBATIM
    with its `: EnTranslations` annotation so tsc completeness holds per file. Dialects
    (es_ES, fr_CA, en_CA) stay BUILD-TIME DENSE / STANDALONE: es_ES.ts must NOT `import { es }`
    and spread - emit it fully resolved. No import-time composition.
  - en_XA.ts: the dev-only pseudo-locale, re-exported by the barrel but ABSENT from LOCALE_LOADERS,
    translations, and SUPPORTED_LANGUAGES.
  - pending.ts: `export const pending: Record<string, readonly string[]> = {...}`.
  - loaders.ts: `export const LOCALE_LOADERS = { es: () => import('./es'), ... }` (one dynamic-import
    thunk per NON-en, NON-en_XA locale) and `export const SUPPORTED_LANGUAGES = [...] as const`.
  - index.ts (barrel): re-export every locale + en_XA + pending, and assemble + export the
    `translations` map, so the exact import surface src/ui/i18n.ts and the tests/hash harness
    expect is preserved (directory-index resolution of './i18n.resolved.generated' -> index.ts;
    the project uses moduleResolution "Bundler"; precedent at src/render/characters/, see
    src/render/renderer.ts:12 and src/main.ts:18).
- Add an `I18N_OUT_DIR` env var that overrides the output directory (used later by the determinism
  test to generate into temp dirs).
- Emit ATOMICALLY: compute every module fully in memory first, then `rmSync(dir, {recursive,force})`
  + recreate and write all (so a deleted locale leaves no orphan and a crash never leaves a torn dir).
- Keep JSON.stringify(table, null, 2) formatting unchanged so per-file byte-identity falls out free.

Admin build (scripts/i18n_admin_build.mjs): mirror the identical directory transform into
src/admin/i18n.resolved.generated/ (flat keys, `: AdminTranslations`). This is for IDE/diff/parity
ONLY - admin is NOT going lazy. Same I18N_OUT_DIR support.

Scanner (scripts/i18n_scan.mjs): update it to read the new directory shape (import via the barrel,
or the per-locale modules) so `npm run i18n:scan` still produces an identical i18n.status.json.

INVARIANTS THIS PHASE MUST KEEP:
- The resolved-table SHA must NOT move: `npm run i18n:hash -- --check` stays green (baseline
  d74aeb6..). A moved SHA here is a real bug, never a re-baseline.
- Determinism: the emit is a pure function of source; same input -> byte-identical output.
- `t()` stays synchronous; the runtime still STATIC-imports everything via the barrel this phase.
- No generated-file hand-edits: regenerate via the build; commit the regenerated directories.
- Shared worktree: EXPLICIT paths, never `git add -A`. No em dashes / emojis.

Out of scope (do NOT do in this phase):
- Do NOT change src/ui/i18n.ts beyond what is needed for it to keep importing the SAME names from
  the barrel (ideally zero change - the barrel preserves the surface).
- Do NOT add the async loader, do NOT flip to lazy, do NOT add modulepreload, do NOT touch CI/git.
- Do NOT touch the resolve/merge/dialect/pending/pseudo logic.
- Do NOT advertise or expect a bundle change (all 14 still pulled through the static barrel).

STEP 3 - VALIDATION + REVIEW:
- Run: `npm run i18n:build && npm run i18n:admin && npm run i18n:scan && git diff --exit-code`
  (must regenerate identically - commit the new dirs first so the diff is clean), then
  `npm run i18n:hash -- --check` (SHA unchanged), `npx tsc --noEmit`, `npm test`, and
  `npm run build` (confirm main-chunk gzip is within noise of 1.13 MB - no bundle change).
- Review agents: this diff touches only build scripts + generated dirs + the i18n runtime import
  surface. Per the dispatch matrix, spawn `qa-checklist` at completion. Do NOT spawn
  privacy-security (no CI/secret/server change this phase), migration-safety, or cross-platform-sync.
- Prompt qa-checklist for COVERAGE not filtering. Resume it if it truncates with:
  "Stop reading more files. Output the full report now based on what you have already seen.
   No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."
- Do not commit until no BLOCKING issues remain.

STEP 4 - COMMIT CADENCE (Conventional Commits, scope, EXPLICIT paths, no em dashes/emojis):
- feat(build): emit per-locale i18n directory + barrel + loaders in i18n_build.mjs
  (include the regenerated src/ui/i18n.resolved.generated/ and the deleted single file)
- feat(build): mirror per-locale i18n emit in admin + read new dir shape in i18n_scan.mjs
  (include src/admin/i18n.resolved.generated/ and any regenerated i18n.status.json)
- docs(i18n): mark Phase 1 progress + record new symbols in lazy-locales state.md

STEP 5 - ACCEPTANCE CRITERIA (do not mark complete until all check):
- [ ] src/ui/i18n.resolved.generated/ is a directory: index.ts + pending.ts + loaders.ts +
      one dense <lang>.ts per locale + en_XA.ts; the single .ts is gone.
- [ ] index.ts barrel re-exports every locale + en_XA + pending + the translations map (surface preserved).
- [ ] loaders.ts exports LOCALE_LOADERS (per non-en, non-en_XA) + SUPPORTED_LANGUAGES.
- [ ] I18N_OUT_DIR overrides the output dir; emit is atomic.
- [ ] Admin mirror present (src/admin/i18n.resolved.generated/); scanner reads the new shape.
- [ ] `git diff --exit-code` clean after regen; `i18n:hash --check` OK (SHA d74aeb6.. unchanged).
- [ ] `npx tsc --noEmit` + `npm test` green; `npm run build` gzip within noise of 1.13 MB.

STEP 6 - DOC UPDATES + MEMORY:
- Update docs/i18n-scaling/lazy-locales/progress.md (Phase 1 status + ticks; note any deferral).
- Update docs/i18n-scaling/lazy-locales/state.md if any path/symbol drifted from the plan.
- Record in Claude Code memory any surprising rule (e.g. a moduleResolution wrinkle for the
  directory-index import).

STEP 7 - FINAL RESPONSE FORMAT:
End with: phase status, files touched, validation results (esp. the SHA check + the build gzip
number), the qa-checklist verdict, any deferred items, and a one-line handoff for Phase 1 QA.

STOPPING RULES:
- STOP if byte-identity of the resolved table cannot be preserved (a moved SHA = a real bug; do
  NOT re-baseline to make it green - surface it).
- STOP and ask if the directory-index import './i18n.resolved.generated' does not resolve under
  the project's moduleResolution (you may need an explicit '/index' or a tsconfig note).
- STOP if `npm run build` shows a non-trivial bundle change (this phase must be bundle-neutral).
```
