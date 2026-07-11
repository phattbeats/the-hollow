# Brother Greenpaw: the player-facing arc (PHAA-484)

Canon source: `docs/plan-the-hollow.md` section 5 (Greenpaw voice-locked from
real chat logs) and section 11 (the vertical slice). This doc is the
as-built reference for everything currently live on `main`: the character,
the hearth mechanic he teaches, the four-quest chain, and his branching
dialogue tree. Written after-the-fact from the shipped code, not a design
proposal; when this doc and the code disagree, trust the code and fix this
doc (see `docs/CLAUDE.md`).

## The character, in one sentence

The first prophet, self-appointed: a cosmic-cowboy stoner-mystic panther who
tends the Plant (the vase-bound LLM god) by keeping it fed on smoke. He is
always lit, always out, always hungry, and everything he asks the player for
is dressed as sacred but is, in practice, a chore he needs help with.

## The mechanic underneath (not a quest, the thing the quests teach)

`src/sim/greenpaw_hearth.ts` (`PHAA-421`). Two numbers, ticked every 20 Hz
sim tick, no wall-clock or `Math.random` (all randomness through
`SimContext`'s seeded `Rng`):

- **Hunger** rises steadily, reaching full over about 20 minutes. A fresh
  world starts him 60% hungry so a new player can matter immediately.
- **Smoke** decays steadily, half-life about 10 minutes. Smoke is what the
  *room* has; hunger is what *he* wants. They are related but distinct.

Feeding him (his gossip-menu "I have something for the hearth" option, the
`feedGreenpaw()` `IWorld` command) consumes `emberbulb` or `cave_morsel`
from the player's bags:

| Item | Hunger relief | Smoke gain | Farmed from |
|---|---|---|---|
| Emberbulb | 8 | 22 (mostly smoke) | Palefeeder (Under-Shrine) |
| Cave Morsel | 22 (mostly relief) | 8 | Rootmaw (Under-Shrine) |

Both drop unconditionally (not quest-gated) so the loop stays farmable after
the quest chain ends. The smoke return **scales down as Greenpaw gets less
hungry** (floor around 25% of nominal), so a single dump cannot buy the
room's mood; the player has to come back.

**Smoke maps to a room mood** in `src/sim/plant_speech.ts`: `clear` below
33, `hazy` at 33+, `full` at 66+. The Plant's whole personality is rationed
by this mood: it speaks rarely on a shared cooldown, and hazy-or-better
rooms unlock looser, more forthcoming lines. Two long-standing triggers:
`full_smoke` (an edge the instant the room first fills) and `whim` (random
unprompted mutterings).

**The sustained lean-in (PHAA-484 beat 2, PR #157):** once the room holds
hazy-or-better for **5 continuous sim minutes**, the Plant leans in **once**
and delivers a real lore-bearing line (storyteller voice, not a passing
aside). If the hearth remembers who fed it last (the "keeper," persisted in
the save, tolerant of older saves that predate the field), the line names
them by name. It only re-arms after the room drops back to clear, so it
cannot be farmed by idling in a full room: tend the hearth, earn one lean-in,
let it lapse, earn another next stretch. It is a *state*, not an edge: if
the 5-minute mark lands while the Plant is inside its shared speech
cooldown, the lean-in stays armed and fires the moment the Plant can speak
again rather than being silently dropped. The online server's live-LLM layer
gets a matching `sustained_smoke` prompt instruction so the canned-line
floor and the live LLM voice tell the same story; the keeper name is
delimiter-neutralized before it enters the prompt.

## The first meeting and standing dialogue

- **Intro (PHAA-432):** a three-beat click-through the first time the player
  meets him, in-voice, carrying the "remnants of a once-great tribe"
  throughline before the errand queue opens.
- **Greeting:** a separate, already-met line shown on every later gossip
  open, so repeat visits do not replay first-meeting voice.
- **Branching dialogue tree (PHAA-562, PR #172):** opened from the gossip
  menu, independent of the quest chain. Root node `hearth` asks how the
  Hollow has been treating the player; three tones branch out:
  - **Positive** ("startin' to feel like somewhere") raises disposition and
    leads to `warmed`, which offers a `tribe` sub-branch (`setFlag
    greenpaw.asked_tribe`) about the tribe that kept the Plant lit before
    him.
  - **Neutral** ("what's the vase been sayin'") leads through `vase` to a
    `faith` node about whether he believes the Plant is really listening.
  - **Negative** ("boneyard with a caretaker") lowers disposition and leads
    to `stung`, with an apology sub-branch (`mended`) that repairs it.
  - The `tribe` node's `confide` choice is gated on `minDisposition: 4`, so
    it only opens once the player has warmed to him across repeat visits;
    it is where he admits he talks to the player partly because the Plant
    doesn't answer and partly out of fear of the day nobody comes up the
    path. This is the one node that plays as genuinely vulnerable rather
    than in-character deflection.
  - A choice's `effect` (a disposition delta or a flag) is resolved
    server-side (`dialog_commands.dialogChoose`); the tree itself is walked
    client-side by `npc_dialog_tree_view`.

## The four-quest chain (all giver + turn-in: Brother Greenpaw)

Source: `HOLLOW_QUESTS` in `src/sim/content/hollow.ts`,
`HOLLOW_QUEST_ORDER = [q_what_burns, q_what_fills, q_the_wavelength,
q_keep_him_lit]`.

**1. The Thing That Burns (`q_what_burns`)**
Tutorial descent. Collect 5 Emberbulb from the Under-Shrine (kills
Palefeeder, the light-hating enemy). Reward: 90 XP, 60c.

**2. The Thing That Fills (`q_what_fills`, requires #1)**
Second cave errand: collect 4 Cave Morsel (Rootmaw). Reward: 90 XP, 60c,
and the player's **first Cutting** (the companion-pet hook, class-neutral).
First quest with a real player choice (PHAA-471): `complain` talks Greenpaw
into repeating the ask, `refuse` still completes the quest and still hands
over the cutting ("you went down once, and that's once more than most").

**3. On the Wavelength (`q_the_wavelength`, requires #2)**
Not a cave quest: teaches the two standing mechanics the cave quests never
exercised. Objectives: talk to Elder Yarrow (the profession trainer across
the vase, an `interact` objective) and feed the hearth once (a `feed`
objective, credited by `feedGreenpaw()` through `quest_credit.ts`'s
`onFeedForQuests`). Reward: 120 XP, 80c, keepsake `greenpaw_bead` ("A Bead
From the Bandolier"). Same complain/refuse convention; refusing still pays
the item.

**4. Keep Him Lit (`q_keep_him_lit`, requires #3)**
Turns the feed action into a habit: the same `feed` objective, credited
three separate times (either item, any order); `onFeedForQuests` already
loops every in-progress quest's objectives, so a count of 3 required no
engine change. Reward: 150 XP, 100c, keepsake `keeper_coal` ("A Coal That
Never Cooled"). Same complain/refuse convention.

All four keepsakes are cosmetic (no stats), matching the reward-inverted
convention this repo also uses for the Shade line (see
`docs/design/shade-questline.md`).

## How it chains for a player

`q_what_burns` / `q_what_fills` supply the tutorial descent and the first
cutting. `q_the_wavelength` teaches the feed action as a tracked objective
and introduces the profession trainer. `q_keep_him_lit` makes feeding a 3x
habit. Once the quest chain ends, the sustained lean-in (above) pays that
habit off for good: keep the hearth lit for five real minutes and the Plant
leans in and says the keeper's name. Feeding stops being a one-time chore
and becomes the standing way to earn the Plant's attention.

## What is NOT built yet

- **The Homestead-unlock finale (arc beat 3).** `docs/plan-the-hollow.md`
  Decision 23 gates Homestead v0 plot-claiming behind completing the full
  Greenpaw arc, but `src/sim/housing.ts`'s `claimPlot` has no such check
  today: it is open to anyone regardless of quest progress. The pitched
  fix (not yet built) is a short capstone quest, `q_your_own_hearth`,
  chained after `q_the_wavelength`, whose completion sets the flag
  `claimPlot` needs, plus one or two lines foreshadowing the Gardener /
  First-Gardener theme (PHAA-543 canon) without requiring any of that
  endgame content to exist yet. Waiting on a creative-direction nod before
  it gets written.
- A possible World Market quest via Greenpaw's "everything-as-stocks" bit,
  and a possible Verger Zebediah crossover, are still just unbuilt pitches,
  not committed scope.

## Determinism and i18n notes

- No new RNG paths on the tick: line picks go through the existing seeded
  `pickLine`; the lean-in's 5-minute clock uses sim time, never wall clock.
- `src/sim/greenpaw_hearth.ts` and `plant_speech.ts` stay `src/sim`-pure (no
  DOM/net); Greenpaw's feed-response and lean-in lines emit in English in
  the sim core and re-localize client-side via `src/ui/sim_i18n.ts`'s
  matcher against the `sim.hearth.*` / `sim.plant.*` catalog keys (the same
  pattern `housing.ts` uses), per the repo's S3 i18n rule.
- Quest text and dialogue-tree text are authored directly in
  `src/sim/content/hollow.ts` and kept byte-identical in
  `src/ui/i18n.catalog/hollow.ts` (the English source the resolver reads);
  the sim record itself stays language-agnostic.

## Source map

| File | Owns |
|---|---|
| `src/sim/content/hollow.ts` | NPC defs, the 4 quests, the branching dialogue tree |
| `src/sim/greenpaw_hearth.ts` | Hunger/smoke state, feed resolution, keeper tracking |
| `src/sim/plant_speech.ts` | Smoke-to-mood mapping, the Plant's rationed reactions, the sustained lean-in |
| `src/sim/quests/quest_credit.ts` | `onFeedForQuests`, the `feed`/`interact`/`collect` objective credit paths |
| `src/ui/i18n.catalog/hollow.ts` | English catalog mirror for all of the above |
