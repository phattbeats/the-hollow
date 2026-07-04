import { describe, expect, it } from 'vitest';
import {
  ATTACK_DURATION,
  attackLunge,
  HIT_REACT_DURATION,
  hashStringToSeed,
  hitReact,
  idleBend,
  mulberry32,
  PLANT_ARCHETYPES,
  type PlantArchetype,
  plantCreatureSpec,
  tentacleCoil,
} from '../src/render/plant_creature_core';

// The plant-creature GENERATOR is deterministic by contract (PHAA-437): the
// same entity id renders the same creature on every host. These drive the pure
// core (seed -> spec + motion envelopes) directly; the Three assembly is
// exercised by the preview harness, not here.

describe('plant creature seed derivation', () => {
  it('hashStringToSeed is stable and returns a uint32', () => {
    const a = hashStringToSeed('palefeeder#4211');
    const b = hashStringToSeed('palefeeder#4211');
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
  });

  it('distinct ids hash to distinct seeds (no trivial collisions)', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `rootmaw#${i}`);
    const seeds = new Set(ids.map(hashStringToSeed));
    expect(seeds.size).toBe(ids.length);
  });

  it('mulberry32 is deterministic and stays in [0, 1)', () => {
    const r1 = mulberry32(12345);
    const r2 = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      const v = r1();
      expect(v).toBe(r2());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('plantCreatureSpec determinism', () => {
  it('same archetype + seed yields a deep-equal spec', () => {
    for (const a of PLANT_ARCHETYPES) {
      expect(plantCreatureSpec(a, 777)).toEqual(plantCreatureSpec(a, 777));
    }
  });

  it('the same seed reads differently per archetype (distinct salts)', () => {
    const p = plantCreatureSpec('palefeeder', 42);
    const r = plantCreatureSpec('rootmaw', 42);
    const w = plantCreatureSpec('witness_root', 42);
    // heads are archetype-fixed, so compare structure that IS seed-driven
    expect(p.segments.length !== r.segments.length || p.height !== r.height).toBe(true);
    expect(p.head.kind).toBe('bulb');
    expect(r.head.kind).toBe('maw');
    expect(w.head.kind).toBe('crown');
  });

  it('varies structure across seeds (not a constant model)', () => {
    const heights = new Set<number>();
    for (let s = 0; s < 40; s++)
      heights.add(Number(plantCreatureSpec('palefeeder', s).height.toFixed(4)));
    expect(heights.size).toBeGreaterThan(10);
  });
});

describe('plantCreatureSpec structural bounds', () => {
  const archetypeBounds: Record<PlantArchetype, { seg: [number, number]; head: string }> = {
    palefeeder: { seg: [4, 6], head: 'bulb' },
    rootmaw: { seg: [3, 5], head: 'maw' },
    witness_root: { seg: [7, 9], head: 'crown' },
  };

  it('stalk/leaf/head/base fields stay within the archetype envelope for many seeds', () => {
    for (const a of PLANT_ARCHETYPES) {
      const bounds = archetypeBounds[a];
      for (let s = 0; s < 200; s++) {
        const spec = plantCreatureSpec(a, s);
        expect(spec.segments.length).toBeGreaterThanOrEqual(bounds.seg[0]);
        expect(spec.segments.length).toBeLessThanOrEqual(bounds.seg[1]);
        expect(spec.head.kind).toBe(bounds.head);
        // leaves come in opposite pairs
        expect(spec.leaves.length % 2).toBe(0);
        expect(spec.leaves.length).toBeGreaterThan(0);
        // every leaf whorls onto a real segment
        for (const leaf of spec.leaves) {
          expect(leaf.segment).toBeGreaterThanOrEqual(0);
          expect(leaf.segment).toBeLessThan(spec.segments.length);
        }
        // sway weight grows from the planted base to the free crown
        expect(spec.segments[0].swayWeight).toBeLessThanOrEqual(
          spec.segments[spec.segments.length - 1].swayWeight,
        );
        expect(spec.height).toBeGreaterThan(0);
        expect(spec.base.prongs).toBeGreaterThanOrEqual(3);
        if (a === 'witness_root') {
          expect(spec.head.petals).toBeGreaterThanOrEqual(7);
          expect(spec.head.spikes?.length).toBe(spec.head.petals);
          expect(spec.tentacles.length).toBeGreaterThanOrEqual(3);
          for (const tc of spec.tentacles) {
            expect(tc.segment).toBeGreaterThanOrEqual(0);
            expect(tc.segment).toBeLessThan(spec.segments.length);
            expect(tc.thornCount).toBeGreaterThanOrEqual(4);
          }
        } else {
          expect(spec.head.petals).toBe(0);
          expect(spec.head.spikes).toBeUndefined();
          expect(spec.tentacles.length).toBe(0);
        }
      }
    }
  });

  it('only the glowing archetypes carry emissive head strength', () => {
    for (let s = 0; s < 30; s++) {
      expect(plantCreatureSpec('palefeeder', s).head.glow).toBeGreaterThan(0);
      expect(plantCreatureSpec('rootmaw', s).head.glow).toBe(0);
      expect(plantCreatureSpec('witness_root', s).head.glow).toBeGreaterThan(0);
    }
  });
});

describe('motion envelopes', () => {
  const spec = plantCreatureSpec('witness_root', 9);

  it('idle sway is bounded by the spec amplitude and rides the sway weight', () => {
    const top = spec.segments.length - 1;
    let maxTop = 0;
    for (let t = 0; t < 6; t += 0.05) maxTop = Math.max(maxTop, Math.abs(idleBend(spec, top, t).x));
    // the crown must actually move, but never past the amplitude ceiling
    expect(maxTop).toBeGreaterThan(0);
    expect(maxTop).toBeLessThanOrEqual(spec.sway.amp * spec.segments[top].swayWeight + 1e-9);
    // the planted base barely moves
    const base = idleBend(spec, 0, 1.3);
    expect(Math.abs(base.x)).toBeLessThan(Math.abs(idleBend(spec, top, 1.3).x) + 1e-9);
  });

  it('hit-react is a decaying oscillation that settles to zero', () => {
    expect(hitReact(0)).toBeCloseTo(0, 5); // starts at rest
    let peak = 0;
    for (let e = 0; e < HIT_REACT_DURATION; e += 0.01) peak = Math.max(peak, Math.abs(hitReact(e)));
    expect(peak).toBeGreaterThan(0.1);
    expect(hitReact(HIT_REACT_DURATION)).toBe(0);
    expect(hitReact(HIT_REACT_DURATION + 1)).toBe(0);
    // late in the window the quiver is much smaller than the early peak
    expect(Math.abs(hitReact(HIT_REACT_DURATION * 0.9))).toBeLessThan(peak * 0.5);
  });

  it('attack lunge is a single non-negative forward bump', () => {
    expect(attackLunge(0)).toBeCloseTo(0, 5);
    expect(attackLunge(ATTACK_DURATION / 2)).toBeCloseTo(1, 2);
    expect(attackLunge(ATTACK_DURATION)).toBe(0);
    expect(attackLunge(-1)).toBe(0);
    for (let e = 0; e < ATTACK_DURATION; e += 0.02)
      expect(attackLunge(e)).toBeGreaterThanOrEqual(0);
  });

  it('tentacle coil is bounded by its own amplitude and out of phase per limb', () => {
    for (let i = 0; i < spec.tentacles.length; i++) {
      const tc = spec.tentacles[i];
      let maxX = 0;
      for (let t = 0; t < 8; t += 0.05) maxX = Math.max(maxX, Math.abs(tentacleCoil(spec, i, t).x));
      expect(maxX).toBeGreaterThan(0);
      expect(maxX).toBeLessThanOrEqual(tc.coilAmp + 1e-9);
    }
    // distinct tentacles do not move in lockstep (independent phase)
    if (spec.tentacles.length > 1) {
      const a = tentacleCoil(spec, 0, 1.7).x;
      const b = tentacleCoil(spec, 1, 1.7).x;
      expect(a).not.toBeCloseTo(b, 6);
    }
    // out of range index is inert, not a crash
    expect(tentacleCoil(spec, spec.tentacles.length + 5, 1)).toEqual({ x: 0, z: 0 });
  });
});
