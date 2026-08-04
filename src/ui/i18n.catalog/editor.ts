// i18n source catalog - the map editor surface at /editor. English values only;
// the locale translations live in src/ui/i18n.locales/<lang>.ts (the
// runtime-authoritative overlays), filled by the maintainer at release.
//
// Assembled into `en` by ./index.ts under the `editor` namespace. Like guide.ts
// and hud_chrome.ts this module carries NO per-locale blocks (no `as const`), so
// a new editor string is an English-only add that compiles; the translations
// live solely in the overlays.
//
// PHAA-676 (slice 4/8, "core viewport"): only the keys the booted chrome
// actually renders. Authoring-tool keys (inspector/brush/biome/place/blocker
// options) land with slice 5; playtest/save-state-transition copy with slice 6.

export const editorStrings = {
  appTitle: 'Map Editor',
  // Browser tab title. Hyphen separator (not a dash character).
  docTitle: 'Map Editor - World of ClaudeCraft',
  untitledMap: 'Untitled Map',

  topbar: {
    label: 'Editor actions',
    mapNameLabel: 'Map name',
    dirtyDot: 'This map has unsaved changes',
    saving: 'Saving...',
    neverSaved: 'Not saved yet',
    new: 'New',
    newTitle: 'Start a new map from the built-in world',
    open: 'Open',
    openTitle: 'Open a saved map (browser or server)',
    save: 'Save',
    saveTitle: 'Save to this browser, and to the server when signed in (Ctrl+S)',
    saveAs: 'Save As',
    saveAsTitle: 'Save a copy under a new name',
    fork: 'Fork',
    forkTitle: 'Create your own server-side copy of this map',
    forkDisabledTitle: 'Open a server map first to fork it',
    import: 'Import',
    importTitle: 'Import a map from a JSON file',
    export: 'Export',
    exportTitle: 'Download this map as a JSON file',
    uploadAsset: 'Upload Asset',
    uploadAssetTitle: 'Upload a GLB model (up to 8 MiB) to place in your maps',
    uploadAssetDisabledTitle: 'Sign in from the game to upload assets',
    playtest: 'Playtest',
    playtestTitle: 'Boot the game on this map (offline, current edits included)',
    viewLabel: 'View mode',
    view3d: '3D',
    view3dTitle: 'Edit in the rendered world',
    view2d: '2D',
    view2dTitle: 'Edit on the symbolic overhead map',
    undoCount: 'Undo: {count}',
    undoCountTitle: '{count} undoable steps (Ctrl+Z to undo, Ctrl+Y to redo)',
    autosave: 'Autosave',
    autosaveTitle:
      'Automatically save the map while there are unsaved changes. Turns itself off if a save fails.',
    undo: 'Undo',
    undoTitle: 'Undo the last change (Ctrl+Z)',
    redo: 'Redo',
    redoTitle: 'Redo the last undone change (Ctrl+Y)',
    offline: 'Offline',
    offlineTitle:
      'Not signed in: maps save to this browser only. Sign in from the game to save online.',
    signIn: 'Sign in',
    signInTitle: 'Open the game login screen in a new tab',
    help: 'Help',
    helpTitle: 'Editor guide: tools, shortcuts, and the tutorial',
  },

  tool: {
    listLabel: 'Editor tools',
    keyHint: '{name} ({key})',
    select: 'Select',
    raise: 'Raise',
    lower: 'Lower',
    smooth: 'Smooth',
    flatten: 'Flatten',
    paint: 'Paint Biome',
    water: 'Water',
    place: 'Place Asset',
    blocker: 'Blocker Wall',
    camp: 'Camp',
    spawn: 'Spawn Point',
    region: 'Region',
    erase: 'Erase',
  },

  viewport: {
    assetsFailed: 'Could not load the 3D viewport: {error}',
  },
};
