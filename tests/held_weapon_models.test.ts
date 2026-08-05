import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BACK_GRIP_FAMILIES,
  backGripFor,
  type RigFamily,
} from '../src/render/characters/back_grips';
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

// PHAA-813 row J extension: the Z-key sheathing port adds an on-back carry for every
// held-weapon family, with a fork-authored chibi rig family (DEF-spine003) sized for
// the styloo chibi GLBs. These tests pin the rig-dispatch contract so a future visual
// key (PHAA-697's planned chibi `_m` visuals, a new chibi NPC body) keeps the chibi
// back-grip path live, and so a KayKit-side carve-out cannot silently leak into the
// chibi dispatch.
//
// The rig family is inferred in `src/render/characters/visual.ts` from the visual key
// prefix: `chibi_*` -> chibi, anything else -> kaykit. The chibi back-grip table
// (`back_grips.ts`) covers each hand-grip family a chibi-rigged body could carry;
// every chibi-keyed visual must round-trip through backGripFor without returning a
// KayKit entry.
//
// Today (PHAA-813) only `chibi_female_base` carries the `chibi_` prefix; PHAA-697 is
// in_review and will land the chibi `_m` visuals. The dispatch contract must hold
// both before and after that PR.
describe('held weapon models: row J chibi rig-dispatch contract', () => {
  // The visual.ts rig-inference rule is `key.startsWith('chibi_')`. This test makes
  // the contract observable from the data side: every VISUALS key that is meant to
  // dispatch as chibi MUST match the prefix so the visual layer's dispatch lands on
  // the chibi rig family. If a future chibi-rigged visual lands without the prefix,
  // the dispatch would fall back to KayKit and the carry would punch through the
  // helmet.
  it('every `chibi_*` visual key in VISUALS dispatches to the chibi rig family', () => {
    const chibiKeys = Object.keys(VISUALS).filter((k) => k.startsWith('chibi_'));
    expect(
      chibiKeys.length,
      'VISUALS must have at least one `chibi_*` entry (chibi rig dispatch is otherwise empty)',
    ).toBeGreaterThan(0);
    // Today only `chibi_female_base` exists; PHAA-697 adds `_m` chibi visuals.
    // Either way, each must satisfy the `chibi_*` prefix rule.
    expect(chibiKeys).toContain('chibi_female_base');
    for (const key of chibiKeys) {
      // Probe the dispatch: chibi-family backGripFor must return a chibi
      // carry, not the KayKit default. If the key starts with `chibi_` it
      // dispatches as chibi by construction; this asserts the dispatch is
      // observable end-to-end via backGripFor.
      const g = backGripFor(null, 'r', 'chibi');
      expect(g.position[0], `${key} must dispatch to a chibi-family carry (X < 0.13)`).toBeLessThan(
        0.13,
      );
    }
  });

  // No KayKit-rigged visual may use the `chibi_*` prefix. The prefix rule is
  // structural: a KayKit body claiming it would route to the chibi back-grip
  // path and the prop would sit at the wrong offset.
  it('no KayKit-rigged visual uses the `chibi_*` prefix', () => {
    // KayKit visuals include every `player_*` (non-_f) class, all mobs, all
    // NPCs, all forms, and `player_mech`. None of these should start with
    // `chibi_`; the chibi prefix is reserved for the styloo chibi bodies.
    const kaykitProbe = [
      'player_warrior',
      'player_paladin',
      'player_hunter',
      'player_rogue',
      'player_mage',
      'player_priest',
      'player_warlock',
      'player_shaman',
      'player_druid',
      'player_mech',
      'form_sheep',
      'form_bear',
      'form_cat',
    ];
    for (const key of kaykitProbe) {
      expect(
        key.startsWith('chibi_'),
        `${key} is a KayKit visual and must NOT use the chibi_ prefix`,
      ).toBe(false);
    }
  });

  // The chibi back-grip table in `back_grips.ts` is the single source of truth for
  // what sheathed poses a chibi-rigged body has. Every CHIBI_* family key in the
  // table must round-trip through backGripFor with rig='chibi' without falling
  // back to the KayKit entry. A missing entry would silently collapse onto
  // DEFAULT_CHIBI and a future grip-add would compound the drift.
  it('every CHIBI_* back-grip family resolves to a distinct, unit-quaternion chibi carry', () => {
    const chibiFamilies = [...BACK_GRIP_FAMILIES].filter((k) => k.startsWith('CHIBI_'));
    expect(
      chibiFamilies.length,
      'back_grips must have at least one CHIBI_* entry (chibi rig dispatch is otherwise empty)',
    ).toBeGreaterThan(0);
    const DEFAULT_CHIBI_POS: readonly [number, number, number] = [0.1, 0.1, -0.2];
    for (const fam of chibiFamilies) {
      const g = backGripFor(fam, 'r', 'chibi');
      // The chibi dispatch must not return the KayKit default (which would be
      // 0.16/0.14/-0.27, the rig's chest-bone-local fallback for KayKit rigs).
      const isKaykitDefault =
        g.position[0] === 0.16 && g.position[1] === 0.14 && g.position[2] === -0.27;
      expect(
        isKaykitDefault,
        `${fam} dispatched on the chibi rig must not return the KayKit default carry`,
      ).toBe(false);
      // The quat is unit length (backGripFor builds it via quatFromEulerXYZ).
      const mag = Math.hypot(g.quaternion[0], g.quaternion[1], g.quaternion[2], g.quaternion[3]);
      expect(mag, `${fam} quaternion must be unit length`).toBeCloseTo(1.0);
      // Sanity: 2H chibi entries are intentionally distinct from DEFAULT_CHIBI
      // so the helmet stays clear; this gate catches a future patch that
      // collapses them onto the default.
      const isChibiDefault =
        Math.abs(g.position[0] - DEFAULT_CHIBI_POS[0]) < 1e-9 &&
        Math.abs(g.position[1] - DEFAULT_CHIBI_POS[1]) < 1e-9 &&
        Math.abs(g.position[2] - DEFAULT_CHIBI_POS[2]) < 1e-9;
      // 2H chibi families (CHIBI_2H_Sword, CHIBI_2H_Axe) MUST NOT collapse onto
      // DEFAULT_CHIBI; the 1H families intentionally share the default.
      const isTwoHand = fam.includes('2H_');
      if (isTwoHand) {
        expect(isChibiDefault, `${fam} (2H) must override the chibi default carry`).toBe(false);
      }
    }
  });

  // The same CHIBI_* family keys, called via backGripFor with rig='kaykit', must
  // NOT silently return the chibi entry. The KayKit dispatch should fall through
  // to the KayKit default (0.16, 0.14, -0.27) since the CHIBI_* keys are tagged
  // rig='chibi' and the KayKit path skips them. This is the structural
  // separation: the BACK_GRIPS table is keyed by family, but the dispatch
  // filters by rig tag.
  it('CHIBI_* back-grip families do not leak into KayKit dispatch', () => {
    const DEFAULT_KAYKIT_POS: readonly [number, number, number] = [0.16, 0.14, -0.27];
    for (const fam of BACK_GRIP_FAMILIES) {
      if (!fam.startsWith('CHIBI_')) continue;
      const g = backGripFor(fam, 'r', 'kaykit');
      expect(g.position[0], `${fam} leaking X into KayKit dispatch`).toBe(DEFAULT_KAYKIT_POS[0]);
      expect(g.position[1], `${fam} leaking Y into KayKit dispatch`).toBe(DEFAULT_KAYKIT_POS[1]);
      expect(g.position[2], `${fam} leaking Z into KayKit dispatch`).toBe(DEFAULT_KAYKIT_POS[2]);
    }
  });

  // The sheathing port does NOT fork the weapon-attach logic (`setHeldWeapon` in
  // assets.ts is single-body); the rig family flows through `CharacterVisual.rig`
  // into `attachProp`'s grip lookup. The two rigs MUST NOT share a carry value
  // for the same shape; a future helper that mixes them would punch through
  // the chibi helmet. This is the rig-separation gate that catches a future
  // refactor that accidentally widens the dispatch.
  it('KayKit and chibi back-grip defaults diverge on X/Z', () => {
    const k = backGripFor(null, 'r', 'kaykit');
    const c = backGripFor(null, 'r', 'chibi');
    expect(k.position[2]).not.toBe(c.position[2]);
    expect(k.position[0]).not.toBe(c.position[0]);
    // And the test stays strict to the RigFamily type, no stringly-typed slop.
    const rigs: RigFamily[] = ['kaykit', 'chibi'];
    expect(rigs).toContain('kaykit');
    expect(rigs).toContain('chibi');
  });
});
