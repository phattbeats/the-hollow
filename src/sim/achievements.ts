// Achievements sim consumer (PHAA-687): the thin bridge between real sim
// transitions and the pure engine (./achievements_core.ts). It owns nothing
// mutable of its own: progress lives on the per-player PlayerMeta
// (`meta.achievements`, persisted JSONB), and the registry index is built once
// from the merged data. Behind the SimContext seam, so it stays out of the
// sim.ts coordinator (src/sim/CLAUDE.md).
//
// `src/sim`-pure: imports only sibling sim modules, no DOM/Three/render/ui/net,
// no rng/`Date.now` (tests/architecture.test.ts). Unlocks are a pure function of
// the tick-ordered signals fed here, so all three hosts agree.

import {
  type AchievementProgress,
  type AchievementSignal,
  applyAchievementSignal,
  buildAchievementIndex,
} from './achievements_core';
import { ACHIEVEMENTS } from './data';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';

// Built once from the merged registry; pure lookup structure, no per-tick cost.
export const ACHIEVEMENT_INDEX = buildAchievementIndex(ACHIEVEMENTS);

// Feed one accomplishment signal for a player. Advances matching criteria and,
// for each achievement newly completed, emits an `achievementUnlocked` SimEvent
// (idempotent: an already-unlocked achievement never re-fires). The event
// carries the stable achievement id only, so the sim stays language-agnostic;
// the client resolves the display name later (future UI panel). Title grants
// (PHAA-744) hang off `def.grantsTitleId` and land with the title registry.
export function noteAchievementSignal(
  ctx: SimContext,
  meta: PlayerMeta,
  signal: AchievementSignal,
): void {
  const newly = applyAchievementSignal(ACHIEVEMENT_INDEX, meta.achievements, signal);
  for (const id of newly) {
    ctx.emit({ type: 'achievementUnlocked', achievementId: id, pid: meta.entityId });
  }
}

// Convenience re-export so consumers do not need to reach into the core for the
// progress type when declaring PlayerMeta.
export type { AchievementProgress };
