import { afterEach, describe, expect, it } from 'vitest';
import { isLeapableWater } from '../src/render/fish';
import { BUILTIN_WORLD, setActiveWorldContent } from '../src/sim/data';
import type { WorldContent } from '../src/sim/types';
import { isInWaterBody, terrainHeight, waterLevelAt } from '../src/sim/world';
import { mapCanvasHeight, paintTerrainRows } from '../src/ui/map_terrain';

// Render-side water/terrain awareness: a MapDoc's terrainEdits can sculpt a
// sunken feature (crater, sinkhole, tunnel) OUTSIDE every declared lake. The
// render layer must never read that dry feature as water no matter how deep
// it goes, since waterLevelAt() is -Infinity there (see sim/world.ts).

const SEED = 20061; // the built-in world seed (src/main.ts WORLD_SEED)
// Open ground in zone 1, well clear of the built-in lake and static colliders.
const DRY_SPOT = { x: 30, z: 40 };
const DEEP_DELTA = -25;

function withSunkenFeature(): WorldContent {
  return {
    ...BUILTIN_WORLD,
    terrainEdits: [
      { x: DRY_SPOT.x, z: DRY_SPOT.z, radius: 6, delta: DEEP_DELTA, falloff: 'flat', mode: 'add' },
    ],
  };
}

afterEach(() => setActiveWorldContent(null));

describe('src/render/fish.ts never leaps at a dry sunken feature', () => {
  it('a real declared lake is leapable', () => {
    const [lakeX, lakeZ] = [-92, 88]; // the built-in lake
    expect(isInWaterBody(lakeX, lakeZ)).toBe(true);
    const depthAt = (x: number, z: number): number =>
      waterLevelAt(x, z) - terrainHeight(x, z, SEED);
    expect(isLeapableWater(lakeX, lakeZ, depthAt)).toBe(true);
  });

  it('a dry sunken feature outside any declared lake is never leapable, however deep', () => {
    setActiveWorldContent(withSunkenFeature());
    expect(isInWaterBody(DRY_SPOT.x, DRY_SPOT.z)).toBe(false);
    expect(terrainHeight(DRY_SPOT.x, DRY_SPOT.z, SEED)).toBeLessThan(-20);
    const depthAt = (x: number, z: number): number =>
      waterLevelAt(x, z) - terrainHeight(x, z, SEED);
    expect(isLeapableWater(DRY_SPOT.x, DRY_SPOT.z, depthAt)).toBe(false);
  });
});

describe('src/ui/map_terrain.ts never paints a dry sunken feature as water', () => {
  it('paints the built-in lake blue', () => {
    const region = { minX: -108, maxX: -76, minZ: 72, maxZ: 104 };
    const W = 32;
    const H = mapCanvasHeight(W, region);
    const data = new Uint8ClampedArray(W * H * 4);
    paintTerrainRows(data, W, H, region, SEED, 0, H);
    const cx = Math.floor(W / 2);
    const cy = Math.floor(H / 2);
    const k = (cy * W + cx) * 4;
    expect([data[k], data[k + 1], data[k + 2]]).toEqual([38, 84, 138]);
  });

  it('never paints a dry sunken feature that blue, however deep', () => {
    setActiveWorldContent(withSunkenFeature());
    const region = {
      minX: DRY_SPOT.x - 8,
      maxX: DRY_SPOT.x + 8,
      minZ: DRY_SPOT.z - 8,
      maxZ: DRY_SPOT.z + 8,
    };
    const W = 32;
    const H = mapCanvasHeight(W, region);
    const data = new Uint8ClampedArray(W * H * 4);
    paintTerrainRows(data, W, H, region, SEED, 0, H);
    const cx = Math.floor(W / 2);
    const cy = Math.floor(H / 2);
    const k = (cy * W + cx) * 4;
    expect([data[k], data[k + 1], data[k + 2]]).not.toEqual([38, 84, 138]);
  });
});
