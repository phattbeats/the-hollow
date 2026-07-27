// ---------------------------------------------------------------------------
// Collection tracking core (PHAA-625/626): server-authoritative per-character
// record of which collectibles (world readables today; future kinds later,
// see src/sim/content/collectibles.ts) a character has found. Contrast
// IWorldReadables, which is deliberately READ-ONLY placement-only data: this
// facet is the mutable, persistent counterpart. Reading a collectible is a
// real sim command now (src/sim/collections.ts), re-checked server-side for
// range and collected-once, so offline Sim and the online server agree.
//
// `collectedIds` is the local viewer's own set, keyed by CollectibleDef.id, so
// a (sibling-ticket) UI panel can group by set/zone without a second round
// trip. No per-set/per-zone breakdown lives here; that grouping is a pure
// client-side join against src/sim/content/collectibles.ts.
// ---------------------------------------------------------------------------

export interface IWorldCollections {
  /** The local viewer's own collected-collectible ids (server-authoritative). */
  collectedIds: string[];
  /** Mark a collectible found (server re-checks interact range + collected-once). */
  readCollectible(id: string): void;
}
