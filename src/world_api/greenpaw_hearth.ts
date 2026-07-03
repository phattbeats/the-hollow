// ---------------------------------------------------------------------------
// Greenpaw's hearth (PHAA-421): the vase hub room's smoke/mood state. Global
// world state, not per-viewer (the Hollow hub is `sharedInstance: true`, one
// copy for the whole population, per docs/plan-the-hollow.md Decision 19), so
// unlike Housing's per-viewer HousingInfo, this is always present and carries
// no origin. `smoke` is the single mood input the Plant system (PHAA-422)
// reads; `level` is the same value bucketed for the renderer's room dressing.
// Feeding goes through the /feed chat command (the existing chat wire), so
// this facet carries no commands.
// ---------------------------------------------------------------------------

export type SmokeLevel = 'clear' | 'hazy' | 'full';

export interface GreenpawHearthInfo {
  smoke: number; // 0..100
  level: SmokeLevel; // smoke bucketed: clear < 33 <= hazy < 66 <= full
}

export interface IWorldGreenpawHearth {
  hollowHearth: GreenpawHearthInfo;
}
