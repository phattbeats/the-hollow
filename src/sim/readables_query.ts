// Pure resolver for the world-placed readable props (PHAA-552) visible to a
// viewer at a given position. Extracted as a host-agnostic leaf so the offline
// Sim and the online ClientWorld both compute `readableProps` from the ONE
// static content table (READABLES) through the ONE function, which keeps the
// two IWorld implementations byte-identical (no drift for cross-platform-sync
// to catch) and lets a Vitest drive the scoping directly without a world.
//
// Scoping: readables live in overworld zones only. `dungeonAt` is x-banded and
// `zoneAt` is z-banded (see sim/data.ts), so a viewer standing inside an
// instance (hub/dungeon/delve, placed past the dungeon x-threshold) sees none,
// and otherwise sees exactly the readables whose zoneId matches their zone.

import type { ReadablePropView } from '../world_api/readables';
import { dungeonAt, READABLES, zoneAt } from './data';

export function readablePropsAt(x: number, z: number): ReadablePropView[] {
  // Inside an instance's coordinate band there are no overworld readables.
  if (dungeonAt(x)) return [];
  const zoneId = zoneAt(z).id;
  return READABLES.filter((r) => r.zoneId === zoneId).map((r) => ({
    id: r.id,
    x: r.pos.x,
    z: r.pos.z,
    facing: r.facing,
  }));
}
