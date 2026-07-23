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
// same convention as the other categories' wildcard objectives).

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
};
