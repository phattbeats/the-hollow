import type { DeedProgress } from '../sim/types';

// Book of Asphodelia (PHAA-744): read-only. Deeds carry no accept step and
// complete automatically, so there is no command surface here, only the
// mirrored progress/completion/title state. No content ships in this child;
// a later Book of Asphodelia child adds DEEDS entries that populate these.
export interface IWorldDeeds {
  deedLog: Map<string, DeedProgress>;
  deedsDone: Set<string>;
  earnedTitles: Set<string>;
}
