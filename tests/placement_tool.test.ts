// The dev-only placement tool's pure core: the emitted literal must match the
// exact ZonePropsDef element shapes the zone content modules consume, so an
// author can paste the output straight into src/sim/content/<zone>.ts.

import { describe, expect, it } from 'vitest';
import {
  buildPreviewProps,
  categoryCounts,
  filterCategories,
  formatEntry,
  formatPlacements,
  PLACEMENT_CATEGORIES,
  stepYaw,
  YAW_STEP,
} from '../src/devtools/placement/placement_core';
import { emptyZoneProps, type ZonePropsDef } from '../src/sim/types';

describe('placement tool literal output', () => {
  it('covers every ZonePropsDef array with at least one category', () => {
    const keys = new Set(PLACEMENT_CATEGORIES.map((c) => c.listKey));
    const zoneKeys = [...Object.keys(emptyZoneProps()), 'delveMarkers'] as (keyof ZonePropsDef)[];
    for (const k of zoneKeys) expect(keys.has(k), `no category emits into ${k}`).toBe(true);
  });

  it('emits tuple literals for the tuple arrays (crates/campfires/mudHuts)', () => {
    const line = formatEntry({ categoryId: 'campfire', input: { x: -4.04, z: 2.0, yaw: 0 } });
    expect(line).toBe('[-4, 2]');
  });

  it('emits object literals with the exact keys the zone files consume', () => {
    expect(formatEntry({ categoryId: 'tent', input: { x: -62.03, z: 783.42, yaw: 1.309 } })).toBe(
      '{ x: -62, z: 783.4, rot: 1.31, scale: 1 }',
    );
    expect(formatEntry({ categoryId: 'building_house', input: { x: 10, z: 12, yaw: -0.4 } })).toBe(
      "{ kind: 'house', x: 10, z: 12, w: 6, d: 5, rot: -0.4 }",
    );
    expect(
      formatEntry({ categoryId: 'fence', input: { x: 16, z: 16.04, x2: 22, z2: 4, yaw: 0 } }),
    ).toBe('{ x1: 16, z1: 16, x2: 22, z2: 4 }');
    expect(formatEntry({ categoryId: 'dock', input: { x: -64, z: 60, yaw: -2.2 } })).toBe(
      '{ x: -64, z: 60, rot: -2.2, hutLocal: { x: 2.8, z: 2.4, hw: 1.7, hd: 1.5 } }',
    );
    expect(formatEntry({ categoryId: 'delveMarker', input: { x: -5, z: -52, yaw: 0 } })).toBe(
      "{ x: -5, z: -52, delveId: 'EDIT_ME' }",
    );
  });

  it('emits a CampDef stub for a mob camp anchor', () => {
    expect(formatEntry({ categoryId: 'campSpawn', input: { x: 5, z: -6.02, yaw: 0 } })).toBe(
      "{ mobId: 'EDIT_ME', center: { x: 5, z: -6 }, radius: 12, count: 5 }",
    );
  });

  it('emits an NpcDef stub with a hex color and a 2dp facing, matching zone-file style', () => {
    expect(formatEntry({ categoryId: 'npcSpawn', input: { x: 3, z: 4.04, yaw: -0.6 } })).toBe(
      "{ id: 'EDIT_ME', name: 'EDIT_ME', title: 'EDIT_ME', pos: { x: 3, z: 4 }, " +
        "facing: -0.6, color: 0xffffff, questIds: [], greeting: 'EDIT_ME' }",
    );
  });

  it('groups the whole session into pasteable ZonePropsDef fragments', () => {
    const out = formatPlacements([
      { categoryId: 'campfire', input: { x: 3, z: -4, yaw: 0 } },
      { categoryId: 'well', input: { x: 0, z: 2, yaw: 0 } },
      { categoryId: 'campfire', input: { x: 65, z: -65, yaw: 0 } },
    ]);
    expect(out).toBe(
      [
        'campfires: [',
        '  [3, -4],',
        '  [65, -65],',
        '],',
        'wells: [',
        '  { x: 0, z: 2, r: 1.5 },',
        '],',
      ].join('\n'),
    );
  });

  it('every emitted value round-trips into the target ZonePropsDef array (typecheck by construction)', () => {
    const base = emptyZoneProps();
    const preview = buildPreviewProps(base, [
      { categoryId: 'tent', input: { x: 1, z: 2, yaw: 0.5 } },
      { categoryId: 'crate', input: { x: 3, z: 4, yaw: 0 } },
      { categoryId: 'delveMarker', input: { x: 5, z: 6, yaw: 0 } },
    ]);
    expect(preview.tents).toEqual([{ x: 1, z: 2, rot: 0.5, scale: 1 }]);
    expect(preview.crates).toEqual([[3, 4]]);
    expect(preview.delveMarkers).toEqual([{ x: 5, z: 6, delveId: 'EDIT_ME' }]);
    // the base is never mutated
    expect(base.tents).toEqual([]);
    expect(base.crates).toEqual([]);
  });

  it('camps/npcs are excluded from the ZonePropsDef preview (they paste into a separate export)', () => {
    const preview = buildPreviewProps(emptyZoneProps(), [
      { categoryId: 'campSpawn', input: { x: 1, z: 2, yaw: 0 } },
      { categoryId: 'npcSpawn', input: { x: 3, z: 4, yaw: 0 } },
      { categoryId: 'well', input: { x: 0, z: 0, yaw: 0 } },
    ]);
    expect(preview.wells).toEqual([{ x: 0, z: 0, r: 1.5 }]);
    for (const key of Object.keys(preview) as (keyof typeof preview)[]) {
      if (key === 'wells') continue;
      expect(preview[key], `${key} should stay empty`).toEqual([]);
    }
  });

  it('groups camps as a CampDef[] array but npcs as bare Record entries', () => {
    const out = formatPlacements([
      { categoryId: 'campSpawn', input: { x: 1, z: 2, yaw: 0 } },
      { categoryId: 'npcSpawn', input: { x: 3, z: 4, yaw: 0 } },
    ]);
    expect(out).toBe(
      [
        'camps: [',
        "  { mobId: 'EDIT_ME', center: { x: 1, z: 2 }, radius: 12, count: 5 },",
        '],',
        '// each entry keys into the *_NPCS Record<string, NpcDef> by its id:',
        "{ id: 'EDIT_ME', name: 'EDIT_ME', title: 'EDIT_ME', pos: { x: 3, z: 4 }, " +
          "facing: 0, color: 0xffffff, questIds: [], greeting: 'EDIT_ME' },",
      ].join('\n'),
    );
  });

  it('steps yaw in 15-degree increments and wraps', () => {
    expect(stepYaw(0)).toBeCloseTo(YAW_STEP, 10);
    expect(stepYaw(0, -1)).toBeCloseTo(-YAW_STEP, 10);
    expect(stepYaw(Math.PI, 1)).toBeLessThanOrEqual(Math.PI);
  });

  it('filters by kit name substring', () => {
    const tents = filterCategories('tent');
    expect(tents.some((c) => c.id === 'tent')).toBe(true);
    const grave = filterCategories('grave');
    expect(grave.map((c) => c.id)).toEqual(['graveyard']);
    expect(filterCategories('')).toHaveLength(PLACEMENT_CATEGORIES.length);
  });

  it('counts placements per category, omitting categories with none', () => {
    expect(categoryCounts([])).toEqual([]);
    const counts = categoryCounts([
      { categoryId: 'well', input: { x: 0, z: 0, yaw: 0 } },
      { categoryId: 'campfire', input: { x: 1, z: 1, yaw: 0 } },
      { categoryId: 'well', input: { x: 2, z: 2, yaw: 0 } },
    ]);
    expect(counts).toEqual([
      { id: 'well', label: 'well', count: 2 },
      { id: 'campfire', label: 'campfire', count: 1 },
    ]);
  });
});
