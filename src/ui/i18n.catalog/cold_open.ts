// i18n source catalog - the one-time cold-open intro (cold_open.ts), shown to a
// fresh character before the first-errand tutorial. English values only; the
// locale translations live in src/ui/i18n.locales/<lang>.ts (the runtime-
// authoritative overlays), filled by the maintainer at release. The five
// non-Latin fills for the wordy prose (wake/orient bodies, continue, begin,
// title) ship in the SAME change (the M16 completeness gate, see src/ui/CLAUDE.md).
//
// Assembled into `en` by ./index.ts under the `coldOpen` namespace. Like
// hud_chrome.ts / guide.ts this module carries NO per-locale blocks (no
// `as const`), so a new intro string is an English-only add that compiles.

export const coldOpenStrings = {
  title: 'The Hollow',
  // Card 1, the amnesia framing (Brandon's PHAA-429 playtest draft, amnesia-over-hub).
  wakeBody:
    'You come to on warm ground, no memory of your name, your people, or how you got here. Green light pools from a great vase ahead, and something about it feels like it has been waiting.',
  // Card 2, a beat to reorient in the shrine, then point the player at the light
  // (and the NPC tending the flame beyond it) before the tutorial takes over.
  orientBody:
    'The shrine is quiet, and the smell of smoke lingers. Take a moment to find your footing. When you are ready, follow the green light: someone tends the flame ahead, and may know what you have lost.',
  continue: 'Continue',
  begin: 'Begin',
  skip: 'Skip',
};
