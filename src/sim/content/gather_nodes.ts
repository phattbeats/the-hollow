// Gatherable world nodes: amber deposits, heartwood stands, spore patches.
// Placed as permanent, unowned world fixtures; visibility only (see PHAA-504
// for harvesting). Adding a new node type or placement should touch only this
// file plus the render prop lookup that draws it (src/render/gather_nodes.ts).
//
// Placed in The Hollow Reaches (the_hollow_reaches), the one wilderness zone
// already reskinned to Plant World (see content/hollow_zone.ts). The
// Eastbrook/Mirefen/Thornpeak zones keep their pre-reskin content until their
// own Phase reskin pass lands, so no new gather content goes there yet.

import type { GatherNodeDef, GatherNodeType } from '../types';

export const GATHER_NODE_TYPES: readonly GatherNodeType[] = ['amber', 'heartwood', 'spore'];

export const GATHER_NODES: GatherNodeDef[] = [
  // The Hollow Reaches, amber deposits in the southern flats past Root Hollow
  { id: 'amber_reaches_1', zoneId: 'the_hollow_reaches', type: 'amber', pos: { x: 92, z: -392 } },
  { id: 'amber_reaches_2', zoneId: 'the_hollow_reaches', type: 'amber', pos: { x: -88, z: -388 } },
  { id: 'amber_reaches_3', zoneId: 'the_hollow_reaches', type: 'amber', pos: { x: 70, z: -398 } },

  // The Hollow Reaches, heartwood stands along the northern tree line
  {
    id: 'heartwood_reaches_1',
    zoneId: 'the_hollow_reaches',
    type: 'heartwood',
    pos: { x: 70, z: -195 },
  },
  {
    id: 'heartwood_reaches_2',
    zoneId: 'the_hollow_reaches',
    type: 'heartwood',
    pos: { x: -70, z: -190 },
  },
  {
    id: 'heartwood_reaches_3',
    zoneId: 'the_hollow_reaches',
    type: 'heartwood',
    pos: { x: 20, z: -198 },
  },

  // The Hollow Reaches, spore patches around Mossbank
  { id: 'spore_reaches_1', zoneId: 'the_hollow_reaches', type: 'spore', pos: { x: 65, z: -230 } },
  { id: 'spore_reaches_2', zoneId: 'the_hollow_reaches', type: 'spore', pos: { x: 66, z: -250 } },
  { id: 'spore_reaches_3', zoneId: 'the_hollow_reaches', type: 'spore', pos: { x: 20, z: -215 } },
];
