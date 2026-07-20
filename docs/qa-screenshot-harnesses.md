# Screenshot harnesses

Acceptance / QA screenshots for the Hollow live here, one subfolder per ticket
(e.g. `phaa-552/`). The PNGs themselves are gitignored; scripts that produce
them live in `scripts/` and are checked in so a shot is reproducible.

There are two ways to shoot, and picking the wrong one wastes hours.

## 1. Full-world shot (the whole client, over Browserless)

Boot the offline client in a real page and drive it: teleport the player, open
UI, screenshot. Example: `scripts/hollow_552_readable_shot.mjs`.

```
BROWSERLESS_WS=ws://<browserless-host>:3000 GAME_URL=http://<reachable-host>:5173 \
  node scripts/<shot>.mjs
```

Use this when the thing under test only exists in the assembled world: player
camera, HUD overlays, proximity prompts, real terrain placement.

**Known limitation (paid for on PHAA-552):** the full world loads meshopt-packed
GLBs, and those do **not** decode under the remote Browserless build we run, so a
full-world boot there dies before the scene is visible. Full-world shots need a
Browserless/Chrome that decodes meshopt, or they must run against a local
headed-ish Chrome. If you only need to see a *procedural* prop/mesh (no GLB), do
not fight this: use the isolation recipe below instead.

## 2. Isolation shot (one module's geometry, no world boot)

Render just the procedural geometry a module builds, in a standalone THREE scene,
with **no** app boot and **no** dev server. Example:
`scripts/readable_supports_scene.mjs` (+ `scripts/readable_supports_shot.mjs`).

Recipe:

1. Write a tiny browser-ESM **scene** that imports the *real* builder from `src/`
   (e.g. `buildReadable` from `src/render/readables.ts`) and renders a lineup on
   a ground plane with game-like lighting. Export the builder from the source
   module if it is not already exported, so the shot uses the exact geometry the
   world uses (never re-implement the mesh in the scene; it will drift).
2. In the **shot** script, bundle the scene to a single browser file with esbuild
   (`--bundle --format=iife --loader:.ts=ts`), then `page.setContent()` an HTML
   that inlines the bundle. No server, no reachability problem.
3. Flag readiness from the scene (`window.__shotReady = true` after the first
   `render`) and `waitForFunction` on it before screenshotting.

**Gotcha (paid for on PHAA-552): `localStorage` under `setContent`.** A page set
via `setContent` has an *opaque origin*, so `window.localStorage`'s getter throws
`SecurityError` on access. The gfx module probes `localStorage` at import for the
graphics tier, and even its `typeof localStorage === 'undefined'` guard throws
(the getter fires before `typeof`). Shim a no-op store on the page **before** the
bundle runs:

```js
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
});
```

WebGL itself works fine on the remote Browserless (`getContext('webgl2')` is
non-null); it is only the opaque-origin storage access that bites.

When to prefer isolation: you are validating a mesh/material/layout that a single
module builds procedurally, and you do not need the player, camera, or HUD. It is
faster, has no GLB dependency, and unit-tests can call the same exported builder.

### Rendering a mob through its real visual dispatch (not just an archetype)

When the thing under test is that a mob TEMPLATE ID maps to the right visual (the
`plant_creature` dispatch, `src/render/characters/plant_dispatch.ts`), render it
through the real `createPlantMobVisual(entity)` on a minimal `{ templateId, id }`
mob, NOT `buildPlantCreature(archetype, ...)` directly. Only the former exercises
the `PLANT_MOB_ARCHETYPES` lookup and the `${templateId}#${id}` seed the running
game actually uses. Exemplar pair (PHAA-772, Greenpaw's cutting):
`scripts/greenpaw_cutting_render_entry.js` + `scripts/greenpaw_cutting_render_shot.mjs`,
one contact-sheet row per variant labelled with its resolved archetype.

**Gotcha (paid for on PHAA-772): `createPlantMobVisual` pulls in `gfx`, which
probes `localStorage` at import,** so the opaque-origin `SecurityError` from the
PHAA-552 note above bites here too even though the older `buildPlantCreature`
entry dodged it. Inject the no-op `localStorage` shim as the FIRST inline
`<script>` in the `setContent` HTML, before the bundle `<script>`.
