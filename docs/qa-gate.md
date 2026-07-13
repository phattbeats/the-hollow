# The QA gate

World of ClaudeCraft is built entirely with Claude Code, by many contributors. To keep the
quality bar high without slowing the edit loop, the project enforces it in layers. Each layer
does exactly one job, at the cheapest moment it can, and nothing heavier than necessary runs on
the inner loop.

## The layers

| Layer | What it is | When it runs | Cost | Blocks? |
|---|---|---|---|---|
| Instant copy gate | `Stop` hook -> `.claude/hooks/qa-stop.sh` | end of every Claude Code turn | milliseconds | yes, on a hard-invariant hit |
| Deterministic floor | `.githooks/pre-push` | once per `git push` | seconds | yes, on red |
| Judgment review | `/qa` command + the `qa-checklist` agent + the domain reviewers | when you finish a unit of work | an agent run | no (advisory locally, enforced at PR review) |

### 1. Instant copy gate (every turn)

`qa-stop.sh` scans only the lines the current turn ADDED, for hard invariants that are
detectable in milliseconds: an em dash, en dash, or emoji; a stray `.only(` that would silently
disable a test suite; a leftover `debugger`. On a hit it asks Claude to fix those exact lines
before finishing; otherwise it is silent. It never runs `tsc`, `vitest`, `biome`, or any agent.
A Stop hook fires every turn, so anything heavier here would tax every iteration, and a hook is
a shell command that cannot spawn an agent anyway.

### 2. Deterministic floor (every push)

`.githooks/pre-push` runs the heavier deterministic checks once, at the push boundary
(infrequent, so it does not slow editing): `tsc --noEmit`, the determinism/purity and
i18n-matcher guard tests, `biome` scoped to the branch's changed files, and a copy-rule scan of
the push diff. It blocks the push on any failure. Bypass in a genuine emergency with
`git push --no-verify`. The `SessionStart` hook `.claude/hooks/ensure-hooks.sh` points this
clone's `core.hooksPath` at `.githooks` so the floor actually runs (idempotent, and it never
clobbers an existing hook setup).

### 3. Judgment review (when you finish a feature)

Determinism, three-host parity, server authority, persistence safety, i18n correctness,
render/UI seams, responsive/mobile, competitive fairness across graphics tiers and devices
(no preset or device gives an information or timing advantage), content fidelity, and
performance need reasoning, not a regex, so they are an agent, not a hook. Run `/qa` (or invoke the `qa-checklist` agent) when you
finish a unit of work. It scales its depth to the size of the change, checks every invariant in
play, names the domain reviewers to dispatch, and ends with an adversarial "what is missing"
pass.

## The reviewer agents

All read-only, all in `.claude/agents/`:

- **`qa-checklist`** - the evergreen end-of-contribution gate (also reachable as `/qa`). The
  default; it dispatches the others by domain.
- **`architecture-reviewer`** - determinism, rng draw-order, tick-phase, and the `SimContext`
  seam, for any `src/sim/` change.
- **`cross-platform-sync`** - IWorld parity, the wire protocol, SimEvent and command coverage,
  and the sim/server i18n matchers.
- **`migration-safety`** - inline-DDL and JSONB persistence safety (additive/idempotent DDL,
  back-compat, indexes, parameterized SQL, boot safety).
- **`privacy-security-review`** - server authority / anti-cheat, dev-command gating, secrets,
  auth (including OAuth, TOTP, and wallet linking), and account-data privacy.
- **`release-malware-audit`** - the release gate for deliberately planted malicious code
  (triages `scripts/malware_scan.mjs`).

## Hosted CI is OFF: the local pr-gate is the merge gate

Board decision (2026-07-11): the studio does not pay for GitHub Actions. Actions is
disabled on this repo (and all phattbeats project repos); do not re-enable it, do not
wait for, request, or expect green checks on GitHub, and do not treat missing checks as
a blocker or a pass. The merge gate is now local and mandatory:

1. Merge latest `main` into the PR branch (or check out the merged tree).
2. Run `bash scripts/pr_gate_local.sh`. It mirrors the old `pr-gate` CI job exactly
   (i18n artifact freshness, malicious-code gate, `npm test`, `tsc --noEmit`, the three
   builds) and must end with `PR GATE: GREEN`.
3. Paste the tail of the gate output in a PR comment as evidence, then merge.

A "built clean" claim without gate output is not evidence. Pre-existing failures on
`main` are baselined the same way as before: run the gate on `main` first if in doubt,
and only new failures block the PR.

**Run the gate in a NON-production shell, or you get a cascade of FALSE reds.** A
`NODE_ENV=production` environment (some CI/QA containers export it) corrupts the gate two
ways, and both look like a code break but are not:
- `npm ci` defaults `omit=dev`, so it installs only runtime deps (a suspiciously small
  "added N packages") and skips every devDependency. The gate then dies at the first stage
  needing one with a misleading `ERR_MODULE_NOT_FOUND` (e.g. `esbuild` from
  `scripts/i18n_build.mjs`). Fix: `NODE_ENV=development npm ci --include=dev`, and if the
  `esbuild`/`sharp` postinstalls were held for script approval, run
  `node node_modules/esbuild/install.js` so the native binary is fetched.
- `NODE_ENV=production` also flips RUNTIME behavior under Vitest: `import.meta.env.PROD`
  becomes true, so `isReleaseBuild()` turns on (release-tier i18n hard-fails every `pending`
  row, reddening `i18n_t_behavior` / `i18n_pseudo_locale` / `i18n_admin_catalog` /
  `localization_coverage`), and `publicOriginFromRequest` (`server/realm.ts`) returns the
  hardcoded production origin instead of deriving from the request host, reddening
  `player_card_server`. None of these are real: they all go green under `NODE_ENV=test`.
  Always run the suite with `NODE_ENV=test` (or unset) when triaging a red `main`, and
  attribute any red that clears under `test` to the environment, not the tree.

### When `main` itself is RED (the gate blocks the whole queue)

If `main` is red on the gate, no PR can merge GREEN, so a red `main` is a P1 that
gates every other Hollow merge. The recurring cause here is the CI lockout: with the
pr-gate not enforced by hosted CI, a PR admin-merged during the lockout can land a
content/data change WITHOUT its paired test update, and the red only surfaces when the
next contributor runs the gate. Fixing it is a test-vs-data reconcile: decide which
side is the source of truth before touching either.

- **Test is stale, content is sound -> update the test.** Confirm the content is
  actually, fully wired before trusting it: run the coverage guards (e.g.
  `tests/progression.test.ts` for quest giver/order), check that every referenced id
  (NPC, item, target) resolves, and check the shape invariants the changed test
  encodes still hold. Only then rewrite the assertion to the shipped reality, and
  extend the invariants to the new data rather than just widening the expected value.
- **Content is wrong / half-wired -> the test caught a real bug.** Do NOT weaken the
  assertion to go green: that turns the guard off and encodes the defect as expected.
  If the fix is out of scope for unblocking the queue (art/render work, a missing
  system), scope the passing invariant to the unaffected cases, mark the gap with a
  loud `it.todo(...)` referencing a filed bug ticket, and file that ticket with
  evidence. The todo becomes a real assertion when the fix lands.

Baselined incidents (fixed, kept as precedent):
- **PHAA-694** (2026-07): the ticket opened citing two content-test reds, but a full
  `NODE_ENV=test` sweep of bare `origin/main` found FOUR env-independent reds (the first
  triage undercounted by running only the two static-data assertions). Lesson: when `main`
  is red, run the WHOLE suite in a non-production shell before scoping the fix; a targeted
  two-test look misses siblings from the same admin-merge. The four, all from lockout
  admin-merges:
  1. `shade_questline.test.ts` STALE (PR #199 shipped Shade quests 2 and 4, soundly wired;
     test still asserted the 2-quest pair) -> updated the test to the 4-quest line.
  2. `i18n_completeness.test.ts` REAL (same PR #199: the wordy quest-2/4 prose,
     `q_the_long_way_around` / `q_the_watering_can` / `withered_planting` / `buried_root`,
     14 keys, shipped English-only and leaked byte-identical into the five non-Latin
     locales, violating the M16 PR-tier rule) -> needs the five non-Latin fills (maintainer
     localization work, not a QA test-reconcile).
  3. `held_weapon_models.test.ts` REAL (the female `_f` chibi bodies from PR #169 render no
     held weapon) -> scoped the invariant to the KayKit bodies, `it.todo` for the `_f` gap,
     defect filed as PHAA-697.
  4. `hud_perf_budget.test.ts` REAL-but-trivial (the new `readable_prompt_painter.ts` landed
     unclassified) -> it is facet-routed (writes only through the elided writers, mirrors
     `housing_prompt_painter.ts`), so registered in `HOT_PAINTERS`.
  The container also threw ~10 FALSE reds from `NODE_ENV=production` (see the gotcha above)
  and 4 nondeterministic timing flakes (`social`/`fixes`/`threat`/`fiesta`, green on re-run).

## Keeping the gate current

The reviewer agents encode facts about the codebase (seams, file roles, invariants, the gates
that enforce them). When the architecture changes, update the relevant agent in the same spirit
as the code: anchor claims on stable things (file paths, symbol names, gate names), NOT on line
numbers or line counts, which drift constantly. The `qa-checklist` agent is the place to add a
new evergreen check; a new dedicated reviewer is only worth it when an invariant is large enough
to need its own focused prompt and is not already covered by a standing test.

## Trust and safety

The hooks run shell on your machine with your permissions, so treat them like any other
checked-in tooling. They are deliberately small and auditable (bash plus `git` and `perl`), read
only `git diff` and `git config`, write nothing outside `core.hooksPath`, and make no network
calls. Claude Code does not run project hooks until you confirm trust for the repo, and the hook
set is snapshotted at startup. The repo's own `release-malware-audit` scanner also scans
`.claude/**`. To opt out: `git push --no-verify` (one push), `git config --unset core.hooksPath`
(disable the pre-push floor for your clone), or `"disableAllHooks": true` in your
`.claude/settings.local.json` (which is not checked in). See `.claude/hooks/README.md`.
