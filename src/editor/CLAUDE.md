<!-- src/editor/: the map/terrain editor, a standalone dev/self-host-operator
     page at /editor (5th Vite entry). Never imported by the game client bundle
     (src/main.ts, src/game/, src/ui/) - it is its own world, like src/admin/.
     Don't repeat root CLAUDE.md, reference it. -->

# src/editor/: map/terrain editor client

ADAPT of upstream's `/editor` (upstream PR #1306, tracked at PHAA-510), ported
slice by slice since it is one large subsystem. Plain TypeScript/DOM, no
framework (Svelte stays scoped to `src/admin/`). Landed so far:

- **Slice 1 (PHAA-673, sim core):** `custom_map.ts` (the `CustomMap` = shared
  `sim/map_doc.ts` `MapDoc` document + the editor's authoring-surface helpers),
  `blocker_core.ts`, `edit_caps_core.ts`, `placement_transform_core.ts`,
  `procgen.ts`, `span_core.ts`, `stamp_core.ts`, `undo_core.ts`: pure,
  Vitest-importable math with no DOM/Three. Own tests: `tests/editor_*.test.ts`.
- **Slice 4 (PHAA-676, this slice, "core viewport"):** the app skeleton -
  `main.ts` (entry), `app.ts` (`EditorApp` coordinator), `dom.ts` (tiny DOM
  builders), `topbar.ts`/`toolbar.ts` (chrome), `net.ts` (the server API
  client), `model.ts`/`view.ts`/`canvas.ts` (the 2D top-down view: entity list,
  camera/hit-testing, draw pass), `3d/editor_camera.ts` + `3d/viewport.ts` (the
  3D view). Boots, shows a `MapDoc` in 3D and 2D, and can load one from the
  server read-only. No authoring yet: every `Topbar` action other than
  New/Open/the view toggle is an explicit no-op stub.

## Not yet landed (do not assume these exist)
- **Slice 5 (authoring):** terrain paint/place/blocker/undo tools. Needs new
  Renderer capability this fork does not have yet (see Gotchas below).
- **Slice 6 (persistence/UX):** real Save/Fork/Import/Export/autosave, asset
  upload, playtest, the tutorial, the asset browser/inspector. Upstream's
  `inspector.ts`, `asset_browser.ts`, `asset_catalog.generated.ts`,
  `asset_thumbs*.ts`, `file_io.ts`, `map_drawer.ts`, `map_io.ts`, `persist.ts`,
  `playtest.ts`, `save_lifecycle_core.ts`, `server_errors_core.ts`, `toasts.ts`,
  `tutorial*.ts`, `user_assets.ts` are none of them ported.

## Gotchas / never
- **This fork's `src/render/renderer.ts` has no editor-live-edit surface.**
  Upstream's `Editor3DViewport` drives `editorCam`/`setEditorBrush`/
  `rebuildTerrain(region)`/`rebakeTerrainNormals`/`surfacePoint` and a live
  `PlacedAssetsView` instancer on `Renderer`; none of those exist here (the
  fork's `Renderer` camera is always the player-orbit chase cam, driven by
  `sync()`). `3d/viewport.ts` in this fork is a SMALLER, hand-written module:
  it builds a frozen `Sim` + `Renderer` once per document load, then flies a
  free `EditorCamera` by writing `renderer.camera` directly and calling
  `renderer.webgl.render()` every frame, **never `sync()`** (that method is
  written for a ticking, player-driven world - view culling, adaptive
  resolution, per-entity LOD - none of which a frozen preview needs). Slice 5
  needs real new `Renderer` capability (a chunk-region terrain rebuild path,
  the brush shader, a camera override hook) before it can wire live sculpting;
  that is new renderer.ts work, not something this slice's files already do.
- **No asset catalogue.** Upstream ships a generated `asset_catalog.generated.ts`
  (built by a script this fork doesn't have) mapping placement `assetId`s to GLB
  paths. `custom_map.ts` takes an injected `AssetPathResolver` instead; slice 4
  wires a stub that resolves nothing (`app.ts`'s `NO_ASSET_CATALOG`). A
  built-in-world map has zero placements, so this never matters until slice 5/6
  add real placement authoring and a real catalogue.
- `setActiveWorldContent()` (`sim/data.ts`) MUST be called with the SAME
  `WorldContent` the `Sim` is constructed with (terrain-relevant fields must be
  identical, see the `SimConfig.world` doc comment) - `Renderer`'s constructor
  reads props/placements through the active-content registry, not through the
  `Sim` it was handed. `EditorApp.loadMap` and `Editor3DViewport.start` both
  build their own `WorldContent` from the same `CustomMap`; keep them in that
  order (`setActiveWorldContent` before `new Sim`/`new Renderer`).
- Dev/operator gating is build-time only so far: `editor.html`/`src/editor/main.ts`
  is its own Vite entry (never imported from the game client), matching
  `admin.html`'s split. There is no server-side auth gate on the static page
  itself (same as `/admin`); if route-level access control is wanted, that is
  unstarted work, not something this slice added.
