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

  // Home / overview landing. Fleshed out with the full hero and teasers next phase.
  home: {
    eyebrow: "Classic-style browser MMO",
    title: "World of ClaudeCraft",
    subtitle: "Quest, group up, and explore a hand-built world, free in your browser.",
    ctaPlay: "Play Now",
    ctaLearn: "How to Play",
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
