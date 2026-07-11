import { describe, expect, it } from 'vitest';
import {
  BANK_BONUS_SOURCES,
  type BankBonusFacts,
  computeBankBonus,
  maxBankBonusSlots,
} from '../server/bank_entitlements';
import { BANK_MAX_BONUS_SLOTS } from '../src/sim/bank';

const NO_FACTS: BankBonusFacts = { emailVerified: false, discordLinked: false };

describe('bank_entitlements registry (PHAA-571: wallet-link + referral sources dropped)', () => {
  it('grants zero bonus slots with no account facts', () => {
    expect(computeBankBonus(NO_FACTS)).toEqual({
      bonusSlots: 0,
      sources: [
        { id: 'email', slots: 0, maxSlots: 2 },
        { id: 'discord', slots: 0, maxSlots: 2 },
      ],
    });
  });

  it('grants +2 per earned binary source, independently', () => {
    expect(computeBankBonus({ emailVerified: true, discordLinked: false }).bonusSlots).toBe(2);
    expect(computeBankBonus({ emailVerified: false, discordLinked: true }).bonusSlots).toBe(2);
    expect(computeBankBonus({ emailVerified: true, discordLinked: true }).bonusSlots).toBe(4);
  });

  it('carries no wallet or referral row: only email + discord remain', () => {
    const ids = BANK_BONUS_SOURCES.map((s) => s.id);
    expect(ids).toEqual(['email', 'discord']);
    expect(ids).not.toContain('wallet');
    expect(ids).not.toContain('referral');
  });

  // TRIPWIRE: the sim's load-path clamp (src/sim/bank.ts) must never fall behind
  // the registry ceiling here, in either direction. A future source bumps both in
  // the same change (see the module header comments in both files).
  it('maxBankBonusSlots is pinned equal to BANK_MAX_BONUS_SLOTS', () => {
    expect(maxBankBonusSlots(BANK_BONUS_SOURCES)).toBe(BANK_MAX_BONUS_SLOTS);
  });
});
