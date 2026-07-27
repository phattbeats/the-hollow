# Daily rewards (PHAA-660)

Canon source: board answer on PHAA-639 (2026-07-11, comment edbda29e). Brandon wants
daily rewards after all, reversing the blanket ban in `docs/plan-the-hollow.md`
Scope Lock ("Engagement dark patterns. No streaks, daily rewards, FOMO timers"),
with three hard conditions: not the forefront, in-game items/currency only
(no crypto, ever, not even as a joke twice), and no dark-pattern shape (no streak
loss, no FOMO timer). This doc is the concrete adapt shape; see the amended Scope
Lock line for the pointer back here.

The fork never carries upstream's `DailyRewardService` (`server/daily_rewards.ts`):
it is `$WOC`/USD-priced and was SKIP(conflict)'d whole on PHAA-518. This is a fresh,
deliberately smaller adapt, not a diff port, plus the account-level abuse handling
from upstream #1773 (v0.24.0) scoped to what our fork actually needs.

## Shape

**Not a streak.** A 7-slot rotating calendar, one slot claimable per real UTC day.
Missing a day does not reset progress or forfeit anything: the cycle index only
advances on a successful claim, so a week away costs nothing but time. This is the
concrete difference between "daily rewards" (approved) and "streaks/FOMO timers"
(still banned): no loss aversion, no countdown pressure.

**Rewards are modest and never a power spike.** Small copper amounts and a couple of
already-defined cosmetic/consumable items (reuses existing `src/sim/content/hollow.ts`
items; no new item is created solely for this). No stat items, no XP boost, no rare
gear. Classic-fidelity invariant: nothing here is a number the combat math cares about.

**Placement is quiet.** No login splash, no HUD badge/nag icon, nothing that
interrupts or begs a click. A single new entry in the existing Options/menu list
("Daily Rewards") opens a small window: a 7-cell strip, today's cell highlighted,
a Claim button when eligible, "come back tomorrow" copy when not. Closed by default
every session; the game never opens it for the player.

## Persistence: account-scoped, not character-scoped

Tracked per **account**, not per character, the same way `AccountCosmetics` already
is (`server/db.ts`): a player with three characters gets one claim per day, not
three. New column `accounts.daily_rewards JSONB DEFAULT '{}'::jsonb` holding
`{ cycleIndex: number, lastClaimUtcDay: string }`, loaded/cached/mutated with the
exact same shape as `loadAccountCosmetics`/`saveAccountCosmetics` (in-memory
`Map<accountId, ...>` on `GameServer`, optimistic update then async persist).

The "which real day is it" question is answered by the existing `sim.utcDay`
mechanism (`server/game.ts` sets it once per real day from `Date.now()`, the sim
only ever reads it as an injected value, same pattern the delve daily lockout
already uses in `src/sim/delves/runs.ts`). Server-side eligibility math
(`lastClaimUtcDay !== sim.utcDay`) lives in `server/`, which is allowed to read the
wall clock; the actual grant (add copper, add an item to bags) is a new sim command
so the deterministic core is never touched except through that one command, per the
root invariant.

## Abuse handling (the #1773 adapt)

Upstream #1773 shipped IP/account participation bans plus a dedicated admin Svelte
panel (`DailyRewardsModerationControls.svelte`, ~400 lines across `src/admin/`).
Our fork already has a full account-ban system (`accounts.banned_at`,
`moderationStatusForAccount`) that rejects a banned account at the WS auth
handshake before it can send any command, including a claim - that part of #1773 is
already covered for free.

What is genuinely new: a **narrower, reward-only** lock so an operator can cut off
reward-farming abuse (e.g. alt-account cycling) without a full account ban. Adapt:
one column (`accounts.daily_rewards_locked_at TIMESTAMPTZ`), one new
`ModerationActionKind` (`daily_rewards_lock` / `daily_rewards_unlock`) audited the
same way ban/suspend already are, and the existing admin REST moderation route
extended with the same regex-and-action-union shape it already uses for
ban/suspend. Checked only inside the claim command, so a reward-locked account can
still play, chat, and trade normally.

**Not porting:** the admin dashboard Svelte button. The REST action lands and is
audited identically to every other moderation action; a one-click admin UI button
is a fast-follow if the board wants it, filed as a follow-up rather than bundled
into an "understated" first pass.

## Command flow

1. Client sends `daily_rewards_claim` (new `COMMAND_NAMES` entry, no positional gate
   unlike delve/vendor commands: this is a menu action, not a world interaction).
2. `server/game.ts` dispatch: reject if `session.accountDailyRewards.lockedAt` is
   set, reject if `lastClaimUtcDay === sim.utcDay`. Otherwise resolve today's cycle
   entry from `DAILY_REWARD_CYCLE[cycleIndex]`, call the new
   `sim.claimDailyReward(cycleIndex, pid)` (adds copper/item deterministically,
   given only the index, no wall-clock read inside the sim), then optimistically
   update the in-memory account cache and persist `{ cycleIndex: (cycleIndex + 1) %
   7, lastClaimUtcDay: today }` async, mirroring `noteAccountMechChroma`.
3. `dailyRewards` rides the wire as a `maybe()` delta field (same shape as
   `cosmetics`) so the window can show eligibility without a separate REST call.

## UI

`src/ui/daily_rewards_view.ts` (pure core, `UI_PURE_CORES`-registered) +
`src/ui/daily_rewards_window.ts` (thin painter), following the Vendor-window
recipe in `src/ui/CLAUDE.md`. Opened via a new `Hud.openDailyRewards()` from an
Options-menu entry, never auto-opened. All copy through new
`i18n.catalog/daily_rewards.ts` keys.

## Scope cut for this pass

- No admin dashboard button (REST action only; filed as a follow-up if wanted).
- No IP-level tracking: our fork requires nothing upstream's IP-ban did that account
  bans do not already cover, and IP-based blocking has real false-positive cost
  (shared IPs, mobile carriers) the board has not asked for.
- Reuses existing items/currency; no new reward-exclusive item is created.
