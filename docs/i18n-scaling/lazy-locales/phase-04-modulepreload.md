# Phase 4 - Modulepreload + first-paint perf (Doc Step 4 preload deliverable)

Kill the runtime-selected-locale request waterfall. After Phase 3, a stored non-en visitor loads main, parses it, then discovers and fetches its locale chunk only when `LOCALE_LOADERS[lang]()` runs - a main-then-locale waterfall, because Vite only auto-injects modulepreload hints for STATICALLY analyzable imports and the locale is selected at runtime. The fix is an explicit `<link rel="modulepreload">` for the stored locale's hashed chunk in `<head>`, so the browser discovers it as a high-priority, parser-discoverable request before main even parses. Ship BOTH that link AND the runtime prefetch helper. Precondition: Phase 3 landed (the locale chunks exist) and ideally soaked on a preview deploy for a release cycle.

Copy the block below into a fresh Opus 4.8 session.

### Starter Prompt
```
This is Phase 4 of the i18n Lazy Locales feature: Modulepreload + first-paint perf.

Model: Opus 4.8, max effort. Harness: Claude Code.
ULTRACODE: NOT needed. This is a small build hook + a tiny inline boot script in index.html
plus a runtime prefetch helper. Do it with direct edits.

Goal: Eliminate the runtime-selected-locale request waterfall for a stored non-en visitor.
Inject an explicit `<link rel="modulepreload">` in <head> for THAT locale's content-hashed
chunk before the main module parses, so the locale chunk is a high-priority, parser-discoverable
request (not discovered only after main parses + runs the dynamic import). Ship BOTH the link
AND a runtime prefetch helper. Do NOT speculatively preload other locales (re-introduces the
bloat Phase 3 removed). The localStorage key is "locale".

PRECONDITION: Phase 3 must have landed (the per-locale chunks exist in dist/assets/ and a
default-English load already fetches zero non-en bytes). If the locale chunks do not exist yet,
STOP - there is nothing to preload.

STEP 0 - PRE-FLIGHT:
- Verify `git status` is clean. If not, ask (a concurrent session may share this checkout).
- Ensure you are on branch `feature/i18n-lazy-locales` (Phases 1-3 landed there).
- Memory scan: i18n-resolved-baseline-and-assembly, i18n-phase3-lazy-locales-plan, shared-worktree-commit-care.

STEP 1 - LOAD CONTEXT (read these directly; they are small):
- docs/i18n-scaling/lazy-locales/state.md (locked decision 8 - ship BOTH; the
  index.html/modulepreload validation row; the "Modulepreload manifest resolution" gotcha; the
  stale-chunk-window R11 note)
- docs/i18n-scaling/lazy-locales/progress.md (the Phase 4 deliverables + acceptance row)
- docs/i18n-scaling/lazy-locales/phase-04-modulepreload.md (this prompt)
- index.html (the <head>, roughly lines 1-45) - note there is currently NO inline boot script and
  NO modulepreload link; <html lang="en">; the hreflang block is at ~26-40
- src/ui/i18n.ts (the LOCALE_LOADERS usage + ensureLocaleLoaded - where a prefetch helper goes,
  alongside the loader)
- vite.config.ts (the build block ~87-96) to confirm whether Vite manifest output is enabled -
  it is NOT by default; you will likely need `build.manifest: true` so dist/.vite/manifest.json
  is emitted with the hashed locale-chunk filenames
- CLAUDE.md (root)
Return: the current index.html <head> structure, whether the Vite manifest is enabled, and the
exact loader call site where a prefetch helper belongs.

STEP 2 - ENABLE THE MANIFEST + RESOLVE THE HASHED FILENAME (the build hook):
- If Vite's manifest is not already on, set `build.manifest: true` in vite.config.ts so the build
  emits dist/.vite/manifest.json mapping each entry/chunk to its content-hashed output filename.
  CAUTION: enabling the manifest must NOT perturb the bundle in a way that moves the resolved-table
  SHA. It should not (the manifest is metadata, not bundled code), but VERIFY `npm run i18n:hash --
  check` after enabling - if the SHA moves, STOP and flag it.
- Add a post-build hook (a small scripts/*.mjs step, or a Vite closeBundle plugin) that reads
  dist/.vite/manifest.json, resolves each locale's hashed chunk URL (the per-locale module the
  LOCALE_LOADERS thunk imports), and makes a `{ locale: hashedChunkUrl }` lookup available to the
  inline boot script - either by templating the lookup directly into the emitted dist/index.html,
  or by having the inline script read the manifest at runtime. Templating into index.html at build
  time is preferred (no extra runtime fetch). Keep this logic small and unit-testable.

STEP 3 - THE INLINE BOOT SCRIPT (index.html <head>):
- Add a tiny inline boot <script> in <head>, BEFORE the main module <script type="module">, that:
  - reads `localStorage.getItem("locale")` (the stored locale; key is exactly "locale"),
  - if it is a stored NON-en supported locale, looks up that locale's hashed chunk URL from the
    build-templated lookup, and injects `<link rel="modulepreload" href="...">` into <head>.
  - MATCH `crossorigin` to the module request to avoid a DOUBLE-FETCH (a modulepreload with a
    mismatched crossorigin attribute fetches the chunk twice). Module scripts are CORS requests, so
    the preload link must carry the matching crossorigin so the browser dedupes to one fetch.
  - PREFER `rel="modulepreload"` over `rel="prefetch"` (modulepreload is high-priority and
    module-graph-aware; prefetch is low-priority/idle).
  - Do NOT speculatively inject links for other locales. Only the ONE stored locale.
  - The script reads ONLY localStorage.locale and injects ONLY a same-origin preload - no other
    side effects, no network beyond the preload, no third-party origins.

STEP 4 - THE RUNTIME PREFETCH HELPER (src/ui/i18n.ts):
- Add a small prefetch helper alongside the Phase 2 loader that starts the stored locale's fetch
  EARLIER within the same execution (mechanism 1: a runtime prefetch). This complements the <link>
  (mechanism 2): the link makes the request parser-discoverable and high-priority before main
  parses; the prefetch ensures the fetch is in flight as soon as the module executes. Ship BOTH
  (locked decision 8). Do NOT change t() (stays synchronous, untouched here) or the loader logic
  beyond adding the prefetch entry point.

INVARIANTS THIS PHASE MUST KEEP:
- t() STAYS SYNCHRONOUS (untouched here).
- Do NOT speculatively preload other locales (only the one stored locale; speculative preload
  re-introduces the bloat Phase 3 removed).
- The resolved-table SHA must NOT move: `npm run i18n:hash -- --check` stays green (enabling the
  manifest must not perturb the bundle's hashed content).
- The prod bundle still tree-shakes en_XA (the dev pseudo-locale must not appear in any chunk).
- Shared worktree: stage EXPLICIT paths, never `git add -A`. No em dashes / emojis.

Out of scope (do NOT do in this phase):
- Do NOT touch CI / git hygiene / .gitignore / .gitattributes (Phase 5).
- Do NOT change the runtime loader logic beyond the prefetch helper.
- Do NOT split i18n.en.ts (Phase 6); do NOT re-touch the Phase 3 flip.

STEP 5 - VALIDATION:
- `npm run build` green; confirm dist/.vite/manifest.json exists and the post-build hook resolved
  the correct hashed locale-chunk filename for each locale.
- `npm run i18n:hash -- --check` (SHA unchanged after enabling the manifest).
- A network trace (scripts/*.mjs browser E2E) for a STORED non-en locale (set localStorage.locale
  = "es", reload): the locale chunk is a HIGH-PRIORITY, parser-discoverable request with NO
  double-fetch and NO main-then-locale waterfall. Confirm a default-English visitor (no stored
  locale) still fetches ZERO non-en chunks (the inline script injects nothing).
- A throttled TTI probe (Slow-4G + 4x CPU, median of N runs vs the no-preload baseline): English
  NOT slower; the stored-locale path faster than the no-preload baseline.
- A mobile screenshot shows no layout shift on the stored-locale first paint.
- Confirm en_XA does not appear in any dist/assets chunk (grep the chunks).

STEP 6 - REVIEW: spawn `qa-checklist` at completion. OPTIONALLY also spawn a LIGHT
privacy-security-review for the inline <script> / CSP angle - the strict matrix does NOT require it
(Phase 4 is not a CI/secret/server change), but an inline script in index.html that reads
localStorage and injects a same-origin preload is worth a quick look (does it read ONLY
localStorage.locale, inject ONLY a same-origin same-priority preload, no third-party origin, no
CSP `script-src` regression). Do NOT spawn migration-safety or cross-platform-sync.
Prompt agents for COVERAGE not filtering. Resume on truncation with:
"Stop reading more files. Output the full report now based on what you have already seen.
 No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."
Do not commit until no BLOCKING issues remain.

STEP 7 - COMMIT CADENCE (Conventional Commits, scope, EXPLICIT paths, no em dashes/emojis):
1. feat(build): resolve stored-locale chunk hash from Vite manifest post-build
2. feat(ui): inject modulepreload for the stored locale + runtime prefetch in index.html
3. docs(i18n): Phase 4 progress + state

STEP 8 - ACCEPTANCE CRITERIA (do not mark complete until all check):
- [ ] Inline boot <script> in index.html <head> reads localStorage.locale and injects
      `<link rel="modulepreload">` for that locale's hashed chunk BEFORE the main module parses;
      crossorigin matches the module request (no double-fetch); modulepreload preferred over prefetch.
- [ ] The hashed locale-chunk filename is resolved correctly from dist/.vite/manifest.json by the
      post-build hook (manifest enabled in vite.config.ts).
- [ ] A stored-locale network trace: the locale chunk is high-priority + parser-discoverable, NO
      double-fetch, NO main-then-locale waterfall. A default-English visitor still fetches zero non-en chunks.
- [ ] Throttled TTI probe (Slow-4G + 4x CPU, median of N): English not slower; stored-locale faster
      than the no-preload baseline. Mobile screenshot: no layout shift.
- [ ] `npm run build` green; `i18n:hash --check` OK (SHA unchanged); en_XA tree-shaken from every chunk.
- [ ] No speculative preload of other locales; the runtime prefetch helper ships alongside the link (BOTH).

STEP 9 - DOC UPDATES + MEMORY:
- progress.md: mark Phase 4 status + ticks; note the TTI delta vs the no-preload baseline.
- state.md: record any drift (e.g. whether the manifest was already enabled; the chosen template-vs-read
  approach for the lookup).
- Memory: record anything surprising (e.g. a crossorigin double-fetch gotcha, a manifest path quirk).

STEP 10 - FINAL RESPONSE FORMAT:
End with: phase status, files touched, the stored-locale trace result (high-priority, no double-fetch,
no waterfall), the TTI delta, the SHA check, the qa-checklist verdict (+ the optional privacy-security
note if run), any deferred items, and a one-line handoff for Phase 5 (CI / git hygiene).

STOPPING RULES:
- STOP if the build hook cannot reliably resolve the hashed filename from dist/.vite/manifest.json.
- STOP if a double-fetch of the locale chunk cannot be avoided (the crossorigin match is the fix; if
  it still double-fetches, surface it rather than ship a wasteful second download).
- STOP if enabling the Vite manifest perturbs the bundle in a way that moves the resolved-table SHA
  (it should not - the manifest is metadata; flag it if it does).
```
