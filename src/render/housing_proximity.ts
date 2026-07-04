// Pure, host-agnostic distance check for the Hollow hub homestead plots
// (PHAA-405): is the player standing close enough to a plot's signpost to
// interact with it? Shared by the renderer (proximity glow, housing.ts) and
// the client interact-key handler (main.ts, claim/manage), so both agree on
// the same plot and the same radius the server itself enforces for a claim
// (CLAIM_RADIUS in sim/housing.ts) instead of a duplicated magic number.
//
// DOM/Three-free so tests/housing_proximity.test.ts can drive it directly.

import { CLAIM_RADIUS } from '../sim/housing';
import type { HousingInfo } from '../world_api/housing';

export interface NearbyHousingPlot {
  plotId: string;
  claimed: boolean;
  mine: boolean;
}

/** The nearest plot within interact range of (playerX, playerZ), or null. */
export function nearestHousingPlot(
  playerX: number,
  playerZ: number,
  housing: HousingInfo | null,
): NearbyHousingPlot | null {
  if (!housing?.origin) return null;
  const { x: ox, z: oz } = housing.origin;
  let best: NearbyHousingPlot | null = null;
  let bestD = CLAIM_RADIUS;
  for (const plot of housing.plots) {
    const d = Math.hypot(playerX - (ox + plot.x), playerZ - (oz + plot.z));
    if (d < bestD) {
      bestD = d;
      best = { plotId: plot.plotId, claimed: plot.ownerName !== null, mine: plot.mine };
    }
  }
  return best;
}
