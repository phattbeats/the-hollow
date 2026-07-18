// The CustomMap document: the editor's canonical, serializable map. The type and
// its sanitizer live in src/sim/map_doc.ts (shared with the server, which
// validates uploaded documents with the SAME code); this module adapts the
// document to the editor's authoring surface and projects it onto the engine's
// WorldContent for play-test. Pure: no DOM, Vitest-importable.
//
// Asset resolution: this fork has no generated asset-id -> path catalogue yet
// (upstream carries one, asset_catalog.generated.ts, built by a script that
// does not exist here, and a user-upload registry from the not-yet-built
// client shell). Rather than invent one, every function that needs to resolve
// an assetId takes an AssetPathResolver: the client-shell slice wires in the
// real catalogue/upload lookup when it lands.

import { BUILTIN_WORLD, PLAYER_START } from '../sim/data';
import {
  collideRadiusFor,
  MAP_DOC_VERSION,
  type MapDoc,
  type MapDocContent,
  type MapDocMeta,
  type MapPlacement,
} from '../sim/map_doc';
import type { PlacedAsset, WorldContent } from '../sim/types';
import { WATER_LEVEL } from '../sim/world';

export const CUSTOM_MAP_VERSION = MAP_DOC_VERSION;

// Editor-facing aliases: the document shape IS the shared MapDoc.
export type AssetPlacement = MapPlacement;
export type CustomMapMeta = MapDocMeta;
export type CustomMap = MapDoc;

// Resolves a catalogue or user-uploaded asset id to its public GLB path, or
// undefined when the id is unknown. Injected so this module stays independent
// of whichever registry the client shell eventually provides.
export type AssetPathResolver = (assetId: string) => string | undefined;

// The game's fixed offline seed; a fresh map defaults to it so its built-in
// derived terrain matches what the editor previews (mirrors DEFAULT_PLAYTEST_SEED).
const DEFAULT_SEED = 20061;

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// A new map seeded from the built-in world content (so it is immediately playable
// and editable). `now` and `id` are injected (no Date.now/Math.random in callers
// that want determinism; the DOM app passes real values).
export function newCustomMap(name: string, id: string, now: number): CustomMap {
  return {
    version: CUSTOM_MAP_VERSION,
    meta: {
      id,
      name,
      description: '',
      createdAt: now,
      updatedAt: now,
      seed: DEFAULT_SEED,
      parentId: '',
    },
    content: {
      zones: deepClone(BUILTIN_WORLD.zones),
      camps: deepClone(BUILTIN_WORLD.camps),
      npcs: deepClone(BUILTIN_WORLD.npcs),
      objects: deepClone(BUILTIN_WORLD.groundObjects),
      roads: deepClone(BUILTIN_WORLD.roads),
    },
    terrainEdits: [],
    placements: [],
  };
}

// Build a CustomMap from the editor's current content tables plus the
// authoring layers. Deep-cloned so the document is independent of further edits.
export function customMapFromContent(
  content: MapDocContent,
  layers: {
    terrainEdits?: CustomMap['terrainEdits'];
    placements?: AssetPlacement[];
    blockers?: CustomMap['blockers'];
    meta: CustomMapMeta;
    waterLevel?: number;
    playerStart?: { x: number; z: number };
  },
): CustomMap {
  const map: CustomMap = {
    version: CUSTOM_MAP_VERSION,
    meta: { ...layers.meta },
    content: {
      zones: deepClone(content.zones),
      camps: deepClone(content.camps),
      npcs: deepClone(content.npcs),
      objects: deepClone(content.objects),
      roads: deepClone(content.roads ?? []),
    },
    terrainEdits: deepClone(layers.terrainEdits ?? []),
    placements: deepClone(layers.placements ?? []),
  };
  if (layers.blockers && layers.blockers.length > 0) map.blockers = deepClone(layers.blockers);
  if (layers.waterLevel !== undefined && layers.waterLevel !== WATER_LEVEL) {
    map.waterLevel = layers.waterLevel;
  }
  if (layers.playerStart) map.playerStart = { ...layers.playerStart };
  return map;
}

// Project a CustomMap onto the engine's WorldContent for play-testing. Props
// come from the built-in world (the editor does not author them yet); free
// placements carry their collide footprint so the Sim's colliders and the
// renderer read the SAME records.
export function customMapToWorldContent(
  map: CustomMap,
  resolveAssetPath: AssetPathResolver,
): WorldContent {
  const start = map.playerStart ?? PLAYER_START;
  const world: WorldContent = {
    zones: deepClone(map.content.zones),
    camps: deepClone(map.content.camps),
    npcs: deepClone(map.content.npcs),
    groundObjects: deepClone(map.content.objects),
    roads: deepClone(map.content.roads ?? BUILTIN_WORLD.roads),
    props: deepClone(BUILTIN_WORLD.props),
    playerStart: { x: start.x, z: start.z },
    terrainEdits: deepClone(map.terrainEdits),
    placements: placementsToPlayAssets(map.placements, resolveAssetPath),
    biomePaint: map.biomePaint ? deepClone(map.biomePaint) : undefined,
  };
  if (map.blockers && map.blockers.length > 0) world.blockers = deepClone(map.blockers);
  if (map.waterLevel !== undefined) world.waterLevel = map.waterLevel;
  return world;
}

// The collision radius a colliding placement actually gets: the per-placement
// override when authored, else the scale-derived default. The ONE resolution
// used by both the render footprint and the playtest colliders.
export function effectiveCollideRadius(p: Pick<MapPlacement, 'scale' | 'collideRadius'>): number {
  return p.collideRadius ?? collideRadiusFor(p.scale);
}

// Resolve editor placements (catalogue id, or a user-uploaded id, via the
// injected resolver) into render-ready PlacedAssets (GLB path). INDEX-ALIGNED
// with the document: slot i always describes placement i, and a placement
// with an unresolvable id becomes a null hole instead of being dropped, so a
// 3D view keying meshes by DOCUMENT index never drifts one slot after an
// unresolvable id. Colliding placements get their authored collideRadius
// override, else the scale-proportional default (see effectiveCollideRadius).
export function placementsToRenderAssets(
  placements: readonly AssetPlacement[],
  resolveAssetPath: AssetPathResolver,
): (PlacedAsset | null)[] {
  return placements.map((p) => {
    const path = resolveAssetPath(p.assetId);
    if (!path) return null;
    const placed: PlacedAsset = { path, x: p.x, z: p.z, rotY: p.rotY, scale: p.scale };
    if (p.collide) placed.collideRadius = effectiveCollideRadius(p);
    return placed;
  });
}

// The compact (hole-free) resolution, for consumers that do not key by document
// index: the play-test WorldContent (sim colliders + the game renderer's
// constructor build) only needs the resolvable placements.
export function placementsToPlayAssets(
  placements: readonly AssetPlacement[],
  resolveAssetPath: AssetPathResolver,
): PlacedAsset[] {
  return placementsToRenderAssets(placements, resolveAssetPath).filter(
    (a): a is PlacedAsset => a !== null,
  );
}
