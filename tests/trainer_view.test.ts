// Unit test for the trainer view (PHAA-465: Multiclass D, the trainer half of
// the HUD surface). The pure-core half of the pure-core + thin-painter split:
// driven directly with raw inputs, no DOM, no IWorld, no i18n. The sim is the
// source of truth for the cost schedule + level gate, and the view mirrors
// `secondaryClassCostFor` byte-for-byte, so the only thing under test is the
// VIEW LAYER (filtering, picking, confirm stage, affordability, secondary cap).

import { describe, expect, it } from 'vitest';
import type { PlayerClass } from '../src/sim/types';
import {
  SECONDARY_CLASS_CHANGE_COST,
  SECONDARY_CLASS_MIN_LEVEL,
} from '../src/sim/progression/trainer';
import {
  buildTrainerView,
  TRAINER_CHANGE_COST_TIERS,
  TRAINER_MIN_LEVEL,
} from '../src/ui/trainer_view';

// A minimal NPC content table that mirrors the shape trainer_view reads. The
// real NPCS table is a Record<string, NpcDef> keyed by string id (e.g.
// 'elder_yarrow'); we use a small in-test Record instead of importing the
// production table so the test stays scoped to the view layer and cannot
// regress because of unrelated content edits.
function npcs(): Record<string, { trainer?: { professions: readonly PlayerClass[] } }> {
  return {
    // Elder Yarrow, the hub trainer. Teaches every profession as a secondary.
    elder_yarrow: { trainer: { professions: ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid'] } },
    // A trainer who only teaches a small subset (a hypothetical off-hub trainer).
    ranger_only: { trainer: { professions: ['hunter'] } },
    // A non-trainer NPC: never returned by the trainer panel in the first place,
    // but a defensive empty-state is part of the view's contract.
    merchant: { vendorItems: ['water'] },
  };
}

describe('trainer_view (PHAA-465)', () => {
  it('TRAINER_MIN_LEVEL mirrors the sim gate so the painter never drifts', () => {
    expect(TRAINER_MIN_LEVEL).toBe(SECONDARY_CLASS_MIN_LEVEL);
  });

  it('TRAINER_CHANGE_COST_TIERS mirrors the sim cost schedule', () => {
    expect(TRAINER_CHANGE_COST_TIERS).toEqual(SECONDARY_CLASS_CHANGE_COST);
  });

  describe('level gate', () => {
    it('locks every pick when the player is below SECONDARY_CLASS_MIN_LEVEL', () => {
      const v = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: null,
        secondaryChanges: 0,
        playerLevel: SECONDARY_CLASS_MIN_LEVEL - 1,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 1_000_000,
      });
      expect(v.levelLocked).toBe(true);
      expect(v.minLevel).toBe(SECONDARY_CLASS_MIN_LEVEL);
      expect(v.picks).toEqual([]);
      expect(v.confirm).toBeNull();
    });

    it('unlocks picks at or above the min level (boundary inclusive)', () => {
      const v = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: null,
        secondaryChanges: 0,
        playerLevel: SECONDARY_CLASS_MIN_LEVEL,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 0,
      });
      expect(v.levelLocked).toBe(false);
      // Elder Yarrow teaches every class; warrior is the primary and filtered out.
      expect(v.picks.length).toBe(8);
    });
  });

  describe('pick list', () => {
    it('filters out the primary class so the painter never offers the same profession twice', () => {
      const v = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'rogue',
        currentSecondary: null,
        secondaryChanges: 0,
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 0,
      });
      expect(v.picks.find((p) => p.cls === 'rogue')).toBeUndefined();
      expect(v.picks.length).toBe(8);
    });

    it('first-ever pick is free (costCopper 0, affordable) regardless of secondaryChanges', () => {
      const v = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: null,
        secondaryChanges: 0,
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 0, // even with zero copper, the first pick is free
      });
      for (const p of v.picks) {
        expect(p.costCopper).toBe(0);
        expect(p.affordable).toBe(true);
      }
    });

    it('picked class is reported as picked + cost 0 (Current badge), and is not affordable-by-spend', () => {
      const v = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: 'priest',
        secondaryChanges: 1,
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 0,
      });
      const picked = v.picks.find((p) => p.cls === 'priest')!;
      expect(picked.picked).toBe(true);
      expect(picked.costCopper).toBe(0);
      expect(picked.affordable).toBe(true); // cost 0 is always affordable
    });

    it('a switch costs the tier at index secondaryChanges (capped at the last tier)', () => {
      // Second PAID change (the first was when the player picked priest at 0
      // changes ago); index 0 -> 10000 copper.
      const v0 = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: 'priest',
        secondaryChanges: 1,
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 0,
      });
      const nonCurrent = v0.picks.find((p) => p.cls === 'mage')!;
      expect(nonCurrent.costCopper).toBe(SECONDARY_CLASS_CHANGE_COST[1]);

      // A change beyond the schedule caps at the last tier.
      const vMax = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: 'priest',
        secondaryChanges: 99,
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 0,
      });
      const capped = vMax.picks.find((p) => p.cls === 'mage')!;
      expect(capped.costCopper).toBe(SECONDARY_CLASS_CHANGE_COST[SECONDARY_CLASS_CHANGE_COST.length - 1]);
    });

    it('affordable tracks copper >= costCopper for every row', () => {
      const v = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: 'priest',
        secondaryChanges: 1, // every non-picked, non-primary row costs 50000 copper
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 40_000, // below the next-tier cost
      });
      for (const p of v.picks) {
        if (p.costCopper === null) {
          expect(p.affordable).toBe(false);
        } else {
          expect(p.affordable).toBe(p.costCopper <= 40_000);
        }
      }
    });

    it('an NPC with no teachable professions yields an empty pick list (defensive empty-state)', () => {
      const v = buildTrainerView({
        npcTemplateId: 'merchant',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: null,
        secondaryChanges: 0,
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 0,
      });
      expect(v.picks).toEqual([]);
      expect(v.confirm).toBeNull();
    });
  });

  describe('confirm stage', () => {
    it('no confirm when nothing is pending', () => {
      const v = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: null,
        secondaryChanges: 0,
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 1_000_000,
      });
      expect(v.confirm).toBeNull();
    });

    it('confirm surfaces the pending class + cost + affordability', () => {
      const v = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: 'priest',
        secondaryChanges: 1,
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 100_000,
        pendingCls: 'mage',
        pendingCostCopper: 50_000, // SECONDARY_CLASS_CHANGE_COST[1]
      });
      expect(v.confirm).toEqual({
        cls: 'mage',
        costCopper: 50_000,
        affordable: true,
      });
    });

    it('confirm reports affordable=false when the player cannot cover the cost', () => {
      const v = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: 'priest',
        secondaryChanges: 1,
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 10_000,
        pendingCls: 'mage',
        pendingCostCopper: 50_000,
      });
      expect(v.confirm?.affordable).toBe(false);
    });

    it('confirm is suppressed when pending matches the player primary (defensive no-op)', () => {
      const v = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: null,
        secondaryChanges: 0,
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 0,
        pendingCls: 'warrior',
        pendingCostCopper: 0,
      });
      expect(v.confirm).toBeNull();
    });

    it('confirm is suppressed when pending matches the current secondary (defensive no-op)', () => {
      const v = buildTrainerView({
        npcTemplateId: 'elder_yarrow',
        npcs: npcs(),
        primaryCls: 'warrior',
        currentSecondary: 'priest',
        secondaryChanges: 1,
        playerLevel: 60,
        minLevel: SECONDARY_CLASS_MIN_LEVEL,
        copper: 0,
        pendingCls: 'priest',
        pendingCostCopper: 0,
      });
      expect(v.confirm).toBeNull();
    });
  });

  it('is deterministic: same inputs -> same output (no RNG, no clock)', () => {
    const args = {
      npcTemplateId: 'elder_yarrow',
      npcs: npcs(),
      primaryCls: 'warrior' as PlayerClass,
      currentSecondary: 'priest' as PlayerClass | null,
      secondaryChanges: 1,
      playerLevel: 60,
      minLevel: SECONDARY_CLASS_MIN_LEVEL,
      copper: 100_000,
    };
    expect(buildTrainerView(args)).toEqual(buildTrainerView(args));
  });
});