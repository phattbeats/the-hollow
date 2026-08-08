# PHAA-609 (PHAA-502 T2b): male + female per-slot armor mesh sourcing and authoring plan

Status: T1 (#171) and T2a (#179) are merged to main. T2b batch 0 (PR #193, the
asset-search track: `helm_plate`/`chest_cape`/`legs_plate` extracted from the
vendored KayKit knight pack) is merged, but its `ITEM_ARMOR_VARIANTS` wiring is
still deferred (see "Decision: chest/legs attach approach" below, now resolved).
T2b batch 1 (this PR) is a zero-new-asset discovery: `paladin.glb` and
`chibi_female_knight.glb` already ship separable, skinned per-slot armor mesh
nodes that nothing had wired to `bakedArmorSlots` yet -- the same T2a
baked-toggle pattern proven on `player_warrior`'s `Knight_Helmet`/`Knight_Cape`.
Wired here for `player_paladin` (male, cape only -- `paladin.glb` has no
separate head mesh, so `Paladin_Helmet` stays ungated to avoid rendering an
unhelmed paladin headless, confirmed via render screenshot) and
`player_warrior_f` / `player_paladin_f` (female, full plate set, first-ever
female armor visuals). Batch 2+ (bespoke Blender authoring for the 7 classes
per sex with no built-in armor meshes) is scoped below and filed as follow-up
issues.

This is the dual-track (asset search, then Blender-author the gaps) sourcing
dossier for per-slot armor meshes (chest / legs / helm, per tier) on the male
chibi roster, which rides the KayKit `Rig_Medium` skeleton. It records what the
free-license asset search actually turned up, the one load-bearing technical
constraint in the T1 render path, and a concrete authoring spec for the first
tier so the Blender work can start against a fixed target.

## What T1 gives us (the target contract)

T1 (PHAA-602, PR #171) shipped the rig-agnostic plumbing, all still in review:

- `ITEM_ARMOR_VARIANTS` (`src/ui/armor_variants.ts`): item id -> armor variant
  key. Deliberately empty; T2b adds the real mappings. Keys resolve to
  `public/models/armor/<key>.glb` (worn 3D) and `public/ui/armor/<key>.png` (bag
  icon), so worn armor always matches its inventory icon.
- `VisualDef.armorSlots: number[]` + `VisualDef.armorByAttachIndex: Record<number,
  EquipSlot>` (`src/render/characters/manifest.ts`): the listed `attach` indices
  whose model is swapped for the entity's equipped armor, and which `EquipSlot`
  each serves.
- `setEquippedArmor(root, def, armorByItemId)` (`src/render/characters/assets.ts`)
  -> `CharacterVisual.setArmor` (`visual.ts`), called per frame by the renderer
  on `e.equippedItems` diffs.

So T2b's deliverable is, per slot/tier: a `models/armor/<key>.glb`, a matching
`ui/armor/<key>.png`, an `ITEM_ARMOR_VARIANTS` entry, and (for whichever roster
bodies wear it) an `attach` entry plus `armorSlots` / `armorByAttachIndex`
wiring on that body's `VisualDef`.

## Constraint that shapes everything: T1 armor attach is RIGID, per bone

`setEquippedArmor` resolves one bone and calls `attachProp(root, bone, att,
SWAP_ARMOR_TAG)` -- the exact rigid single-bone attachment weapons use. It does
NOT add a skinned mesh bound to the whole skeleton. Consequences per slot:

- **Helm: fine.** The head is effectively one rigid bone; a helm parented to it
  tracks perfectly. This is the unambiguous, no-decision-needed slot.
- **Chest: usually acceptable on this stylized low-poly body.** The torso barely
  deforms between hip and shoulder during locomotion, and a chest shell authored
  to the spine bone's local space reads fine at chibi scale (this is how KayKit's
  own modular kits attach torso pieces). Some clipping at extreme attack poses.
- **Legs: risky as a rigid prop.** Knees bend on the walk/run cycle; a single
  rigid greave attached to one leg bone clips through the shin/thigh on every
  stride. Doing legs "right" wants either a per-bone split (upper + lower leg,
  two attach points) or the T2a baked-mesh `.visible`-swap approach instead of
  rigid attach.

This is a real fork, not a detail: the approved plan (rev 5) says "per-slot
meshes (chest/legs/helm)" without specifying attach vs baked-swap, and the two
approaches have very different authoring cost and per-body wiring.

## Track 1 (asset search): result

Searched the license-clean free sources named in the plan (CC0 / CC-BY: Kenney,
KayKit free tiers, Quaternius, Poly Pizza) for per-slot armor that fits chibi
proportions on `Rig_Medium`:

- **KayKit "Adventurers"** (the pack the roster bodies come from): armor is
  BAKED into each character (knight = full plate + helmet + cape; that is what
  T2a toggles). It does NOT ship detachable per-slot armor GLBs. `public/models/
  armor/` is empty; no modular armor set is vendored.
- **KayKit "Skeletons" / "Dungeon" free packs**: include modular-ish equipment,
  but rigged to their own skeletons, not `Rig_Medium`, and proportioned for the
  taller skeleton body, not the chibi.
- **Quaternius modular characters, Kenney characters, Poly Pizza**: usable source
  geometry (shields, helmets, simple cuirasses) but all on foreign rigs / scales.

Conclusion: there is **no drop-in per-slot pack pre-fit to this skeleton**. Per
the task's own pipeline wording, every sourced mesh has to be normalized through
Blender anyway (retarget, scale, attach-point cleanup, GLB re-export). So track 1
does not stand alone here; it supplies raw geometry that track 2 (Blender)
finishes. The bulk of T2b is Blender-authoring, with asset search as a
head-start on shapes, not a shortcut around it. Any mesh we do adopt gets its
license recorded in `CREDITS.md` in the same PR; no paid packs.

## Track 2 (Blender) authoring spec -- first tier

Proven pipeline: Blender MCP -> GLB export (recipe used on PHAA-585..588; see the
`hollow-blender-glb-export` note). Target for a v1 slice, lowest render risk:

1. **helm_iron** (helm slot, tier 1): a simple open iron cap. Attach to the head
   bone via a new `attach` entry on each male body's `VisualDef`, added to
   `armorSlots` with `armorByAttachIndex: { <i>: 'helmet' }`. GLB
   `models/armor/helm_iron.glb`, icon `ui/armor/helm_iron.png`,
   `ITEM_ARMOR_VARIANTS['iron_helm'] = 'helm_iron'`.
2. Verify in the browserless harness (idle + run + attack) that the cap tracks
   the head with no clipping across the animation set, then expand to chest.

The helm slice is buildable today with zero design ambiguity and de-risks the
whole render path end to end (author -> manifest -> media-manifest build ->
`setEquippedArmor` -> screenshot). Chest and legs follow the board's approach
decision.

## Decision: chest/legs attach approach (resolved this PR)

Rigid single-bone `attach` (the T1 `armorSlots` path) and the T2a baked-mesh
`.visible` toggle (`bakedArmorSlots`) are **not composable on the same slot of
the same class**: `bakedArmorSlots` flips visibility on a mesh already baked
into the class GLB, while `armorSlots` parents a *separate* item-specific GLB
under a bone. Wiring both to the same `EquipSlot` on one class would double-
render (e.g. the knight's own helmet dome plus a standalone iron helm prop).
So the split is by class, not by slot:

- **Classes with built-in separable armor meshes** (`player_warrior`,
  `player_paladin`, `player_warrior_f`, `player_paladin_f` as of this PR):
  `bakedArmorSlots` only. Any item in the gating slot reveals the class's own
  armor look; item-to-item visual variety on these classes is a v2 concern
  (per-tier reskins of the same baked mesh via `applyMaterials`, not new GLBs).
- **Classes with no built-in armor mesh** (the other 7 per sex): the T2b
  standalone-attach GLBs (`helm_plate`, `chest_cape`, ...). **Helm and chest
  only** -- both proven safe as a rigid single-bone prop (see above). **Legs
  stays off the rigid-attach path**: a full-length rigid greave clips on the
  run cycle every stride, and a two-bone skinned split is new render-plumbing
  scope, not an asset-authoring task. The mitigation is on the art side
  instead: author leg pieces as a short hip-to-mid-thigh guard (tassets, not a
  full greave) so there's no low-leg geometry to cross the knee joint. This
  keeps legs on the existing rigid-attach path with the same authoring cost as
  helm/chest, at the cost of a lighter-coverage leg silhouette than plate boots
  would give; a full greave is back on the table if/when a skinned two-bone
  attach lands.
- **`helm_plate`/`chest_cape` are plate-styled** (extracted from the knight
  pack) and read right on the two remaining plate-adjacent classes
  (`player_hunter`/ranger armor, `player_shaman` heavy sets) but not on the
  cloth casters (`mage`/`priest`/`warlock`) or the leather rogue/druid --
  putting a knight's iron dome and cape on a robed mage is a genuine visual
  mismatch, not a wiring question. **Flagged for Brandon, not decided here**:
  either ship `helm_plate`/`chest_cape` on the plate-adjacent classes only and
  Blender-author cloth/leather equivalents for the rest (batch 2), or treat
  `helm_plate`/`chest_cape` purely as a tier-1 placeholder for every non-baked
  class until batch 2 lands real per-archetype looks.

## Batch 2 (follow-up, filed as child issues): bespoke Blender authoring

The remaining classes with zero armor mesh coverage need real new geometry,
not reused/retoggled assets:

- **Male** (5 classes once `helm_plate`/`chest_cape` cover hunter/shaman per
  the note above): `player_rogue`, `player_mage`, `player_priest`,
  `player_warlock`, `player_druid` -- leather (rogue/druid) and cloth
  (mage/priest/warlock) helm + chest, Blender-authored via the proven
  `bmcp` pipeline (`10.0.0.100:9876`, recipe in `hollow-blender-glb-export`
  memory / PHAA-585..588), rigid-attached at `head`/`chest` on the shared
  `Rig_Medium` bones.
- **Female** (7 classes: everyone but `warrior_f`/`paladin_f`): none of
  `chibi_female_archer.glb`, `chibi_female_merchant.glb`,
  `chibi_female_ninja.glb`, `chibi_female.glb`, `chibi_female_basemesh.glb`
  have separable armor nodes (checked this PR), so there is no baked-toggle
  shortcut left for female -- every remaining female class needs either (a) a
  Blender-authored standalone attach GLB rigid-attached at the female rig's
  `head` bone (helm only; the PHAA-583 hand-grip mismatch was specific to
  weapon grips, `head` is a normal bone on the shared 78-joint Rigify rig and
  untested but plausible for a helm-only rigid attach), or (b) new baked-in
  armor meshes added directly to each outfit GLB in Blender (matches the
  knight outfit's existing pattern, higher authoring cost, no new engine
  work). Recommend (a) for helm as the v1 slice per class, same
  de-risk-with-the-cheapest-slot approach as the original male plan.

## Gating

T1 (#171) and T2a (#179) are merged. This PR's baked-toggle wiring (batch 1)
has no further gate. Batch 2 (new Blender geometry, both sexes) is unblocked
and ready to start; filed as child issues rather than attempted in this PR to
keep this change to the already-verified, zero-new-asset wins.

## Render invariant: any baked-toggle node must survive per-character rig merges (PHAA-653)

`assets.ts`'s `optimizedScene()` merges same-skeleton/material/parent/transform
skinned mesh parts into one draw call per GLB (`mergeSkinnedParts`), cached once
per url. A node named in ANY `VisualDef.bakedArmorSlots` for that url is now
excluded from that merge (`bakedArmorNodeNamesForUrl` in `manifest.ts`,
`protectedNames` in `mergeSkinnedParts`): `setBakedArmorVisibility` finds a node
by name at runtime, and a node folded into a merged mesh stops being findable by
name, so it gets stuck at whatever visibility the merge left it (always on).
Two concrete ways this bites without the guard: (1) a future KayKit rig-merge
adoption (upstream #1726) would newly start merging a body's baked accessories
once it stops being blocked by the per-part quantization noise that protects
them today; (2) the chibi female outfits are unquantized with one shared skin,
so their armor nodes ALREADY collide on this GLB's own merge bucket keys, e.g.
`armorceinturethighs` (waist) buckets identically to `armorknees`/`armorlegs`
(legs) in `chibi_female_knight.glb` despite gating different `EquipSlot`s --
proven in `tests/phaa653_rig_merge_guard.test.ts`. Any new `bakedArmorSlots`
entry on a def sharing a url with other defs is automatically covered (the
protected-name set is a union across every def on that url); no per-body opt-in
needed.
