// Pure, host-agnostic core for the gathering HUD (PHAA-508, ports upstream
// #1194): per-viewer node ready/cooldown classification, the gathering
// proficiency display rows, and (this repo's crafted-tool gating, PHAA-507) the
// player's best owned gathering-tool tier per node type.
//
// DOM/Three-free so tests/gathering_view.test.ts can drive it directly. Two
// consumers read this core's output:
//   - minimap_markers.ts projects nearby node positions to canvas pixels and
//     asks classifyGatherNode for each one's ready/cooldown state (the
//     world-space indicator, see IWorldGathering#nodeHarvestableByMe).
//   - char_window.ts renders buildGatheringProficiencyRows +
//     buildGatheringToolRows as the "Gathering" section of the character sheet
//     (the proficiency + tool read surface).
//
// `nodeHarvestableByMe` is per-VIEWER (see src/world_api/gathering.ts): two
// different IWorld-shaped inputs (one per player) asking about the SAME node id
// can and do return different states, because each player's respawn timer for a
// node is independent. This core never assumes otherwise: it always re-resolves
// through the passed-in `world`, never caches across callers.
//
// Hollow keys gathering by GatherNodeType (amber/heartwood/spore), NOT
// upstream's mining/logging/herbalism profession ids: IWorldTrainer already
// owns "professions" here (the multiclass secondary-class trainer), so both
// proficiency (IWorldGathering#gatheringProficiency) and tool gating
// (src/sim/gathering_tools.ts) key off the node type. See gathering_tools.ts.

import { GATHER_NODE_TYPES, GATHER_NODES, ITEMS } from '../sim/data';
import { gatherToolTier } from '../sim/gathering_tools';
import type { GatherNodeType } from '../sim/types';
import type { IWorld } from '../world_api';

/** Whether a gather node is harvestable right now for the local viewer, or on
 *  cooldown (respawning) for them specifically (another player may see the
 *  opposite state for the same node id). */
export type GatherNodeState = 'ready' | 'cooldown';

/** Resolves one node's per-viewer state via IWorldGathering#nodeHarvestableByMe. */
export function classifyGatherNode(world: IWorld, nodeId: string): GatherNodeState {
  return world.nodeHarvestableByMe(nodeId) ? 'ready' : 'cooldown';
}

/** One nearby gather node, classified for the local viewer. */
export interface NearbyGatherNode {
  id: string;
  type: GatherNodeType;
  x: number;
  z: number;
  state: GatherNodeState;
}

/** All GATHER_NODES within `radiusYd` of the viewer's current position,
 *  classified ready/cooldown for that viewer. Flat 2D distance (node
 *  placements carry no y, matching src/sim/gathering.ts). */
export function buildNearbyGatherNodes(world: IWorld, radiusYd: number): NearbyGatherNode[] {
  const p = world.player;
  const out: NearbyGatherNode[] = [];
  for (const node of GATHER_NODES) {
    const dx = node.pos.x - p.pos.x;
    const dz = node.pos.z - p.pos.z;
    if (Math.sqrt(dx * dx + dz * dz) > radiusYd) continue;
    out.push({
      id: node.id,
      type: node.type,
      x: node.pos.x,
      z: node.pos.z,
      state: classifyGatherNode(world, node.id),
    });
  }
  return out;
}

/** One row of the gathering-proficiency display: a node type plus the viewer's
 *  current harvest-counter value, in the fixed GATHER_NODE_TYPES order. */
export interface GatheringProficiencyRow {
  nodeType: GatherNodeType;
  value: number;
}

/** Builds the proficiency display rows from IWorldGathering#gatheringProficiency,
 *  in the fixed node-type order, defaulting an absent/malformed entry to 0. */
export function buildGatheringProficiencyRows(world: IWorld): GatheringProficiencyRow[] {
  const prof = world.gatheringProficiency;
  return GATHER_NODE_TYPES.map((nodeType) => {
    const raw = prof?.[nodeType];
    const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, raw) : 0;
    return { nodeType, value };
  });
}

/** One row of the tool-gating display: a node type plus the highest tier of
 *  crafted gathering tool the viewer currently owns for it, or null when they
 *  own none. A higher-tier tool gates a higher-tier harvest (PHAA-507
 *  canGatherTier); surfacing the owned tier tells the player what they can
 *  currently work without inventing any node-tier balance data. */
export interface GatheringToolRow {
  nodeType: GatherNodeType;
  tier: number | null;
}

/** Builds the tool-gating rows: the viewer's best owned gathering-tool tier per
 *  node type, in the fixed node-type order. Scans the pooled bag inventory
 *  (crafted gathering tools are `kind:'tool'` bag items, never equipped) and
 *  resolves each item's tier through the shared gatherToolTier comparator so the
 *  HUD can never drift from the sim's gating semantics. Owning nothing for a
 *  node type yields `tier: null`. */
export function buildGatheringToolRows(world: IWorld): GatheringToolRow[] {
  const best = new Map<GatherNodeType, number>();
  for (const slot of world.inventory) {
    const item = ITEMS[slot.itemId];
    for (const nodeType of GATHER_NODE_TYPES) {
      const tier = gatherToolTier(item, nodeType);
      if (tier === undefined) continue;
      const prev = best.get(nodeType);
      if (prev === undefined || tier > prev) best.set(nodeType, tier);
    }
  }
  return GATHER_NODE_TYPES.map((nodeType) => ({ nodeType, tier: best.get(nodeType) ?? null }));
}
