// Gathering v0 (PHAA-504): single-use, first-come corpse harvest. A slain
// mob's corpse can be salvaged for profession components (hide, fang, silk,
// ...) exactly ONCE: the first player whose command reaches an unclaimed
// corpse wins the claim, and every later attempt (same tick or any later
// tick) against that same corpse is denied. This is the deliberate OPPOSITE
// of a world gathering node (src/sim/content/gather_nodes.ts, PHAA-503),
// which is per-player: every player who reaches a node harvests their own
// instance of it (PHAA-505, below).
//
// Race-freedom argument: the sim tick is single-threaded at 20 Hz. Every
// player command in a tick's batch is processed one at a time, in order, by
// the SAME synchronous call stack; there is no `await` or callback boundary
// between reading `Entity.harvestClaimedBy` and writing it back (see
// src/sim/interaction.ts's harvestCorpse). So two harvest attempts landing in
// the SAME tick are still resolved sequentially: whichever is processed first
// sees `harvestClaimedBy === null` and wins, the second sees the just-written
// claim and is denied. No lock is needed because there is no interleaving to
// guard against.
//
// Follows the src/sim/housing.ts / src/sim/homestead.ts SimContext pattern:
// constructed once in the Sim ctor, stored as a field, reached from sibling
// modules through an append-only SimContext callback (gatherHarvestItemFor)
// rather than a direct instance reference, mirroring the homesteadChat /
// marketListingBelongsTo reach-backs.
//
// `src/sim`-pure: no DOM/Three/render/ui/game/net imports, no Math.random/
// Date.now (enforced by tests/architecture.test.ts). The one randomness draw
// (which component tag's item a multi-tag corpse yields) routes through
// ctx.rng, never bare Math.random.

import { GATHER_NODE_TYPES, GATHER_NODES } from './data';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import { type GatherNodeDef, type GatherNodeType, INTERACT_RANGE } from './types';

// Component tag -> the existing item this harvest yields. Only tags with a
// concrete profession-material item wired up so far are listed here; a mob
// whose componentTags don't map to any of these still becomes single-use
// claimed, it just yields no item yet (future profession-harvest issues wire
// up the rest, alongside the per-player node harvest child).
export const HARVEST_COMPONENT_ITEMS: Readonly<Record<string, string>> = {
  hide: 'boar_hide',
  fang: 'wolf_fang',
  silk: 'webwood_silk',
};

/** Does this mob's corpse support profession harvest at all? */
export function isHarvestableCorpse(
  componentTags: readonly string[] | undefined,
): componentTags is readonly string[] {
  return !!componentTags && componentTags.length > 0;
}

export class Gathering {
  constructor(private readonly ctx: SimContext) {}

  /**
   * The item this harvest yields for a corpse with the given component tags,
   * or null if none of them map to a wired item yet. Always draws exactly one
   * rng value when there is at least one candidate (never a conditional draw
   * only-if-multiple), so the draw shape stays fixed regardless of how many
   * component tags a mob template carries.
   */
  harvestItemFor(componentTags: readonly string[]): string | null {
    const candidates = componentTags
      .map((tag) => HARVEST_COMPONENT_ITEMS[tag])
      .filter((id): id is string => id !== undefined);
    if (candidates.length === 0) return null;
    return this.ctx.rng.pick(candidates);
  }
}

// ---------------------------------------------------------------------------
// Node harvest v1 (PHAA-505, upstream #1121/#1119): per-player harvest of a
// permanent world node (src/sim/content/gather_nodes.ts). Unlike corpse
// harvest above, a node is never claimed or consumed: every player tracks
// their OWN respawn timer for it (`PlayerMeta.nodeHarvestReadyAt`), so one
// player harvesting a node never blocks, delays, or resets any other
// player's timer for that same node. No rng draw: the material grant and
// respawn window are fixed per node type, so free functions (not the
// Gathering class above, which exists only to own the corpse-harvest rng
// draw) are enough here.
// ---------------------------------------------------------------------------

// Per-node harvest tuning. Each node type grants one fixed material item and
// one point of that type's gathering proficiency; no rng draw, so the
// outcome is fully deterministic given the same sequence of harvests (a
// proficiency-scaled rarity roll is future work, see PHAA-505's blocked
// child). The items reused below are existing generic junk entries
// (src/sim/content/items.ts): a placeholder grant that avoids adding new
// per-locale item names for this issue; dedicated amber/heartwood/spore
// items are future content work.
export const NODE_HARVEST_TABLE: Record<
  GatherNodeType,
  { itemId: string; respawnSeconds: number }
> = {
  amber: { itemId: 'bone_fragments', respawnSeconds: 120 },
  heartwood: { itemId: 'linen_scrap', respawnSeconds: 120 },
  spore: { itemId: 'spider_leg', respawnSeconds: 120 },
};

export function gatherNodeById(nodeId: string): GatherNodeDef | undefined {
  return GATHER_NODES.find((n) => n.id === nodeId);
}

/** A fresh, all-zero proficiency record: one counter per gather node type. */
export function emptyGatheringProficiency(): Record<GatherNodeType, number> {
  const out = {} as Record<GatherNodeType, number>;
  for (const type of GATHER_NODE_TYPES) out[type] = 0;
  return out;
}

// Flat-ground distance from a player to a node's (x, z) placement. Node
// placements carry no y (GatherNodeDef), so this stays a plain 2D distance
// rather than reusing types.ts's dist2d (which takes a full Vec3).
function distToNode(pos: { x: number; z: number }, node: { x: number; z: number }): number {
  const dx = pos.x - node.x;
  const dz = pos.z - node.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// Per-player, per-node respawn readiness: `meta.nodeHarvestReadyAt[nodeId]` is
// the sim.time (seconds) at or after which THAT player may harvest THAT node
// again. Absent means never harvested (always ready). Session-only state
// (not persisted), same as `lastActiveTick`: one player harvesting a node
// never blocks, delays, or resets any other player's timer for the same
// node, so there is no gather rush or node camping.
export function isNodeHarvestableBy(meta: PlayerMeta, nodeId: string, now: number): boolean {
  const readyAt = meta.nodeHarvestReadyAt[nodeId];
  return readyAt === undefined || now >= readyAt;
}

export interface HarvestResolution {
  granted: boolean;
  itemId?: string;
}

// Resolves one player's harvest attempt against one node: if that player's
// own timer for this node has elapsed, grants the node type's material,
// increments that player's proficiency counter for the type, and resets that
// player's timer; otherwise denies without side effects. Never touches any
// other player's state for this or any other node.
export function resolveHarvest(
  meta: PlayerMeta,
  node: GatherNodeDef,
  now: number,
): HarvestResolution {
  if (!isNodeHarvestableBy(meta, node.id, now)) return { granted: false };
  const entry = NODE_HARVEST_TABLE[node.type];
  meta.nodeHarvestReadyAt[node.id] = now + entry.respawnSeconds;
  meta.gatheringProficiency[node.type] += 1;
  return { granted: true, itemId: entry.itemId };
}

// Command entry point (behind the SimContext seam): resolves one player's
// harvest attempt against a node they must be standing near. Runs on the
// deterministic 20 Hz tick path (dispatched from a wire command the same
// tick it arrives, per the other immediate-interaction commands like
// harvestCorpse in src/sim/interaction.ts), never off-tick. Denies (no side
// effect) if the requesting player is dead, the node id is unknown, the
// player is too far away, or their own timer for the node has not elapsed; a
// denial never touches another player's state and never consumes that
// player's respawn timer.
export function harvestNode(ctx: SimContext, nodeId: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  const node = gatherNodeById(nodeId);
  if (!node) {
    ctx.error(meta.entityId, 'That resource node does not exist.');
    return;
  }
  if (distToNode(p.pos, node.pos) > INTERACT_RANGE) {
    ctx.error(meta.entityId, 'Too far away.');
    return;
  }
  const result = resolveHarvest(meta, node, ctx.time);
  if (!result.granted) {
    ctx.error(meta.entityId, 'This resource node has not respawned for you yet.');
    return;
  }
  ctx.addItem(result.itemId!, 1, meta.entityId);
}
