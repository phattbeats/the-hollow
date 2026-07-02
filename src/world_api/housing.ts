// ---------------------------------------------------------------------------
// Housing v0 (the Hollow hub homesteads). Eight fixed plots inside the
// portal-instanced hub; each account may own at most one. The read surface is
// a small always-present blob: `plots` carries the global ownership book
// (hub-local coordinates) and `origin` is the viewer's current hub-instance
// origin, or null when the viewer is not standing inside a hub instance (the
// renderer draws nothing then). Claiming and decorating go through the /house
// chat commands (the existing chat wire), so this facet carries no commands.
// ---------------------------------------------------------------------------

export interface HouseObjectView {
  slot: number; // anchor slot index (0-based) into HOLLOW_HOUSE_SLOT_OFFSETS
  kind: string; // a HOLLOW_HOUSE_OBJECT_KINDS id
}

export interface HousingPlotView {
  plotId: string;
  x: number; // hub-local plot centre (add `origin` for world space)
  z: number;
  rot: number;
  ownerName: string | null; // null = unclaimed
  mine: boolean; // the viewer owns this plot
  objects: HouseObjectView[];
}

export interface HousingInfo {
  // Viewer's current hub-instance origin in world space, or null when the
  // viewer is outside the hub (ownership still mirrors; nothing is drawn).
  origin: { x: number; z: number } | null;
  plots: HousingPlotView[];
}

export interface IWorldHousing {
  housingInfo: HousingInfo | null;
}
