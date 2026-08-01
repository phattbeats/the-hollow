// ---------------------------------------------------------------------------
// Daily rewards (PHAA-660, docs/design/daily-rewards.md). Account-scoped (a
// player's several characters share one claim per real day), so this rides
// self-only like IWorldMail, not a shared/global facet like the hearth.
// `cycleIndex`/`lastClaimUtcDay` are the account's persisted claim state;
// `locked` mirrors accounts.daily_rewards_locked_at (the narrow #1773
// participation-lock adapt). The actual reward CONTENTS for a given cycle
// slot are shared static content both hosts already import
// (src/sim/content/daily_rewards.ts's DAILY_REWARD_CYCLE), so they never ride
// the wire.
// ---------------------------------------------------------------------------

export interface DailyRewardsInfo {
  cycleIndex: number;
  lastClaimUtcDay: string;
  locked: boolean;
}

export interface IWorldDailyRewards {
  dailyRewards: DailyRewardsInfo;
  /** Claim today's cycle slot (server re-checks eligibility; a no-op if already claimed or locked). */
  claimDailyReward(): void;
}
