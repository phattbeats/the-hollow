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
    first_cutting: {
      name: 'A Cutting',
      // PHAA-474: the item carries no in-bag 'use' action yet (click still routes
      // to the destroy prompt by the quest-kind branch in src/ui/bags_view.ts).
      // The intended mechanic is a Homestead v0 planting once the world-editing
      // follow-up to PHAA-417 lands; until then, this tooltip line is the player's
      // breadcrumb that the cutting has purpose and is not junk.
      flavorText:
        'A slip of living green from Brother Greenpaw, wrapped in damp moss. Once ' +
        'a homestead plot can be edited, this is the first thing you plant.',
    },
    greenpaw_bead: { name: 'A Bead From the Bandolier' },
    keeper_coal: { name: 'A Coal That Never Cooled' },
    // PHAA-484 finale: kept identical to the sim record in src/sim/content/hollow.ts.
    hearth_stone: { name: 'A Stone Still Warm From His Hearth' },
    // PHAA-558: kept identical to the sim record in src/sim/content/hollow.ts.
    willow_sprig: { name: 'A Willow Sprig' },
    witness_root_cincture: { name: "The Witness-Root's Cincture" },
    shrine_diary_page: {
      name: 'Torn Diary Page',
      flavorText:
        '...counted forty days by candle before I lost the thread. The dark down ' +
        'here does not forget Him, even if He has forgotten this place. If the ' +
        'heron circles low, tell the Verger the wick still burns...',
    },
    heartwood_splinter: {
      name: 'Heartwood Splinter',
      flavorText: 'Warm to the touch, long after the tree it came from stopped moving.',
    },
    bloomcrown_pauldrons: { name: 'Bloomcrown Pauldrons' },
    verdantguard_mantle: { name: 'Verdantguard Mantle' },
    // PHAA-560 (tribe-mystery breadcrumb): kept identical to the sim record in
    // src/sim/content/hollow.ts; non-Latin fills live in src/ui/i18n.locales/.
    worn_prayer_token: {
      name: 'Worn Prayer Token',
      flavorText:
        "...smooth on one face from a thumb that isn't mine, worn the same shallow " +
        'groove into a hundred more like it before this one, or so the pile down ' +
        "here would have you believe. one thumb doesn't wear a hundred tokens. a " +
        'lot of thumbs wear one groove, though...',
    },
    tally_shard: {
      name: 'Tally-Marked Shard',
      flavorText:
        '...marks in fives, scratched deep, crossed each time the count came round. ' +
        'hundreds of fives before the crossing stops, and the last row was never ' +
        'finished...',
    },
    // PHAA-599 (Under-Shrine v2): kept identical to the sim records in
    // src/sim/content/hollow.ts; non-Latin fills live in src/ui/i18n.locales/.
    root_token_unbinding: {
      name: 'Loosened Root-Knot',
      flavorText:
        '...worn smooth where a thumb pressed and pressed, like loosening a knot ' +
        'tied around nothing you could see. someone believed letting go was a ' +
        'kindness. someone was wrong, or early, or both...',
    },
    root_token_offering: {
      name: 'Small Feeding Stone',
      flavorText:
        '...a shallow bowl scratched into stone no bigger than a coin, the kind ' +
        "you'd leave a crumb in for something that couldn't ask. whatever ate " +
        "here didn't stop being hungry. it just stopped being seen...",
    },
    root_token_verdict: {
      name: 'Judgment-Scored Stone',
      flavorText:
        '...a tally scored in threes, not fives, judged and rejudged, pressed so ' +
        'hard the third pass split the stone. somebody kept changing their mind ' +
        'about the same question, over and over, in the dark...',
    },
  },
  mobs: {
    palefeeder: { name: 'Palefeeder' },
    rootmaw: { name: 'Rootmaw' },
    the_witness_root: { name: 'The Witness-Root' },
    heartwood_colossus: { name: 'Heartwood Colossus' },
    // Greenpaw's cutting companion (PHAA-751): the same display name across
    // all three rolled cosmetic variants (src/sim/content/hollow.ts), which
    // differ only in shape/color, not identity.
    greenpaw_cutting_dawn: { name: "Greenpaw's Cutting" },
    greenpaw_cutting_moss: { name: "Greenpaw's Cutting" },
    greenpaw_cutting_ash: { name: "Greenpaw's Cutting" },
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
      // Branching heart-to-heart tree (PHAA-562). `dialogNode.<id>` are Greenpaw's
      // lines; `dialogChoice.<id>` are the player's toned responses (kept flat, one
      // level each, so the key stays inside the catalog's depth-6 TranslationKey
      // template). Kept identical to the sim record's dialogTree in
      // src/sim/content/hollow.ts; non-Latin fills live in src/ui/i18n.locales/.
      dialogNode: {
        hearth:
          "howdy, friend, back at the vase huh, he's quiet today which means he's either listenin' real hard or straight up ignorin' me, and honestly i respect both, those are my only two settings too... anyway how's the hollow been treatin' you, good, bad, you got a snack on you, no? okay just checkin', askin' for a friend, the friend is me...",
        warmed:
          "...whoa, okay, that's real nice of you to say, friend, real nice, didn't expect it, most folks just b-line for the gate soon as they can... you're alright, you know that, you're alright to a greenpaw degree even, and i don't hand that out for free... i'd buy stock in ya if stock was a thing i had, buy the new friends, sell the old omens, that's just economics...",
        vase: "same ol' same ol', he wants smoke, wants tendin', wants somebody sittin' close so it feels like a conversation even when it ain't one, which... huh. that's most conversations, ain't it. whoa. okay, anyway, i talk at him plenty and he ain't said a word back in, uh, ever, but that's fine, that's the whole deal really, to a greenpaw degree... wait, what were we talkin' about... oh. right. him. he's fine. probably hungry. same.",
        faith:
          "believe's a big word, friend, i just tend, tendin' i can do, got two hands and a lighter and that's about the whole résumé... whether he's listenin' or not i couldn't tell ya, but the smoke smells good and it don't judge me neither, which puts it ahead of most things with ears, so, wavelength's covered either way. indeed.",
        stung:
          "...oof, yeah okay, ouch friend, dang... i mean maybe, i dunno, i've had them thoughts too, on the real cold mornings when nobody's comin' up the path and the vase won't even sigh at me... but i'm still here so, that's gotta count for somethin', right? right. anyway you want a snack, i got a snack, changin' the subject. F.",
        mended:
          "s'all good, friend, it's all gambit, always has been, that's the cowboy in me talkin', don't ask him what gambit means, he don't know neither, he just says it real confident... place like this earns a hard word now'n then, i ain't gonna pretend it don't... you came back and said sorry though, and that means somethin', or it means you want somethin', either way we're square, you and me, same wavelength, snack's on me later if you want one.",
        tribe:
          "big tribe, way back, so the old marks say anyway, i can't read good but i can count and there's a whole lotta fives scratched down there, crossed out, more fives than one hand shoulda made, that's math i can't get around... kept him lit a long time before it got down to just me, i don't know where everybody went, friend, i really don't, i get a feelin' about it sometimes, on the wavelength, but the feelin' won't finish its own sentence so, neither will i i guess... wick can't go out on my watch though. that part i know for sure.",
        confide:
          "...that's kind of you to say, friend, real kind... look, i talk at you half 'cause the vase don't answer and half 'cause i get scared, some nights, that nobody's gonna come up that path ever again and it'll just be me and him and the quiet... so. thanks for comin' up it. that's the sacred part, if you ask me. ...anyway. you got a snack on you? askin' for the vase. wavelength's hungry too.",
      },
      dialogChoice: {
        kind: "it's growin' on me, greenpaw. like, for real, for real.",
        ask: "so what's the vase been sayin', these days?",
        blunt: "it's a graveyard with a mascot, greenpaw. that's it.",
        tribe: 'tell me about the tribe, the one before you.',
        warm_bye: "i'll let you get on with it then.",
        vase_more: "and you actually think he's listenin'?",
        vase_bye: 'well, keep him company then.',
        faith_bye: 'fair enough, greenpaw.',
        sorry: 'that came out meaner than i meant. sorry, greenpaw.',
        cold_bye: 'believe whatever you want.',
        mended_bye: "we're square. see you around, greenpaw.",
        confide: "you don't have to carry that alone, brother.",
        tribe_bye: "well, somebody's still tendin' it.",
        confide_bye: "i'll keep comin' up that path, greenpaw.",
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
        // PHAA-451: outsider-stigma/obscurity lore layer. Kept identical to the sim
        // record in src/sim/content/hollow_zone.ts; non-Latin fills live in
        // src/ui/i18n.locales/<lang>.ts.
        3: 'Travelers who come up the lake path and hear about the vase tend to arrive at one of two conclusions, neither of them flattering. Some call the congregation hippies, or freaks, and leave laughing. Others call them worse and do not stay to laugh. Most never hear of the vase at all, which I have come to think is the arrangement working as intended. A quiet thing survives longer than a famous one.',
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
    // PHAA-558: kept identical to the sim records in src/sim/content/hollow_zone.ts;
    // non-Latin fills live in src/ui/i18n.locales/<lang>.ts (maintainer-refined).
    shade: {
      name: 'Shade',
      title: 'A Traveler',
      greeting:
        "Oh, it's you. Sit if you like, the water's not going anywhere. Have you eaten today? You should eat.",
      introLines: {
        0: "You caught me at my chores. Don't mind the can, it's only water. There's always something somewhere that wants a little water.",
        1: 'Me? Nobody much. Shade. I walk, I lend a hand where hands are short. You look worn through. Sit a moment, if you like.',
      },
    },
    gate_bard: {
      name: 'Halden the Bard',
      title: 'Player at the Gate',
      // PHAA-451: outsider-stigma beat. Kept identical to the sim record in
      // src/sim/content/hollow_zone.ts; non-Latin fills live in src/ui/i18n.locales/.
      greeting:
        "A copper for a song? No? That's all right, most days it's no. I play for the gate, and the gate's never once reached for its purse. Folk passing through call this place a hippie camp, or worse, and mostly they're just passing through, so I let them.",
    },
    goodwife_orla: {
      name: 'Orla',
      title: 'Once of Root Hollow',
      greeting:
        "You can sit. Most walk on. The Verger crossed my name off his register a long while back, and a crossed name learns to keep quiet so nobody has to be reminded it's still here.",
    },
    // PHAA-614: kept identical to the sim records in
    // src/sim/content/hollow_zone.ts and src/sim/content/hollow.ts.
    withered_planting: {
      name: 'The Withered Planting',
      title: "The Tribe's Old Willow",
      greeting:
        "Dry roots, dry leaves. Whatever this was meant to grow into, it hasn't yet, and it's been a long while waiting.",
    },
    buried_root: {
      name: 'A Buried Root',
      title: 'Under the Shrine',
      greeting: 'Dry. Dry as anything down here ever gets.',
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
    // PHAA-484 beat 4: kept identical to the sim record in
    // src/sim/content/hollow.ts; non-Latin fills live in src/ui/i18n.locales/.
    q_keep_him_lit: {
      title: 'Keep Him Lit',
      text: "three times, friend, that's the number... not sacred, just enough to turn a favor into a habit, and habits are the only religion i actually trust... c'mon back and feed the hearth three separate times, don't matter the order, don't matter which of the two, emberbulb or morsel, and i'll believe you're really here to stay, not just passin' through on your way to somethin' bigger...",
      completion:
        "three for three... you're not just visitin' anymore, friend, you're keepin' somethin' alive, and that's the whole ballgame if you ask me, which nobody did, but i'm sayin' it anyway... here. hold onto this, it don't do nothin', it just remembers, same as the rest of us down here...",
      objectives: { 0: { label: 'Hearth fed' } },
      dialog: {
        complain: "I already fed you once. Isn't that enough?",
        complainReply:
          "once is a favor, friend, three's a habit, and i been burned by favors before... this ain't about the hearth needin' it, the hearth's fine, i keep it fine, it's about you comin' back on your own two feet 'cause you wanted to, not 'cause some quest marker told you to... three times. no rush on the countin'.",
        refuse: "I'm not doing this three separate times. Once was enough.",
        refuseReply:
          "...yeah. yeah, okay, i hear you, friend, that's a fair enough line to draw... tell you what, here, take it anyway, ain't earned in the strictest sense but neither's most of what i hand out, and the wavelength don't really keep score the way i pretend it does...",
      },
    },
    // PHAA-484 finale: kept identical to the sim record in
    // src/sim/content/hollow.ts; non-Latin fills live in src/ui/i18n.locales/.
    q_your_own_hearth: {
      title: 'A Hearth of Your Own',
      text: "here's the last of it, friend, and it ain't really an errand so much as a nudge... there's ground out past the road, fallow acres, sittin' quiet and waitin' on somebody to want it. sexton faddick keeps half an eye on it between his wolves and his list of kept places - go say hello, let him know you're the kind that stays... after that the ground's yours to claim, whenever you're ready for it.",
      completion:
        "there it is... you got the look now, friend, the one that says you ain't just passin' through no more. go on, plant your feet somewhere out there. i'll keep the hearth lit same as always, and the vase'll know right where to find you...",
      objectives: { 0: { label: 'Sexton Faddick met' } },
      dialog: {
        complain: 'Ground? I just wanted to say hi to your plant.',
        complainReply:
          "and you can, anytime, he ain't goin' anywhere... but a soul needs more than a shrine to visit, friend, it needs somewhere to plant its own two feet. won't take long. faddick talks slow but he don't waste your afternoon.",
        refuse: "I don't need a homestead. I'm happy just visiting.",
        refuseReply:
          "...alright, alright, no pressure in it, friend, the ground'll keep same as faddick keeps it, waitin' don't cost it nothin'... here, take this anyway, for stickin' around this long. that's its own kind of home, i guess.",
      },
    },
    q_root_hollow_boars: {
      title: "Root Hollow's Boars",
      text: 'By the calendar, Root Hollow rests this season. The boars have not been informed. They have rooted up half of it chasing grubs, and they no longer scatter when a heron flaps at them, which I take personally. Cull five, and I can enter the season as observed.',
      completion:
        'Five. Counted, dated, and entered in the register. Root Hollow is now only a fortnight behind its own season, which in this office we call a triumph. My thanks, on behalf of an order that is, at present, me.',
      objectives: { 0: { label: 'Wild Boar slain' } },
    },
    // PHAA-560: the closing aside about the register is new (a tribe-mystery
    // breadcrumb); kept identical to the sim record in
    // src/sim/content/hollow_zone.ts, non-Latin fills live in src/ui/i18n.locales/.
    q_root_hollow_boars_ii: {
      title: "Root Hollow's Reckoning",
      text: 'I will admit what the office discourages admitting: five was optimistic. The lower dens keep pushing up more. Eight further, and I can close the season without amending the record a third time. The record resents amendment. So do I.',
      completion:
        'Closed. Signed. Filed. The season may proceed exactly as scheduled, now that there is once more someone to keep the schedule. You have been a great help to a very small congregation. The congregation, I should clarify, is me. The register itself is older than that arrangement, bound in a hand I have never met, keeping a count I choose not to add. Someone was thorough here, once. I only try to keep pace.',
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
    // PHAA-558: kept identical to the sim records in src/sim/content/hollow_zone.ts;
    // non-Latin fills live in src/ui/i18n.locales/<lang>.ts (maintainer-refined).
    q_have_you_eaten: {
      title: 'Have You Eaten?',
      text: "There's a bard at the gate who plays for coppers and eats when the coppers come, which isn't often. I've got a bowl warm and one to spare. Carry it down to him, would you? And don't tell him it was pity. Tell him it was extra.",
      completion:
        "You're back. Did he eat? Good. That's good. And did you? ... You didn't, I can see it. Sit, then. You don't have to be great to be something good. Greatness isn't kindness. Eat.",
      objectives: { 0: { label: 'Warm meal carried to the bard' } },
    },
    q_someone_your_own_size: {
      title: 'Someone Your Own Size',
      text: "There's a woman near Root Hollow the world has been unkind to. Her name was struck from the register, and people treat a struck name like it can't hear. Go and sit with her a while. You don't have to fix anything. Just be someone her own size.",
      completion:
        "You stayed. She won't say it mattered, but it did, I promise you it did. Here, this is for you. A sprig off a willow I'm fond of. It does nothing at all. It only remembers that you were kind when nothing made you.",
      objectives: { 0: { label: 'Sat a while with Orla' } },
    },
    // PHAA-614: kept identical to the sim records in
    // src/sim/content/hollow_zone.ts; non-Latin fills live in
    // src/ui/i18n.locales/<lang>.ts (maintainer-refined).
    q_the_long_way_around: {
      title: 'The Long Way Around',
      text: "There's a planting the tribe left half-finished up the old willow, and it's dying for want of one good pour. I can't make that climb anymore, but you've got the legs for it. Take the can. Mind the branches; they hold if you're honest with them.",
      completion:
        "It'll live now. You wouldn't think one climb and one pour was much, against everything else out there. It isn't much. It's only everything to the one thing you poured it on.",
      objectives: { 0: { label: 'Water carried up the willow path' } },
    },
    q_the_watering_can: {
      title: 'The Watering Can',
      text: "I've asked you for small things, and you've done them all without once asking why. Here's the last one, and it isn't small, though it'll look it. Take my can down under the shrine, to the thing that's buried there, and give it water. It's been waiting a long time to be given something instead of asked for something.",
      completion:
        'You did it. Of course you did. That was the water, you understand. All of it, all the way back to the day you found me at the lake and thought nothing of it. The same pour, the same promise, kept one more time. Thank you. Now go and be gentle with the world. It is the only thing that ever changed it.',
      objectives: { 0: { label: 'Water given to the buried root' } },
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
  // World-placed readable books (PHAA-552). The resolver reads this English
  // source (the reader UI calls tEntity via the `readable` kind); it is kept
  // byte-identical to the sim record in src/sim/content/readables.ts, and the
  // non-Latin fills live in src/ui/i18n.locales/<lang>.ts.
  readables: {
    torn_ledger_page: {
      title: 'A Torn Ledger',
      pages: {
        0: 'Root Hollow, entered to rest. Fallow Acres, entered to rest. The lake at Mossbank, which rests whether we enter it or not. Signed and dated, as the register wants.',
        1: 'Tally of the season so far: three seedlings up through the road stones, which is not on any calendar of mine. I have stopped scratching them out. They come back faster than the ink dries, and the ink was not cheap.',
        2: 'A note to whoever keeps this after me. Count the boars, count the wolves, count the days. Do not count the green. It counts back, and it does not stop where you do.',
      },
    },
    keepers_marginalia: {
      title: "A Keeper's Marginalia",
      pages: {
        0: 'Left in the margin of a hymnbook with the hymns worn out of it. The hand is quick, the way a hand is quick when it writes while walking.',
        1: 'The wolves circle Fallow Acres from the tree line, always the same ring, always sunwise. A thing that circles long enough learns the shape of what it circles. So do I. So, I think, does the ground.',
        2: 'If you are reading this you have stopped walking, which is the one thing I never learned to do. Rest a moment. The Reaches will still be here. That is rather the whole trouble with it.',
      },
    },
  },
};

export const hollowEntities = { en: hollowEntitiesEn };
