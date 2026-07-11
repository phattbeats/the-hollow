// Pure, host-agnostic core for the gathering HUD (PHAA-508, ports upstream
// #1194): the character-sheet gathering rows, i.e. the viewer's per-node-type
// harvest proficiency plus (this repo's crafted-tool gating, PHAA-507) the best
// gathering-tool tier they currently own for each node type.
//
// DOM/Three-free so tests/gathering_view.test.ts can drive it directly. The one
// consumer is char_window.ts, which renders buildGatheringProficiencyRows +
// buildGatheringToolRows as the "Gathering" section of the character sheet.
//
// The minimap's world-space node indicator (minimap_markers.ts /
// minimap_painter.ts) is NOT built here: it reads IWorldGathering#
// nodeHarvestableByMe inline for each nearby node, matching how every other
// minimap marker inlines its own world read. That read is per-VIEWER (see
// src/world_api/gathering.ts): two players asking about the SAME node id can get
// opposite ready/cooldown answers, because each player's respawn timer is
// independent; the minimap re-resolves through its own `world` every frame.
//
// Hollow keys gathering by GatherNodeType (amber/heartwood/spore), NOT upstream's
// mining/logging/herbalism profession ids: IWorldTrainer already owns
// "professions" here (the multiclass secondary-class trainer), so both
// proficiency (IWorldGathering#gatheringProficiency) and tool gating
// (src/sim/gathering_tools.ts) key off the node type. See gathering_tools.ts.

import { GATHER_NODE_TYPES, ITEMS } from '../sim/data';
import { gatherToolTier } from '../sim/gathering_tools';
import type { GatherNodeType } from '../sim/types';
import type { IWorld } from '../world_api';

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
