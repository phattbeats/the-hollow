# Sister Shade: the player-facing questline (PHAA-558)

Canon sources: PHAA-544 brief `shade-brief` rev 1e9abd48 (Board-accepted), and the
lorebook v2 section "Sister Shade, player-facing arc" (attachment on PHAA-429).
This doc is the writing home for the whole four-quest arc. Quests 1 and 3 ship as
sim content now (`src/sim/content/hollow_zone.ts`); quests 2 and 4 are written here
and land as sim content only when their gates clear.

## The character, in one sentence

"You don't have to be great to be something good. Greatness isn't kindness." Shade
is a plain human woman with a watering can. No title of rank, no magic, no marker at
first sight. The player is meant to dismiss her as a civilian, and the game lets
them. What she never states: she is the Willow of Wit (settled god-side canon), and
the water she is forever collecting is a promise to the plant she has never once
missed. The reveal is late and overheard, not in this line.

## The reward rule (non-negotiable)

The line is reward-INVERTED. The tasks are tiny and pointedly unheroic, the writing
carries them, and the payoff is meaning, not gear. NO STATS, EVER, on this line.
The one keepsake is `willow_sprig` ("A Willow Sprig"), a cosmetic charm that does
nothing, handed to every class the same way. Small xp and copper on each quest is
fine; a stat item is not.

## The first meeting (Board-LOCKED)

The player first finds Shade on the shore of Mossbank (the lake in the Hollow
Reaches), collecting water, no explanation given. There is no quest marker, no hook,
nothing to distinguish her from any civilian NPC. In sim terms this is done with
`minLevel`: her first quest opens at level 2, so a fresh level-1 arrival meets her
marker-free. Her intro deflects into ordinary small talk (the can "is only water"),
and her greeting asks if the player has eaten. She never asks about destiny.

## The four quests

### Quest 1: "Have You Eaten?" (SHIPPED)

- Giver / turn-in: Shade. Objective: carry a warm meal to Halden, the bard at the
  gate (`gate_bard`), who plays for coppers that rarely come and never gets a warm
  meal. Modeled as an `interact` objective (no combat, no item to farm).
- The completion text is the point: she asks if the bard ate, then notices the
  player has not, and lands the character's whole thesis, verbatim as the Board
  locked it: "You don't have to be great to be something good. Greatness isn't
  kindness. Eat."
- Reward: small xp/copper, no item. `minLevel: 2`.

### Quest 2: "The Long Way Around" (WRITTEN, GATED on PHAA-559)

- Design: deliver water to a dried planting the tribe left, reachable only by her
  "willow path", the first jumping puzzle (branches, roots, mushroom shelves, lily
  pads climbing to a quiet spot). She says she could not make the climb herself. She
  is lying, gently; the player cannot know that yet.
- Gate: willow-path traversal is jump platforming under a deterministic 20 Hz
  server-authoritative sim. The netcode spike PHAA-559 must report GO before any
  willow path is built. Do NOT build jump platforming before that spike reports, and
  do NOT ship this quest as a flat-ground fetch (that would erase the willow-path
  design). It lands as sim content only after the spike, using whatever traversal
  mechanic the spike blesses.
- Draft dialogue (adjust to the final mechanic):
  - Offer: "There's a planting the tribe left half-finished up the old willow, and
    it's dying for want of one good pour. I can't make that climb anymore, but you've
    got the legs for it. Take the can. Mind the branches; they hold if you're honest
    with them."
  - Completion: "It'll live now. You wouldn't think one climb and one pour was much,
    against everything else out there. It isn't much. It's only everything to the one
    thing you poured it on."

### Quest 3: "Someone Your Own Size" (SHIPPED)

- Giver / turn-in: Shade. Requires quest 1. Objective: sit with Orla
  (`goodwife_orla`), a struck-through name from the Verger's rolls, someone the world
  has been cruel to. A talk quest, `interact` only, zero objectives beyond being
  there. The title echoes Shade's god-side leaving line ("try to be terrible to
  someone your own size"), which is NOT spoken here; it surfaces at the reveal.
- Reward: small xp/copper plus `willow_sprig`, the end of the currently-shippable
  arc. `minLevel: 3`. When the finale (quest 4) lands, the charm can move to it.

### Quest 4: "The Watering Can" (WRITTEN, GATED on PHAA-543)

- Design (post-reveal): she finally asks something real, carry her can to the
  Under-Shrine and water what is buried there. Here the first-meeting image resolves:
  the water she was collecting the day the player met her was always for the plant, a
  promise she never mentioned and never missed. The one time her kindness points at
  the main plot.
- Gate: this beat rides the PHAA-543 main-quest spine (the Plant's reckoning and the
  Tree of Life ending), still pending Board confirmation. Shade is the emotional key
  to that ending (she tells the Plant it can leave the vase, love without illusion).
  Write last, keep adjustable; if PHAA-543 changes, this beat moves with it.
- Draft dialogue (adjustable):
  - Offer: "I've asked you for small things, and you've done them all without once
    asking why. Here's the last one, and it isn't small, though it'll look it. Take
    my can down under the shrine, to the thing that's buried there, and give it
    water. It's been waiting a long time to be given something instead of asked for
    something."
  - Completion: "You did it. Of course you did. That was the water, you understand.
    All of it, all the way back to the day you found me at the lake and thought
    nothing of it. The same pour, the same promise, kept one more time. Thank you.
    Now go and be gentle with the world. It's the only thing that ever changed it."

## Deferred, engine-dependent beats (NOT built here)

- The willow-sprig charm's payoff of the god's one gentle bark triggering near the
  PLAYER post-line, and the "early clue" that the god's ambient cruelty softens near
  the willow AND near walking Shade (the same behavioral flag), both depend on the
  Phase-2 live-god ambient system, which does not exist yet. They are recorded here
  and land when that system does.
- The watering-can prop and Shade's walking model are render/art work, not sim
  content. The sim NPC renders procedurally (a plain color) until the model lands.
