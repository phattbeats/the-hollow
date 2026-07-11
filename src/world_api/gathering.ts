// ---------------------------------------------------------------------------
// Gathering v0/v1 (PHAA-504 corpse harvest; PHAA-505 per-player world-node
// harvest + proficiency): the profession-harvest command surface. Corpse
// harvest is single-use and first-come; a world node is per-player (every
// player who reaches it harvests their own instance, on their own respawn
// timer). See src/sim/gathering.ts for both.
//
// `nodeHarvestableByMe` is per-VIEWER, never global: two players asking about
// the same node id can get different answers, because each player's respawn
// timer for a node is independent. `gatheringProficiency` is the local
// viewer's own per-node-type harvest counter (mirrored from the server; a
// future proficiency-scaled rarity roll reads it server-side).
// ---------------------------------------------------------------------------

import type { GatherNodeType } from '../sim/types';

export interface IWorldGathering {
  /** Harvest a dead mob's corpse for profession components (server re-checks range/claim). */
  harvestCorpse(id: number): void;
  /** Whether the given gather node is harvestable right now by the local viewer. */
  nodeHarvestableByMe(nodeId: string): boolean;
  /** Harvest a world gather node (server re-checks range/the viewer's own respawn timer). */
  harvestNode(nodeId: string): void;
  /** The local viewer's own per-node-type harvest counter. */
  gatheringProficiency: Record<GatherNodeType, number>;
}
