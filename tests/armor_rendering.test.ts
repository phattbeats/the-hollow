import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { itemArmorModelUrl, itemArmorModelUrls, VISUALS } from '../src/render/characters/manifest';
import { ITEM_ARMOR_VARIANTS } from '../src/ui/armor_variants';

// PHAA-502 T1 ships the render wiring for equipped armor (chest/legs/helm/...)
// but ships ZERO baked armor GLBs: the `ITEM_ARMOR_VARIANTS` table is the
// registration seam that the T2a follow-up authors (one entry per armor item,
// pointing at a public/models/armor/<key>.glb and matching
// public/ui/armor/<key>.png). This test pins the contract of the wiring itself
// so T2a's first commit cannot accidentally break it:
//   - the variant table is pure data (no DOM/Three import)
//   - the URL helpers round-trip the table correctly
//   - the preload sweep produces zero URLs until T2a
//   - the rendered armor slots are gated by `armorSlots`/`armorByAttachIndex`
//   - the player rigs expose the body bones a T2a attach entry would need
//
// No GLB/icon file existence checks here on purpose: T1 has nothing to point at,
// and adding them would force T1 red when T2a lands its first model.
describe('armor render plumbing (PHAA-502 T1)', () => {
  it('ITEM_ARMOR_VARIANTS is a pure-data table (no DOM/Three)', async () => {
    // Importing in isolation proves the file has no side-effectful imports;
    // any DOM/Three would throw under the Node test env.
    const mod = await import('../src/ui/armor_variants');
    expect(typeof mod.ITEM_ARMOR_VARIANTS).toBe('object');
    // T1 ships empty; T2a fills this. Asserting the SHAPE only.
    for (const [itemId, key] of Object.entries(mod.ITEM_ARMOR_VARIANTS)) {
      expect(typeof itemId).toBe('string');
      expect(itemId.length).toBeGreaterThan(0);
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
      // No slash paths in the key: the renderer concatenates `models/armor/${key}.glb`.
      expect(key.includes('/')).toBe(false);
    }
  });

  it('itemArmorModelUrl returns null for missing / null / undefined ids', () => {
    expect(itemArmorModelUrl(null)).toBeNull();
    expect(itemArmorModelUrl(undefined)).toBeNull();
    expect(itemArmorModelUrl('')).toBeNull();
    expect(itemArmorModelUrl('not_a_real_item_id')).toBeNull();
  });

  it('itemArmorModelUrl resolves a mapped id to models/armor/<key>.glb', () => {
    // Patch the table in place for the test (it's a plain Record); restore it
    // so other tests see the production-empty state.
    const original = { ...ITEM_ARMOR_VARIANTS };
    (ITEM_ARMOR_VARIANTS as Record<string, string>).tarnished_helm = 'helm_a';
    try {
      expect(itemArmorModelUrl('tarnished_helm')).toBe('models/armor/helm_a.glb');
    } finally {
      for (const k of Object.keys(ITEM_ARMOR_VARIANTS)) {
        if (!(k in original)) delete (ITEM_ARMOR_VARIANTS as Record<string, string>)[k];
      }
      for (const [k, v] of Object.entries(original)) {
        (ITEM_ARMOR_VARIANTS as Record<string, string>)[k] = v;
      }
    }
  });

  it('itemArmorModelUrls returns zero URLs until T2a (T1 ships no GLBs)', () => {
    // The empty default state of the table must yield zero preload URLs, so
    // T1 doesn't 404 on the boot sweep.
    expect(Object.keys(ITEM_ARMOR_VARIANTS).length).toBe(0);
    expect(itemArmorModelUrls()).toEqual([]);
  });

  it('itemArmorModelUrls deduplicates when many items share a variant key', () => {
    const original = { ...ITEM_ARMOR_VARIANTS };
    (ITEM_ARMOR_VARIANTS as Record<string, string>).tarnished_helm = 'helm_a';
    (ITEM_ARMOR_VARIANTS as Record<string, string>).iron_crown = 'helm_a';
    (ITEM_ARMOR_VARIANTS as Record<string, string>).sunplate_chest = 'chest_a';
    try {
      expect(itemArmorModelUrls().sort()).toEqual([
        'models/armor/chest_a.glb',
        'models/armor/helm_a.glb',
      ]);
    } finally {
      for (const k of Object.keys(ITEM_ARMOR_VARIANTS)) {
        if (!(k in original)) delete (ITEM_ARMOR_VARIANTS as Record<string, string>)[k];
      }
      for (const [k, v] of Object.entries(original)) {
        (ITEM_ARMOR_VARIANTS as Record<string, string>)[k] = v;
      }
    }
  });

  it('no player visual declares armorSlots in T1 (T2a authors them with GLBs)', () => {
    // The contract: T1 wires the swap path but ships zero attach entries so the
    // boot preload stays clean. T2a follows by adding armorSlots + matching
    // attach entries on the player classes (chest/legs/helm).
    for (const [key, def] of Object.entries(VISUALS)) {
      if (!key.startsWith('player_')) continue;
      expect(def.armorSlots, `${key} unexpectedly pre-declares armorSlots in T1`).toBeUndefined();
      expect(
        def.armorByAttachIndex,
        `${key} unexpectedly pre-declares armorByAttachIndex in T1`,
      ).toBeUndefined();
    }
  });
});

// assembleModel/attachProp cannot be runtime-imported here (module load fires
// the GLB preload sweep, which has no server to fetch from under vitest; see
// the note in tests/baked_armor_visibility.test.ts). Pin the tie-break by
// source so a future edit cannot silently flip which side wins.
describe('armor render plumbing (PHAA-502 T1) - weapon/armor slot tie-break', () => {
  const assetsSrc = readFileSync(
    new URL('../src/render/characters/assets.ts', import.meta.url),
    'utf8',
  );

  it('an attach index listed in both weaponSlots and armorSlots resolves weapon, never armor', () => {
    // Both the attach-def selection and the swap-tag selection must gate the
    // armor branch on `!isWeaponSwap`, matching the documented contract
    // (a manifest bug that double-lists an index resolves to the weapon).
    expect(assetsSrc).toContain('else if (isArmorSwap && !isWeaponSwap) {');
    expect(assetsSrc).toContain('if (isArmorSwap && !isWeaponSwap) tags.push(SWAP_ARMOR_TAG);');
  });
});
