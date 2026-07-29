---
title: "The Hollow — Game Design Session Summary"
date: 2026-06-24
project: The Hollow
type: session-summary
status: "plan.md ratified — v1.3"
participants: ["Brandon Kelly (Board)", "Claude (Opus, CEO / design partner)"]
related: ["[[plan.md — The Hollow]]", "[[The Plant]]", "[[Brother Greenpaw]]", "[[World of ClaudeCraft]]", "[[PHATT STUDIOS]]"]
tags: [the-hollow, game-design, mmo, session-summary]
---

# THE HOLLOW — Game Design Session — Summary

**Date:** June 23–24, 2026
**Participants:** Brandon Kelly (Board / Director), Claude (Opus, CEO / design partner)
**Artifact:** `plan.md` — the game's constitution, taken from empty to **v1.3 (ratified, standalone)**

---

## 1. High-Level Summary

This session took The Hollow from "I want to design my dream MMO" to a **ratified, self-contained game constitution** ready for Phase 0 decomposition. The pivotal move was a reframe, and it came from Brandon, not Claude: Claude opened by pushing back on the scope of building an MMO; Brandon refuted it with evidence that a live, playable MMO had already been built on Anthropic's Fable 5 model. That flipped the whole session. The bet became **don't build an MMO, fork a working one** (World of ClaudeCraft) and spend every hour on the layer that makes it *ours* — the world, the god, the prophets, and the tragedy underneath.

From there the constitution was built by accretion from the friend group's real fourteen-year Discord community ("The Plant"): identity and vision, eight design pillars, four interlocking loops of fun, a full world bible, **implementation-grade voice specs for three NPCs pulled from real members' chat logs**, the complete strategic and architectural plan, a CEO-style gap audit, a live procedural-art demo, and finally a visual-direction and living-world layer.

Two themes ran underneath everything. First: **now that the engine is borrowed, taste is the product** — the barrier was never the code, it was deciding what's worth making. Second: **the world is a body for a culture that already exists** — the group has worshipped a plant-god, ground bot levels, gatekept initiation, and held meetups for fourteen years, so this is reification, not invention.

---

## 2. Work Done / Topics

**The strategic reframe (fork, don't build).**
- Verified `levy-street/world-of-claudecraft` is real: browser-playable WoW-Classic-style micro-MMO, deterministic sim core shared by offline + server, server-authoritative 20 Hz netcode, Postgres JSONB persistence, full vanilla combat math, nine classes with real ability kits, three five-player dungeons with real boss fights (bot-tested), **100% procedural art (no asset files)**, Docker self-host, real test + bot-raid harness.
- Reframe locked into §6: keep the spine (sim, netcode, persistence, combat math, dungeon machinery, procedural pipeline, test harness, self-host), build the soul (Plant world, the live god, GW1 builds, creator, open zone, crafting, building, shops).

**The constitution itself.**
- Twelve sections, written under a hard **self-contained mandate** — everything an agent needs is in the one file, no external references. Verified standalone repeatedly.
- Graduated from "founding draft" to **ratified** during a CEO read-through; versioned each change to v1.3.

**Character voice from real data.**
- Parsed the 6.6 MB Discord export (4,763 messages, Jan 2021 – Nov 2022) into an author:message stream and extracted three voices via the **"Doobie treatment"** (real members reimagined as fantasy creatures, never literal likenesses).
- The comedic trio frame: **the anger (The Plant) / the dopey (Greenpaw) / the straight man (Zez).**
- **The Plant** — rationed cosmic-contempt LLM god, two secret contradictions (buried guilt; pop-music shame), authored deterministic fallback required.
- **Brother Greenpaw** — from real member "DoobieSnacks"; anthro cosmic-cowboy stoner-mystic, always lit / out / hungry = a renewable quest engine; voice locked from real quotes.
- **The straight man (Zez)** — from real member "Luna" (the server's actual mod / event-runner / leaderboard-keeper); **public face is a confident benevolent-tyrant, the anxiety is the subtext that drives it** — order is his coping mechanism. Voice locked; creature, name, and consent still open.

**The CEO gap audit (first pass).** Flagged and closed four gaps: LLM substrate (→ resolved as BYOK), backups (→ mandated, Phase 0), moderation at scale (→ gated before going wide), onboarding cold open (→ the slice owns it).

**Architecture & scale.** Lean-and-mean mandate: **a single self-hosted instance targets 1,000+ concurrent on PHATT-RAID** (spatial-grid interest management, cheap tick, visible-entity cap, worker threads, load-tested with the inherited bot harness). Procedural-first art with three Blender heroes. **Content/data architecture named as the real first-foot decision** (make content data-driven, or extract an authoring layer).

**The procedural-art demo.** Explained exactly how procedural visual generation works on this stack (Three.js primitives + `BufferGeometry`, HSL materials, canvas → `CanvasTexture` icons, seeded PRNG for determinism, noise terrain, `InstancedMesh` at scale) and rendered a **live, reseedable procedural plant** Brandon could reshape with sliders.

**Visual direction (added to §7).** Effects *are* the art direction, not end-polish: a cheap mandated toolkit (wind vertex-shader sway, fog, blob shadows, color grading, smoke) that runs on every phone, and a spendy tier (hand-placed god rays, one real shadow light, bloom/AO) that weak devices drop. One toolkit, two moods (warm hazy hub vs cold dark cave) = the opt-in-depth pillar rendered.

**The living world (added to §4, §7, §12).** Day/night, weather, and seasons established as a **crucial world system**, not cosmetic: it drives daily return, it's canon (the Plant already shifts with the seasons), it modulates the side-systems (what grows, what the cave yields, when), and it deepens the tragedy (the surface breathes while the cave stays outside the cycle — the buried thing starved outside of time). Recommended **hybrid time model**: real-anchored seasons/weather, accelerated day/night.

---

## 3. Insights & Takeaways

- **The engine is borrowed, so taste is the product.** Forking WoCC removes the build barrier and makes design and curation the whole game. This is the right shape for the documented planning-without-shipping risk: the deliverable *is* deciding and curating.
- **Reify, don't invent.** Fourteen years of a real plant-worshipping guild means the character specs come from logs, not imagination. The voices are locked from real messages.
- **Rarity is the god's mechanic, and it's also the cost strategy.** A spammable LLM god is not a god; rationing + an authored fallback is simultaneously the character design and the throughput/bill control — even at 1k+ players the call rate stays a trickle.
- **Procedural geometry makes the usually-expensive things core.** Visual identity lives in light, motion, and atmosphere rather than polygon count; and the living world (day/night/weather/seasons), a luxury in a hand-authored game, is nearly free here, so it becomes core instead of cut.
- **The contrast *is* the pillar.** One toolkit renders two moods; the warm hub against the cold cave is opt-in depth made visual, and the living cycle above against the static dark below ties time itself to the buried-thing tragedy.
- **BYOK subsumes "local model."** Bring-your-own-key ships provider-agnostic with two clean tiers (no key → full game on fallback; key → the live god lights up); the operator owns the small rationed bill and a local endpoint is just one valid key target.

---

## 4. Decisions Made (Board can override any)

| Decision | Owner | Rationale |
|---|---|---|
| **Fork World of ClaudeCraft**, build the soul on top | Brandon + Claude | A working engine already exists; effort goes to taste, not infrastructure |
| **License — All Rights Reserved (proprietary)**, credit levy-street | Brandon | Personal project, not open source; levy-street's permission granted verbally |
| **Hero art — procedural by default, Blender for three heroes** (Plant, Greenpaw, vase) | Brandon | The one place randomness is a liability is the faces everyone stares at |
| **GW1 build system — core from v1, not deferrable** | Brandon | Named stakeholder deal-breaker; combat math inherited, build/access layer reworked |
| **Friends as NPCs — yes, via the Doobie treatment** | Brandon | Loving monument to the real community; essences as fantasy, never literal likenesses |
| **Name — THE HOLLOW** (project + hub zone) | Brandon | Named for the thing buried beneath the shrine; atmosphere to most, a clue to the curious |
| **Plant LLM — BYOK; Brandon's instance runs Claude Sonnet 4.6** | Brandon | Provider-agnostic; two tiers; operator owns the small rationed bill |
| **Time model — hybrid (recommended, confirm at world phase)** | Claude (proposed) | Real-anchored seasons match players' lives; accelerated day/night so a session sees the full cycle |
| **Lean single-instance, 1,000+ concurrent on PHATT-RAID** | Brandon | One world built to go big; sharding only deferred, not designed against |

**Intentionally open — not a decision:** *What the Plant buried* (the actual event). Protected by design; heads the lore, never resolved on a schedule.

---

## 5. Open Items

- **What the Plant buried** — the anchoring lore question, deliberately unresolved.
- **Zez** — confirm the creature (heron/crane proposed), the name (working: Verger Zezariah), and **get his consent** on the caricature. Voice is locked.
- **Consent on every ported friend** — each person approves their own caricature before they go in.
- **Time model** — confirm the hybrid when the living world actually comes online.
- **Live-god key** — Brandon slots his Sonnet 4.6 endpoint/key to light up the god for testing.
- *(See the companion gap read for three constitution-level questions surfaced after v1.3: player character identity, the cost of failure in the cave, and the shared god at scale.)*

---

## 6. Action Items

### Brandon (Board)
| Task | Notes |
|---|---|
| Get each ported friend's consent on their caricature | The fun kind of asking; gates putting them in |
| Confirm Zez's creature + name | Voice already locked |
| Provide the Sonnet 4.6 endpoint/key for the live god | For the Phase 2 god test; game runs on fallback without it |
| Confirm the hybrid time model when the world phase lands | Not a Phase-0 blocker |

### CEO Agent (Phase 0)
| Task | Notes |
|---|---|
| Fork WoCC to our org, tag the upstream sync point | `FORK-NOTES.md`; no blind merges |
| Build it and self-host on PHATT-RAID | Caddy TLS reverse proxy; Phase-0 gate = unmodified game runs, two devices, one a phone |
| Audit stack + **content/data architecture** | Data-driven or hardcoded; extract an authoring layer if hardcoded |
| Produce the teardown + keep/replace/add doc | The real first deliverable |
| Stand up **automated, tested, off-box backups** | Phase-0 standing requirement |

### Claude (future sessions)
| Task | Notes |
|---|---|
| Expand `docs/lore/` | World bible is compressed-but-authoritative; lore grows here |
| Flesh the rest of the NPC roster | Consent-gated; the trio is locked, the rest are directions |
| Spec crafting / economy / the character creator as their phases approach | Currently named in §6/§7, not yet detailed |

---

## 7. Participants Referenced

- **Brandon Kelly** — Board / sole human authority. Drove the reframe (refuted the scope pushback with the Fable 5 evidence) and overrode several Claude recommendations with better calls: BYOK over a local model, GW1 builds as non-negotiable core, the 1k+ single-instance mandate.
- **Claude (Opus, CEO / design partner)** — researched and verified WoCC, structured the constitution, extracted the three voices from the logs, ran the gap audit, built the procedural demo, and wrote the visual-direction and living-world layers.
- **Referenced, not present:** **levy-street** (WoCC author; permission to build granted). The real community behind the cast — **"DoobieSnacks" → Brother Greenpaw**, **"Luna" → the straight man (Zez)** — and the friend group **"The Plant."**

---

## 8. Tone & Sentiment

**Momentum-driven, increasingly excited.** The session opened with friction that turned productive: Claude pushed back on scope, Brandon refuted it with evidence, and the refutation became the foundation of the whole project. From there it was rapid additive design with Brandon in flow.

**Directive but trusting, with sharp frame-corrections.** Brandon gave high-level direction and let the details play out, intervening when a call was wrong — and several of his interventions (BYOK, GW1-as-core, the concurrency mandate) were straight improvements on Claude's proposals. The best moments were his corrections and the live demo landing ("super cute, smart, looks half decent. wow.").

**No conflict; pushback was substantive on both sides.** Claude defended positions until given new evidence or a better call; Brandon overrode on merit, not mood. The energy by the end was clearly generative — each addition (procedural demo → effects → the living world) pulled the next, and the session closed with the world "breathing on paper."
