# tests/parity: the golden-trace parity gate

This is the safety net for the ongoing `refactor/sim` extraction work. Every later
session MOVES a slice of behavior out of the large `Sim` class; the #1 risk is silent
behavior drift during a "move." This harness records the FULL deterministic Sim
behavior for seeded scenarios and fails if any future change alters it.

## What it captures (the trace)

Per scenario, on a fixed tick cadence, each `Frame` pins:

- **Every player's `PlayerMeta`** (`samplePlayerMeta`): xp/lifetimeXp/restedXp/
  prestige, copper, inventory/vendorBuyback, equipment, questLog/questsDone,
  counters, arena (1v1 + 2v2) standings, delve progression, talents/loadouts,
  raidLockouts, fiesta state. Session/presentation/derived fields are excluded
  (`META_EXCLUDE`).
- **Every player + explicitly tracked mob/pet `Entity`** (`sampleEntity`): hp/pos/
  facing, resources, stats/weapon, auras, cooldowns, threat, ccDr, casting, combat,
  AI, loot, mob timers. Presentation/interpolation fields are excluded
  (`ENTITY_EXCLUDE`). We sample players + tracked ids only (NOT every world entity)
  to keep goldens ~100 KB, not MB.
- **The SimEvent stream**, folded per window into one `eventDigest` (emit order
  preserved, reordering events IS drift).
- **The rng draw-order fingerprint**: a rolling FNV-1a over every `sim.rng` draw's
  32-bit mulberry output, in draw order, plus the draw count. Pinned per frame.

Maps/Sets are canonicalized to sorted arrays; floats are quantized to 1e-6
(`round6`); non-finite numbers (e.g. `Entity.detonateTimer` Infinity) become string
sentinels so JSON round-trips losslessly. Samples are VALUE COPIES (the sim mutates
in place; the sampler must snapshot, never retain a live reference).

## RNG draw-order log: the design decision

There is ONE shared `mulberry32` stream (`sim.rng`) with ~109 draw sites. A
reordered guard or early-bail that draws at a different global stream position
forks the world for all later draws while final scalars can still match by luck.
The draw-order digest is the precise detector.

- We observe **only the shared `sim.rng`** via the default-off `Rng.setObserver`
  seam (`src/sim/rng.ts`). The observer is pure bookkeeping: it never draws, never
  branches sim behavior, and is a no-op when unset (so production determinism and
  `tests/architecture.test.ts` / `tests/sim.test.ts` are unchanged). It is reset
  between recordings (each `Recorder.finish` detaches it).
- We fold the **draw VALUE in draw ORDER** (count + ordered values), NOT a
  callsite tag. A stack-derived tag churns on every `sim.ts` edit (which is
  exactly what the refactor does), so it would make every extraction's golden
  falsely red. Count + ordered-value already catches reordering without that churn.
- **Construction-time draws** happen inside the `Sim` ctor, before the Rng exists
  to be observed; they are pinned by the frame-0 state sample instead. The draw log
  covers everything from `drive()` onward (the tick loop + in-drive internal calls),
  which is the refactor target.
- **Sub-streams** (`FiestaState.rng`, per-delve/lockpick seeds) are NOT folded into
  the digest. Their effects are fully observable through the sampled `PlayerMeta` +
  entity state + event stream, so drift there still turns a scenario red.

## Coverage matrix

Scenarios (`scenarios.ts`) span: warrior/mage/rogue/hunter/warlock/paladin; the
`meleeSwing` weaponStrike entry (heroic_strike, sinister_strike); player
auto-attack + base `mobSwing`; a frenzy + on-hit affix cascade (old_greyjaw +
ridge_stalker); a hunter ranged pet (`updateRangedPetAttack`) and a warlock melee
pet (`mobSwing` pet arm + `applyTaunt`); a ground AoE (`updateGroundAoEs` first +
`pulseGroundAoE` both callers); an arena 1v1 match; a fiesta match; a delve +
lockpick; and loot rolls (solo death-roll + party need/greed). `coverage.test.ts`
asserts each subsystem actually FIRES (not merely named in a comment).

## Known boundaries (what is NOT pinned, read before extracting these)

The net is deliberately scoped. These gaps are documented so a later session knows
to add coverage when it extracts the affected subsystem (an adversarial review
confirmed each):

- **Sub-stream draw order is not in the draw digest.** Only the shared `sim.rng` is
  observed. `FiestaState.rng`, the per-delve `run.seed`, and the lockpick board seed
  are distinct `Rng` instances; their draw *order* is not fingerprinted. Their
  *outcomes* are pinned where they surface into a sampled `PlayerMeta`/entity field
  or an emitted event (the fiesta scenario picks an augment so `fiestaAugments` +
  `augmentOffer`/`augmentChosen` are pinned; the delve walks the lockpick so the
  `lockpickStep` stream is pinned). When you extract a subsystem that uses a
  sub-stream, add a sub-stream draw-order check (or observe the sub-stream) in the
  same change.
- **Transient Sim-owned collections are not sampled directly.** `arenaMatches`,
  `delveRuns`, `marketListings`/`marketCollections`, `instances`, `groundAoEs`,
  `pendingMobRespawns` are pinned only via their entity/event/`PlayerMeta`
  projection. Extracting one of these should add a scenario that drives it (or
  sample the collection directly).
- **Construction-time draws + ambient world mobs.** The `Rng` is born inside the Sim
  ctor, so ctor draws are not in the draw digest; ambient camp mobs are spawned but
  never tracked. A same-draw-count reorder of ctor spawns that changes only
  untracked world-mob state is invisible. Scenarios that move ctor/spawn logic should
  track the affected mobs or add a ctor fingerprint.
- **Sample granularity.** Full state is digested every `sampleEvery` ticks (plus
  init/final/snapshots), not every tick. A change that draws no rng, emits no event,
  and reverts within one window is not pinned. The per-draw rng digest is the tighter
  net for anything that touches randomness; use `rec.snapshot()` to pin a precise
  instant when needed.
- **Lockpick hidden cells.** Only the walked solution path + the visibility window in
  the `lockpickStep`/`lockpickSession` events are pinned; un-walked, non-visible
  board cells are not.

## Running it

```
npx vitest run tests/parity                  # the gate (+ coverage + unit tests)
UPDATE_PARITY=1 npx vitest run tests/parity  # mint/refresh goldens (deliberate, reviewable)
du -sh tests/parity/golden                   # confirm ~100 KB, NOT MB
```

## The rule

A red trace means behavior changed. **Fix the extraction, never the harness.** Do
not widen `round6`, delete sampled fields, or regenerate goldens to "make it pass."
Regenerate only via `UPDATE_PARITY=1` as a deliberate, separate, reviewed commit.

## Telling a stale golden from real drift (the regen decision)

A regen is only legitimate when the sim's BEHAVIOR is unchanged and the golden is
merely stale bookkeeping. Before running `UPDATE_PARITY=1`, diff the failing
goldens and classify every changed line:

- **Benign (safe to regen):** the ONLY changed JSON keys are id-family fields
  (`id`, `nextId`, `entityId`, `sourceId`, `targetId`, `ownerId`, `playerId`,
  `objectId`, `*TargetId`, `tappedById`) and their derived `state` / `events`
  hashes, AND the per-frame `rng` draw counts and digests are UNCHANGED. That is a
  world that made byte-identical random decisions and only renumbered entities:
  something now allocates one more entity at world init, shifting every later id by
  a constant. Confirm the shift is a deliberate feature (bisect: the parent commit
  should be green against the same goldens).
- **Drift (do NOT regen, fix the code):** any change to an `rng` draw count or
  digest, or to `hp` / `pos` / resources / equipment / outcomes / event ORDER. A
  changed rng stream means the world forked; a regen would bake the regression in.

Worked example (PHAA-704, 2026-07): PHAA-517 folded a world boss into the
world-boss framework, allocating its entity at init. That shifted every entity id
`+1` across all 94 scenarios and staled 47 goldens. The diff was id-family +
`state`/`events` only, rng draw counts/digests unchanged, and the pre-PHAA-517
parent was 94/94 green, so the regen was correct. Sanity one-liner:

```
git diff <base> -- tests/parity/golden/ | grep '^[-+]' | grep -oE '"[a-zA-Z_]+":' | sort -u
```

If that key set is anything beyond the id-family + `state`/`events`, investigate
before you regen.
