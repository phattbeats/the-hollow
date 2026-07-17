import type { Role } from '../sim/content/talents';

export type { DungeonFinderInfo } from '../sim/social/dungeon_finder';

export interface IWorldDungeonFinder {
  // Live queue-status snapshot for the local player (null when not queued).
  dungeonFinderInfo: import('../sim/social/dungeon_finder').DungeonFinderInfo | null;
  // Join the solo Dungeon Finder queue as the given role (must be one the
  // player's class can fill, see sim/social/dungeon_finder.ts classRoles).
  // dungeonId defaults to the sole pre-10 eligible dungeon when omitted.
  dungeonFinderQueueJoin(role: Role, dungeonId?: string): void;
  dungeonFinderQueueLeave(): void;
}
