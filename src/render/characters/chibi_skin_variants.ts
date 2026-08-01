// PHAA-587: per-material color variants for the chibi female roster. The male
// SKINS system (manifest.ts) swaps one full-body atlas texture; the chibi
// outfits ship 7-or-fewer SEPARATE materials (hair, outfit pieces, skin) with
// no atlas, so a texture swap doesn't apply. Instead each variant re-tints a
// couple of named materials (hair + one outfit accent) directly. Pure data +
// lookup, no three.js: assets.ts applies the returned colors via the existing
// tintedMaterial cache.

/** skinIndex 0 is always the outfit's authored default (no tints). */
export interface ChibiSkinVariant {
  /** GLB material name -> tint color, applied on top of any class-level VisualDef tint. */
  tints: Record<string, number>;
}

/** Lerp amount toward a variant tint; stronger than the class-level body tint
 *  (DEFAULT_TINT_STRENGTH in assets.ts) since it's the primary way a player
 *  distinguishes hair/outfit color choices, not a subtle class recolor. */
export const CHIBI_VARIANT_TINT_STRENGTH = 0.6;

const BASE: ChibiSkinVariant = { tints: {} };

export const CHIBI_SKIN_VARIANTS: Record<string, ChibiSkinVariant[]> = {
  // knight outfit (warrior/paladin): the closed helm occludes 'hair' and
  // 'armorbelt' is a thin waist strip, so variants instead target the
  // materials that actually read on the silhouette: 'armorthigh' (the large
  // flared tasset plates, the dominant garment) and 'armorplastron' (the
  // chestpiece), confirmed by a per-material render probe, see PHAA-631.
  player_warrior_f: [
    BASE,
    { tints: { armorthigh: 0x8a1f1f, armorplastron: 0x5a1414 } },
    { tints: { armorthigh: 0x2f4f8a, armorplastron: 0x1f3a66 } },
  ],
  player_paladin_f: [
    BASE,
    { tints: { armorthigh: 0x2f4f8a, armorplastron: 0x1f3a66 } },
    { tints: { armorthigh: 0x4a2a6e, armorplastron: 0x331c4d } },
  ],
  // archer outfit (hunter/druid)
  player_hunter_f: [
    BASE,
    { tints: { hairtvariant: 0x4a2e17, greenoutfit: 0x5c7a3a } },
    { tints: { hairtvariant: 0xb5651d, greenoutfit: 0x35502b } },
  ],
  player_druid_f: [
    BASE,
    { tints: { hairtvariant: 0x2f3a1f, greenoutfit: 0x6b5a3a } },
    { tints: { hairtvariant: 0x8a5a2b, greenoutfit: 0x4a3f2a } },
  ],
  // ninja outfit (rogue)
  player_rogue_f: [
    BASE,
    { tints: { hairponytail: 0x1a1a1a, ninjasuitmat: 0x2b2b3a } },
    { tints: { hairponytail: 0x7a3b1a, ninjasuitmat: 0x3a1f2b } },
  ],
  // student outfit (mage/priest)
  player_mage_f: [
    BASE,
    { tints: { hairvariant: 0x2a2a5c, schooloutfit: 0x3a5c8a } },
    { tints: { hairvariant: 0x8a2a5c, schooloutfit: 0x5c3a8a } },
  ],
  player_priest_f: [
    BASE,
    { tints: { hairvariant: 0xd8c8a0, schooloutfit: 0xe8dcc4 } },
    { tints: { hairvariant: 0x6a5a3a, schooloutfit: 0xc9b98a } },
  ],
  // merchant outfit (warlock)
  player_warlock_f: [
    BASE,
    { tints: { hairone: 0x2a1a3a, thirdsuitchemise: 0x4a2a6a } },
    { tints: { hairone: 0x1a1a1a, thirdsuitchemise: 0x6a3a8a } },
  ],
  // basemesh outfit (shaman): only 'character' + 'eyebrows' materials exist
  // (no separate hair/outfit mesh), so variants are subtle skin-tone shifts.
  player_shaman_f: [BASE, { tints: { character: 0xc9a06a } }, { tints: { character: 0x8a5a3a } }],
};

/** Number of chibi skin variants for a visual key (0 = not a chibi-variant key). */
export function chibiSkinCount(key: string): number {
  return CHIBI_SKIN_VARIANTS[key]?.length ?? 0;
}

/** Tint color for one named material under (key, skinIndex), or null if this
 *  key/skinIndex/material has no override (renders the outfit's authored color). */
export function chibiMaterialTint(
  key: string,
  skinIndex: number,
  materialName: string,
): number | null {
  return CHIBI_SKIN_VARIANTS[key]?.[skinIndex]?.tints[materialName] ?? null;
}
