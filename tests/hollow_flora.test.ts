import { describe, expect, it } from 'vitest';
import { hollowFloraLayout } from '../src/render/hollow_flora_core';
import { PLANT_ARCHETYPES } from '../src/render/plant_creature_core';
import {
  HOLLOW_ZONE_CAMPS,
  HOLLOW_ZONE_GATE_POS,
  HOLLOW_ZONE_NPCS,
  HOLLOW_ZONE_PROPS,
  HOLLOW_ZONE_ZONE,
} from '../src/sim/content/hollow_zone';
import { roadDistance, terrainHeight, WATER_LEVEL } from '../src/sim/world';

const SEED = 1337;

describe('hollowFloraLayout', () => {
  it('is deterministic: same seed to identical placements', () => {
    expect(hollowFloraLayout(SEED)).toEqual(hollowFloraLayout(SEED));
  });

  it('produces some flora but a bounded amount', () => {
    const flora = hollowFloraLayout(SEED);
    expect(flora.length).toBeGreaterThan(0);
    // 6 anchors (4 camps + 2 NPCs) capped at 5 each.
    expect(flora.length).toBeLessThanOrEqual(30);
  });

  it('stays inside the starter zone (back to normal past its north edge)', () => {
    for (const f of hollowFloraLayout(SEED)) {
      expect(f.z).toBeGreaterThanOrEqual(HOLLOW_ZONE_ZONE.zMin);
      expect(f.z).toBeLessThan(HOLLOW_ZONE_ZONE.zMax);
    }
  });

  it('picks empty spots: clear of roads, water, and hand-placed props', () => {
    for (const f of hollowFloraLayout(SEED)) {
      expect(roadDistance(f.x, f.z)).toBeGreaterThanOrEqual(3);
      expect(terrainHeight(f.x, f.z, SEED)).toBeGreaterThanOrEqual(WATER_LEVEL + 1.2);
      for (const [cx, cz] of [...HOLLOW_ZONE_PROPS.campfires, ...HOLLOW_ZONE_PROPS.crates]) {
        expect(Math.hypot(f.x - cx, f.z - cz)).toBeGreaterThan(1.5);
      }
      for (const w of HOLLOW_ZONE_PROPS.wells) {
        expect(Math.hypot(f.x - w.x, f.z - w.z)).toBeGreaterThan(w.r);
      }
      for (const t of HOLLOW_ZONE_PROPS.tents) {
        expect(Math.hypot(f.x - t.x, f.z - t.z)).toBeGreaterThan(2 * t.scale);
      }
      for (const npc of Object.values(HOLLOW_ZONE_NPCS)) {
        // never buried on top of a posted NPC
        expect(Math.hypot(f.x - npc.pos.x, f.z - npc.pos.z)).toBeGreaterThan(
          (npc.wanderRadius ?? 4) + 1,
        );
      }
    }
  });

  it('clears the gate hub and the garden fences', () => {
    for (const f of hollowFloraLayout(SEED)) {
      expect(
        Math.hypot(f.x - HOLLOW_ZONE_GATE_POS.x, f.z - HOLLOW_ZONE_GATE_POS.z),
      ).toBeGreaterThanOrEqual(HOLLOW_ZONE_ZONE.hub.radius);
      for (const fe of HOLLOW_ZONE_PROPS.fences) {
        // point-to-segment distance to each fence rail
        const abx = fe.x2 - fe.x1;
        const abz = fe.z2 - fe.z1;
        const apx = f.x - fe.x1;
        const apz = f.z - fe.z1;
        const len2 = abx * abx + abz * abz;
        const t = len2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / len2)) : 0;
        const d = Math.hypot(apx - abx * t, apz - abz * t);
        expect(d).toBeGreaterThan(1.5);
      }
    }
  });

  it('holds its exclusions across several seeds', () => {
    for (const seed of [1, 42, 777, 20260709]) {
      const flora = hollowFloraLayout(seed);
      expect(flora).toEqual(hollowFloraLayout(seed));
      for (const f of flora) {
        expect(f.z).toBeGreaterThanOrEqual(HOLLOW_ZONE_ZONE.zMin);
        expect(f.z).toBeLessThan(HOLLOW_ZONE_ZONE.zMax);
        expect(roadDistance(f.x, f.z)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('clusters around the camps and posts', () => {
    const anchors = [
      ...HOLLOW_ZONE_CAMPS.map((c) => c.center),
      ...Object.values(HOLLOW_ZONE_NPCS).map((n) => n.pos),
    ];
    for (const f of hollowFloraLayout(SEED)) {
      const nearest = Math.min(...anchors.map((a) => Math.hypot(f.x - a.x, f.z - a.z)));
      // within the widest anchor ring (camp radius 12 + 6 margin)
      expect(nearest).toBeLessThanOrEqual(18);
    }
  });

  it('uses only real plant archetypes and sane transforms', () => {
    for (const f of hollowFloraLayout(SEED)) {
      expect(PLANT_ARCHETYPES).toContain(f.archetype);
      expect(f.scale).toBeGreaterThan(0);
      expect(f.scale).toBeLessThan(1);
      expect(f.rotY).toBeGreaterThanOrEqual(0);
      expect(f.rotY).toBeLessThanOrEqual(Math.PI * 2);
    }
  });

  it('does not overlap its own placements', () => {
    const flora = hollowFloraLayout(SEED);
    for (let i = 0; i < flora.length; i++) {
      for (let j = i + 1; j < flora.length; j++) {
        expect(Math.hypot(flora[i].x - flora[j].x, flora[i].z - flora[j].z)).toBeGreaterThanOrEqual(
          2.4,
        );
      }
    }
  });
});
