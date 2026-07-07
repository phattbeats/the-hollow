// ---------------------------------------------------------------------------
// Gathering v0 (PHAA-504): the profession-harvest command surface. Corpse
// harvest is single-use and first-come (opposite of a world gathering node,
// which is per-player); see src/sim/gathering.ts. This facet is a stub in the
// #1164 sense: `harvestCorpse` is the only member for now, the per-player
// world-node harvest lands in a later child and extends this same facet.
// ---------------------------------------------------------------------------

export interface IWorldGathering {
  /** Harvest a dead mob's corpse for profession components (server re-checks range/claim). */
  harvestCorpse(id: number): void;
}
