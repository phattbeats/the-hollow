import { describe, expect, it } from 'vitest';
import { nearestHousingPlot } from '../src/render/housing_proximity';
import { CLAIM_RADIUS } from '../src/sim/housing';
import type { HousingInfo } from '../src/world_api/housing';

function info(origin: { x: number; z: number } | null): HousingInfo {
  return {
    origin,
    plots: [
      { plotId: 'a', x: 0, z: 0, rot: 0, ownerName: null, mine: false, objects: [] },
      { plotId: 'b', x: 100, z: 100, rot: 0, ownerName: 'Rue', mine: true, objects: [] },
    ],
  };
}

describe('nearestHousingPlot', () => {
  it('returns null outside a hub instance (no origin)', () => {
    expect(nearestHousingPlot(0, 0, info(null))).toBeNull();
    expect(nearestHousingPlot(0, 0, null)).toBeNull();
  });

  it('returns null when no plot is within CLAIM_RADIUS', () => {
    expect(nearestHousingPlot(1000, 1000, info({ x: 0, z: 0 }))).toBeNull();
  });

  it('finds an unclaimed plot within range and reports claimed=false', () => {
    const near = nearestHousingPlot(1, 1, info({ x: 0, z: 0 }));
    expect(near).toEqual({ plotId: 'a', claimed: false, mine: false });
  });

  it('finds an owned plot within range and reports mine=true', () => {
    const near = nearestHousingPlot(101, 100, info({ x: 0, z: 0 }));
    expect(near).toEqual({ plotId: 'b', claimed: true, mine: true });
  });

  it('respects the exact CLAIM_RADIUS boundary', () => {
    expect(nearestHousingPlot(CLAIM_RADIUS - 0.1, 0, info({ x: 0, z: 0 }))?.plotId).toBe('a');
    expect(nearestHousingPlot(CLAIM_RADIUS + 0.1, 0, info({ x: 0, z: 0 }))).toBeNull();
  });

  it('picks the closer of two plots within range', () => {
    const near = nearestHousingPlot(3, 0, {
      origin: { x: 0, z: 0 },
      plots: [
        { plotId: 'near', x: 0, z: 0, rot: 0, ownerName: null, mine: false, objects: [] },
        { plotId: 'far', x: 7, z: 0, rot: 0, ownerName: null, mine: false, objects: [] },
      ],
    });
    expect(near?.plotId).toBe('near');
  });
});
