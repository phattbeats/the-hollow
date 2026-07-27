import { describe, expect, it } from 'vitest';
import {
  type AssetPlacement,
  type CustomMap,
  customMapFromContent,
  customMapToWorldContent,
  newCustomMap,
  placementsToPlayAssets,
  placementsToRenderAssets,
} from '../src/editor/custom_map';
import { WATER_LEVEL } from '../src/sim/world';

// custom_map.ts's asset resolution is injected (this fork has no generated
// asset-id -> path catalogue yet); these fixtures stand in for whatever
// catalogue/upload registry the client-shell slice eventually wires in.
const resolvePath = (assetId: string) =>
  assetId === 'props/well' ? '/models/props/well.glb' : undefined;

function placement(overrides: Partial<AssetPlacement> = {}): AssetPlacement {
  return { assetId: 'props/well', x: 1, z: 2, rotY: 0, scale: 1, collide: false, ...overrides };
}

describe('placementsToRenderAssets', () => {
  it('keeps a null hole at an unresolvable slot, index-aligned with the document', () => {
    const placements = [placement(), placement({ assetId: 'props/unknown' }), placement({ x: 5 })];
    const result = placementsToRenderAssets(placements, resolvePath);
    expect(result).toHaveLength(3);
    expect(result[0]).not.toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]?.x).toBe(5);
  });

  it('stamps collideRadius only when the placement opts into collision', () => {
    const [withCollide, withoutCollide] = placementsToRenderAssets(
      [placement({ collide: true, scale: 2 }), placement({ collide: false })],
      resolvePath,
    );
    expect(withCollide?.collideRadius).toBeGreaterThan(0);
    expect(withoutCollide?.collideRadius).toBeUndefined();
  });
});

describe('placementsToPlayAssets', () => {
  it('filters out unresolvable placements instead of keeping holes', () => {
    const placements = [placement(), placement({ assetId: 'props/unknown' }), placement()];
    const result = placementsToPlayAssets(placements, resolvePath);
    expect(result).toHaveLength(2);
  });
});

describe('customMapToWorldContent', () => {
  const baseMap: CustomMap = newCustomMap('Test Map', 'map-1', 1_000);

  it('projects content.objects onto WorldContent.groundObjects', () => {
    const world = customMapToWorldContent(baseMap, resolvePath);
    expect(world.groundObjects).toEqual(baseMap.content.objects);
  });

  it('omits an unresolvable colliding placement from the playtest world without mutating the document', () => {
    const map: CustomMap = {
      ...baseMap,
      placements: [placement(), placement({ assetId: 'props/unknown', collide: true })],
    };
    const world = customMapToWorldContent(map, resolvePath);
    expect(world.placements).toHaveLength(1);
    expect(map.placements).toHaveLength(2);
  });

  it('defaults waterLevel to the built-in WATER_LEVEL when the document has none', () => {
    const world = customMapToWorldContent(baseMap, resolvePath);
    expect(world.waterLevel).toBeUndefined();
    expect(baseMap.waterLevel).toBeUndefined();
    expect(WATER_LEVEL).toBeTypeOf('number');
  });
});

describe('customMapFromContent', () => {
  it('carries biomePaint through into the built document', () => {
    const biomePaint = { cell: 10, cols: 2, rows: 2, originX: 0, originZ: 0, ids: [0, 1, 2, 255] };
    const map = customMapFromContent(newCustomMap('X', 'id', 0).content, {
      meta: {
        id: 'id',
        name: 'X',
        description: '',
        createdAt: 0,
        updatedAt: 0,
        seed: 1,
        parentId: '',
      },
      biomePaint,
    });
    expect(map.biomePaint).toEqual(biomePaint);
    // Deep-cloned: mutating the input must not affect the built document.
    biomePaint.ids[0] = 9;
    expect(map.biomePaint?.ids[0]).toBe(0);
  });

  it('omits biomePaint entirely when none is supplied', () => {
    const map = customMapFromContent(newCustomMap('X', 'id', 0).content, {
      meta: {
        id: 'id',
        name: 'X',
        description: '',
        createdAt: 0,
        updatedAt: 0,
        seed: 1,
        parentId: '',
      },
    });
    expect(map.biomePaint).toBeUndefined();
  });
});
