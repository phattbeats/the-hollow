// PHAA-660: the grant half of daily rewards (docs/design/daily-rewards.md). Every
// eligibility question (has today already been claimed, is the account
// reward-locked, which real day is it) is answered server-side in server/game.ts,
// which is allowed to read the wall clock; this module only ever does the
// deterministic part, given a plain cycle index, matching the root invariant that
// the sim is touched only through commands with no wall-clock read inside it.

import { DAILY_REWARD_CYCLE } from './content/daily_rewards';
import type { SimContext } from './sim_context';

export function claimDailyReward(ctx: SimContext, cycleIndex: number, pid: number): boolean {
  const meta = ctx.players.get(pid);
  if (!meta) return false;
  const entry = DAILY_REWARD_CYCLE[cycleIndex % DAILY_REWARD_CYCLE.length];
  meta.copper += entry.copper;
  if (entry.itemId && entry.itemCount && ctx.canAddItem(entry.itemId, entry.itemCount, pid)) {
    ctx.addItem(entry.itemId, entry.itemCount, pid);
  }
  // Deliberately a fixed, no-argument string: the claim window (which already
  // shares this module's DAILY_REWARD_CYCLE content) renders the specific
  // copper/item breakdown itself, so this log line never needs to interpolate an
  // item name and never needs a sim_i18n RULES regex, just the plain EXACT map.
  ctx.emit({ type: 'loot', text: 'You claim your daily reward.', pid });
  return true;
}
