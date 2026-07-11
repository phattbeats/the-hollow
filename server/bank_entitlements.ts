// Bank bonus-slot entitlements: the pure, extensible source registry that turns a
// bag of account facts (email verified, Discord linked) into the bonus-slot total
// plus the per-source breakdown a bank window would advertise. No DB import lives
// here: server/db.ts reads the raw facts in one parameterized query and pipes them
// through computeBankBonus, so this module stays a host-agnostic leaf a Vitest
// imports directly.
//
// ADAPT NOTE (PHAA-571): ported from upstream's bank feature with the
// wallet-link and qualified-referral sources DROPPED, since this fork strips the
// $WOC wallet stack and does not run the referral/growth program those sources
// were built on. The upstream X/Twitch follow sources were never built (blocked
// on link systems that don't exist here either), so they never make this list.
// Only base slots plus the two non-monetary rows survive: verified email and a
// linked Discord account.
//
// EXTENSIBILITY (the registry's design contract): a new source is one more row in
// BANK_BONUS_SOURCES. computeBankBonus emits one BankBonusSource per registry row,
// so adding a row grows the breakdown by exactly one entry and changes no existing
// row or the shape.
//
// TRIPWIRE: maxBankBonusSlots(BANK_BONUS_SOURCES) is test-pinned EQUAL to
// BANK_MAX_BONUS_SLOTS (src/sim/bank.ts), the load-path clamp for a persisted/
// tampered bonusSlots value. The registry can never grant more than the sim will
// admit, so a future source row bumps both constants together.

import type { BankBonusSource } from '../src/sim/bank';

/** The raw account facts the entitlement math reads. Populated by one parameterized
 *  query (server/db.ts bankBonusFactsForAccount); a missing account is all-false. */
export interface BankBonusFacts {
  emailVerified: boolean;
  discordLinked: boolean;
}

/** One entitlement source as data: how many slots a unit is worth, how many units
 *  cap the source, and the pure function that reads the fact into a unit count.
 *  Every source here is binary (0 or 1 units, capUnits 1). */
export interface BankBonusSourceDef {
  id: string;
  slotsPerUnit: number;
  capUnits: number;
  units(f: BankBonusFacts): number;
}

/** The shipped v1 registry: +2 email (verified), +2 Discord linked. Order is the
 *  display order a future bank window's footer would render. Append-only data. */
export const BANK_BONUS_SOURCES: readonly BankBonusSourceDef[] = [
  { id: 'email', slotsPerUnit: 2, capUnits: 1, units: (f) => (f.emailVerified ? 1 : 0) },
  { id: 'discord', slotsPerUnit: 2, capUnits: 1, units: (f) => (f.discordLinked ? 1 : 0) },
];

/** Turn the facts into the bonus-slot total and the per-source breakdown. Each row
 *  is { id, slots, maxSlots }: slots = min(units, capUnits) * slotsPerUnit,
 *  maxSlots = capUnits * slotsPerUnit. bonusSlots is the sum of the row slots.
 *  Units are floored and clamped non-negative so a malformed fact can never mint
 *  slots. */
export function computeBankBonus(
  facts: BankBonusFacts,
  registry: readonly BankBonusSourceDef[] = BANK_BONUS_SOURCES,
): { bonusSlots: number; sources: BankBonusSource[] } {
  const sources: BankBonusSource[] = [];
  let bonusSlots = 0;
  for (const def of registry) {
    const rawUnits = Math.max(0, Math.floor(def.units(facts)) || 0);
    const earnedUnits = Math.min(rawUnits, def.capUnits);
    const slots = earnedUnits * def.slotsPerUnit;
    sources.push({ id: def.id, slots, maxSlots: def.capUnits * def.slotsPerUnit });
    bonusSlots += slots;
  }
  return { bonusSlots, sources };
}

/** The most bonus slots the registry can grant, i.e. every source fully earned.
 *  Pinned EQUAL to BANK_MAX_BONUS_SLOTS (src/sim/bank.ts) by
 *  tests/bank_entitlements.test.ts; a future source that bumps this must bump
 *  that sim constant in the same change. */
export function maxBankBonusSlots(
  registry: readonly BankBonusSourceDef[] = BANK_BONUS_SOURCES,
): number {
  return registry.reduce((sum, def) => sum + def.capUnits * def.slotsPerUnit, 0);
}
