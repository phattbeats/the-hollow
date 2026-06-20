# Unequip gear to an empty slot + skin-load hardening

Date: 2026-06-20
Branch base: `upstream/release/v0.11.0`

## Problem
1. **No way to unequip gear to an empty slot.** The only way to change equipped
   armor/weapons is to equip a *replacement* (`Sim.equipItem` swaps the old piece
   back to bags). A player cannot simply remove a piece and leave the slot empty.
2. **Skin-select can require a relog (hardening).** A reported "relog for
   unequipped/selected skin to appear". The mech-unequip data path resets correctly
   on `release/v0.11.0` (verified offline + online-client + item-return), but the
   renderer has a genuine latent race: `skinTexture(key, idx)` returns `null` when an
   alternate skin atlas exists but has not finished loading, so `setSkin` silently
   shows the embedded default until something else reloads the atlas.

## Out of scope
- "Dangling equipment reference on sell/discard": not a real bug — equipment stores an
  `itemId` (always resolves via `ITEMS[]`), and equipped items are not in the bag list,
  so they cannot be sold/discarded into a dangling state.

## Design

### A. Unequip gear (new networked action, follows the IWorld recipe)
- **Sim** (`src/sim/sim.ts`): `unequipItem(slot: EquipSlot, pid?): boolean`
  - resolve player; `itemId = meta.equipment[slot]`; if absent → return `false`.
  - `delete meta.equipment[slot]`; `addItemSilent(itemId, 1, meta)`;
    `recalcPlayerStats(...)`; emit English log `Unequipped {name}.`; return `true`.
  - Inventory is uncapped (`addItemSilent` just appends) so this never fails on space.
- **IWorld** (`src/world_api.ts`): add `unequipItem(slot: EquipSlot): void`.
- **ClientWorld** (`src/net/online.ts`): `unequipItem(slot) { this.cmd({ cmd: 'unequip_item', slot }); }`
  (non-optimistic, exactly like `equipItem`; equipment + inventory return via the
  existing `maybe('equip')`/`maybe('inv')` snapshot deltas).
- **Server** (`server/game.ts`): `case 'unequip_item'` — validate `slot` is a known
  `EquipSlot` string, then `sim.unequipItem(slot, pid)`.
- **HUD** (`src/ui/hud.ts`): in the character-window slot rows, add an "Unequip"
  affordance on *filled* slots (button + context action) → `this.sim.unequipItem(slot)`
  then re-render bags + char window. New English-only i18n key under the
  `hudChrome.*` domain (the only English-only catalog domain).
- **sim_i18n** (`src/ui/sim_i18n.ts`): register the `Unequipped {name}.` emit
  (EXACT/RULE) so the S3 drift guard passes.

### B. Skin-load hardening (renderer only, presentation)
- `src/render/characters/assets.ts`: `ensureSkinTexture(key, skinIndex): Promise<void> | null`
  — if the atlas URL exists and is not yet cached, load it and return the promise;
  otherwise return `null`.
- `src/render/characters/visual.ts`: in `setSkin`, after applying materials, if the
  requested skin had a URL but no cached texture, `ensureSkinTexture(...)` and on
  resolve re-apply materials **iff `this.skinIndex` is still the requested index**
  (guard against a newer skin change superseding it).

## Testing
- Vitest `tests/`: `unequipItem` moves item to bags, clears slot, recalcs stats;
  unequip of an empty slot is a no-op (`false`); offline `Sim` and online `ClientWorld`
  both satisfy the new `IWorld.unequipItem` (command shape asserted, mirroring the
  existing appearance-skin online test style).
- `npm run build` + targeted i18n regen/guard (`tests/localization_fixes.test.ts`).
- Manual: offline browser — equip a piece, Unequip it, confirm the slot empties, the
  item returns to bags, and stats drop, with no relog.
