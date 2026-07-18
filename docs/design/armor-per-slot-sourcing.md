# PHAA-604 (PHAA-502 T2b): male per-slot armor mesh sourcing and authoring plan

Status: sourcing + feasibility pass complete; mesh authoring gated on two board
decisions (see "Decisions needed") and on the T1/T2a PRs landing on main.

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

## Decisions needed (board)

1. **Chest/legs attach approach**: rigid per-bone props on the T1 path (cheapest,
   legs will clip on the run cycle) vs the T2a baked-mesh `.visible`-swap approach
   for torso/legs (no clipping, but per-character-GLB authoring, heavier) vs a
   split two-bone leg attach. This sets the authoring shape for the whole task.
2. **Scope of v1**: "per tier" and "male roster" -- how many tiers (1? 3?), and
   which of the 7 male class bodies get bespoke fitting vs sharing one shape.
   Per-slot(3) x tier(N) x per-body-fit is potentially dozens of GLBs; a bounded
   v1 (e.g. one tier, helm+chest, shared across bodies) ships something visible
   fast and validates the pipeline before the long tail.

## Gating

Mesh + manifest wiring cannot land on `main` until T1 (#171) and T2a (#179) merge
(the `ITEM_ARMOR_VARIANTS` / `armorSlots` schema is on those branches only). This
branch is stacked on the T2a branch so authoring can proceed in parallel and
retarget to `main` once they land, same pattern as T2a stacked on T1.

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
