// Geometry guards for the Drowned Litany irregular rooms (PHAA-910).
//
// The Litany is the first delve whose rooms are NOT bounding boxes: the walkable
// outline is an authored polygon and clampDelveModuleBounds deliberately steps
// aside for it (src/sim/delves/runs.ts), so the polygon shell is the ONLY thing
// keeping a player inside the room. These tests assert the authored data can
// actually carry that load: every shell is simple, star-shaped from its pole,
// and encloses every walkable island the content places mobs on.
import { describe, expect, it } from 'vitest';
import { DELVE_MODULE_LAYOUTS, delveModuleColliders } from '../src/sim/delve_layout';
import {
  isLitanyModuleId,
  LITANY_MODULE_IDS,
  litanyModuleGeometry,
  litanyModuleLayout,
} from '../src/sim/delve_litany_layout';
import {
  polygonContainsPoint,
  polygonIsStarShaped,
  polygonSelfIntersects,
} from '../src/sim/geometry2d';

describe('drowned litany module geometry', () => {
  it('registers every litany module in the shared layout table', () => {
    for (const id of LITANY_MODULE_IDS) {
      expect(isLitanyModuleId(id)).toBe(true);
      expect(litanyModuleLayout(id)).not.toBeNull();
      expect(DELVE_MODULE_LAYOUTS[id]).toBeDefined();
    }
  });

  it('exposes the walkable shell (and its pole) on the DungeonLayout bridge', () => {
    for (const id of LITANY_MODULE_IDS) {
      const layout = litanyModuleLayout(id);
      expect(layout, id).not.toBeNull();
      // The shellPolygon is what earns the clamp early-return; without it the
      // rectangular clamp silently reappears and eats the alcoves.
      expect(layout?.shellPolygon?.length ?? 0, id).toBeGreaterThanOrEqual(4);
      expect(layout?.shellPole, id).toBeDefined();
    }
  });

  it('authors simple, star-shaped shells so the shell OBBs seal the room', () => {
    for (const id of LITANY_MODULE_IDS) {
      const geo = litanyModuleGeometry(id);
      expect(geo, id).not.toBeNull();
      if (!geo) continue;
      const shell = geo.walkable[0]?.points ?? [];
      expect(shell.length, id).toBeGreaterThanOrEqual(4);
      expect(polygonSelfIntersects(shell), id).toBe(false);
      expect(polygonIsStarShaped(shell, geo.pole), id).toBe(true);
      expect(polygonContainsPoint(shell, geo.pole.x, geo.pole.z), id).toBe(true);
    }
  });

  it('keeps every walkable island centre inside its own shell', () => {
    for (const id of LITANY_MODULE_IDS) {
      const geo = litanyModuleGeometry(id);
      if (!geo) continue;
      const shell = geo.walkable[0]?.points ?? [];
      for (const island of geo.islands) {
        expect(polygonContainsPoint(shell, island.x, island.z), `${id} island`).toBe(true);
      }
      // The boss dais and the room entrance must be reachable ground too.
      expect(polygonContainsPoint(shell, geo.dais.x, geo.dais.z), `${id} dais`).toBe(true);
    }
  });

  it('builds litany colliders from the polygon shell, not the wall slabs', () => {
    for (const id of LITANY_MODULE_IDS) {
      const colliders = delveModuleColliders(id);
      // A bounding-box room emits exactly four wall slabs plus its props; a shell
      // room emits one OBB per polygon edge, so it is always richer than that.
      expect(colliders.length, id).toBeGreaterThan(4);
    }
  });
});
