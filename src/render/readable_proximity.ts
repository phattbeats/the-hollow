// Pure, host-agnostic distance check for world-placed readable books
// (PHAA-552): is the player standing close enough to a book to read it? Shared
// by the renderer (drives the "Read" prompt each frame, readable_prompt) and
// the client interact-key handler (main.ts opens the reader), so both agree on
// the same book and the same READ_RADIUS. Mirrors render/housing_proximity.ts.
//
// DOM/Three-free so tests/readable_proximity.test.ts can drive it directly.

import { READ_RADIUS } from '../sim/data';
import type { ReadablePropView } from '../world_api/readables';

export interface NearbyReadable {
  id: string;
}

/** The nearest readable within READ_RADIUS of (playerX, playerZ), or null. */
export function nearestReadable(
  playerX: number,
  playerZ: number,
  readables: ReadablePropView[],
): NearbyReadable | null {
  let best: NearbyReadable | null = null;
  let bestD = READ_RADIUS;
  for (const r of readables) {
    const d = Math.hypot(playerX - r.x, playerZ - r.z);
    if (d < bestD) {
      bestD = d;
      best = { id: r.id };
    }
  }
  return best;
}
