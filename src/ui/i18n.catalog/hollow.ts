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
    greenpaw_bead: { name: 'A Bead From the Bandolier' },
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
      // Greeting renders every time the player opens Greenpaw's gossip dialog
      // after the intro has played, so it must read as already-met voice
      // rather than first-meeting voice (PHAA-432 follow-up, Brandon feedback
      // on PR #82). The intro itself carries the meet-and-greet beats; the
      // greeting assumes shared context and leads straight back to the
      // errand queue. Kept identical to the sim record in
      // src/sim/content/hollow.ts.
      greeting:
        "you're back, that's a blessin'... the vase has been sighin' all mornin', got a couple sacred matters queued up, same wavelength as last time. c'mere a minute...",
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
    },
    sexton_faddick: {
      name: 'Sexton Faddick',
      title: 'The Wandering Keeper',
      greeting:
        'Faddick. Sexton, where there is still a shrine to sexton. I do not stay anywhere; I keep. Wolves have circled the flock at Fallow Acres every night, and a thing that circles long enough learns the shape of what it circles. Best it stays a flock.',
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
      // Branching offer dialog (PHAA-471). `complain`/`refuse` are the player's
      // lines; the replies are Greenpaw's. Kept identical to the sim record in
      // src/sim/content/hollow.ts; non-Latin fills live in src/ui/i18n.locales/.
      dialog: {
        complain: 'I was just down there. You watched me climb out of the hole.',
        complainReply:
          "i know it, friend, i know... the vase don't keep a calendar and neither does my stomach. but look at them boots and tell me they don't got one more descent in 'em... no rush. the hole ain't goin' anywhere. that's kinda its whole deal...",
        refuse: "No. I'm not going back down there.",
        refuseReply:
          "oh... oh, okay. ...okay. that's... yeah. no, that's fair, friend, that's fair... the vase heard it too, and between you and me i think he respects it. here, take the cutting anyway. you went down once, and that's once more than most...",
      },
    },
    // PHAA-484: kept identical to the sim record in src/sim/content/hollow.ts;
    // non-Latin fills live in src/ui/i18n.locales/.
    q_the_wavelength: {
      title: 'On the Wavelength',
      text: "the cutting's yours now, friend, so let's talk about what comes after... two things, and neither one's a trial, more like an interduction. first, cross the vase and meet elder yarrow, she teaches a whole second callin', a different way to play this whole thing, and every soul that comes through here oughta know that door's open... second, come on back and feed me somethin', don't matter which, emberbulb or morsel, i'm always runnin' on empty and the vase always wants for smoke. that part never really ends, to a greenpaw degree.",
      completion:
        "there it is... you felt the room go thick for a second, right? that's him, noticin'. that's the whole trick, friend - you feed me, i smoke up the place, he leans in a little closer to payin' attention. ain't complicated. ain't never gonna stop bein' true, neither. c'mere anytime you're carryin' spare bulbs or morsels, the hearth don't keep a calendar... and hey. welcome to the hollow. i realize i never actually said that part.",
      objectives: {
        0: { label: 'Elder Yarrow met' },
        1: { label: 'Fed at the hearth' },
      },
      dialog: {
        complain: 'Another errand? I just climbed out of that hole.',
        complainReply:
          "no, no, hear me out, this ain't cave work... this one's easy, this one's just walkin' and one good feed. lightest thing i ever asked of you, i promise, on the wavelength and everything.",
        refuse: "I'll find my own training, thanks.",
        refuseReply:
          "...fair 'nough. can't make a soul learn somethin' 'fore they're ready. door's open when it ain't 'not yet' no more... here, take this anyway, least i can do for you showin' up at all.",
      },
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
