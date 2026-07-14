// Protect Yumi! (PHAA-573) pure-resolver invariants: the tiebreak precedence, the
// sudden-death damage-taken ramp, the two-draw teleport-cell picker, and the FIFO
// first-fit team packer. These are the deterministic decision cores of social/
// yumi.ts, exported so they can be exercised without a live Sim.

import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';
import type { ArenaQueueUnit } from '../src/sim/sim';
import {
  packYumiTeams,
  pickYumiCells,
  resolveYumiTiebreak,
  YUMI_SUDDEN_AT,
  YUMI_SUDDEN_RAMP,
  YUMI_SUDDEN_STEP,
  yumiTakenMult,
  yumiTeamSize,
} from '../src/sim/social/yumi';

describe('yumiTeamSize', () => {
  it('maps the two brackets', () => {
    expect(yumiTeamSize('yumi3')).toBe(3);
    expect(yumiTeamSize('yumi5')).toBe(5);
  });
});

describe('yumiTakenMult', () => {
  it('is 1.0 until sudden death, then ramps per step', () => {
    expect(yumiTakenMult(0)).toBe(1);
    expect(yumiTakenMult(YUMI_SUDDEN_AT - 1)).toBe(1);
    // First step latches AT the threshold.
    expect(yumiTakenMult(YUMI_SUDDEN_AT)).toBeCloseTo(1 + YUMI_SUDDEN_RAMP);
    expect(yumiTakenMult(YUMI_SUDDEN_AT + YUMI_SUDDEN_STEP)).toBeCloseTo(1 + 2 * YUMI_SUDDEN_RAMP);
  });
  it('is monotonic non-decreasing in time', () => {
    let prev = 0;
    for (let t = 0; t < YUMI_SUDDEN_AT + 10 * YUMI_SUDDEN_STEP; t += 5) {
      const m = yumiTakenMult(t);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
});

describe('resolveYumiTiebreak', () => {
  const rng = () => new Rng(1);
  it('prefers the cat with more pre-pulse hp', () => {
    expect(resolveYumiTiebreak(rng(), 100, 50, 0, 0)).toBe('A');
    expect(resolveYumiTiebreak(rng(), 50, 100, 0, 0)).toBe('B');
  });
  it('breaks an hp tie by damage dealt to the ENEMY cat', () => {
    // dmgToYumiB is damage team A dealt, so more of it favors team A.
    expect(resolveYumiTiebreak(rng(), 100, 100, 10, 40)).toBe('A');
    expect(resolveYumiTiebreak(rng(), 100, 100, 40, 10)).toBe('B');
  });
  it('falls back to the per-match stream on a total tie (never a draw)', () => {
    const w = resolveYumiTiebreak(rng(), 100, 100, 20, 20);
    expect(w === 'A' || w === 'B').toBe(true);
  });
});

describe('pickYumiCells', () => {
  const pts = [
    { x: 0, z: 0 },
    { x: 100, z: 0 },
    { x: 0, z: 100 },
    { x: 100, z: 100 },
  ];
  it('never picks the same point and stays in range', () => {
    for (let s = 1; s < 50; s++) {
      const rng = new Rng(s);
      const { a, b } = pickYumiCells(rng, pts, 5);
      expect(a).not.toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(pts.length);
    }
  });
  it('respects the minimum separation when the geometry allows it', () => {
    // With minSep 50 all off-diagonal points are >= 50 apart, so b is never
    // the same cell and always separated.
    const rng = new Rng(7);
    const { a, b } = pickYumiCells(rng, pts, 50);
    const dx = pts[a].x - pts[b].x;
    const dz = pts[a].z - pts[b].z;
    expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(50);
  });
});

describe('packYumiTeams', () => {
  const unit = (...pids: number[]): ArenaQueueUnit => ({ pids, rating: 1500 });
  it('returns null until both teams can fill', () => {
    expect(packYumiTeams([unit(1), unit(2), unit(3)], 3)).toBeNull();
  });
  it('seats premades FIFO first-fit into two full teams', () => {
    const res = packYumiTeams([unit(1, 2, 3), unit(4, 5, 6)], 3);
    expect(res).not.toBeNull();
    const a = res!.a.flatMap((u) => u.pids);
    const b = res!.b.flatMap((u) => u.pids);
    expect(a).toEqual([1, 2, 3]);
    expect(b).toEqual([4, 5, 6]);
  });
  it('packs mixed-size units first-fit (A then B)', () => {
    const res = packYumiTeams([unit(1, 2), unit(3), unit(4, 5, 6)], 3);
    expect(res).not.toBeNull();
    const a = res!.a.flatMap((u) => u.pids);
    const b = res!.b.flatMap((u) => u.pids);
    expect(a.sort()).toEqual([1, 2, 3]);
    expect(b.sort()).toEqual([4, 5, 6]);
  });
});
