// Pure, host-agnostic view model for the Dungeon Finder window (PHAA-736).
//
// The pure-core half of the pure-core + thin-painter split (root CLAUDE.md
// Conventions; reference arena_window_view.ts / vendor_view.ts). Phase 1 is a
// solo-role queue for a single pre-10 dungeon, so the model is much smaller than
// the arena's: which of the three roles the player's class can fill, and whether
// they are idle or already queued. DOM/i18n-free; the painter (dungeon_finder_window.ts)
// turns this into markup and localizes the dungeon name.
//
// `info === null` is the offline / not-yet-synced state (mirrors ArenaInfo), fed
// both a Sim-shaped and a ClientWorld-mirror-shaped stub in the tests.

import type { Role } from '../sim/content/talents';
import { classRoles, DUNGEON_FINDER_DUNGEON_IDS } from '../sim/social/dungeon_finder';
import type { PlayerClass } from '../sim/types';
import type { DungeonFinderInfo } from '../world_api';

const ALL_ROLES: readonly Role[] = ['tank', 'healer', 'dps'];

export interface DungeonFinderRoleOption {
  role: Role;
  available: boolean;
}

export type DungeonFinderPanelView =
  | { kind: 'offline' }
  | { kind: 'idle'; roles: DungeonFinderRoleOption[]; dungeonId: string; sig: string }
  | {
      kind: 'queued';
      role: Role;
      dungeonId: string;
      position: number;
      sig: string;
    };

export interface DungeonFinderViewInput {
  info: DungeonFinderInfo | null;
  playerClass: PlayerClass;
}

/** Build the Dungeon Finder view-model. Reads only IWorld-mirrored data (the
 *  DungeonFinderInfo snapshot) plus the viewer's class, so the offline Sim and
 *  the online ClientWorld mirror produce identical output. */
export function buildDungeonFinderView(input: DungeonFinderViewInput): DungeonFinderPanelView {
  const { info, playerClass } = input;
  if (!info) return { kind: 'offline' };

  if (info.queued && info.role && info.dungeonId) {
    return {
      kind: 'queued',
      role: info.role,
      dungeonId: info.dungeonId,
      position: info.position,
      sig: JSON.stringify(['queued', info.role, info.dungeonId, info.position]),
    };
  }

  const roles: DungeonFinderRoleOption[] = ALL_ROLES.map((role) => ({
    role,
    available: classRoles(playerClass).includes(role),
  }));
  return {
    kind: 'idle',
    roles,
    dungeonId: DUNGEON_FINDER_DUNGEON_IDS[0],
    sig: JSON.stringify(['idle', playerClass]),
  };
}
