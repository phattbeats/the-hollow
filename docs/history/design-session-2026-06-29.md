---
title: "The Hollow: Constitution Close-Out and the Keystone Test"
date: 2026-06-29
project: The Hollow
type: session-summary
status: "plan.md v2.1, DRAFT; §8 keystone test built and run once (directional, leans positive)"
participants: ["Brandon Kelly (Board)", "Claude (Opus, CEO / design partner)"]
related: ["[[plan.md — The Hollow]]", "[[The Plant]]", "[[Brother Greenpaw]]", "[[Verger Zebediah]]", "[[World of ClaudeCraft]]", "[[PHATT-RAID]]", "[[PHATT STUDIOS]]"]
tags: [the-hollow, game-design, mmo, session-summary, combat, build-diversity]
---

# THE HOLLOW: Constitution Close-Out and the Keystone Test

**Date:** June 29, 2026 (running into the small hours of the 30th)
**Participants:** Brandon Kelly (Board / Director), Claude (Opus, CEO / design partner)
**Artifacts:** `plan.md`, the game's constitution, carried from v2.0 DRAFT to **v2.1 DRAFT**; a build-diversity duel simulator; a results log

---

## 1. High-Level Summary

Two jobs this session, sitting on either side of a context compaction. First, close out the constitution: take the v2.0 standalone draft and resolve nearly every remaining design decision, until the document had exactly two genuine unknowns left, the §8 bet and the buried thing. Second, stop talking about the §8 bet and test it: fork the real engine, lift its actual combat math, graft the Guild Wars 1 build model onto it, and run enough simulated duels to see whether build-crafting carries depth or collapses into one dominant build and a bar of dead buttons.

The headline is that the keystone test now exists and has a first answer. Roughly fifty thousand simulated duels on [[World of ClaudeCraft]]'s real formulas, under a single-energy-plus-adrenaline GW1 economy. The clean read, the strongest builds fought against each other, shows no dominant build, a flat-ish competitive ladder, and zero dead skills. That is the bet leaning toward depth, directionally, not proven. It was folded back into the constitution as a new §8 "First results" subsection, the document went to v2.1, and the original ratification gate was left standing rather than relaxed.

Two things ran underneath. First: the test made plain that build *diversity* and profession *balance* are different axes, and §8 had cut them as one; the graft is structurally sound, what is unsolved is balance, which is a tuning loop and not a yes-or-no property. Second: the implicit bar in §8 was tournament-grade, and this game is cozy, cooperative, single-author, and never a ranked ladder, so the bet is closer to won than the binary framing let it look.

---

## 2. Work Done / Topics

### Before the compaction: closing the constitution

**Visual system finished (§7).** Day/night, weather, and season set as three composed dials, eleven keyed looks across three orthogonal axes rather than forty-eight enumerated scenes, with deliberate crossings (weather overrides time on brightness; season bends the sun path and owns the ground; precipitation type follows the season). Blob shadows take direction and length from the predictable sun and strength from the weather, with no shape-casting; a night-readability floor and an after-dark rule that contrast rides on motion. Then **wind as a single shared global motion vector** everything subscribes to (foliage and every particle lean together), a capped particle library (smoke always; rain, snow, falling leaves, drifting motes by season and weather), and the cave opting out entirely: airless, outside the world's breath, the buried thing cut off, the lore and the cheap version at once.

**MMO design-tricks batch, each a Board call.** Asynchronous presence (Dark-Souls-style world-left messages with attachable gifts, plus an in-universe mail system; companions cover the rest) as §4 canon and a Phase-4+ spec. God-remembers as a stretch goal gated behind a working game. Combat feel promoted to a first-class §8 concern, scoped MMO-safe (telegraphs, impact flash and sound, floating numbers; explicitly no hit-stop, no screenshake). Seeded secrets and hidden experiences, "the rewarded margins," a psychedelic register. Reactive diegetic music, where the hub music is [[Brother Greenpaw]]'s mix. Soft profession specialization that tilts gathering and crafting into trade interdependence. A dark-pattern guardrail in the Scope Lock: no streaks, login rewards, or FOMO timers; the sanctioned alternative is "something always quietly maturing" while you are away.

**Standalone QA pass.** Grepped the document for non-self-contained references, removed frontmatter wikilinks and softened a README citation, kept the internal cross-references (those *are* self-containment), and verified clean.

**Open-items resolution.** Brandon closed nearly all of §12:
- **Consent thrown out entirely.** The cast are allegories drawn from years-old logs on servers that no longer exist; no real person is depicted or identifiable, so a consent gate protected no one.
- **Zez resolved: a grey heron named Verger Zebediah,** "Zez" to the regulars, from real member "Luna"; voice already locked.
- **Death model confirmed:** a repair bill, a temporary XP debuff, and recoverable resource loss, the run's unbanked haul drops where you fall and anyone can retrieve it; equipped, crafted, and stored items are always safe. No hardcore inventory loss.
- **Time model ratified** (hybrid: real-anchored seasons and weather, accelerated day/night).
- **One hub,** a large build-and-explore area. **Live-god key** is Brandon's own Anthropic key, provider-agnostic BYOK. **Voice** is local TTS, generously covered because it is unmetered, priority Plant first.
- **The friends-first-versus-not-capped tension dissolved:** a single-author hand-crafted world, so headcount is not a design fork; the cold open serves whoever joins.
- Open items reduced to two: the §8 bet and what the Plant buried.

**Began the §8 keystone test.** Cloned `levy-street/world-of-claudecraft`, started extracting the real combat math, designed the first cut of the graft, wrote the first version of the simulator, ran it once. Rogues collapsed; flagged immediately as confounded, not a clean read.

### After the compaction: the keystone test, done properly

**The GW1 resource question, answered.** For rage-style build-up skills the graft does not fold them into energy. It runs **adrenaline** as a parallel track: zero energy, charged by hits landed and taken, decaying out of combat, the precise analogue of the inherited rage. One energy bar plus an adrenaline track, so the warrior keeps "earn your big swings" without a second pool elbowing the energy bar, and energy-versus-adrenaline becomes a real build axis for free.

**Real combat math, lifted from source.** Armor mitigation `armor / (armor + 85·level + 400)` capped at 75 percent; 5 percent base miss and dodge; melee crit ×2, spell crit ×1.5; attack power is `str·2` (warrior), `str+agi` (rogue), `str` (caster); spell power is `int·0.5`; auto damage `(weapon + (AP/14)·speed)·mult + bonus`, then crit, then armor; spell coefficient `clamp(cast,1.5,3.5)/3.5`, DoT coefficient `duration/15`; global cooldown 1.5s, 1.0s for the rogue; plus real per-ability costs, cooldowns, cast times, and effects for warrior, mage, and rogue.

**The graft, locked.** Single energy bar (base 30) plus adrenaline for warrior strikes. Primary attributes do real work: mage Energy Storage raises max energy and regen, rogue Expertise raises crit and energy regen, warrior Strength gives armor penetration. GW1 attribute economy with escalating cost, cumulative `round(0.95·rank²)` (137 points to rank 12, matching GW1, on a 200-point budget), and skills scaling with their line's rank. WoCC resource costs rescaled to a GW1 5/10/15/25 energy scale; that mapping is itself a balance lever and was documented as one.

**The simulator (~650 lines).** Grounded in the real numbers, with a 1-D distance and kiting model, stealth openers, combo points, adrenaline, crowd control (stun, root, polymorph, snare, incapacitate), DoTs, buffs, debuffs, shields, and a shared greedy class-aware AI playing both sides. Harness: a few hundred random legal builds, roughly fifty thousand duels.

**First run, and the honest read.** Rogues collapsed, 17 to 34 percent against warrior and mage pairs sitting at 67 to 85. Diagnosed as part real, part artifact: the cost mapping starved the rogue's WoW-fast energy economy on a slow 30-point bar, and the shared simple AI underplayed positional rogue play. Not clean.

**Tuning pass.** Raised energy regen, trimmed the rogue's skill costs, gave the rogue's strikes a poisoned-blades snare to stick to a kiter, made a kidney shot leave the rogue behind the target, nudged rogue move speed. Rogue mirror win rate climbed from 34 to 52 percent; the professions stayed imbalanced.

**The methodological fix: a competitive-frontier test.** A within-profession mirror metric flagged dominant builds in every pair, but it round-robins *random* builds, so a high top win rate mostly reflects bad random builds losing to good ones, which is true of GW1 itself and says nothing about whether one build rules. The clean test is to take the strongest builds and see whether they beat *each other*. Added it.

**The frontier result.** Top build 63 percent against the other top builds, not 90; more than half of the top builds in a near-even 40-to-60 band; zero of thirty-three skills unused by a winning build. No king, no dead skills. The asterisks were kept loud: professions unbalanced (the mage strong, the rogue absent from the frontier), part of the flatness is similar mage builds tying each other, the skill ceiling was not tested (one fixed AI on both sides), and it ran on a faithful port rather than the live engine.

**Folded into the constitution.** §8 gained a **"First results"** subsection: what was built, the frontier finding, every asterisk, the diversity-versus-balance reframe written as a *proposed amendment*, and what remains for the gate. Consistency clauses propagated into the frontmatter, the status paragraph, Decision 2, the §8 open item, the Phase 0 gate cell, and the closing status. Version bumped to **2.1.** The original gate left standing; the reframe recorded, not enacted. The plan, the results log, and the simulator were bundled together.

**Self-containment pass.** Scanned for outward pointers. The one real violation was the new §8 line pointing at the sim script and results log as the home of the "full numbers," fixed so the findings stand on their own inside the document. Forward build instructions (`FORK-NOTES.md`, `docs/lore/`, the GitHub fork) kept with reasons, since they direct the work rather than serving as documents a reader must consult. All cross-references verified internal.

---

## 3. Insights & Takeaways

- **The keystone test exists now, which was the actual Phase-0 deliverable.** The constitution said to build it; it is built and runs at scale. That alone moves the project off the page.
- **Build diversity and profession balance are different axes.** The graft is structurally sound: it composes, nothing runs away at the frontier, no skill is decorative. Balance is a tuning loop that is never finished, not a property the graft either has or lacks.
- **The frontier is the honest dominance metric.** Win-rate-against-the-field and mirror-against-random both reward farming weak builds. Only best-versus-best says whether there is a king. Picking the right metric is what flipped the verdict from "strained" to "supported."
- **The bar was secretly tournament-grade.** "No profession weak, no build dominant in ranked duels" was never the requirement for a cozy cooperative game. The failure mode that matters is convergence to one obvious build, and the test argues against exactly that.
- **Adrenaline is the clean graft for rage.** GW1 already had the mechanic; it maps one-to-one onto the inherited rage and adds a real build axis at no cost.
- **The rogue is the canary.** A whole profession non-viable at the top is a diversity dent even in co-op, and it is the first thing the next tuning pass owes.

---

## 4. Decisions Made (Board can override any)

| Decision | Owner | Rationale |
|---|---|---|
| **Single energy bar plus an adrenaline track** for build-up skills | Brandon | GW1's adrenaline is the exact analogue of the inherited rage; one bar, no second pool fighting it |
| **§8 tested by simulation: Warrior × Mage × Rogue PvP duels** | Brandon | Robust, controlled, the cheapest honest read on the bet |
| **Original ratification gate left standing; reframe recorded, not enacted** | Brandon (CEO declined to relax it) | Relaxing the bar is a Board call, and one directional run does not ratify |
| **Consent requirement removed** | Brandon | The cast are allegories from logs on dead servers; no real person is depicted or identifiable |
| **Zez resolved: Verger Zebediah, a grey heron** | Brandon | Settles the straight man; voice already locked from "Luna" |
| **Death model confirmed** | Brandon | Repair bill, temporary XP debuff, recoverable unbanked-haul drop anyone can retrieve; gear safe |
| **Time model ratified (hybrid)** | Brandon | Real-anchored seasons and weather, accelerated day/night |
| **Friends-first-versus-not-capped dissolved** | Brandon | Single-author hand-crafted world; headcount is not a design fork |
| **plan.md to v2.1** | Brandon + Claude | Folds the keystone test in without claiming ratification |

**Intentionally open, not a decision:** what the Plant buried, genuinely undetermined, to be discovered through the lore as it is written.

**Proposed, awaiting the Board:** amend the §8 gate to judge diversity and a ceiling at "varied and not pointless" rather than "balanced for competition," and treat profession balance as Phase-4+ tuning rather than a ratification blocker.

---

## 5. Open Items

- **The §8 bet:** leaning the right way, not proven. The skill-ceiling half of the simulation, profession balance, and the Phase 3 human read all remain.
- **The proposed gate amendment:** Brandon's call. It relaxes the bar, so it was deliberately left to him rather than slipped in.
- **What the Plant buried:** the anchoring lore question, deliberately unresolved.
- **Profession balance:** the rogue does not reach the frontier under the first mapping; the next pass owes it.
- **A stylistic loose end:** line 161 of `plan.md` says "see the end" where line 179 says the cleaner "see the protected open question"; both internal, alignment offered, left for now.

---

## 6. Action Items

### Brandon (Board)
| Task | Notes |
|---|---|
| Decide the proposed §8 gate amendment | Diversity/ceiling judged at "varied and not pointless"; balance as Phase-4+ tuning |
| Call whether to keep pushing the sim number | More tuning plus a live-engine re-run, or accept the directional read and move on |

### CEO Agent (next on §8)
| Task | Notes |
|---|---|
| One more tuning iteration | Fix the rogue economy properly; a smarter per-build policy; then re-run |
| Add the skill-ceiling arm | Does the outcome move with how well the encounter is played, or only with which build is equipped |
| Authoritative re-run on the live engine | The base engine and its bot-raid harness against a real encounter, not the port |

### Claude (future sessions)
| Task | Notes |
|---|---|
| Design the Phase 3 human-read test | Two seriously different bars; the cave plays like two different characters (the build-loop test, §3.2) |
| Widen the modeled skill pool | If the sim continues, expand beyond the representative kits |

---

## 7. Participants Referenced

- **Brandon Kelly,** Board / sole human authority. Directed the robust test, locked the resource model and the duel parameters, resolved the open design items, and asked for the fold-in and the self-containment pass. Held the line on the metric and the gate without performing certainty.
- **Claude (Opus, CEO / design partner).** Extracted the real combat math from source, designed and built the simulator, ran and tuned it, added the frontier metric when the mirror metric proved confounded, wrote the verdict and the reframe, folded the result into the constitution, and ran the self-containment pass.
- **Referenced, not present:** **levy-street** ([[World of ClaudeCraft]] author, permission to build granted). The cast drawn from real logs: **"DoobieSnacks" → [[Brother Greenpaw]]**, **"Luna" → [[Verger Zebediah]]** (Zez); the friend group **[[The Plant]]**.

---

## 8. Tone & Sentiment

**Execution-heavy and honest.** This was less debate than build: extract, simulate, read the number, distrust it, fix the metric, read it again. The real friction was internal to the work, the first result was confounded, the mirror metric was confounded, the frontier was the clean read, and naming those confounds out loud instead of shipping the first number was the spine of the session.

**Skeptical by default, on both sides.** The CEO did not let a positive headline rest on a bad metric, and did not relax the ratification bar to make the result look better; the reframe went in as a proposal labeled the Board's call. Brandon ran the build mobile and multitasking, gave the parameters, and trusted the work to come back with the asterisks attached.

**The reframe was the payload.** The 63-percent frontier mattered, but the move that mattered more was seeing that the §8 bet had been miscut: diversity and balance are orthogonal, the graft is sound, balance is tuning, and a cozy cooperative game never needed tournament balance, so the keystone is closer to won than the binary framing implied. The constitution is no longer a clean document asserting an untested core; the one bet that matters has a tool, a first number, and a sharper question.
