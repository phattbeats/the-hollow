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
// empty staging lot; kept clear of the gate plateau (hub radius 22). Board
// follow-up on PHAA-420 (reopen): each mob now spawns from two smaller,
// separated sub-camps instead of one radius-16 blob, so a look across either
// area reads as spread wildlife rather than a single cluster. The Fallow
// Acres pair stays inside HOLLOW_HOMESTEAD_AREA's carve-out box (feature/
// homestead-v0, PR #33, still unmerged): kept at radius 10 (down from the
// original 16) so the combined exclusion footprint for future plot placement
// doesn't grow past what one radius-16 camp already reserved.
export const HOLLOW_ZONE_CAMPS: CampDef[] = [
  { mobId: 'forest_wolf', center: { x: -46, z: -246 }, radius: 12, count: 3 },
  { mobId: 'forest_wolf', center: { x: -64, z: -222 }, radius: 10, count: 2 },
  { mobId: 'wild_boar', center: { x: 40, z: -350 }, radius: 12, count: 3 },
  { mobId: 'wild_boar', center: { x: 56, z: -374 }, radius: 12, count: 2 },
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
      'Verger Zebediah. I keep the Reaches to a calendar, or I keep trying. Root Hollow was marked to rest this season, and the boars did not read the notice. Mind the loose dirt, and do not touch the register.',
    // Ambient idle walk (board follow-up on PHAA-420: "some walking around"),
    // see src/sim/npc_wander.ts. Small radius on purpose: he stays findable at
    // his posted warden's station rather than roaming off it.
    wanderRadius: 4,
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
      'Faddick. Sexton, where there is still a shrine to sexton. I do not stay anywhere; I keep. Wolves have circled the flock at Fallow Acres every night, and a thing that circles long enough learns the shape of what it circles. Best it stays a flock.',
    wanderRadius: 4,
  },
};

export const HOLLOW_ZONE_QUESTS: Record<string, QuestDef> = {
  q_root_hollow_boars: {
    id: 'q_root_hollow_boars',
    name: "Root Hollow's Boars",
    giverNpcId: 'verger_zebediah',
    turnInNpcId: 'verger_zebediah',
    text: 'By the calendar, Root Hollow rests this season. The boars have not been informed. They have rooted up half of it chasing grubs, and they no longer scatter when a heron flaps at them, which I take personally. Cull five, and I can enter the season as observed.',
    completionText:
      'Five. Counted, dated, and entered in the register. Root Hollow is now only a fortnight behind its own season, which in this office we call a triumph. My thanks, on behalf of an order that is, at present, me.',
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
    text: 'I will admit what the office discourages admitting: five was optimistic. The lower dens keep pushing up more. Eight further, and I can close the season without amending the record a third time. The record resents amendment. So do I.',
    completionText:
      'Closed. Signed. Filed. The season may proceed exactly as scheduled, now that there is once more someone to keep the schedule. You have been a great help to a very small congregation. The congregation, I should clarify, is me.',
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
    text: 'Someone means to build at Fallow Acres. Good. Ground with people on it remembers better than ground without, and this stretch has forgotten a great deal. But nothing settles with wolves working the dark. Thin the pack to five, and I will see the walk repaid. Repaying is most of what I am still for.',
    completionText:
      'Quieter. Good. I have stood in a great many quiet places that were once loud with a whole people; this one has a chance to go the other way. My thanks, and mind how you go.',
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
    text: 'The edges are thinner, the den is not. Eight more, and Fallow Acres can hold a roof without losing what sleeps under it in the night. I would tend to it myself, but I am rarely anywhere twice, and the ground below the shrine wants keeping more than these furrows do.',
    completionText:
      'There. A quiet night, and perhaps a hundred behind it. Build well. And if you ever dig deep enough to hear something down there keeping slow time, do not answer it. That part is mine to keep; I carry the key for it. Go on, now.',
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
//
// Second pass (board follow-up: "both of their areas need to feel more
// lived in... more decor"): a bedroll tent and supply crates at each post,
// a second Root Hollow fire so Zebediah's warden's station reads as an
// established outpost rather than one lonely flame, and the Fallow Acres
// garden fence closed into a real perimeter (with a gap left for a gate)
// instead of the original two open sides. Kept close to each NPC's existing
// post and outside their wanderRadius circle (npc_wander.ts) so nothing new
// clips them mid-patrol.
export const HOLLOW_ZONE_PROPS: ZonePropsDef = {
  buildings: [],
  wells: [{ x: -40, z: -250, r: 1.4 }],
  stalls: [],
  mines: [],
  docks: [],
  tents: [{ x: -44, z: -243, rot: 2.1, scale: 1 }],
  crates: [
    [-36, -247], // Faddick's supply stash, Fallow Acres
    [30, -328], // Zebediah's ledger crates, Root Hollow
  ],
  campfires: [
    [36, -336],
    [30, -343], // second Root Hollow fire
  ],
  mudHuts: [],
  ruinRings: [],
  fences: [
    { x1: -52, z1: -254, x2: -40, z2: -254 },
    { x1: -52, z1: -254, x2: -52, z2: -242 },
    { x1: -40, z1: -254, x2: -40, z2: -242 },
    { x1: -52, z1: -242, x2: -46, z2: -242 }, // bottom side, gap left for a gate
    { x1: -42, z1: -242, x2: -40, z2: -242 },
  ],
  graveyards: [],
};
// Homestead v0 (PHAA-417) buildable ground: Fallow Acres, west of the road to
// it (this zone's welcome hint above), the stretch the terrain pass was built
// for. A bounding box rather than the whole zone, so placement stays a
// curated stretch rather than "anywhere in the strip"; sim/homestead.ts's
// per-point collision-avoidance additionally carves the Fallow Acres wolf
// camp (HOLLOW_ZONE_CAMPS), the gate, the lake, the graveyard, and the roads
// out of it, plus keeps homesteads a minimum distance apart from each other.
export const HOLLOW_HOMESTEAD_AREA = { xMin: -95, xMax: -25, zMin: -274, zMax: -214 };
