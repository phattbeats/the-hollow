import type { DeedProgress } from '../sim/types';

// Book of Asphodelia (PHAA-744): read-only deed/title state + the one title
// command. Deeds auto-track from character creation (no accept/turn-in surface,
// unlike IWorldQuests); content (the authored deed/title roster) lands in
// PHAA-745, the cross-surface UI in PHAA-748.
//
// PHAA-748 extends the read surface with two per-player queries
// (`activeTitleFor(pid)`, `earnedTitlesFor(pid)`) so the cross-surface renderers
// (nameplate, unit frames, chat, inspect, leaderboard) only ever talk to
// IWorld: never to Sim/ClientWorld concrete classes. The methods return
// `null` / an empty Set for unknown pids; the local player is also covered
// (read from PlayerMeta.earnedTitles/.activeTitle in Sim, from the per-pid
// mirror map fed by the identity-record decode in ClientWorld).
export interface IWorldDeeds {
  deedLog: Map<string, DeedProgress>;
  deedsDone: Set<string>;
  earnedTitles: Set<string>;
  activeTitle: string | null;
  setActiveTitle(titleId: string | null): void;
  /** The TitleDef id the player pid is currently displaying (null when none).
   *  Book of Asphodelia titles only; both worlds return null for unknown pids. */
  activeTitleFor(pid: number): string | null;
  /** The earned TitleDef ids the player pid has earned (empty when none / unknown). */
  earnedTitlesFor(pid: number): Set<string>;
}
