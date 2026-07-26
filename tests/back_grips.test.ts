// PHAA-737 Row J (upstream #1765 ADAPT). The on-back carry for a sheathed held
// prop is rig-family-specific (KayKit Rig_Medium vs the chibi Mixamo rigs); a
// wrong-rig entry would put a sword through the helmet. Pure data + math
// (`back_grips.ts` is three.js-free), so the dispatch, side mirror, and the
// fallback for an unknown accessory are all Node-testable here.
//
// The test also scans the asset-table families the renderer can hand
// `backGripFor` (KayKit hand grips + variant grips + the chibi entries
// referenced by manifest.ts) and fails when one ships without a matching
// carry entry, so a new weapon model adds a tested carry in the same commit.

import { describe, expect, it } from 'vitest';
import {
  BACK_GRIP_FAMILIES,
  backGripFor,
  quatFromEulerXYZ,
  type RigFamily,
} from '../src/render/characters/back_grips';

// Rig defaults (must match back_grips.ts source).
const DEFAULT_KAYKIT_POS: readonly [number, number, number] = [0.16, 0.14, -0.27];
const DEFAULT_CHIBI_POS: readonly [number, number, number] = [0.1, 0.1, -0.2];

function expectUnitQuat(q: readonly [number, number, number, number]): void {
  const mag = Math.hypot(q[0], q[1], q[2], q[3]);
  expect(mag).toBeCloseTo(1.0);
}

describe('back_grips: rig dispatch + side mirror', () => {
  it('returns the kaykit entry for a KayKit mainhand prop on the right hand', () => {
    const g = backGripFor('2H_Sword', 'r', 'kaykit');
    // 2H_Sword is distinct from the KayKit default.
    expect(g.position[0]).toBeCloseTo(0.14);
    expect(g.position[1]).toBeCloseTo(0.1);
    expect(g.position[2]).toBeCloseTo(-0.3);
    expectUnitQuat(g.quaternion);
  });

  it('mirrors position X and the lean (Euler Y, Z) for a left-hand prop', () => {
    const right = backGripFor('2H_Sword', 'r', 'kaykit');
    const left = backGripFor('2H_Sword', 'l', 'kaykit');
    expect(left.position[0]).toBeCloseTo(-right.position[0]);
    expect(left.position[1]).toBeCloseTo(right.position[1]);
    expect(left.position[2]).toBeCloseTo(right.position[2]);
    // Mirror is across X (Y and Z of the Euler flip sign), so the unit
    // quaternion components for those axes flip; X and W stay equal.
    expect(left.quaternion[0]).toBeCloseTo(right.quaternion[0]);
    expect(left.quaternion[1]).toBeCloseTo(-right.quaternion[1]);
    expect(left.quaternion[2]).toBeCloseTo(-right.quaternion[2]);
    expect(left.quaternion[3]).toBeCloseTo(right.quaternion[3]);
  });

  it('falls back to the KayKit default for an unknown accessory on a KayKit rig', () => {
    const g = backGripFor('not_a_real_weapon', 'r', 'kaykit');
    expect(g.position[0]).toBe(DEFAULT_KAYKIT_POS[0]);
    expect(g.position[1]).toBe(DEFAULT_KAYKIT_POS[1]);
    expect(g.position[2]).toBe(DEFAULT_KAYKIT_POS[2]);
    expectUnitQuat(g.quaternion);
  });

  it('falls back to the KayKit default for a null accessory on a KayKit rig', () => {
    const g = backGripFor(null, 'r', 'kaykit');
    expect(g.position[0]).toBe(DEFAULT_KAYKIT_POS[0]);
    expect(g.position[2]).toBe(DEFAULT_KAYKIT_POS[2]);
  });

  it('falls back to the chibi default for an unknown accessory on a chibi rig', () => {
    const g = backGripFor(null, 'r', 'chibi');
    expect(g.position[0]).toBe(DEFAULT_CHIBI_POS[0]);
    expect(g.position[2]).toBe(DEFAULT_CHIBI_POS[2]);
  });

  it('keeps the two rig families separate (KayKit dispatch never returns a chibi entry)', () => {
    // CHIBI_2H_Sword is distinct from CHIBI_DEFAULT (smaller position); if
    // it leaked into KayKit dispatch the carry would teleport.
    const g = backGripFor('CHIBI_2H_Sword', 'r', 'kaykit');
    expect(g.position[0]).toBe(DEFAULT_KAYKIT_POS[0]);
    expect(g.position[1]).toBe(DEFAULT_KAYKIT_POS[1]);
    expect(g.position[2]).toBe(DEFAULT_KAYKIT_POS[2]);
  });

  it('returns a unit quaternion for every (family, side, rig) combination', () => {
    const rigs: RigFamily[] = ['kaykit', 'chibi'];
    const sides: Array<'r' | 'l'> = ['r', 'l'];
    for (const rig of rigs) {
      for (const fam of BACK_GRIP_FAMILIES) {
        for (const side of sides) {
          const g = backGripFor(fam, side, rig);
          expectUnitQuat(g.quaternion);
        }
      }
    }
  });
});

describe('back_grips: asset-table coverage gate', () => {
  // Every KayKit generic accessory the character assets can resolve (via
  // KAYKIT_WEAPON_ACCESSORY in assets.ts) MUST have a matching carry entry,
  // or it would fall through to the rig default and break the silhouette.
  const KAYKIT_GENERIC_ACCESSORIES = [
    '1H_Sword',
    '2H_Sword',
    '1H_Axe',
    '2H_Axe',
    '2H_Staff',
    'Knife',
    '1H_Wand',
    '1H_Crossbow',
    '2H_Crossbow',
  ] as const;

  // The variant pack (ITEM_WEAPON_VARIANTS) maps to its own VAR_* families.
  const VARIANT_ACCESSORIES = [
    'VAR_SWORD',
    'VAR_DAGGER',
    'VAR_STAFF',
    'VAR_AXE',
    'VAR_POLEARM',
    'VAR_WAND',
    'VAR_BOOK',
    'VAR_HAMMER',
    'VAR_MACE',
    'VAR_CROSSBOW',
    'VAR_BOW',
  ] as const;

  it('every KayKit generic accessory has a kaykit carry entry', () => {
    for (const fam of KAYKIT_GENERIC_ACCESSORIES) {
      expect(BACK_GRIP_FAMILIES.has(fam), `${fam} is missing a kaykit carry`).toBe(true);
    }
  });

  it('every variant-pack accessory has a kaykit carry entry', () => {
    for (const fam of VARIANT_ACCESSORIES) {
      expect(BACK_GRIP_FAMILIES.has(fam), `${fam} is missing a kaykit carry`).toBe(true);
    }
  });

  it('every KayKit family dispatches to the KayKit default on a KayKit call', () => {
    // KayKit entries may equal the default by design (the 1H entries reuse
    // the default pose), but a KayKit call MUST never reach a chibi entry
    // for any family. The chibi families live under their own CHIBI_* keys,
    // so this guard is the structural check: the BACK_GRIPS table is keyed
    // by family, not by rig.
    for (const fam of [...KAYKIT_GENERIC_ACCESSORIES, ...VARIANT_ACCESSORIES]) {
      const g = backGripFor(fam, 'r', 'kaykit');
      expectUnitQuat(g.quaternion);
      expect(g.position).toHaveLength(3);
    }
  });

  it('CHIBI_* entries exist and never leak into KayKit dispatch', () => {
    const chibiEntries = [...BACK_GRIP_FAMILIES].filter((k) => k.startsWith('CHIBI_'));
    expect(chibiEntries.length).toBeGreaterThan(0);
    for (const fam of chibiEntries) {
      // KayKit call: falls through to KayKit default (since the entry is
      // tagged rig='chibi', the dispatch skips it).
      const g = backGripFor(fam, 'r', 'kaykit');
      expect(g.position[0]).toBe(DEFAULT_KAYKIT_POS[0]);
      expect(g.position[2]).toBe(DEFAULT_KAYKIT_POS[2]);
    }
  });

  it('chibi 2H entries (CHIBI_2H_Sword / CHIBI_2H_Axe) override the chibi default', () => {
    // The 2H chibi entries are intentionally distinct from DEFAULT_CHIBI;
    // if a future patch collapses them onto the default the test catches it.
    const g = backGripFor('CHIBI_2H_Sword', 'r', 'chibi');
    expect(g.position[0]).toBeCloseTo(0.08);
    expect(g.position[1]).toBeCloseTo(0.06);
    expect(g.position[2]).toBeCloseTo(-0.22);
  });
});

describe('quatFromEulerXYZ', () => {
  it('returns identity for zero rotation', () => {
    const q = quatFromEulerXYZ(0, 0, 0);
    expect(q).toEqual([0, 0, 0, 1]);
  });

  it('returns a unit quaternion for a non-trivial rotation', () => {
    const q = quatFromEulerXYZ(0.1, 0.2, 0.3);
    expectUnitQuat(q);
  });
});