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
    shrine_diary_page: {
      name: 'Torn Diary Page',
      flavorText:
        '...counted forty days by candle before I lost the thread. The dark down ' +
        'here does not forget Him, even if He has forgotten this place. If the ' +
        'heron circles low, tell the Verger the wick still burns...',
    },
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
      // First-meeting click-through intro (PHAA-432). Kept identical to the sim
      // record in src/sim/content/hollow.ts; the resolver reads this English
      // source, non-Latin fills live in src/ui/i18n.locales/<lang>.ts.
      introLines: {
        0: "uhh... hi. hi. didn't hear you come up, i was someplace else, someplace green... you got the just-woke-up look, friend. i know it well, i wear it most days...",
        1: "name's greenpaw. brother greenpaw, first prophet, self-appointed, which the vase'll tell you means exactly nothin', and he's not wrong, but somebody's gotta tend him...",
        2: "this here's the hollow. was a whole tribe once, big doings, so they tell me, and now it's mostly me, the vase, and whatever's breathin' down in that cave... anyway. he's hungry, i'm hungry, same wavelength. c'mere, got a couple sacred matters need tendin'.",
      },
    },
    verger_zebediah: {
      name: 'Verger Zebediah',
      title: 'Warden of Root Hollow',
      greeting:
        'Verger Zebediah. I keep the Reaches to a calendar, or I keep trying. Root Hollow was marked to rest this season, and the boars did not read the notice. Mind the loose dirt, and do not touch the register.',
      // First-meeting click-through intro (PHAA-439). Kept identical to the
      // sim record in src/sim/content/hollow_zone.ts; the resolver reads this
      // English source, non-Latin fills live in src/ui/i18n.locales/<lang>.ts.
      introLines: {
        0: 'Verger Zebediah. Warden of Root Hollow, by appointment of an office that is, presently, also me. You will find me here on most days; I find myself here on the others. The Reaches do not require a quorum, only a record.',
        1: 'I keep the calendar. The calendar is not keeping me, though some seasons it tries. Root Hollow is marked to rest this turn, the lower dens have not received the notice, and the heron has stopped pretending to be surprised. This is the situation. It is not a complaint; complaints require witnesses.',
        2: 'There is a register inside the shrine. Do not touch it. There is loose dirt underfoot where the boars have been. Mind both. If you have come about the ward, I can offer two errands, neither of them small, and one of them I would rather not amend a third time. Which brings us to why I am talking to you at all.',
      },
      // Persistent journal/lore (PHAA-480): always available, re-readable, deeper
      // than the quest text. Carries the "register remembers what walks forgets"
      // throughline and the heron / the room under the shrine. Kept identical to
      // the sim record in src/sim/content/hollow_zone.ts; non-Latin fills live in
      // src/ui/i18n.locales/<lang>.ts.
      journalLines: {
        0: 'The register goes back further than the heron does. I did not write the first entry, and I will not write the last; that is the comfort of an office no one is waiting to inherit. The Reaches were a thoroughfare once. People came up the lake path with salt and left with something they did not name, and neither did I, because it was not mine to ask. The register records the comings and the goings and one long gap where neither happened. I keep the gap too.',
        1: 'The heron is older than the register, which the register resents. It does not say so. It does not have to. I have watched it stand on one leg through a season that killed the pear trees and not blink, which I take to be a position on something, though I have never been briefed on what. There is a room under the shrine I do not enter. The heron goes in. I do not ask it what it does in there; it does not ask me what I do up here. This arrangement has held longer than either of us.',
        2: 'If you have read this far you are either curious or avoiding the boars, and I respect both. The short version of the long record: this place remembers something it was, and something it means to be again, and the difference is the work. Mine is the remembering. I do not know whose the being again is. I file it under pending and go to bed. The register allows pending. It does not allow forgetting.',
      },
    },
    sexton_faddick: {
      name: 'Sexton Faddick',
      title: 'The Wandering Keeper',
      greeting:
        'Faddick. Sexton, where there is still a shrine to sexton. I do not stay anywhere; I keep. Wolves have circled the flock at Fallow Acres every night, and a thing that circles long enough learns the shape of what it circles. Best it stays a flock.',
      // First-meeting click-through intro (PHAA-439). Kept identical to the
      // sim record in src/sim/content/hollow_zone.ts; the resolver reads this
      // English source, non-Latin fills live in src/ui/i18n.locales/<lang>.ts.
      introLines: {
        0: 'Faddick. Sexton, where there is still a shrine to sexton, which is fewer shrines than there used to be. I do not stay anywhere; I keep. The keeping is most of what I am still for.',
        1: 'A thing that circles long enough learns the shape of what it circles. The wolves at Fallow Acres have been circling the flock every night since before I came through, and they have not yet learned the flock, which is something. The flock has learned them, which is more.',
        2: 'I would offer you tea, but the kettle is somewhere I was yesterday. There is a quiet stretch of ground by the lake that means to be built on; nothing settles on ground with wolves working the dark. Two errands, then, and one of them I would rather not do alone. Best we walk while we talk.',
      },
      // Persistent journal/lore (PHAA-480): always available, re-readable, deeper
      // than the quest text. Carries the "ground keeps better than we do"
      // throughline and the slow time under the stones. Kept identical to the
      // sim record in src/sim/content/hollow_zone.ts; non-Latin fills live in
      // src/ui/i18n.locales/<lang>.ts.
      journalLines: {
        0: 'I keep a list of the places I have kept, in my head, because the paper changes hands faster than the ground does. Shrines, mostly, the ones with no one left to tend them. Fallow Acres is on the list. So is a pond east of the lake whose name I never learned and a standing stone the wind has been rounding down for a hundred years. The list is not long. The list is, in the way that matters, the whole point. You do not keep a place by staying. You keep it by being the one who still knows it was there.',
        1: 'The ground keeps better than we do. That is the whole of the trade. What walks above forgets its own name inside two generations and invents a new one and calls it the same; what sits below forgets nothing and waits. There is a slow time down under the stones. I have heard it, once, and I did not answer, because answering is how the slow thing finds the door. I carry the key for the not answering. It is not a metal key. It is a habit, which is heavier.',
        2: 'The wolves are not the problem. The wolves are the symptom; the problem is whatever made the ground quiet enough that wolves thought it was theirs. I have seen this before, a place going quiet in the wrong direction, and the fix is always the same: make it loud again with the right kind of noise, which is people, which is why someone builds. You could ask who I am to carry any of this. I am the one still walking. That is the whole qualification. It is enough and it is not, and I have made my peace with the gap between those.',
      },
    },
  },
  quests: {
    q_what_burns: {
      title: 'The Thing That Burns',
      text: "the communion's gone thin, friend... i'm bone dry and the wavelength is closin'. down under the shrine there's a bulb that burns slow and clean - emberbulb, grows where the light don't reach, which is a joke the cave plays on itself... bring me five. mind the pale ones. they come at your lantern, not at you. mostly.",
      completion:
        "now THAT'S the good smoke... you feel that? room's gettin' thick. he's gonna lean in any minute now, i can feel it on the wavelength... indeed.",
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
      text: 'By the calendar, Root Hollow rests this season. The boars have not been informed. They have rooted up half of it chasing grubs, and they no longer scatter when a heron flaps at them, which I take personally. Cull five, and I can enter the season as observed.',
      completion:
        'Five. Counted, dated, and entered in the register. Root Hollow is now only a fortnight behind its own season, which in this office we call a triumph. My thanks, on behalf of an order that is, at present, me.',
      objectives: { 0: { label: 'Wild Boar slain' } },
    },
    q_root_hollow_boars_ii: {
      title: "Root Hollow's Reckoning",
      text: 'I will admit what the office discourages admitting: five was optimistic. The lower dens keep pushing up more. Eight further, and I can close the season without amending the record a third time. The record resents amendment. So do I.',
      completion:
        'Closed. Signed. Filed. The season may proceed exactly as scheduled, now that there is once more someone to keep the schedule. You have been a great help to a very small congregation. The congregation, I should clarify, is me.',
      objectives: { 0: { label: 'Wild Boar slain' } },
    },
    q_fallow_acres_wolves: {
      title: 'Wolves Off the Furrows',
      text: 'Someone means to build at Fallow Acres. Good. Ground with people on it remembers better than ground without, and this stretch has forgotten a great deal. But nothing settles with wolves working the dark. Thin the pack to five, and I will see the walk repaid. Repaying is most of what I am still for.',
      completion:
        'Quieter. Good. I have stood in a great many quiet places that were once loud with a whole people; this one has a chance to go the other way. My thanks, and mind how you go.',
      objectives: { 0: { label: 'Forest Wolf slain' } },
    },
    q_fallow_acres_wolves_ii: {
      title: 'The Last of the Pack',
      text: 'The edges are thinner, the den is not. Eight more, and Fallow Acres can hold a roof without losing what sleeps under it in the night. I would tend to it myself, but I am rarely anywhere twice, and the ground below the shrine wants keeping more than these furrows do.',
      completion:
        'There. A quiet night, and perhaps a hundred behind it. Build well. And if you ever dig deep enough to hear something down there keeping slow time, do not answer it. That part is mine to keep; I carry the key for it. Go on, now.',
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
      enterText: 'You descend below the shrine into cool, still dark.',
      leaveText: 'You climb back up into the warm air above.',
    },
  },
};

export const hollowEntities = { en: hollowEntitiesEn };
