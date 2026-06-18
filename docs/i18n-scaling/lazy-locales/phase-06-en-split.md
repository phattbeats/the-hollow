# Phase 6 - i18n.en.ts directory split (Doc Q6 / Section 4.4.3)

Split the ~1 MB src/ui/i18n.en.ts English source module into a directory src/ui/i18n.en/ with one module per content domain plus a barrel, so the English catalog is maintainable. PUBLIC SURFACE UNCHANGED, resolved table BYTE-IDENTICAL, SHA UNCHANGED. This is the largest human-source change in the packet but mechanically low risk: a pure module reorg with zero value changes. The generators, the resolved dirs, and the runtime never learn that the source moved.

Copy the block below into a fresh Opus 4.8 session.

### Starter Prompt
```
This is Phase 6 of the i18n Lazy Locales feature: i18n.en.ts directory split.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: OPTIONAL. The split moves many content blocks across modules; an implementer MAY use a
Workflow to parallelize the per-module extraction and verify each, but a careful single-session reorg
is fine. Either way the work is GATED on the byte-identity check (the SHA must not move) - that is the
real safety net, not the parallelism.

Goal: Split the single ~1 MB src/ui/i18n.en.ts English source into a DIRECTORY src/ui/i18n.en/ with
one module per content domain (shell.ts, hud.ts, abilities.ts, quests.ts, items.ts, game.ts, a
_merge.ts helper, and a barrel index.ts), leaving i18n.en.ts as a thin re-export so every existing
`from './i18n.en'` import keeps resolving. PUBLIC SURFACE UNCHANGED. NO string value changes. The
resolved 14-locale table stays BYTE-IDENTICAL and the SHA does NOT move.

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean. If not, ask the user (a concurrent session may share this checkout).
- Ensure you are on branch `feature/i18n-lazy-locales` with Phases 1-5 landed + QA'd. If switching
  branches would disrupt a concurrent session, ask first.
- Memory scan: check your MEMORY.md index + the entries `i18n-resolved-baseline-and-assembly`,
  `i18n-phase3-lazy-locales-plan`, and `shared-worktree-commit-care`.

STEP 1 - LOAD CONTEXT (do NOT dump i18n.en.ts whole - it is ~1 MB; have the Explore agent MAP its
top-level export/section structure instead):
Spawn ONE Explore agent to read and summarize:
- docs/i18n-scaling/lazy-locales/state.md (locked decisions, scope boundary, the SHA invariance rule,
  file paths)
- docs/i18n-scaling/lazy-locales/progress.md (Phase 6 deliverables + acceptance checklist)
- docs/i18n-scaling/lazy-locales/phase-06-en-split.md (this prompt)
- src/ui/i18n.en.ts - MAP ONLY: the top-level export(s) (what name(s) does it export - e.g. `en`, plus
  any `EnTranslations` type), the section/domain structure (which top-level groups exist - shell, hud,
  abilities, quests, items, game, etc.), and how the object is assembled (one literal? spread of parts?).
  Do NOT dump the bodies; return the structure so the split can map to content domains.
- scripts/i18n_build.mjs - which names it imports from './i18n.en' (the EnTranslations type + the en
  source object that the resolve/merge stage consumes)
- src/ui/i18n.ts - which names it imports from './i18n.en' (the re-export surface the rest of the app uses)
- CLAUDE.md (root) + src/ui/CLAUDE.md (note the "do not split a module just to hit a line count" rule -
  this split is justified by content-domain maintainability, NOT a line count)
The agent should return: the exact section/export structure of i18n.en.ts and EXACTLY which names are
imported from './i18n.en' elsewhere (so the barrel can preserve them name-for-name).

STEP 2 - EXECUTE (direct edits; an Agent or Workflow per domain module if you want parallelism):
Honor the design doc's three-part rule: the split maps to CONTENT DOMAINS (do NOT split arbitrarily to
hit a line count, and do NOT change any string value - this is a pure move).

- Create src/ui/i18n.en/ with one module per content domain. The intended set: shell.ts, hud.ts,
  abilities.ts, quests.ts, items.ts, game.ts (adjust the domain boundaries to the ACTUAL top-level groups
  the Explore agent mapped - the names above are the plan, the source structure is authoritative). Each
  module exports its slice of the English catalog VERBATIM (same keys, same string values, same nesting).
- _merge.ts: a tiny helper if assembling the full `en` object from the domain slices needs a shared merge
  (keep it pure and dependency-free; no behavior, just object assembly).
- index.ts (barrel): assemble the full `en` object from the domain modules and re-export it (plus the
  `EnTranslations` type if it lives here) so the public surface is byte-for-byte the same SHAPE as before.
- src/ui/i18n.en.ts becomes a THIN re-export of the barrel (`export * from './i18n.en/index'` plus any
  named re-exports), so every existing `from './i18n.en'` import - in scripts/i18n_build.mjs and
  src/ui/i18n.ts - keeps resolving UNCHANGED. Confirm those two importers still get the same names.
- The split must not reorder or drop any key. Key order within the assembled `en` object must match the
  pre-split order (the resolve/emit stage and the SHA are sensitive to it) - assemble the domain slices in
  the original top-level order.

INVARIANTS THIS PHASE MUST KEEP:
- The resolved-table SHA must NOT move: `npm run i18n:hash -- --check` stays green (baseline d74aeb6..).
  A moved SHA here means a content block was DROPPED or REORDERED in the split - it is a real bug, NEVER
  a re-baseline. Fix the split, do not move the baseline.
- NO value changes: this is a pure module reorg. No new keys, no edited strings, no renamed keys.
- Public surface preserved: i18n.en's exported names are unchanged; scripts/i18n_build.mjs and
  src/ui/i18n.ts import the same names.
- Byte-identical regen: `npm run i18n:build && npm run i18n:admin && npm run i18n:scan && git diff
  --exit-code` is clean (the generated dirs do not change because the source `en` object is identical).
- No generated-file hand-edits: the resolved dirs regenerate from the moved source; do not touch them by hand.
- Shared worktree: EXPLICIT paths, never `git add -A`. No em dashes / emojis.

Out of scope (do NOT do in this phase):
- No behavior change.
- No runtime / loader change (Phase 2/3).
- No modulepreload / index.html change (Phase 4).
- No CI / git-hygiene change (Phase 5).
- Do NOT touch the non-English overlays, the resolve/merge/dialect/pending logic, or any emitted resolved
  content. The ONLY thing moving is the English SOURCE catalog's file layout.

STEP 3 - VALIDATION + REVIEW:
- Run: `npm run i18n:build && npm run i18n:admin && npm run i18n:scan && git diff --exit-code`
  (regen MUST be byte-identical - the source `en` object is unchanged in value + order).
- `npm run i18n:hash -- --check` (SHA d74aeb6.. unchanged - a moved SHA means a dropped/reordered block).
- `npx tsc --noEmit` (the `: EnTranslations` annotations + every importer still typecheck).
- `npm test` (the registry/equivalence/behavior suites still pass against the identical resolved output).
- `npm run build` (the client still builds; the public import surface from i18n.en is intact).
- Review agents: this is a pure i18n source-catalog reorg with the public surface and the resolved table
  unchanged (tsc + the SHA gate cover the risk). Per the dispatch matrix, spawn `qa-checklist` at
  completion. Do NOT spawn privacy-security (no CI/secret/server change), migration-safety (no DDL), or
  cross-platform-sync (no sim/server/wire/matcher change).
- Prompt qa-checklist for COVERAGE not filtering. Resume it if it truncates with:
  "Stop reading more files. Output the full report now based on what you have already seen.
   No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."
- Do not commit until no BLOCKING issues remain.

STEP 4 - COMMIT CADENCE (Conventional Commits, scope, EXPLICIT paths, no em dashes/emojis):
- refactor(i18n): split i18n.en.ts into i18n.en/ content modules + barrel
  (include the new src/ui/i18n.en/ directory and the thinned src/ui/i18n.en.ts re-export)
- docs(i18n): Phase 6 progress + state

STEP 5 - ACCEPTANCE CRITERIA (do not mark complete until all check):
- [ ] src/ui/i18n.en/ exists with one module per content domain (shell/hud/abilities/quests/items/game,
      adjusted to the actual source groups) + _merge.ts + index.ts barrel.
- [ ] src/ui/i18n.en.ts is a THIN re-export of the barrel; every `from './i18n.en'` import resolves unchanged.
- [ ] scripts/i18n_build.mjs and src/ui/i18n.ts import the SAME names from i18n.en as before.
- [ ] NO string value changed; NO key added/renamed/dropped; key order preserved.
- [ ] `npm run i18n:build && npm run i18n:admin && npm run i18n:scan && git diff --exit-code` clean.
- [ ] `npm run i18n:hash -- --check` OK (SHA d74aeb6.. unchanged).
- [ ] `npx tsc --noEmit` + `npm test` + `npm run build` green.

STEP 6 - DOC UPDATES + MEMORY:
- Update docs/i18n-scaling/lazy-locales/progress.md (Phase 6 status + ticks; note any deferral).
- Update docs/i18n-scaling/lazy-locales/state.md if any path/symbol drifted (the i18n.en/ module set).
- Record in Claude Code memory the final i18n.en/ domain layout + the thin-re-export shape (future
  English-catalog edits land in the domain modules, not the old monolith).

STEP 7 - FINAL RESPONSE FORMAT:
End with: phase status, files touched, validation results (esp. the byte-identical regen + the SHA check),
the qa-checklist verdict, any deferred items, and a one-line handoff for Phase 6 QA (which carries the
PACKET TEARDOWN).

STOPPING RULES:
- STOP if the split moves the resolved-table SHA (a content block was dropped or reordered - fix the split;
  do NOT re-baseline to make it green - surface it).
- STOP if i18n.en's public import surface changes (a name dropped or renamed that scripts/i18n_build.mjs or
  src/ui/i18n.ts imports).
- STOP if any string VALUE drifts (this must be a pure reorg; a value change belongs in a separate content PR).
```
