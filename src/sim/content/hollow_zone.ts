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

import type { CampDef, NpcDef, PlayerClass, QuestDef, ZoneDef, ZonePropsDef } from '../types';
import { ALL_CLASSES } from '../types';

// PHAA-560: the tribe-mystery breadcrumb q_root_hollow_boars hands out
// (content/hollow.ts's tally_shard), same degenerate per-class reward
// pattern as content/hollow.ts's own keepsake FOR_ALL constants.
const TALLY_SHARD_FOR_ALL = Object.fromEntries(
  ALL_CLASSES.map((c) => [c, 'tally_shard']),
) as Partial<Record<PlayerClass, string>>;

// PHAA-558: Sister Shade's line is reward-INVERTED, no stats ever. Her one
// keepsake (willow_sprig, defined in content/hollow.ts) is handed to every
// class the same way, so the per-class reward archetype is used degenerately
// here exactly as content/hollow.ts's CUTTING_FOR_ALL / BEAD_FOR_ALL do.
const SPRIG_FOR_ALL = Object.fromEntries(ALL_CLASSES.map((c) => [c, 'willow_sprig'])) as Partial<
  Record<PlayerClass, string>
>;

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
    // First-meeting click-through intro (PHAA-439): three beats in voice
    // (formal, clipped, ecclesiastical, no contractions, the "straight man"
    // warden of the constitution). Carries the "sole surviving keeper of a
    // register" throughline before the first errand. Kept identical in
    // src/ui/i18n.catalog/hollow.ts (the English source the resolver reads).
    introLines: [
      'Verger Zebediah. Warden of Root Hollow, by appointment of an office that is, presently, also me. You will find me here on most days; I find myself here on the others. The Reaches do not require a quorum, only a record.',
      'I keep the calendar. The calendar is not keeping me, though some seasons it tries. Root Hollow is marked to rest this turn, the lower dens have not received the notice, and the heron has stopped pretending to be surprised. This is the situation. It is not a complaint; complaints require witnesses.',
      'There is a register inside the shrine. Do not touch it. There is loose dirt underfoot where the boars have been. Mind both. If you have come about the ward, I can offer two errands, neither of them small, and one of them I would rather not amend a third time. Which brings us to why I am talking to you at all.',
    ],
    // Persistent journal/lore (PHAA-480): always available, re-readable, deeper
    // than the quest text. Carries the "register remembers what walks forgets"
    // throughline and the heron / the room under the shrine. Kept identical in
    // src/ui/i18n.catalog/hollow.ts; non-Latin fills live in the locale overlays.
    journalLines: [
      'The register goes back further than the heron does. I did not write the first entry, and I will not write the last; that is the comfort of an office no one is waiting to inherit. The Reaches were a thoroughfare once. People came up the lake path with salt and left with something they did not name, and neither did I, because it was not mine to ask. The register records the comings and the goings and one long gap where neither happened. I keep the gap too.',
      'The heron is older than the register, which the register resents. It does not say so. It does not have to. I have watched it stand on one leg through a season that killed the pear trees and not blink, which I take to be a position on something, though I have never been briefed on what. There is a room under the shrine I do not enter. The heron goes in. I do not ask it what it does in there; it does not ask me what I do up here. This arrangement has held longer than either of us.',
      'If you have read this far you are either curious or avoiding the boars, and I respect both. The short version of the long record: this place remembers something it was, and something it means to be again, and the difference is the work. Mine is the remembering. I do not know whose the being again is. I file it under pending and go to bed. The register allows pending. It does not allow forgetting.',
    ],
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
    // First-meeting click-through intro (PHAA-439): three beats in voice
    // (aphoristic, wandering-keeper, longer arc, present-tense verbs, the
    // "badger who is not hub-bound" energy from the constitution). Carries
    // the "I do not stay anywhere; I keep" throughline before the first
    // errand. Kept identical in src/ui/i18n.catalog/hollow.ts.
    introLines: [
      'Faddick. Sexton, where there is still a shrine to sexton, which is fewer shrines than there used to be. I do not stay anywhere; I keep. The keeping is most of what I am still for.',
      'A thing that circles long enough learns the shape of what it circles. The wolves at Fallow Acres have been circling the flock every night since before I came through, and they have not yet learned the flock, which is something. The flock has learned them, which is more.',
      'I would offer you tea, but the kettle is somewhere I was yesterday. There is a quiet stretch of ground by the lake that means to be built on; nothing settles on ground with wolves working the dark. Two errands, then, and one of them I would rather not do alone. Best we walk while we talk.',
    ],
    // Persistent journal/lore (PHAA-480): always available, re-readable, deeper
    // than the quest text. Carries the "ground keeps better than we do"
    // throughline and the slow time under the stones. Kept identical in
    // src/ui/i18n.catalog/hollow.ts; non-Latin fills live in the locale overlays.
    journalLines: [
      'I keep a list of the places I have kept, in my head, because the paper changes hands faster than the ground does. Shrines, mostly, the ones with no one left to tend them. Fallow Acres is on the list. So is a pond east of the lake whose name I never learned and a standing stone the wind has been rounding down for a hundred years. The list is not long. The list is, in the way that matters, the whole point. You do not keep a place by staying. You keep it by being the one who still knows it was there.',
      'The ground keeps better than we do. That is the whole of the trade. What walks above forgets its own name inside two generations and invents a new one and calls it the same; what sits below forgets nothing and waits. There is a slow time down under the stones. I have heard it, once, and I did not answer, because answering is how the slow thing finds the door. I carry the key for the not answering. It is not a metal key. It is a habit, which is heavier.',
      'The wolves are not the problem. The wolves are the symptom; the problem is whatever made the ground quiet enough that wolves thought it was theirs. I have seen this before, a place going quiet in the wrong direction, and the fix is always the same: make it loud again with the right kind of noise, which is people, which is why someone builds. You could ask who I am to carry any of this. I am the one still walking. That is the whole qualification. It is enough and it is not, and I have made my peace with the gap between those.',
    ],
    wanderRadius: 4,
  },
  // PHAA-558 (Sister Shade's player-facing arc, Board-accepted brief shade-brief
  // rev 1e9abd48). The WALKING GUISE: a plain human woman with a watering can,
  // no title of rank, no magic, no marker at first sight. Placed on the shore of
  // Mossbank (the lake at 42,-235), where the player first finds her "collecting
  // water, no explanation given" (the Board-LOCKED first meeting). The truth she
  // never states: she promised to water the plant, and keeps it every day. Her
  // two quests are gated behind minLevel (q_have_you_eaten at 2,
  // q_someone_your_own_size at 3), so a fresh level-1 arrival meets her with NO
  // quest marker, exactly as the brief requires: at first she is just a person.
  // The watering-can prop + the "god's ambient cruelty softens near her" clue are
  // render/Phase-2 systems tracked in docs/design/shade-questline.md, not here.
  shade: {
    id: 'shade',
    name: 'Shade',
    title: 'A Traveler',
    pos: { x: 28, z: -244 },
    facing: -2.4,
    color: 0x6b7f6a,
    questIds: ['q_have_you_eaten', 'q_someone_your_own_size'],
    // She paces the short walk between the water and whatever she is tending, so
    // she reads as busy with small chores rather than posted like a quest-giver.
    wanderRadius: 3,
    greeting:
      "Oh, it's you. Sit if you like, the water's not going anywhere. Have you eaten today? You should eat.",
    // First meeting: she is filling the can and deflects into ordinary small talk.
    // No destiny, no hook, nothing that marks her as more than a civilian, which
    // is the whole point of the first sighting.
    introLines: [
      "You caught me at my chores. Don't mind the can, it's only water. There's always something somewhere that wants a little water.",
      'Me? Nobody much. Shade. I walk, I lend a hand where hands are short. You look worn through. Sit a moment, if you like.',
    ],
  },
  // PHAA-558: the Bard at the gate, the target of "Have You Eaten?" (quest 1). He
  // plays for coppers that rarely come and never gets a warm meal; carrying him
  // one is the whole quest. Not a quest-giver himself (empty questIds); talking
  // to him is what credits Shade's interact objective. Posted just off the gate
  // approach in the hub clearing of the Reaches (the gate is at 0,-290).
  gate_bard: {
    id: 'gate_bard',
    name: 'Halden the Bard',
    title: 'Player at the Gate',
    pos: { x: -7, z: -285 },
    facing: 0.4,
    color: 0x7a6a4a,
    questIds: [],
    greeting:
      "A copper for a song? No? That's all right, most days it's no. I play for the gate, and the gate's never once reached for its purse.",
  },
  // PHAA-558: the target of "Someone Your Own Size" (quest 3). A struck-through
  // name from the Verger's rolls, someone the world has been cruel to, whom the
  // quest asks the player only to SIT WITH. Not a quest-giver (empty questIds).
  // Placed apart from Root Hollow (the Verger's post at 34,-334) and clear of the
  // boar camps, off on her own the way a crossed-out name is left to itself.
  goodwife_orla: {
    id: 'goodwife_orla',
    name: 'Orla',
    title: 'Once of Root Hollow',
    pos: { x: 24, z: -344 },
    facing: 1.2,
    color: 0x6a5b53,
    questIds: [],
    greeting:
      "You can sit. Most walk on. The Verger crossed my name off his register a long while back, and a crossed name learns to keep quiet so nobody has to be reminded it's still here.",
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
    // PHAA-560: tally_shard, found where the boars rooted up half of Root
    // Hollow (this quest's own text). See content/hollow.ts for the item.
    itemRewards: TALLY_SHARD_FOR_ALL,
    minLevel: 1,
  },
  q_root_hollow_boars_ii: {
    id: 'q_root_hollow_boars_ii',
    name: "Root Hollow's Reckoning",
    giverNpcId: 'verger_zebediah',
    turnInNpcId: 'verger_zebediah',
    requiresQuest: 'q_root_hollow_boars',
    text: 'I will admit what the office discourages admitting: five was optimistic. The lower dens keep pushing up more. Eight further, and I can close the season without amending the record a third time. The record resents amendment. So do I.',
    // PHAA-560 (tribe-mystery breadcrumb, docs/plan-the-hollow.md's PROTECTED
    // OPEN QUESTION stays unresolved): the closing aside about the register
    // is new; the rest of the completion is unchanged. Indirect: a keeper
    // predating Zebediah's own order, a headcount he won't total, no claim
    // about who that was or what became of them.
    completionText:
      'Closed. Signed. Filed. The season may proceed exactly as scheduled, now that there is once more someone to keep the schedule. You have been a great help to a very small congregation. The congregation, I should clarify, is me. The register itself is older than that arrangement, bound in a hand I have never met, keeping a count I choose not to add. Someone was thorough here, once. I only try to keep pace.',
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
  // PHAA-558: Sister Shade's player-facing line, quests 1 and 3 (the fully
  // unblocked pair). Deliberately DIALOG-heavy, NO combat, and reward-INVERTED:
  // the tasks are tiny and pointedly unheroic, the writing carries them, and the
  // payoff is meaning, not gear. Both use `interact` objectives (talk to someone),
  // never `kill`. Her voice is plain, warm, and terse, the counter-melody to
  // Greenpaw's run-ons. Quest 2 ("The Long Way Around", willow-path traversal) is
  // gated on the netcode spike PHAA-559 and quest 4 ("The Watering Can") rides the
  // PHAA-543 finale; both are WRITTEN in docs/design/shade-questline.md and land
  // as sim content only once their gates clear (a partial-wired quest would fail
  // tests/progression.test.ts's giver/order coverage, so they stay out until then).
  q_have_you_eaten: {
    id: 'q_have_you_eaten',
    name: 'Have You Eaten?',
    giverNpcId: 'shade',
    turnInNpcId: 'shade',
    text: "There's a bard at the gate who plays for coppers and eats when the coppers come, which isn't often. I've got a bowl warm and one to spare. Carry it down to him, would you? And don't tell him it was pity. Tell him it was extra.",
    completionText:
      "You're back. Did he eat? Good. That's good. And did you? ... You didn't, I can see it. Sit, then. You don't have to be great to be something good. Greatness isn't kindness. Eat.",
    objectives: [
      {
        type: 'interact',
        targetNpcId: 'gate_bard',
        count: 1,
        label: 'Warm meal carried to the bard',
      },
    ],
    xpReward: 120,
    copperReward: 40,
    itemRewards: {},
    // minLevel 2 keeps the first sighting marker-free: a fresh level-1 arrival
    // simply finds her collecting water, and only later does the kindness open.
    minLevel: 2,
  },
  q_someone_your_own_size: {
    id: 'q_someone_your_own_size',
    name: 'Someone Your Own Size',
    giverNpcId: 'shade',
    turnInNpcId: 'shade',
    requiresQuest: 'q_have_you_eaten',
    text: "There's a woman near Root Hollow the world has been unkind to. Her name was struck from the register, and people treat a struck name like it can't hear. Go and sit with her a while. You don't have to fix anything. Just be someone her own size.",
    completionText:
      "You stayed. She won't say it mattered, but it did, I promise you it did. Here, this is for you. A sprig off a willow I'm fond of. It does nothing at all. It only remembers that you were kind when nothing made you.",
    objectives: [
      { type: 'interact', targetNpcId: 'goodwife_orla', count: 1, label: 'Sat a while with Orla' },
    ],
    xpReward: 160,
    copperReward: 60,
    // Reward-inverted end of the shippable arc: no stats, only the keepsake
    // charm. See willow_sprig in content/hollow.ts (kept adjustable: when the
    // gated finale lands, this can move to it).
    itemRewards: SPRIG_FOR_ALL,
    minLevel: 3,
  },
};

export const HOLLOW_ZONE_QUEST_ORDER: string[] = [
  'q_root_hollow_boars',
  'q_root_hollow_boars_ii',
  'q_fallow_acres_wolves',
  'q_fallow_acres_wolves_ii',
  'q_have_you_eaten',
  'q_someone_your_own_size',
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
