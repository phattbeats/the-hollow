import type { DeedProgress } from '../sim/types';

// Book of Asphodelia (PHAA-744): read-only deed/title state + the one title
// command. Deeds auto-track from character creation (no accept/turn-in surface,
// unlike IWorldQuests); content (the authored deed/title roster) lands in
// PHAA-745, the cross-surface UI in PHAA-748.
export interface IWorldDeeds {
  deedLog: Map<string, DeedProgress>;
  deedsDone: Set<string>;
  earnedTitles: Set<string>;
  activeTitle: string | null;
  setActiveTitle(titleId: string | null): void;
}
