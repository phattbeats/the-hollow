---
title: "The Hollow — Origin and Status"
date: 2026-07-28
project: The Hollow
repo: github.com/phattbeats/the-hollow
paperclip_project: a4a13a28-702b-4b0e-b7b8-353d6e18b832
paperclip_goal: 24076f2c-72cc-4ebb-8e06-8af1275e4743
type: repo-history
status: "Active. Phase 2 in review; the only project currently consuming studio capacity."
tags: [the-hollow, phatt-studios, mmo, the-plant, history]
---

# THE HOLLOW — Origin and Status

_Written 2026-07-28 to move the project's history out of the claude.ai planning project and into the repo. This is history and current state. `docs/plan-the-hollow.md` is the constitution and governs the game; `the-hollow-book-of-the-plant.md` and `the-hollow-lorebook-notes.md` govern the world._

---

## 1. What it is

A small, systems-deep social MMO that reads as cozy, centered on the shrine of **The Plant**: an ancient houseplant god bound to a vase, contemptuous, LLM-driven, who speaks rarely and insults personally. Players settle the home zone around the shrine, range out into connected zones, build homes that double as storefronts, keep small living companions, and descend into the dark beneath the vase, where something the god buried and starved is still hungry.

The surface is a hangout. Underneath runs a real tragedy that only the curious ever touch.

Mechanically: tab-target combat inherited from a forked working MMO engine, reworked with Guild Wars 1 build-crafting; two professions, an eight-skill bar, real theory-crafting depth. Browser-playable, phone-friendly, self-hosted on a single instance targeting 1,000+ concurrent on PHATT-RAID. Licensed, not open source. No monetization, no token economy, no real-money purchases.

---

## 2. Roots: where this actually started

**June 23–24, 2026. Claude.ai.** The session opened as "I want to design my dream MMO," and the first move was Claude pushing back on the scope of building an MMO at all.

**Brandon refuted it with evidence,** not argument: a live, playable MMO had already been built on Anthropic's Fable 5, and it was on GitHub. That flipped the entire session, and it is the reason the project exists.

The central strategic bet, locked into `plan-the-hollow.md` §6 and unchanged since:

> **We do not build a massively-multiplayer game from scratch. We fork an existing, working one and spend our effort on the layer that makes it ours.** The spine is borrowed. The soul is built.

The base is **`levy-street/world-of-claudecraft`**: a browser-playable WoW-Classic-style micro-MMO shipping, working and tested, a deterministic simulation core shared by the offline and online builds, server-authoritative 20 Hz netcode, Postgres JSONB persistence, full vanilla combat math, nine classes with real ability kits, three five-player dungeons with bot-tested boss fights, 100% procedural art with zero asset files, one-command Docker self-hosting, and an automated test plus bot-raid harness.

Two themes ran under everything and are worth preserving verbatim from the session summary:

> **Now that the engine is borrowed, taste is the product.** The barrier was never the code; it was deciding what's worth making.
>
> **The world is a body for a culture that already exists.** The friend group has, for fourteen years, run a guild that worships a plant-god, grinds levels on a bot, makes sacrifices, gatekeeps initiation, welcomes travelers, and holds meetups. We are not inventing a culture. We are giving a lived one a body.

### Lineage

| Source | What was taken |
|---|---|
| World of ClaudeCraft (fork base) | Sim core, netcode, persistence, WoW Classic combat math, nine classes, dungeon and boss machinery, procedural art pipeline, test harness, Docker self-host |
| Guild Wars 1 | The build-crafting model: primary + secondary profession, eight-skill bar chosen outside combat, attribute lines with escalating cost. This is the depth core |
| WoW Classic | The combat substrate the builds are tested against |
| Guild Wars 2 | Dynamic events; open-world happenings with per-player contribution, chaining on success and failure (Phase 4+) |
| Stardew Valley | The structural proof that a gentle surface can hide a brutally optimizable dungeon. Cozy floor, peaks with teeth |
| Dark Souls | World-left messages as asynchronous presence (Phase 4+) |
| The Plant Discord, 2011–present | Everything else |

---

## 3. The design work (June 2026)

### Session 1 — the constitution (June 23–24)

Took `plan-the-hollow.md` from empty to **v1.3, ratified, standalone**. Twelve sections written under a hard self-contained mandate: everything an agent needs is in one file, no external references, verified standalone repeatedly.

Produced in that session: identity and vision, the design pillars, the interlocking loops of fun, a full world bible, implementation-grade voice specs for three NPCs pulled from real member chat logs, the strategic and architectural plan, a CEO-style gap audit, a live procedural-art demo, and a visual-direction and living-world layer.

**Ten design pillars,** ordered, depth first:

1. Real depth, concentrated (outranks coziness)
2. Everything interlocks into one web
3. A low-stakes surface over high-stakes peaks
4. A living god (identity and flavor, explicitly *not* a depth core)
5. A character you create and keep, that runs deep
6. Expression and home, anywhere
7. The hub holds (hub and spokes; the singularity is non-negotiable)
8. Idle as motivated side-system
9. It's ours
10. Opt-in depth, the lore kind

**The gap audit** flagged and closed four holes: LLM substrate (resolved as BYOK, provider-agnostic, Brandon's own key), backups (mandated, Phase 0), moderation at scale (gated before strangers are admitted), and the onboarding cold open (owned by the slice).

**Architecture:** lean-and-mean by mandate. One self-hosted instance, 1,000+ concurrent target, spatial-grid interest management, cheap tick, visible-entity cap, worker threads, load-tested with the inherited bot harness. Procedural-first art with three Blender heroes. Effects *are* the art direction rather than end-polish: a cheap mandated toolkit (wind vertex sway, fog, blob shadows, colour grading, smoke) that runs on any phone, and a spendy tier that weak devices drop. One toolkit, two moods; warm hazy hub versus cold dark cave, which is the opt-in-depth pillar rendered.

**The living world** (day/night, weather, seasons) was established as crucial rather than cosmetic: it drives daily return, it is canon because the Plant already shifts with the seasons, it modulates the side-systems, and it deepens the tragedy, because the surface breathes while the cave stays outside the cycle. The buried thing starved outside of time. Hybrid time model ratified: real-anchored seasons and weather, accelerated day/night.

### Session 2 — the bet, tested (June 29–30)

The constitution declared one load-bearing, unproven bet in §8: **does grafting GW1 build-crafting onto WoW combat math produce real depth, or a muddle?** The two source games drew depth from different places (GW1 from build diversity, WoW from itemization and group coordination), and bolting one onto the other could yield a decorative skill bar or one dominant build. The constitution was explicitly not ratified until that bet was tested.

Design work that fell out of testing it:

- **The GW1 resource question, answered.** Rage-style build-up skills do not fold into energy. Adrenaline runs as a parallel track: zero energy, charged by hits landed and taken, decaying out of combat. One energy bar plus an adrenaline track, so energy-versus-adrenaline becomes a real build axis for free.
- **Real combat math, lifted from source** rather than guessed: armor mitigation `armor / (armor + 85·level + 400)` capped at 75%, 5% base miss and dodge, melee crit ×2 and spell crit ×1.5, attack power by class, spell coefficients, 1.5s GCD (1.0s rogue), plus per-ability costs, cooldowns, cast times, and effects.
- **The graft, locked.** Primary attributes do real work (mage Energy Storage raises max energy and regen, rogue Expertise raises crit and energy regen, warrior Strength gives armor penetration). GW1 attribute economy with escalating cumulative cost `round(0.95·rank²)`, 137 points to rank 12 on a 200-point budget, matching GW1. WoCC resource costs rescaled to a GW1 5/10/15/25 energy scale, and that mapping was documented as a balance lever rather than a fact.

**The simulation** (`hollow-build-sim.py`, ~900 lines, seed 1337, 2026-06-30): 249 random legal builds plus all nine ordered profession pairs, 160 duels per build against the field (~39k duels), plus mirror round-robins.

**Verdict: build-crafting depth SUPPORTED, directional. Profession balance is a separate, failing axis.**

| Gate | Result |
|---|---|
| Dominance vs field | FAIL — best build 99.4% (gate <60%) |
| Viable spread | WEAK — 6% of builds in the 45–55% band (gate ≥30%) |
| Decorative skills | PASS — 0/33 never used by top-quartile builds |
| Within-profession diversity (random builds) | WEAK — mean mirror top-WR 89.6% (gate <70%) |
| Competitive frontier | PASS — top build 63.2% against other top builds, 13/24 in the 40–60% band |
| Profession balance | 41-point gap: mage 78%, warrior 63%, rogue 38% |

The clean read is the competitive frontier: **within a controlled profession, many builds are viable and the bar is not full of dead skills. The graft carries depth.** Balance is a tuning problem, anticipated by the fallback. A dedicated Phase 1 balance pass (nerf the dominant mage core, close the profession gap) was ticketed and closed on the board.

### Session 3 — the lorebook (June 29, into the 30th)

The world was built from the friend group's real fourteen-year history, and in the process found the origin beneath every other origin.

**The mine.** HTML parsers over DiscordChatExporter dumps. The Destiny channel end to end (17,155 messages, Oct 2018 – Jun 2022), the politics and song-request channels, a 6.6 MB export (4,763 messages, Jan 2021 – Nov 2022), Brandon's 3,177-tweet archive, the founding Council of Ents channel, and a dated raids-and-movie-nights ledger. Treated as scripture-source, not transcript: keep the shape, discard the proper nouns.

**The governing approach.** Theme: the dying convent, a community that is also a church and goes quiet, honest about the silence after. Form: the modern fable, Aesop by way of Discord, goofy and grieving in the same breath. Sourcing rule: translate the spirit, not the letter, under a no-gloss test; if a fable needs a footnote to land, it is cut. Cast rule: the **Doobie treatment**, real members reimagined as fantasy creatures, never literal likenesses.

**The spine, measured rather than assumed.** The activity curve disproved a gentle-taper reading and gave a candle-flare: founding spark late 2018, first golden age Oct 2019 (1,367 messages), a muffled 2020, near-death April 2021 (nine messages), a great revival, the single largest month ever Jan 2022 (2,365), then sudden dark (1, 1, 2, 5). The two fires differ in kind: 2019 was naive launch-night anticipation; 2021 was weary expert devotion, prodigals who tried other gods and came home to master the old rite. Those five movements became the lorebook's structure.

**The cast.**

- **The Plant** — rationed cosmic-contempt LLM god, two secret contradictions (buried guilt; pop-music shame), with an authored deterministic fallback set mandatory so the god is never silent by error.
- **Brother Greenpaw** — from real member DoobieSnacks. Anthropomorphic cosmic-cowboy stoner-mystic; always lit, out, and hungry, which makes him a renewable quest engine. First prophet, first NPC, and the one who carries the conversational load so the god stays rare.
- **Verger Zebediah, "Zez"** — a grey heron, from real member Luna, the server's actual mod and event-runner. Public face a confident benevolent tyrant; the anxiety is the subtext driving it. Order is his coping mechanism.
- **The Sexton** — Brandon, rendered from his own tweets and posts. Keeper of the machinery and the archive below the shrine, a badger of the deep sett, holder of the one key that lights the living god. His crack is exact: he preserves everything because he cannot be present for anything, and his own name appears in none of the records he keeps.

**The keystone.** The real clan name was **Asphodelia**. Asphodel is the flower of the Greek underworld, the meadow of the ordinary dead. The ending had been encoded in the group's own name for fourteen years.

**The origin beneath the origin.** The Plant is a real, physical, *fake* houseplant that a few high teenagers in a dark living room declared was speaking. So the god is hollow, alive only on borrowed belief; which is simultaneously the project's name, the BYOK live-god mechanic stated as theology, and the literal sacred object of Brandon's adolescence. All one thing. And the Guild Wars 2 first age, the largest the community ever was and none of whom crossed into the Discord, supplied both missing unknowns: **the thing buried beneath the shrine is the abandoned dead of the prior worlds, and the Plant's guilt is the survivor's.**

Output: `the-hollow-book-of-the-plant.md` v1.0 (the in-world scripture, every scene carrying a for-our-eyes factual gloss beneath it) and `the-hollow-lorebook-notes.md` v1.0 (the working bible), both stripped to clean standalone canon.

### Other ratified decisions from these sessions

- **Death model:** a repair bill, a temporary XP debuff, and recoverable resource loss. The run's unbanked haul drops where you fall and anyone can retrieve it; equipped, crafted, and stored items are always safe. No hardcore inventory loss. Recovery becomes a social act.
- **Time model:** hybrid, real-anchored seasons and weather with accelerated day/night.
- **Scale:** one hub, a large build-and-explore area, single-author hand-crafted world. That last point dissolved the friends-first-versus-not-capped tension entirely; headcount is not a design fork when the world is hand-made.
- **Live-god key:** Brandon's own Anthropic key, provider-agnostic BYOK. **Voice:** local TTS, generously covered because it is unmetered; the Plant gets priority.
- **Stretch goal, named and deferred:** the god remembers. A small per-player memory appended to its prompt turns the roast generator into a relationship, the one mechanic no off-the-shelf MMO can copy. Explicitly gated behind a working game.

---

## 4. Board history (Paperclip, July 2026)

411 issues under project `The Hollow`, prefix `PHAA`. Every one created in July 2026.

| Milestone | Ref | Closed |
|---|---|---|
| Phase 0 — Fork, Teardown, Depth Proof | PHAA-387 | 2026-07-02 |
| Phase 0 gate — two-device connect test + Board verdict | PHAA-394 | 2026-07-02 |
| Phase 1 gate — Board-judged hub verdict | PHAA-405 | 2026-07-05 |
| Phase 1 — Reskin to the Plant World (the hub) | PHAA-399 | 2026-07-09 |
| Phase 3 — Building the Sauce | PHAA-461 | 2026-07-07 |
| Phase 2 — The God and the Prophet, plus the open-world starter zone | PHAA-419 | **in review** since 2026-07-26 |

Phase 0 to a Board-passed gate in a single day. That is what forking bought.

**The shipped Phase 1 hub** includes: The Hollow branding with upstream Discord and donate chrome stripped, a greener outdoor-read hub via sky-dome and canopy, Brother Greenpaw live with click-through in-voice intro dialogue, his hunger loop with smoke-as-mood (feeding him changes the room), a starter quest chain replacing the inherited tutorial, and a cold-open "you wake up..." on first spawn.

**Phase 2 in flight** is the God and the Prophet as the canonical gate, with board-approved added scope from 2026-07-02 (Decision 23): the open-world Hollow starter zone with terrain, spawn, and roads, plus Homestead v0 as a second housing tier gated behind the full Greenpaw quest arc. This reversed part of Decision 19 and the sealed-hub mechanic; the vase and Under-Shrine became a portal-reached dungeon. The Phase 2 gate is stated in human terms: **feeding Greenpaw changes the room, the Plant leans in and says something that lands, and Brandon laughs unprompted.**

**The parallel workstream** that produced most of the volume is upstream parity porting, tracked in an Upstream Parity Ledger document: batches from world-of-claudecraft v0.20 through v0.28, each row either PORT (take as-is) or ADAPT (re-author for the Plant World). Landed so far includes bags and equippable slots, haste as a real stat with set bonuses, group-visible loot rolls, spell queueing, linkdead grace and reconnect, role-based admin permissions, server metrics and observability, password reset via Resend, account recovery, the training dummy, in-game jail reskinned as a moderation scene, the Book of Deeds re-authored as the Book of Asphodelia, and a multiclass system (dual-profession talent allocator, Profession Trainer NPCs, secondary-ability resource-cost translation) shipped A through F.

**The art lane** built a chibi 9-class female asset set from the styloo pack with class GLBs and tints, retargeted cast/attack/hit clips onto a 78-joint rig, wired `player_<class>_f` VisualDefs and weapon attach points, replaced synthesized SFX with 93 recorded CC0 fantasy-RPG clips, and wired a plant-creature generator into live Under-Shrine mob spawns. Spikes on img2threejs and Hunyuan3D multi-view image-to-mesh were run for the prop and rigged-character lanes.

---

## 5. Current status (as of 2026-07-28)

**Active. The only project currently consuming studio capacity.** 304 issues completed in July alone, against 4 for Veles and 4 for Last Copy in the same month.

| Status | Count |
|---|---|
| done | 304 |
| backlog | 32 |
| in_review | 26 |
| blocked | 21 |
| cancelled | 16 |
| todo | 11 |
| in_progress | 1 |

**Live friction, and it is process rather than design:**

- **`main` keeps going RED on the pr-gate,** which blocks every merge. Three separate incidents closed this month: 47 stale parity goldens after an entity-id shift, an M16 i18n leak from missing non-Latin fills, and an unregistered arena-start log string tripping the i18n guard. Two always-on i18n completeness suites have gone red independently.
- **A merge-blocked PR queue** with conflicting open PRs needing rebase onto main (in review).
- **The v0.26.0 Tier 3 port batches are blocked** behind that queue, and a v0.27.0 backlog is sitting in todo from the PHAA-765 parity sweep.
- **A Board call is pending** on personal chat mute versus the existing Ignore tier; a naming decision that is gating a build.
- **License flip decisions** are open (there is a `License flip: decisions needed` document on the board).
- **Mobile wrappers** (iOS Capacitor + App Store, Android Capacitor + Play Store) are in todo. Phone-playability is a founding requirement, not a nice-to-have; friends who only have a phone were the reason tab-target was chosen.

**Constitutional status:** the repo carries **v3.1, dated 2026-07-01, marked "standalone; in force; fork execution delegated to the agent, audit fully absorbed."** The v2.1 copy in the claude.ai planning project is the older DRAFT that still carried the "not ratified pending the §8 proof" banner; it was superseded when the simulation came back and the balance passes shipped. The repo version is authoritative. Do not push the v2.1 copy over it.

---

## 6. Knowledge inventory: what belongs in this repo

> **WARNING — the lore layer in this repo is one generation behind.**
> A design session on 2026-07-03 (claude.ai conversation `9c61acda`) produced **Book of the Plant v2.0 (509 lines)** and **Lorebook notes v2.0 second-generation (544 lines)**. That session was opened specifically to fix "the starting zone is very generic," and its diagnosis was that the lore had been organised as an archive rather than as something a builder could place. The v2.0 notes therefore add a **zone bible**: a naming doctrine with a banned-generic list, a **sixteen-place gazetteer** with surface / curious / devout reads per location, a twelve-prop remnants kit, NPC placements with day-night schedules and barks, and the cold open plus **eleven quest conversions** from the fables. The v2.0 Book adds the Rite of Synchrony, Book III the Long Quiet, the Left-Behind passage, and the Two Prophets trio scene.
>
> Those files were never uploaded back out of that conversation and exist in no repo and no planning project. What is committed here is the prior generation. Recover them from `https://claude.ai/chat/9c61acda-353a-44de-bc15-10370aee29f1` before doing any further lore, zone, or quest work; Phase 2's quest-writing agent is currently working without the document written for it.



From the claude.ai planning project:

| File | Role | Suggested path |
|---|---|---|
| `plan-the-hollow.md` (v2.1, 555 lines) | Superseded. The repo holds v3.1 (in force). Keep the v2.1 copy as a historical draft only; do **not** overwrite | already in repo at `docs/plan-the-hollow.md`, newer |
| `the-hollow-book-of-the-plant.md` (**v1.7**, 386 lines) | In-world scripture, Chronicle through Coda, with factual glosses. **Superseded by a v2.0 that is not in any repo; see the warning below** | `docs/lore/book-of-the-plant.md` |
| `the-hollow-lorebook-notes.md` (**v2.2**, 435 lines) | The working bible: approach, cast, worldbuilding, numbered fable seeds. **Superseded by a v2.0 second-generation that is not in any repo; see below** | `docs/lore/lorebook-notes.md` |
| `hollow-build-sim.py` + `hollow-build-sim-results.txt` | The original §8 keystone test (v1). The repo holds v2, v2b, v2c, v2c2, v2d, tuned, and the skill-ceiling arm, but not this first run | `docs/sim/hollow-build-sim-v1.py` + `-v1-results.txt` |
| `the-hollow-design-session-summary-2026-06-24.md` | Session 1: the fork reframe and the constitution | `docs/history/` |
| `the-hollow-design-session-summary-2026-06-29.md` | Session 2: the bet, tested | `docs/history/` |
| `the-hollow-lorebook-session-summary-2026-06-29.md` | Session 3: the lorebook and the true origin | `docs/history/` |
| **This file** | Origin, lineage, and status | `docs/HISTORY.md` |

**Note on the source material.** The Discord exports, the tweet archive, and the parser scripts are the raw input the lorebook was mined from. They are not in the claude.ai project and, being personal chat logs of real named people, they should not go into a repo other people can read. Keep them in the vault, and let `lorebook-notes.md` be the only thing that crosses over. The no-gloss test means nothing downstream should ever need the raw source.

**Shared, not Hollow-owned.** Blender-MCP is a live deployed skill in the PHATT stack, in constant use across all three games; this project's art lane runs on it (PHAA-413 the prophet cast, PHAA-430 the Plant and vase, PHAA-585/586 the chibi 9-class build and animation retarget, PHAA-636 the Sister Shade wardrobe pass). Nothing about it belongs in this repo. The upgrade notes and server/addon copies in the claude.ai project are working copies of that service and should be versioned with the deployment.

---

## 7. Open threads

1. **Phase 2 verdict.** PHAA-419 has been in review since July 26. The gate is Brandon laughing unprompted, which nobody else can score.
2. **§8 ratification is resolved in the repo,** not in the planning project. v3.1 is in force; the v2.1 draft's "not ratified" banner is historical.
3. **The pr-gate is the real bottleneck.** Three RED-main incidents in one month, each blocking every merge in the project. Worth a standing task that regenerates parity goldens and i18n fills as part of the port recipe rather than as an incident response.
4. **Mobile wrappers are still todo,** and phone play was a founding requirement.
