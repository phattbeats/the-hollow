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

## 3. Isolation shot for ONE registered CHARACTER (GLB, no world boot)

For a single character/NPC (a GLB asset, so recipe #2's `setContent` won't work
-- an opaque-origin page can't `fetch` the GLB), render it through the real
character pipeline without the 216-asset world load. Example:
`scripts/shade_iso.html` + `scripts/phaa636_iso_shot.mjs` (PHAA-636, npc_shade).

Why not the full-world shot (recipe #1): the offline client stalls at
`Loading world... N/216` under the remote Browserless (the meshopt-GLB limitation
above), so `window.__game.sim.player` never appears and `spawnRosterCompare`
never runs. Confirmed on PHAA-636.

Recipe:

1. Write a tiny **HTML entry** (`scripts/<key>_iso.html`) that imports the real
   `preloadVisual` + `CharacterVisual` from `src/render/characters/`, builds a
   THREE scene with game-like lighting + a ground plane, `await
   preloadVisual(key)`, `new CharacterVisual(key, 0xffffff)`, settles the idle
   clip (`visual.update(1/20, IDLE, true)` x~40), adds `visual.root`, and exposes
   handles on `window.__<key>` (`cam(cx,cy,cz,tx,ty,tz)`, `tickWalk(n)`, `render`)
   plus `window.__shotReady = true`. This uses `assembleModel/applyMaterials`, so
   the shot proves the exact production materials/shadows.
2. Serve it off the **live vite dev server** (`vite --host 0.0.0.0 --port 5173`)
   -- a real origin, so the GLB + textures fetch and `localStorage` (gfx tier)
   resolve. No `setContent` shim needed. Vite transforms the `/src/*.ts` imports
   in the served HTML regardless of subdir.
3. In the shot `.mjs`, connect Browserless, `goto
   http://<phattvip-ip>:5173/scripts/<key>_iso.html` (the phattvip-IP GAME_URL
   rule from [screenshot harness memory] still applies -- Browserless can't reach
   `localhost`), `waitForFunction(() => window.__shotReady)`, then drive angles +
   a walk cycle and screenshot. Only `<key>.glb` loads, so no world-stall.

Keep the HTML/scripts ASCII (the copy gate rejects em/en dashes + emoji in added
lines).
