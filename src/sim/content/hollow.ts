// THE HOLLOW — the home zone. The shrine of the Plant, the vase at its heart,
// and the under-shrine cave beneath it.
//
// Built on the temple.ts pattern (a self-contained zone module, merged into
// the flat engine tables by sim/data.ts) per the constitution, Decision 19: the
// slice's hub is portal-instanced; nothing here touches the inherited
// storyline. Slice scope (§11): the vase, Greenpaw, the first run, one
// dungeon. Levels 1-4: this is where a character begins.
//
// VOICE RULE (§5, non-negotiable): Greenpaw's lines are all-lowercase,
// run-on, trailing "...", cowboy-fatalist, sincere. The Plant does not speak
// in this file — quest text is where the world's voice lives; the god is
// rationed and arrives in Phase 2 as the LLM layer.

import type {
  CampDef,
  DungeonDef,
  DungeonSpawn,
  GroundObjectDef,
  ItemDef,
  MobTemplate,
  NpcDef,
  PlayerClass,
  QuestDef,
  ZonePropsDef,
} from '../types';

// Where the portal from the base world opens onto the shrine clearing.
// Coordinates are hub-local; the zone is its own instanced space.
export const HOLLOW_GATE_POS = { x: 0, z: -40 };

// The vase. Not an NPC in the slice — it is the center of gravity as an
// object; the live god (Phase 2) attaches here.
export const VASE_POS = { x: 0, z: 0 };

// Every class gets the same cutting; the record shape is the engine's
// per-class reward archetype, used here degenerately on purpose.
const ALL_CLASSES: PlayerClass[] = [
  'warrior', 'paladin', 'hunter', 'rogue', 'priest',
  'shaman', 'mage', 'warlock', 'druid',
];
const CUTTING_FOR_ALL = Object.fromEntries(
  ALL_CLASSES.map((c) => [c, 'first_cutting']),
) as Partial<Record<PlayerClass, string>>;

// ---------------------------------------------------------------------------
// Mobs — the under-shrine cave (the only combat in the slice)
// ---------------------------------------------------------------------------

export const HOLLOW_MOBS: Record<string, MobTemplate> = {
  // The light-hating enemy: the buried memory's reach (§4). Tuned soft —
  // a level 1-3 first descent.
  palefeeder: {
    id: 'palefeeder',
    name: 'Palefeeder',
    minLevel: 1,
    maxLevel: 2,
    family: 'spider',
    hpBase: 28,
    hpPerLevel: 9,
    dmgBase: 3,
    dmgPerLevel: 1.2,
    attackSpeed: 2.0,
    armorPerLevel: 4,
    moveSpeed: 8,
    aggroRadius: 9, // they come at your light, not at you
    loot: [
      { copper: 8, chance: 1 },
      { itemId: 'emberbulb', chance: 0.5, questId: 'q_what_burns' },
    ],
    scale: 0.9,
    color: 0xcfd8cf, // pale, root-blanched
  },
  rootmaw: {
    id: 'rootmaw',
    name: 'Rootmaw',
    minLevel: 2,
    maxLevel: 3,
    family: 'beast',
    hpBase: 40,
    hpPerLevel: 12,
    dmgBase: 4,
    dmgPerLevel: 1.5,
    attackSpeed: 2.2,
    armorPerLevel: 6,
    moveSpeed: 9,
    aggroRadius: 8,
    loot: [
      { copper: 14, chance: 1 },
      { itemId: 'cave_morsel', chance: 0.6, questId: 'q_what_fills' },
    ],
    scale: 1.1,
    color: 0x6b5d4f,
  },
  // The cave's terminal presence. The Phase 3 furnace fight lands here; the
  // stub gives the dungeon a far room with weight in it now.
  the_witness_root: {
    id: 'the_witness_root',
    name: 'The Witness-Root',
    minLevel: 4,
    maxLevel: 4,
    family: 'elemental',
    hpBase: 220,
    hpPerLevel: 0,
    dmgBase: 7,
    dmgPerLevel: 0,
    attackSpeed: 2.4,
    armorPerLevel: 10,
    moveSpeed: 6,
    aggroRadius: 12,
    loot: [{ copper: 120, chance: 1 }],
    scale: 1.6,
    color: 0x39412f,
  },
};

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

export const HOLLOW_NPCS: Record<string, NpcDef> = {
  brother_greenpaw: {
    id: 'brother_greenpaw',
    name: 'Brother Greenpaw',
    title: 'First Prophet (self-appointed)',
    pos: { x: 3, z: 4 }, // at the foot of the vase, where he always is
    facing: -0.6,
    color: 0x4a5d3a,
    questIds: ['q_what_burns', 'q_what_fills'],
    greeting:
      "howdy, traveler. you catch the vase in a mood today, or is that just me again... c'mere, got a couple sacred matters need tendin'. mostly snacks. same thing, to a greenpaw degree.",
  },
};

// ---------------------------------------------------------------------------
// Quests — the first run (§11): the thing that burns and the thing that fills
// ---------------------------------------------------------------------------

export const HOLLOW_QUESTS: Record<string, QuestDef> = {
  q_what_burns: {
    id: 'q_what_burns',
    name: 'The Thing That Burns',
    giverNpcId: 'brother_greenpaw',
    turnInNpcId: 'brother_greenpaw',
    text:
      "the communion's gone thin, friend... i'm bone dry and the wavelength is closin'. down under the shrine there's a bulb that burns slow and clean — emberbulb, grows where the light don't reach, which is a joke the cave plays on itself... bring me five. mind the pale ones. they come at your lantern, not at you. mostly.",
    completionText:
      "now THAT'S the good smoke... you feel that? room's gettin' thick. she's gonna lean in any minute now, i can feel it on the wavelength... indeed.",
    objectives: [
      { type: 'collect', itemId: 'emberbulb', count: 5, label: 'Emberbulb gathered' },
    ],
    xpReward: 90,
    copperReward: 60,
    itemRewards: {},
  },
  q_what_fills: {
    id: 'q_what_fills',
    name: 'The Thing That Fills',
    giverNpcId: 'brother_greenpaw',
    turnInNpcId: 'brother_greenpaw',
    text:
      "second matter, and i'd call it sacred but between us it's breakfast... the rootmaws down there carry a morsel on 'em, cave-fed, real earthy. four'll do. bring 'em back 'fore the stomach starts singin' hymns of its own...",
    completionText:
      "you're a saint of the first order, friend. or a good neighbor. same thing, to a greenpaw degree. ...here. was gonna keep this one but the inner cowboy says it's yours. don't let it wilt.",
    objectives: [
      { type: 'collect', itemId: 'cave_morsel', count: 4, label: 'Cave Morsel gathered' },
    ],
    xpReward: 90,
    copperReward: 60,
    itemRewards: CUTTING_FOR_ALL, // Greenpaw hands you your first cutting (§4, §11)
    requiresQuest: 'q_what_burns',
  },
};

export const HOLLOW_QUEST_ORDER = ['q_what_burns', 'q_what_fills'];

// ---------------------------------------------------------------------------
// World dressing
// ---------------------------------------------------------------------------

// No hostile camps in the hub. The Hollow's surface is floor (§3): nothing
// here can hurt you. Combat lives below.
export const HOLLOW_CAMPS: CampDef[] = [];

export const HOLLOW_OBJECTS: GroundObjectDef[] = [];

export const HOLLOW_PROPS: ZonePropsDef = {
  // Phase 1 art pass fills this: shrine clearing, warm root-and-soil palette.
  // The cold firepit by the vase is the furnace's future footprint (§4) —
  // present from day one so its later lighting reads as the world changing.
  buildings: [],
  wells: [],
  stalls: [],
  mines: [],
  docks: [],
  tents: [],
  crates: [],
  campfires: [[-4, 2]],
  mudHuts: [],
  ruinRings: [],
  fences: [],
  graveyards: [],
};

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const HOLLOW_ITEMS: Record<string, ItemDef> = {
  emberbulb: {
    id: 'emberbulb',
    name: 'Emberbulb',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_what_burns',
  },
  cave_morsel: {
    id: 'cave_morsel',
    name: 'Cave Morsel',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_what_fills',
  },
  first_cutting: {
    id: 'first_cutting',
    name: 'A Cutting',
    kind: 'quest',
    sellValue: 0, // it is alive; it is not for sale
    questId: 'q_what_fills',
  },
};

// ---------------------------------------------------------------------------
// The under-shrine cave (the slice's one dungeon, §11)
// ---------------------------------------------------------------------------

// Phase 3 fills the real rooms and the furnace mechanic; the skeleton gives
// the descent a first chamber, a deep chamber, and something waiting.
const UNDER_SHRINE_SPAWNS: DungeonSpawn[] = [
  { mobId: 'palefeeder', x: -4, z: 14 },
  { mobId: 'palefeeder', x: 5, z: 18 },
  { mobId: 'palefeeder', x: -2, z: 26 },
  { mobId: 'rootmaw', x: 3, z: 34 },
  { mobId: 'rootmaw', x: -5, z: 40 },
  { mobId: 'palefeeder', x: 0, z: 48 },
  { mobId: 'rootmaw', x: 4, z: 55 },
  { mobId: 'the_witness_root', x: 0, z: 70 },
];

export const HOLLOW_DUNGEON_DEFS: Record<string, DungeonDef> = {
  under_shrine: {
    id: 'under_shrine',
    name: 'The Under-Shrine',
    index: 5, // next free instance x-band (0-4 taken by base dungeons)
    doorPos: { x: 0, z: 28 }, // the cave mouth, downhill of the vase
    entry: { x: 0, z: 4 },
    exitOffset: { x: 0, z: -6 },
    spawns: UNDER_SHRINE_SPAWNS,
    // Deliberate: the 'crypt' interior builder is the Hollow Crypt's own
    // skeleton — sealed doors, keystones, buried-and-walled grammar — reused
    // per the constitution (§4, the Hollow Crypt reuse) and rethemed root-cold
    interior: 'crypt',
    suggestedPlayers: 5,
    enterText:
      'You descend below the shrine. The air goes still and close, and the dark ahead does not feel empty.',
    leaveText: 'You climb back into the warm. Above you, faintly, smoke.',
  },
};
