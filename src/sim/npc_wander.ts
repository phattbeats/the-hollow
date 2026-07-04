// Ambient idle walk for stationary NPCs marked with an `NpcDef.wanderRadius`
// (board follow-up on PHAA-420: "maybe some walking around and stuff"). A
// small, self-contained module behind the SimContext seam rather than a new
// method on the Sim coordinator, per this repo's module-first rule.
//
// Deliberately RNG-free: the target point is a pure function of `tickCount`,
// never `ctx.rng`. The mob idle-wander block this mirrors (mob/locomotion.ts)
// draws from `ctx.rng` every pause/retarget, which is fine there because mobs
// are already the dominant consumer of the shared Rng stream. Doing the same
// for NPCs would insert a brand-new per-tick draw at the START of every tick
// for every player in the world, shifting every subsequent roll (loot, crit,
// aggro) for the rest of the simulation and invalidating every golden/parity
// trace fixture, not just ones that touch this zone. A tickCount-driven
// circle sidesteps that entirely while still reading as a live, walking NPC.
//
// Presentation only: position/facing already stream to clients through the
// generic per-tick entity wire path (server/game.ts dynamicFields), so no
// IWorld or wire change is needed for this to mirror correctly online.

import { NPCS } from './data';
import type { SimContext } from './sim_context';
import { DT } from './types';

const WANDER_SPEED_MULT = 0.35;
const WANDER_PERIOD_SECONDS = 40;

// Exported for unit testing: the deterministic point a wandering NPC walks
// toward at a given tick, independent of Sim/SimContext.
export function npcWanderTarget(
  spawnPos: { x: number; z: number },
  radius: number,
  tickCount: number,
): { x: number; z: number } {
  const phase = ((tickCount * DT) % WANDER_PERIOD_SECONDS) / WANDER_PERIOD_SECONDS;
  const angle = phase * Math.PI * 2;
  return {
    x: spawnPos.x + Math.cos(angle) * radius,
    z: spawnPos.z + Math.sin(angle) * radius,
  };
}

export function updateNpcWander(ctx: SimContext): void {
  for (const e of ctx.entities.values()) {
    if (e.kind !== 'npc' || e.dead) continue;
    const radius = NPCS[e.templateId]?.wanderRadius;
    if (!radius) continue;
    const dest = npcWanderTarget(e.spawnPos, radius, ctx.tickCount);
    // Default (non-ignoreObstacles) path: same collider-slide + waterline
    // handling the mob idle-wander block gets, so the NPC rounds a prop
    // instead of phasing through it.
    ctx.moveToward(e, ctx.groundPos(dest.x, dest.z), e.moveSpeed * WANDER_SPEED_MULT);
  }
}
