# Phase 3 - The lazy flip (Doc Step 3)

The payload win. Flip `src/ui/i18n.ts` so it imports only `en` + `pending` + `LOCALE_LOADERS` + `SUPPORTED_LANGUAGES` (plus the dev-only `en_XA` behind the PROD guard); the 13 non-en statics stop being eagerly imported. This is what actually drops ~540 KB gzip from the app chunk (main 1.13 MB -> ~590 KB). The async machinery to load a non-en locale landed in Phase 2; this phase makes it load-bearing. This is HIGH RISK: the same change that wins the bytes also breaks two canary tests, so their fixes ship IN THE SAME COMMIT.

Copy the block below into a fresh Opus 4.8 session.

### Starter Prompt
```
This is Phase 3 of the i18n Lazy Locales feature: The lazy flip.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: NOT needed. This is a surgical one-file flip (src/ui/i18n.ts) plus two
canary-test edits and a few new tests. Do it with direct edits, not a Workflow.

Goal: Flip src/ui/i18n.ts to STATIC-import only `en` + `pending` + `LOCALE_LOADERS` +
`SUPPORTED_LANGUAGES` from the generated barrel (plus the dev-only `en_XA` behind the
existing !import.meta.env.PROD guard). The 13 non-en static locale imports go away, so
Rollup tree-shakes them out of the app chunk and a default-English visitor downloads
ZERO non-en locale bytes. Target: main-*.js gzip ~590 KB (down from 1.13 MB), with 13 +
dialect content-hashed locale chunks emitted separately and `en` NOT a separate chunk.
t() STAYS SYNCHRONOUS. The resolved-table SHA must NOT move.

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean. If not, ask the user (a concurrent session may share this checkout).
- Ensure you are on branch `feature/i18n-lazy-locales` (Phase 1 + Phase 2 already landed there).
  If switching branches would disrupt a concurrent session, ask first.
- Confirm Phase 2 is in: `ensureLocaleLoaded`, `isLocaleResident`, the `resident`/`inflight`
  maps, and the `resident[lang] ?? resident.en!` line in tableFor() all exist in
  src/ui/i18n.ts. If they do NOT, STOP - Phase 3 builds directly on the Phase 2 async loader.
- Memory scan: check your MEMORY.md index + the entries `i18n-resolved-baseline-and-assembly`,
  `i18n-phase3-lazy-locales-plan`, and `shared-worktree-commit-care`.

STEP 1 - LOAD CONTEXT (read these directly; they are small):
- docs/i18n-scaling/lazy-locales/state.md (locked decisions 7+10, the lazy-flip-probe
  validation row, key file paths)
- docs/i18n-scaling/lazy-locales/progress.md (the Phase 3 deliverables + acceptance row)
- docs/i18n-scaling/lazy-locales/phase-03-lazy-flip.md (this prompt)
- src/ui/i18n.ts (full, ~275 lines pre-Phase-2 / a bit longer after Phase 2) - especially the
  current import + re-export surface (lines 1-29: the 14-locale static import, the
  `export { en, es, ... }` re-export, and the `gameStrings = en.game` indirection at ~19-24),
  tableFor() (~181-186), t() (~188-205)
- tests/homepage_foundation.test.ts (the canary loop at lines 73-77)
- tests/i18n_t_behavior.test.ts (the `loadWithPending` mock at lines 58-75)
- scripts/i18n_resolved_hash.mjs (the hash harness, 90 lines - only relevant under Option 3b)
- CLAUDE.md (root) + src/ui/CLAUDE.md
Return to yourself: the EXACT current import + re-export lines in i18n.ts (including the
gameStrings indirection), and EXACTLY what each canary test asserts and why the flip breaks it.

STEP 2 - THE DECISION GATE (Option 3a vs 3b - mechanical, not a judgment call):
- PREFER Option 3a: keep i18n.ts re-exporting the dense locale consts (the
  `export { en, es, es_ES, ... }` surface), so every `../src/ui/i18n` const-importer -
  INCLUDING the S3 guard tests/localization_fixes.test.ts and the hash harness - stays
  green UNTOUCHED. The runtime stops STATIC-importing the 13 non-en locales for use, but
  may still re-export them; Rollup tree-shakes a re-export that the app never references.
- VERIFY 3a with a HARD build-size tree-shake probe (this is an acceptance gate, not a
  vibe check): `npm run build`, then `gzip -c dist/assets/main-*.js | wc -c`. PASS if
  ~590 KB (<= ~0.62 MB) - the 13 statics were dropped from the app chunk. The probe is
  finicky precisely because the existing `gameStrings = en.game` indirection (i18n.ts
  ~19-24) was added to stop a re-export pulling i18n.en's ~1 MB base into the client - the
  SAME hazard class. If a re-export silently re-anchors the statics into main, the probe
  catches it.
- FALL to Option 3b ONLY if the 3a probe FAILS (main stays ~1.13 MB): repoint the
  const-importing tests + scripts/i18n_resolved_hash.mjs to import the locale consts from
  the generated index.ts directly (`../src/ui/i18n.resolved.generated`) instead of from
  `../src/ui/i18n`, so i18n.ts need not re-export the dense statics and tree-shaking is
  guaranteed. The hash VALUE is identical (same translations hashed, same key order). Make
  3b its OWN commit for bisect isolation. 3b costs editing EVERY `../src/ui/i18n`
  const-importer including the S3 guard - which is the decisive reason to prefer 3a.
- The S3 guard tests/localization_fixes.test.ts (imports all 14 consts from
  `../src/ui/i18n` and reads i18n.status.json) breaks ONLY under 3b; under 3a it stays
  green and you do not touch it.

STEP 3 - THE FLIP (src/ui/i18n.ts):
- Change the static import at the top so it pulls ONLY `en`, `pending`, `LOCALE_LOADERS`,
  `SUPPORTED_LANGUAGES`, and (for the type machinery) the existing type-only imports. Keep
  the dev-only `en_XA` import behind the existing !import.meta.env.PROD guard so a prod
  build tree-shakes it (locked decision 5).
- Do NOT eagerly import es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW, ko_KR,
  ja_JP, pt_BR, ru_RU for runtime use. The runtime reaches a non-en table only via
  resident[lang], populated by `ensureLocaleLoaded(lang)` -> `LOCALE_LOADERS[lang]()` (the
  Phase 2 loader). t() reads `resident[lang] ?? resident.en!` and stays synchronous.
- Under Option 3a, keep the `export { en, es, ... }` re-export line and `gameStrings = en.game`
  unchanged so the const-importers stay green. Under 3b, drop the dense re-export and repoint
  importers (separate commit).
- `supportedLanguages` / `SupportedLanguage` derive from `SUPPORTED_LANGUAGES` (Phase 2
  already wired this if it replaced `keyof typeof translations`; if `translations` is still
  the source, ensure it does not re-anchor all 14 statics - the barrel's `translations` map
  is the hazard, so prefer deriving the type + key set from `SUPPORTED_LANGUAGES`).

STEP 4 - THE TWO CANARY FIXES (SAME COMMIT as the flip - the build goes red otherwise):
- Canary 1 - tests/homepage_foundation.test.ts (build-breaker). The loop at lines 73-77
  iterates 12 non-en locales doing `setLanguage(lang.code); expect(t("nav.play")).toBe(lang.play)`
  with NO await. After the flip the ru_RU chunk is not resident, so tableFor() returns
  resident.en and t("nav.play") yields "Play" -> the assertion fails. FIX: make the loop
  body `await ensureLocaleLoaded(lang.code)` before asserting (make the `it` async), or read
  the locale table directly. This is the canonical switch-and-read-synchronously pattern: you
  await the load once, THEN t() is synchronous against the now-resident table.
- Canary 2 - tests/i18n_t_behavior.test.ts (silent breakage). The mock `loadWithPending`
  (lines 58-75) injects a synthetic pending key by overriding `actual.translations.es` /
  `.en` and `actual.pending.es` on the i18n.resolved.generated module, then imports
  `../src/ui/i18n`. After the flip the runtime reads `en` eagerly + `resident.es` populated
  by `LOCALE_LOADERS.es()` (a dynamic import of ./es), so mocking the BARREL's `translations`
  no longer feeds the key into the table the runtime reads - the lookup misses and falls to
  onUntrackedKey (a DIFFERENT throw), so the test silently asserts the wrong thing. FIX:
  re-point the mock to the NEW seam - mock `LOCALE_LOADERS.es` (and the per-locale es module
  it imports) to return the synthetic table, OR pre-seed `resident.es` via a test-only hook,
  then `await ensureLocaleLoaded("es")` before asserting. The release-only empty-`pending`
  assertion (using `realPending` from the generated path) is UNCHANGED - leave it.

STEP 5 - NEW TESTS (in tests/i18n_t_behavior.test.ts or a sibling):
- A loader-rejection case: simulate a 404 by making `LOCALE_LOADERS.es` reject; assert
  `ensureLocaleLoaded("es")` resolves soft (no throw), t() falls back to English, and the
  client does not crash. (This is the R-class English-fallback guarantee.)
- A non-en-current-language sync-t() case: `await ensureLocaleLoaded("es")`, then assert
  t() against an es key renders the Spanish string SYNCHRONOUSLY (no await on the read).
- Keep / confirm the pending/release hard-fail case still throws (the re-pointed Canary 2).

STEP 6 - FIRST-PAINT FLASH MITIGATION (R1):
The await machinery landed in Phase 2; this phase makes it load-bearing. Confirm the
bootstrap (src/main.ts startGame) `await ensureLocaleLoaded(getLanguage())` behind the
loading screen BEFORE mountGameUi, so a stored non-en visitor never sees an English flash.
The single loading-screen caption renders deliberately from eager `en` (that is the one
pre-load string and is intentional). If a flash appears that the loading-screen gate does
not hide, STOP and surface it.

INVARIANTS THIS PHASE MUST KEEP:
- t() STAYS SYNCHRONOUS. The only async surface is ensureLocaleLoaded at the bootstrap +
  picker boundaries (Phase 2). Never make t()/setLanguage async.
- The resolved-table SHA must NOT move: `npm run i18n:hash -- --check` stays green
  (baseline d74aeb6.. or whatever Phase 1/2 left it - do NOT re-baseline). Under 3b the hash
  VALUE is identical because the same translations are hashed; if it moves, that is a real
  bug, surface it.
- The tree-shake probe is a HARD acceptance gate: a default-English visitor downloads ZERO
  non-en bytes. If neither 3a nor 3b drops the bytes, STOP - the bundle win is the whole point.
- Shared worktree: stage EXPLICIT paths, never `git add -A`. No em dashes / emojis.

Out of scope (do NOT do in this phase):
- Do NOT add modulepreload or the inline boot script (Phase 4).
- Do NOT touch CI / git hygiene / .gitignore / .gitattributes (Phase 5).
- Do NOT split i18n.en.ts (Phase 6).
- Do NOT touch the generators (Phase 1) or the resolve/merge/dialect/pending logic.

STEP 7 - VALIDATION:
- `npx tsc --noEmit`.
- `npx vitest run tests/i18n_t_behavior.test.ts tests/homepage_foundation.test.ts
  tests/localization_fixes.test.ts tests/i18n_resolved_equivalence.test.ts` then `npm test`.
- `npm run i18n:hash -- --check` (SHA unchanged).
- The tree-shake probe: `npm run build`, then `gzip -c dist/assets/main-*.js | wc -c`
  (target <= ~0.62 MB) and `ls dist/assets/*-*.js` (13 + dialect locale chunks present;
  `en` not a separate chunk). Record whether 3a held or you fell to 3b.
- A default-English load network trace (a throttled-mobile run via a scripts/*.mjs browser
  E2E): ZERO `es-*.js`..`ru_RU-*.js` requests; no non-en locale data baked into main-*.js.
- An E2E visual no-layout-shift check on swap (?lang=es AND one CJK locale e.g. zh_CN): no
  flash, no layout shift on first paint AND on in-session swap. A throttled-mobile TTI probe.

STEP 8 - REVIEW: This is a high-risk one-file flip + test edits. Per the dispatch matrix,
spawn `qa-checklist` at completion. Do NOT spawn privacy-security-review (no CI/secret/server
change), migration-safety (no DDL), or cross-platform-sync (no sim/server/wire change).
Prompt qa-checklist for COVERAGE not filtering. Resume it if it truncates with:
"Stop reading more files. Output the full report now based on what you have already seen.
 No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."
Do not commit the flip until no BLOCKING issues remain.

STEP 9 - COMMIT CADENCE (Conventional Commits, scope, EXPLICIT paths, no em dashes/emojis):
1. test(i18n): re-point canary tests to the lazy seam (homepage_foundation + i18n_t_behavior)
2. feat(i18n): flip i18n.ts to lazy per-locale loading via LOCALE_LOADERS (3a) + loader/fallback tests
   (this is the byte-win commit; canary edits from #1 must already be green so the build stays green)
3. [3b ONLY, if the probe failed] refactor(i18n): repoint const-importers + hash harness at
   generated index (its own commit for bisect isolation)
4. docs(i18n): Phase 3 progress + record the 3a-vs-3b probe outcome in state.md
Order note: land #1 first so #2 (the flip) never leaves the tree red between commits.

STEP 10 - ACCEPTANCE CRITERIA (do not mark complete until all check):
- [ ] src/ui/i18n.ts imports only en + pending + LOCALE_LOADERS + SUPPORTED_LANGUAGES
      (plus dev-only en_XA behind the PROD guard); the 13 non-en statics are not eagerly imported for use.
- [ ] dist/assets/: main-*.js gzip ~590 KB (<= 0.62 MB); 13 + dialect content-hashed locale
      chunks (~42 KB gzip each); `en` NOT a separate chunk.
- [ ] A default-English load network trace shows ZERO es-*.js..ru_RU-*.js requests; no non-en
      locale data inside main-*.js.
- [ ] `i18n:hash --check` OK (SHA did NOT move); `npx tsc --noEmit` + `npm test` green.
- [ ] The two canary tests are re-pointed and meaningful; new tests exist for loader-rejection
      -> English fallback (no crash), non-en current language renders translated after await, and
      the pending/release hard-fail still throws; the release-tier empty-pending assertion is intact.
- [ ] ?lang=es + one CJK locale render fully localized: no flash, no layout shift (first paint + in-session swap).
- [ ] Recorded: did 3a hold, or was 3b correctly applied as its own commit?

STEP 11 - DOC UPDATES + MEMORY:
- progress.md: mark Phase 3 status + ticks; in the Notes section RECORD the 3a-vs-3b probe
  outcome (the gzip number and which option held).
- state.md: update locked decision 7 if the probe outcome differs from the plan; record the
  post-flip main-chunk gzip number.
- Memory: record anything surprising (e.g. a re-export re-anchoring statics, or a vitest
  dynamic-import shape wrinkle the loader needed).

STEP 12 - FINAL RESPONSE FORMAT:
End with: phase status, files touched, the tree-shake probe result (the gzip number + 3a-or-3b),
the SHA check, the qa-checklist verdict, any deferred items, and a one-line handoff for Phase 3 QA.

ROLLBACK: revert src/ui/i18n.ts to the Phase 2 static barrel import - a single-file revert
restores all-14-in-main. This is exactly why the back-compat barrel is retained through Phase 3.

STOPPING RULES:
- STOP if the 3a tree-shake probe FAILS and Option 3b ALSO fails to drop the bytes (surface it -
  the bundle win is the entire point of this phase; do not declare done on a 1.13 MB main).
- STOP if t() cannot stay synchronous.
- STOP if a first-paint flash appears that the loading-screen gate does not hide.
- STOP and do NOT re-baseline if the resolved-table SHA moves (a moved SHA = a real bug here).
```
