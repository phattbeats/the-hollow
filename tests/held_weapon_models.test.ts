import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  itemWeaponModelUrl,
  mechHeldWeaponOverride,
  VISUALS,
} from '../src/render/characters/manifest';
import { ITEM_WEAPON_VARIANTS } from '../src/ui/weapon_variants';

// The per-item held weapon models: each weapon item maps (via the shared
// ITEM_WEAPON_VARIANTS table) to a variant key that must have BOTH a 3D model GLB
// (held in-hand) and a 2D icon JPG (bag), so the held weapon always matches its
// inventory icon.
describe('held weapon models', () => {
  it('every weapon variant has a model GLB and an icon JPG on disk', () => {
    const keys = [...new Set(Object.values(ITEM_WEAPON_VARIANTS))];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(existsSync(`public/models/weapons/${key}.glb`), `${key}.glb missing`).toBe(true);
      expect(existsSync(`public/ui/weapons/${key}.jpg`), `${key}.jpg missing`).toBe(true);
    }
  });

  it('itemWeaponModelUrl resolves mapped items and ignores everything else', () => {
    expect(itemWeaponModelUrl('worn_sword')).toBe('models/weapons/sword_a.glb');
    expect(itemWeaponModelUrl('fen_reaver_glaive')).toBe('models/weapons/scythe.glb');
    expect(itemWeaponModelUrl('chest_armor_not_a_weapon')).toBeNull();
    expect(itemWeaponModelUrl(null)).toBeNull();
    expect(itemWeaponModelUrl(undefined)).toBeNull();
  });

  // Every weapon variant must belong to a family that has a hand-grip mapping in
  // src/render/characters/assets.ts (KAYKIT_WEAPON_ACCESSORY). Without one the
  // model would attach at the bone origin untransformed. This list MUST stay in
  // sync with the variant families gripped there; a new family (e.g. a spear) needs
  // both a grip entry and an addition here, or this fails loudly.
  it('every weapon variant belongs to a grip-mapped family', () => {
    // Each variant key must contain a known weapon-type token so it maps to a grip
    // family in KAYKIT_WEAPON_ACCESSORY (assets.ts). Covers both the bare variant
    // keys (sword_a) and the prefixed/extra models (adv_sword_1handed, spear_a).
    const TYPES = [
      'sword',
      'dagger',
      'staff',
      'hammer',
      'axe',
      'halberd',
      'spear',
      'scythe',
      'wand',
    ];
    for (const key of new Set(Object.values(ITEM_WEAPON_VARIANTS))) {
      const ok = TYPES.some((t) => key.includes(t));
      expect(ok, `${key} has no recognized weapon type (needs a grip mapping)`).toBe(true);
    }
  });

  // Every player class swaps its held mainhand to the equipped weapon, EXCEPT the
  // hunters (player_hunter and its chibi player_hunter_f), which keep the crossbow
  // regardless of the melee weapon equipped. The cosmetic Combat Mech (player_mech)
  // is class-agnostic but is included: it still shows the wearer's equipped
  // mainhand, like every other body. Both the KayKit male bodies and the chibi
  // female (_f) bodies are covered (PHAA-697).
  it('all player classes swap the mainhand except the hunters', () => {
    const players = Object.keys(VISUALS).filter((k) => k.startsWith('player_'));
    expect(players).toContain('player_hunter');
    expect(players).toContain('player_hunter_f');
    expect(players).toContain('player_mech');
    for (const key of players) {
      const def = VISUALS[key];
      if (key === 'player_hunter' || key === 'player_hunter_f') {
        expect(def.weaponSlots, `${key} must keep its crossbow`).toBeUndefined();
        expect(def.attach?.length, `${key} still holds a fixed crossbow`).toBe(1);
      } else {
        expect(def.weaponSlots?.includes(0), `${key} should swap its mainhand`).toBe(true);
      }
    }
    // both rogues dual-wield: both hand slots swap so a dagger shows in BOTH hands
    expect(VISUALS.player_rogue.weaponSlots).toEqual([0, 1]);
    expect(VISUALS.player_rogue_f.weaponSlots).toEqual([0, 1]);
  });

  // PHAA-697: every female (chibi-rig) body holds its class weapon, mounted on the
  // chibi DEF-hand bones, mirroring its KayKit male sibling's layout. Before this
  // fix the nine player_<cls>_f defs shipped no attach/weaponSlots and rendered an
  // empty hand for every female character (a female warrior swung an invisible
  // sword). This was the it.todo placeholder tracked on PHAA-697; it is now a real
  // assertion over the _f family.
  const MALE_SIBLING: Record<string, string> = {
    player_warrior_f: 'player_warrior',
    player_paladin_f: 'player_paladin',
    player_hunter_f: 'player_hunter',
    player_rogue_f: 'player_rogue',
    player_druid_f: 'player_druid',
    player_mage_f: 'player_mage',
    player_priest_f: 'player_priest',
    player_warlock_f: 'player_warlock',
    player_shaman_f: 'player_shaman',
  };
  it('every female _f body holds its class weapon on a chibi DEF-hand bone', () => {
    const females = Object.keys(VISUALS).filter((k) => k.startsWith('player_') && k.endsWith('_f'));
    expect(females.length).toBe(9);
    for (const key of females) {
      const def = VISUALS[key];
      expect(def.attach?.length, `${key} must attach at least one weapon`).toBeGreaterThan(0);
      // the chibi rig grips on DEF-hand.R / DEF-hand.L, never the KayKit handslot bones
      for (const a of def.attach ?? []) {
        expect(
          /^DEF-hand\.[RL]$/.test(a.bone),
          `${key} attach bone ${a.bone} must be a chibi hand bone`,
        ).toBe(true);
      }
    }
    // layout mirrors the male sibling exactly: same swap slots, same mainhand model
    for (const [f, m] of Object.entries(MALE_SIBLING)) {
      expect(VISUALS[f].weaponSlots, `${f} weaponSlots must mirror ${m}`).toEqual(
        VISUALS[m].weaponSlots,
      );
      expect(VISUALS[f].attach?.[0].url, `${f} mainhand model must match ${m}`).toBe(
        VISUALS[m].attach?.[0].url,
      );
    }
  });

  // The class-agnostic Combat Mech adopts the WEARER class's hand layout, so a
  // rogue wearing the mech still dual-wields (weapon in both hands), while every
  // single-wield class keeps the mech's own one-hand default (no override).
  it('the Combat Mech mirrors a dual-wield class so a rogue mech holds both hands', () => {
    const rogue = mechHeldWeaponOverride('rogue');
    expect(rogue?.weaponSlots).toEqual([0, 1]);
    expect(rogue?.attach?.length).toBe(2);
    for (const cls of [
      'warrior',
      'paladin',
      'hunter',
      'priest',
      'mage',
      'warlock',
      'shaman',
      'druid',
    ] as const) {
      expect(mechHeldWeaponOverride(cls), `${cls} should not dual-wield on the mech`).toBeNull();
    }
  });
});
