# Brother Greenpaw arc: QA verification status (PHAA-484)

Companion to `docs/design/greenpaw-arc.md` (the as-built design/story reference,
PR #182). That doc says what the arc *is*; this one says what is **proven working
by tests** and what is not, so the "did we actually ship it" state is legible at a
glance and does not get lost.

- **Verified against:** the branch adding `q_your_own_hearth` (PHAA-484 finale),
  based on `origin/main` post-`aa3fd2d2b`. Re-verify against code when they
  disagree; trust the code (`docs/CLAUDE.md`).
- **Verdict: PASS.** Every currently-built feature of the arc has direct automated
  coverage and all of it is green. The arc is now closed end to end: all five
  quests plus the Homestead-unlock gate.
- **How to re-run (from a clean tree):**
  `npx vitest run tests/greenpaw_hearth.test.ts tests/plant_speech.test.ts tests/hollow.test.ts tests/dialog_commands.test.ts tests/homestead.test.ts tests/quest_offer_view.test.ts`
  (unset `NODE_ENV=production` first, per repo test note).

## Coverage matrix (feature to the tests that prove it)

| Arc feature | Owning code | Proven by (test file: key assertions) | Status |
|---|---|---|---|
| Hearth hunger/smoke model (rise, decay, mood bands clear/hazy/full) | `src/sim/greenpaw_hearth.ts`, `plant_speech.ts` | `greenpaw_hearth.test.ts`: "repeated feeding climbs clear -> hazy -> full", "smoke decays back toward clear", "hunger rises over time and feeding relieves it" | PASS |
| Feeding (emberbulb / cave_morsel consume, smoke gain, reach check, diminishing return) | `greenpaw_hearth.ts` `feedGreenpaw()` | `greenpaw_hearth.test.ts`: "feeding emberbulb ... raises smoke", "feeding cave_morsel ... too", "feeding both at once ... stacks", "refuses to feed from outside Greenpaw's reach", "feeding while he is hungrier yields a bigger smoke gain (the loop renews, it does not one-shot max)", "empty-handed feeding leaves the hearth untouched but still answers in voice" | PASS |
| Feed credits quest objectives once per call | `quests/quest_credit.ts` `onFeedForQuests` | `greenpaw_hearth.test.ts`: "a successful feed credits an active feed-type quest objective once per call (PHAA-484)" | PASS |
| Hearth save/load + keeper persistence (back-compat with old saves) | `greenpaw_hearth.ts` | `greenpaw_hearth.test.ts`: "serializes and reloads hunger/smoke exactly", "remembers the keeper: the last feeder round-trips, and an old save without one is fine", "loadGreenpawHearth(null) is a safe no-op", "rejects a garbage save instead of NaN-ing the hearth" | PASS |
| Plant rationed mood-driven voice (full_smoke edge + re-arm, whim, shared cooldown, eavesdrop, sore spots, no-clergy-name) | `plant_speech.ts` | `plant_speech.test.ts`: 16 unit + real-Sim-wiring tests incl. "speaks once when the room crosses into full smoke", "the full-smoke trigger re-arms after ... drops back out", "the shared cooldown rations back-to-back address spam into one line", "never honors Greenpaw's self-given clergy name" | PASS |
| Sustained lean-in (5 continuous minutes hazy+, one line, names the keeper, re-arms after clear, survives cooldown) | `plant_speech.ts` (`SUSTAINED_SMOKE_SECONDS`), keeper from `greenpaw_hearth.ts` | `plant_speech.test.ts`: "leans in once after smoke holds at hazy-or-better for the sustained window", "the lean-in names the keeper who has been feeding the hearth", "a stretch that dips back to clear re-arms the lean-in and restarts its clock", "the lean-in stays armed through the shared cooldown instead of being lost to it" | PASS |
| Five-quest chain: gating, ordering, choice branches, rewards/keepsakes | `src/sim/content/hollow.ts` | `hollow.test.ts`: "q_what_fills carries the full branching offer dialog", "q_the_wavelength unlocks behind q_what_fills and teaches the trainer + hearth loop", "q_the_wavelength ... can be refused for full rewards", "q_keep_him_lit unlocks behind q_the_wavelength and needs three separate feeds", "q_your_own_hearth unlocks behind q_keep_him_lit and sends the player to Sexton Faddick", "the quest loot and rewards resolve to real items on the right mobs" | PASS |
| Branching dialogue tree effects (disposition nudges, per-npc isolation, clamp, flags, gated choices, save round-trip) | `dialog_commands.ts` (`dialogChoose`), tree in `hollow.ts` | `dialog_commands.test.ts`: "nudges disposition ... and reports it applied", "keeps disposition per-npc", "clamps disposition to the [-10, 10] band", "sets a persistent flag", "rejects a choice whose gate is unmet, applying nothing", "round-trips disposition and flags", "serializeCharacter writes dialogState and addPlayer restores it" | PASS |
| Homestead claim gated behind the full Greenpaw arc + reaches the Plant threshold wiring | `homestead.ts` (`hasFullGreenpawArc`, `homesteadClaim`), `plant_speech.ts` `notifyThreshold` | `homestead.test.ts`: "rejects a claim before the full Greenpaw quest arc is done"; `plant_speech.test.ts`: "claiming a homestead reaches the Plant through the real Housing wiring" | PASS |

## Gaps and notes for QA to keep tracking

- **Correction to this doc's prior "NOT built" call.** Earlier revisions of this
  doc and `greenpaw-arc.md` stated the Homestead claim path had no quest gate
  (checking a `claimPlot`/`housing.ts` symbol that was never the real one). That
  was wrong: `src/sim/homestead.ts`'s `hasFullGreenpawArc` (landed with the
  Homestead v0 reland, PR #85, 2026-07-04, well before this arc's finale was even
  pitched) already gated `homesteadClaim` behind
  `HOLLOW_QUEST_ORDER.every((qid) => meta.questsDone.has(qid))`, and
  `tests/homestead.test.ts` already proved it ("rejects a claim before the full
  Greenpaw quest arc is done"). `HOLLOW_QUEST_ORDER` is append-only for exactly
  this reason, so appending `q_your_own_hearth` to it (this quest's whole
  gating mechanism) needed no new gate code and no change to that existing test.
- **Not separately unit-tested, low risk:** the online server live-LLM
  `sustained_smoke` prompt instruction (server-only, exercised by the shared canned
  floor which IS tested); the intro/greeting click-through voice (content, covered
  by `npc_intro_view` / roster tests, not arc-specific logic).

## Source map (mirror of the design doc, for the tester)

| File | What QA points a test at |
|---|---|
| `src/sim/greenpaw_hearth.ts` | hunger/smoke/feed/keeper -> `tests/greenpaw_hearth.test.ts` |
| `src/sim/plant_speech.ts` | mood, rationed voice, sustained lean-in -> `tests/plant_speech.test.ts` |
| `src/sim/content/hollow.ts` | the 5 quests + dialogue tree data -> `tests/hollow.test.ts` |
| `src/sim/quests/quest_credit.ts` | feed/interact/collect credit -> asserted from `tests/greenpaw_hearth.test.ts` + `tests/hollow.test.ts` |
| `src/sim/dialog_commands.ts` | dialogue-choice effects -> `tests/dialog_commands.test.ts` |
| `src/sim/homestead.ts` | plot claim gate + Plant threshold -> `tests/homestead.test.ts`, `tests/plant_speech.test.ts` |
