// THE HOLLOW: the home zone. The shrine of the Plant, the vase at its heart,
// and the under-shrine cave beneath it.
//
// Built on the temple.ts pattern (a self-contained zone module, merged into
// the flat engine tables by sim/data.ts) per the constitution, Decision 19: the
// slice's hub is portal-instanced; nothing here touches the inherited
// storyline. Slice scope (§11): the vase, Greenpaw, the first run, one
// dungeon. Levels 1-4: this is where a character begins.
//
// Decision 23 (PHAA-420) partially reverses Decision 19: the hub keeps its
// portal-instanced interior, but it is no longer sealed. The overworld gate
// now opens onto a real zone (content/hollow_zone.ts) instead of Eastbrook,
// so the door and the exit portal work both ways again.
//
// VOICE RULE (§5, non-negotiable): Greenpaw's lines are all-lowercase,
// run-on, trailing "...", cowboy-fatalist, sincere. The Plant does not speak
// in this file; quest text is where the world's voice lives; the god is
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
import { HOLLOW_ZONE_GATE_POS } from './hollow_zone';

// Where the portal from the base world opens onto the shrine clearing.
// Coordinates are hub-local; the zone is its own instanced space. Must stay
// INSIDE the temple room floor (TEMPLE_LAYOUT zMin -19, dungeon_layout.ts):
// the old value (0, -40) parked arrivals and the exit portal in the void
// south of the front wall. The arrival spot sits between the gate-approach
// lantern posts (render/hollow_props.ts, z -17.5), facing the vase.
export const HOLLOW_GATE_POS = { x: 0, z: -10 };

// The overworld side of the portal: the shrine gate at the heart of the
// Hollow Reaches (content/hollow_zone.ts), the open-world zone Decision 23
// grows around it. This is the base-world doorPos a player interacts with to
// step into the Hollow hub, exactly as MOONGATE_POS is the overworld doorPos
// for the Drowned Temple (temple.ts). Pre-PHAA-420 this sat inside Eastbrook
// (-6, -22); it moved so leaving the hub no longer surfaces the inherited,
// still-neutralized base town.
export const HOLLOW_HUB_DOOR_POS = { ...HOLLOW_ZONE_GATE_POS };

// The vase. Not an NPC in the slice; it is the center of gravity as an
// object; the live god (Phase 2) attaches here.
export const VASE_POS = { x: 0, z: 0 };

// Where new characters land and where the dead return (constitution §7:
// "create a character, land at the vase"; dying is "a teleport back to the
// vase, never items"). A step south of the vase itself, facing it.
export const VASE_LANDING_POS = { x: 0, z: -6 };

// Every class gets the same cutting; the record shape is the engine's
// per-class reward archetype, used here degenerately on purpose.
const ALL_CLASSES: PlayerClass[] = [
  'warrior',
  'paladin',
  'hunter',
  'rogue',
  'priest',
  'shaman',
  'mage',
  'warlock',
  'druid',
];
const CUTTING_FOR_ALL = Object.fromEntries(ALL_CLASSES.map((c) => [c, 'first_cutting'])) as Partial<
  Record<PlayerClass, string>
>;

// ---------------------------------------------------------------------------
// Mobs: the under-shrine cave (the only combat in the slice)
// ---------------------------------------------------------------------------

export const HOLLOW_MOBS: Record<string, MobTemplate> = {
  // The light-hating enemy: the buried memory's reach (§4). Tuned soft,
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
    // PHAA-433: 15s respawn (0.6 of the 25s default) so the first-run farm loop
    // stays fed for a solo gatherer. Faster than open-world trash on purpose:
    // this is the guided first descent, and palefeeder/rootmaw live only in the
    // Under-Shrine, so the shorter timer is scoped to that room.
    respawnMult: 0.6,
    loot: [
      { copper: 8, chance: 1 },
      { itemId: 'emberbulb', chance: 0.5, questId: 'q_what_burns' },
      // PHAA-421: an unconditional (non-quest-gated) drop line so emberbulb
      // stays farmable for Greenpaw's renewable feeding loop after the
      // one-time q_what_burns quest is done (a questId-scoped entry only
      // rolls while that quest is active and incomplete, loot/loot_roll.ts
      // needsQuestDrop). Lower chance than the quest line: this is the
      // long-tail resupply rate, not the guided first descent.
      { itemId: 'emberbulb', chance: 0.3 },
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
    respawnMult: 0.6, // PHAA-433: 15s respawn, matching palefeeder (see note above)
    loot: [
      { copper: 14, chance: 1 },
      { itemId: 'cave_morsel', chance: 0.6, questId: 'q_what_fills' },
      // PHAA-421: same unconditional resupply line as emberbulb above, for
      // Greenpaw's renewable feeding loop after q_what_fills is done.
      { itemId: 'cave_morsel', chance: 0.35 },
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
    // PHAA-433: the boss meaningfully closes the first run's item gap on its
    // own, not just adds one more shot at the pile. Same quest-gated pattern
    // as palefeeder/rootmaw above (two independent rolls per item instead of
    // a bigger single chance, so it stays a Rng.chance draw per line, never a
    // guaranteed multi-count drop the engine has no field for), plus a real
    // classic-style chance at a themed rare (src/sim/types.ts quality ladder;
    // odds in line with this game's other early rare-tier boss drops, e.g.
    // zone1.ts's grix_tunnelking_chase rollGroup).
    loot: [
      { copper: 120, chance: 1 },
      { itemId: 'emberbulb', chance: 0.9, questId: 'q_what_burns' },
      { itemId: 'emberbulb', chance: 0.6, questId: 'q_what_burns' },
      { itemId: 'cave_morsel', chance: 0.9, questId: 'q_what_fills' },
      { itemId: 'cave_morsel', chance: 0.6, questId: 'q_what_fills' },
      { itemId: 'witness_root_cincture', chance: 0.15 },
    ],
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
    // Hub-local, at the foot of the vase, where he always is. He lives INSIDE
    // the portal-instanced hub: `dynamic` keeps the overworld spawn loop from
    // placing him at world (3, 4); the_hollow's `npcs` entry below spawns him
    // per instance slot.
    pos: { x: 3, z: 4 },
    dynamic: true,
    facing: -0.6,
    color: 0x4a5d3a,
    questIds: ['q_what_burns', 'q_what_fills'],
    hearth: true,
    // Greeting is the line rendered every time the player opens Greenpaw's
    // gossip dialog after the intro has played, so it must read as
    // already-met voice rather than first-meeting voice (PHAA-432 follow-up,
    // Brandon feedback on PR #82). The intro itself carries the meet-and-greet
    // beats; the greeting assumes shared context and leads straight back to
    // the errand queue.
    greeting:
      "you're back, that's a blessin'... the vase has been sighin' all mornin', got a couple sacred matters queued up, same wavelength as last time. c'mere a minute...",
    // First-meeting click-through intro (PHAA-432): three beats in-voice
    // (all-lowercase, run-on, trailing "...", cowboy-fatalist, sincere) that
    // carry the "remnants of a once great tribe" throughline before the errand.
    // Kept identical in src/ui/i18n.catalog/hollow.ts (the English source the
    // resolver reads); the sim record stays language-agnostic.
    introLines: [
      "uhh... hi. hi. didn't hear you come up, i was someplace else, someplace green... you got the just-woke-up look, friend. i know it well, i wear it most days...",
      "name's greenpaw. brother greenpaw, first prophet, self-appointed, which the vase'll tell you means exactly nothin', and he's not wrong, but somebody's gotta tend him...",
      "this here's the hollow. was a whole tribe once, big doings, so they tell me, and now it's mostly me, the vase, and whatever's breathin' down in that cave... anyway. he's hungry, i'm hungry, same wavelength. c'mere, got a couple sacred matters need tendin'.",
    ],
  },
  // GW1 build system multiclassing (Phase 3, PHAA-464): teaches every profession
  // as a secondary class. Hub-local, mirrored across the vase from Greenpaw;
  // `dynamic` for the same reason as brother_greenpaw above.
  elder_yarrow: {
    id: 'elder_yarrow',
    name: 'Elder Yarrow',
    title: 'Profession Trainer',
    pos: { x: -3, z: 4 },
    dynamic: true,
    facing: 0.6,
    color: 0x8a9a5b,
    questIds: [],
    trainer: { professions: ALL_CLASSES },
    greeting: 'Every build starts as a question. Which second calling speaks to you?',
  },
};

// ---------------------------------------------------------------------------
// Quests: the first run (§11): the thing that burns and the thing that fills
// ---------------------------------------------------------------------------

export const HOLLOW_QUESTS: Record<string, QuestDef> = {
  q_what_burns: {
    id: 'q_what_burns',
    name: 'The Thing That Burns',
    giverNpcId: 'brother_greenpaw',
    turnInNpcId: 'brother_greenpaw',
    text: "the communion's gone thin, friend... i'm bone dry and the wavelength is closin'. down under the shrine there's a bulb that burns slow and clean - emberbulb, grows where the light don't reach, which is a joke the cave plays on itself... bring me five. mind the pale ones. they come at your lantern, not at you. mostly.",
    completionText:
      "now THAT'S the good smoke... you feel that? room's gettin' thick. he's gonna lean in any minute now, i can feel it on the wavelength... indeed.",
    objectives: [{ type: 'collect', itemId: 'emberbulb', count: 5, label: 'Emberbulb gathered' }],
    xpReward: 90,
    copperReward: 60,
    itemRewards: {},
  },
  q_what_fills: {
    id: 'q_what_fills',
    name: 'The Thing That Fills',
    giverNpcId: 'brother_greenpaw',
    turnInNpcId: 'brother_greenpaw',
    text: "second matter, and i'd call it sacred but between us it's breakfast... the rootmaws down there carry a morsel on 'em, cave-fed, real earthy. four'll do. bring 'em back 'fore the stomach starts singin' hymns of its own...",
    completionText:
      "you're a saint of the first order, friend. or a good neighbor. same thing, to a greenpaw degree. ...here. was gonna keep this one but the inner cowboy says it's yours. don't let it wilt.",
    objectives: [
      { type: 'collect', itemId: 'cave_morsel', count: 4, label: 'Cave Morsel gathered' },
    ],
    xpReward: 90,
    copperReward: 60,
    itemRewards: CUTTING_FOR_ALL, // Greenpaw hands you your first cutting (§4, §11)
    requiresQuest: 'q_what_burns',
    // PHAA-471: his last request is a second descent, and the player gets a say.
    // `complain`/`refuse` are the PLAYER's lines; the replies are Greenpaw's.
    // Refusing completes the quest as normal (rewards included: he hands over
    // the cutting anyway), the first hint that the player can push back on this
    // world. Kept identical in src/ui/i18n.catalog/hollow.ts (the English source
    // the resolver reads); the sim record stays language-agnostic.
    offerDialog: {
      complain: 'I was just down there. You watched me climb out of the hole.',
      complainReply:
        "i know it, friend, i know... the vase don't keep a calendar and neither does my stomach. but look at them boots and tell me they don't got one more descent in 'em... no rush. the hole ain't goin' anywhere. that's kinda its whole deal...",
      refuse: "No. I'm not going back down there.",
      refuseReply:
        "oh... oh, okay. ...okay. that's... yeah. no, that's fair, friend, that's fair... the vase heard it too, and between you and me i think he respects it. here, take the cutting anyway. you went down once, and that's once more than most...",
    },
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

// Hub dressing (PHAA-402 art pass, first slice). Coordinates are HUB-LOCAL
// (the hub is portal-instanced); render/hollow_props.ts places these inside
// the instance offset by the hub's origin. Render-only: HOLLOW_PROPS is
// deliberately excluded from the overworld PROPS merge and the collider grid
// (see sim/data.ts), so nothing here may imply cover or blocking.
// Kept clear of the landmarks: the vase (0,0), Greenpaw (3,4), the cold
// firepit (-4,2), the cave mouth (0,28), the gate (0,-40), the sanctum
// pillars (|x|=14 at z 80/95/110), the dais (0,116, r 10.5), and the eight
// house plots (x=+-9, z=74/84/94/104). The room itself spans TEMPLE_LAYOUT
// (|x|<23, z -19..132).
export const HOLLOW_PROPS: ZonePropsDef = {
  // The cold firepit by the vase is the furnace's future footprint (§4),
  // present from day one so its later lighting reads as the world changing.
  buildings: [],
  wells: [],
  stalls: [],
  mines: [],
  docks: [],
  tents: [],
  crates: [
    // greenpaw's supply drop, off the path east of the vase
    [7.5, 8],
    [8.6, 8.8],
    [8.1, 6.7],
    // stores by the south colonnade, flanking the walk up from the gate
    [-11, -12],
    [11.5, -10],
    // a pallet by the cave mouth, waiting to go down
    [5.5, 26],
  ],
  campfires: [[-4, 2]],
  mudHuts: [],
  ruinRings: [
    // the old shrine ring the vase sits inside: broken columns, half-swallowed
    { x: 0, z: 2, ringR: 7.5, columns: 6 },
    // a collapsed twin ring in the north-east corner of the clearing
    { x: 16, z: 46, ringR: 4, columns: 4 },
  ],
  fences: [
    // the garden croft west of the firepit (future plantable beds)
    { x1: -13, z1: 6, x2: -8, z2: 6 },
    { x1: -13, z1: 6, x2: -13, z2: 14 },
    { x1: -13, z1: 14, x2: -8, z2: 14 },
    // a rail guiding the walk from the gate toward the vase
    { x1: -5, z1: -16, x2: -5, z2: -8 },
    { x1: 5, z1: -16, x2: 5, z2: -8 },
  ],
  graveyards: [],
};

// Living flora dressing (PHAA-415 greener pass). Hub-local coordinates,
// render-only exactly like HOLLOW_PROPS above: render/hollow_props.ts draws
// each record procedurally or from the foliage GLB kit; nothing here is
// merged into static geometry or the collider grid. Every record carries an
// explicit growth `stage`; this whole table is stage 0 ("overgrown and
// neglected"). The Phase 2 stage swap replaces stage-0 records wholesale
// (or adds stage-1+ rows) without touching the renderer.

export type HollowFloraKind =
  | 'fern' // ground fern (foliage kit GLB)
  | 'bush' // leafy shrub (foliage kit GLB)
  | 'bush_flowers' // flowering shrub (foliage kit GLB)
  | 'undergrowth' // low procedural moss-and-leaf clump
  | 'glow_flower' // procedural glowing flora accent (emissive, no light)
  | 'vine_wall'; // procedural vine strands climbing a wall face

export interface HollowFloraDef {
  kind: HollowFloraKind;
  x: number; // hub-local
  z: number;
  stage: 0; // growth stage; Phase 2 swaps stages, so it is explicit per record
  scale?: number; // optional multiplier on the kind's base size
}

const F = (kind: HollowFloraKind, x: number, z: number, scale?: number): HollowFloraDef =>
  scale === undefined ? { kind, x, z, stage: 0 } : { kind, x, z, stage: 0, scale };

export const HOLLOW_FLORA: HollowFloraDef[] = [
  // glowing flora accents ringing the vase (clear of the 2.5u vase circle,
  // Greenpaw at (3,4), and the cold firepit at (-4,2))
  F('glow_flower', 3.2, -1.8),
  F('glow_flower', -2.9, -2.4),
  F('glow_flower', -1.5, 3.5),
  // accents lighting the gate walk up from the portal (fence rails at |x|=5)
  F('glow_flower', 3.8, -15),
  F('glow_flower', -3.6, -16.5),
  // and the cave mouth, so the descent reads marked, not hidden
  F('glow_flower', 4.2, 30.5),
  F('glow_flower', -4.4, 29.8),
  // one soft accent on the sanctum aisle
  F('glow_flower', 0, 103),
  // ferns through the clearing and the old shrine ring
  F('fern', -9.5, -3),
  F('fern', 10, 1),
  F('fern', -7, 10.5),
  F('fern', 9, 12),
  F('fern', -16, 20),
  F('fern', 17, 15),
  F('fern', -19, 34),
  F('fern', 18.5, 38),
  F('fern', -12, 44),
  F('fern', 13, 52),
  F('fern', -18, 60),
  F('fern', 19, 63),
  F('fern', -3, 70),
  F('fern', 3.5, 88),
  F('fern', -3.2, 100),
  // shrubs filling the corners and hugging the colonnade line
  F('bush', -11, -16),
  F('bush', 12.5, -14),
  F('bush', -15, 8),
  F('bush', 16, 6),
  F('bush', -17, 26),
  F('bush', 18, 28),
  F('bush', -10, 36),
  F('bush', 11, 40),
  F('bush', -20, 50),
  F('bush', 20, 55),
  F('bush', -5, 58),
  F('bush', 6, 61),
  // flowering shrubs, sparser, where the light pools
  F('bush_flowers', -8.5, -6),
  F('bush_flowers', 9.5, -5),
  F('bush_flowers', -14, 16),
  F('bush_flowers', 15, 18),
  F('bush_flowers', -4, 46),
  F('bush_flowers', 5, 44),
  F('bush_flowers', 12, 48),
  // low undergrowth clumps at the wall feet (the walls sit at |x|=23)
  F('undergrowth', -21, -8),
  F('undergrowth', 21, -2),
  F('undergrowth', -21.5, 12),
  F('undergrowth', 21.5, 24),
  F('undergrowth', -21, 42),
  F('undergrowth', 21, 58),
  F('undergrowth', -21, 74),
  F('undergrowth', 21, 78),
  F('undergrowth', -21.5, 92),
  F('undergrowth', 21.5, 98),
  F('undergrowth', -21, 108),
  F('undergrowth', 21, 112),
  F('undergrowth', -12, 126),
  F('undergrowth', 12, 127),
  // vines climbing the side walls (the antechamber waist stubs sit at z 62-70;
  // the strands stay off that band)
  F('vine_wall', -21.8, -12),
  F('vine_wall', 21.8, -6),
  F('vine_wall', -21.8, 18),
  F('vine_wall', 21.8, 32),
  F('vine_wall', -21.8, 48),
  F('vine_wall', 21.8, 52),
  F('vine_wall', -21.8, 76),
  F('vine_wall', 21.8, 88),
  F('vine_wall', -21.8, 104),
  F('vine_wall', 21.8, 120),
];

// ---------------------------------------------------------------------------
// Housing v0: fixed homestead plots in the moon-sanctum quarter of the hub
// ---------------------------------------------------------------------------
// Coordinates are hub-local (the hub is portal-instanced; the sim maps them to
// world space through the instance origin, exactly like the_hollow's npcs and
// objects above). The quarter sits behind the chamber-waist arch (z 66) of the
// 'temple' interior, clear of the vase (0,0), Greenpaw (3,4), the campfire
// (-4,2), the cave mouth (0,28), the gate (0,-40), the sanctum pillars
// (|x|=14 at z 80/95/110), and the dais (0,116, r 10.5). Two lanes of four
// plots face each other across the sanctum aisle.

export interface HousePlotDef {
  id: string;
  x: number; // hub-local plot centre
  z: number;
  rot: number; // yaw of the house front (radians); lanes face the aisle
}

export const HOLLOW_HOUSE_PLOTS: HousePlotDef[] = [
  { id: 'plot_w1', x: -9, z: 74, rot: Math.PI / 2 },
  { id: 'plot_w2', x: -9, z: 84, rot: Math.PI / 2 },
  { id: 'plot_w3', x: -9, z: 94, rot: Math.PI / 2 },
  { id: 'plot_w4', x: -9, z: 104, rot: Math.PI / 2 },
  { id: 'plot_e1', x: 9, z: 74, rot: -Math.PI / 2 },
  { id: 'plot_e2', x: 9, z: 84, rot: -Math.PI / 2 },
  { id: 'plot_e3', x: 9, z: 94, rot: -Math.PI / 2 },
  { id: 'plot_e4', x: 9, z: 104, rot: -Math.PI / 2 },
];

// The placeable-decor catalog: the object kinds a plot owner may set on the
// plot's anchor slots. Ids only; the client renders each kind procedurally.
export const HOLLOW_HOUSE_OBJECT_KINDS = ['planter', 'lantern', 'crate', 'bench', 'stool'] as const;
export type HouseObjectKind = (typeof HOLLOW_HOUSE_OBJECT_KINDS)[number];

// Fixed anchor slots, as offsets from the plot centre BEFORE the plot's rot is
// applied (the front yard is +z in plot space). Same four slots on every plot.
export const HOLLOW_HOUSE_SLOT_OFFSETS: { dx: number; dz: number }[] = [
  { dx: -3.0, dz: 3.2 },
  { dx: -1.1, dz: 3.8 },
  { dx: 1.1, dz: 3.8 },
  { dx: 3.0, dz: 3.2 },
];

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
  // PHAA-433: the Witness-Root's rare-chance drop. Class-neutral single-stat
  // budget, same convention as the other class-neutral pieces (cf. items.ts's
  // cryptbone_helm). Item level derives automatically from the boss's own
  // level (src/sim/item_level.ts): source 4 + the rare quality bonus (+3) = 7.
  witness_root_cincture: {
    id: 'witness_root_cincture',
    name: "The Witness-Root's Cincture",
    kind: 'armor',
    armorType: 'leather',
    slot: 'waist',
    quality: 'rare',
    stats: { armor: 40, sta: 3 },
    sellValue: 180,
  },
  // PHAA-433 (board-directed lore ask): a found object, not enter/leave prose.
  // A ground pickup like nythraxis_crypt's 'Ancient Diary' (dungeons.ts), read
  // in the item tooltip (flavorText) rather than a new interactable system.
  shrine_diary_page: {
    id: 'shrine_diary_page',
    name: 'Torn Diary Page',
    kind: 'junk',
    sellValue: 1,
    flavorText:
      '...counted forty days by candle before I lost the thread. The dark down ' +
      'here does not forget Him, even if He has forgotten this place. If the ' +
      'heron circles low, tell the Verger the wick still burns...',
  },
};

// ---------------------------------------------------------------------------
// The under-shrine cave (the slice's one dungeon, §11)
// ---------------------------------------------------------------------------

// Phase 3 fills the real rooms and the furnace mechanic; the skeleton gives
// the descent a first chamber, a deep chamber, and something waiting.
// PHAA-433: density raised (4 palefeeder to 6, 3 rootmaw to 5) so a solo
// level 1-3 player gathers the first run's 5 emberbulb + 4 cave_morsel in one
// descent without dead-waiting on respawns. With the room this full it can
// never be cleared solo faster than the shortened 15s respawn (palefeeder /
// rootmaw respawnMult above), so there is always something live to fight on
// the walk back.
//
// PHAA-433 (second pass, board-directed): the same 11 trash now spread the
// FULL length of the room (UNDER_SHRINE_LAYOUT, z -19..148, its own footprint
// so this doesn't also resize Hollow Crypt/Sunken Bastion) instead of packing
// the front third, and swing across most of the walkable width (the crypt
// side walls sit at |x|=22; pillars run |x|=14 z 10..130, so spawns keep
// clear of both) rather than a narrow x -5..5 lane. It reads as a steady
// trickle down a real cave, never a pile, and the widened aggroRadius 8-9
// pulls still never chain past two mobs at these spacings/x-offsets. The
// boss sits on the room's own dais at the far end.
const UNDER_SHRINE_SPAWNS: DungeonSpawn[] = [
  { mobId: 'palefeeder', x: -8, z: 12 },
  { mobId: 'rootmaw', x: 9, z: 22 },
  { mobId: 'palefeeder', x: -11, z: 32 },
  { mobId: 'rootmaw', x: 6, z: 42 },
  { mobId: 'palefeeder', x: -4, z: 52 },
  { mobId: 'rootmaw', x: 11, z: 62 },
  { mobId: 'palefeeder', x: 8, z: 72 },
  { mobId: 'rootmaw', x: -9, z: 82 },
  { mobId: 'palefeeder', x: -2, z: 92 },
  { mobId: 'rootmaw', x: 10, z: 102 },
  { mobId: 'palefeeder', x: -6, z: 112 },
  { mobId: 'the_witness_root', x: 0, z: 132 }, // on UNDER_SHRINE_LAYOUT's dais
];

// The Hollow hub itself. Per the constitution's Decision 19 (docs/plan-the-hollow.md
// §12), the hub is portal-instanced using the base engine's own dungeon-instance
// pattern, entered through HOLLOW_HUB_DOOR_POS in the overworld, exactly the way
// the Drowned Temple's overworld doorPos (temple.ts MOONGATE_POS) opens onto its
// instance. No spawns of its own here: the shrine clearing is unguarded floor
// (§3); combat lives in the under_shrine cave below it.
export const HOLLOW_DUNGEON_DEFS: Record<string, DungeonDef> = {
  the_hollow: {
    id: 'the_hollow',
    name: 'The Hollow',
    // 0-5 are taken by the base dungeons (nythraxis_boss_arena holds 5) and 3
    // by the Drowned Temple; 6 is the first free x-band now the arena and
    // delve bands sit east of it (see data.ts ARENA_X / DELVE_X_MIN).
    index: 6,
    doorPos: { ...HOLLOW_HUB_DOOR_POS },
    entry: { ...HOLLOW_GATE_POS },
    // Exit portal between entry and the front wall (zMin -19): 6u south of
    // entry so arriving never trips the 2u walk-out trigger, still on floor.
    exitOffset: { x: 0, z: -16 },
    // One hub for the whole population: the social space where everyone sees
    // everyone at the vase, and the reason a 24-slot per-party pool can never
    // exhaust under full-population hollowStart joins.
    sharedInstance: true,
    homeRespawn: { dungeonId: 'the_hollow', ...VASE_LANDING_POS },
    spawns: [],
    objects: [
      // The cave mouth, downhill of the vase: an internal door into the
      // Under-Shrine, exactly the way the Abandoned Crypt's sealed royal
      // door links to nythraxis_boss_arena (dungeons.ts).
      {
        itemId: '',
        name: 'Cave Mouth',
        x: 0,
        z: 28,
        templateId: 'dungeon_door',
        dungeonId: 'under_shrine',
      },
    ],
    // Greenpaw and the Profession Trainer live at the foot of the vase, inside
    // the instance, mirrored across it from each other.
    npcs: [
      { npcId: 'brother_greenpaw', x: 3, z: 4 },
      { npcId: 'elder_yarrow', x: -3, z: 4 },
    ],
    interior: 'temple',
    suggestedPlayers: 1,
    enterText:
      'You step through the shrine gate. The air turns warm and green, and the vase waits ahead.',
    // PHAA-420: the gate opens both ways again into the Hollow Reaches
    // (content/hollow_zone.ts), not the inherited Eastbrook.
    leaveText: 'You step back out through the gate into the wider Hollow.',
  },
  under_shrine: {
    id: 'under_shrine',
    name: 'The Under-Shrine',
    index: 7, // the x-band after the_hollow (6)
    // doorPos is vestigial (overworldDoor false, exitTo below): the cave is
    // reached only through the_hollow's internal Cave Mouth door, and leaving
    // emerges back into the hub instance beside that cave mouth, never the
    // overworld (PHAA-404). Dying below sends the spirit back to the vase.
    doorPos: { ...HOLLOW_HUB_DOOR_POS },
    overworldDoor: false, // reached only through the_hollow's internal door
    exitTo: { dungeonId: 'the_hollow', x: 0, z: 24 },
    homeRespawn: { dungeonId: 'the_hollow', ...VASE_LANDING_POS },
    entry: { x: 0, z: 4 },
    exitOffset: { x: 0, z: -6 },
    spawns: UNDER_SHRINE_SPAWNS,
    // PHAA-433 (board feedback): lore lives on a found object (a ground
    // pickup, same pattern as nythraxis_crypt's 'Ancient Diary' in
    // dungeons.ts), not enter/leave prose. Tucked in the wall aisle just past
    // the entrance (pillars run |x|=14 for z 10..130, walls at |x|=22), clear
    // of the spawn line and short of the first tomb obstacle at (-19, 16),
    // whose OBB spans x -20.1..-17.9, z 13.9..18.1.
    objects: [{ itemId: 'shrine_diary_page', name: 'Torn Diary Page', x: -17, z: 9 }],
    // Deliberate: the 'crypt' interior builder is the Hollow Crypt's own
    // skeleton (sealed doors, keystones, the buried-and-walled grammar) reused
    // per the constitution (§4, the Hollow Crypt reuse) and rethemed root-cold
    interior: 'crypt',
    suggestedPlayers: 5,
    enterText: 'You descend below the shrine into cool, still dark.',
    leaveText: 'You climb back up into the warm air above.',
  },
};
