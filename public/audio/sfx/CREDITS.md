# Sound effect credits

Every clip under `public/audio/sfx/` is recorded/Foley or musician-produced audio from the
packs below (out of scope: procedural UI blips in `src/game/audio.ts`, music, `voice/`,
`hub_ambient/`). This is the v2 pass (PHAA-488): every one of the 93 keys was re-sourced
against the per-key character spec in `scripts/sfx/sfx_v2_spec.md` and built with
`scripts/sfx/build_from_mapping.mjs` (trim, pitch, layering, loudness-normalize: one-shots
about -16 LUFS, ambience beds -22 LUFS; the 10 amb_ and 6 cast_ loops are seam-crossfaded).
The full machine-readable mapping (exact offsets, pitches, gains) lives in
`scripts/sfx/sfx_v2_mapping.json`.

Derived stems: a few short sources were pre-extended by looping before processing; they are
credited under their original pack.

## 40 CC0 water / splash / slime SFX
Author: rubberduck  
License: CC0  
Source: https://opengameart.org/content/40-cc0-water-splash-slime-sfx

| key | source file(s) | notes |
|---|---|---|
| `amb_dungeon` | loop_water_01.ogg | layered |
| `amb_water` | loop_water_02.ogg | pre-extended loop stem |
| `mob_boar_death` | splash_01.ogg | layered |
| `mob_murloc_aggro` | bubble_01.ogg | layered |
| `mob_murloc_death` | loop_bubbles_1.ogg | layered |
| `mob_spider_aggro` | splash_04.ogg | layered |
| `mob_spider_death` | splash_11.ogg | layered |
| `move_splash` | splash_04.ogg |  |
| `move_swim` | loop_water_01.ogg |  |

## 80 CC0 creature SFX
Author: rubberduck  
License: CC0  
Source: https://opengameart.org/content/80-cc0-creature-sfx

| key | source file(s) | notes |
|---|---|---|
| `mob_boar_aggro` | grunt_01.ogg | pitch-shifted |
| `mob_boar_attack` | grunt_02.ogg | pitch-shifted |
| `mob_demon_aggro` | scream_01.ogg, monster_04.ogg | pitch-shifted, layered |
| `mob_demon_attack` | monster_05.ogg | pitch-shifted |
| `mob_demon_death` | scream_02.ogg, weird_05.ogg | pitch-shifted, layered |
| `mob_murloc_aggro` | burble_01.ogg | pitch-shifted, layered |
| `mob_murloc_attack` | burble_02.ogg |  |
| `mob_murloc_death` | spit_01.ogg | pitch-shifted, layered |
| `mob_ogre_aggro` | roar_02.ogg | pitch-shifted, layered |
| `mob_ogre_death` | monster_07.ogg | pitch-shifted, layered |
| `mob_spider_aggro` | bug_02.ogg | pitch-shifted, layered |
| `mob_spider_attack` | bug_03.ogg | pitch-shifted |
| `mob_troll_aggro` | troll_02.ogg, monster_04.ogg | pitch-shifted, layered |
| `mob_troll_attack` | troll_01.ogg | pitch-shifted |
| `mob_troll_death` | troll_03.ogg, monster_06.ogg | pitch-shifted, layered |
| `move_jump` | breath.ogg | layered |
| `player_death` | hurt_01.ogg | pitch-shifted, layered |
| `player_hurt` | grunt_02.ogg |  |

## 80 CC0 creture SFX #2
Author: rubberduck  
License: CC0  
Source: https://opengameart.org/content/80-cc0-creture-sfx-2

| key | source file(s) | notes |
|---|---|---|
| `mob_boar_death` | die_04.ogg | pitch-shifted, layered |
| `mob_dragonkin_death` | monster_19.ogg | pitch-shifted, layered |
| `mob_humanoid_aggro` | human_02.ogg, attack_04.ogg | layered |
| `mob_humanoid_attack` | human_01.ogg |  |
| `mob_humanoid_death` | die_04.ogg, monster_17.ogg | pitch-shifted, layered |
| `mob_spider_death` | bug_08.ogg | pitch-shifted, layered |

## Ambience / weather / creature singles (wind, rain, fire, crickets, birds, insect scream, arrow shot)
Author: various: AntumDeluge (wind-loop, CC-BY 3.0); SketchMan3 (wind-whoosh-loop, CC0); Sharm (breeze, CC-BY 3.0); Kresiek The Furry (amb-rain-loop-1, CC0); PagDev (fireplace-sound-loop, CC0); Wolfgang_ (crickets-ambient-noise-loopable, CC0); qubodup (insect-or-alien-scream, CC0); isaiah658 (ambient-bird-sounds, CC0); Mobeyee Sounds (dark-forest-bird, CC-BY 4.0); dorkster (bow-arrow-shot, CC-BY-SA 3.0)  
License: mixed: CC0 / CC-BY 3.0 / CC-BY 4.0 / CC-BY-SA 3.0 (see per-file attribution in author field; each file individually CC0/CC-BY/CC-BY-SA)  
Source: https://opengameart.org/content/wind-loop ; https://opengameart.org/content/wind-whoosh-loop ; https://opengameart.org/content/breeze ; https://opengameart.org/content/amb-rain-loop-1 ; https://opengameart.org/content/fireplace-sound-loop ; https://opengameart.org/content/crickets-ambient-noise-loopable ; https://opengameart.org/content/insect-or-alien-scream ; https://opengameart.org/content/ambient-bird-sounds ; https://opengameart.org/content/dark-forest-bird ; https://opengameart.org/content/bow-arrow-shot

| key | source file(s) | notes |
|---|---|---|
| `amb_birds` | ambient-bird-sounds_birds-isaiah658_0.ogg |  |
| `amb_campfire` | fireplace-sound-loop_fire.wav |  |
| `amb_forge` | fireplace-sound-loop_fire.wav | layered |
| `amb_rain` | amb-rain-loop-1_amb_rain_loop_1.ogg |  |
| `amb_snow` | wind-loop_wind-01_0.ogg | pitch-shifted |
| `amb_wind_marsh` | wind-whoosh-loop_wind woosh loop.ogg, crickets-ambient-noise-loopable_crickets_1.mp3 | pre-extended stems, pitch-shifted, layered |
| `amb_wind_peaks` | wind-loop_wind-01_0.ogg |  |
| `amb_wind_vale` | breeze_wind_0.ogg | pre-extended stem, pitch-shifted |
| `melee_bow` | bow-arrow-shot_shoot.ogg |  |

## Bones Rattle
Author: congusbongus  
License: CC0  
Source: https://opengameart.org/content/bones-rattle

| key | source file(s) | notes |
|---|---|---|
| `impact_bone` | 2.ogg | layered |
| `mob_undead_aggro` | 6.ogg | layered |
| `mob_undead_attack` | 2.ogg | layered |
| `mob_undead_death` | 8.ogg | layered |

## Fantasy Sound Effects Library
Author: Little Robot Sound Factory  
License: CC-BY 3.0  
Source: https://opengameart.org/content/fantasy-sound-effects-library

| key | source file(s) | notes |
|---|---|---|
| `amb_dungeon` | Ambience_Cave_00.wav | layered |
| `foot_dirt` | Footstep_Dirt_03.wav |  |
| `foot_water` | Footstep_Water_00.wav |  |
| `mob_dragonkin_aggro` | Dragon_Growl_00.mp3 | pitch-shifted |
| `mob_dragonkin_attack` | Dragon_Growl_01.mp3 | pitch-shifted |
| `mob_dragonkin_death` | Dragon_Growl_00.mp3 | pitch-shifted, layered |
| `spell_nova` | Spell_03.wav | layered |

## Goblin Speech (MP3 files for gaming)
Author: maclaird  
License: CC-BY-SA 3.0  
Source: https://opengameart.org/content/goblin-speech-mp3-files-for-gaming

| key | source file(s) | notes |
|---|---|---|
| `mob_kobold_aggro` | you have tresspassed on our land now you shall pay.mp3 | pitch-shifted |
| `mob_kobold_attack` | die human die!.mp3 | pitch-shifted |
| `mob_kobold_death` | I am dying.mp3 | pitch-shifted |

## Impact Sounds (Kenney)
Author: Kenney  
License: CC0  
Source: https://kenney.nl/assets/impact-sounds

| key | source file(s) | notes |
|---|---|---|
| `combat_block` | impactPlate_heavy_003.ogg |  |
| `combat_crit` | impactPlate_heavy_004.ogg, impactSoft_heavy_001.ogg | pitch-shifted, layered |
| `combat_parry` | impactMetal_light_001.ogg | layered |
| `foot_grass` | footstep_grass_001.ogg |  |
| `foot_snow` | footstep_snow_002.ogg |  |
| `foot_wood` | footstep_wood_000.ogg |  |
| `impact_bone` | impactWood_medium_000.ogg | layered |
| `impact_flesh` | impactPunch_medium_002.ogg |  |
| `impact_leather` | impactSoft_heavy_001.ogg |  |
| `impact_metal` | impactMetal_heavy_001.ogg |  |
| `melee_unarmed` | impactPunch_medium_004.ogg | layered |
| `move_land` | impactSoft_heavy_004.ogg | layered |
| `player_death` | impactSoft_heavy_002.ogg | layered |

## RPG Audio (Kenney)
Author: Kenney  
License: CC0  
Source: https://kenney.nl/assets/rpg-audio

| key | source file(s) | notes |
|---|---|---|
| `amb_forge` | metalPot1.ogg | layered |
| `cast_nature` | creak1.ogg | pitch-shifted, layered |
| `foot_stone` | footstep02.ogg |  |
| `impact_nature` | creak2.ogg | pitch-shifted, layered |
| `move_jump` | cloth1.ogg | layered |
| `move_land` | handleCoins2.ogg | layered |

## Magic SFX Sample
Author: ViRiX  
License: CC-BY 3.0  
Source: https://opengameart.org/content/magic-sfx-sample

| key | source file(s) | notes |
|---|---|---|
| `impact_fire` | Fire impact 1.wav |  |
| `impact_frost` | Ice attack 2.wav |  |
| `proj_fire` | Fire impact 1.wav | pitch-shifted |

## RPG Sound Pack
Author: artisticdude  
License: CC0  
Source: https://opengameart.org/content/rpg-sound-pack

| key | source file(s) | notes |
|---|---|---|
| `combat_parry` | metal-ringing.wav | layered |
| `melee_swing_blade` | swing.wav, metal-ringing.wav | layered |
| `melee_swing_heavy` | swing2.wav | pitch-shifted |
| `mob_beast_aggro` | mnstr14.wav | pitch-shifted |
| `mob_beast_attack` | wolfman.wav | pitch-shifted |
| `mob_beast_death` | mnstr5.wav | pitch-shifted |
| `mob_ogre_aggro` | ogre2.wav | pitch-shifted, layered |
| `mob_ogre_attack` | ogre1.wav | pitch-shifted |
| `mob_ogre_death` | ogre3.wav | pitch-shifted, layered |
| `mob_undead_aggro` | shade8.wav | pitch-shifted, layered |
| `mob_undead_attack` | shade3.wav | pitch-shifted, layered |
| `mob_undead_death` | shade9.wav | pitch-shifted, layered |

## Spell Sounds Starter Pack
Author: p0ss  
License: CC-BY-SA 3.0  
Source: https://opengameart.org/content/spell-sounds-starter-pack

| key | source file(s) | notes |
|---|---|---|
| `buff_apply` | enchant.ogg |  |
| `cast_arcane` | transmision.ogg |  |
| `cast_fire` | flamethrower.ogg |  |
| `cast_frost` | freeze.ogg |  |
| `cast_holy` | blessing.ogg |  |
| `cast_nature` | wind.ogg | layered |
| `cast_shadow` | pestilence.ogg |  |
| `debuff_apply` | magicfail.ogg | pitch-shifted |
| `heal_impact` | heal.ogg |  |
| `impact_arcane` | zap2.ogg |  |
| `impact_holy` | blessing2.ogg |  |
| `impact_nature` | insect.ogg | layered |
| `impact_shadow` | curse.ogg | pitch-shifted |
| `mob_elemental_aggro` | forcepulse.ogg |  |
| `mob_elemental_attack` | zap2e.ogg | pitch-shifted |
| `mob_elemental_death` | explode4.ogg, steam.ogg | pitch-shifted, layered |
| `proj_arcane` | zap10.ogg | pitch-shifted |
| `proj_frost` | freeze2.ogg | pitch-shifted |
| `proj_holy` | blessing3.ogg | pitch-shifted |
| `proj_nature` | wind.ogg | pitch-shifted |
| `proj_shadow` | curse3.ogg | pitch-shifted |
| `spell_nova` | explode1.ogg | layered |

## Swishes Sound Pack
Author: artisticdude  
License: CC0  
Source: https://opengameart.org/content/swishes-sound-pack

| key | source file(s) | notes |
|---|---|---|
| `combat_dodge` | swish-7.wav |  |
| `melee_swing_light` | swish-9.wav |  |
| `melee_unarmed` | swish-1.wav | layered |

