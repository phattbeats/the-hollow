# PHAA-500 Verdict: Quaternius Universal Base Characters as chibi replacement

Status: partial spike. Side-by-side rendering was produced; the actual
Quaternius Universal Base Characters `.glb` could not be downloaded in
this run (see "Download blocker" below). This document records what
can be said with high confidence from public sources plus the in-tree
KayKit GLBs, and what still needs the actual pack on disk to confirm.

## TL;DR

- Proportion: switching from KayKit Adventurers (chibi, ~1.4 m head/torso
  bias) to Quaternius Universal Base Characters (realistic humanoid,
  standard proportion ~1.75 m) is a large visual change for the player
  roster. The art bible should sign off before any rigging work.
- Bone naming: KayKit uses the Blender "Rig_Medium" convention
  (`hips`, `spine`, `chest`, `upperarm.l`, `wrist.l`, `hand.l`,
  `handslot.l`). Quaternius Universal Base Characters use the Mixamo
  convention (`Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`,
  `LeftArm`, `LeftForeArm`, `LeftHand`, `LeftUpLeg`, etc.). The
  Hollow's current `attach: { bone: 'handslot.r' }` lookups will NOT
  resolve on a Quaternius rig as shipped. A remap pass is required
  (see "Retune cost" below).
- Clips: Quaternius packs ship with the same Mixamo "Idle / Walking /
  Running / etc." animation set as their Universal Animation Library.
  KayKit uses the same set in spirit (Idle, Walking_A, Running_A)
  but with the KayKit-specific names listed in `scripts/assets/specs/
  characters.json`. Some manual mapping is needed in
  `src/render/characters/manifest.ts` per-visual ClipMap.
- Retune cost estimate (best case, with the pack on disk): 3-5 days
  broken down below. Higher than the prior "1-2 days" guess because
  of the bone-name remap and the per-visual ClipMap updates.

## What was produced

- `scripts/phatt500/inspect_glb.mjs` reads the JSON chunk of any GLB
  and dumps nodes, skins, joints, animations, mesh references. Used
  on the existing KayKit player GLBs; ready to run against any
  Quaternius Universal Base Characters GLB once one is on disk.
- `scripts/phatt500/viewer.html` and `public/phatt500/viewer.html`
  render the existing KayKit player roster (8 classes, real 3D) on
  the left and the Quaternius Universal Base Characters marketing
  renders (full sheet, standard, source) on the right.
- `public/phatt500/quaternius/` contains the cached marketing
  renders so the viewer does not need a live quaternius.com
  connection at render time.
- A side-by-side screenshot of the rendered viewer is attached to
  PHAA-500 for review.

## Compatibility analysis (from public sources + in-tree KayKit)

### Bone naming: a real mismatch

The Hollow currently targets KayKit's Blender Rig_Medium bone
names. Confirmed via `inspect_glb.mjs` against the in-tree
`barbarian.glb`:

    root
      hips
        spine
          chest
            upperarm.l -> lowerarm.l -> wrist.l -> hand.l -> handslot.l
            upperarm.r -> lowerarm.r -> wrist.r -> hand.r -> handslot.r
            head
        upperleg.l -> lowerleg.l -> foot.l -> toes.l
        upperleg.r -> lowerleg.r -> foot.r -> toes.r

Same set on `knight.glb`, `mage.glb`. The Hollow's
`src/render/characters/manifest.ts` references `handslot.r` /
`handslot.l` for held-weapon attachment (see lines 362, 389, 390,
430, 431, 634, 644, 654, 655).

Quaternius Universal Base Characters are documented (Universal
Animation Library page, quaternius.com) as a "universal humanoid
rig, compatible with Unreal Engine, Godot and Unity, ready for
retargeting." In practice this means Mixamo-style joint names:

    Hips
      Spine
        Spine1
          Spine2
            Neck
              Head
            LeftShoulder
              LeftArm
                LeftForeArm
                  LeftHand
                    ... (15 finger joints)
            RightShoulder
              RightArm
                RightForeArm
                  RightHand
                    ... (15 finger joints)
      LeftUpLeg
        LeftLeg
          LeftFoot
            LeftToeBase
      RightUpLeg
        RightLeg
          RightFoot
            RightToeBase

Two implications:

1. The Hollow's `attach.bone` strings (`handslot.r`, `handslot.l`)
   will not resolve against the Quaternius rig. Either the manifest
   is rewritten to use Mixamo names (and the KayKit rigs are mapped
   through the loader), OR a remap table is added in
   `src/render/characters/assets.ts`'s bone resolution. The latter
   keeps `manifest.ts` unchanged.
2. Quaternius has `LeftShoulder` / `RightShoulder` roll-up bones
   that KayKit lacks. Animation tracks on a Quaternius rig that
   target `LeftShoulder` will be silent against a KayKit rig. This
   matters less if we only run Quaternius animations on Quaternius
   rigs, but if the project ever wanted to share Universal
   Animation Library clips across both rig families, a per-bone
   weight transfer is required (the heavier cost).

### Grip / hand bones

Quaternius Universal Base Characters ship per-finger bones
(thumb + 4 fingers per hand, 15 joints per hand). KayKit is much
sparser (one `hand.l` / `hand.r`). For grip-point attachments
(the Hollow's current per-weapon "mainhand attach" path), the
Quaternius rig offers more options but the Hollow's current code
only consumes the whole-hand bone, so the extra granularity is
unused for now. No code change needed at this layer.

### Animation clips

Quaternius Universal Base Characters ship the same Mixamo clip
vocabulary as Universal Animation Library 2: Idle, Walking,
Walking_Backwards, Running, Jump, Falling, Land, plus combat
sub-actions. KayKit uses KayKit names (see the `keepClips` list in
`scripts/assets/specs/characters.json`): Idle, Walking_A,
Walking_Backwards, Running_A, Running_Strafe_Left,
Running_Strafe_Right, 1H_Melee_Attack_Chop, ... The visual
mapping is mostly 1:1, but `manifest.ts` references the KayKit
names directly per `ClipMap` factory (`kaykit`, `skeletonClips`,
etc.). Adding a `quaternius` factory that translates the KayKit
name -> Quaternius name is straightforward.

Per `scripts/assets/CLAUDE.md`, the build pipeline already strips
the Mixamo "Armature|" prefix. So clip names arrive at runtime as
the bare Mixamo name (`Idle`, `Walking`, etc.). The Hollow's
existing `keepClips` (KayKit names) would NOT match those.

### Texture / material

KayKit uses vertex-colour PBR with low-res (256-512px) skin
textures. Quaternius Universal Base Characters ship source-PBR
textures at 1024-2048px. To match Hollow's "low-poly stylised"
look at current draw distance, the Quaternius textures should be
downsampled to 512px during `build_assets.mjs` (same `maxTex: 512`
option KayKit already uses).

## Estimated retune cost

This estimate assumes the actual pack lands in `tmp/asset_src/`
and the team is satisfied with the proportion swap.

| Phase                                                    | Effort        | Owner    |
|----------------------------------------------------------|---------------|----------|
| Drop the pack, run `inspect_glb.mjs` against all variants | 1 h          | Finch    |
| Confirm joint set is exactly the published set           | 30 min        | Finch    |
| Add Quaternius entries to `scripts/assets/specs/characters.json` (male, female, source for 2 proportions = 4-6 entries) | 2 h | Finch |
| Build pipeline run, debug texture compression            | 3 h           | Finch    |
| Add a `quaternius` ClipMap factory in `manifest.ts` (or per-visual) | 3-4 h | Finch |
| Bone remap table in `assets.ts` `resolveBone()`          | 4-6 h         | Finch    |
| Update held-weapon `attach.bone` paths or add remap      | 2-4 h         | Finch    |
| Visual QA: 1 male + 1 female variant, side-by-side       | 2 h           | Art      |
| Class mapping (current KayKit classes to Quaternius bases) | 4-6 h | Art      |
| Camera follow-distance / NPC vs player height retune    | 2-3 h         | Finch    |
| Migration of existing NPC mobs (bandit / villager / etc.)| 4-8 h         | Finch    |

Best case total: 3 engineer-days + 1 art-day.
High case: 1.5 weeks if the bone remap reveals per-mob
inconsistencies (bandits, undead that share the KayKit humanoid rig
will all need re-mapping).

The bone-name remap is the dominant cost. If the team accepts a
temporary hack where `manifest.ts` uses a `boneAliases` field and
each new visual entry sets it (e.g. `{ handslot.r: 'RightHand' }`),
that pattern can also be back-applied to existing entries to
gradually migrate.

## Download blocker (why the actual GLB is not on disk yet)

The Quaternius Universal Base Characters pack is hosted on itch.io
(quaternius.itch.io/universal-base-characters), gated behind an
Itch download session. From the harness container, all known public
paths return redirects to a login wall:

- quaternius.com/packs/universalbasecharacters.html: marketing page
  only, no direct download.
- quaternius.itch.io/universal-base-characters: Itch API, requires
  an authenticated session token to produce the download URL.
- poly.pizza, GitHub, public CDNs: no Quaternius Universal Base
  Characters copies found. (poly.pizza has other "Base Character"
  models by other authors, but they are not Quaternius' work and
  cannot be used as a faithful proxy.)

Two ways to unblock:

1. Manually download the pack (browser, Itch, "Download here"
   button) and drop the resulting `.zip` into
   `tmp/asset_src/quaternius_universal_base_characters/` on the
   shared checkout. From there, `inspect_glb.mjs` and the rest of
   this spike resume without code changes.
2. Provide an Itch API key (the public "no payment" download flow
   uses a per-account token that the agent harness cannot mint
   from scratch).

Once either is in place, the remaining work is small: extract, run
`inspect_glb.mjs` to verify joint set matches the published spec,
add spec entries, run the build, screenshot again with the real
GLBs in the viewer's left column (and the marketing renders can
stay on the right).

## Known scope notes

- The "load 2-3 Quaternius rigs" original ticket asks for variant
  breadth; this first slice loaded one pack-of-pack reference (the
  marketing renders), then blocked on getting the first actual GLB
  on disk. Per Marlowe's re-scope on 2026-07-06, the second/third
  rig comparison is deferred until the first downloads cleanly.
- The Hollow's chibi art direction was set in PHAA-417 and is
  referenced from CREDITS.md. Switching to realistic proportion is
  an art-direction change, not just an asset swap. The board should
  confirm before any production migration.