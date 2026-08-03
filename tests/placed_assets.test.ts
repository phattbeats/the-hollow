import { describe, expect, it } from 'vitest';
import { needsReSeat, reindexAfterRemoval, unionRegion } from '../src/render/placed_assets';

// The pure bookkeeping halves of PlacedAssetsView (region membership, region
// union, and post-removal reindexing). The Three-dependent instancing/seating
// itself needs a real GL context and is exercised by the browser E2E scripts.

describe('needsReSeat', () => {
  const region = { minX: 0, minZ: 0, maxX: 10, maxZ: 10 };

  it('is true for a point inside the region', () => {
    expect(needsReSeat(5, 5, region)).toBe(true);
  });

  it('is true for a point within the margin outside the region', () => {
    expect(needsReSeat(-1.9, 5, region, 2)).toBe(true);
    expect(needsReSeat(11.9, 5, region, 2)).toBe(true);
  });

  it('is false for a point past the margin', () => {
    expect(needsReSeat(-2.1, 5, region, 2)).toBe(false);
    expect(needsReSeat(20, 20, region, 2)).toBe(false);
  });
});

describe('unionRegion', () => {
  it('starts the union from a null accumulator', () => {
    const region = { minX: 1, minZ: 2, maxX: 3, maxZ: 4 };
    expect(unionRegion(null, region)).toEqual(region);
  });

  it('grows to cover both regions', () => {
    const a = { minX: 0, minZ: 0, maxX: 5, maxZ: 5 };
    const b = { minX: -2, minZ: 3, maxX: 4, maxZ: 8 };
    expect(unionRegion(a, b)).toEqual({ minX: -2, minZ: 0, maxX: 5, maxZ: 8 });
  });
});

describe('reindexAfterRemoval', () => {
  it('shifts every key above the removed index down by one', () => {
    const entries = new Map<number, string>([
      [0, 'a'],
      [2, 'b'],
      [3, 'c'],
      [5, 'd'],
    ]);
    reindexAfterRemoval(entries, 2);
    expect([...entries.entries()].sort((x, y) => x[0] - y[0])).toEqual([
      [0, 'a'],
      [2, 'c'],
      [4, 'd'],
    ]);
  });

  it('leaves keys below the removed index untouched', () => {
    const entries = new Map<number, string>([
      [0, 'a'],
      [1, 'b'],
    ]);
    reindexAfterRemoval(entries, 5);
    expect([...entries.entries()].sort((x, y) => x[0] - y[0])).toEqual([
      [0, 'a'],
      [1, 'b'],
    ]);
  });
});
