// Book of Asphodelia content tables (PHAA-744 engine/wire layer; PHAA-745 fills
// these in, category by category). Every deed/title name and text is a t() key
// resolved through src/ui/entity_i18n.ts ('deed'/'title' kinds); the strings
// below are the canonical English source, matched against real MOBS/ITEMS ids
// by the deeds_content integrity test.
//
// Landed so far: combat (kill-based only - deeds needing new trigger types,
// e.g. crit-hit or damage-dealt counters, wait on their own engine hook per
// the ticket's category-by-category sequencing) and collection (collect-based
// only, driven by the inventory-holding hook PHAA-744 shipped: credit is the
// count currently held, so a deed completes once the player holds the full set
// at once, and stays done thereafter). Collection deeds add no engine hook.

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
};

export const TITLES: Record<string, TitleDef> = {
  t_blooded: { id: 't_blooded', display: 'the Blooded' },
  t_greyjaws_bane: { id: 't_greyjaws_bane', display: "Greyjaw's Bane" },
  t_gravecallers_bane: { id: 't_gravecallers_bane', display: "the Gravecaller's Bane" },
  t_fangbinder: { id: 't_fangbinder', display: 'the Fangbinder' },
  t_bonepicker: { id: 't_bonepicker', display: 'the Bonepicker' },
  t_angler: { id: 't_angler', display: 'the Angler' },
};
