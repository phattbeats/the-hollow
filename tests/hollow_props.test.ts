// PHAA-402: the hub dressing (HOLLOW_PROPS, hub-local coordinates) must stay
// clear of the hub's landmarks so the art pass never crowds the things the
// player actually uses. Data-level and Node-only: no renderer, no DOM.
import { describe, expect, it } from 'vitest';
import { HOLLOW_HOUSE_PLOTS, HOLLOW_PROPS, VASE_POS } from '../src/sim/content/hollow';

// Landmarks (hub-local) and the clearance each keeps (in units).
const LANDMARKS: { name: string; x: number; z: number; r: number }[] = [
  { name: 'vase', x: VASE_POS.x, z: VASE_POS.z, r: 2.5 },
  { name: 'greenpaw', x: 3, z: 4, r: 2 },
  { name: 'cold firepit', x: -4, z: 2, r: 2 },
  { name: 'cave mouth', x: 0, z: 28, r: 3 },
  { name: 'gate', x: 0, z: -40, r: 4 },
  { name: 'dais', x: 0, z: 116, r: 10.5 },
  // the sanctum colonnade
  ...[80, 95, 110].flatMap((z) =>
    [-14, 14].map((x) => ({ name: `pillar ${x},${z}`, x, z, r: 1.5 })),
  ),
  // the eight homestead plots
  ...HOLLOW_HOUSE_PLOTS.map((p) => ({ name: p.id, x: p.x, z: p.z, r: 4 })),
];

// Every dressing placement as a point (plus its own footprint radius).
function placements(): { name: string; x: number; z: number; r: number }[] {
  const pts: { name: string; x: number; z: number; r: number }[] = [];
  HOLLOW_PROPS.crates.forEach(([x, z], i) => {
    pts.push({ name: `crate ${i}`, x, z, r: 0.65 });
  });
  for (const ring of HOLLOW_PROPS.ruinRings) {
    for (let i = 0; i < ring.columns; i++) {
      const a = (i / ring.columns) * Math.PI * 2;
      pts.push({
        name: `ruin column ${ring.x},${ring.z} #${i}`,
        x: ring.x + Math.sin(a) * ring.ringR,
        z: ring.z + Math.cos(a) * ring.ringR,
        r: 0.6,
      });
    }
  }
  for (const f of HOLLOW_PROPS.fences) {
    const n = Math.max(2, Math.round(Math.hypot(f.x2 - f.x1, f.z2 - f.z1)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({
        name: `fence ${f.x1},${f.z1}-${f.x2},${f.z2} @${t.toFixed(2)}`,
        x: f.x1 + (f.x2 - f.x1) * t,
        z: f.z1 + (f.z2 - f.z1) * t,
        r: 0.3,
      });
    }
  }
  return pts;
}

describe('HOLLOW_PROPS hub dressing (PHAA-402)', () => {
  it('keeps the cold firepit as the only campfire', () => {
    expect(HOLLOW_PROPS.campfires).toEqual([[-4, 2]]);
  });

  it('stays inside the temple-layout room footprint', () => {
    for (const p of placements()) {
      expect(Math.abs(p.x), p.name).toBeLessThan(23 - 0.5);
      expect(p.z, p.name).toBeGreaterThan(-19);
      expect(p.z, p.name).toBeLessThan(132);
    }
  });

  it('keeps every placement clear of every landmark', () => {
    for (const p of placements()) {
      for (const lm of LANDMARKS) {
        const d = Math.hypot(p.x - lm.x, p.z - lm.z);
        expect(d, `${p.name} vs ${lm.name}`).toBeGreaterThan(lm.r + p.r);
      }
    }
  });
});
