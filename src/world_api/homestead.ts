// ---------------------------------------------------------------------------
// Homestead v0 (the open-world Hollow Reaches plots, PHAA-417). Distinct tier
// from Housing v0 (src/world_api/housing.ts, the hub Sanctum plots): every
// plot already carries world-space coordinates (no viewer-relative origin to
// translate, since this ground is not portal-instanced), so the read surface
// is just the global ownership book. Claiming goes through the /homestead
// chat command (the existing chat wire), so this facet carries no commands.
// ---------------------------------------------------------------------------

export interface HomesteadPlotView {
  x: number;
  z: number;
  ownerName: string; // homestead plots are never unclaimed once listed
  mine: boolean; // the viewer owns this plot
}

export interface HomesteadInfo {
  plots: HomesteadPlotView[];
}

export interface IWorldHomestead {
  homesteadInfo: HomesteadInfo | null;
}
