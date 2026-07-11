// Bank: the per-character deposit box, a second pooled item store alongside the
// carried inventory. Capacity is a flat slot budget over one stacked list (each
// slot is one distinct itemId, exactly like `Sim.addItem`'s stacking rule); state
// lives on PlayerMeta.bank and persists inside the character save (CharacterState),
// additive/optional so pre-bank saves load cleanly. The base 24 slots grow in
// 6-slot blocks bought with copper (BANK_EXPANSION_PRICES); bonus slots are
// server-stamped at join from account entitlements (server/bank_entitlements.ts).
//
// ADAPT NOTE (PHAA-571): ported from upstream's bank feature, core only. Dropped
// with it: the wallet-link / referral / social-follow bonus-slot sources (those
// stacks are stripped from this fork), leaving email + Discord as the only
// entitlement rows. BANK_MAX_BONUS_SLOTS below is the load-path clamp and MUST
// stay equal to maxBankBonusSlots(BANK_BONUS_SOURCES) in
// server/bank_entitlements.ts (tests/bank_entitlements.test.ts pins the two
// together); a future source bumps both in the same change.
//
// Deliberately NOT wired in this change: no IWorld facet / wire command / UI
// window, and no banker NPC placed in zone content, so the vault is not yet
// player-reachable. `nearBanker` reads `ctx.bankerIds`, which is empty until a
// follow-up ticket places banker NPCs (see PHAA-571 for the tracked follow-up).
// This module is a real, testable, server-authoritative core in the meantime,
// following the pattern of `items.ts`: free functions `fn(ctx, ...)` behind
// `SimContext`, backing state on `Sim`'s `PlayerMeta`.
//
// `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no Math.random/Date.now
// (enforced by tests/architecture.test.ts). This module draws NO rng.

import { ITEMS } from './data';
import type { SimContext } from './sim_context';
import { dist2d, type Entity, INTERACT_RANGE, type InvSlot } from './types';

/** Slots every character's bank starts with, before any expansion. */
export const BANK_BASE_SLOTS = 24;
/** Slots one copper expansion adds; also the granularity purchasedSlots stays on. */
export const BANK_EXPANSION_SLOTS = 6;
/** Copper cost of each successive expansion, cheapest first. The entry count is the
 *  purchase cap, so the purchased ceiling is 24 + 12*6 = 96. Data-as-code: the price
 *  is always this table lookup, never a client-supplied value. */
export const BANK_EXPANSION_PRICES: readonly number[] = [
  500, 1000, 2500, 5000, 10000, 20000, 40000, 80000, 150000, 300000, 600000, 1200000,
];

/** The most bonus slots the server's entitlement registry can grant: +2 email
 *  verified, +2 Discord linked (the wallet-link and qualified-referral sources are
 *  dropped in this fork, see PHAA-571). This is the load-path clamp for
 *  `bonusSlots` (a tampered save must not mint capacity the registry cannot grant).
 *  Pinned equal to `maxBankBonusSlots(BANK_BONUS_SOURCES)`
 *  (server/bank_entitlements.ts) by tests/bank_entitlements.test.ts, so a future
 *  source bumps BOTH in the same change or that tripwire goes red. */
export const BANK_MAX_BONUS_SLOTS = 4;

/** Coerce a persisted/stamped bonus-slot value into [0, BANK_MAX_BONUS_SLOTS]. */
export function clampBonusSlots(raw: unknown): number {
  return Math.max(0, Math.min(BANK_MAX_BONUS_SLOTS, Math.floor(Number(raw)) || 0));
}

/** One row of the server-computed bonus-slot breakdown, mirroring
 *  server/bank_entitlements.ts's BankBonusSourceDef output. Kept local to this
 *  module (not the IWorld seam) until a follow-up surfaces the bank over the wire. */
export interface BankBonusSource {
  id: string; // stable source id ('email' | 'discord'; future sources append)
  slots: number; // slots this source grants right now
  maxSlots: number; // slots it grants when fully earned
}

/** A character's bank: a pooled item list plus its two slot-budget contributions.
 *  `purchasedSlots` is always a multiple of BANK_EXPANSION_SLOTS in [0, 72];
 *  `bonusSlots` is server-stamped at join by the entitlement registry (0 offline). */
export interface BankState {
  inventory: InvSlot[];
  purchasedSlots: number;
  bonusSlots: number;
}

/** The proximity-gated bank snapshot a future IWorld seam would expose: null
 *  unless the player stands within reach of a banker NPC, else a boundary-cloned
 *  view of PlayerMeta.bank. */
export interface BankInfo {
  slots: InvSlot[];
  capacity: number;
  purchasedSlots: number;
  bonusSlots: number;
  nextExpansionCost: number | null;
  bonusSources: BankBonusSource[];
}

/** The bank's current slot budget. Over-capacity inventories are tolerated (a
 *  tampered/legacy save may overflow); capacity only blocks new deposits. */
export function bankCapacity(bank: BankState): number {
  return BANK_BASE_SLOTS + bank.purchasedSlots + bank.bonusSlots;
}

export type MoveRefusal = 'invalid' | 'no_fit';
export interface MoveResult {
  moved: number;
  refusal?: MoveRefusal;
}

/** True when `dest` has room for another unit of `itemId`: either an existing
 *  stack to top up, or a free slot under `destCapacity`. Mirrors the stacking
 *  rule `Sim.addItem` already uses (find-existing-or-push), just capacity-gated:
 *  our plain `InvSlot[]` has no separate bag-slot helpers to reuse. */
function hasRoomFor(dest: InvSlot[], destCapacity: number, itemId: string): boolean {
  return dest.some((s) => s.itemId === itemId) || dest.length < destCapacity;
}

/** Move (all or part of) one source slot's items into a destination container,
 *  ALL-OR-NOTHING: the full requested count moves or nothing does. Mutates the
 *  two arrays ONLY on success. `count` undefined = the whole stack. */
export function moveStack(
  source: InvSlot[],
  sourceIndex: number,
  count: number | undefined,
  dest: InvSlot[],
  destCapacity: number,
): MoveResult {
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= source.length) {
    return { moved: 0, refusal: 'invalid' };
  }
  const slot = source[sourceIndex];
  const want = count === undefined ? slot.count : Math.floor(count);
  if (!(want > 0) || want > slot.count) return { moved: 0, refusal: 'invalid' };
  if (!hasRoomFor(dest, destCapacity, slot.itemId)) return { moved: 0, refusal: 'no_fit' };
  const existing = dest.find((s) => s.itemId === slot.itemId);
  if (existing) existing.count += want;
  else dest.push({ itemId: slot.itemId, count: want });
  if (want >= slot.count) source.splice(sourceIndex, 1);
  else slot.count -= want;
  return { moved: want };
}

/** How close a player must stand to a banker NPC to use the bank. Mirrors the
 *  World Market's reach (nearMerchant in market.ts): INTERACT_RANGE + 2. */
const BANKER_RANGE = INTERACT_RANGE + 2;

/** True when the player entity stands within reach of any live banker NPC.
 *  `ctx.bankerIds` is empty until zone content places banker NPCs (a follow-up
 *  to this change), so this always refuses today; the gate is real and tested. */
function nearBanker(ctx: SimContext, e: Entity): boolean {
  for (const id of ctx.bankerIds) {
    const b = ctx.entities.get(id);
    if (b && b.kind === 'npc' && dist2d(e.pos, b.pos) <= BANKER_RANGE) return true;
  }
  return false;
}

/** Deposit a carried-inventory slot into the bank. Quest items are refused (they
 *  are quest-bound); everything else follows the pooled capacity rules. A
 *  successful move pokes the quest-inventory recompute (the collect-quest count
 *  reads from the carried inventory, not the bank). */
export function bankDeposit(
  ctx: SimContext,
  slotIndex: number,
  count?: number,
  pid?: number,
): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (!nearBanker(ctx, p)) {
    ctx.error(meta.entityId, 'You are too far from the banker.');
    return;
  }
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= meta.inventory.length) return;
  const slot = meta.inventory[slotIndex];
  if (ITEMS[slot.itemId]?.kind === 'quest') {
    ctx.error(meta.entityId, 'You cannot store quest items in the bank.');
    return;
  }
  const result = moveStack(
    meta.inventory,
    slotIndex,
    count,
    meta.bank.inventory,
    bankCapacity(meta.bank),
  );
  if (result.refusal === 'no_fit') {
    ctx.error(meta.entityId, 'Your bank is full.');
    return;
  }
  if (result.refusal) return; // 'invalid': malformed input (cheat/desync), no player line
  ctx.onInventoryChangedForQuests(meta);
}

/** Withdraw a bank slot back into the carried inventory: the mirror of deposit.
 *  The carried inventory is uncapped in this fork (see `Sim.addItem`), so this
 *  can never refuse 'no_fit' on the destination side; it exists for symmetry with
 *  the deposit direction and to keep the shared `moveStack` refusal shape. */
export function bankWithdraw(
  ctx: SimContext,
  slotIndex: number,
  count?: number,
  pid?: number,
): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (!nearBanker(ctx, p)) {
    ctx.error(meta.entityId, 'You are too far from the banker.');
    return;
  }
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= meta.bank.inventory.length) {
    return;
  }
  const result = moveStack(
    meta.bank.inventory,
    slotIndex,
    count,
    meta.inventory,
    Number.POSITIVE_INFINITY,
  );
  if (result.refusal) return; // 'invalid': malformed input (cheat/desync), no player line
  ctx.onInventoryChangedForQuests(meta);
}

/** Buy the next 6-slot bank expansion for exact copper, non-refundable. Blocked at
 *  the purchase cap (BANK_EXPANSION_PRICES.length) and when the player cannot
 *  afford the table price; neither refusal mutates anything. */
export function bankBuySlots(ctx: SimContext, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (!nearBanker(ctx, p)) {
    ctx.error(meta.entityId, 'You are too far from the banker.');
    return;
  }
  // purchasedSlots is kept on the 6-slot grid (init 0, load floors, +6 here), so this
  // divides evenly; the floor guards a future writer from a fractional price index.
  const purchases = Math.floor(meta.bank.purchasedSlots / BANK_EXPANSION_SLOTS);
  if (purchases >= BANK_EXPANSION_PRICES.length) {
    ctx.error(meta.entityId, 'Your bank cannot be expanded further.');
    return;
  }
  const price = BANK_EXPANSION_PRICES[purchases];
  if (meta.copper < price) {
    ctx.error(meta.entityId, 'You cannot afford that bank expansion.');
    return;
  }
  meta.copper -= price;
  meta.bank.purchasedSlots += BANK_EXPANSION_SLOTS;
  ctx.notice(meta.entityId, 'You purchase additional bank slots.');
}

/** The proximity-gated bank snapshot: null unless the player stands within reach
 *  of a banker NPC, else a boundary-cloned view of PlayerMeta.bank. A pure read:
 *  it draws NO rng and never hands out live sim slot references. */
export function bankInfoFor(ctx: SimContext, pid: number): BankInfo | null {
  const r = ctx.resolve(pid);
  if (!r) return null;
  const { meta, e: p } = r;
  if (!nearBanker(ctx, p)) return null;
  const bank = meta.bank;
  const purchases = Math.floor(bank.purchasedSlots / BANK_EXPANSION_SLOTS);
  const nextExpansionCost =
    purchases < BANK_EXPANSION_PRICES.length ? BANK_EXPANSION_PRICES[purchases] : null;
  return {
    slots: bank.inventory.map((s) => ({ ...s })),
    capacity: bankCapacity(bank),
    purchasedSlots: bank.purchasedSlots,
    bonusSlots: bank.bonusSlots,
    nextExpansionCost,
    bonusSources: meta.bankBonusSources.map((s) => ({ ...s })),
  };
}

/** The ONE load path for persisted bank state. Tampered/legacy saves sanitize;
 *  items are NEVER destroyed. Over-capacity inventories are tolerated (never
 *  truncated). purchasedSlots is clamped into range and floored to a whole
 *  expansion so the price indexing stays coherent. */
export function sanitizeBankState(raw: unknown): BankState {
  if (!raw || typeof raw !== 'object') {
    return { inventory: [], purchasedSlots: 0, bonusSlots: 0 };
  }
  const r = raw as { inventory?: unknown; purchasedSlots?: unknown; bonusSlots?: unknown };
  const inventory: InvSlot[] = [];
  if (Array.isArray(r.inventory)) {
    for (const entry of r.inventory) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as { itemId?: unknown; count?: unknown };
      if (typeof e.itemId !== 'string' || e.itemId === '') continue;
      const count = Math.max(1, Math.floor(Number(e.count)) || 1);
      inventory.push({ itemId: e.itemId, count });
    }
  }
  const maxPurchased = BANK_EXPANSION_PRICES.length * BANK_EXPANSION_SLOTS;
  let purchasedSlots = Math.max(
    0,
    Math.min(maxPurchased, Math.floor(Number(r.purchasedSlots)) || 0),
  );
  purchasedSlots -= purchasedSlots % BANK_EXPANSION_SLOTS;
  // Clamped to the entitlement-registry ceiling: a tampered save must not mint more
  // capacity than the server can grant. Online joins re-stamp the real value anyway.
  const bonusSlots = clampBonusSlots(r.bonusSlots);
  return { inventory, purchasedSlots, bonusSlots };
}
