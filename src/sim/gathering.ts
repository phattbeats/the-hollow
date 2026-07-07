// Gathering v0 (PHAA-504): single-use, first-come corpse harvest. A slain
// mob's corpse can be salvaged for profession components (hide, fang, silk,
// ...) exactly ONCE: the first player whose command reaches an unclaimed
// corpse wins the claim, and every later attempt (same tick or any later
// tick) against that same corpse is denied. This is the deliberate OPPOSITE
// of a world gathering node (src/sim/content/gather_nodes.ts, PHAA-503),
// which is per-player: every player who reaches a node harvests their own
// instance of it. The per-player node harvest lands in a later child of
// PHAA-493 and extends this same module.
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

import type { SimContext } from './sim_context';

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
