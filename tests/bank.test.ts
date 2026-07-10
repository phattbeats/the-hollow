import { describe, expect, it } from 'vitest';
import {
  BANK_BASE_SLOTS,
  BANK_EXPANSION_PRICES,
  BANK_EXPANSION_SLOTS,
  BANK_MAX_BONUS_SLOTS,
  type BankState,
  bankCapacity,
  clampBonusSlots,
  moveStack,
  sanitizeBankState,
} from '../src/sim/bank';
import { Sim } from '../src/sim/sim';
import type { Entity, InvSlot, SimEvent } from '../src/sim/types';

// Direct tests for the bank vault core (PHAA-571). They call the Sim delegates
// (the thin forwarders onto the module, same pattern as tests/items.test.ts),
// exercising the moved bodies through the real seam, not mocks.

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
}

// No banker NPC exists in content yet (PHAA-571 is core-only), so tests repurpose
// any live NPC's entity id as a stand-in banker anchor via the private bankerIds
// field, and stand the player next to it. This exercises the real proximity gate
// (dist2d + entities.get + kind check), not a mock.
function bankPlayer(sim: Sim, name = 'Aleph') {
  const pid = sim.addPlayer('warrior', name);
  const anySim = sim as unknown as {
    entities: Map<number, Entity>;
    players: Map<number, { copper: number; bank: BankState; inventory: InvSlot[] }>;
    bankerIds: number[];
    rebucket(e: Entity): void;
  };
  const banker = [...anySim.entities.values()].find((e) => e.kind === 'npc') as Entity;
  anySim.bankerIds.push(banker.id);
  const p = anySim.entities.get(pid) as Entity;
  p.pos.x = banker.pos.x + 2;
  p.pos.z = banker.pos.z;
  anySim.rebucket(p);
  const meta = anySim.players.get(pid)!;
  return { pid, banker, p, meta };
}

function errorTexts(events: SimEvent[]): string[] {
  return events
    .filter((e): e is Extract<SimEvent, { type: 'error' }> => e.type === 'error')
    .map((e) => e.text);
}

describe('bank.moveStack', () => {
  it('moves the whole stack all-or-nothing and tops up an existing dest stack', () => {
    const source: InvSlot[] = [{ itemId: 'linen_cloth', count: 5 }];
    const dest: InvSlot[] = [{ itemId: 'linen_cloth', count: 2 }];
    const result = moveStack(source, 0, undefined, dest, 24);
    expect(result).toEqual({ moved: 5 });
    expect(source).toEqual([]);
    expect(dest).toEqual([{ itemId: 'linen_cloth', count: 7 }]);
  });

  it('refuses no_fit when the dest is full and the item is not already stacked there', () => {
    const source: InvSlot[] = [{ itemId: 'linen_cloth', count: 1 }];
    const dest: InvSlot[] = [{ itemId: 'wool_cloth', count: 1 }];
    const result = moveStack(source, 0, undefined, dest, 1);
    expect(result).toEqual({ moved: 0, refusal: 'no_fit' });
    expect(source).toEqual([{ itemId: 'linen_cloth', count: 1 }]); // untouched
  });

  it('refuses invalid for an out-of-range index or an over-count request', () => {
    const source: InvSlot[] = [{ itemId: 'linen_cloth', count: 1 }];
    expect(moveStack(source, 5, undefined, [], 24)).toEqual({ moved: 0, refusal: 'invalid' });
    expect(moveStack(source, 0, 2, [], 24)).toEqual({ moved: 0, refusal: 'invalid' });
  });
});

describe('bank capacity + clamps', () => {
  it('sums base + purchased + bonus', () => {
    expect(bankCapacity({ inventory: [], purchasedSlots: 12, bonusSlots: 4 })).toBe(
      BANK_BASE_SLOTS + 12 + 4,
    );
  });

  it('clampBonusSlots floors and bounds into [0, BANK_MAX_BONUS_SLOTS]', () => {
    expect(clampBonusSlots(-5)).toBe(0);
    expect(clampBonusSlots(2.9)).toBe(2);
    expect(clampBonusSlots(999)).toBe(BANK_MAX_BONUS_SLOTS);
    expect(clampBonusSlots('not a number')).toBe(0);
  });
});

describe('bank.sanitizeBankState', () => {
  it('defaults a missing/malformed save to empty', () => {
    expect(sanitizeBankState(undefined)).toEqual({
      inventory: [],
      purchasedSlots: 0,
      bonusSlots: 0,
    });
    expect(sanitizeBankState('garbage')).toEqual({
      inventory: [],
      purchasedSlots: 0,
      bonusSlots: 0,
    });
  });

  it('drops malformed entries but keeps well-formed ones, and floors purchasedSlots to the expansion grid', () => {
    const state = sanitizeBankState({
      inventory: [
        { itemId: 'linen_cloth', count: 3 },
        { itemId: '', count: 5 }, // dropped: empty itemId
        { count: 5 }, // dropped: no itemId
        null, // dropped
      ],
      purchasedSlots: 20, // not a multiple of BANK_EXPANSION_SLOTS (6): floors to 18
      bonusSlots: 999, // clamped
    });
    expect(state.inventory).toEqual([{ itemId: 'linen_cloth', count: 3 }]);
    expect(state.purchasedSlots).toBe(18);
    expect(state.bonusSlots).toBe(BANK_MAX_BONUS_SLOTS);
  });

  it('clamps purchasedSlots to the max purchasable ceiling', () => {
    const maxPurchased = BANK_EXPANSION_PRICES.length * BANK_EXPANSION_SLOTS;
    const state = sanitizeBankState({ inventory: [], purchasedSlots: maxPurchased + 100 });
    expect(state.purchasedSlots).toBe(maxPurchased);
  });
});

describe('bank vault core, through the Sim seam', () => {
  it('bankInfoFor is null unless standing near a banker', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Aleph');
    expect(sim.bankInfoFor(pid)).toBeNull();
  });

  it('deposit moves an item from inventory into the bank and updates bankInfoFor', () => {
    const sim = makeWorld();
    const { pid, meta } = bankPlayer(sim);
    sim.addItem('linen_cloth', 3, pid);
    const slotIndex = meta.inventory.findIndex((s) => s.itemId === 'linen_cloth');

    sim.bankDeposit(slotIndex, 2, pid);

    expect(sim.countItem('linen_cloth', pid)).toBe(1);
    const info = sim.bankInfoFor(pid);
    expect(info?.slots).toEqual([{ itemId: 'linen_cloth', count: 2 }]);
    expect(info?.capacity).toBe(BANK_BASE_SLOTS);
  });

  it('deposit refuses a quest item without moving it', () => {
    const sim = makeWorld();
    const { pid, meta } = bankPlayer(sim);
    sim.addItem('emberbulb', 1, pid); // quest kind (src/sim/content/hollow.ts)
    const slotIndex = meta.inventory.findIndex((s) => s.itemId === 'emberbulb');

    sim.bankDeposit(slotIndex, 1, pid);

    expect(sim.countItem('emberbulb', pid)).toBe(1); // untouched
    expect(sim.bankInfoFor(pid)?.slots).toEqual([]);
    expect(errorTexts(sim.drainEvents())).toContain('You cannot store quest items in the bank.');
  });

  it('deposit/withdraw/buySlots all refuse with a too-far error when off a banker', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Aleph');
    sim.addItem('linen_cloth', 1, pid);

    sim.bankDeposit(0, 1, pid);
    sim.bankWithdraw(0, 1, pid);
    sim.bankBuySlots(pid);

    expect(sim.countItem('linen_cloth', pid)).toBe(1); // untouched
    expect(sim.bankInfoFor(pid)).toBeNull();
    const errs = errorTexts(sim.drainEvents());
    expect(errs.filter((t) => t === 'You are too far from the banker.')).toHaveLength(3);
  });

  it('withdraw moves an item from the bank back into inventory', () => {
    const sim = makeWorld();
    const { pid } = bankPlayer(sim);
    sim.addItem('linen_cloth', 4, pid);
    sim.bankDeposit(0, 4, pid);

    sim.bankWithdraw(0, 1, pid);

    expect(sim.countItem('linen_cloth', pid)).toBe(1);
    expect(sim.bankInfoFor(pid)?.slots).toEqual([{ itemId: 'linen_cloth', count: 3 }]);
  });

  it('buySlots spends the table price, grows capacity, and blocks when unaffordable', () => {
    const sim = makeWorld();
    const { pid, meta } = bankPlayer(sim);
    meta.copper = BANK_EXPANSION_PRICES[0];

    sim.bankBuySlots(pid);

    expect(meta.copper).toBe(0);
    expect(sim.bankInfoFor(pid)?.capacity).toBe(BANK_BASE_SLOTS + BANK_EXPANSION_SLOTS);

    const before = meta.bank.purchasedSlots;
    sim.bankBuySlots(pid); // can't afford the next tier (copper is 0)
    expect(meta.bank.purchasedSlots).toBe(before);
    expect(errorTexts(sim.drainEvents())).toContain('You cannot afford that bank expansion.');
  });

  it('serializeCharacter round-trips bank state through addPlayer', () => {
    const sim = makeWorld();
    const { pid, meta } = bankPlayer(sim);
    sim.addItem('linen_cloth', 5, pid);
    sim.bankDeposit(0, 5, pid);
    meta.copper = BANK_EXPANSION_PRICES[0];
    sim.bankBuySlots(pid);

    const state = sim.serializeCharacter(pid)!;
    expect(state.bank).toEqual({
      inventory: [{ itemId: 'linen_cloth', count: 5 }],
      purchasedSlots: BANK_EXPANSION_SLOTS,
      bonusSlots: 0,
    });

    const sim2 = makeWorld();
    const pid2 = sim2.addPlayer('warrior', 'Reloaded', { state });
    const state2 = sim2.serializeCharacter(pid2)!;
    expect(state2.bank).toEqual(state.bank);
  });

  it('a pre-bank save (no bank field) loads with an empty vault', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Legacy');
    const state = sim.serializeCharacter(pid)!;
    state.bank = undefined; // simulate a pre-PHAA-571 save

    const sim2 = makeWorld();
    const pid2 = sim2.addPlayer('warrior', 'Legacy', { state });
    const state2 = sim2.serializeCharacter(pid2)!;
    expect(state2.bank).toEqual({ inventory: [], purchasedSlots: 0, bonusSlots: 0 });
  });
});
