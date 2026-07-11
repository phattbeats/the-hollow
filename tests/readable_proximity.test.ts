import { describe, expect, it } from 'vitest';
import { nearestReadable } from '../src/render/readable_proximity';
import { READ_RADIUS } from '../src/sim/data';
import type { ReadablePropView } from '../src/world_api/readables';

const props: ReadablePropView[] = [
  { id: 'a', x: 0, z: 0, facing: 0 },
  { id: 'b', x: 100, z: 100, facing: 0 },
];

describe('nearestReadable', () => {
  it('returns null when nothing is in read range', () => {
    expect(nearestReadable(1000, 1000, props)).toBeNull();
    expect(nearestReadable(0, 0, [])).toBeNull();
  });

  it('finds a book within READ_RADIUS', () => {
    expect(nearestReadable(1, 0, props)).toEqual({ id: 'a' });
  });

  it('respects the exact READ_RADIUS boundary', () => {
    expect(nearestReadable(READ_RADIUS - 0.1, 0, props)?.id).toBe('a');
    expect(nearestReadable(READ_RADIUS + 0.1, 0, props)).toBeNull();
  });

  it('picks the closer of two books in range', () => {
    const near = nearestReadable(0.4, 0, [
      { id: 'far', x: 0, z: 0, facing: 0 },
      { id: 'near', x: 0.5, z: 0, facing: 0 },
    ]);
    expect(near).toEqual({ id: 'near' });
  });
});
