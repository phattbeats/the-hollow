// Item id -> armor variant key. The sibling of `weapon_variants.ts`: maps an
// equipped armor item id to the armor visual key the renderer attaches.
// The SINGLE source of truth shared by the 2D bag icon (src/ui/icons.ts, rendered
// as /ui/armor/<key>.png) and the 3D worn model (src/render/characters/
// manifest.ts, attached as models/armor/<key>.glb), so worn armor always matches
// its inventory icon. Empty for now: PHAA-502 T2a authors the first baked
// accessory meshes; this table is the registration seam that lights them up
// without an importer change.
//
// Pure data, no imports, no DOM: safe to import from both the ui icon layer and
// the render character layer (and from node unit tests). Keys live under
// public/ui/armor/<key>.png and public/models/armor/<key>.glb.
//
// PHAA-502 T1 ship note: deliberately empty so vitest's existence + resolution
// tests are the only authority on the table's contract; a T2a follow-up adds
// real mappings alongside the corresponding GLB/PNG pair in one commit.
export const ITEM_ARMOR_VARIANTS: Record<string, string> = {};
