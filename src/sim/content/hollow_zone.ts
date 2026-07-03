// The Hollow's outdoor starter zone (PHAA-420, constitution Decision 23). Real
// open-world ground around the shrine gate, built on the same north-running
// terrain strip zone1/zone2/zone3 share (world.ts's terrainHeight) - not the
// portal-instanced pattern the vase hub itself uses (content/hollow.ts). This
// is the ground Homestead v0 (PHAA-417) places plots on.
//
// Geography: prepended south of Eastbrook Vale (this zone's zMax equals
// ZONE1_ZONE.zMin, satisfying the "zones tile the world strip" invariant in
// tests/progression.test.ts), sharing the 'vale' biome palette so no renderer
// biome table needs a new entry (the fork's canopy/root register is a reskin
// pass over the existing look, not a new terrain family). `sealedFrontier`
// closes the mountain pass world.ts would otherwise open at this zone's
// northern boundary, so the inherited, still-neutralized Eastbrook content
// across it stays geographically unreachable on foot - only the vase hub's
// own gate reopens (content/hollow.ts, PHAA-404 partially reversed).

import type { CampDef, NpcDef, QuestDef, ZoneDef, ZonePropsDef } from '../types';

// The overworld side of the shrine gate now lives here instead of inside
// Eastbrook (see content/hollow.ts HOLLOW_HUB_DOOR_POS). It doubles as this
// zone's hub: there is no town, just the clearing the portal opens onto.
export const HOLLOW_ZONE_GATE_POS = { x: 0, z: -290 };
const HOLLOW_ZONE_GRAVEYARD_POS = { x: -12, z: -304 };
const HOLLOW_ZONE_LAKE = { x: 42, z: -235, radius: 16 };

export const HOLLOW_ZONE_ZONE: ZoneDef = {
  id: 'the_hollow_reaches',
  name: 'The Hollow Reaches',
  zMin: -400,
  zMax: -180, // == ZONE1_ZONE.zMin: tiles the strip, sealed at this boundary
  levelRange: [1, 4], // matches the slice's one dungeon, the Under-Shrine
  biome: 'vale',
  hub: {
    x: HOLLOW_ZONE_GATE_POS.x,
    z: HOLLOW_ZONE_GATE_POS.z,
    radius: 22,
    name: 'The Hollow Gate',
  },
  graveyard: HOLLOW_ZONE_GRAVEYARD_POS,
  lakes: [HOLLOW_ZONE_LAKE],
  pois: [
    { x: HOLLOW_ZONE_GATE_POS.x, z: HOLLOW_ZONE_GATE_POS.z, label: 'The Hollow Gate' },
    { x: -46, z: -246, label: 'Fallow Acres' },
    { x: 40, z: -350, label: 'Root Hollow' },
    { x: HOLLOW_ZONE_LAKE.x, z: HOLLOW_ZONE_LAKE.z, label: 'Mossbank' },
  ],
  welcome:
    'The gate opens onto open ground. Fallow Acres, west of the road, looks fit to build on.',
  sealedFrontier: true,
};

// Light wildlife so the ground reads as a real outdoor zone rather than an
// empty staging lot; kept clear of the gate plateau (hub radius 22).
export const HOLLOW_ZONE_CAMPS: CampDef[] = [
  { mobId: 'forest_wolf', center: { x: -46, z: -246 }, radius: 16, count: 4 },
  { mobId: 'wild_boar', center: { x: 40, z: -350 }, radius: 16, count: 4 },
];

// Roads from the gate outward - the "roads connecting the starter zone to the
// vase" the ticket asks for, since the vase itself is reached through the gate.
export const HOLLOW_ZONE_ROADS: { x: number; z: number }[][] = [
  [
    { x: 0, z: -290 },
    { x: -20, z: -270 },
    { x: -46, z: -246 },
  ], // to Fallow Acres
  [
    { x: 0, z: -290 },
    { x: 20, z: -320 },
    { x: 40, z: -350 },
  ], // to Root Hollow
  [
    { x: 0, z: -290 },
    { x: 12, z: -270 },
    { x: 20, z: -255 },
  ], // toward Mossbank, stopping short of the lake basin
];

// Quest-giver pass (board follow-up on PHAA-420): a quest-giver posted at
// each of the starter zone's two wildlife camps, each offering a two-quest
// kill chain against that camp's mob (mirrors content/hollow.ts's
// brother_greenpaw chain). Two quests per NPC rather than one:
// tests/progression.test.ts's xp pacing budget requires this zone's
// quest+kill xp to cover its levelRange [1,4] (2700 xp) with headroom, which
// one quest each falls well short of. Overworld NPC pattern (real world pos,
// no `dynamic` flag) per zone1.ts, not the portal-instanced hub pattern in
// content/hollow.ts.
//
// Board follow-up (PHAA-420 reopen): both are drawn from the constitution's
// cast (docs/plan-the-hollow.md §4), not invented names. Verger Zebediah is
// the constitution's "straight man," the grey heron; Sexton Faddick is its
// badger, "not hub-bound, wanders across the zones." Both already have
// hero-quality GLBs from the PHAA-413/414 prophet-cast pass (see
// src/render/characters/manifest.ts npc_zebediah/npc_faddick), unused until
// now.
export const HOLLOW_ZONE_NPCS: Record<string, NpcDef> = {
  verger_zebediah: {
    id: 'verger_zebediah',
    name: 'Verger Zebediah',
    title: 'Warden of Root Hollow',
    pos: { x: 34, z: -334 },
    facing: 0.6,
    color: 0x3f5233,
    questIds: ['q_root_hollow_boars', 'q_root_hollow_boars_ii'],
    greeting:
      "Root Hollow's overrun with boar this season, tearing up the roots after grubs. Mind the loose dirt unless you mean to fight them.",
  },
  sexton_faddick: {
    id: 'sexton_faddick',
    name: 'Sexton Faddick',
    title: 'The Wandering Keeper',
    pos: { x: -34, z: -238 },
    facing: -1.0,
    color: 0x5b4636,
    questIds: ['q_fallow_acres_wolves', 'q_fallow_acres_wolves_ii'],
    greeting:
      "Good ground, this, I pass through more than I stay. Can't build a thing with wolves circling the flock every night, though.",
  },
};

export const HOLLOW_ZONE_QUESTS: Record<string, QuestDef> = {
  q_root_hollow_boars: {
    id: 'q_root_hollow_boars',
    name: "Root Hollow's Boars",
    giverNpcId: 'verger_zebediah',
    turnInNpcId: 'verger_zebediah',
    text: "Boars have dug up half of Root Hollow chasing grubs, and they don't scare easy anymore. Cull five and the roots might get a season's rest.",
    completionText:
      "Five less snouts in the dirt. Root Hollow thanks you, even if it can't say so.",
    objectives: [{ type: 'kill', targetMobId: 'wild_boar', count: 5, label: 'Wild Boar slain' }],
    xpReward: 150,
    copperReward: 50,
    itemRewards: {},
    minLevel: 1,
  },
  q_root_hollow_boars_ii: {
    id: 'q_root_hollow_boars_ii',
    name: "Root Hollow's Reckoning",
    giverNpcId: 'verger_zebediah',
    turnInNpcId: 'verger_zebediah',
    requiresQuest: 'q_root_hollow_boars',
    text: 'Five was a start, but more keep pushing up from the lower dens. Finish it: eight more and Root Hollow gets its rest.',
    completionText: "That's the last of the diggers, or near enough. The roots can breathe.",
    objectives: [{ type: 'kill', targetMobId: 'wild_boar', count: 8, label: 'Wild Boar slain' }],
    xpReward: 300,
    copperReward: 100,
    itemRewards: {},
    minLevel: 1,
  },
  q_fallow_acres_wolves: {
    id: 'q_fallow_acres_wolves',
    name: 'Wolves Off the Furrows',
    giverNpcId: 'sexton_faddick',
    turnInNpcId: 'sexton_faddick',
    text: "Can't hold a plot with wolves circling every night. Thin the pack at Fallow Acres and I'll make it worth the walk.",
    completionText: "That's a few nights' sleep, right there. Preciate it.",
    objectives: [
      { type: 'kill', targetMobId: 'forest_wolf', count: 5, label: 'Forest Wolf slain' },
    ],
    xpReward: 150,
    copperReward: 50,
    itemRewards: {},
    minLevel: 1,
  },
  q_fallow_acres_wolves_ii: {
    id: 'q_fallow_acres_wolves_ii',
    name: 'The Last of the Pack',
    giverNpcId: 'sexton_faddick',
    turnInNpcId: 'sexton_faddick',
    requiresQuest: 'q_fallow_acres_wolves',
    text: "Thinned the edges, but the den's still full. Eight more and Fallow Acres might get a quiet night.",
    completionText: 'Quiet at last. Reckon I can start on those fences now.',
    objectives: [
      { type: 'kill', targetMobId: 'forest_wolf', count: 8, label: 'Forest Wolf slain' },
    ],
    xpReward: 300,
    copperReward: 100,
    itemRewards: {},
    minLevel: 1,
  },
};

export const HOLLOW_ZONE_QUEST_ORDER: string[] = [
  'q_root_hollow_boars',
  'q_root_hollow_boars_ii',
  'q_fallow_acres_wolves',
  'q_fallow_acres_wolves_ii',
];

// Hand-placed landmarks (creativity pass, board follow-up on PHAA-420): a
// well marking Sexton Faddick's plot and a campfire at Verger Zebediah's
// post. The Fallow Acres fence frames a small kept garden, not the open
// build clearing itself, so it stays out of the way of the ground
// Homestead v0 plots want.
export const HOLLOW_ZONE_PROPS: ZonePropsDef = {
  buildings: [],
  wells: [{ x: -40, z: -250, r: 1.4 }],
  stalls: [],
  mines: [],
  docks: [],
  tents: [],
  crates: [],
  campfires: [[36, -336]],
  mudHuts: [],
  ruinRings: [],
  fences: [
    { x1: -52, z1: -254, x2: -40, z2: -254 },
    { x1: -52, z1: -254, x2: -52, z2: -242 },
  ],
  graveyards: [],
};
