// Item id -> armor variant key. The sibling of `weapon_variants.ts`: maps an
// equipped armor item id to the armor visual key the renderer attaches.
// The SINGLE source of truth shared by the 2D bag icon (src/ui/icons.ts, rendered
// as /ui/armor/<key>.png) and the 3D worn model (src/render/characters/
// manifest.ts, attached as models/armor/<key>.glb), so worn armor always matches
// its inventory icon.
//
// PHAA-502 T1 ship note: deliberately empty so vitest's existence + resolution
// tests are the only authority on the table's contract; a T2a follow-up adds
// real mappings alongside the corresponding GLB/PNG pair in one commit.
//
// PHAA-502 T2b (PHAA-609): the first armor GLBs are now on disk under
// `public/models/armor/` (helm_plate.glb, chest_cape.glb, legs_plate.glb,
// extracted from the already-vendored KayKit Knight pack via
// `scripts/phaa609_extract_armor_glbs.mjs` and smoke-tested in
// `tests/phaa609_armor_glb_smoke.test.ts`), but the table stays empty pending a
// board decision on the chest/legs attach approach recorded in
// `docs/design/armor-per-slot-sourcing.md` (rigid per-bone prop clips on the
// run cycle vs the T2a baked-mesh `.visible`-swap path vs a split two-bone leg
// attach). Once that decision lands, this table gets real entries alongside
// per-body VisualDef wiring (armorSlots + armorByAttachIndex) in the same PR.
export const ITEM_ARMOR_VARIANTS: Record<string, string> = {};
