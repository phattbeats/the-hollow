// Pure, host-agnostic view model for the homestead placement window (housing
// v0 interact flow, PHAA-405). Named to avoid colliding with the unrelated
// render/housing.ts `HousingView` (the Three.js scene view of the same plots).
//
// This is the pure-core half of the pure-core + thin-consumer split (root
// CLAUDE.md Conventions; reference vendor_view.ts / unit_portrait.ts): which
// slots are occupied, by what, and which decor kinds can be placed. The
// DOM/i18n side lives in housing_window.ts. DOM-free so
// tests/housing_view.test.ts can drive it directly.

import { HOLLOW_HOUSE_OBJECT_KINDS, type HouseObjectKind } from '../sim/content/hollow';
import type { HouseObjectView } from '../world_api/housing';

export interface HousingSlotRow {
  slot: number; // 0-based
  kind: HouseObjectKind | null; // null = empty
}

export interface HousingWindowView {
  slots: HousingSlotRow[];
  kinds: readonly HouseObjectKind[];
}

/** Build the structured placement view from the plot's raw decor objects. */
export function buildHousingWindowView(
  slotCount: number,
  objects: readonly HouseObjectView[],
): HousingWindowView {
  const bySlot = new Map<number, HouseObjectKind>();
  for (const o of objects) {
    if ((HOLLOW_HOUSE_OBJECT_KINDS as readonly string[]).includes(o.kind)) {
      bySlot.set(o.slot, o.kind as HouseObjectKind);
    }
  }
  const slots: HousingSlotRow[] = [];
  for (let slot = 0; slot < slotCount; slot++) {
    slots.push({ slot, kind: bySlot.get(slot) ?? null });
  }
  return { slots, kinds: HOLLOW_HOUSE_OBJECT_KINDS };
}
