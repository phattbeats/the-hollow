// Book of Asphodelia content tables (PHAA-744 engine/wire layer; PHAA-745 fills
// these in, category by category). Every deed/title name and text is a t() key
// resolved through src/ui/entity_i18n.ts ('deed'/'title' kinds); the strings
// below are the canonical English source, matched against real MOBS/ITEMS ids
// by the deeds_content integrity test.
//
// Landed so far: combat (kill-based only - deeds needing new trigger types,
// e.g. crit-hit or damage-dealt counters, wait on their own engine hook per
// the ticket's category-by-category sequencing).

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
};

export const TITLES: Record<string, TitleDef> = {
  t_blooded: { id: 't_blooded', display: 'the Blooded' },
  t_greyjaws_bane: { id: 't_greyjaws_bane', display: "Greyjaw's Bane" },
  t_gravecallers_bane: { id: 't_gravecallers_bane', display: "the Gravecaller's Bane" },
};
