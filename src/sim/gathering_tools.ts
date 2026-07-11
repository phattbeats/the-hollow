// Gathering tool tier gating (PHAA-507, upstream #1191). A crafted gathering
// tool has a tier; the tool's tier gates which gather-node type AND which
// monster-material tiers it can gather/harvest, via one shared comparator.
// Pure leaf module: no SimContext state, just the comparison + item-shape
// helpers, so it is Vitest-importable directly (like gathering.ts's
// rollMaterialRarity or threat.ts).
//
// This repo has no durability mechanic anywhere in ItemDef (src/sim/types.ts):
// a gathering tool never carries a durability field, so it can never become
// unusable from durability loss. That is a property of the item shape, not
// something this module enforces at runtime.
//
// Named off "gathering" (this repo's system, keyed by GatherNodeType:
// amber/heartwood/spore) rather than upstream's "professions"/profession-id
// split (mining/logging/herbalism): IWorldTrainer already owns "professions"
// here (the multiclass secondary-class trainer), so a tool's gating key is
// the gather node type it targets, not a separate profession id.
//
// Live wiring into the node-harvest command (src/sim/gathering.ts
// harvestNode/resolveHarvest) and into corpse-material harvest (the
// Gathering class) is deliberately NOT done in this change, same as upstream
// #1191 itself: this lands the tier comparator + the crafted tool items as an
// inert, tested contract first; the gathering HUD child (blocked by this
// issue) is what actually surfaces gating state and is the natural place to
// wire the live check in alongside it.

import type { GatherNodeType, ItemDef, ItemUse } from './types';

export interface GatherToolUse {
  type: 'gatherTool';
  nodeType: GatherNodeType;
  tier: number;
}

export function isGatherToolUse(use: ItemUse | undefined): use is GatherToolUse {
  return !!use && use.type === 'gatherTool';
}

/**
 * Returns the tool's gathering tier, or undefined if the item is not a
 * gathering tool for the given node type.
 */
export function gatherToolTier(
  item: ItemDef | undefined,
  nodeType: GatherNodeType,
): number | undefined {
  if (!item?.use || !isGatherToolUse(item.use)) return undefined;
  if (item.use.nodeType !== nodeType) return undefined;
  return item.use.tier;
}

// Shared pure comparator: a tool of a given tier covers its own tier and
// every tier below it, never above. Both node gating and monster-material
// gating reuse this single comparison so the semantics can never drift apart.
function toolTierCovers(toolTier: number, targetTier: number): boolean {
  return toolTier >= targetTier;
}

// True only when the player's tool tier is at least the node's tier: a
// tier-1 tool cannot gather a tier-2+ node, a tier-2 tool can gather tier 1
// and tier 2, and so on. A tool's rarity (ItemDef `quality`) never enters
// this check: rarity is cosmetic/value only, gating is tier-only.
export function canGatherTier(playerToolTier: number, nodeTier: number): boolean {
  return toolTierCovers(playerToolTier, nodeTier);
}

// True only when the player's tool tier is at least the monster material's
// tier (e.g. skinning/harvesting a material off a slain monster). Same
// semantics as `canGatherTier`, reusing the one shared comparator so node
// gating and monster-material gating can never fall out of sync.
export function canHarvestMonsterMaterial(toolTier: number, materialTier: number): boolean {
  return toolTierCovers(toolTier, materialTier);
}
