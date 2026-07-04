// Ambient idle walk for wanderRadius NPCs (board follow-up on PHAA-420): a
// pure-function unit test for the deterministic target formula, plus a
// Sim-level check that a configured NPC actually moves and stays leashed to
// its post, while an ordinary quest-giver with no wanderRadius stays put.

import { describe, expect, it } from 'vitest';
import { npcWanderTarget } from '../src/sim/npc_wander';
import { Sim } from '../src/sim/sim';
import { DT, type Entity } from '../src/sim/types';

// x/z-only distance, matching sim's dist2d but without requiring a full Vec3
// (the wander target formula operates on plain {x, z} points, not entities).
function dist2(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x,
    dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

describe('npcWanderTarget', () => {
  const spawn = { x: 10, z: -20 };

  it('is a pure function of tickCount: same input, same output', () => {
    expect(npcWanderTarget(spawn, 4, 123)).toEqual(npcWanderTarget(spawn, 4, 123));
  });

  it('stays exactly `radius` away from the spawn point at every tick', () => {
    for (const tick of [0, 1, 200, 4000, 123456]) {
      const p = npcWanderTarget(spawn, 4, tick);
      expect(dist2(spawn, p)).toBeCloseTo(4, 5);
    }
  });

  it('is back at its tick-0 position after a full period (RNG-free, purely periodic)', () => {
    const periodTicks = Math.round(40 / DT);
    expect(npcWanderTarget(spawn, 4, 0)).toEqual(npcWanderTarget(spawn, 4, periodTicks));
  });
});

describe('Sim: NPC ambient wander (board follow-up on PHAA-420)', () => {
  function findNpc(sim: Sim, templateId: string): Entity {
    const npc = [...sim.entities.values()].find(
      (e) => e.kind === 'npc' && e.templateId === templateId,
    );
    if (!npc) throw new Error(`npc not found: ${templateId}`);
    return npc;
  }

  it('walks a wanderRadius NPC away from its exact spawn point over time', () => {
    const sim = new Sim({ seed: 7, playerClass: 'warrior', playerName: 'Hosta' });
    const zebediah = findNpc(sim, 'verger_zebediah');
    const spawnPos = { ...zebediah.pos };
    for (let i = 0; i < 400; i++) sim.tick();
    expect(dist2(spawnPos, zebediah.pos)).toBeGreaterThan(0.5);
  });

  it('never strays past its configured wanderRadius from spawn', () => {
    const sim = new Sim({ seed: 7, playerClass: 'warrior', playerName: 'Hosta' });
    const faddick = findNpc(sim, 'sexton_faddick');
    const spawnPos = { ...faddick.pos };
    let maxDist = 0;
    for (let i = 0; i < 1200; i++) {
      sim.tick();
      maxDist = Math.max(maxDist, dist2(spawnPos, faddick.pos));
    }
    expect(maxDist).toBeLessThanOrEqual(4 + 0.5);
  });

  it('leaves a plain NPC with no wanderRadius stationary', () => {
    const sim = new Sim({ seed: 7, playerClass: 'warrior', playerName: 'Hosta' });
    const merchant = findNpc(sim, 'the_merchant');
    const spawnPos = { ...merchant.pos };
    for (let i = 0; i < 400; i++) sim.tick();
    expect(merchant.pos).toEqual(spawnPos);
  });
});
