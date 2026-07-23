// Book of Asphodelia content tables (PHAA-744 engine/wire layer; PHAA-745 fills
// these in, category by category). Every deed/title name and text is a t() key
// resolved through src/ui/entity_i18n.ts ('deed'/'title' kinds); the strings
// below are the canonical English source, matched against real MOBS/ITEMS ids
// by the deeds_content integrity test.
//
// Landed so far: combat (kill-based only - deeds needing new trigger types,
// e.g. crit-hit or damage-dealt counters, wait on their own engine hook per
// the ticket's category-by-category sequencing), collection (collect-based
// only, driven by the inventory-holding hook PHAA-744 shipped: credit is the
// count currently held, so a deed completes once the player holds the full set
// at once, and stays done thereafter), chronicle (quest-completion based,
// driven by the new onQuestCompletedForDeeds hook off completeQuest() in
// quests/quest_commands.ts, the shared core both turnInQuest and refuseQuest
// route through; a 'quest' objective with no questId wildcards on any
// completion, same convention as the combat wildcard-kill objectives), and
// delve (clear-based, driven by the onDelveClearedForDeeds hook off
// grantDelveClearTo in delves/runs.ts, the shared per-member clear-economy
// choke point every completion path routes through; a 'delve' objective can
// filter by delveId, tierId, and/or deathless, each omittable as a wildcard,
// same convention as the other categories' wildcard objectives), progression
// (level-threshold based, driven by the onLevelReachedForDeeds hook off the
// grantXp level-up loop in combat/damage.ts), and dungeon (final-boss-kill
// based, riding the same onMobKilledForDeeds hook via targetMobId since a
// dungeon clear is its boss kill; deathless/encounter-condition dungeon deeds
// wait on a dungeon encounter-state hook, deferred as their own follow-up), and
// exploration (zone-entry based, driven by the new onZoneVisitedForDeeds hook
// off the per-player movement tick in sim.ts, fired once per zone entry; every
// 'explore' objective targets a specific zoneId with count 1, so a zone credits
// its objective exactly once and re-entry is an idempotent no-op), and feat
// (marquee cross-system accomplishments; like the dungeon category it adds no
// new engine hook, composing only the objective types whose hooks already ship
// - kill, delve, quest, level, explore - so a feat credits through the existing
// per-type paths and simply spans several of them at once), and hidden (secret
// deeds concealed in the book until earned - the conceal-until-earned
// presentation is the cross-surface UI child PHAA-748; like feat and dungeon it
// adds no new engine hook, riding the existing kill and collect paths, tied to
// the Asphodel's obscure rares and the small hoards only the curious gather).

import type { DeedDef, TitleDef } from '../types';

export const DEEDS: Record<string, DeedDef> = {
  cmb_first_blood: {
    id: 'cmb_first_blood',
    name: 'First Blood',
    text: 'Draw first blood: defeat any enemy.',
    category: 'combat',
    objectives: [{ type: 'kill', count: 1, label: 'Enemies defeated' }],
    titleReward: 't_blooded',
  },
  cmb_wolf_cull: {
    id: 'cmb_wolf_cull',
    name: 'Wolf Cull',
    text: 'Thin the packs at the forest edge: slay 25 forest wolves.',
    category: 'combat',
    objectives: [
      { type: 'kill', targetMobId: 'forest_wolf', count: 25, label: 'Forest wolves slain' },
    ],
  },
  cmb_boarbreaker: {
    id: 'cmb_boarbreaker',
    name: 'Boarbreaker',
    text: 'Clear the wild boars rooting through Eastbrook Vale: slay 25.',
    category: 'combat',
    objectives: [{ type: 'kill', targetMobId: 'wild_boar', count: 25, label: 'Wild boars slain' }],
  },
  cmb_greyjaws_end: {
    id: 'cmb_greyjaws_end',
    name: "Greyjaw's End",
    text: 'Old Greyjaw has terrorized these woods long enough. End him.',
    category: 'combat',
    objectives: [
      { type: 'kill', targetMobId: 'old_greyjaw', count: 1, label: 'Old Greyjaw slain' },
    ],
    titleReward: 't_greyjaws_bane',
  },
  cmb_gravecaller_fallen: {
    id: 'cmb_gravecaller_fallen',
    name: 'The Gravecaller Falls',
    text: 'Descend into the Hollow Crypt and strike down Morthen the Gravecaller.',
    category: 'combat',
    objectives: [{ type: 'kill', targetMobId: 'morthen', count: 1, label: 'Morthen slain' }],
    titleReward: 't_gravecallers_bane',
  },
  cmb_century: {
    id: 'cmb_century',
    name: 'The Century',
    text: 'Defeat 100 enemies.',
    category: 'combat',
    objectives: [{ type: 'kill', count: 100, label: 'Enemies defeated' }],
  },

  // Collection: gather and hold trophies, hides, and hauls. Credit tracks what
  // is currently in the pack, so each deed completes the moment the full set is
  // held at once. Every itemId below resolves to a real drop in content/items.ts.
  col_fangbinder: {
    id: 'col_fangbinder',
    name: 'Fangbinder',
    text: "String a hunter's tally from the wolves of the Reaches: gather 15 cracked wolf fangs.",
    category: 'collection',
    objectives: [{ type: 'collect', itemId: 'wolf_fang', count: 15, label: 'Cracked wolf fangs' }],
    titleReward: 't_fangbinder',
  },
  col_boarhide_tanner: {
    id: 'col_boarhide_tanner',
    name: 'Boarhide Tanner',
    text: 'Salvage bristly hides from the boars rooting through Eastbrook Vale: gather 15.',
    category: 'collection',
    objectives: [{ type: 'collect', itemId: 'boar_hide', count: 15, label: 'Bristly boar hides' }],
  },
  col_bonepicker: {
    id: 'col_bonepicker',
    name: 'Bonepicker',
    text: 'Pick over the leavings of the dead: gather 20 bone fragments.',
    category: 'collection',
    objectives: [{ type: 'collect', itemId: 'bone_fragments', count: 20, label: 'Bone fragments' }],
    titleReward: 't_bonepicker',
  },
  col_anglers_haul: {
    id: 'col_anglers_haul',
    name: "Angler's Haul",
    text: 'Fill a creel from every water in the Reaches: land a full string of each catch.',
    category: 'collection',
    objectives: [
      { type: 'collect', itemId: 'raw_mirror_trout', count: 5, label: 'Mirror trout' },
      { type: 'collect', itemId: 'raw_river_perch', count: 5, label: 'River perch' },
      { type: 'collect', itemId: 'raw_marsh_pike', count: 5, label: 'Marsh pike' },
      { type: 'collect', itemId: 'raw_bog_eel', count: 5, label: 'Bog eels' },
    ],
    titleReward: 't_angler',
  },
  col_essence_gatherer: {
    id: 'col_essence_gatherer',
    name: 'Essence Gatherer',
    text: 'Bottle the restless remnants that cling to the Hollow Crypt: gather 10 ghostly essence.',
    category: 'collection',
    objectives: [
      { type: 'collect', itemId: 'ghostly_essence', count: 10, label: 'Ghostly essence' },
    ],
  },
  col_greyjaw_trophy: {
    id: 'col_greyjaw_trophy',
    name: 'The Greyjaw Trophy',
    text: "Claim the one fang worth keeping: recover Old Greyjaw's Fang.",
    category: 'collection',
    objectives: [
      { type: 'collect', itemId: 'greyjaw_fang', count: 1, label: "Old Greyjaw's Fang" },
    ],
  },

  // Chronicle: milestones along the Hollow's story quest chains. Each questId
  // below resolves to a real quest in content/hollow.ts, zone1.ts, zone3.ts, or
  // temple.ts; the deeds_content integrity test checks it.
  chr_chronicler: {
    id: 'chr_chronicler',
    name: 'The Chronicler',
    text: "Take up as many threads of the Hollow's story as you can: complete 25 quests.",
    category: 'chronicle',
    objectives: [{ type: 'quest', count: 25, label: 'Quests completed' }],
    titleReward: 't_chronicler',
  },
  chr_hearth_of_your_own: {
    id: 'chr_hearth_of_your_own',
    name: 'A Hearth of Your Own',
    text: "Walk Brother Greenpaw's hearth from its first spark to Fallow Acres, and claim ground of your own.",
    category: 'chronicle',
    objectives: [
      { type: 'quest', questId: 'q_your_own_hearth', count: 1, label: 'A Hearth of Your Own' },
    ],
  },
  chr_gravecallers_trail: {
    id: 'chr_gravecallers_trail',
    name: 'The Sect That Would Not Die',
    text: "Search the ruined chapel above the Hollow Crypt and learn that Morthen's sect answers to a Mistcaller in the northern fen.",
    category: 'chronicle',
    objectives: [
      {
        type: 'quest',
        questId: 'q_gravecallers_trail',
        count: 1,
        label: "The Gravecaller's Trail",
      },
    ],
  },
  chr_silence_the_choir: {
    id: 'chr_silence_the_choir',
    name: 'The Choir Falls Silent',
    text: 'Descend through the temple gate and end Choirmother Selthe, silencing the prayer that never let the mere sleep.',
    category: 'chronicle',
    objectives: [
      { type: 'quest', questId: 'q_silence_the_choir', count: 1, label: 'Silence the Choir' },
    ],
    titleReward: 't_choir_silencer',
  },
  chr_drowned_moon: {
    id: 'chr_drowned_moon',
    name: 'The Drowned Moon Sleeps Again',
    text: "Face Ysolei, Avatar of the Drowned Moon, at the altar under the tarn, and put the mountain's oldest nightmare back to sleep.",
    category: 'chronicle',
    objectives: [{ type: 'quest', questId: 'q_drowned_moon', count: 1, label: 'The Drowned Moon' }],
    titleReward: 't_moonbound',
  },
  chr_gravewyrm_saga: {
    id: 'chr_gravewyrm_saga',
    name: 'Every Bell in Eastbrook',
    text: "Follow the thread from a chapel yard in the Vale to the Wyrm's Hollow itself, and end Korzul the Gravewyrm before the wall, the marsh, and Eastbrook fall in a single night.",
    category: 'chronicle',
    objectives: [
      { type: 'quest', questId: 'q_gravewyrm', count: 1, label: 'Korzul the Gravewyrm' },
    ],
    titleReward: 't_gravewyrms_end',
  },

  // Delve: milestones from the Collapsed Reliquary, the crypt beneath Brother
  // Halven's ruin where Deacon Varric's cult still keeps its dead. delveId/
  // tierId below resolve to content/delves/collapsed_reliquary.ts; the
  // deeds_content integrity test checks it.
  dlv_reliquary_cleared: {
    id: 'dlv_reliquary_cleared',
    name: 'First Descent',
    text: "Answer Brother Halven's call and clear the Collapsed Reliquary for the first time.",
    category: 'delve',
    objectives: [
      {
        type: 'delve',
        delveId: 'collapsed_reliquary',
        count: 1,
        label: 'Collapsed Reliquary cleared',
      },
    ],
  },
  dlv_reliquary_warden: {
    id: 'dlv_reliquary_warden',
    name: 'Reliquary Warden',
    text: 'Make the Collapsed Reliquary a habit: clear it 25 times.',
    category: 'delve',
    objectives: [
      {
        type: 'delve',
        delveId: 'collapsed_reliquary',
        count: 25,
        label: 'Collapsed Reliquary cleared',
      },
    ],
    titleReward: 't_reliquary_warden',
  },
  dlv_varrics_bane: {
    id: 'dlv_varrics_bane',
    name: "Deacon Varric's Bane",
    text: 'Face Deacon Varric at Heroic tier and put him down.',
    category: 'delve',
    objectives: [
      {
        type: 'delve',
        delveId: 'collapsed_reliquary',
        tierId: 'heroic',
        count: 1,
        label: 'Collapsed Reliquary cleared on Heroic',
      },
    ],
    titleReward: 't_varrics_bane',
  },
  dlv_without_a_scratch: {
    id: 'dlv_without_a_scratch',
    name: 'Without a Scratch',
    text: 'Clear the Collapsed Reliquary without a single death.',
    category: 'delve',
    objectives: [
      {
        type: 'delve',
        delveId: 'collapsed_reliquary',
        deathless: true,
        count: 1,
        label: 'Deathless clear',
      },
    ],
    titleReward: 't_unbroken',
  },
  dlv_flawless_vigil: {
    id: 'dlv_flawless_vigil',
    name: 'Flawless Vigil',
    text: 'Clear the Collapsed Reliquary on Heroic without a single death.',
    category: 'delve',
    objectives: [
      {
        type: 'delve',
        delveId: 'collapsed_reliquary',
        tierId: 'heroic',
        deathless: true,
        count: 1,
        label: 'Deathless Heroic clear',
      },
    ],
    titleReward: 't_flawless_vigil',
  },
  dlv_the_delver: {
    id: 'dlv_the_delver',
    name: 'The Delver',
    text: 'Descend again and again: clear 10 delves.',
    category: 'delve',
    objectives: [{ type: 'delve', count: 10, label: 'Delves cleared' }],
    titleReward: 't_delver',
  },

  // Progression: the growth of a life in the Hollow told as stages of a
  // planted thing, from first sprout to full canopy. Each 'level' objective
  // credits once when the character reaches its atLeast threshold, driven by
  // the onLevelReachedForDeeds hook off the level-up loop in combat/damage.ts.
  // Thresholds run to MAX_LEVEL (20).
  pgr_first_sprout: {
    id: 'pgr_first_sprout',
    name: 'First Sprout',
    text: 'Break the soil: reach level 5.',
    category: 'progression',
    objectives: [{ type: 'level', atLeast: 5, count: 1, label: 'Reach level 5' }],
  },
  pgr_green_shoot: {
    id: 'pgr_green_shoot',
    name: 'Green Shoot',
    text: 'Rise toward the light: reach level 8.',
    category: 'progression',
    objectives: [{ type: 'level', atLeast: 8, count: 1, label: 'Reach level 8' }],
  },
  pgr_taking_root: {
    id: 'pgr_taking_root',
    name: 'Taking Root',
    text: 'Grow deep enough to hold your ground: reach level 10.',
    category: 'progression',
    objectives: [{ type: 'level', atLeast: 10, count: 1, label: 'Reach level 10' }],
    titleReward: 't_rooted',
  },
  pgr_reaching_up: {
    id: 'pgr_reaching_up',
    name: 'Reaching Up',
    text: 'Stretch past the undergrowth: reach level 12.',
    category: 'progression',
    objectives: [{ type: 'level', atLeast: 12, count: 1, label: 'Reach level 12' }],
  },
  pgr_in_full_leaf: {
    id: 'pgr_in_full_leaf',
    name: 'In Full Leaf',
    text: 'Come into your season: reach level 15.',
    category: 'progression',
    objectives: [{ type: 'level', atLeast: 15, count: 1, label: 'Reach level 15' }],
    titleReward: 't_verdant',
  },
  pgr_full_canopy: {
    id: 'pgr_full_canopy',
    name: 'Full Canopy',
    text: 'Grow as tall as the Hollow allows: reach the level cap.',
    category: 'progression',
    objectives: [{ type: 'level', atLeast: 20, count: 1, label: 'Reach level 20' }],
    titleReward: 't_everblooming',
  },

  // Dungeon: the lords sealed in the Hollow's instanced depths, each felled by
  // ending the dungeon's final boss. These credit through the same kill hook
  // PHAA-744 shipped (onMobKilledForDeeds, targetMobId the boss template), so no
  // new engine hook is needed: a dungeon clear IS the boss kill. The crypt lord
  // Morthen already anchors a combat deed (cmb_gravecaller_fallen), so this
  // category covers the other five dungeon finals plus a grand-slam capstone.
  // Deathless/encounter-condition dungeon deeds (clear-without-a-death, or a
  // kill under a boss-specific state) wait on a dungeon encounter-state hook,
  // the same deferral the combat category uses for its crit/damage-counter
  // deeds; that hook is a separate follow-up, not authored here.
  dgn_bastion_stilled: {
    id: 'dgn_bastion_stilled',
    name: 'The Bastion Stilled',
    text: 'Silence the mist that floods the Sunken Bastion: defeat Vael the Mistcaller.',
    category: 'dungeon',
    objectives: [
      {
        type: 'kill',
        targetMobId: 'vael_the_mistcaller',
        count: 1,
        label: 'Vael the Mistcaller defeated',
      },
    ],
  },
  dgn_drowned_avatar: {
    id: 'dgn_drowned_avatar',
    name: 'The Drowned Moon Guttered',
    text: 'Put out the cold light in the flooded temple: defeat Ysolei, Avatar of the Drowned Moon.',
    category: 'dungeon',
    objectives: [{ type: 'kill', targetMobId: 'ysolei', count: 1, label: 'Ysolei defeated' }],
    titleReward: 't_moonquenched',
  },
  dgn_heartwood_felled: {
    id: 'dgn_heartwood_felled',
    name: 'The Heartwood Felled',
    text: 'Bring down the rooted giant at the core of the Hollow: defeat the Heartwood Colossus.',
    category: 'dungeon',
    objectives: [
      {
        type: 'kill',
        targetMobId: 'heartwood_colossus',
        count: 1,
        label: 'Heartwood Colossus felled',
      },
    ],
  },
  dgn_gravewyrm_undone: {
    id: 'dgn_gravewyrm_undone',
    name: 'The Gravewyrm Undone',
    text: 'Break the coils that seal the Gravewyrm Sanctum: defeat Korzul the Gravewyrm.',
    category: 'dungeon',
    objectives: [
      {
        type: 'kill',
        targetMobId: 'korzul_the_gravewyrm',
        count: 1,
        label: 'Korzul the Gravewyrm undone',
      },
    ],
    titleReward: 't_wyrmsunder',
  },
  dgn_scourge_ended: {
    id: 'dgn_scourge_ended',
    name: "Thornpeak's Reprieve",
    text: 'End the tyrant of the Abandoned Crypt: defeat Nythraxis, Scourge of Thornpeak.',
    category: 'dungeon',
    objectives: [
      {
        type: 'kill',
        targetMobId: 'nythraxis_scourge_of_thornpeak',
        count: 1,
        label: 'Nythraxis defeated',
      },
    ],
    titleReward: 't_thornpeak_warden',
  },
  dgn_hollow_conqueror: {
    id: 'dgn_hollow_conqueror',
    name: 'Lords of the Hollow',
    text: 'Fell every lord sealed in the depths of the Hollow, from crypt to sanctum to crown.',
    category: 'dungeon',
    objectives: [
      { type: 'kill', targetMobId: 'morthen', count: 1, label: 'Morthen the Gravecaller' },
      { type: 'kill', targetMobId: 'vael_the_mistcaller', count: 1, label: 'Vael the Mistcaller' },
      {
        type: 'kill',
        targetMobId: 'ysolei',
        count: 1,
        label: 'Ysolei, Avatar of the Drowned Moon',
      },
      {
        type: 'kill',
        targetMobId: 'heartwood_colossus',
        count: 1,
        label: 'the Heartwood Colossus',
      },
      {
        type: 'kill',
        targetMobId: 'korzul_the_gravewyrm',
        count: 1,
        label: 'Korzul the Gravewyrm',
      },
      {
        type: 'kill',
        targetMobId: 'nythraxis_scourge_of_thornpeak',
        count: 1,
        label: 'Nythraxis, Scourge of Thornpeak',
      },
    ],
    titleReward: 't_hollows_bane',
  },

  // ---- Exploration (PHAA-745) --------------------------------------------
  // Zone-entry based, driven by the onZoneVisitedForDeeds hook off the
  // per-player movement tick in sim.ts, fired once per zone entry. Every
  // objective targets a specific zoneId with count 1, so a zone credits its
  // objective exactly once and re-entry is an idempotent no-op.
  exp_hollow_reaches: {
    id: 'exp_hollow_reaches',
    name: 'Into the Hollow',
    text: 'Set foot in the Hollow Reaches, where the old growth swallows the light.',
    category: 'exploration',
    objectives: [
      { type: 'explore', zoneId: 'the_hollow_reaches', count: 1, label: 'The Hollow Reaches' },
    ],
  },
  exp_eastbrook_vale: {
    id: 'exp_eastbrook_vale',
    name: 'Vale-Walker',
    text: 'Wander the green terraces of Eastbrook Vale.',
    category: 'exploration',
    objectives: [{ type: 'explore', zoneId: 'eastbrook_vale', count: 1, label: 'Eastbrook Vale' }],
  },
  exp_mirefen_marsh: {
    id: 'exp_mirefen_marsh',
    name: 'Into the Mire',
    text: 'Brave the drowned reeds and sunken roots of Mirefen Marsh.',
    category: 'exploration',
    objectives: [{ type: 'explore', zoneId: 'mirefen_marsh', count: 1, label: 'Mirefen Marsh' }],
  },
  exp_thornpeak_heights: {
    id: 'exp_thornpeak_heights',
    name: 'Above the Bramble',
    text: 'Climb into the thorn-crowned crags of Thornpeak Heights.',
    category: 'exploration',
    objectives: [
      { type: 'explore', zoneId: 'thornpeak_heights', count: 1, label: 'Thornpeak Heights' },
    ],
  },
  exp_grand_tour: {
    id: 'exp_grand_tour',
    name: 'Seed on the Wind',
    text: 'Let the wind carry you to every corner of the Asphodel: stand in all four lands.',
    category: 'exploration',
    objectives: [
      { type: 'explore', zoneId: 'the_hollow_reaches', count: 1, label: 'The Hollow Reaches' },
      { type: 'explore', zoneId: 'eastbrook_vale', count: 1, label: 'Eastbrook Vale' },
      { type: 'explore', zoneId: 'mirefen_marsh', count: 1, label: 'Mirefen Marsh' },
      { type: 'explore', zoneId: 'thornpeak_heights', count: 1, label: 'Thornpeak Heights' },
    ],
    titleReward: 't_wayfarer',
  },

  // ---- Feat (PHAA-745) ---------------------------------------------------
  // Marquee cross-system accomplishments. The feat category adds no new engine
  // hook: every objective below reuses a type whose credit path already ships
  // (kill, delve, quest, level, explore), so a feat is just a harder, wider
  // goal that spans several of those paths at once. Escalating prestige, from a
  // single deep grind to the Grand Asphodelian capstone that touches every
  // system in the Hollow.
  feat_relentless: {
    id: 'feat_relentless',
    name: 'Relentless',
    text: 'Let nothing in the Asphodel stand for long: defeat 250 enemies.',
    category: 'feat',
    objectives: [{ type: 'kill', count: 250, label: 'Enemies defeated' }],
    titleReward: 't_relentless',
  },
  feat_deepwarden: {
    id: 'feat_deepwarden',
    name: 'Warden of the Deep',
    text: "Make the dark under Brother Halven's ruin your own: clear the Collapsed Reliquary 50 times.",
    category: 'feat',
    objectives: [
      {
        type: 'delve',
        delveId: 'collapsed_reliquary',
        count: 50,
        label: 'Collapsed Reliquary cleared',
      },
    ],
    titleReward: 't_deepwarden',
  },
  feat_lorebound: {
    id: 'feat_lorebound',
    name: 'Lorebound',
    text: 'Gather every thread the Hollow will give you: complete 50 quests.',
    category: 'feat',
    objectives: [{ type: 'quest', count: 50, label: 'Quests completed' }],
    titleReward: 't_lorebound',
  },
  feat_pathfinder: {
    id: 'feat_pathfinder',
    name: 'Pathfinder',
    text: 'Come into full growth having walked the whole of the Asphodel: reach the level cap and stand in all four lands.',
    category: 'feat',
    objectives: [
      { type: 'level', atLeast: 20, count: 1, label: 'Reach level 20' },
      { type: 'explore', zoneId: 'the_hollow_reaches', count: 1, label: 'The Hollow Reaches' },
      { type: 'explore', zoneId: 'eastbrook_vale', count: 1, label: 'Eastbrook Vale' },
      { type: 'explore', zoneId: 'mirefen_marsh', count: 1, label: 'Mirefen Marsh' },
      { type: 'explore', zoneId: 'thornpeak_heights', count: 1, label: 'Thornpeak Heights' },
    ],
    titleReward: 't_pathfinder',
  },
  feat_child_of_the_asphodel: {
    id: 'feat_child_of_the_asphodel',
    name: 'Child of the Asphodel',
    text: 'Live a life rooted in all things: reach the level cap, clear a delve, fell a lord of the depths, and see the Gravewyrm saga through to its end.',
    category: 'feat',
    objectives: [
      { type: 'level', atLeast: 20, count: 1, label: 'Reach level 20' },
      { type: 'delve', count: 1, label: 'Any delve cleared' },
      {
        type: 'kill',
        targetMobId: 'korzul_the_gravewyrm',
        count: 1,
        label: 'A lord of the depths felled',
      },
      { type: 'quest', questId: 'q_gravewyrm', count: 1, label: 'The Gravewyrm saga completed' },
    ],
    titleReward: 't_asphodel_child',
  },
  feat_grand_asphodelian: {
    id: 'feat_grand_asphodelian',
    name: 'The Grand Asphodelian',
    text: 'Master every reach of the Hollow: grow to the level cap, fell every lord sealed in the depths, clear the Collapsed Reliquary on Heroic, and end the Gravewyrm saga.',
    category: 'feat',
    objectives: [
      { type: 'level', atLeast: 20, count: 1, label: 'Reach level 20' },
      { type: 'kill', targetMobId: 'morthen', count: 1, label: 'Morthen the Gravecaller' },
      { type: 'kill', targetMobId: 'vael_the_mistcaller', count: 1, label: 'Vael the Mistcaller' },
      {
        type: 'kill',
        targetMobId: 'ysolei',
        count: 1,
        label: 'Ysolei, Avatar of the Drowned Moon',
      },
      {
        type: 'kill',
        targetMobId: 'heartwood_colossus',
        count: 1,
        label: 'the Heartwood Colossus',
      },
      {
        type: 'kill',
        targetMobId: 'korzul_the_gravewyrm',
        count: 1,
        label: 'Korzul the Gravewyrm',
      },
      {
        type: 'kill',
        targetMobId: 'nythraxis_scourge_of_thornpeak',
        count: 1,
        label: 'Nythraxis, Scourge of Thornpeak',
      },
      {
        type: 'delve',
        delveId: 'collapsed_reliquary',
        tierId: 'heroic',
        count: 1,
        label: 'Collapsed Reliquary cleared on Heroic',
      },
      { type: 'quest', questId: 'q_gravewyrm', count: 1, label: 'The Gravewyrm saga completed' },
    ],
    titleReward: 't_grand_asphodelian',
  },

  // ---- Hidden (PHAA-745) --------------------------------------------------
  // Secret deeds: the Book of Asphodelia keeps these pages blank until the deed
  // is earned (the conceal-until-earned presentation is the cross-surface UI
  // child PHAA-748; the credit engine treats them exactly like any other deed).
  // Like the feat and dungeon categories this adds no new engine hook: every
  // objective reuses a type whose credit path already ships (kill, collect), so
  // a hidden deed is just an unadvertised goal a player stumbles into, most of
  // them tied to the Asphodel's obscure rares and the small hoards only the
  // curious bother to gather.
  hid_tunnelking: {
    id: 'hid_tunnelking',
    name: 'Where the Maps End',
    text: 'Grix the Tunnelking hollows the earth past the last drawn road. Find him. End him.',
    category: 'hidden',
    objectives: [
      {
        type: 'kill',
        targetMobId: 'grix_the_tunnelking',
        count: 1,
        label: 'Grix the Tunnelking slain',
      },
    ],
    titleReward: 't_tunnelbane',
  },
  hid_silk_and_shadow: {
    id: 'hid_silk_and_shadow',
    name: 'Silk and Shadow',
    text: 'Deep in the drowned reeds something older than the Mire spins in the dark. Cut it down.',
    category: 'hidden',
    objectives: [
      {
        type: 'kill',
        targetMobId: 'mirefen_broodmother',
        count: 1,
        label: 'The Mirefen Broodmother slain',
      },
    ],
    titleReward: 't_silkcutter',
  },
  hid_twice_a_deacon: {
    id: 'hid_twice_a_deacon',
    name: 'Twice a Deacon',
    text: "Two men wore the deacon's stole and both traded it for grave-cloth. Lay them both to rest.",
    category: 'hidden',
    objectives: [
      { type: 'kill', targetMobId: 'deacon_voss', count: 1, label: 'Deacon Voss laid to rest' },
      { type: 'kill', targetMobId: 'deacon_varric', count: 1, label: 'Deacon Varric laid to rest' },
    ],
    titleReward: 't_deacons_doom',
  },
  hid_gluttons_cache: {
    id: 'hid_gluttons_cache',
    name: "The Glutton's Cache",
    text: 'No one needs this many boar hides. Gather a hundred anyway, and hold them all at once.',
    category: 'hidden',
    objectives: [{ type: 'collect', itemId: 'boar_hide', count: 100, label: 'Boar hides hoarded' }],
    titleReward: 't_hoarder',
  },
  hid_full_creel: {
    id: 'hid_full_creel',
    name: 'The Full Creel',
    text: 'Every water in the Asphodel gives a different fish. Carry one of each at the same time.',
    category: 'hidden',
    objectives: [
      { type: 'collect', itemId: 'raw_bog_eel', count: 1, label: 'Raw bog eel' },
      { type: 'collect', itemId: 'raw_marsh_pike', count: 1, label: 'Raw marsh pike' },
      { type: 'collect', itemId: 'raw_mirror_trout', count: 1, label: 'Raw mirror trout' },
      { type: 'collect', itemId: 'raw_river_perch', count: 1, label: 'Raw river perch' },
    ],
    titleReward: 't_full_creel',
  },
  hid_bones_of_the_bastion: {
    id: 'hid_bones_of_the_bastion',
    name: 'Bones of the Bastion',
    text: 'The old garrison never stood down. Put every last watchman of it back in the ground.',
    category: 'hidden',
    objectives: [
      {
        type: 'kill',
        targetMobId: 'fallen_captain_aldren',
        count: 1,
        label: 'Fallen Captain Aldren',
      },
      { type: 'kill', targetMobId: 'boneclad_revenant', count: 3, label: 'Boneclad revenants' },
      { type: 'kill', targetMobId: 'bastion_revenant', count: 3, label: 'Bastion revenants' },
    ],
    titleReward: 't_gravequiet',
  },
};

export const TITLES: Record<string, TitleDef> = {
  t_blooded: { id: 't_blooded', display: 'the Blooded' },
  t_greyjaws_bane: { id: 't_greyjaws_bane', display: "Greyjaw's Bane" },
  t_gravecallers_bane: { id: 't_gravecallers_bane', display: "the Gravecaller's Bane" },
  t_fangbinder: { id: 't_fangbinder', display: 'the Fangbinder' },
  t_bonepicker: { id: 't_bonepicker', display: 'the Bonepicker' },
  t_angler: { id: 't_angler', display: 'the Angler' },
  t_chronicler: { id: 't_chronicler', display: 'the Chronicler' },
  t_choir_silencer: { id: 't_choir_silencer', display: 'the Choir-Silencer' },
  t_moonbound: { id: 't_moonbound', display: 'the Moonbound' },
  t_gravewyrms_end: { id: 't_gravewyrms_end', display: "the Gravewyrm's End" },
  t_reliquary_warden: { id: 't_reliquary_warden', display: 'the Reliquary Warden' },
  t_varrics_bane: { id: 't_varrics_bane', display: "Varric's Bane" },
  t_unbroken: { id: 't_unbroken', display: 'the Unbroken' },
  t_flawless_vigil: { id: 't_flawless_vigil', display: 'the Flawless' },
  t_delver: { id: 't_delver', display: 'the Delver' },
  t_rooted: { id: 't_rooted', display: 'the Rooted' },
  t_verdant: { id: 't_verdant', display: 'the Verdant' },
  t_everblooming: { id: 't_everblooming', display: 'the Everblooming' },
  t_moonquenched: { id: 't_moonquenched', display: 'the Moonquenched' },
  t_wyrmsunder: { id: 't_wyrmsunder', display: 'the Wyrmsunder' },
  t_thornpeak_warden: { id: 't_thornpeak_warden', display: 'Warden of Thornpeak' },
  t_hollows_bane: { id: 't_hollows_bane', display: 'Bane of the Hollow' },
  t_wayfarer: { id: 't_wayfarer', display: 'the Wayfarer' },
  t_relentless: { id: 't_relentless', display: 'the Relentless' },
  t_deepwarden: { id: 't_deepwarden', display: 'Warden of the Deep' },
  t_lorebound: { id: 't_lorebound', display: 'the Lorebound' },
  t_pathfinder: { id: 't_pathfinder', display: 'the Pathfinder' },
  t_asphodel_child: { id: 't_asphodel_child', display: 'Child of the Asphodel' },
  t_grand_asphodelian: { id: 't_grand_asphodelian', display: 'the Grand Asphodelian' },
  t_tunnelbane: { id: 't_tunnelbane', display: 'the Tunnelbane' },
  t_silkcutter: { id: 't_silkcutter', display: 'the Silkcutter' },
  t_deacons_doom: { id: 't_deacons_doom', display: "the Deacons' Doom" },
  t_hoarder: { id: 't_hoarder', display: 'the Hoarder' },
  t_full_creel: { id: 't_full_creel', display: 'of the Full Creel' },
  t_gravequiet: { id: 't_gravequiet', display: 'the Gravequiet' },
};
