// ---------------------------------------------------------------------------
// World-placed readables (PHAA-552): the standalone journals/books lying around
// the world that a player walks up to and reads. This facet is READ-ONLY: it
// exposes only WHERE the books are, so the renderer can draw them and the client
// interact-prompt can find the nearest one. There is no command member, because
// reading a book mutates no game state (contrast IWorldGathering.harvestCorpse).
//
// The placement list is static content (src/sim/content/readables.ts), so both
// the offline Sim and the online ClientWorld satisfy this by reading that table
// scoped to the viewer's current overworld zone, identically, with no server
// snapshot or wire protocol involved. The book's title and page TEXT are not
// carried here: the reader UI resolves them by id through the `readable`
// entity-i18n kind (src/ui/entity_i18n.ts), keeping this facet language-agnostic.
// ---------------------------------------------------------------------------

export interface ReadablePropView {
  id: string; // matches a ReadableDef.id; the reader looks up pages/title by it
  x: number; // world-space position
  z: number;
  facing: number; // yaw (radians) for the rendered book
}

export interface IWorldReadables {
  /** World-placed readable books in the viewer's current overworld zone (empty inside instances). */
  readableProps: ReadablePropView[];
}
