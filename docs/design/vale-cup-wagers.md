# Vale Cup Wagers, Design Spec (PHAA-720)

Gold-only, capped spectator wagers on boarball (Vale Cup) matches. Board-narrowed
carve-out of the original SKIP(conflict) on PHAA-572 (decision recorded on the
PHAA-565 thread, 2026-07-16): currency-only wagering is out forever, the mechanic
shape is approved at a gold-only, hard-capped scope.

This is a design document. No implementation lands under this ticket; the
implementation child is filed after the Board confirms the cap numbers below, and
cannot start before PHAA-572 (boarball core) merges.

---

## 1. Constraints carried in from the ticket

- Gold only. No $WOC, no USD, no purchasable currency path, ever.
- Hard per-match wager cap, justified against level-appropriate gold income (below).
- No daily-reward coupling. `recordValeCupResult` stays SKIP (PHAA-518); this
  mechanic is a flat, always-available, per-match cap, never a streak, allowance,
  or timer. `docs/plan-the-hollow.md:407` bans engagement dark patterns (streaks,
  daily rewards, FOMO timers); this design is written to stay clearly on the safe
  side of that line, not just technically avoid the one banned hook.
- Server-authoritative escrow and payout: wager state lives in `src/sim/`, resolves
  with the match result, the client only renders.
- Abuse angles addressed in this doc: collusion (wagering on your own bracket),
  win-trading, gold-farming incentive.

## 2. Currency reality check

The fork's currency is `copper` (`PlayerMeta.copper`); 100 copper = 1 silver, 100
silver = 1 gold (10,000 copper), per `src/sim/format_money.ts` and the comment on
`src/sim/progression/trainer.ts:20`. "Gold-only" in the ticket title means "the
existing copper economy," not a separate wallet.

Reference points pulled from the live content tables and gold-sink code, used to
size the cap in §3:

| Source | Copper | Gold |
|---|---|---|
| Starter-zone quest reward (`hollow_zone.ts`, `hollow.ts`) | 40 to 150 | 0.004 to 0.015g |
| Zone 1 quest reward, typical | 75 to 900 | 0.0075 to 0.09g |
| Zone 1 quest reward, epic chain finale (outlier) | 10,000 | 1g |
| Zone 2 quest reward, typical | 200 to 1,000 | 0.02 to 0.1g |
| Zone 3 quest reward, typical | 500 to 3,500 | 0.05 to 0.35g |
| Zone 3 quest reward, epic chain finale (outlier) | 25,000 | 2.5g |
| First bank slot expansion (`BANK_EXPANSION_PRICES[0]`) | 500 | 0.05g |
| Last bank slot expansion (12th tier) | 1,200,000 | 120g |
| First paid secondary-class change (`SECONDARY_CLASS_CHANGE_COST[0]`) | 10,000 | 1g |
| Last paid secondary-class change (5th+ tier) | 500,000 | 50g |
| Market single-listing ceiling (fat-finger guard, not income) | 5,000,000 | 500g |

Boarball itself carries no level gate in `arena.ts` (the unranked FIFO queue takes
any queued player), so the cap has to be affordable and meaningful to the *lowest*
level in the potential spectator pool, not tuned to endgame income.

## 3. The cap

**Proposal: 500 copper (0.05g) per spectator, per match. Minimum wager: 10 copper.**

Justification:
- 500 copper equals the cheapest bank slot expansion, exactly one tier of a real
  gold sink a new character can already afford. It reads as "the price of one
  small extravagance," not "meaningful savings."
- It sits inside the typical single-quest-reward band for every zone tier (75 to
  3,500 copper). A spectator can cover the max wager from one ordinary quest
  turn-in at their own level, without farming for it first.
- It is two to three orders of magnitude below the real gold sinks in the game
  (50g to 120g for late bank tiers and secondary-class respecs), so no realistic
  win streak accelerates a player past those sinks faster than just playing.
  Worked example: a spectator who wins every wager at the cap for 100 straight
  matches nets at most 50,000 copper (5g, before the cut in §5 below) minus
  everything they staked and lost along the way, since payouts come out of other
  spectators' equally-capped stakes, not a bottomless house. Compare the 5th-tier
  secondary-class respec (500,000 copper): wagering at the cap cannot fund it
  meaningfully faster than an afternoon of ordinary content.
- One open wager per match, one side only (no straddling both teams). Betting
  both sides just returns your own stake to yourself minus the cut (see §5); it
  adds no gameplay value and only exists as a wash-trading primitive, so it is
  disallowed outright rather than allowed-but-taxed.

This number is the thing the request_confirmation on this issue asks the Board to
approve or amend.

## 4. Wager flow

Boarball matches already carry the state machine needed for this (`ArenaMatch.state:
'countdown' | 'active' | 'over'`, `src/sim/sim.ts:539`). Wagering piggybacks on it
instead of adding new tick-phase ordering:

1. **Open (`countdown`).** From the moment a boarball match is created until
   kickoff, any non-participant may place exactly one wager on it: pick a team (A
   or B), stake 10 to 500 copper. Copper is debited immediately (the
   `trainer.ts` check-then-spend pattern: verify balance, then spend) and held in
   escrow on the match, not the player.
2. **Locked (`active`).** The instant the match leaves `countdown`, wagering
   closes. No new wagers, no changes to an existing one. This is deliberate and
   is the one place this design diverges from a "live in-play betting" shape
   upstream's slices may have had: locking at kickoff removes the obvious cheat
   of watching the score and betting on the team that is already winning, and it
   means resolution needs no dynamic odds engine, just a fixed pool split at the
   final whistle. Flagging this choice for the Board and PHAA-572's reviewers
   explicitly, since it is a real behavior decision, not just an implementation
   detail.
3. **Resolve (`state -> 'over'`).** `endArenaMatch` already knows the winner
   (`ArenaMatch` scoring, `boarball.ts:222/235`). On a decisive result, every
   stake on the winning side gets its own stake back plus a pro-rata share of the
   losing pool (pari-mutuel: no house, no fixed odds, gold only ever moves
   between the spectators who staked it). On a draw (`timeout` with equal score)
   or an aborted match (a participant disconnects before kickoff and the match
   never starts), every stake is refunded in full, no cut taken; nobody "lost" to
   a match that did not happen.
4. **Offline payout.** A spectator who logs off before resolution still gets
   their result: a winning payout with nobody online to hand it to goes to the
   post office, the same offline-recipient path mail and market proceeds already
   use (`src/sim/mail/post_office.ts`, `src/sim/market.ts`'s awaiting-pickup
   bucket), not a new delivery mechanism.

## 5. The cut (gold sink, and a light tax on collusion)

5% of the losing pool is removed from the economy at resolution, matching the
`MARKET_CUT` precedent (`src/sim/market.ts:24`, "the Merchant's cut on a completed
sale, a gold sink"). Winners split their own stake back plus 95% of the losing
pool; the remaining 5% is destroyed, not paid to any NPC or account. Two reasons:

- It keeps aggregate wagering net-negative-expected-value for the average player
  in the long run, consistent with "cozy, not a grind" (`docs/plan-the-hollow.md`
  scope lock) rather than a mechanic worth optimizing.
- It taxes any attempt to use the pool as a laundering channel between two
  colluding accounts (see §6): every round-trip loses 5%, so it is never free.

## 6. Abuse mitigations

- **Self-match lockout (the ticket's named minimum).** Any pid in `match.teamA`
  or `match.teamB` is blocked from wagering on that match, full stop; the client
  wager control is not shown to participants at all, and the server command
  rejects it independently (never trust the client-side hide).
- **Win-trading between two accounts.** `matchmakeBoarball` is a flat FIFO fill
  with no opponent choice, so two accounts cannot reliably queue into each other
  to prearrange a scripted result; a coordinated four-account premade queueing
  all of both teams at once is the one way around that, but that is a pre-existing
  property of the unranked queue, true today with nothing on the line. The cap
  bounds the value such a group can move per match regardless (§3); it is not
  eliminated by any code-side check, so log every wager (staker, team, amount,
  match id, resolution) so a moderator can spot a small cluster of accounts that
  only ever wagers big when a specific premade queues, and act on it the same way
  `jail` (PHAA-657) or the admin RBAC tooling (PHAA-576/PHAA-498) already act on
  other reported abuse. This is a detection-and-moderate answer, not a
  code-level prevention; deliberate collusion between consenting real people is
  outside what a server-authoritative check can ever fully rule out.
- **Gold-farming incentive.** Pari-mutuel with no house means the pool is
  zero-sum before the cut and net-negative after it: the total copper supply
  cannot inflate through wagering (contrast a mob-loot or quest-reward exploit,
  which mints new copper). Combined with the cap in §3, wagering is strictly
  worse expected-value-per-hour than playing the match itself, so there is no
  rational farming loop here to guard against beyond the collusion case above.
- **Dust / spam wagers.** 10 copper minimum keeps the pool book from filling with
  1-copper no-op entries.

## 7. Server-side shape (sketch, for the implementation child)

Nests under `BoarballState` (`src/sim/sim.ts`), following the existing
fiesta/boarball match-scoped sub-state precedent, not a new top-level `ArenaMatch`
field (only boarball supports wagering):

```ts
export interface WagerStake {
  pid: number;
  team: 'A' | 'B';
  amount: number; // copper, already escrowed off the staker's balance
}

export interface WagerState {
  stakes: WagerStake[];
  locked: boolean; // set true the instant match.state leaves 'countdown'
}
```

New `SimContext`-seam entry point, alongside `boarballShoot`/`boarballPass`:
`placeBoarballWager(ctx, spectatorPid, matchId, team, amount)`, validating in
order: match exists and is boarball, not locked, `spectatorPid` is not a
participant, no existing stake from this pid on this match, amount within
[10, 500], balance covers it. Resolution is not a separate command: it happens
inside the existing `endArenaMatch` call in `boarball.ts`, gated on
`match.boarball?.wager` being present, mirroring how score/timeout resolution
already lives there.

New wire events for `IWorld`/the client mirror (`src/net/online.ts`), parity
required in both `Sim` and `ClientWorld` per the one-seam rule:
`boarballWagerPlaced` (echoed to the staker for confirmation) and
`boarballWagerResult` (team, won, payout, pushed to every staker at resolution).

## 8. Client UI surface

No "watch a live match" browsing UI exists today; the closest primitive is the
existing spectate mode (`net.spectating: string | null`, `src/net/online.ts:820`),
today reached from corpse-run and moderation flows, camera-following one named
player. Two new small pieces, not a new spectator-camera system:

- A **Vale Cup board** near the Ashen Coliseum arena entrance listing boarball
  matches currently in `countdown`, each with a "Watch" action that sets
  `net.spectating` to one of that match's participants (reusing the existing
  spectate primitive, not inventing a second one).
- A **wager ticket**, a small HUD window shown only while spectating a boarball
  match in `countdown`: pick a team, pick an amount up to the cap, confirm. Once
  the match locks, the ticket turns read-only and shows your stake and the live
  pot per side; at resolution it shows the win/loss/refund toast from §4. Built
  as a pure view-core (`src/ui/boarball_wager_view.ts`, DOM/Three-free,
  Node-tested) plus a thin `PainterHost` painter
  (`src/ui/boarball_wager_painter.ts`), per `src/ui/CLAUDE.md`'s HUD-component
  recipe, not a new banner section on `hud.ts`.

## 9. i18n keys (English only, this change; the maintainer fills locales at
release per the root `CLAUDE.md`)

Extends the existing `boarball` catalog domain (`src/ui/i18n.catalog/index.ts:824`,
which already carries `boarball.queue.*`, `boarball.log.*`, `boarball.error.*`)
with a new `boarball.wager.*` group:

- `boarball.wager.title`, board panel heading
- `boarball.wager.pickTeam`, team-select prompt
- `boarball.wager.amountLabel`, stake input label
- `boarball.wager.placeButton`
- `boarball.wager.locked`, shown once `countdown` ends
- `boarball.wager.potLabel`, live per-side pool while locked
- `boarball.wager.confirmToast`, "You backed Team {team} for {amount}."
- `boarball.wager.winToast`, "Team {team} won. You collect {amount}."
- `boarball.wager.loseToast`, "Team {team} lost. Your wager of {amount} is gone."
- `boarball.wager.refundToast`, draw or aborted-match refund
- `boarball.error.wagerClosed`, attempt to wager after lock
- `boarball.error.wagerOwnMatch`, self-match lockout (participants)
- `boarball.error.wagerBelowMinimum`
- `boarball.error.wagerAboveCap`
- `boarball.error.wagerInsufficientGold`
- `boarball.error.wagerAlreadyPlaced`, one open wager per match per account

Numeric values (amounts) go through `formatMoney`, never string-concatenated,
per the root `CLAUDE.md` i18n rule.

## 10. Out of scope for this ticket

- The implementation itself, filed as a child issue once the Board confirms §3.
  PHAA-572 (boarball core, the ticket's stated blocker) has since merged
  (PR #153), so once the Board confirms the numbers here the implementation
  child is clear to start immediately.
- `recordValeCupResult` / any daily-reward coupling: stays SKIP, PHAA-518.
- Any currency other than copper for this implementation. See §12: the Board has
  since approved item/material stakes in principle, but they need their own
  valuation and escrow design and are not part of what ships under this doc.
- A "watch any live match" spectator browser for formats other than boarball;
  the Vale Cup board in §8 is boarball-specific, reusing the existing spectate
  primitive, not a general spectator system.

## 11. Reviewers for the implementation child (per the ticket)

`architecture-reviewer` (SimContext seam, determinism: this design draws no rng,
matching boarball's own zero-rng precedent) and `privacy-security-review`
(server-authoritative escrow, no client-trusted amounts, self-match lockout
enforced server-side).

## 12. Addendum, 2026-07-21 (Board, PHAA-702): scope widened, collusion posture settled

Two follow-up answers from the Board, on the sibling decision ticket PHAA-702, land
on this design without changing the numbers in play:

- **Item/material stakes are approved in principle**, on top of the gold-only
  shape above. This is not specced here: an item stake needs its own answers
  before it can ship (which items are even eligible, how a non-fungible or
  stacked item's stake value is capped and compared against the gold cap in §3,
  whether soulbound items are excluded, and an escrow shape for holding an
  arbitrary item rather than a copper integer). Treat it as a scoped follow-up
  design, not an extension of the implementation child this doc unblocks. Gold
  wagering per §§1 to 9 ships unchanged and first.
- **Bettor/player collusion is explicitly not an active-prevention target.** The
  Board's answer was to allow it and rely on post-hoc audit logging, which
  matches this doc's own §6 stance on win-trading (detection and moderator
  review, not a code-level block) and settles the one place §4 flagged itself
  for review: no live-odds or in-play betting shape is needed to counter
  collusion, since collusion is out of scope for prevention entirely. The
  self-match lockout in §6 stays, since it is a cheap, unambiguous server check
  with no false-positive risk, not a collusion mitigation.
- The Scope Lock amendment this decision required (§1's opening line, "currency-
  only wagering is out forever, the mechanic shape is approved") is now formal:
  `docs/plan-the-hollow.md`'s Scope Lock, section 6, amended 2026-07-21.
