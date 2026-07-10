// World-placed readable books/journals (PHAA-552): the "clickable items a la
// wow where its random journals or books you find lying around" the board asked
// for on PHAA-439. Distinct from PHAA-480's NPC gossip-menu "read the journal"
// button (that lives inside an NPC's dialog); these are standalone objects
// placed in the world that the player walks up to and reads.
//
// Placed in The Hollow Reaches (the_hollow_reaches), the open-world starter zone
// (PHAA-420), near the roads leaving the gate clearing so a new player finds one
// early. Standalone lore in the Reaches keepers' dry, calendar-and-register
// voice (see verger_zebediah / sexton_faddick greetings in content/hollow_zone.ts);
// they reference no NPC's journalLines, so they get their own `readable`
// entity-i18n kind (src/ui/entity_i18n.ts).
//
// Adding a readable touches only this file plus the render prop that draws it
// (src/render/readables.ts) and the entity-i18n manifest for its text. Reading
// is client-only, so there is no sim state, server command, or wire field.

import type { ReadableDef } from '../types';

// How close (world units) the player must stand for the "Read" prompt to show
// and the interact key to open the book. Shared by the render proximity check
// (src/render/readable_proximity.ts) and any consumer, so the glow prompt and
// the interact-key handler agree on one radius. Books are small, so this is
// tighter than a mob's INTERACT_RANGE: the player stands right over the book.
export const READ_RADIUS = 3;

export const READABLES: ReadableDef[] = [
  // Just off the gate clearing where the road splits (PHAA-420: gate at z ~ -270),
  // dropped by a warden mid-count. The first readable a player is likely to meet.
  {
    id: 'torn_ledger_page',
    zoneId: 'the_hollow_reaches',
    pos: { x: 6, z: -262 },
    facing: 2.4,
    // A single sheet the warden tore loose and dropped, not a bound book.
    prop: 'page',
    // Dropped on a fieldstone in the grass, the look the board signed off on.
    support: 'stone',
    title: 'A Torn Ledger Page',
    pages: [
      'Root Hollow, entered to rest. Fallow Acres, entered to rest. The lake at Mossbank, which rests whether we enter it or not. Signed and dated, as the register wants.',
      'Tally of the season so far: three seedlings up through the road stones, which is not on any calendar of mine. I have stopped scratching them out. They come back faster than the ink dries, and the ink was not cheap.',
      'A note to whoever keeps this after me. Count the boars, count the wolves, count the days. Do not count the green. It counts back, and it does not stop where you do.',
    ],
  },
  // West road toward Fallow Acres, near the wolf-troubled flock ground.
  {
    id: 'keepers_marginalia',
    zoneId: 'the_hollow_reaches',
    pos: { x: -42, z: -244 },
    facing: 1.1,
    // Margin notes in a worn hymnbook, so this one is an actual open notebook.
    prop: 'journal',
    // Left open on a rough field table at the flock-ground watch post.
    support: 'table',
    title: "A Keeper's Marginalia",
    pages: [
      'Left in the margin of a hymnbook with the hymns worn out of it. The hand is quick, the way a hand is quick when it writes while walking.',
      'The wolves circle Fallow Acres from the tree line, always the same ring, always sunwise. A thing that circles long enough learns the shape of what it circles. So do I. So, I think, does the ground.',
      'If you are reading this you have stopped walking, which is the one thing I never learned to do. Rest a moment. The Reaches will still be here. That is rather the whole trouble with it.',
    ],
  },
];

// Support variety (PHAA-552 board follow-up: "we need other variations, like it
// up against a tree, or on a chest, or a table, that way we can put them in many
// places"): the two placements above already exercise `stone` and `table` live.
// The renderer draws all four supports (stone/table/chest/tree, see
// ReadableSupport + src/render/readables.ts); placing new readables on `chest`
// and `tree` in the world is a pure data addition here, but each new readable
// also needs its title+pages translated across the 20 shipped locales (real
// translations, see src/ui/i18n.catalog/hollow.ts + src/ui/i18n.locales/*.ts;
// the release-gate localization suite rejects English left in a translated
// build). So new chest/tree placements come with a translation pass, tracked
// separately, rather than shipping untranslated content here.
