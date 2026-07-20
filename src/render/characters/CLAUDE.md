<!-- src/render/characters/: rigged player/creature visuals + char-creation preview.
     Presentation only (parent dirs cover IWorld seam, determinism, asset build).
     Don't repeat root / src / render CLAUDE.md, reference them. -->

# src/render/characters/: rigged character & creature visuals

Per-entity glTF (GLB) visuals: a `SkeletonUtils` clone of a manifest asset with
its own `AnimationMixer` and a clip-driven state machine. **Almost everything is
GLB-loaded** (`models/chars`, `models/creatures`, `models/weapons`); the one
exception is the three Under-Shrine plant mobs (PHAA-531), which route to the
seeded procedural generator in `../plant_creature.ts` instead (see
`plant_dispatch.ts` below). Reads the world; never mutates the sim.

## Files
- `manifest.ts`: pure data + dispatch. `VISUALS: Record<key, VisualDef>`, the
  `ClipMap`s, and `visualKeyFor(e)` (entity to key). No three.js, no loading.
- `anim_state.ts`: pure, three-free pose math: the `AnimState` (renderer-derived
  input) + `BaseState` types and `desiredBaseState()`/`locomotionTimeScale()` that
  `visual.ts` delegates to.
- `assets.ts`: module-import preloads every `manifestUrls()` GLB via
  `registerPreload`; `prepareVisual(key)` memoizes normalize transform, resolved
  clips, click-capsule radius, and a baked idle-pose geo (far-LOD/shadow proxy).
- `visual.ts`: `CharacterVisual`, the mixer + `BaseState` machine, LOD/shadow/ghost
  plumbing, one-shot triggers, death/revive edge logic.
- `plant_dispatch.ts`: `plantArchetypeFor(templateId)` + `PlantCreatureVisual`,
  a `../plant_creature.ts` `PlantCreature` wrapped behind the exact same
  update/trigger/LOD/dispose surface as `CharacterVisual` (see `MobVisual` in
  `index.ts`), so `renderer.ts`'s per-entity loop never branches on which kind
  of visual an entity has. Never pooled (each entity's shape is seeded off its
  own id) and never far-LOD-swapped (a handful of low-poly cave mobs).
- `preview.ts`: `CharacterPreview`, the character-creation turntable (own scene/
  camera/loop), driven from `src/main.ts`.
- `portrait.ts`: offscreen-WebGL headshot factory: renders a (class/visual-key, skin)
  head-and-shoulders PNG from the real model, caches the data URL. Consumed by
  `src/main.ts`, `src/ui/unit_portrait_painter.ts`, `src/ui/hud.ts`, `portrait_chip.ts`.
- `index.ts`: public exports + `createCharacterVisual(e, formKey?)` factory (the
  `MobVisual = CharacterVisual | PlantCreatureVisual` union `renderer.ts` consumes).

## Families & keys
~12 creature families plus 9 player classes, forms, skeletons, humanoid mobs,
and NPCs, all in `VISUALS`. Dispatch precedence in `visualKeyFor`: players to
`player_<class>` (or `player_mech` for the mech skin catalog); mobs to
`MOB_KEYS[templateId]` then `FAMILY_KEYS[MOBS[id].family]`
(beast/humanoid/murloc/spider/kobold/undead/troll/ogre/elemental/dragonkin/demon),
falling back to `mob_bandit`; NPCs to `NPC_KEYS` (default `npc_villager`). Forms
(`form_sheep`/`form_bear`/`form_cat`/`form_travel`) are passed explicitly by the renderer.
`createCharacterVisual` checks `plantArchetypeFor(e.templateId)` first for bare
(non-form) mob entities and short-circuits to a `PlantCreatureVisual` before any
of the above runs; `visualKeyFor` itself is untouched (still returns the GLB
family key for those three mobs, e.g. for prewarm shader-compile dedup).

## Animation
- `AnimState` (the renderer-derived input) and `BaseState`
  (`idle|walk|walkBack|run|cast|swim|sit|jump`) live in `anim_state.ts`, which
  also owns `desiredBaseState()` (pose selection) and `locomotionTimeScale()`
  (foot-speed matching). Clip *names* are per source rig in `ClipMap` factories:
  `kaykit`, `skeletonClips`, `animal`, `BIPED14`, `ENEMY7`, `FLOATING`, `SPIDER`.
  Names differ per rig (e.g. KayKit `Walking_A`, Quaternius `Gallop`),
  `baseAction()` falls back gracefully.
- **`src/render/renderer.ts` is the sole driver.** It builds `AnimState` each
  frame (swimming/sitting derived there, sim is unaware), calls `update(dt, s,
  animate)`, fires `playAttack()`/`playHit()` from sim events, and toggles
  `setFar`/`setShadow`/`setProxyShadow`/`setGhost`. Don't drive visuals elsewhere.
- Death/revive are **edge-triggered locally** from `s.dead` (clamped one-shot);
  `flourish` plays on respawn. One-shots clamp on the last frame, see the
  T-pose-pop comment in `playOneShot`.

## Adding things
- **New family/key:** add a `VisualDef` to `VISUALS` (existing `ClipMap` or a new
  factory if the rig's clip names differ) and wire `FAMILY_KEYS`/`MOB_KEYS`/`NPC_KEYS`.
  `manifestUrls()` auto-preloads `url` + `attach[].url` (skipping `lazyPreload`
  defs), so drop the GLB under `public/models/...` and run the media-manifest build.
- **New animation state:** add the field to `AnimState`, extend `BaseState` +
  `desiredBaseState()` (`anim_state.ts`), `baseAction()`, and `ClipMap`/`clipNamesOf()`,
  then have the renderer set the new flag.

## Gotchas / never
- KayKit GLBs ship **every** accessory visible: `VisualDef.show` is an allowlist
  of non-skinned node names to KEEP; omit it for creatures (keeps everything).
- Bone names are sanitized by GLTFLoader (`handslot.r` to `handslotr`); `attach`
  resolution tries both. A missing bone ships the model without the prop.
- Geometries/materials are **shared per-asset caches and never disposed**;
  `dispose()` only releases this clone's mixer + Skeletons. YOU MUST call it on
  despawn (online interest churn strands GPU bone textures otherwise).
- A `SkinnedMesh`'s own `position`/`scale`/`rotation` is a no-op in the default
  'attached' bind mode: three.js recomputes `bindMatrixInverse` from the node's
  own `matrixWorld` on every `updateMatrixWorld()`, which silently cancels any
  transform you apply to the node. A mis-authored skinned accessory (PHAA-633:
  a purchased outfit's hat mesh) needs its correction baked into `geometry` via
  `VisualDef.skinnedMeshFix`, not a node-level fixup like `weaponFix` (which
  only works because it targets non-skinned prop nodes).
- Never `Math.random` in *sim*, but here it's fine, this is presentation
  (bob phase, hit-clip pick). Never reach past `IWorld` into a concrete world.
- `assets.ts`'s per-url `optimizedScene` merges same-skeleton/material/parent/
  transform skinned parts into one draw call (`mergeSkinnedParts`). Any node
  named in a `VisualDef.bakedArmorSlots` is excluded from that merge
  (`bakedArmorNodeNamesForUrl`, manifest.ts) on purpose: `setBakedArmorVisibility`
  finds a node by name at runtime, and a merged node is no longer findable by
  that name, so it gets stuck visible forever. This bites BOTH rig families,
  not just quantized ones: the chibi outfits are unquantized with one shared
  skin, so their armor nodes can (and, on `chibi_female_knight.glb`, already do)
  collide on the same merge bucket key even across DIFFERENT `EquipSlot`s
  (PHAA-653, `tests/phaa653_rig_merge_guard.test.ts`). A new `bakedArmorSlots`
  entry needs no extra opt-in, the protected set is a live union over `VISUALS`.
