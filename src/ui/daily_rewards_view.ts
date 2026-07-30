// Pure, host-agnostic view model for the Daily Rewards window (PHAA-660).
//
// DOM-free and i18n-free: `todayUtcDay` is an INPUT, not read internally, so a
// test can drive any date deterministically. The reward cycle content
// (DAILY_REWARD_CYCLE) is shared static data both hosts already import, so it
// never rides the wire; only the account's claim-cycle state does.

import type { DailyRewardEntry } from '../sim/content/daily_rewards';
import type { DailyRewardsInfo } from '../world_api';

export interface DailyRewardsCellView extends DailyRewardEntry {
  cycleIndex: number;
  /** This is the slot claiming right now would grant. */
  isNext: boolean;
}

export interface DailyRewardsWindowView {
  cells: DailyRewardsCellView[];
  /** Eligible to claim right now: not locked, and today has no claim yet. */
  canClaim: boolean;
  locked: boolean;
}

export function buildDailyRewardsView(
  info: DailyRewardsInfo,
  cycle: readonly DailyRewardEntry[],
  todayUtcDay: string,
): DailyRewardsWindowView {
  const cells = cycle.map((entry, cycleIndex) => ({
    ...entry,
    cycleIndex,
    isNext: cycleIndex === info.cycleIndex,
  }));
  const canClaim = !info.locked && info.lastClaimUtcDay !== todayUtcDay;
  return { cells, canClaim, locked: info.locked };
}
