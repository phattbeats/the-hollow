# SFX v2 character spec (PHAA-488 redo)

Target feel: fantasy epic RPG. Recorded/Foley or musician-produced only. Every key below
must resolve to a clip whose SOURCE semantically matches the described character; never
reuse one source clip across different schools, zones, or creature families. Layering
(2 sources mixed) and pitch/filter shifts are encouraged to build distinct identities.

Global processing rules:
- mp3, 44.1 kHz, 128 kbps, mono for point sources (foot/impact/melee/proj/mob), stereo ok for amb_.
- Loudness: short one-shots to about -16 LUFS integrated; amb_ loops to about -22 LUFS (beds sit under gameplay).
- Trim silence to under 30 ms lead-in for one-shots (combat feedback must feel instant).
- The 10 amb_ loops: 20 to 60 s long, seam-crossfaded, verified click-free at the loop point.
- The 6 cast_ keys also loop (channel while casting): 1.5 to 4 s, seamed.

## Ambience (10, loop)
- amb_birds: daytime forest songbirds, no wind dominance, no traffic.
- amb_campfire: small wood fire crackle, intimate, no roar.
- amb_dungeon: cave drone, distant drips, low reverb rumble. NOT bubbling water.
- amb_forge: fire base plus intermittent metal working (hammer/anvil), layered.
- amb_rain: steady rain on foliage/ground, mid density, no thunder.
- amb_snow: high cold thin wind, sparse, desolate. Must read distinct from peaks/vale.
- amb_water: lake/river lapping, gentle, loopable.
- amb_wind_marsh: low damp wind plus insect/frog hints if available. Distinct recording.
- amb_wind_peaks: strong high-altitude howl/gusting. Distinct recording.
- amb_wind_vale: soft leafy breeze through trees. Distinct recording.

## Casting loops (6) and spell impacts
Each school gets its OWN sonic identity, used consistently across cast_/impact_/proj_:
- fire: crackling flame whoosh, warm roar.
- frost: crystalline shimmer, icy hiss, brittle.
- arcane: harmonic hum/pulse, synthetic-adjacent but musical.
- holy: bright choral/bell-like shimmer, airy.
- nature: organic rustle/growth, wood creak, bees/leaves.
- shadow: dark breathy drone, reversed swell, whispery.
- cast_<school>: sustained channel loop, 1.5-4 s.
- impact_<school> (arcane/fire/frost/holy/shadow/nature): short hit of the same identity, under 1 s.
- proj_<school> (arcane/fire/frost/holy/nature/shadow): whoosh-by with the school's timbre, 0.4-1 s.
- spell_nova: big AoE bloom: low boom plus school-neutral magical burst, 1-2 s. Not a bell.
- buff_apply: soft ascending positive shimmer, under 1 s.
- debuff_apply: sour descending sting, under 1 s. Must not be the shadow impact.
- heal_impact: warm gentle chime/water-light sparkle, under 1 s. Distinct from holy impact.

## Physical impacts (4 of the 10 impact_ keys)
- impact_flesh: meaty punch/thud, recorded Foley.
- impact_bone: dry crack/rattle (real bone/wood snap character, NOT glass).
- impact_leather: dull thwack on hide/leather.
- impact_metal: sword-on-armor clang, metallic ring damped fast.

## Melee and combat feedback
- melee_swing_light: fast thin whoosh (dagger).
- melee_swing_blade: mid sword swish with slight metal ring.
- melee_swing_heavy: slow heavy air-cut (two-hander), lower pitch.
- melee_unarmed: fist whoosh plus soft smack.
- melee_bow: bowstring release plus arrow flight.
- combat_block: shield thunk (wood/metal), solid.
- combat_parry: blade-on-blade clash, bright clang.
- combat_dodge: quick cloth/air sidestep whoosh.
- combat_crit: heavier, layered version of a hit: impact plus low thump accent. Must feel BIGGER than normal hits, not a bell.
- player_hurt: male grunt, short, restrained.
- player_death: longer fall/collapse groan plus body drop.

## Footsteps (6) and movement (4)
One step per file, distinct surface reads: foot_grass (soft rustle), foot_dirt (gritty scuff),
foot_stone (hard tap), foot_wood (hollow knock), foot_snow (crunch), foot_water (shallow splash).
- move_jump: effort exhale plus cloth/gear lift.
- move_land: boot landing thud plus gear jingle.
- move_splash: body-into-water splash.
- move_swim: rhythmic stroke slosh (loopable-friendly).

## Creature vocals (12 families x aggro/attack/death = 36)
aggro: threat call (longer, announcing). attack: short effort bark/hiss at swing. death: dying cry, falling energy.
Families must be mutually distinguishable; pitch-shift the same base recording to create
family-internal cohesion, never cross-family reuse of the identical clip.
- beast (wolf/cat): growl, snarl, whimper-death.
- boar: pig grunt/squeal, squeal-death.
- spider: chittering hiss, skittery, wet click death.
- kobold: small yappy reptilian snarl (NOT cute), higher-pitched goblinoid.
- murloc: wet gurgling croak/warble, amphibian.
- troll: deep dumb bellow, guttural.
- ogre: huge slow roar, chesty.
- humanoid (bandit): human male shout/grunt/death cry.
- undead: bone rattle plus dry moan/hiss, hollow.
- demon: distorted low snarl/scream, infernal.
- elemental: whooshing energy surge (school-neutral), crackling dissipation death.
- dragonkin: big reptilian roar, higher scream attack, collapsing roar death.
