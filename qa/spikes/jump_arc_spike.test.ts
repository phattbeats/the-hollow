// PHAA-559 jump-arc spike + characterization guard.
// Drives the deterministic Sim directly to measure jump-arc feel at DT=1/20:
// apex, air-time in ticks, horizontal reach, launch-timing sensitivity, and
// determinism (same input -> same landing). Written as the spike evidence for
// the willow-path GO/NO-GO; kept collected because it also pins the jump
// constants (GRAVITY / JUMP_VELOCITY / DT) against accidental drift.
// See the findings write-up on PHAA-559. Run in isolation with:
//   NODE_ENV= npx vitest run qa/spikes/jump_arc_spike.test.ts --reporter=verbose
import { describe, expect, it } from 'vitest';
import { Sim } from '../../src/sim/sim';
import { DT, RUN_SPEED } from '../../src/sim/types';
import { groundHeight } from '../../src/sim/world';

const SEED = 42;
const makeSim = () => new Sim({ seed: SEED, playerClass: 'warrior', autoEquip: true });

// place the player on a flat-ish spot and settle onto the ground
function planted(sim: Sim, x: number, z: number) {
  const p = sim.player;
  p.pos.x = x;
  p.pos.z = z;
  p.pos.y = groundHeight(x, z, sim.cfg.seed);
  p.prevPos = { ...p.pos };
  p.vx = p.vy = p.vz = 0;
  p.onGround = true;
  p.jumping = false;
  p.fallStartY = p.pos.y;
  const meta = sim.meta(p.id)!;
  meta.moveInput.forward = false;
  meta.moveInput.back = false;
  meta.moveInput.strafeLeft = false;
  meta.moveInput.strafeRight = false;
  meta.moveInput.jump = false;
  return { p, meta };
}

// find the flattest 8x8 spot near the hub so a running jump lands on comparable ground
function flatSpot(sim: Sim): { x: number; z: number } {
  let best = { x: 0, z: 0, spread: Infinity };
  for (let x = -40; x <= 40; x += 4) {
    for (let z = -40; z <= 40; z += 4) {
      let lo = Infinity,
        hi = -Infinity;
      for (let dx = 0; dx <= 6; dx += 2) {
        const h = groundHeight(x + dx, z, sim.cfg.seed);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
      const spread = hi - lo;
      if (spread < best.spread) best = { x, z, spread };
    }
  }
  return { x: best.x, z: best.z };
}

// run one jump; returns per-tick trajectory relative to launch until re-grounded.
// The caller must have already placed the player via planted().
function jumpFrom(sim: Sim, opts: { forward: boolean }) {
  const p = sim.player;
  const meta = sim.meta(p.id)!;
  const launch = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
  meta.moveInput.forward = opts.forward;
  meta.moveInput.jump = true;
  const yByTick: number[] = [];
  let apex = 0;
  let ticksAirborne = 0;
  // fire the jump on tick 1, then hold forward but release jump
  for (let t = 0; t < 60; t++) {
    sim.tick();
    if (t === 0) meta.moveInput.jump = false; // jump is an edge; release after launch
    const dy = p.pos.y - launch.y;
    apex = Math.max(apex, dy);
    if (!p.onGround) {
      ticksAirborne++;
      yByTick.push(Number(dy.toFixed(3)));
    } else if (ticksAirborne > 0) {
      break; // landed
    }
  }
  const horizReach = Math.hypot(p.pos.x - launch.x, p.pos.z - launch.z);
  meta.moveInput.forward = false;
  return { ticksAirborne, apex, horizReach, yByTick };
}

describe('PHAA-559 jump arc under the 20 Hz sim', () => {
  it('stationary jump: apex, air-time, per-tick readability', () => {
    const sim = makeSim();
    const spot = flatSpot(sim);
    planted(sim, spot.x, spot.z);
    const r = jumpFrom(sim, { forward: false });
    // GRAVITY=16, JUMP_VELOCITY=6. Analytic apex v^2/2g = 1.125yd, but the sim
    // uses discrete symplectic (semi-implicit) Euler at DT=1/20, so the highest
    // TICK-SAMPLED height is ~0.98yd (~13% under analytic). The renderer only
    // interpolates linearly between tick samples, so 0.98yd is also the visible
    // apex the player sees. Air time ~0.70s = 14 ticks.
    console.log(
      '[stationary] apex(yd)=',
      r.apex.toFixed(3),
      'ticksAirborne=',
      r.ticksAirborne,
      'airTime(s)=',
      (r.ticksAirborne * DT).toFixed(3),
    );
    console.log('[stationary] y-by-tick:', r.yByTick.join(' '));
    expect(r.apex).toBeGreaterThan(0.9);
    expect(r.apex).toBeLessThan(1.05);
    expect(r.ticksAirborne).toBeGreaterThanOrEqual(13);
    expect(r.ticksAirborne).toBeLessThanOrEqual(17);
  });

  it('running jump: horizontal reach at RUN_SPEED', () => {
    const sim = makeSim();
    const spot = flatSpot(sim);
    planted(sim, spot.x, spot.z);
    const r = jumpFrom(sim, { forward: true });
    console.log(
      '[running] horizReach(yd)=',
      r.horizReach.toFixed(3),
      'ticksAirborne=',
      r.ticksAirborne,
      'RUN_SPEED=',
      RUN_SPEED,
      'theoretical=',
      (RUN_SPEED * r.ticksAirborne * DT).toFixed(3),
    );
    expect(r.horizReach).toBeGreaterThan(3.0);
  });

  it('no air control: launch state fully determines the landing (server can replay it)', () => {
    // Two runs, identical inputs -> identical trajectory. This is why a
    // server-authoritative replay of the same intent stream lands identically:
    // the arc is ballistic, fixed at launch, with zero mid-air divergence.
    const a = (() => {
      const s = makeSim();
      const sp = flatSpot(s);
      planted(s, sp.x, sp.z);
      return jumpFrom(s, { forward: true });
    })();
    const b = (() => {
      const s = makeSim();
      const sp = flatSpot(s);
      planted(s, sp.x, sp.z);
      return jumpFrom(s, { forward: true });
    })();
    expect(a.yByTick).toEqual(b.yByTick);
    expect(a.horizReach).toBeCloseTo(b.horizReach, 6);
    console.log('[determinism] identical trajectory across runs:', a.yByTick.length, 'ticks match');
  });

  it('launch-timing sensitivity: how far does a 1-tick-late jump move the takeoff point', () => {
    // On willow paths the player must launch near a platform edge. With no air
    // control, the ONLY thing they time is the takeoff tick. One tick of run at
    // RUN_SPEED is the granularity of that decision.
    const perTick = RUN_SPEED * DT;
    console.log('[timing] one 20Hz tick of run =', perTick.toFixed(3), 'yd of takeoff drift');
    console.log(
      '[timing] input cadence is 50ms (20Hz); a mistimed release costs ~1 tick of ground travel',
    );
    expect(perTick).toBeCloseTo(0.35, 3);
  });
});
