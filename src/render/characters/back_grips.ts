// Back-carry transforms for sheathed weapons (the Z-key stow toggle): where a held
// prop sits when re-parented from a handslot bone onto the rig's torso bone. Pure
// data + math (no three.js) so the family fallback and side mirroring are
// Node-testable; assets.ts applies the result to the cloned prop and keeps the
// SCALE the normal hand-grip pass computed (variant-pack clamps included).
//
// Ported from upstream PR #1765 (the Z-key weapon sheathing feature), with two
// fork extensions (PHAA-737 Row J, upstream #1765 ADAPT):
//
// 1. The KayKit Rig_Medium entries are ported as-is (the fork's non-chibi player
//    classes use the same shared skeleton). Coordinates are chest-bone local
//    space on that rig (chest +Z faces forward, +Y runs up the spine).
//
// 2. The fork ALSO has a chibi rig family (DEF-spine003-based, see PHAA-585 /
//    PHAA-697 / src/render/characters/manifest.ts). These rigs are roughly 60%
//    the height of the KayKit rig and the `DEF-spine003` bone sits lower on the
//    torso; the chibi entries below are hand-tuned against the chibi_female_* /
//    chibi_male_*.glb screenshots in `docs/screenshots/` and are tuned tighter
//    so a sheathed sword does not poke through the helmet or drag past the
//    feet. The chibi `*_m` (male) entries share the chibi_female values: PHAA-585
//    verified the male skeleton is a near-twin of the female skeleton (same bone
//    set, ~2% scale difference), so a single set of values fits both.
//
// Coordinates are torso-bone local space on each rig family; the rig dispatch is
// keyed by the visual's `weaponBackBone` (the bone name the asset layer will
// re-parent to; see `assets.ts` `setHeldWeapon`'s `stowed` arg).

export interface BackGripTransform {
  position: [number, number, number];
  /** Unit quaternion [x, y, z, w] in torso-bone local space. */
  quaternion: [number, number, number, number];
}

interface BackGripSpec {
  position: [number, number, number];
  /** Intrinsic XYZ Euler, radians (converted once at module load). */
  euler: [number, number, number];
  /** Which rig family this entry is tuned for (see RigFamily below). */
  rig: RigFamily;
}

export type RigFamily = 'kaykit' | 'chibi';

/** Intrinsic XYZ Euler to quaternion [x, y, z, w] (three.js 'XYZ' order). */
export function quatFromEulerXYZ(
  x: number,
  y: number,
  z: number,
): [number, number, number, number] {
  const c1 = Math.cos(x / 2);
  const s1 = Math.sin(x / 2);
  const c2 = Math.cos(y / 2);
  const s2 = Math.sin(y / 2);
  const c3 = Math.cos(z / 2);
  const s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

// Long hafts (staves, polearms, 2H) ride the diagonal across the back; short
// blades tuck vertically behind the shoulder. The rig's chest +Z faces forward,
// +Y runs up the spine, so "on the back" is negative Z. Mainhand (right) props
// lean one way; a left-hand prop (rogue offhand dagger, the warlock spellbook)
// mirrors across X so dual-wield reads as crossed blades.
const DEFAULT_KAYKIT: BackGripSpec = {
  position: [0.16, 0.14, -0.27],
  euler: [0.1, 0, Math.PI * 0.72],
  rig: 'kaykit',
};

// Chibi rig defaults: spine003 sits roughly where the KayKit chest bone does
// (upper back, below the shoulders), but the torso is shorter and wider, so the
// same value would clip the helmet. Trim Y/Z by ~30% and tuck slightly inward.
const DEFAULT_CHIBI: BackGripSpec = {
  position: [0.1, 0.1, -0.2],
  euler: [0.1, 0, Math.PI * 0.72],
  rig: 'chibi',
};

const BACK_GRIPS: Record<string, BackGripSpec> = {
  // KayKit Rig_Medium (port as-is from upstream #1765)
  '1H_Sword': { position: [0.16, 0.14, -0.27], euler: [0.1, 0, Math.PI * 0.72], rig: 'kaykit' },
  '2H_Sword': { position: [0.14, 0.1, -0.3], euler: [0.1, 0, Math.PI * 0.75], rig: 'kaykit' },
  '1H_Axe': { position: [0.16, 0.14, -0.27], euler: [0.1, 0, Math.PI * 0.72], rig: 'kaykit' },
  '2H_Axe': { position: [0.14, 0.1, -0.3], euler: [0.1, 0, Math.PI * 0.75], rig: 'kaykit' },
  '2H_Staff': { position: [0.12, 0.0, -0.3], euler: [0.1, 0, Math.PI * 0.78], rig: 'kaykit' },
  // Short one-handers carry at the hip, hilt up and leaning outward. The chibi
  // torso is a wide egg (about 0.3 half-width at the belt in chest-bone units)
  // and the long-hair styles drape over the whole back, so anything narrower
  // than about x 0.45 disappears inside the silhouette; these values keep the
  // pommel and grip visible from front, side, and behind on the shared rig.
  Knife: { position: [0.5, -0.38, -0.08], euler: [0.05, 0.15, Math.PI * 0.72], rig: 'kaykit' },
  '1H_Wand': { position: [0.5, -0.38, -0.08], euler: [0.05, 0.15, Math.PI * 0.72], rig: 'kaykit' },
  '1H_Crossbow': { position: [0.0, 0.1, -0.3], euler: [0, Math.PI / 2, Math.PI], rig: 'kaykit' },
  '2H_Crossbow': { position: [0.0, 0.1, -0.32], euler: [0, Math.PI / 2, Math.PI], rig: 'kaykit' },
  VAR_SWORD: { position: [0.16, 0.14, -0.27], euler: [0.1, 0, Math.PI * 0.72], rig: 'kaykit' },
  VAR_DAGGER: { position: [0.5, -0.38, -0.08], euler: [0.05, 0.15, Math.PI * 0.72], rig: 'kaykit' },
  VAR_STAFF: { position: [0.12, 0.0, -0.3], euler: [0.1, 0, Math.PI * 0.78], rig: 'kaykit' },
  VAR_AXE: { position: [0.16, 0.14, -0.27], euler: [0.1, 0, Math.PI * 0.72], rig: 'kaykit' },
  VAR_POLEARM: { position: [0.12, 0.0, -0.3], euler: [0.1, 0, Math.PI * 0.78], rig: 'kaykit' },
  // The variant-pack families the Season 1 Armory added (weapon skins) plus the
  // item models that share them. Each reuses the carry already tuned for the
  // shape it matches, so a skin sheathes exactly like its mundane twin: hafted
  // one-handers ride the shoulder like a sword, short casting sticks and held
  // books carry at the hip, and the ranged families lie flat across the
  // shoulders like the crossbows.
  VAR_MACE: { position: [0.16, 0.14, -0.27], euler: [0.1, 0, Math.PI * 0.72], rig: 'kaykit' },
  VAR_HAMMER: { position: [0.16, 0.14, -0.27], euler: [0.1, 0, Math.PI * 0.72], rig: 'kaykit' },
  VAR_WAND: { position: [0.5, -0.38, -0.08], euler: [0.05, 0.15, Math.PI * 0.72], rig: 'kaykit' },
  VAR_BOOK: { position: [0.5, -0.38, -0.08], euler: [0.05, 0.15, Math.PI * 0.72], rig: 'kaykit' },
  VAR_CROSSBOW: { position: [0.0, 0.1, -0.3], euler: [0, Math.PI / 2, Math.PI], rig: 'kaykit' },
  VAR_BOW: { position: [0.0, 0.1, -0.32], euler: [0, Math.PI / 2, Math.PI], rig: 'kaykit' },
  // Off-hand gear from the two-slot loadout (release/v0.24.0-ptr): a left-hand
  // prop of any family above mirrors automatically via backGripFor's side
  // argument. Families that branches introduces (shields, held off-hands like
  // lanterns) get their own entries here when it merges; until then an unknown
  // family falls back to DEFAULT_KAYKIT instead of vanishing.

  // Chibi rig family (PHAA-737 Row J, fork-authored; see file header). The chibi
  // values are 60-75% of the KayKit magnitudes: shorter torso means anything
  // taller clips the helmet, and the wider egg shape means any further out
  // pokes past the silhouette. Two-handed hafts ride the same diagonal angle
  // but with a smaller lift so the blade tip stays below the chin; crossbows
  // lie flatter to clear the chibi's oversized hood/hat variants.
  CHIBI_1H_Sword: { position: [0.1, 0.1, -0.2], euler: [0.08, 0, Math.PI * 0.72], rig: 'chibi' },
  CHIBI_2H_Sword: { position: [0.08, 0.06, -0.22], euler: [0.08, 0, Math.PI * 0.75], rig: 'chibi' },
  CHIBI_1H_Axe: { position: [0.1, 0.1, -0.2], euler: [0.08, 0, Math.PI * 0.72], rig: 'chibi' },
  CHIBI_2H_Axe: { position: [0.08, 0.06, -0.22], euler: [0.08, 0, Math.PI * 0.75], rig: 'chibi' },
  CHIBI_2H_Staff: { position: [0.07, 0.0, -0.22], euler: [0.08, 0, Math.PI * 0.78], rig: 'chibi' },
  CHIBI_Knife: { position: [0.3, -0.25, -0.06], euler: [0.05, 0.15, Math.PI * 0.72], rig: 'chibi' },
  CHIBI_1H_Wand: {
    position: [0.3, -0.25, -0.06],
    euler: [0.05, 0.15, Math.PI * 0.72],
    rig: 'chibi',
  },
  CHIBI_1H_Crossbow: {
    position: [0.0, 0.07, -0.22],
    euler: [0, Math.PI / 2, Math.PI],
    rig: 'chibi',
  },
  CHIBI_2H_Crossbow: {
    position: [0.0, 0.07, -0.24],
    euler: [0, Math.PI / 2, Math.PI],
    rig: 'chibi',
  },
};

/** The grip families that have a tuned on-back carry. Every family the character
 *  assets can hand `backGripFor` must appear here, or that weapon sheathes with
 *  the default pose; `tests/back_grips.test.ts` (added in this commit) scans the
 *  asset tables and fails when a new family lands without a carry. */
export const BACK_GRIP_FAMILIES: ReadonlySet<string> = new Set(Object.keys(BACK_GRIPS));

/** The on-back transform for a sheathed prop: family-specific, mirrored across X
 *  (position and lean) for a left-hand prop, defaulting to the rig-family
 *  fallback for unknown accessories. The rig family is matched to the visual:
 *  KayKit-equipped classes get the KayKit entries (and fallback); the chibi `_f`
 *  / `_m` classes get the chibi entries. */
export function backGripFor(
  accessory: string | null,
  side: 'r' | 'l',
  rig: RigFamily,
): BackGripTransform {
  let spec: BackGripSpec;
  if (accessory && BACK_GRIPS[accessory] && BACK_GRIPS[accessory].rig === rig) {
    spec = BACK_GRIPS[accessory];
  } else {
    spec = rig === 'chibi' ? DEFAULT_CHIBI : DEFAULT_KAYKIT;
  }
  const mirror = side === 'l' ? -1 : 1;
  return {
    position: [spec.position[0] * mirror, spec.position[1], spec.position[2]],
    quaternion: quatFromEulerXYZ(spec.euler[0], spec.euler[1] * mirror, spec.euler[2] * mirror),
  };
}
