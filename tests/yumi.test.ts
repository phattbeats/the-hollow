// Protect Yumi! (PHAA-573) pure-resolver invariants: the tiebreak precedence, the
// sudden-death damage-taken ramp, the two-draw teleport-cell picker, and the FIFO
// first-fit team packer. These are the deterministic decision cores of social/
// yumi.ts, exported so they can be exercised without a live Sim.

import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';
import type { ArenaQueueUnit } from '../src/sim/sim';
import { Sim } from '../src/sim/sim';
import {
  packYumiTeams,
  pickYumiCells,
  resolveYumiTiebreak,
  YUMI_HP,
  YUMI_SUDDEN_AT,
  YUMI_SUDDEN_RAMP,
  YUMI_SUDDEN_STEP,
  yumiTakenMult,
  yumiTeamSize,
} from '../src/sim/social/yumi';
import type { PlayerClass } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';

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

// The HUD/renderer presentation edge (slice 3): once a bout is live, the
// arenaInfo.match.yumi snapshot must surface with the structure the IWorld
// YumiMatchInfo type promises, so the offline HUD and the online arena wire
// (which carries this object wholesale) both have real state to draw.
function teleport(sim: Sim, pid: number, x: number, z: number) {
  const e = sim.entities.get(pid)!;
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = groundHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
  (sim as any).rebucket(e);
}

// Seat a live 3v3 Protect Yumi bout from six solo queuers and run the countdown
// out. Returns the sim, the match, and the six pids (teamA first three by seat).
function startYumi3() {
  const sim = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
  const classes: PlayerClass[] = ['warrior', 'mage', 'rogue', 'priest', 'hunter', 'shaman'];
  const pids = classes.map((c, i) => sim.addPlayer(c, `P${i}`));
  pids.forEach((p, i) => {
    teleport(sim, p, i * 4, -40);
  });
  pids.forEach((p) => {
    sim.arenaQueueJoin(p, 'yumi3');
  });
  sim.tick(); // matchmake
  for (let i = 0; i < 20 * 8; i++) {
    sim.tick();
    const m = sim.arenaMatchFor(pids[0]);
    if (m && m.state === 'active') break;
  }
  const match = sim.arenaMatchFor(pids[0])!;
  return { sim, match, pids };
}

describe('yumi: arenaInfo presentation snapshot', () => {
  it('seats six solo queuers into one 3v3 yumi match', () => {
    const { match, pids } = startYumi3();
    expect(match).toBeTruthy();
    expect(match.format).toBe('yumi3');
    expect(match.yumi).toBeTruthy();
    expect(new Set([...match.teamA, ...match.teamB])).toEqual(new Set(pids));
    expect(match.teamA.length).toBe(3);
    expect(match.teamB.length).toBe(3);
  });

  it('surfaces arenaInfo.match.yumi with both cats and full scoreboards', () => {
    const { sim, match, pids } = startYumi3();
    const info = sim.arenaInfoFor(pids[0]);
    expect(info).toBeTruthy();
    const y = info!.match?.yumi;
    expect(y).toBeTruthy();
    expect(y!.size).toBe(3);
    expect(y!.team === 'A' || y!.team === 'B').toBe(true);
    // Both protected cats are alive at full health at the opening bell.
    expect(y!.yumiA.maxHp).toBe(YUMI_HP);
    expect(y!.yumiB.maxHp).toBe(YUMI_HP);
    expect(y!.yumiA.alive).toBe(true);
    expect(y!.yumiB.alive).toBe(true);
    expect(y!.yumiA.entityId).not.toBe(y!.yumiB.entityId);
    // Scoreboards cover every combatant; exactly one line is flagged "me".
    expect(y!.teamA.length).toBe(3);
    expect(y!.teamB.length).toBe(3);
    const allLines = [...y!.teamA, ...y!.teamB];
    expect(allLines.filter((p) => p.me).length).toBe(1);
    expect(allLines.find((p) => p.me)!.pid).toBe(pids[0]);
    expect(y!.damageTakenMult).toBe(1);
    // The match info is scoped to the reader: the "me" flag follows the pid.
    const other = sim.arenaInfoFor(pids[3])!.match!.yumi!;
    expect([...other.teamA, ...other.teamB].find((p) => p.me)!.pid).toBe(pids[3]);
  });
});
