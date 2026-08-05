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
// options) land with slice 5.
// PHAA-678 (slice 6/8, "persistence + UX polish"): save/load status + error
// copy, the confirm/prompt dialogs, the asset browser + upload flow, and the
// help modal/first-run tutorial tour.

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
    savedLocal: 'Saved to this browser',
    savedServer: 'Saved (version {version})',
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

  a11y: {
    stage: 'Map viewport',
    toasts: 'Editor notifications',
  },

  confirm: {
    cancel: 'Cancel',
    ok: 'OK',
    conflictTitle: 'Someone else saved this map',
    conflictBody:
      'The server copy is now version {version}, newer than the one you loaded. Save your changes as a new map to avoid overwriting theirs.',
    conflictSaveCopy: 'Save As Copy',
    discardTitle: 'Discard unsaved changes?',
    discardBody: '"{name}" has unsaved changes that will be lost.',
    discard: 'Discard',
  },

  prompt: {
    saveAsTitle: 'Save As',
    nameLabel: 'Map name',
  },

  status: {
    saveFailedLocal: 'Could not save to this browser (storage may be full).',
    savedLocalOnly: '"{name}" saved to this browser. Sign in to also save it to the server.',
    savedServer: '"{name}" saved (version {version}).',
    autosaveOff: 'Autosave turned off: {reason}',
    autosaveFailed: 'Autosave draft could not be written (storage may be full).',
    forked: 'Created your own copy: "{name}".',
    opened: '"{name}" opened.',
    newMap: 'Started a new map.',
    imported: '"{name}" imported.',
    importFailed: 'Could not import that file.',
    exported: 'Map exported.',
  },

  upload: {
    notGlb: 'Only .glb files can be uploaded.',
    tooLarge: 'That file is larger than 8 MiB.',
    uploading: 'Uploading...',
    uploaded: '"{name}" uploaded.',
    uploadedExisting: 'You already uploaded this file; reusing it.',
  },

  serverError: {
    invalid_map_name: 'That map name is not valid.',
    map_name_not_allowed: 'That map name is not allowed.',
    invalid_map_doc: 'This map document is not valid.',
    invalid_version: 'That save is out of date. Reopen the map and try again.',
    map_limit_reached: "You've reached the limit of saved maps for your account.",
    map_not_found: 'That map no longer exists.',
    version_conflict: 'Someone else saved this map first.',
    slug_unavailable: 'That map name is already taken. Try another.',
    map_too_large: 'This map is too large to save.',
    invalid_glb: 'That file is not a valid GLB model.',
    asset_blocked: 'That asset was removed by a moderator.',
    asset_limit_reached: "You've reached the limit of uploaded assets for your account.",
    asset_storage_limit_reached: "You've reached your uploaded-asset storage limit.",
    asset_too_large: 'That asset is larger than 8 MiB.',
    asset_not_found: 'That asset no longer exists.',
    rate_limited: 'Too many requests. Wait a moment and try again.',
    unauthorized: 'Sign in from the game to do that.',
    network: 'Could not reach the server. Check your connection.',
    timeout: 'The server took too long to respond.',
    unknown: 'Something went wrong. Try again.',
  },

  assets: {
    label: 'Asset browser',
    title: 'Assets',
    search: 'Search assets',
    searchPlaceholder: 'Search...',
    categoryTab: '{category} ({count})',
    uploadedTab: 'Uploaded',
    uploadedSignIn: 'Sign in from the game to see and upload your own assets.',
    uploadedLoadFailed: 'Could not load your uploaded assets.',
    uploadedEmpty: "You haven't uploaded any assets yet.",
    loading: 'Loading...',
    empty: 'No assets match.',
    pick: 'Place {name}',
    deleteAsset: 'Delete asset',
    deleteAssetConfirm: 'Delete "{name}"? Any map placement using it will fail to render.',
    category: {
      biome: 'Biome',
      chars: 'Characters',
      creatures: 'Creatures',
      dungeon: 'Dungeon',
      foliage: 'Foliage',
      props: 'Props',
      quest: 'Quest',
      resources: 'Resources',
      tools: 'Tools',
      weapons: 'Weapons',
    },
  },

  help: {
    title: 'Editor Help',
    toolsTitle: 'Tools',
    shortcutsTitle: 'Keyboard shortcuts',
    mouseTitle: 'Mouse',
    flowTitle: 'Save, draft, and playtest',
    beginTutorial: 'Begin tutorial',
    close: 'Close',
    key: {
      tools: 'Number keys or letters shown next to each tool: switch tools',
      brush: '[ and ]: shrink / grow the brush',
      undo: 'Ctrl+Z / Ctrl+Y: undo / redo',
      save: 'Ctrl+S: save',
      duplicate: 'Ctrl+D: duplicate the selected placement',
      nudge: 'Arrow keys: nudge the selection',
      wheel: 'Scroll wheel: rotate or scale the selected placement',
      delete: 'Delete: remove the selection',
      escape: 'Escape: cancel the current action',
    },
    mouse: {
      orbit3d: '3D view: left-drag to orbit, right-drag to pan',
      fly3d: '3D view: scroll to zoom, WASD to fly',
      move: 'Drag a marker or placement to move it',
      pan2d: '2D view: drag empty space to pan, scroll to zoom',
    },
    flow: {
      save: 'Save writes to this browser, and to the server once you are signed in',
      draft: 'An autosave draft protects unsaved edits if the tab closes unexpectedly',
      playtest: 'Playtest boots the game on this map, including your current edits',
    },
    tool: {
      select: 'Select and edit an existing placement or marker.',
      raise: 'Raise the terrain under the brush.',
      lower: 'Lower the terrain under the brush.',
      smooth: 'Smooth out bumps under the brush.',
      flatten: 'Flatten the terrain to one height under the brush.',
      paint: 'Paint the biome under the brush.',
      water: 'Set the water level.',
      place: 'Place an asset from the asset browser.',
      blocker: 'Draw an invisible collision wall.',
      camp: 'Place a monster camp.',
      spawn: 'Set the player start point.',
      region: 'Select a region to copy or clear.',
      erase: 'Erase placements or terrain edits under the brush.',
    },
  },

  tutorial: {
    title: 'Editor tutorial',
    counter: 'Step {current} of {total}',
    back: 'Back',
    next: 'Next',
    finish: 'Finish',
    skip: 'Skip',
    steps: {
      toolbar: {
        title: 'Tools',
        body: 'Pick a tool here to sculpt terrain, paint biomes, or place assets.',
      },
      stage: {
        title: 'Viewport',
        body: 'This is your map. Switch between the 3D and 2D views any time.',
      },
      inspector: {
        title: 'Inspector',
        body: 'Selecting a placement or marker shows its details and options here.',
      },
      viewToggle: {
        title: '3D / 2D toggle',
        body: 'Switch to the 2D overhead view for precise placement, or 3D to see the result.',
      },
      save: {
        title: 'Save',
        body: 'Save keeps a copy in this browser, and on the server once you sign in.',
      },
      playtest: {
        title: 'Playtest',
        body: 'Boot the game on this map to try it out, including your current edits.',
      },
      help: {
        title: 'Help',
        body: 'Come back here any time for the tool list, shortcuts, and this tour.',
      },
    },
  },
};
