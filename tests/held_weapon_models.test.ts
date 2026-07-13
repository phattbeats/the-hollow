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

  // Every KayKit-rigged player body swaps its held mainhand to the equipped weapon,
  // EXCEPT the hunter, which keeps its crossbow regardless of the melee weapon
  // equipped. The cosmetic Combat Mech (player_mech) is class-agnostic but is
  // included: it adopts the KayKit handslot.r/.l bones and shows the wearer's
  // equipped mainhand like every other KayKit body. The separately-rigged female
  // chibi bodies (player_<cls>_f) are covered by the KNOWN GAP below, not here:
  // they ride a different rig with no handslot bones and no weapon attach yet.
  it('every KayKit-rigged player body swaps the mainhand except the hunter', () => {
    const kaykit = Object.keys(VISUALS).filter((k) => k.startsWith('player_') && !k.endsWith('_f'));
    expect(kaykit).toContain('player_hunter');
    expect(kaykit).toContain('player_mech');
    for (const key of kaykit) {
      const def = VISUALS[key];
      if (key === 'player_hunter') {
        expect(def.weaponSlots, 'hunter must keep its crossbow').toBeUndefined();
      } else {
        expect(def.weaponSlots?.includes(0), `${key} should swap its mainhand`).toBe(true);
      }
    }
    // the rogue dual-wields: both hand slots swap so a dagger shows in BOTH hands
    expect(VISUALS.player_rogue.weaponSlots).toEqual([0, 1]);
  });

  // KNOWN GAP (PHAA-697): the female chibi bodies (player_<cls>_f, added by
  // PHAA-587) ride a different rig (chibi_*.glb, anim_* clips) with no KayKit
  // handslot bones, so they ship with no attach and no weaponSlots and render no
  // held weapon at all. Because visualKeyFor routes every female character to the
  // _f body, a female character currently shows an empty hand. This is a tracked
  // render defect, NOT desired behavior; the todo marks the missing coverage so it
  // becomes a real assertion (each _f body swaps its mainhand, mirroring its KayKit
  // sibling) the moment the female rig gains weapon grips. See PHAA-697.
  it.todo('female (_f) chibi player bodies should also swap the held mainhand (PHAA-697)');

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
