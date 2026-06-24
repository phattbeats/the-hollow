# Frontend Modernization onto release/v0.16.0: feasibility and plan

Investigation date: 2026-06-24. Decision owner ran an ultracode feasibility probe
(primary git inspection, a real merge dry-run with tsc, an adversarial verification
Workflow over 7 tracks + a coverage critic). This document does not delete or supersede
the existing packet; it sits beside it to record the verdict and the chosen path.

Refs used:
- PBASE = `45730bf4` (packet base = release/v0.14.1 tip; the merge-base of FB and V16).
- FB = `feature/frontend-modernization` (HEAD `4be46046`, the completed 9-phase refactor).
- V16 = `origin/release/v0.16.0` (HEAD `e31eb05d`; 288 commits, +138,940/-64,927 over PBASE).

All probes ran read-only against those refs or in a throwaway worktree under the session
scratchpad. FB and the V16 checkout were never mutated. No push, no PR, code freeze honored.

---

## A) VERDICT: Option B (restart the refactor on release/v0.16.0)

The refactor's load-bearing premise (IWorld frozen, change is presentation-only, the merge
is mechanical) held on FB's side of the ledger but the target moved out from under it. The
clean-to-merge surface is real but narrow, and Option B inherits every bit of it for free.
The expensive surface (hud.ts, main.ts, the entry HTML, vendor, the new windows) is
delete-vs-rewrite that forces a re-extraction either way. Option A pays conflict archaeology,
carries several silent-revert hazards that compile clean, and THEN still pays the same
enlarged re-extraction. Option B pays the re-extraction once, on a green base, with the
now-proven playbook. B dominates.

### Merge dry-run results (the hard evidence)

A real 3-way merge of V16 into FB (`git merge-tree` plus a worktree merge) produces exactly
**7 conflicted files**, not the 3-4 the recon emphasized:

| # | File | Nature | Covered by recon? |
|---|---|---|---|
| 1 | `src/ui/hud.ts` | 33 conflict regions; ~12 are delete-vs-rewrite (FB shim of 0-3 lines vs V16 inline body of 100-553 lines) | yes (T4) |
| 2 | `src/main.ts` | 2 conflict regions inside a V16 **+1999/-733 (~2700-line) rewrite** of the client entry | **no** |
| 3 | `index.html` | changed-in-both; FB externalizes the whole inline `<style>`, V16 added ~288 CSS + ~149 HTML lines of new-window markup | yes (T5) |
| 4 | `play.html` | changed-in-both; FB externalizes; V16 added ~241 CSS lines | yes (T5) |
| 5 | `tests/client_shell.test.ts` | two-sided rewrite: V16 +411/-137, FB +544/-172 | yes (T7) |
| 6 | `package.json` | changed-in-both; needs a **union** (FB: lightningcss/playwright/browser-test + exact pins; V16: biome/version-sync/db scripts) | **no** |
| 7 | `package-lock.json` | alphabetical-neighbor collision (`@blazediff` vs `@biomejs`); must delete + `npm install` | **no** |

The textual conflict count understates the cost. The decisive facts are in the *silent*
auto-merges and the tsc behavior of the merged tree.

### tsc on the merged tree (two probes)

1. **`git merge -X ours` (keep the refactor at every conflict, auto-take V16's clean
   additions) then `tsc --noEmit`: 245 errors.** They cluster as:
   - `src/ui/leaderboard_painter.ts:41` (1 error): `Type 'LeaderboardPage' is missing the
     following properties from type 'LeaderboardEntry[]': length, pop, push, concat, and 29
     more.` This is the one genuine silent-auto-take break in cleanly-merged, FB-authored
     code, caused entirely by the IWorld `leaderboard()` signature change.
   - 156 in `hud.ts` + 88 in `main.ts`: merge-Frankenstein artifacts (90 `TS2300` duplicate
     identifier, 82 `TS2339` missing `Hud` property such as `pendingChatLinks`/`talentStage`,
     57 `TS2304` cannot-find-name `BagCategory`/`BagSort`, and a `TS1113` doubled `default:`
     switch clause). These prove the conflicted files cannot be auto-resolved: the most
     automatic resolution yields a structurally broken tree.

2. **Isolation probe (FB + only V16's `src/world_api.ts`) then tsc: 9 errors.** All but the
   leaderboard one are artifacts of the partial overlay, but they pin down the real shape of
   the seam:
   - `world_api.ts` imports new V16 sim modules `./sim/leaderboard_page`, `./sim/lockpick`
     and new `sim/types` members `DelveObjectiveState`, `LootRollPrompt`: V16's IWorld is
     **coupled to V16's sim layer**, not purely presentation-additive.
   - `tests/appearance_skin.test.ts`: "Sim is missing `activeLootRolls, acceptLinkedQuest,
     sellAllJunk, setPetAutoTaunt`, and 18 more": **~22 new IWorld members**.
   - In a full merge those sim files plus V16's Sim/ClientWorld implementations arrive
     cleanly (FB touched zero lines of `src/sim`, `server`, `src/net`, `headless`), so 8 of
     these 9 resolve automatically. The single residual break in FB-authored code is
     `leaderboard_painter.ts`.

### Silent-revert hazards under Option A (compile clean, no error to catch them)

- **The dual-vendor both-survive tree.** FB's `vendor.ts` + `vendor_painter.ts` and V16's
  `vendor_view.ts` + `vendor_window.ts` have different filenames, so git adds all four with
  no conflict. The merged tree contains two complete, incompatible vendor implementations of
  `#vendor-window`; only hud.ts conflicts. Worse, V16's vendor ships a **sell-all-junk**
  feature (`sim.sellAllJunk()`, a UI button, `itemUi.vendor.sellJunk*` keys) that FB's vendor
  lacks entirely. Resolving by re-applying FB's vendor silently drops that shipped feature.
- **The main.ts fx-profile cases.** FB added `case 'graphicsPreset'` /
  `case 'effectsQuality'` to `applySetting` to drive the Phase-8 `data-fx-level`/`--fx-*`
  system; V16 reformatted the adjacent cases. A careless "take theirs" drops FB's two cases
  and the entire graphics-tier effects system goes dead with no compile error.
- **The CSS feature lines inside the index/play.html conflict hunks.** Taking FB's wholesale
  `<style>` deletion silently drops V16's ~529 new feature-CSS lines (lockpick ~114, delve
  ~90, bag-filter ~30, raid/arena ~25, vendor/affix) plus ~149 lines of new HTML panel
  markup. HTML/CSS is untyped, so nothing flags the loss.

### Recon claims corrected by the evidence (the stopping rule fired three times)

- **"V16 added a 5th 'advanced' graphics preset, the resolver needs updating": REFUTED.**
  `src/render/gfx.ts` is byte-identical PBASE -> V16; the `'advanced'` label existed at
  PBASE; FB's `ui_effects_profile.ts` already resolves all five labels
  (low/medium/high/ultra/advanced). This work item does not exist.
- **"BOTH deleted renderVendor()": REFUTED for V16.** Only FB deleted it. V16 keeps a thin
  `renderVendor()` (6 refs, hud.ts:8126) plus `openVendorNpcId`. The collision is asymmetric.
- **"V16 added chat_window.ts": REFUTED.** `chat_window.ts` existed at PBASE; the actually
  new chat module is the 36-line `chat_input_autosize.ts`.
- **"hud.ts churn is ~630/-252 inside window bodies": REFUTED.** V16 rewrote the window
  bodies in place; the merge shows V16 sides of 100-553 lines per method against FB's 0-3
  line shims. Thousands of conflicted lines, the delete-vs-rewrite kind.
- **"the merge silently drops V16's CSS": REFUTED as automatic.** index/play.html raise a
  real conflict; the drop is a *resolution* hazard, not an automatic one.

The corrections cut both ways (the 5th preset removes work; the main.ts/package conflicts add
it), and on balance they make Option A's surface larger and more hazardous than the recon
suggested, not smaller.

### Why not Option A, given that the seam merges cheaply

The two tracks that favor A (T1: IWorld auto-takes with one mechanical fix; T7: the test
harness has exactly one real conflict and V16's 64 new test files arrive as free adds) are
both true and both narrow, and **Option B captures both benefits**: B starts from V16, so
V16's IWorld, its 64 test files, and its 17 new modules are simply present and working. The
only thing A does cheaply that B does not, A does not actually do uniquely. Everything that
distinguishes A from B (hud.ts, main.ts, the entry HTML, the vendor collision, the new
windows) is delete-vs-rewrite that A must resolve by re-extracting from V16's code, which is
the same labor as B's re-extraction, performed on a dirty conflicted tree instead of a clean
one, and preceded by archaeology and shadowed by the silent-revert hazards above.

---

## B) EFFORT + RISK, per option

Effort is expressed in phase units relative to the original packet (each "impl + QA" pair was
roughly a focused agent-day on Opus 4.8 xhigh with Workflow fan-out for the batch-heavy
phases). The original packet was 9 impl + 9 QA = 80 commits.

### Option B: restart on v0.16.0 (recommended)

| Phase | Transfer from FB | Delta on V16 | Effort vs original | Risk |
|---|---|---|---|---|
| 1 Foundation gates | near-verbatim (vite/tsconfig byte-identical on V16) | re-scan backdrop twins incl V16 feature CSS | 0.8x | low |
| 2 CSS extraction + tokens | same technique | +529 new feature-CSS lines + ~149 HTML lines to extract (lockpick/delve/bag/raid/vendor) | 1.4x | low-med |
| 3 --hud-scale + breakpoints | same cores | re-point the `syncAppViewport` applier onto V16's ~2700-line-larger main.ts | 1.1x | low-med |
| 4 Lightning CSS flip | verbatim (vite.config byte-identical) | survival check scans V16 feature backdrop pairs | 0.9x | low |
| 5 Mobile-landscape + admin | same | re-apply onto V16 admin.html/main.ts | 1.1x | low |
| 6 Per-window encapsulation | same | add container queries to the new lockpick/delve/raid panels | 1.2x | low |
| 7 HUD window extraction | proven pattern | **biggest delta**: 14,377-line hud.ts; 11 classic windows still inline + reconcile V16's pre-extracted vendor_window/lockpick_window/delve_map/party_frames; +delve/lockpick/raid wiring | 2.0-2.5x | med |
| 8 Graphics-tier effects | verbatim (resolver already 5-valued) | extend fx buckets B1-B7 to cover new feature CSS; re-point applier onto V16 main.ts | 0.9x | low |
| 9 Testing + docs sweep | verbatim (browser suite net-new on V16 too) | add cross-engine cores for new windows | 1.1x | low |
| NEW Biome compliance | n/a (Biome deferred originally) | author all new CSS+TS Biome-clean; one `biome check --write` sweep + lint triage | 0.5x | low |

Aggregate: roughly **1.3-1.5x the original packet**, almost entirely concentrated in Phase 2
and Phase 7. Risk profile: low. The playbook, seams, tests, and decisions are known-good; the
only genuinely new design decision is the vendor reconciliation (section C).

### Option A: merge + re-apply (not recommended)

| Step | Work | Effort | Risk |
|---|---|---|---|
| Resolve hud.ts | 33 regions, ~12 delete-vs-rewrite = re-extract each window from V16's body | ~ Phase 7 in full | high (each wrong pick silently drops a V16 window body or the extraction) |
| Resolve main.ts | understand V16's ~2700-line rewrite, re-apply FB Phase 3/5/8 wiring | 1.0x | **high** (fx-profile cases drop with no compile error) |
| Resolve index/play.html | re-home 529 CSS + 149 HTML lines into the right src/styles modules | 0.8x | high (silent CSS loss) |
| Resolve package.json + lock | union deps, regen lockfile keeping exact peers | 0.3x | med |
| Resolve client_shell.test.ts | take FB rewrite, re-add any V16-only shell assertions | 0.4x | med (unverified that FB's covers V16's) |
| Fix leaderboard_painter.ts | mechanical (await `leaderboard(0)`, feed `.leaders`) | trivial | low |
| Reconcile dual vendor | delete one set of 4 files, rewrite hud.ts vendor wiring, re-port sell-junk if FB's chosen | 0.6x | high |
| Extract the new windows | lockpick/delve/raid into the chosen seam (same as B's new work) | = B's new work | med |
| Re-run every phase validation on the merged tree + Biome | full CI mirror, survival check, browser suite, biome ratchet | 1.0x | med |

Aggregate: roughly **1.5-2.0x Option B**, with materially higher risk because several
hazards (main.ts fx cases, CSS hunks, dual-vendor, dropped V16 shell assertions) pass tsc and
the test gate only if resolved correctly by hand. Option A is "B's work plus archaeology."

### Top risks (ranked)

1. **The unanalyzed 2700-line V16 rewrite of `src/main.ts`** (the client entry / scene
   coordinator, highest blast radius). Under A it must be understood and re-merged; under B
   it is simply the base and FB's ~97 lines of appliers re-point onto it. Biggest single
   uncertainty either way; it pushes toward B.
2. **The vendor design collision + sell-junk feature.** Incompatible seams, asymmetric
   deletion, a shipped V16 feature FB lacks, and a silent both-survive merged tree.
3. **The silent IWorld auto-take** (leaderboard breaking change). Bounded to one file, but it
   is the canary: it proves the seam is no longer frozen.
4. **The 2 new windows (lockpick, delve) + raid_lockout** that the refactor never built.
5. **The Biome forward ratchet** (changed-files only): every new CSS+TS file must pass
   `biome ci`. Bounded and mechanical, equal cost both paths.

---

## C) THE PLAN (Option B)

### Branch

Cut `feature/frontend-modernization-v016` off `origin/release/v0.16.0`. Keep FB intact as a
reference (its painters, cores, CSS modules, tests, and the proven phase docs are the source
material to port). Work in a dedicated worktree to respect the shared-checkout convention.

### Step 0: read the two diffs that drive everything (before any phase)

Read `git diff PBASE V16 -- src/main.ts` and `git diff PBASE V16 -- tests/client_shell.test.ts`
in full. main.ts is the entry coordinator and the place FB's Phase 3/5/8 appliers must
re-attach; client_shell is the guard suite the refactor re-authors. Everything else is
mechanical once these are understood.

### Phase transfer map

| Phase | Status on V16 | Action |
|---|---|---|
| 1 Foundation gates | transfers verbatim | re-pin lightningcss/vite exact; re-author client_shell corpus against V16's entries; rebuild the backdrop-twin inventory including V16 feature CSS |
| 2 CSS extraction | transfers, larger | extract V16's index/play `<style>` (now with lockpick/delve/bag/raid/vendor/arena CSS) into the src/styles modules; new feature CSS lands in `index.extra.css`/`play.extra.css` (the @layer components catch-all) |
| 3 --hud-scale + breakpoints | transfers | port `hud_scale.ts` + `breakpoints.ts` verbatim; re-point the `syncAppViewport` applier into V16's main.ts |
| 4 Lightning flip | transfers verbatim | vite.config is byte-identical; `.browserslistrc` + survival check apply as-is, survival check now scans V16 feature backdrop pairs |
| 5 Mobile-landscape | transfers | re-apply dvh/svh/safe-area + `--keyboard-inset` onto V16 index/play/admin.html |
| 6 Per-window encapsulation | transfers, +new panels | container queries on the 11 classic windows plus lockpick/delve/raid panels |
| 7 HUD window extraction | transfers, **biggest** | see "new phases / new work" below |
| 8 Graphics-tier effects | transfers verbatim | `ui_effects_profile.ts` already 5-valued (no 5th-preset work); extend fx buckets to any new feature CSS that uses glass/glow/ambient; re-point applier into V16 main.ts |
| 9 Testing + docs sweep | transfers verbatim | browser suite net-new; add cross-engine cores for the new windows; sweep the CLAUDE.md set |

### New phases / new work (fold into Phase 7 plus one new gate)

- **New windows.** lockpick (`lockpick_window.ts` + `lockpick_panel.ts`, a DOM class + pure
  helper), delve (`delve_map.ts`, pure helper), and raid lockout (`raid_lockout.ts` +
  `raid_lockout_view.ts`). V16 already pre-extracted these into sibling modules, so the work
  is to *normalize* them to the refactor's pure-core + painter seam (or adopt them as-is), not
  to extract from scratch. `party_frames.ts` is already its own module and belongs to the
  per-frame layer the refactor deliberately leaves in place; keep it there.
- **Vendor reconciliation (the one real design decision).** Recommended: **adopt V16's
  `vendor_view.ts` + `vendor_window.ts` as the canonical vendor**, because it is already
  shipped, tested (`vendor_view.test.ts`), and carries the sell-all-junk feature; do not port
  FB's `vendor.ts`/`vendor_painter.ts`. Then decide consistency: either (a) leave V16's
  `VendorWindowDeps` callback seam as-is and accept a two-pattern HUD (callback-injection for
  the V16-era windows, PainterHost for the classic ones), or (b) normalize `vendor_window` and
  the other V16 windows into PainterHost for a single seam. Recommend (a) for the first pass
  (less churn, V16's tests stay green) with (b) as a follow-up consistency phase if desired.
  Either way, FB's vendor pure-core shape (id+price rows) is discarded in favor of V16's
  (ItemDef-carrying rows).
- **IWorld-aware painter typing.** Port FB's painters against V16's IWorld. The only signature
  that changed under a painter is `leaderboard()`: `leaderboard_painter.ts` must `await
  world.leaderboard(0)` (or page through `LeaderboardPage`) and feed `page.leaders` into
  `leaderboardView`, importing `LeaderboardPage`. All other new IWorld members are additive
  and consumed only by the new windows.
- **5th-preset: no action.** Confirmed non-issue (`ui_effects_profile.ts` already resolves
  `'advanced'`; `gfx.ts` byte-identical).
- **Biome compliance gate (new).** Author every new CSS + TS module Biome-clean (single
  quotes, 2-space, semicolons, trailing commas). Run `biome check --write` over the new files
  and triage the `recommended` lint findings (per repo history, `noNonNullAssertion` /
  `noExplicitAny` tend to be warnings, leave them). The CI ratchet (`biome ci --changed
  --since=$BASE_REF`) only checks changed files, so this is bounded to the refactor's diff.

### Re-validation per phase (the proven matrix, unchanged)

`npx tsc --noEmit` every phase; `vitest run` the touched cores + `tests/architecture.test.ts`
for pure-core changes; `vitest run tests/client_shell.test.ts` + `npm run build` +
backdrop-survival for CSS/HTML; the mobile screenshot scripts for responsive; `npm run
perf:tour` for effects/containment; and the full CI mirror (`npm run i18n:gen && npm test &&
npx tsc --noEmit && npm run build:env && npm run build:server && npm run build`) plus the
release-tier i18n gate (`I18N_RELEASE_TIER=1`, pending=0) and now `biome ci --changed`
pre-merge. Spawn `qa-checklist` per phase; the change stays presentation-only so the other
reviewers (`cross-platform-sync`, `migration-safety`, `privacy-security-review`) fire only if
a phase is found to touch `src/world_api.ts`/server/net (it should not, except consuming the
already-merged V16 IWorld).

---

## D) What would change this recommendation (A <-> B flip conditions)

Option B would lose its edge, and Option A become preferable, only if all of the following
turned out true:

1. **The hud.ts conflict were import/orchestration churn, not delete-vs-rewrite.** It is not:
   ~12 of 33 regions are FB-shim vs V16-100-to-553-line-body. If a future re-measurement
   showed the window bodies were untouched by V16 and only the frame layer churned, the merge
   would be mechanical and A would win.
2. **V16 had not independently extracted/rewritten vendor.** If V16's vendor were still a
   plain inline `renderVendor()` body (no `vendor_window.ts`, no sell-junk), FB's vendor
   painter would re-apply cleanly and the collision would vanish.
3. **The new windows did not exist.** If lockpick/delve/raid were absent, there would be no
   net-new extraction and A's only real cost would be conflict resolution.
4. **`src/main.ts` had near-zero V16 churn.** The ~2700-line rewrite is the biggest A-side
   uncertainty; a small main.ts diff would remove the highest-blast-radius reconciliation.

None of these hold, so the recommendation is Option B. Conversely, B would be reinforced
further (not flipped) if reading the V16 main.ts diff reveals additional FB-applier collision
points, or if taking FB's `client_shell.test.ts` rewrite is found to drop V16-only shell
assertions: both would add cost to A only.

---

## Appendix: probe commands (reproducible)

```
# in-memory 3-way merge, conflict enumeration
git -C <FB-worktree> merge-tree --write-tree --name-only \
    feature/frontend-modernization origin/release/v0.16.0

# most-optimistic Option-A tree + tsc (silent-auto-take break catalogue)
git worktree add --detach <scratch>/merge-dryrun feature/frontend-modernization
cd <scratch>/merge-dryrun
ln -s <FB-worktree>/node_modules node_modules
git merge --no-edit -X ours origin/release/v0.16.0
node_modules/.bin/tsc --noEmit        # 245 errors; 1 in leaderboard_painter.ts

# isolation probe: FB + only V16's world_api.ts
git checkout -f --detach feature/frontend-modernization
git checkout origin/release/v0.16.0 -- src/world_api.ts
node_modules/.bin/tsc --noEmit        # ~22 new IWorld members; sim coupling

# scope counts
git diff --name-status PBASE V16 -- src/ui | grep '^A'   # 17 new modules
git diff --name-status PBASE V16 -- tests | grep -c '^A' # 64 new test files
```
