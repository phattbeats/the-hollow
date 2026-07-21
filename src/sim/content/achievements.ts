// Achievement registry (PHAA-687): the data-as-code layer listing every
// discrete accomplishment a character can unlock. Net-new and ALONGSIDE
// MILESTONES (the lifetime-XP ladder, src/sim/types.ts MilestoneDef), never
// folded into it. The engine that tracks progress and unlocks these lives in
// ../achievements_core.ts (pure) with the sim wiring in ../achievements.ts;
// this module is purely declarative and merged by ../data.ts.
//
// This is the seed set. Only collect-category achievements are wired end to end
// today (driven by the PHAA-626 `collectibleFound` event, reusing its
// server-authoritative collection-progress path). The engine already type-
// supports kill/explore/quest criteria; those categories light up as their
// event hooks land in follow-ups, and the (sibling) achievements UI panel is
// coordinated with the PHAA-625 collections panel so they are one panel family.
//
// Player-facing achievement NAMES/DESCRIPTIONS are intentionally NOT defined
// here yet: nothing renders them this slice (there is no toast or panel), so no
// t()/entity_i18n surface is introduced. They land with the UI panel child, via
// a new `achievement` entity_i18n kind, English-only per the contributor rule.

import type { AchievementDef } from '../achievements_core';

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    // Read your first piece of Hollow lore (any collectible).
    id: 'first_pages',
    category: 'collect',
    criteria: [{ kind: 'collectAny', count: 1 }],
    points: 5,
  },
  {
    // Read both of the Hollow's placed field books.
    id: 'hollow_archivist',
    category: 'collect',
    criteria: [
      { kind: 'collect', collectibleId: 'torn_ledger_page' },
      { kind: 'collect', collectibleId: 'keepers_marginalia' },
    ],
    points: 10,
  },
];
