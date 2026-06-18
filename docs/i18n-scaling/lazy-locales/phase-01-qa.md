# Phase 1 QA - Verify the per-locale emit split

Audit Phase 1 for byte-identity, barrel completeness, atomic/deterministic emit, and zero bundle change. Copy the block below into a fresh Opus 4.8 session.

### QA Starter Prompt
```
This is Phase 1 QA of the i18n Lazy Locales feature: Verify the per-locale emit split.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: not needed (single-phase verification). Use direct checks + parallel review agents.

Goal: Audit the Phase 1 emit split for correctness, byte-identity (SHA unchanged), barrel
completeness, deterministic + atomic emit, and a bundle-neutral build - plus missing tests and
dead code (the deleted single-file path).

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean (Phase 1 should be committed on feature/i18n-lazy-locales). If dirty, ask.
- Memory scan: i18n-resolved-baseline-and-assembly, i18n-phase3-lazy-locales-plan.

STEP 1 - LOAD CONTEXT (do NOT read planning docs or the generated table directly):
Spawn ONE Explore agent to summarize:
- docs/i18n-scaling/lazy-locales/state.md + progress.md (Phase 1 deliverables + acceptance)
- docs/i18n-scaling/lazy-locales/phase-01-emit-split.md (what was promised)
- All files changed in Phase 1 (`git diff --name-only <phase-1-start-commit>..HEAD`) - esp.
  scripts/i18n_build.mjs, scripts/i18n_admin_build.mjs, scripts/i18n_scan.mjs, and the shape of
  the new src/ui/i18n.resolved.generated/ + src/admin/i18n.resolved.generated/ directories
- CLAUDE.md (root) + src/ui/CLAUDE.md
Return: the full Phase 1 deliverable list, all changed files, and any known issues.

STEP 2 - QA AUDIT (spawn parallel review agents using the Explore summary; prompt each for
COVERAGE not filtering - "report every issue including low-severity and uncertain ones"):

Correctness agent:
- Re-run `npm run i18n:build && npm run i18n:admin && npm run i18n:scan && git diff --exit-code`
  from a clean tree - is the regen byte-identical?
- `npm run i18n:hash -- --check` - is the SHA still d74aeb6.. (did NOT move)?
- Verify the barrel index.ts re-exports EVERY locale + en_XA + pending + the translations map,
  and that loaders.ts has a thunk for every non-en/non-en_XA locale and SUPPORTED_LANGUAGES
  matches the prior supportedLanguages set exactly.
- Verify dialects (es_ES, fr_CA, en_CA) are emitted STANDALONE DENSE (no `import {base}` + spread).
- Verify the emit is atomic (compute-then-write / rmSync+recreate) and a deleted locale leaves no orphan.
- Verify en_XA is re-exported by the barrel but ABSENT from LOCALE_LOADERS / translations / SUPPORTED_LANGUAGES.
- `npm run build` - is the main-chunk gzip within noise of 1.13 MB (no bundle change)?
- Confirm the directory-index import resolves under the project's moduleResolution.

Test coverage agent:
- Is there a test asserting the new directory shape / barrel surface? If the emit shape is only
  covered transitively, add a focused test (barrel exports the expected names; LOCALE_LOADERS keys
  == non-en locales; SUPPORTED_LANGUAGES == supportedLanguages).
- Verify tests/i18n_resolved_equivalence.test.ts still passes against the new shape (it may need its
  directory path updated - if so that is a Phase 1 fix, not Phase 5).
- Remove or update any test that hardcoded the single-file path.

Dead code & cleanup agent:
- Confirm the single src/ui/i18n.resolved.generated.ts (and admin twin) is DELETED, not orphaned.
- No unused imports/helpers left in the build scripts; no commented-out old emit code.
- Verify the import invariant is intact and no DOM/Three crept into scripts.

Multi-agent review dispatch (check `git diff --name-only` vs the phase-start commit):
- privacy-security-review: do NOT spawn (no CI/secret/server/net change this phase).
- migration-safety: do NOT spawn (no DDL / persisted-state change).
- cross-platform-sync: do NOT spawn (no sim/IWorld/wire/matcher change).
- qa-checklist: yes (phase-completion gate).
Resume any agent that truncates with: "Stop reading more files. Output the full report now.
No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."

STEP 3 - FIX: Apply all BLOCKING + SHOULD-FIX items. Re-run the validation matrix (the byte-identity
regen, the SHA check, tsc, npm test, the build gzip). Commit fixes in commits SEPARATE from the QA
verdict (EXPLICIT paths).

STEP 4 - UPDATE DOCS + MEMORY:
- progress.md: mark Phase 1 QA complete; note any item deferred to a follow-up.
- state.md: record any drift discovered.
- Memory: record anything surprising (e.g. a tsconfig wrinkle for directory-index imports).

STEP 5 - PACKET TEARDOWN: skip (not the final phase).

STEP 6 - FINAL RESPONSE FORMAT:
End with: QA verdict (PASS / PASS-WITH-FOLLOWUPS / FAIL), counts of BLOCKING/SHOULD-FIX/NICE-TO-HAVE
found and fixed, deferred items, and a one-line handoff for Phase 2 (the async loader).

STOPPING RULES:
- STOP and surface to the user if the resolved-table SHA moved and cannot be restored without
  changing the emitted content (that means Phase 1 changed the table, not just its file layout).
```
