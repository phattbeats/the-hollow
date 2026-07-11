# Female chibi rig: armor coverage sourcing dossier (PHAA-605 / PHAA-502 T2c)

Status: BLOCKED. This document is the de-risking hand-off for T2c (female armor
visuals) so that when the two upstream blockers clear, whoever picks it up starts
from a verified path instead of re-discovering the rig realities. It is a design
note, not an implementation; no runtime code changes ship with it.

Verified against `main` at the T1 merge (`c3aa452eb`, PHAA-602 armor plumbing #171)
plus the female roster on `main` (PHAA-587 `player_<class>_f` VisualDefs).

## What T2c is

Parent PHAA-502 rev-5 plan, tier T2c: extend the armor render coverage to the nine
female chibi bodies, reusing the T2b (PHAA-604) male meshes, retargeting through the
Blender MCP pipeline where proportions differ.

## The T1 contract a body must satisfy to show armor

T1 (PHAA-602, now on `main`) is rig-agnostic plumbing. For a VisualDef to render
equipped armor, `setEquippedArmor` (`src/render/characters/assets.ts`) requires, per
wearing body:

1. `armorSlots: number[]` on the VisualDef (indices into `attach`).
2. An `attach[i]` entry per slot (the class-default armor GLB for that bone).
3. `armorByAttachIndex: Record<number, EquipSlot>` mapping each slot index to
   `helmet` / `chest` / `legs`.
4. A per-item mesh registered in `ITEM_ARMOR_VARIANTS` (`src/ui/armor_variants.ts`,
   currently `{}`) plus `public/models/armor/<key>.glb` and `public/ui/armor/<key>.png`.

`setEquippedArmor` then, per slot, resolves `att.bone` via `resolveBone(root, ...)`
and hangs the mesh with `attachProp(..., SWAP_ARMOR_TAG)`. Armor is a **rigid,
grip-agnostic single-bone prop**: the swap comment in assets.ts states armor GLBs
"hang at their authored origin under a body bone and are grip-agnostic." There is no
grip-alignment step for armor (unlike weapons, which run `KAYKIT_HAND_GRIPS`). The
mesh sits exactly where its own origin places it relative to the resolved bone's
rest transform. That single fact drives every finding below.

## Finding 1: the female rig has NO attach foundation at all (hard blocker)

The nine `player_<class>_f` VisualDefs (`src/render/characters/manifest.ts`, the
"female player classes (PHAA-587)" block) carry `url`, `height: 2.29`, `clips`, and
a `tint` only. They have no `attach`, no `weaponSlots`, and no `armorSlots`. The
`chibi_female_base` comment (manifest.ts, immediately above the roster) records why:
the chibi outfits share a 78-joint Rigify rig whose hand bones are `DEF-hand.R` /
`DEF-hand.L`, which match none of the KayKit `handslot.r`/`handslot.l` pattern data
the grip system keys off (`isHandslotBone` / `KAYKIT_HAND_GRIPS` / `VARIANT_GRIPS`).
The roster ships with no held weapons for exactly this reason, and the comment flags
a "Blender-authored chibi grip table" as follow-up work owned by PHAA-583.

Armor attach shares that same missing foundation. Before any `armorSlots` can be
wired on a female body we need, on the chibi rig:

- the actual DEF- bone names that serve helmet / chest / legs, confirmed to resolve
  through `resolveBone` (it tries sanitized names, so the exact export-cased name
  matters), and
- a decision on the rest transform each armor mesh is authored against, because the
  rig is Rigify DEF- bones at a 2.29 height, not KayKit `Rig_Medium`.

That is PHAA-583 scope (the female-rig attach/bone foundation). Until it lands, T2c
has nothing to attach to. This is the primary blocker, and it is deeper than "reuse
the male meshes": there is no bone contract on the female rig yet.

## Finding 2: the T2b male meshes are not drop-in; they need per-mesh retarget

Because armor is a rigid prop hung at its authored origin under a body bone, a mesh
authored to the KayKit `Rig_Medium` chest/leg bone rest transforms and male torso
proportions will not sit correctly on the chibi female chest/leg bones (different
bone rest positions, different 2.29-height chibi proportions, exaggerated silhouette).
Every T2b mesh that touches the torso or legs must be re-authored / retargeted to the
female rest pose in Blender. Helm is the least sensitive (head bone, small offset);
chest and legs are the sensitive cases. This matches the task's own "retarget where
proportions differ" wording, but the practical reality is that chest and legs are
close to full re-authoring, not a transform tweak.

Prerequisite: the T2b meshes must actually exist first. `ITEM_ARMOR_VARIANTS` is `{}`
on `main`; no armor mesh (male or female) is wired yet. PHAA-604 (T2b) is itself
BLOCKED on the board attach-vs-baked decision (interaction 9b5cf832) and the T2a
merge, so there is nothing to retarget until it produces meshes.

## Finding 3: the run-cycle leg-clip risk applies to the female rig too, likely worse

The PHAA-604 finding that a rigid single-bone leg prop clips through the knee bend on
the run cycle applies identically here, because T2c uses the same rigid `attachProp`
path. The chibi rig's exaggerated proportions and different leg chain make this no
better and plausibly worse. Whatever the board decides for T2b legs (two-bone split
attach, or the T2a baked `.visible`-swap approach) must be settled before T2c legs can
be authored, since it changes the authoring target entirely. T2c should not pick its
own answer here; it inherits the T2b decision (interaction 9b5cf832).

## Finding 4: the baked-accessory (T2a) alternative does not transfer for free

If the studio routes armor through the T2a baked-visibility approach (PHAA-603:
gating named meshes already inside the body GLB via `bakedArmorSlots`), the female
bodies need their own per-GLB mesh-name audit. T2a maps names in the KayKit knight
GLB (`Knight_Helmet`, `Knight_HelmetVisor`, `Cape`, ...). The chibi female GLBs
(`chibi_female_knight.glb`, `_archer`, `_ninja`, `_merchant`, `_basemesh`,
`chibi_female.glb`) are the styloo outfits with entirely different mesh names and
baked-in outfit geometry. A baked route means auditing each of the six female GLBs
for toggleable armor meshes (many outfits bake the armor into the body mesh with no
separable node, which would rule the baked route out for those bodies). This is a
distinct investigation from the male baked mapping.

## Recommended sequence once unblocked

1. PHAA-583 lands the female-rig attach/bone foundation (bone names + rest-transform
   convention + a smoke attach). Owner: the 585-588 asset/wiring chain, then QA sign-off.
2. Board resolves the T2b attach-vs-baked decision (interaction 9b5cf832). This
   governs T2c's authoring target.
3. PHAA-604 produces the male meshes + `ITEM_ARMOR_VARIANTS` entries.
4. T2c de-risk v1: retarget the single least-sensitive slot (helm, tier 1) onto ONE
   female body (`player_warrior_f`), wire `armorSlots`/`armorByAttachIndex`/`attach`,
   add the `ITEM_ARMOR_VARIANTS` entry, and verify in the browserless shot harness
   before fanning out to chest, legs, and the remaining eight bodies.

## Blockers

- PHAA-583: female-rig attach/bone foundation (BLOCKED on the 585-588 child chain).
  This is the hard blocker; T2c has no bone contract to attach to without it.
- PHAA-604 (T2b): male armor meshes must exist to retarget, and its attach-vs-baked
  decision (interaction 9b5cf832, owner Brandon) sets T2c's authoring target.
