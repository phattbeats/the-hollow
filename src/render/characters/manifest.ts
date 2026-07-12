// Visual manifest: maps every sim identity (player class, mob template/family,
// NPC id, druid/polymorph form) onto a rigged glTF asset + clip names + kit.
// Pure data + dispatch; no three.js imports, no loading.

import { MECH_CHROMAS, type MechChroma } from '../../sim/content/skins';
import { MOBS } from '../../sim/data';
import type { Entity, EquipSlot, PlayerClass } from '../../sim/types';
import { ITEM_ARMOR_VARIANTS } from '../../ui/armor_variants';
import { ITEM_WEAPON_VARIANTS } from '../../ui/weapon_variants';
import type { OverheadEmoteId } from '../../world_api';
import { chibiSkinCount } from './chibi_skin_variants';

export interface EmoteClipSpec {
  clips: readonly string[];
  timeScale?: number;
  repeats?: number;
}

export interface ClipMap {
  idle: string;
  walk: string;
  run: string;
  /** one-shot swing clips, rotated per attack */
  attack: string[];
  death: string;
  /** hit-react one-shots (optional; spider/raptor rigs have none) */
  hit?: string[];
  /** looping cast channel */
  cast?: string;
  sitDown?: string;
  sitIdle?: string;
  /** swim base (prone pitch is procedural on top) */
  swim?: string;
  /** airborne base pose while jumping/falling */
  jump?: string;
  walkBack?: string;
  /** one-shot played on respawn (skeleton awaken / boss taunt) */
  flourish?: string;
  /** Z-key weapon-sheathe gesture one-shot (PHAA-737 Row J, upstream #1765).
   *  The windup's midpoint is when the held prop re-parents from the handslot
   *  bone to the rig's back bone (see `weaponBackBone`). Optional: rigs without
   *  a sheathe gesture snap the swap immediately (CharacterVisual.setWeaponStowed
   *  falls through to `forceStow` when `clips.stow` is undefined). */
  stow?: string;
  /** player-facing overhead emote one-shots; clips are sourced from the GLB. */
  emote?: Partial<Record<OverheadEmoteId, EmoteClipSpec>>;
}

export interface AttachDef {
  url: string;
  bone: string;
  position?: [number, number, number];
  rotationY?: number;
  /** Copy grip from a built-in accessory node on the character rig (e.g. Spellbook_open). */
  gripRef?: string;
}

export interface VisualDef {
  url: string;
  /** Optional extra GLBs that provide animation clips for static rig files. */
  animUrls?: string[];
  /** world-unit height (pivot->crown) at e.scale = 1 */
  height: number;
  clips: ClipMap;
  /** floating rigs hover: mesh bottom sits this far above the pivot */
  hover?: number;
  /** yaw applied so the model faces +Z (facing-0 convention) */
  yaw?: number;
  /** KayKit chars ship every accessory visible: non-skinned mesh nodes to KEEP.
   *  undefined = keep everything (creature GLBs have no accessories). */
  show?: string[];
  attach?: AttachDef[];
  /** Indices into `attach` whose model is replaced by the entity's equipped mainhand
   *  weapon (mapped via ITEM_WEAPON_VARIANTS). undefined/empty = the held weapon never
   *  changes with gear (hunter keeps its crossbow; mobs/NPCs are fixed). Usually [0]
   *  (the mainhand); the rogue lists [0, 1] so a dagger shows in BOTH hands. A fixed
   *  offhand left off this list stays as authored (the warlock spellbook). */
  weaponSlots?: number[];
  /** Indices into `attach` whose model is replaced by the entity's equipped armor
   *  (mapped via ITEM_ARMOR_VARIANTS by `EquipSlot`). Mirrors `weaponSlots`: only
   *  the listed attach entries swap with gear; the others stay as authored. Always
   *  paired with `armorByAttachIndex`, which tells the swap path which `EquipSlot`
   *  each listed index corresponds to. Rig-agnostic: works with zero actual armor
   *  GLBs (T1 ships the wiring; T2a authors the meshes). Players only; mobs/NPCs/
   *  forms stay undefined. */
  armorSlots?: number[];
  /** Map from each `armorSlots` attach index to its `EquipSlot`, so the swap path
   *  can look up the right equipped item for each attach. Required when
   *  `armorSlots` is non-empty: a missing entry silently skips that slot (safe but
   *  never swaps). Defs without armor slots keep this undefined. */
  armorByAttachIndex?: Record<number, EquipSlot>;
  /** Baked (built-in) accessory node names, each gated by an `EquipSlot`: the node
   *  is visible only while that slot carries an equipped item. Drives the male
   *  KayKit roster's `show`-list meshes (Knight_Helmet, Knight_Cape) straight off
   *  the wearer's `equippedItems` with ZERO new assets (PHAA-502 T2a), the quick
   *  win ahead of the `armorSlots` attach-GLB path above. Each node MUST also be in
   *  `show` so the assembler keeps it in the graph; this map only flips its
   *  visibility (a pure `.visible` toggle, no re-attach or material pass). Players
   *  only; undefined everywhere else (mobs/NPCs/forms have no equip state, so their
   *  built-in accessories stay as authored). */
  bakedArmorSlots?: Record<string, EquipSlot>;
  /** material tint: explicit color, 'entity' (use e.color), or none */
  tint?: number | 'entity';
  /** lerp amount toward the tint (default 0.4) */
  tintStrength?: number;
  /** u/s at which the walk/run cycles look right (timeScale matching) */
  walkRef?: number;
  runRef?: number;
  attackTimeScale?: number;
  deathTimeScale?: number;
  /** Skip the boot preload sweep (manifestUrls); the asset is fetched on demand
   *  instead; e.g. the cosmetic-only Combat Mech, loaded via preloadMechAssets()
   *  when the skin-select preview opens, so it never bloats every client's boot. */
  lazyPreload?: boolean;
  /** Post-load orientation fixups for weapon/prop nodes baked INTO a creature
   *  GLB at the wrong angle (some KayKit handslot weapons ship without the grip
   *  flip the standalone weapon files carry). Node name as authored in the GLB;
   *  applied as a local-space rotation (radians) after the bind transform. */
  weaponFix?: { node: string; rotX?: number; rotY?: number; rotZ?: number }[];
  /** Post-load placement fixups for SKINNED accessory meshes baked INTO a
   *  character GLB at the wrong scale/position (PHAA-633: the styloo merchant
   *  outfit's witch hat shipped floating above the head at ~2x scale). Unlike
   *  `weaponFix`, this bakes a corrective matrix into the node's `geometry`
   *  (applied once, at the per-url cache-build in `optimizedScene`) rather
   *  than mutating the node's own transform: a `SkinnedMesh` in the default
   *  'attached' bind mode recomputes its `bindMatrixInverse` from its own
   *  `matrixWorld` on every `updateMatrixWorld()` pass, which silently
   *  cancels out any transform applied directly to the node (confirmed via
   *  matrix introspection while debugging PHAA-633; `weaponFix`'s node-level
   *  rotation only works because it targets non-skinned prop meshes). Scale
   *  is uniform and applied before the translation (T * S). */
  skinnedMeshFix?: { node: string; position?: [number, number, number]; scale?: number }[];
  /** Bone name that a sheathed held prop re-parents onto (PHAA-737 Row J,
   *  upstream #1765 ADAPT). Defaults to 'chest' on KayKit rigs; chibi rigs
   *  override to 'DEF-spine003'. Used only when `weaponSlots` is non-empty and
   *  the entity has the sheathed bit on; otherwise the attach uses its
   *  authored bone. GLTFLoader sanitizes node names (PropertyBinding strips
   *  [].:/ chars), so the runtime resolver tries both spellings. */
  weaponBackBone?: string;
}

/** The slice of a VisualDef that decides how held weapons attach (which bones, and
 *  which slots swap to the equipped item). Lets a cosmetic body adopt a different
 *  class's hand layout without cloning the whole def. */
export type WeaponLayoutOverride = Pick<VisualDef, 'attach' | 'weaponSlots'>;

// ---------------------------------------------------------------------------
// Clip sets per source rig family
// ---------------------------------------------------------------------------

const KAYKIT_EMOTES: Partial<Record<OverheadEmoteId, EmoteClipSpec>> = {
  wave: { clips: ['Spellcast_Raise', 'Cheer'], timeScale: 0.9 },
  laugh: { clips: ['Hit_A', 'Cheer'], timeScale: 1.45, repeats: 2 },
  question: { clips: ['Block', 'Spellcast_Raise'], timeScale: 1.15 },
  cheer: { clips: ['Cheer'], timeScale: 1.05, repeats: 2 },
  dance: {
    clips: ['Running_Strafe_Left', 'Running_Strafe_Right', 'Cheer'],
    timeScale: 1.05,
    repeats: 2,
  },
  point: { clips: ['Spellcast_Shoot', '2H_Ranged_Shoot'], timeScale: 0.95 },
  flex: { clips: ['Block', 'Cheer'], timeScale: 0.8 },
  salute: { clips: ['Spellcast_Raise', 'Block'], timeScale: 1.18 },
  cry: { clips: ['Hit_A', 'Sit_Floor_Down'], timeScale: 0.65 },
  bow: { clips: ['Sit_Floor_Down', 'Spellcast_Raise'], timeScale: 1.35 },
  clap: { clips: ['1H_Melee_Attack_Slice_Diagonal', 'Cheer'], timeScale: 1.55, repeats: 2 },
  roar: { clips: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Chop', 'Cheer'], timeScale: 0.9 },
  kneel: { clips: ['Sit_Floor_Down'], timeScale: 0.85 },
};

const kaykit = (attack: string[], idle = 'Idle'): ClipMap => ({
  idle,
  walk: 'Walking_A',
  run: 'Running_A',
  walkBack: 'Walking_Backwards',
  attack,
  hit: ['Hit_A'],
  death: 'Death_A',
  cast: 'Spellcasting',
  sitDown: 'Sit_Floor_Down',
  sitIdle: 'Sit_Floor_Idle',
  swim: 'Lie_Idle',
  jump: 'Jump_Idle',
  emote: KAYKIT_EMOTES,
});

const skeletonClips = (attack: string[], flourish = 'Skeletons_Awaken_Standing'): ClipMap => ({
  ...kaykit(attack, 'Idle_Combat'),
  flourish,
});

const skeletonLargeClips = (attack: string[]): ClipMap => ({
  idle: 'Idle',
  walk: 'Walking_A',
  run: 'Running_A',
  attack,
  hit: ['Hit_A'],
  death: 'Death_A',
});

// Quaternius 2021 animal rig (wolf/bull/alpaca/fox/stag)
const animal = (attack: string[]): ClipMap => ({
  idle: 'Idle',
  walk: 'Walk',
  run: 'Gallop',
  attack,
  hit: ['Idle_HitReact_Left', 'Idle_HitReact_Right'],
  death: 'Death',
});

// Custom wild boar rig (wild_boar.glb)
const WILD_BOAR: ClipMap = {
  idle: 'Idle1',
  walk: 'Move2 (shuffle)',
  run: 'Move1 (jump)',
  attack: ['Attack1 (marracca)', 'Attack2 (tusks)'],
  hit: ['Hurt'],
  death: 'Dying',
};

// 14-clip biped rig (orc/frog/demonalt/yetialt)
const BIPED14: ClipMap = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  attack: ['Punch', 'Weapon'],
  hit: ['HitReact'],
  death: 'Death',
};

// 2023 enemy rig (goblin/giant)
const ENEMY7: ClipMap = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  attack: ['Attack'],
  hit: ['HitRecieve'],
  death: 'Death',
};

// floating/flying rigs (goleling/dragon); hover instead of walking
const FLOATING: ClipMap = {
  idle: 'Flying_Idle',
  walk: 'Fast_Flying',
  run: 'Fast_Flying',
  attack: ['Headbutt', 'Punch'],
  hit: ['HitReact'],
  death: 'Death',
};

const SPIDER: ClipMap = {
  idle: 'Spider_Idle',
  walk: 'Spider_Walk',
  run: 'Spider_Walk',
  attack: ['Spider_Attack'],
  death: 'Spider_Death', // no hit-react in asset
};

// Chicken-cow rig (chicken_cow.glb, procedurally authored; see
// scripts/gen_chicken_cow.mjs). Node-transform animations, no hit-react.
const CHICKEN_COW: ClipMap = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  attack: ['Attack'],
  death: 'Death',
  jump: 'Jump',
};

// ---------------------------------------------------------------------------
// Asset urls
// ---------------------------------------------------------------------------

const PLAYERS = 'models/chars/players';
const NPCS = 'models/chars/npcs';
const ENEMIES = 'models/chars/enemies';
const CREATURES = 'models/creatures';
const WEAPONS = 'models/weapons';
// Armor visual models. PHAA-502 T1 ships the plumbing (this resolver +
// VisualDef.armorSlots), PHAA-502 T2a wires baked-into-class-GLB armor meshes
// (Knight_Cape, Knight_Helmet etc.) through `bakedArmorSlots`. PHAA-502 T2b
// authors standalone armor GLBs from license-clean sources and registers them
// here; the first batch (PHAA-609) lives under `models/armor/` and was
// extracted from the already-vendored KayKit Knight pack (CC0, see CREDITS.md)
// via scripts/phaa609_extract_armor_glbs.mjs. Attach approach is resolved
// (see `docs/design/armor-per-slot-sourcing.md`): rigid single-bone attach for
// helm/chest only (proven safe), a short hip-to-thigh guard for legs (avoids
// the run-cycle knee clip a full greave gets on a rigid attach), never on a
// class that already has `bakedArmorSlots` for the same slot (double-render).
// `ITEM_ARMOR_VARIANTS` wiring for these three GLBs is still pending a
// content call on which classes should read as plate-armored (flagged for
// Brandon in the design doc) rather than an engineering blocker.
const ARMOR = 'models/armor';

/** GLB url for an equipped armor item's worn model, or null if the item has no
 *  mapped armor visual (then the class default attach is kept). Mirrors the bag
 *  icon via the shared ITEM_ARMOR_VARIANTS map, so worn armor == inventory icon. */
export function itemArmorModelUrl(itemId: string | null | undefined): string | null {
  if (!itemId) return null;
  const key = ITEM_ARMOR_VARIANTS[itemId];
  return key ? `${ARMOR}/${key}.glb` : null;
}

/** Distinct armor-visual GLB urls (one per variant), for the boot preload sweep so
 *  setArmor can attach any equipped armor synchronously (resolvedGltf throws on
 *  an un-preloaded url). Empty until PHAA-502 T2a authors the first models. */
export function itemArmorModelUrls(): string[] {
  return [...new Set(Object.values(ITEM_ARMOR_VARIANTS).map((key) => `${ARMOR}/${key}.glb`))];
}

/** GLB url for an equipped mainhand item's held weapon model, or null if the item
 *  has no mapped model (then the class default attach is kept). Mirrors the bag
 *  icon via the shared ITEM_WEAPON_VARIANTS map, so held weapon == inventory icon. */
export function itemWeaponModelUrl(itemId: string | null | undefined): string | null {
  if (!itemId) return null;
  const key = ITEM_WEAPON_VARIANTS[itemId];
  return key ? `${WEAPONS}/${key}.glb` : null;
}

/** Distinct held-weapon GLB urls (one per variant), for the boot preload sweep so
 *  setWeapon can attach any equipped weapon synchronously (resolvedGltf throws on
 *  an un-preloaded url). */
export function itemWeaponModelUrls(): string[] {
  return [...new Set(Object.values(ITEM_WEAPON_VARIANTS).map((key) => `${WEAPONS}/${key}.glb`))];
}

const LOW_URL_ALIAS: Record<string, string> = {
  'models/chars/players/rogue_hooded.glb': 'models/chars/players/rogue.glb',
};

const HUMANOID_H = 2.6;

const SKINS_DIR = 'textures/skins';

// ---------------------------------------------------------------------------
// Combat Mech; a class-agnostic cosmetic body. Unlike the per-class skins
// below (which swap a body atlas onto an existing class rig), the mech is a
// SEPARATE model with its own visual key (`player_mech`) and a set of chroma
// textures grouped across the three skin-event rarity tiers. Epics additionally
// ship an emissive glow map. Cosmetic preview only for now; lazy-loaded via
// preloadMechAssets() so it never bloats every client's boot.
// ---------------------------------------------------------------------------
const MECH_DIR = `${PLAYERS}/Mech/textures`;

function mechChromaUrl(c: MechChroma): string {
  if (c.rank === 'uncommon') return `${MECH_DIR}/uncommon/combatmech_${c.id}.png`;
  if (c.rank === 'rare') return `${MECH_DIR}/rares/combatmech_rare_${c.id}.png`;
  return `${MECH_DIR}/epics/combatmech_epic_${c.id}.png`;
}
function mechEmissiveUrl(c: MechChroma): string | null {
  return c.rank === 'epic' ? `${MECH_DIR}/epics/combatmech_epic_${c.id}_emis.png` : null;
}

// Per-class alternate body textures ("skins"). Index 0 = null = the model's
// embedded default texture (no swap). Index >0 = a full-atlas alternate applied
// to the body material's .map (same UVs). Classes sharing a model share its skin
// set. Players only; mobs/npcs keep their default look. See public/textures/skins/.
export const SKINS: Record<string, (string | null)[]> = {
  player_warrior: [
    null,
    `${SKINS_DIR}/knight/alt_a.png`,
    `${SKINS_DIR}/knight/alt_b.png`,
    `${SKINS_DIR}/knight/alt_c.png`,
  ],
  player_paladin: [null, `${SKINS_DIR}/paladin/alt_a.png`],
  player_hunter: [
    null,
    `${SKINS_DIR}/ranger/alt_a.png`,
    `${SKINS_DIR}/ranger/alt_b.png`,
    `${SKINS_DIR}/ranger/alt_c.png`,
  ],
  player_rogue: [
    null,
    `${SKINS_DIR}/rogue/alt_a.png`,
    `${SKINS_DIR}/rogue/alt_b.png`,
    `${SKINS_DIR}/rogue/alt_c.png`,
  ],
  player_priest: [
    null,
    `${SKINS_DIR}/mage/alt_a.png`,
    `${SKINS_DIR}/mage/alt_b.png`,
    `${SKINS_DIR}/mage/alt_c.png`,
  ],
  player_mage: [
    null,
    `${SKINS_DIR}/mage/alt_a.png`,
    `${SKINS_DIR}/mage/alt_b.png`,
    `${SKINS_DIR}/mage/alt_c.png`,
  ],
  player_warlock: [
    null,
    `${SKINS_DIR}/mage/alt_a.png`,
    `${SKINS_DIR}/mage/alt_b.png`,
    `${SKINS_DIR}/mage/alt_c.png`,
  ],
  player_shaman: [
    null,
    `${SKINS_DIR}/barbarian/alt_a.png`,
    `${SKINS_DIR}/barbarian/alt_b.png`,
    `${SKINS_DIR}/barbarian/alt_c.png`,
  ],
  player_druid: [
    null,
    `${SKINS_DIR}/druid/alt_a.png`,
    `${SKINS_DIR}/druid/alt_b.png`,
    `${SKINS_DIR}/druid/alt_c.png`,
  ],
  // Combat Mech chromas; every index is a real full-model texture (no null
  // default; the embedded base texture is not one of the rewards).
  player_mech: MECH_CHROMAS.map(mechChromaUrl),
};

// Emissive (glow) maps keyed exactly like SKINS, applied to .emissiveMap when a
// skin index has one. Only the Combat Mech epics glow; null entries mean no glow.
export const SKIN_EMISSIVE: Record<string, (string | null)[]> = {
  player_mech: MECH_CHROMAS.map(mechEmissiveUrl),
};

/** Number of skins (including the default) available for a visual key; min 1.
 *  Falls back to the chibi per-material tint variant count (chibi_skin_variants.ts)
 *  when the key has no atlas-swap SKINS entry, e.g. the female roster. */
export function skinCount(key: string): number {
  if (SKINS[key]) return SKINS[key].length;
  const chibi = chibiSkinCount(key);
  return chibi > 0 ? chibi : 1;
}

/** Texture url to preview a skin option (default index 0 → the model's base.png). */
export function skinThumbUrl(key: string, index: number): string | null {
  const arr = SKINS[key];
  if (!arr || index < 0 || index >= arr.length) return null;
  if (arr[index]) return arr[index];
  const firstAlt = arr.find((u): u is string => !!u); // derive dir from an alt
  return firstAlt ? firstAlt.replace(/\/[^/]+$/, '/base.png') : null;
}

// chibi_female_knight.glb's baked armor mesh nodes, shared by player_warrior_f
// and player_paladin_f (both wear the same outfit GLB). Node names come from
// the source file (a few carry an upstream "amor"/typo spelling); mapped to
// EquipSlot by armor-piece anatomy: helmet -> helmet, plastron (chest plate)
// -> chest, shoulder pauldrons + arm guards -> shoulder, the hip/thigh skirt
// pieces -> waist, the knee/shin/thigh plates -> legs, the shoe plates -> feet.
const CHIBI_FEMALE_KNIGHT_ARMOR_NODES = [
  'armorhelmet',
  'amorplastron',
  'amorshoulders',
  'amorarm',
  'armorceinturethighs',
  'armorskirt',
  'armorknees',
  'armorlegs',
  'armorthights',
  'armorshoe',
];
const CHIBI_FEMALE_KNIGHT_BAKED_ARMOR_SLOTS: Record<string, EquipSlot> = {
  armorhelmet: 'helmet',
  amorplastron: 'chest',
  amorshoulders: 'shoulder',
  amorarm: 'shoulder',
  armorceinturethighs: 'waist',
  armorskirt: 'waist',
  armorknees: 'legs',
  armorlegs: 'legs',
  armorthights: 'legs',
  armorshoe: 'feet',
};

// ---------------------------------------------------------------------------
// The manifest
// ---------------------------------------------------------------------------

export const VISUALS: Record<string, VisualDef> = {
  // -- player classes ------------------------------------------------------
  player_warrior: {
    url: `${PLAYERS}/knight.glb`,
    height: HUMANOID_H,
    clips: kaykit(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']),
    // v2 knight dropped the built-in Badge_Shield mesh. The helmet is TWO skinned
    // meshes (dome + visor) and the cape is one; listed here so they are explicit
    // even though skinned meshes are kept past the show-filter regardless (the
    // filter only culls non-skinned nodes).
    show: ['Knight_Helmet', 'Knight_HelmetVisor', 'Knight_Cape'],
    // PHAA-502 T2a: the built-in accessories are now driven by the wearer's gear
    // instead of being always-on. The helmet slot reveals BOTH helmet meshes
    // (dome + visor); leave Knight_Head so a bare head still shows under it. The
    // cape reads off the chest piece since EQUIP_SLOTS has no back/cloak slot
    // (src/sim/types.ts), so an armored warrior gets the cloak and a bare one
    // loses it.
    bakedArmorSlots: {
      Knight_Helmet: 'helmet',
      Knight_HelmetVisor: 'helmet',
      Knight_Cape: 'chest',
    },
    attach: [{ url: `${WEAPONS}/sword_1handed.glb`, bone: 'handslot.r' }],
    weaponSlots: [0],
  },
  player_paladin: {
    url: `${PLAYERS}/paladin.glb`,
    height: HUMANOID_H,
    clips: kaykit(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']),
    // dedicated paladin model (helmeted variant); ships its own Cape + Helmet
    // meshes and texture, so no show-list/tint. Shield + paladin hammer arrive
    // in the weapons pass; the gripped axe holds the slot until then.
    // PHAA-609 bespoke-mesh batch 1: same T2a baked-toggle pattern as
    // player_warrior (Paladin_Helmet/Paladin_Cape were always-on before this;
    // Paladin_Cape is the model's only non-skinned mesh, so it must be listed
    // in `show` or the keep-filter would cull it).
    show: ['Paladin_Helmet', 'Paladin_Cape'],
    bakedArmorSlots: {
      Paladin_Helmet: 'helmet',
      Paladin_Cape: 'chest',
    },
    attach: [{ url: `${WEAPONS}/axe_1handed.glb`, bone: 'handslot.r' }],
    weaponSlots: [0],
  },
  player_hunter: {
    url: `${PLAYERS}/ranger.glb`,
    height: HUMANOID_H,
    clips: kaykit(['2H_Ranged_Shoot']),
    // dedicated ranger model; the quiver is a built-in mesh, so it's no longer
    // a separate chest attachment
    attach: [{ url: `${WEAPONS}/crossbow_1handed.glb`, bone: 'handslot.r' }],
  },
  player_rogue: {
    url: `${PLAYERS}/rogue.glb`,
    height: HUMANOID_H,
    clips: kaykit(['Dualwield_Melee_Attack_Chop']),
    show: ['Rogue_Cape'],
    attach: [
      { url: `${WEAPONS}/dagger.glb`, bone: 'handslot.r' },
      { url: `${WEAPONS}/dagger.glb`, bone: 'handslot.l' },
    ],
    weaponSlots: [0, 1], // dual-wield: the equipped weapon shows in BOTH hands (mostly daggers)
  },
  player_priest: {
    url: `${PLAYERS}/mage.glb`,
    height: HUMANOID_H,
    clips: kaykit(['2H_Melee_Attack_Chop']),
    show: [],
    attach: [{ url: `${WEAPONS}/staff.glb`, bone: 'handslot.r' }],
    weaponSlots: [0],
    tint: 0xf0e9d6,
    tintStrength: 0.5,
  },
  player_shaman: {
    url: `${PLAYERS}/barbarian.glb`,
    height: HUMANOID_H,
    clips: kaykit(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']),
    show: ['Barbarian_BearHat'], // v2 barbarian renamed Hat→BearHat and dropped the round shield mesh
    attach: [{ url: `${WEAPONS}/axe_1handed.glb`, bone: 'handslot.r' }],
    weaponSlots: [0],
    tint: 0x6f8fc9,
    tintStrength: 0.4,
  },
  player_mage: {
    url: `${PLAYERS}/mage.glb`,
    height: HUMANOID_H,
    clips: kaykit(['2H_Melee_Attack_Chop']),
    // no Mage_Hat on players: the brim hides the whole body from the default
    // chase-camera pitch (NPC mages keep theirs; they're seen from the side)
    show: ['Mage_Cape'],
    attach: [{ url: `${WEAPONS}/staff.glb`, bone: 'handslot.r' }],
    weaponSlots: [0],
  },
  player_warlock: {
    url: `${PLAYERS}/mage.glb`,
    height: HUMANOID_H,
    clips: kaykit(['Spellcast_Shoot']), // wand zap reads better than a staff bonk
    show: [],
    attach: [
      { url: `${WEAPONS}/wand.glb`, bone: 'handslot.r' },
      { url: `${WEAPONS}/spellbook_open.glb`, bone: 'handslot.l', gripRef: 'Spellbook_open' },
    ],
    weaponSlots: [0], // mainhand (wand) swaps; spellbook offhand stays
    tint: 0x8d5fd3,
    tintStrength: 0.45,
  },
  player_druid: {
    url: `${PLAYERS}/druid.glb`,
    height: HUMANOID_H,
    clips: kaykit(['2H_Melee_Attack_Chop']),
    // dedicated druid model (own texture, ships a Backpack mesh)
    attach: [{ url: `${WEAPONS}/staff.glb`, bone: 'handslot.r' }],
    weaponSlots: [0],
  },

  // -- cosmetic body skin (class-agnostic; both the skin preview and a live
  //    player whose skinCatalog === 'mech', see visualKeyFor) ----------------
  player_mech: {
    url: `${PLAYERS}/Mech/characters/CombatMech.glb`,
    height: HUMANOID_H,
    // The mech is rigged to the same KayKit Rig_Medium skeleton as every other
    // player class; its GLB shipped with no clips, so the full KayKit set is
    // baked in from knight.glb (scripts/bake_mech_anims.mjs); these names now
    // resolve like any other class. Lazy-loaded; see preloadMechAssets().
    clips: kaykit(['1H_Melee_Attack_Chop']),
    // Class-agnostic cosmetic body, but it still holds the wearer's equipped
    // mainhand: the shared handslot.r bone carries the grip (the mech reuses the
    // exact KayKit rig), so weaponSlots swaps attach[0] to the equipped weapon's
    // model just like every other class. The sword is only the no-weapon default.
    attach: [{ url: `${WEAPONS}/sword_1handed.glb`, bone: 'handslot.r' }],
    weaponSlots: [0],
    lazyPreload: true,
  },

  // -- female base body (PHAA-557; ship-mixed decision on PHAA-545) ---------
  // The styloo chibi female base model, registered so it loads through the
  // roster pipeline: CharacterVisual sets castShadow/receiveShadow on every
  // mesh and applyMaterials swaps in the tier-correct lit materials, fixing
  // the shadowless, lighting-ignoring read from the raw scene.add harness in
  // PHAA-550. Own rig and clip set (not KayKit Rig_Medium). Kept registered
  // standalone (the roster_compare_harness + PHAA-557 evidence reference it)
  // even though every player-facing female class below points at the same
  // outfit GLBs directly, not at this key. Lazy: no entity resolves to this
  // key, so it must not bloat every client's boot.
  chibi_female_base: {
    url: `${PLAYERS}/chibi_female.glb`,
    height: 2.29,
    clips: {
      idle: 'anim_iddle',
      walk: 'anim_walk',
      run: 'anim_run',
      attack: ['anim_attack_chop', 'anim_attack_slash'],
      cast: 'anim_cast',
      hit: ['anim_hit'],
      death: 'anim_dying',
      jump: 'anim_jump',
    },
    lazyPreload: true,
  },

  // -- female player classes (PHAA-587) ------------------------------------
  // 9 classes served from the 6 styloo chibi outfits (PHAA-585), the same
  // one-GLB-serves-several-classes trick the male roster uses (see the
  // per-class tint comment on player_priest above). All six outfits share
  // the identical 78-joint Rigify rig, 11 normalized locomotion clips, and
  // DEF-hand.R/DEF-hand.L hand bones (verified on PHAA-583). Combat clips
  // (anim_cast loop, anim_castshoot, anim_attack_chop, anim_attack_slash,
  // anim_shoot, anim_hit) are authored onto the shared rig by the PHAA-586
  // pass (scripts/phaa586_author_chibi_combat_clips.py) and baked into every
  // outfit GLB; the attack list varies per class for swing flavor.
  //
  // Held weapons (PHAA-697): each class mounts the same weapon GLBs its KayKit
  // male sibling does, on the chibi rig's `DEF-hand.R`/`DEF-hand.L` bones. The
  // KayKit `handslot.r`/`handslot.l` grip data (assets.ts KAYKIT_HAND_GRIPS /
  // VARIANT_GRIPS) is authored for a different bone frame, so the chibi bones
  // route to a parallel CHIBI_HAND_GRIPS / CHIBI_VARIANT_GRIPS table (see
  // assets.ts isChibiHandBone / applyChibiHandGrip), tuned against the offscreen
  // render rig. Layout mirrors the male roster exactly: hunter keeps its crossbow
  // (attach, no weaponSlots), the rogue dual-wields ([0, 1]), the warlock keeps a
  // fixed offhand spellbook while the wand mainhand swaps.
  //
  // Baked armor (PHAA-609 bespoke-mesh batch 1): chibi_female_knight.glb
  // already ships every armor piece as its own skinned mesh node (a plate
  // set: helmet, chest plastron, shoulder pauldrons + arm guards, a
  // waist/thigh skirt, and separate knee/shin/thigh leg plates), the same
  // T2a baked-toggle shape as the male knight's Knight_Helmet/Knight_Cape.
  // No new assets; this just wires the same `bakedArmorSlots` pattern to an
  // outfit that already had the meshes sitting unused. Every node is a
  // skinned mesh (verified via the GLB's node.skin field), so `show` is a
  // no-op for the keep-filter (it only culls non-skinned meshes) and is
  // listed purely so the baked_armor_visibility contract test passes.
  player_warrior_f: {
    url: `${PLAYERS}/chibi_female_knight.glb`,
    height: 2.29,
    clips: {
      idle: 'anim_iddle',
      walk: 'anim_walk',
      run: 'anim_run',
      attack: ['anim_attack_chop', 'anim_attack_slash'],
      cast: 'anim_cast',
      hit: ['anim_hit'],
      death: 'anim_dying',
      jump: 'anim_jump',
    },
    show: CHIBI_FEMALE_KNIGHT_ARMOR_NODES,
    bakedArmorSlots: CHIBI_FEMALE_KNIGHT_BAKED_ARMOR_SLOTS,
    attach: [{ url: `${WEAPONS}/sword_1handed.glb`, bone: 'DEF-hand.R' }],
    weaponSlots: [0],
  },
  player_paladin_f: {
    url: `${PLAYERS}/chibi_female_knight.glb`,
    height: 2.29,
    clips: {
      idle: 'anim_iddle',
      walk: 'anim_walk',
      run: 'anim_run',
      attack: ['anim_attack_chop', 'anim_attack_slash'],
      cast: 'anim_cast',
      hit: ['anim_hit'],
      death: 'anim_dying',
      jump: 'anim_jump',
    },
    show: CHIBI_FEMALE_KNIGHT_ARMOR_NODES,
    bakedArmorSlots: CHIBI_FEMALE_KNIGHT_BAKED_ARMOR_SLOTS,
    tint: 0xe8c468, // gold/white
    tintStrength: 0.4,
    attach: [{ url: `${WEAPONS}/axe_1handed.glb`, bone: 'DEF-hand.R' }],
    weaponSlots: [0],
  },
  player_hunter_f: {
    url: `${PLAYERS}/chibi_female_archer.glb`,
    height: 2.29,
    clips: {
      idle: 'anim_iddle',
      walk: 'anim_walk',
      run: 'anim_run',
      attack: ['anim_shoot'],
      cast: 'anim_cast',
      hit: ['anim_hit'],
      death: 'anim_dying',
      jump: 'anim_jump',
    },
    // Mirrors player_hunter: the crossbow is fixed (no weaponSlots), so a melee
    // weapon never replaces it.
    attach: [{ url: `${WEAPONS}/crossbow_1handed.glb`, bone: 'DEF-hand.R' }],
  },
  player_druid_f: {
    url: `${PLAYERS}/chibi_female_archer.glb`,
    height: 2.29,
    clips: {
      idle: 'anim_iddle',
      walk: 'anim_walk',
      run: 'anim_run',
      attack: ['anim_attack_chop'],
      cast: 'anim_cast',
      hit: ['anim_hit'],
      death: 'anim_dying',
      jump: 'anim_jump',
    },
    tint: 0x6b7d3f, // moss/earth
    tintStrength: 0.4,
    attach: [{ url: `${WEAPONS}/staff.glb`, bone: 'DEF-hand.R' }],
    weaponSlots: [0],
  },
  player_rogue_f: {
    url: `${PLAYERS}/chibi_female_ninja.glb`,
    height: 2.29,
    clips: {
      idle: 'anim_iddle',
      walk: 'anim_walk',
      run: 'anim_run',
      attack: ['anim_attack_slash', 'anim_attack_chop'],
      cast: 'anim_cast',
      hit: ['anim_hit'],
      death: 'anim_dying',
      jump: 'anim_jump',
    },
    // Mirrors player_rogue: dual-wield, the equipped weapon shows in BOTH hands.
    attach: [
      { url: `${WEAPONS}/dagger.glb`, bone: 'DEF-hand.R' },
      { url: `${WEAPONS}/dagger.glb`, bone: 'DEF-hand.L' },
    ],
    weaponSlots: [0, 1],
  },
  player_mage_f: {
    url: `${PLAYERS}/chibi_female.glb`,
    height: 2.29,
    clips: {
      idle: 'anim_iddle',
      walk: 'anim_walk',
      run: 'anim_run',
      attack: ['anim_castshoot'],
      cast: 'anim_cast',
      hit: ['anim_hit'],
      death: 'anim_dying',
      jump: 'anim_jump',
    },
    attach: [{ url: `${WEAPONS}/staff.glb`, bone: 'DEF-hand.R' }],
    weaponSlots: [0],
  },
  player_priest_f: {
    url: `${PLAYERS}/chibi_female.glb`,
    height: 2.29,
    clips: {
      idle: 'anim_iddle',
      walk: 'anim_walk',
      run: 'anim_run',
      attack: ['anim_castshoot'],
      cast: 'anim_cast',
      hit: ['anim_hit'],
      death: 'anim_dying',
      jump: 'anim_jump',
    },
    tint: 0xf0e9d6,
    tintStrength: 0.5,
    attach: [{ url: `${WEAPONS}/staff.glb`, bone: 'DEF-hand.R' }],
    weaponSlots: [0],
  },
  player_warlock_f: {
    url: `${PLAYERS}/chibi_female_merchant.glb`,
    height: 2.29,
    clips: {
      idle: 'anim_iddle',
      walk: 'anim_walk',
      run: 'anim_run',
      attack: ['anim_castshoot'],
      cast: 'anim_cast',
      hit: ['anim_hit'],
      death: 'anim_dying',
      jump: 'anim_jump',
    },
    tint: 0x8d5fd3,
    tintStrength: 0.45,
    // PHAA-633: the merchant outfit's `hat` mesh ships ~2x oversized and
    // floating well above the head (an authoring bug in the purchased styloo
    // pack, not a runtime scale/attach issue). Shrink and drop it onto the
    // head; tuned empirically against the offscreen render rig, see
    // scripts/phaa633_witch_hat_shot.mjs.
    skinnedMeshFix: [{ node: 'hat', scale: 0.72, position: [0, 0.66, 0] }],
    // Mirrors player_warlock: the wand mainhand swaps; the spellbook is a fixed
    // offhand. The male def anchors the book with gripRef 'Spellbook_open' (a node
    // that ships in the KayKit mage.glb); the chibi rig has no such node, so the
    // book uses an explicit hand-local offset instead (tuned on the render rig).
    attach: [
      { url: `${WEAPONS}/wand.glb`, bone: 'DEF-hand.R' },
      {
        url: `${WEAPONS}/spellbook_open.glb`,
        bone: 'DEF-hand.L',
        position: [0.02, 0.14, 0.04],
        rotationY: Math.PI,
      },
    ],
    weaponSlots: [0], // mainhand (wand) swaps; spellbook offhand stays
  },
  player_shaman_f: {
    url: `${PLAYERS}/chibi_female_basemesh.glb`,
    height: 2.29,
    clips: {
      idle: 'anim_iddle',
      walk: 'anim_walk',
      run: 'anim_run',
      attack: ['anim_attack_chop'],
      cast: 'anim_cast',
      hit: ['anim_hit'],
      death: 'anim_dying',
      jump: 'anim_jump',
    },
    tint: 0x6f8fc9,
    tintStrength: 0.4,
    attach: [{ url: `${WEAPONS}/axe_1handed.glb`, bone: 'DEF-hand.R' }],
    weaponSlots: [0],
  },

  // -- forms ---------------------------------------------------------------
  form_sheep: {
    url: `${CREATURES}/alpaca.glb`,
    height: 1.2,
    clips: animal(['Attack_Headbutt']),
  },
  form_bear: {
    url: `${CREATURES}/yetialt.glb`,
    height: 2.4,
    clips: BIPED14,
    tint: 0x5a4030,
    tintStrength: 0.55,
  },
  form_cat: {
    url: `${CREATURES}/wolf.glb`,
    height: 1.6,
    clips: animal(['Attack']),
    tint: 0xd08b45,
    tintStrength: 0.35,
  },
  // Druid Travel Form: a daft chicken-cow hybrid (custom GLB). No tint; its
  // authored cow-spots/comb/beak colours carry the look.
  form_travel: {
    url: `${CREATURES}/chicken_cow.glb`,
    height: 2.3,
    clips: CHICKEN_COW,
  },

  // -- mob families --------------------------------------------------------
  mob_wolf: {
    url: `${CREATURES}/wolf.glb`,
    height: 1.6,
    clips: animal(['Attack']),
    tint: 'entity',
    tintStrength: 0.35,
  },
  mob_boar: {
    url: `${CREATURES}/wild_boar.glb`,
    height: 1.45,
    clips: WILD_BOAR,
    tint: 'entity',
    tintStrength: 0.4,
  },
  // Quaternius animal rig (shares clip names with wolf); fox/deer/critters that
  // would otherwise fall back to mob_wolf via FAMILY_KEYS['beast'].
  mob_fox: {
    url: `${CREATURES}/fox.glb`,
    height: 1.0,
    clips: animal(['Attack']),
    tint: 'entity',
    tintStrength: 0.35,
  },
  // smaller silhouette of the same rig for ground critters (hares, badgers);
  // no dedicated rabbit/mustelid asset ships, so this is the closest small beast.
  mob_critter: {
    url: `${CREATURES}/fox.glb`,
    height: 0.7,
    clips: animal(['Attack']),
    tint: 'entity',
    tintStrength: 0.35,
  },
  mob_stag: {
    url: `${CREATURES}/stag.glb`,
    height: 1.9,
    clips: animal(['Attack_Headbutt', 'Attack']),
    tint: 'entity',
    tintStrength: 0.35,
  },
  // brown-tinted yeti rig, same recipe as the druid Bear form.
  mob_bear: {
    url: `${CREATURES}/yetialt.glb`,
    height: 2.2,
    clips: BIPED14,
    tint: 0x5a4030,
    tintStrength: 0.5,
  },
  mob_spider: {
    url: `${CREATURES}/spider.glb`,
    height: 1.4,
    clips: SPIDER,
    tint: 'entity',
    tintStrength: 0.35,
  },
  mob_murloc: {
    url: `${CREATURES}/frog.glb`,
    height: 1.7,
    clips: BIPED14,
    tint: 'entity',
    tintStrength: 0.45,
  },
  mob_kobold: {
    url: `${CREATURES}/goblin.glb`,
    height: 2.1,
    clips: ENEMY7,
    tint: 'entity',
    tintStrength: 0.2, // keep the green readable
  },
  mob_troll: {
    url: `${CREATURES}/orc.glb`,
    height: 2.4,
    // faint wash only; 0.35 flooded every material with the template green
    clips: BIPED14,
    tint: 'entity',
    tintStrength: 0.12,
  },
  mob_ogre: {
    url: `${CREATURES}/giant.glb`,
    height: 2.8,
    clips: ENEMY7,
    tint: 'entity',
    tintStrength: 0.2, // skin washes pink fast
  },
  mob_elemental: {
    url: `${CREATURES}/golelingevolved.glb`,
    height: 2.2,
    hover: 0.3,
    clips: FLOATING,
    tint: 'entity',
    tintStrength: 0.4,
  },
  mob_dragonkin: {
    url: `${CREATURES}/dragonevolved.glb`,
    height: 2.4,
    hover: 0.25,
    // light tint only; heavy washes crush the wyrm to black under the green
    // sanctum torchlight
    clips: FLOATING,
    tint: 'entity',
    tintStrength: 0.2,
  },
  // warlock demon pets (imp/voidwalker); one biped rig, the entity colour and
  // the mob template's scale tell the little orange imp from the bulky voidwalker
  mob_demon: {
    url: `${CREATURES}/demonalt.glb`,
    height: 1.8,
    clips: BIPED14,
    tint: 'entity',
    tintStrength: 0.5,
  },
  mob_demon_flying: {
    url: `${CREATURES}/demon.glb`,
    height: 1.7,
    hover: 0.35,
    clips: FLOATING,
    tint: 'entity',
    tintStrength: 0.25,
  },
  mob_demonalt: {
    url: `${CREATURES}/demonalt.glb`,
    height: 2.1,
    clips: BIPED14,
    tint: 'entity',
    tintStrength: 0.35,
  },

  // -- delve-specific variants (same rigs, colour-differentiated via mob.color) -
  delve_skel_wraith: {
    // Ledger Wraith: pale skeleton, no weapon, stronger wash reads as near-transparent
    url: `${ENEMIES}/skeleton_minion.glb`,
    height: 2.5,
    clips: skeletonClips(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']),
    tint: 'entity',
    tintStrength: 0.55,
  },
  delve_skel_ringer: {
    // Funeral Ringer: skeleton rogue rig, cloth-brown tint at mid strength
    url: `${ENEMIES}/skeleton_rogue.glb`,
    height: 2.5,
    clips: skeletonClips(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']),
    attach: [{ url: `${WEAPONS}/skeleton_axe.glb`, bone: 'handslot.r' }],
    tint: 'entity',
    tintStrength: 0.45,
  },
  delve_mob_acolyte: {
    // Gravecall Acolyte: hooded mage with hat + staff, deep dark-brown saturation
    url: `${PLAYERS}/mage.glb`,
    height: HUMANOID_H,
    clips: kaykit(['2H_Melee_Attack_Chop']),
    show: ['Mage_Hat'],
    attach: [{ url: `${WEAPONS}/staff.glb`, bone: 'handslot.r' }],
    tint: 'entity',
    tintStrength: 0.6,
  },
  delve_skel_effigy: {
    // Saintless Effigy: armoured skeleton, high stone-pale wash, reads as carved stone
    url: `${ENEMIES}/skeleton_warrior.glb`,
    height: 2.5,
    clips: skeletonClips(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']),
    attach: [
      { url: `${WEAPONS}/skeleton_blade.glb`, bone: 'handslot.r' },
      { url: `${WEAPONS}/skeleton_shield_large_a.glb`, bone: 'handslot.l' },
    ],
    tint: 'entity',
    tintStrength: 0.65,
  },
  delve_skel_varric: {
    // Deacon Varric: boss mage rig with Taunt flourish on pull
    url: `${ENEMIES}/skeleton_mage.glb`,
    height: 2.5,
    clips: skeletonClips(['2H_Melee_Attack_Chop'], 'Taunt'),
    attach: [{ url: `${WEAPONS}/skeleton_staff.glb`, bone: 'handslot.r' }],
    tint: 'entity',
    tintStrength: 0.35,
  },

  // -- undead (KayKit skeletons, shared 41-joint rig) ------------------------
  skel_minion: {
    url: `${ENEMIES}/skeleton_minion.glb`,
    height: 2.5,
    clips: skeletonClips(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']),
    tint: 'entity',
    tintStrength: 0.25,
  },
  skel_warrior: {
    url: `${ENEMIES}/skeleton_warrior.glb`,
    height: 2.5,
    clips: skeletonClips(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']),
    tint: 'entity',
    tintStrength: 0.25,
  },
  skel_rogue: {
    url: `${ENEMIES}/skeleton_rogue.glb`,
    height: 2.5,
    clips: skeletonClips(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']),
    tint: 'entity',
    tintStrength: 0.25,
  },
  skel_mage: {
    url: `${ENEMIES}/skeleton_mage.glb`,
    height: 2.5,
    clips: skeletonClips(['2H_Melee_Attack_Chop']),
    attach: [{ url: `${WEAPONS}/skeleton_staff.glb`, bone: 'handslot.r' }],
    tint: 'entity',
    tintStrength: 0.25,
  },
  skel_boss: {
    url: `${ENEMIES}/skeleton_mage.glb`,
    height: 2.5,
    clips: skeletonClips(['2H_Melee_Attack_Chop'], 'Taunt'),
    attach: [{ url: `${WEAPONS}/skeleton_staff.glb`, bone: 'handslot.r' }],
    tint: 'entity',
    tintStrength: 0.25,
  },
  skel_necromancer: {
    url: `${ENEMIES}/necromancer.glb`,
    height: 2.5,
    clips: skeletonClips(['2H_Melee_Attack_Chop']),
    tint: 'entity',
    tintStrength: 0.25,
  },
  skel_golem: {
    url: `${ENEMIES}/skeleton_golem.glb`,
    height: 3.4,
    clips: skeletonLargeClips(['2H_Melee_Attack_Chop', '1H_Melee_Attack_Chop']),
    // the baked golem axe ships without the 180° grip flip the rig expects, so
    // the blade faces backwards; spin it about its handle (local Y) to face out.
    weaponFix: [{ node: 'Skeleton_Golem_Axe', rotY: Math.PI }],
    tint: 'entity',
    tintStrength: 0.25,
  },

  // -- humanoid mobs (KayKit adventurers) ------------------------------------
  mob_bandit: {
    url: `${PLAYERS}/rogue_hooded.glb`,
    height: HUMANOID_H,
    clips: kaykit(['1H_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Chop']),
    // v2 rogue_hooded ships the hood/mask/cape as its default look (no show
    // filter needed); the knives are attached dual-wield from the weapon files
    attach: [
      { url: `${WEAPONS}/dagger.glb`, bone: 'handslot.r' },
      { url: `${WEAPONS}/dagger.glb`, bone: 'handslot.l' },
    ],
    // fixed outlaw leather; entity tints (faction greens) read as friendly
    // villagers; the dark red-brown keeps the hooded silhouette hostile
    tint: 0x6b3a32,
    tintStrength: 0.3,
  },
  mob_dark_caster: {
    url: `${PLAYERS}/mage.glb`,
    height: HUMANOID_H,
    clips: kaykit(['2H_Melee_Attack_Chop']),
    show: ['Mage_Hat'],
    attach: [{ url: `${WEAPONS}/staff.glb`, bone: 'handslot.r' }],
    tint: 'entity',
    tintStrength: 0.5,
  },
  mob_bruiser: {
    url: `${PLAYERS}/barbarian.glb`,
    height: HUMANOID_H,
    clips: kaykit(['2H_Melee_Attack_Chop']),
    show: ['Barbarian_BearHat'], // v2 barbarian: Hat→BearHat, no Cape, weapon now attached
    attach: [{ url: `${WEAPONS}/axe_2handed.glb`, bone: 'handslot.r' }],
    tint: 'entity',
    tintStrength: 0.3,
  },

  // -- NPCs ------------------------------------------------------------------
  npc_knight: {
    url: `${PLAYERS}/knight.glb`,
    height: HUMANOID_H,
    clips: kaykit(['1H_Melee_Attack_Chop']),
    show: ['Knight_Helmet', 'Knight_Cape'],
    attach: [{ url: `${WEAPONS}/sword_1handed.glb`, bone: 'handslot.r' }],
  },
  npc_mage: {
    url: `${PLAYERS}/mage.glb`,
    height: HUMANOID_H,
    clips: kaykit(['2H_Melee_Attack_Chop']),
    show: [],
    attach: [{ url: `${WEAPONS}/staff.glb`, bone: 'handslot.r' }],
    tint: 0xc9b98a,
    tintStrength: 0.3, // brown-robed brothers of the chapel
  },
  // Brother Aldric keeps his pre-v0.7 model (the old chars/mage.glb, restored as
  // mage_classic.glb with the staff built into the mesh). Aldric-only; every
  // other npc_mage uses the new KayKit full-pack model from #396.
  npc_aldric: {
    url: `${PLAYERS}/mage_classic.glb`,
    height: HUMANOID_H,
    clips: kaykit(['2H_Melee_Attack_Chop']),
    show: ['2H_Staff'],
    tint: 0xc9b98a,
    tintStrength: 0.3,
  },
  npc_smith: {
    url: `${PLAYERS}/barbarian.glb`,
    height: HUMANOID_H,
    clips: kaykit(['1H_Melee_Attack_Chop']),
    show: [],
    attach: [{ url: `${WEAPONS}/axe_1handed.glb`, bone: 'handslot.r' }],
  },
  npc_scout: {
    url: `${PLAYERS}/rogue.glb`,
    height: HUMANOID_H,
    clips: kaykit(['2H_Ranged_Shoot']),
    show: ['Rogue_Cape'],
    attach: [{ url: `${WEAPONS}/crossbow_1handed.glb`, bone: 'handslot.r' }],
  },
  npc_villager: {
    url: `${PLAYERS}/rogue.glb`,
    height: HUMANOID_H,
    clips: kaykit(['1H_Melee_Attack_Chop']),
    show: [],
    tint: 'entity',
    tintStrength: 0.35,
  },
  npc_villager_robed: {
    url: `${PLAYERS}/mage.glb`,
    height: HUMANOID_H,
    clips: kaykit(['2H_Melee_Attack_Chop']),
    show: [],
    tint: 'entity',
    tintStrength: 0.35,
  },
  // Brother Halven, the Reliquary Keeper: a devout male guardian tending the crypt
  // door. Uses the KayKit paladin, one of the newer full-pack adventurer models
  // (unused elsewhere), for a sturdier, holier silhouette than the old hooded
  // rogue. Ships its accessories (helm/cape/shield) by default (no show filter).
  npc_reliquary_keeper: {
    url: `${PLAYERS}/paladin.glb`,
    height: HUMANOID_H,
    clips: kaykit(['1H_Melee_Attack_Chop']),
  },

  // The Hollow's hero-quality prophet cast (PHAA-413 base meshes, Board-confirmed
  // direction; PHAA-414 material/shader coating pass: every surface material carries
  // a small baked grain texture in the hub's warm root-and-soil register instead of
  // a flat factor, glossy-clean materials (eyes, beaks, the lantern glass) excepted
  // on purpose). Fully procedural Blender builds, no purchased assets, no armature
  // yet, so every clip name below is a placeholder that matches nothing in the GLB;
  // each simply holds its authored pose. Swap `clips` for a real ClipMap once a
  // rigged export lands.
  npc_greenpaw: {
    url: `${NPCS}/greenpaw.glb`,
    height: 2.29,
    clips: {
      idle: 'Idle',
      walk: 'Idle',
      run: 'Idle',
      attack: ['Idle'],
      death: 'Idle',
    },
  },
  // Verger Zebediah and Sexton Faddick: textured hero models from the PHAA-413/414
  // prophet-cast pass. Placed as sim NPCs in the Hollow Reaches starter zone
  // (src/sim/content/hollow_zone.ts, PHAA-420); see the NPC_KEYS entries below.
  // Zebediah's height bumped 25% (Board follow-up, PHAA-483): the base build read
  // tiny next to a player; 2.56 lands just under HUMANOID_H (2.6) for parity.
  npc_zebediah: {
    url: `${NPCS}/zebediah.glb`,
    height: 2.56,
    clips: {
      idle: 'Idle',
      walk: 'Idle',
      run: 'Idle',
      attack: ['Idle'],
      death: 'Idle',
    },
  },
  npc_faddick: {
    url: `${NPCS}/faddick.glb`,
    height: 1.3,
    clips: {
      idle: 'Idle',
      walk: 'Idle',
      run: 'Idle',
      attack: ['Idle'],
      death: 'Idle',
    },
  },
  // Sister Shade (PHAA-636 bespoke wardrobe pass): a Blender edit of the
  // styloo merchant source (the plainest civilian silhouette in the female
  // roster), not the stock GLB with a runtime tint. The merchant's wide hat
  // is reshaped into a headscarf, a duplicated/recolored front chemise panel
  // becomes an apron, and a small satchel + willow-leaf hem motifs are added
  // (see docs/design/shade-questline.md). Earth tones (sage headscarf, warm
  // brown apron/satchel, muted olive pants) are baked into the garment
  // materials now, so no runtime tint is applied here (it would also wash
  // out her skin/hair/eyes). She must read as an ordinary woman doing
  // chores, so no show-list gear and no held prop; the watering can needs
  // the chibi grip/attach foundation (PHAA-583 follow-up) and stays future
  // work.
  npc_shade: {
    url: `${NPCS}/shade.glb`,
    height: 2.29,
    clips: {
      idle: 'anim_iddle',
      walk: 'anim_walk',
      run: 'anim_run',
      attack: ['anim_push'],
      death: 'anim_dying',
      jump: 'anim_jump',
    },
  },
};

// ---------------------------------------------------------------------------
// Dispatch: entity -> visual key (mirrors the old buildRigFor selection:
// e.kind + e.templateId + MOBS[id].family)
// ---------------------------------------------------------------------------

const MOB_KEYS: Record<string, string> = {
  imp: 'mob_demon',
  voidwalker: 'mob_demon',
  succubus: 'mob_demon',
  warlock_imp: 'mob_demon_flying',
  warlock_voidwalker: 'mob_demonalt',
  wild_boar: 'mob_boar',
  // beasts that would otherwise fall back to the wolf model (FAMILY_KEYS.beast)
  old_cragmaw: 'mob_bear',
  bog_bloat: 'mob_murloc',
  // gravecaller cult + necromancers: dark-robed casters
  gravecaller_cultist: 'mob_dark_caster',
  gravecaller_summoner: 'mob_dark_caster',
  sister_nhalia: 'mob_dark_caster',
  deacon_voss: 'mob_dark_caster',
  wyrmcult_necromancer: 'mob_dark_caster',
  vael_the_mistcaller: 'mob_dark_caster',
  grand_necromancer_velkhar: 'mob_dark_caster',
  gorrak: 'mob_bruiser',
  mogger: 'mob_bruiser',
  // undead variants by role
  boneclad_revenant: 'skel_warrior',
  marrowlord_varkas: 'skel_warrior',
  bastion_revenant: 'skel_warrior',
  knight_commander_olen: 'skel_warrior',
  sanctum_boneguard: 'skel_warrior',
  nythraxis_scourge_of_thornpeak: 'skel_golem',
  nythraxis_skeleton_warrior: 'skel_warrior',
  brother_aldric_raid: 'npc_aldric',
  hollow_acolyte: 'skel_mage',
  sexton_marrow: 'skel_mage',
  morthen: 'skel_boss',
  crypt_shambler: 'skel_rogue',
  // delve enemies
  reliquary_ledger_wraith: 'delve_skel_wraith',
  reliquary_funeral_ringer: 'delve_skel_ringer',
  reliquary_gravecall_acolyte: 'delve_mob_acolyte',
  reliquary_saintless_effigy: 'delve_skel_effigy',
  deacon_varric: 'delve_skel_varric',
  fallen_captain_aldren: 'skel_warrior',
  corrupted_priest_malric: 'skel_necromancer',
  deathstalker_voss: 'skel_rogue',
  vision_aldren_warrior: 'player_warrior',
  vision_malric_mage: 'player_mage',
  vision_deathstalker_voss: 'player_rogue',
};

const FAMILY_KEYS: Record<string, string> = {
  beast: 'mob_wolf',
  humanoid: 'mob_bandit',
  murloc: 'mob_murloc',
  spider: 'mob_spider',
  kobold: 'mob_kobold',
  undead: 'skel_minion',
  troll: 'mob_troll',
  ogre: 'mob_ogre',
  elemental: 'mob_elemental',
  dragonkin: 'mob_dragonkin',
  demon: 'mob_demonalt',
};

const NPC_KEYS: Record<string, string> = {
  marshal_redbrook: 'npc_knight',
  warden_fenwick: 'npc_knight',
  captain_thessaly: 'npc_knight',
  loremaster_caddis: 'npc_mage',
  smith_haldren: 'npc_smith',
  armorer_hode: 'npc_smith',
  foreman_odell: 'npc_smith',
  scout_maren: 'npc_scout',
  scout_maren_highwatch: 'npc_scout',
  apothecary_lin: 'npc_villager_robed',
  herbalist_yara: 'npc_villager_robed',
  trader_wilkes: 'npc_villager',
  fisherman_brandt: 'npc_villager',
  provisioner_hale: 'npc_villager',
  quartermaster_bree: 'npc_villager',
  brother_halven: 'npc_reliquary_keeper',
  brother_greenpaw: 'npc_greenpaw',
  verger_zebediah: 'npc_zebediah',
  sexton_faddick: 'npc_faddick',
  shade: 'npc_shade',
};

export function visualKeyFor(e: Entity): string {
  if (e.kind === 'player') {
    if (e.skinCatalog === 'mech') return 'player_mech';
    // PHAA-501: female characters prefer the `player_<cls>_f` variant when the
    // manifest ships one; all 9 classes register one as of PHAA-587. The
    // fallback to the male key only matters for a class that somehow loses
    // its `_f` def (or a future new class added without one yet).
    const base = `player_${e.templateId}`;
    if (e.sex === 'f' && VISUALS[`${base}_f`]) return `${base}_f`;
    return VISUALS[base] ? base : 'player_warrior';
  }
  if (e.kind === 'mob') {
    const override = MOB_KEYS[e.templateId];
    if (override) return override;
    const family = MOBS[e.templateId]?.family;
    return (family && FAMILY_KEYS[family]) || 'mob_bandit';
  }
  // npcs; Brother Aldric recurs in every hub under suffixed ids
  if (e.templateId.startsWith('brother_aldric')) return 'npc_aldric';
  return NPC_KEYS[e.templateId] ?? 'npc_villager';
}

/** Held-weapon layout override for the class-agnostic Combat Mech body. The mech
 *  keeps its own model and clips but adopts the WEARER class's hand layout, so a
 *  dual-wield class (the rogue) shows the equipped weapon in BOTH hands on the mech
 *  (it shares the KayKit handslot.r/.l bones). Non-dual classes return null and keep
 *  the mech's own single-mainhand default. Host-agnostic: the wearer's class arrives
 *  as a player entity's templateId, so this applies the same offline and online. */
export function mechHeldWeaponOverride(cls: PlayerClass): WeaponLayoutOverride | null {
  const classDef = VISUALS[`player_${cls}`];
  if (!classDef || (classDef.weaponSlots?.length ?? 0) < 2) return null;
  return { attach: classDef.attach, weaponSlots: classDef.weaponSlots };
}

/** Every glb the manifest can reference (for preloading). */
export function manifestUrls(): string[] {
  const urls = new Set<string>();
  for (const def of Object.values(VISUALS)) {
    if (def.lazyPreload) continue; // fetched on demand, not at boot
    urls.add(def.url);
    for (const url of def.animUrls ?? []) urls.add(url);
    for (const a of def.attach ?? []) urls.add(a.url);
  }
  // Equipped-weapon models a player may swap to at runtime (any nearby player's
  // gear), so they are resolved-and-ready when setWeapon attaches them.
  for (const url of itemWeaponModelUrls()) urls.add(url);
  // Equipped-armor models a player may swap to at runtime (PHAA-502 T2a authors
  // these; T1 ships the preloader so the resolution path is identical to weapons).
  for (const url of itemArmorModelUrls()) urls.add(url);
  return [...urls];
}

export function visualAssetUrlForGraphics(url: string, standardMaterials: boolean): string {
  return standardMaterials ? url : (LOW_URL_ALIAS[url] ?? url);
}

export function manifestUrlsForGraphics(standardMaterials: boolean): string[] {
  return [
    ...new Set(manifestUrls().map((url) => visualAssetUrlForGraphics(url, standardMaterials))),
  ];
}

/**
 * The character/weapon GLB URLs to PRELOAD, given the graphics tier guessed when
 * assets.ts was first imported. This MUST be tier-INDEPENDENT (a superset of every
 * tier's placement set).
 *
 * Character placement resolves asset URLs against the LIVE GFX tier through
 * assetUrl()/visualAssetUrlForGraphics, and resolvedGltf() throws "character asset not
 * preloaded" synchronously when the resolved URL was never loaded. The live tier is
 * set by initGfxTier() inside the Renderer constructor, AFTER assets.ts froze its
 * import-time GFX best-guess. On low gfx, LOW_URL_ALIAS swaps one body GLB
 * (rogue_hooded.glb -> rogue.glb), so manifestUrlsForGraphics(false) is a STRICT
 * subset of manifestUrlsForGraphics(true). If the import-time guess is low but the
 * renderer resolves medium+, the very common mob_bandit body (rogue_hooded.glb, the
 * humanoid-family default AND the global mob fallback) is placed yet was never
 * preloaded, crashing world entry: the character-side twin of the v0.16.0 props P0.
 * So preload the UNION across both tiers, exactly as foliage.ts is immune by sourcing
 * one frozen list for both preload and placement.
 *
 * The arg is retained to document the invariant and to let the guard test assert it at
 * the lowest (most dangerous) import tier; the result intentionally ignores it.
 */
export function characterPreloadUrls(_importTierStandardMaterials: boolean): string[] {
  return [...new Set([...manifestUrlsForGraphics(true), ...manifestUrlsForGraphics(false)])];
}

export function visibleAttachmentsForGraphics(
  def: Pick<VisualDef, 'attach'>,
): readonly AttachDef[] {
  return def.attach ?? [];
}

const bakedArmorNodeNamesByUrl = new Map<string, ReadonlySet<string>>();

/** Union of every node name gated by ANY VisualDef's `bakedArmorSlots` that
 *  shares this GLB url (several defs can point at one url, e.g. player_warrior_f
 *  and player_paladin_f both use chibi_female_knight.glb). PHAA-653: the
 *  per-url merge cache (assets.ts optimizedScene) must never fuse one of these
 *  nodes into a body mesh, or its runtime visibility toggle silently stops
 *  finding it by name and it gets stuck visible. */
export function bakedArmorNodeNamesForUrl(url: string): ReadonlySet<string> {
  const hit = bakedArmorNodeNamesByUrl.get(url);
  if (hit) return hit;
  const names = new Set<string>();
  for (const def of Object.values(VISUALS)) {
    if (def.url !== url || !def.bakedArmorSlots) continue;
    for (const node of Object.keys(def.bakedArmorSlots)) names.add(node);
  }
  bakedArmorNodeNamesByUrl.set(url, names);
  return names;
}
