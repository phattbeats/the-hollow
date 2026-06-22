// i18n source catalog - the public Guide (docs/wiki) surface at /guide. A curated,
// branded front-of-house that explains the game, teaches the basics, and showcases
// classes, the bestiary, quests, and group content, separate from the community
// MediaWiki at /wiki. English values only; the 13 locale translations live in
// src/ui/i18n.locales/<lang>.ts (the runtime-authoritative overlays), filled by the
// maintainer at release.
//
// Assembled into `en` by ./index.ts under the `guide` namespace. Like hud_chrome.ts
// this module carries NO per-locale blocks (no `as const`), so a new Guide string is
// an English-only add that compiles; the translations live solely in the overlays.

export const guideStrings = {
  // Brand + shared chrome.
  brand: "World of ClaudeCraft",
  brandShort: "ClaudeCraft",
  tagline: "A classic-style MMO you play free in your browser.",
  skipToContent: "Skip to main content",
  loading: "Loading...",
  // Browser tab title: "{page} - {brand}". Hyphen separator (not an en dash).
  docTitle: "{page} - {brand}",

  // Top navigation + sidebar controls.
  nav: {
    overview: "Overview",
    howToPlay: "How to Play",
    classes: "Classes",
    bestiary: "Bestiary",
    world: "World",
    quests: "Quests",
    dungeons: "Dungeons & Raids",
    reference: "Reference",
    controls: "Controls",
    combat: "Combat",
    glossary: "Glossary",
    faq: "FAQ",
    playNow: "Play Now",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    primary: "Guide sections",
    topics: "Topics",
    onThisPage: "On this page",
    backToGame: "Back to the game",
  },

  // Sidebar section groupings.
  groups: {
    start: "Get Started",
    compendium: "Compendium",
    reference: "Reference",
  },

  // Footer.
  footer: {
    blurb: "An open-source, classic-style micro-MMO. Quest, group up, and explore a hand-built world, right in your browser.",
    playNow: "Play Now",
    github: "Source on GitHub",
    discord: "Join the Discord",
    communityWiki: "Community Wiki",
    rights: "World of ClaudeCraft",
  },

  // Language picker.
  language: {
    label: "Language",
    select: "Choose a language",
  },

  // Home / overview landing.
  home: {
    eyebrow: "Classic-style browser MMO",
    title: "World of ClaudeCraft",
    subtitle: "Quest, group up, and explore a hand-built world, free in your browser.",
    ctaPlay: "Play Now",
    ctaLearn: "How to Play",

    // "What is it" benefit trio.
    what: {
      heading: "A classic MMO, made to be picked up",
      pillarPlayTitle: "Play in your browser",
      pillarPlayBody: "No download, no launcher. Make a character and you are in the world in seconds, on desktop or phone.",
      pillarClassesTitle: "Nine classes, three roles",
      pillarClassesBody: "Tank, heal, or deal the damage. Every class plays the way its archetype should, with talents to make it yours.",
      pillarOpenTitle: "Free and open source",
      pillarOpenBody: "Free to play to the level cap, with the whole game open source. No pay to win, ever.",
    },

    // Class chooser teaser.
    classes: {
      heading: "Choose your class",
      sub: "Nine classic archetypes, each with its own feel and party role.",
      cta: "Explore the classes",
    },

    // World teaser.
    world: {
      heading: "Explore the world",
      sub: "One continuous land, three zones, from quiet valleys to frozen peaks.",
      levels: "Levels {min} to {max}",
      cta: "See the world",
      valeName: "Eastbrook Vale",
      valeBlurb: "Green hills and old woods where every adventure begins.",
      marshName: "Mirefen Marsh",
      marshBlurb: "Sunken fens and tide-worn ruins, home to murlocs and worse.",
      peaksName: "Thornpeak Heights",
      peaksBlurb: "Wind-scoured ridges climbing toward the realm's coldest dangers.",
    },

    // Group content teaser.
    group: {
      heading: "Group up for the hard parts",
      sub: "The world is soloable, but the best loot waits behind a good party.",
      dungeonsTitle: "Dungeons",
      dungeonsBody: "Instanced dives for a party of five, scaling with the zones around them.",
      raidTitle: "The raid",
      raidBody: "A ten-player capstone for those who reach the top of the world.",
      arenaTitle: "The arena",
      arenaBody: "Step into the Ashen Coliseum and prove yourself against other players.",
      cta: "Dungeons and Raids",
    },

    // Short FAQ.
    faq: {
      heading: "Good to know",
      q1: "Is it free to play?",
      a1: "Yes. The whole game is free to the level cap, and it is open source on GitHub.",
      q2: "Do I need a crypto wallet?",
      a2: "No. The game is fully playable without one. The optional community token only unlocks cosmetic flair and never affects power.",
      q3: "Can I play offline?",
      a3: "Yes. There is an instant single-player mode in your browser, plus the shared online realm.",
      q4: "How long to reach max level?",
      a4: "The cap is level {cap}, reached across three zones of quests, dungeons, and exploration.",
    },

    // Community call to action.
    community: {
      heading: "Join the realm",
      body: "Jump in now, or come say hello. The world is better with company.",
      play: "Play Now",
      discord: "Join the Discord",
      github: "Star on GitHub",
    },
  },

  // How to Play / Basics (the newcomer tutorial page).
  howToPlay: {
    intro: "New to this kind of game? You will be questing in minutes. Here is the short version, one step at a time.",
    firstHeading: "Your first 15 minutes",
    step1Title: "Make a character",
    step1Body: "Pick a class and a look, give your hero a name, and enter the world. You can make more characters later.",
    step2Title: "Find your first quest",
    step2Body: "Marshal Redbrook is waiting in the starting town. Talk to him and accept Wolves at the Door.",
    step3Title: "Move and look around",
    step3Body: "Move with W, A, S, D. Hold the right mouse button and drag to look around. That is most of it.",
    step4Title: "Fight something",
    step4Body: "Press Tab to target the nearest enemy, then press your abilities on the bar (keys 1 through 0) to attack.",
    step5Title: "Turn it in",
    step5Body: "Finish the objective, return to the quest giver (look for the marker on your map), and collect your reward.",
    step6Title: "Keep going",
    step6Body: "You just hit level 2. Follow the quest trail out of town and the world opens up from there.",
    basicsHeading: "The basics",
    resourcesTitle: "Resources",
    resourcesBody: "Spells and abilities cost a resource. Warriors build Rage by fighting, rogues spend Energy that refills on its own, and everyone else casts from a pool of Mana.",
    targetingTitle: "Targeting and your bar",
    targetingBody: "Tab cycles enemies, F interacts and loots, and your action bar holds the abilities you have learned. Drag spells onto it from your spellbook.",
    questsTitle: "Quests",
    questsBody: "Accept quests from people with a marker over their head, complete the objective, and turn them in for experience, coin, and gear. The tracker on screen keeps your goals in view.",
    deathTitle: "Death is not the end",
    deathBody: "If you fall, you release your spirit at the nearest graveyard and run back to your body. No experience is lost.",
    groupingTitle: "Playing together",
    groupingBody: "Invite others to a party to share quest credit and take on dungeons. Most of the world is soloable, so grouping is a choice, not a chore.",
    onlineTitle: "Online or offline",
    onlineBody: "Play the shared online realm with everyone else, or start an instant offline world in your browser to learn the ropes.",
    reassure: "Talents unlock at level 10 and can be reset at any time, so your early choices are never permanent. Experiment freely.",
    controlsLink: "See the full controls reference",
  },

  // Controls reference (most action labels reuse the shared controls.* catalog).
  controls: {
    intro: "Default keys for desktop. Every binding can be changed in the game's options.",
    keyHeader: "Key",
    actionHeader: "Action",
    groupMovement: "Movement",
    groupCombat: "Targeting and combat",
    groupInterface: "Windows",
    groupCamera: "Camera",
    talents: "Talents",
    arena: "Arena",
    leaderboard: "Leaderboard",
    abilities: "Use abilities",
    mobileHeading: "On mobile",
    mobileBody: "Touch controls appear automatically on phones and tablets: a movement stick on the left, drag anywhere on the right to look, and on-screen buttons for your abilities and menus.",
  },

  // Combat overview. Deliberately high level: concepts, not formulas or numbers, so
  // there is nothing here to min-max or exploit.
  combat: {
    intro: "Combat follows familiar classic-MMO rules. You never need to study any of it to play well, this is just the shape of how fights work.",
    hitTitle: "Not every blow lands",
    hitBody: "Attacks can miss or be dodged, parried, and blocked, and so can the enemy's. Fighting near your own level and keeping your gear current is what makes your hits connect.",
    mitigationTitle: "Armor and gear keep you standing",
    mitigationBody: "Armor softens physical hits and the right gear blunts magic, so upgrades are your main source of staying power. Heavier armor classes shrug off more, but nothing makes you untouchable.",
    resourcesTitle: "Every class has its own rhythm",
    resourcesBody: "Warriors build Rage in the thick of a fight, rogues spend Energy that steadily returns, and casters manage a pool of Mana. Learning your resource is half of playing your class well.",
    growTitle: "You grow stronger every level",
    growBody: "Each level makes you tougher and unlocks new abilities, all the way to the cap of level {cap}. Questing is the fastest way up; dungeons and exploration round it out.",
  },

  // Glossary.
  glossary: {
    intro: "A quick reference for the terms used across this guide and in chat.",
    aggroTerm: "Aggro",
    aggroDef: "An enemy's attention. The player generating the most threat holds aggro and gets attacked.",
    gcdTerm: "Global cooldown",
    gcdDef: "The short, shared pause after using most abilities, so you cannot fire everything at once.",
    dpsTerm: "DPS",
    dpsDef: "Damage per second, a rough measure of how fast something deals damage.",
    eliteTerm: "Elite",
    eliteDef: "A tougher-than-normal enemy, usually meant for a group. Dungeon and rare enemies are often elite.",
    rareTerm: "Rare",
    rareDef: "An uncommon named enemy that wanders a zone and drops better loot.",
    tankTerm: "Tank",
    tankDef: "The party member who holds enemy aggro and absorbs the damage so others can fight safely.",
    healerTerm: "Healer",
    healerDef: "The party member who keeps everyone alive with healing spells.",
    pullTerm: "Pull",
    pullDef: "To draw an enemy or group into a fight, usually deliberately and one batch at a time.",
    instanceTerm: "Instance",
    instanceDef: "A private copy of a dungeon or raid made just for your party.",
  },

  // FAQ page (fuller than the home teaser).
  faqPage: {
    intro: "The questions new players ask most often.",
    q1: "Is it really free?",
    a1: "Yes. The whole game is free to play to the level cap, and the source code is open on GitHub.",
    q2: "Do I need a crypto wallet or any tokens?",
    a2: "No. The game is fully playable without one. The optional community token only unlocks cosmetic flair and never affects power or progression.",
    q3: "Can I play on my phone?",
    a3: "Yes. The game runs in a mobile browser with touch controls, and there is a desktop launcher as well.",
    q4: "Can I play offline or solo?",
    a4: "Yes. There is an instant single-player offline mode, and the online world is fully soloable apart from dungeons and the raid.",
    q5: "How many classes are there?",
    a5: "Nine, covering the classic tank, healer, and damage roles, each with its own resource and signature abilities.",
    q6: "What is the level cap?",
    a6: "Level {cap}, reached across three connected zones of quests, dungeons, and exploration.",
    q7: "Will my character be saved?",
    a7: "Online characters are saved on the server automatically. Offline characters live in your browser for quick sessions and testing.",
    q8: "Can I host my own copy?",
    a8: "Yes. The project is open source, so you can run your own server. See the GitHub repository.",
  },

  // Classes index + per-class pages.
  classList: {
    heading: "The nine classes",
    sub: "Tank, heal, or deal the damage. Pick the fantasy that calls to you, then make it your own with talents.",
  },
  role: {
    tank: "Tank",
    healer: "Healer",
    damage: "Damage",
  },
  resourceName: {
    rage: "Rage",
    mana: "Mana",
    energy: "Energy",
  },
  classPage: {
    back: "All classes",
    roleLabel: "Plays as",
    resourceLabel: "Resource",
    specsHeading: "Specializations",
    abilitiesHeading: "Signature abilities",
    abilitiesNote: "A taste of the kit. You learn more as you level, and talents reshape how it all plays.",
  },
  // Spoiler-safe fantasy hooks, one per class. Used on the index card and the class page.
  classHook: {
    warrior: "A relentless front-line fighter who turns every blow taken into fuel for the next.",
    paladin: "A holy warrior who can shield allies, mend their wounds, or bring the hammer down.",
    hunter: "A ranged marksman with a loyal beast at their side and a trick for every foe.",
    rogue: "A master of stealth and poisons who strikes from the shadows and never fights fair.",
    priest: "A devoted healer whose light keeps the party standing, or whose shadow unmakes the enemy.",
    shaman: "A spirit-caller who bends storm, fire, and water, and mends allies between the lightning.",
    mage: "A spellweaver of fire, frost, and arcane who controls the battlefield from afar.",
    warlock: "A dark conjurer who commands demons and curses, trading life for devastating power.",
    druid: "A shapeshifter who tanks as a bear, savages foes as a cat, or heals in the thick of it.",
  },

  // Generic placeholder for sections still being written (build scaffolding).
  placeholder: {
    note: "This part of the guide is on its way.",
  },

  // 404 / unknown route.
  notFound: {
    title: "We could not find that page",
    body: "The page you were looking for does not exist or may have moved.",
    home: "Back to the overview",
  },
};
