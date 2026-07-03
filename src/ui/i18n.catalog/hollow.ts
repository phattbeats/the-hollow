// i18n source catalog - The Hollow entities (English values).
// Part of src/ui/i18n.catalog/; assembled into `en` by ./index.ts.
// Translations live in src/ui/i18n.locales/<lang>.ts, never here.
//
// English source for the Hollow hub content (src/sim/content/hollow.ts), the
// same shape world_entity_i18n.ts + i18n.catalog/merge.ts use for the base
// zones and the Drowned Temple: mob/NPC/quest/dungeon names and text, plus
// the quest item names. This module carries `en` only; the build fills every
// other locale (registry marks omissions `pending`).

const hollowEntitiesEn = {
  items: {
    cave_morsel: { name: 'Cave Morsel' },
    emberbulb: { name: 'Emberbulb' },
    first_cutting: { name: 'A Cutting' },
    witness_root_cincture: { name: "The Witness-Root's Cincture" },
  },
  mobs: {
    palefeeder: { name: 'Palefeeder' },
    rootmaw: { name: 'Rootmaw' },
    the_witness_root: { name: 'The Witness-Root' },
  },
  npcs: {
    brother_greenpaw: {
      name: 'Brother Greenpaw',
      title: 'First Prophet (self-appointed)',
      greeting:
        "howdy, traveler. you catch the vase in a mood today, or is that just me again... c'mere, got a couple sacred matters need tendin'. mostly snacks. same thing, to a greenpaw degree.",
    },
    verger_zebediah: {
      name: 'Verger Zebediah',
      title: 'Warden of Root Hollow',
      greeting:
        "Root Hollow's overrun with boar this season, tearing up the roots after grubs. Mind the loose dirt unless you mean to fight them.",
    },
    sexton_faddick: {
      name: 'Sexton Faddick',
      title: 'The Wandering Keeper',
      greeting:
        "Good ground, this, I pass through more than I stay. Can't build a thing with wolves circling the flock every night, though.",
    },
  },
  quests: {
    q_what_burns: {
      title: 'The Thing That Burns',
      text: "the communion's gone thin, friend... i'm bone dry and the wavelength is closin'. down under the shrine there's a bulb that burns slow and clean - emberbulb, grows where the light don't reach, which is a joke the cave plays on itself... bring me five. mind the pale ones. they come at your lantern, not at you. mostly.",
      completion:
        "now THAT'S the good smoke... you feel that? room's gettin' thick. she's gonna lean in any minute now, i can feel it on the wavelength... indeed.",
      objectives: { 0: { label: 'Emberbulb gathered' } },
    },
    q_what_fills: {
      title: 'The Thing That Fills',
      text: "second matter, and i'd call it sacred but between us it's breakfast... the rootmaws down there carry a morsel on 'em, cave-fed, real earthy. four'll do. bring 'em back 'fore the stomach starts singin' hymns of its own...",
      completion:
        "you're a saint of the first order, friend. or a good neighbor. same thing, to a greenpaw degree. ...here. was gonna keep this one but the inner cowboy says it's yours. don't let it wilt.",
      objectives: { 0: { label: 'Cave Morsel gathered' } },
    },
    q_root_hollow_boars: {
      title: "Root Hollow's Boars",
      text: "Boars have dug up half of Root Hollow chasing grubs, and they don't scare easy anymore. Cull five and the roots might get a season's rest.",
      completion: "Five less snouts in the dirt. Root Hollow thanks you, even if it can't say so.",
      objectives: { 0: { label: 'Wild Boar slain' } },
    },
    q_root_hollow_boars_ii: {
      title: "Root Hollow's Reckoning",
      text: 'Five was a start, but more keep pushing up from the lower dens. Finish it: eight more and Root Hollow gets its rest.',
      completion: "That's the last of the diggers, or near enough. The roots can breathe.",
      objectives: { 0: { label: 'Wild Boar slain' } },
    },
    q_fallow_acres_wolves: {
      title: 'Wolves Off the Furrows',
      text: "Can't hold a plot with wolves circling every night. Thin the pack at Fallow Acres and I'll make it worth the walk.",
      completion: "That's a few nights' sleep, right there. Preciate it.",
      objectives: { 0: { label: 'Forest Wolf slain' } },
    },
    q_fallow_acres_wolves_ii: {
      title: 'The Last of the Pack',
      text: "Thinned the edges, but the den's still full. Eight more and Fallow Acres might get a quiet night.",
      completion: 'Quiet at last. Reckon I can start on those fences now.',
      objectives: { 0: { label: 'Forest Wolf slain' } },
    },
  },
  dungeons: {
    the_hollow: {
      name: 'The Hollow',
      enterText:
        'You step through the shrine gate. The air turns warm and green, and the vase waits ahead.',
      // PHAA-420: the gate opens onto the Hollow Reaches now, not Eastbrook.
      leaveText: 'You step back out through the gate into the wider Hollow.',
    },
    under_shrine: {
      name: 'The Under-Shrine',
      enterText:
        'You descend below the shrine. The air goes still and close, and the dark ahead does not feel empty. Something down here has kept its own time long after anyone stopped listening.',
      leaveText:
        'You climb back into the warm. Above you, faintly, smoke. Below, the dark keeps its slow count.',
    },
  },
};

export const hollowEntities = { en: hollowEntitiesEn };
