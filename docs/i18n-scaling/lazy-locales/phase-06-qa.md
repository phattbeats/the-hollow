# Phase 6 QA - Verify the i18n.en.ts directory split (FINAL phase: carries packet teardown)

Audit Phase 6 for a byte-identical resolved table (SHA unchanged, regen diff clean), an unchanged public import surface, zero string-value drift, and a thin re-export with no duplicated content - plus missing tests and dead code (any orphaned reference to the old single-file path). This is the FINAL phase in the packet, so this QA also walks the whole-feature qa-checklist.md and runs the PACKET TEARDOWN. Copy the block below into a fresh Opus 4.8 session.

### QA Starter Prompt
```
This is Phase 6 QA of the i18n Lazy Locales feature: Verify the i18n.en.ts directory split. This is the
FINAL phase in the packet - it carries the whole-feature qa-checklist walk and the PACKET TEARDOWN.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: not needed (single-phase verification). Use direct checks + parallel review agents.

Goal: Audit the Phase 6 split for byte-identity (resolved table + SHA unchanged, git diff clean), an
unchanged public import surface, zero string-value drift, and a thin re-export with no duplicated content
(the old monolithic body is fully MOVED, not copied) - plus missing tests and dead code (any orphaned
reference to the pre-split single-file path). Then, as the final phase, walk the whole-feature
qa-checklist.md and run the PACKET TEARDOWN.

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean (Phase 6 should be committed on feature/i18n-lazy-locales). If dirty, ask.
- Memory scan: i18n-resolved-baseline-and-assembly, i18n-phase3-lazy-locales-plan, shared-worktree-commit-care.

STEP 1 - LOAD CONTEXT (do NOT dump i18n.en.ts / i18n.en/ whole - they are large; map structure):
Spawn ONE Explore agent to summarize:
- docs/i18n-scaling/lazy-locales/state.md + progress.md (Phase 6 deliverables + acceptance; the SHA
  invariance rule)
- docs/i18n-scaling/lazy-locales/phase-06-en-split.md (what was promised)
- All files changed in Phase 6 (`git diff --name-only <phase-6-start-commit>..HEAD`) - esp. the new
  src/ui/i18n.en/ module set, the thinned src/ui/i18n.en.ts, and confirm NO non-English overlay or
  generated dir changed
- src/ui/i18n.en.ts (the thin re-export shape) + the i18n.en/ barrel index.ts (how it assembles `en`)
- docs/i18n-scaling/lazy-locales/qa-checklist.md (the WHOLE-FEATURE checklist this final QA must walk)
- CLAUDE.md (root) + src/ui/CLAUDE.md
Return: the full Phase 6 deliverable list, all changed files, the i18n.en/ module layout, exactly which
names i18n.en re-exports, and any known issues.

STEP 2 - QA AUDIT (spawn parallel review agents using the Explore summary; prompt each for COVERAGE not
filtering - "report every issue including low-severity and uncertain ones"):

Correctness agent:
- Re-run `npm run i18n:build && npm run i18n:admin && npm run i18n:scan && git diff --exit-code` from a
  clean tree - is the regen byte-identical (the source `en` object unchanged in value AND order)?
- `npm run i18n:hash -- --check` - is the SHA still d74aeb6.. (did NOT move)? A moved SHA means a content
  block was dropped or reordered in the split.
- Public surface: scripts/i18n_build.mjs and src/ui/i18n.ts import the SAME names from './i18n.en' as
  before; the thin re-export resolves them all.
- No string-value drift: spot-check that the assembled `en` object from i18n.en/ is value-equal and
  key-order-equal to the pre-split monolith (the SHA gate proves this globally; confirm the mechanism).
- `npx tsc --noEmit` (every `: EnTranslations` annotation + importer typechecks) + `npm test` +
  `npm run build` green.

Test coverage agent:
- The existing registry/equivalence/behavior suites still validate against the identical resolved output
  (no test needed updating for the split, since the public surface + resolved table are unchanged). Confirm
  none silently no-op'd.
- No orphaned test references the OLD single-file path src/ui/i18n.en.ts as a monolith in a way that would
  break or mislead (the path still exists as a thin re-export, so imports resolve - confirm no test asserts
  on its former internal structure).

Dead code & cleanup agent:
- Confirm the old monolithic i18n.en.ts BODY is fully MOVED into the i18n.en/ domain modules - the
  re-export file is thin (a re-export, not a second copy of the catalog). No content is duplicated across
  the monolith and the modules.
- No unused imports / orphaned helpers in the new modules or _merge.ts; no commented-out old catalog.
- The import invariant is intact (no DOM/Three crept into the i18n source).

Multi-agent review dispatch (check `git diff --name-only` vs the phase-start commit):
- qa-checklist: yes (phase-completion gate AND the whole-feature walk below).
- privacy-security-review: do NOT spawn (pure i18n source-catalog reorg; no CI/secret/server/net change).
- migration-safety: do NOT spawn (no DDL / persisted-state change).
- cross-platform-sync: do NOT spawn (no sim/IWorld/wire/matcher change).
Resume any agent that truncates with: "Stop reading more files. Output the full report now.
No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."

STEP 3 - FIX: Apply all BLOCKING + SHOULD-FIX items. Re-run the validation matrix (the byte-identity regen,
the SHA check, tsc, npm test, the build). Commit fixes in commits SEPARATE from the QA verdict (EXPLICIT paths).

STEP 4 - WHOLE-FEATURE QA + UPDATE DOCS + MEMORY:
- Walk docs/i18n-scaling/lazy-locales/qa-checklist.md end to end now that all six phases are landed (this
  packet has its own whole-feature checklist the FINAL QA must clear before teardown). Confirm the headline
  outcomes hold on the merged feature: English-only default load drops the non-English locale bytes
  (~540 KB gzip), main chunk ~590 KB gzip, `t()` still synchronous, the SHA never moved across all six
  phases, the release-tier gate still bites, and a fresh clone goes green.
- progress.md: mark Phase 6 + Phase 6 QA complete; mark the whole packet complete.
- state.md: record any final drift.
- Memory: record the final i18n.en/ domain layout + the end-state of the lazy-locales feature.

STEP 5 - PACKET TEARDOWN (final phase only):
Once EVERYTHING is green and the whole-feature qa-checklist.md is cleared:
- SURFACE deferred follow-ups FIRST, explicitly, before asking to delete anything. In particular:
  (a) the release-tier fill of the 3 Phase 2 keys (settings.languageLoadFailed / languageLoadUnavailable /
      languageLoading) in the 10 base locales, if not yet done - this gates the release-tier merge, not the PR;
  (b) the recorded 3a-vs-3b probe outcome from Phase 3 (which lazy-flip option held, captured in progress.md).
  List any other open item from state.md's OPEN items section.
- Then ask the user EXPLICITLY: "All phases are complete and green. OK to delete
  docs/i18n-scaling/lazy-locales/ (the planning scaffolding) before the PR?"
- On EXPLICIT confirmation, delete ONLY docs/i18n-scaling/lazy-locales/ with an explicit path:
  `git rm -r docs/i18n-scaling/lazy-locales/` (if committed), then commit `docs: remove i18n lazy-locales
  planning scaffolding`. Never `git add -A`; never delete anything outside that subdirectory.
- The design doc one level up (docs/i18n-scaling/phase-3-lazy-locales-and-contributor-workflow.md) and
  docs/i18n-scaling/translation-workflow.md MUST stay - do NOT remove them.
- If the user DECLINES, leave the scaffolding in place and note that in the final response.

STEP 6 - FINAL RESPONSE FORMAT:
End with: the QA verdict (PASS / PASS-WITH-FOLLOWUPS / FAIL), counts of BLOCKING/SHOULD-FIX/NICE-TO-HAVE
found and fixed, the surfaced deferred items (esp. the release-tier fill of the 3 Phase 2 keys and the
3a-vs-3b probe outcome), whether the packet scaffolding was removed (and the teardown commit, if any), and
"packet complete".

STOPPING RULES:
- STOP and surface if the resolved-table SHA moved (the split changed the table, not just its file layout)
  and cannot be restored without changing emitted content.
- STOP if i18n.en's public import surface changed.
- STOP if any string value drifted (the split must be a pure reorg).
- Do NOT run PACKET TEARDOWN without the user's explicit confirmation; do NOT delete anything outside
  docs/i18n-scaling/lazy-locales/.
```
