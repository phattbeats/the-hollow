// ---------------------------------------------------------------------------
// Achievements (PHAA-687): server-authoritative, read-only view of the local
// viewer's unlocked achievements and their WoW-style point score. Net-new and
// ALONGSIDE MILESTONES (the lifetime-XP ladder), never folded into it.
//
// Unlike IWorldCollections, this facet has NO command: achievements auto-unlock
// as accomplishments accrue (a collectible found, a mob killed, ...), so the
// client only ever mirrors state, never asks to unlock. The (sibling-ticket) UI
// panel joins `unlockedAchievementIds` against src/sim/data.ts ACHIEVEMENTS_BY_ID
// for category/name/points; no per-category breakdown lives here.
// ---------------------------------------------------------------------------

export interface IWorldAchievements {
  /** The local viewer's unlocked achievement ids (server-authoritative). */
  unlockedAchievementIds: string[];
  /** Total achievement points from the viewer's unlocked achievements. */
  achievementPoints: number;
}
