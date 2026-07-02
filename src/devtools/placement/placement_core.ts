// Pure placement-tool core: the placeable categories, the pasteable literal
// formatting, and the in-memory placement state. DOM-free and Three-free so a
// plain Vitest unit test can pin the emitted literal shape (the whole point of
// the tool is that the output pastes straight into a zone content module, so
// the shape here must match src/sim/types.ts exactly). Most categories emit
// into a ZonePropsDef array; 'camps' and 'npcs' emit CampDef/NpcDef stubs
// instead (see listKey), since mob camps and NPCs live in separate top-level
// exports (e.g. HOLLOW_CAMPS, HOLLOW_NPCS), not in ZonePropsDef. Both stubs
// carry an 'EDIT_ME' id/name/greeting placeholder, same pattern as delveMarker
// below: this tool places a point, it does not author dialogue or loot.
//
// Dev-only tooling (never bundled into a player entry): plain English is fine.

import type { ZonePropsDef } from '../../sim/types';

/** the target ZonePropsDef array, or a non-ZonePropsDef content bucket */
export type PlacementListKey = keyof ZonePropsDef | 'camps' | 'npcs';

/** One click (or two, for fences) plus the armed yaw. */
export interface PlacementInput {
  x: number;
  z: number;
  yaw: number;
  x2?: number; // fence second click
  z2?: number;
}

export interface PlacementCategory {
  id: string;
  label: string;
  /** the ZonePropsDef array (or camps/npcs bucket) the emitted value belongs in */
  listKey: PlacementListKey;
  /** GLB kits the renderer draws this category from (drives the filter) */
  kits: string[];
  /** prop registry keys (PROP_ASSET_DEFS) the renderer composes it from */
  assets: string[];
  usesYaw: boolean;
  /** fences need a start and an end click */
  twoClick?: boolean;
  /** the exact value pushed into the zone array (object literal or tuple) */
  toValue(p: PlacementInput): unknown;
}

// Defaults (w/d/r/scale/ringR/columns/hutLocal) mirror typical values in the
// shipped zone files (see ZONE1_PROPS); authors tune them after pasting.
export const PLACEMENT_CATEGORIES: PlacementCategory[] = [
  {
    id: 'building_house',
    label: 'building: house',
    listKey: 'buildings',
    kits: ['village'],
    assets: ['house1', 'house2', 'house3', 'blacksmith'],
    usesYaw: true,
    toValue: (p) => ({ kind: 'house', x: p.x, z: p.z, w: 6, d: 5, rot: p.yaw }),
  },
  {
    id: 'building_inn',
    label: 'building: inn',
    listKey: 'buildings',
    kits: ['village'],
    assets: ['inn'],
    usesYaw: true,
    toValue: (p) => ({ kind: 'inn', x: p.x, z: p.z, w: 6, d: 7, rot: p.yaw }),
  },
  {
    id: 'building_chapel',
    label: 'building: chapel',
    listKey: 'buildings',
    kits: ['village'],
    assets: ['bellTower', 'house3'],
    usesYaw: true,
    toValue: (p) => ({ kind: 'chapel', x: p.x, z: p.z, w: 5, d: 7, rot: p.yaw }),
  },
  {
    id: 'well',
    label: 'well',
    listKey: 'wells',
    kits: ['village'],
    assets: ['well'],
    usesYaw: false,
    toValue: (p) => ({ x: p.x, z: p.z, r: 1.5 }),
  },
  {
    id: 'stall',
    label: 'market stall',
    listKey: 'stalls',
    kits: ['village', 'qprops'],
    assets: ['stand1', 'stand2', 'farmCrate', 'barrel', 'anvil', 'weaponStand'],
    usesYaw: true,
    toValue: (p) => ({ x: p.x, z: p.z, rot: p.yaw, r: 1.7 }),
  },
  {
    id: 'mine',
    label: 'mine entrance',
    listKey: 'mines',
    kits: ['town', 'minerock', 'ore', 'village', 'qprops'],
    assets: [
      'timberPillar',
      'rockTallA',
      'rockTallH',
      'rockLargeD',
      'rockLargeF',
      'cart',
      'oreRocks',
      'lanternWall',
    ],
    usesYaw: true,
    toValue: (p) => ({ x: p.x, z: p.z, rot: p.yaw }),
  },
  {
    id: 'dock',
    label: 'fishing dock',
    listKey: 'docks',
    kits: ['pirate', 'village', 'qprops'],
    assets: ['dockPlatform', 'rowboat', 'house3', 'barrel', 'crateWooden'],
    usesYaw: true,
    toValue: (p) => ({
      x: p.x,
      z: p.z,
      rot: p.yaw,
      hutLocal: { x: 2.8, z: 2.4, hw: 1.7, hd: 1.5 },
    }),
  },
  {
    id: 'tent',
    label: 'tent',
    listKey: 'tents',
    kits: ['tent'],
    assets: ['tentOpen', 'tentSmall'],
    usesYaw: true,
    toValue: (p) => ({ x: p.x, z: p.z, rot: p.yaw, scale: 1 }),
  },
  {
    id: 'crate',
    label: 'crate / barrel',
    listKey: 'crates',
    kits: ['qprops'],
    assets: ['crateWooden', 'barrel'],
    usesYaw: false,
    toValue: (p) => [p.x, p.z],
  },
  {
    id: 'campfire',
    label: 'campfire',
    listKey: 'campfires',
    kits: ['village'],
    assets: ['bonfire'],
    usesYaw: false,
    toValue: (p) => [p.x, p.z],
  },
  {
    id: 'mudHut',
    label: 'mud hut (mushroom dome)',
    listKey: 'mudHuts',
    kits: ['shroom'],
    assets: ['mushroomRed', 'mushroomTan'],
    usesYaw: false,
    toValue: (p) => [p.x, p.z],
  },
  {
    id: 'ruinRing',
    label: 'ruin ring',
    listKey: 'ruinRings',
    kits: ['nature'],
    assets: ['column', 'columnBroken', 'statueHead', 'statueBlock'],
    usesYaw: false,
    toValue: (p) => ({ x: p.x, z: p.z, ringR: 7, columns: 6 }),
  },
  {
    id: 'fence',
    label: 'fence run (two clicks)',
    listKey: 'fences',
    kits: ['village'],
    assets: ['fence'],
    usesYaw: false,
    twoClick: true,
    toValue: (p) => ({ x1: p.x, z1: p.z, x2: p.x2 ?? p.x, z2: p.z2 ?? p.z }),
  },
  {
    id: 'graveyard',
    label: 'graveyard cluster',
    listKey: 'graveyards',
    kits: ['grave'],
    assets: ['graveRound', 'graveCross', 'graveBevel', 'graveDecor'],
    usesYaw: false,
    toValue: (p) => ({ x: p.x, z: p.z }),
  },
  {
    id: 'delveMarker',
    label: 'delve entrance marker',
    listKey: 'delveMarkers',
    kits: ['dungeon'],
    assets: ['delveEntrance2'],
    usesYaw: false,
    toValue: (p) => ({ x: p.x, z: p.z, delveId: 'EDIT_ME' }),
  },
  {
    id: 'campSpawn',
    label: 'mob camp anchor',
    listKey: 'camps',
    // no GLB kit backs a camp anchor; the 3D view marks it with a plain cone
    // (see main.ts rebuildMarkers), not a rendered prop.
    kits: [],
    assets: [],
    usesYaw: false,
    toValue: (p) => ({ mobId: 'EDIT_ME', center: { x: p.x, z: p.z }, radius: 12, count: 5 }),
  },
  {
    id: 'npcSpawn',
    label: 'NPC spawn point',
    listKey: 'npcs',
    kits: [],
    assets: [],
    usesYaw: true,
    toValue: (p) => ({
      id: 'EDIT_ME',
      name: 'EDIT_ME',
      title: 'EDIT_ME',
      pos: { x: p.x, z: p.z },
      facing: p.yaw,
      color: 0xffffff,
      questIds: [],
      greeting: 'EDIT_ME',
    }),
  },
];

export function categoryById(id: string): PlacementCategory | undefined {
  return PLACEMENT_CATEGORIES.find((c) => c.id === id);
}

/** per-category placement counts for this session, in category order, zero counts omitted */
export function categoryCounts(
  entries: PlacedEntry[],
): { id: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.categoryId, (counts.get(e.categoryId) ?? 0) + 1);
  return PLACEMENT_CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({
    id: c.id,
    label: c.label,
    count: counts.get(c.id) as number,
  }));
}

/** filter by substring over label, list key, kit names, and asset keys */
export function filterCategories(query: string): PlacementCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return PLACEMENT_CATEGORIES;
  return PLACEMENT_CATEGORIES.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      c.listKey.toLowerCase().includes(q) ||
      c.kits.some((k) => k.toLowerCase().includes(q)) ||
      c.assets.some((a) => a.toLowerCase().includes(q)),
  );
}

export const YAW_STEP = (15 * Math.PI) / 180;

/** advance the armed yaw one 15-degree step, wrapped to (-PI, PI] */
export function stepYaw(yaw: number, steps = 1): number {
  let next = yaw + steps * YAW_STEP;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next <= -Math.PI) next += Math.PI * 2;
  return Math.round(next / YAW_STEP) * YAW_STEP;
}

// ---------------------------------------------------------------------------
// Literal formatting: coordinates to 1 decimal, angles/scales to 2, and
// trailing zeros trimmed so output matches the hand-written zone files.
// ---------------------------------------------------------------------------

const TWO_DP_KEYS = new Set(['rot', 'scale', 'hw', 'hd', 'facing']);
// fields the zone files always write as a hex literal (e.g. 0x8fb6c4), never decimal
const HEX_KEYS = new Set(['color']);

function fmtNum(n: number, dp: number): string {
  const s = n.toFixed(dp);
  return String(Number(s)); // trims trailing zeros: 12.50 -> 12.5, 3.00 -> 3
}

function fmtHex(n: number): string {
  return `0x${Math.max(0, Math.round(n)).toString(16).padStart(6, '0')}`;
}

function fmtValue(v: unknown, key?: string): string {
  if (typeof v === 'number') {
    if (key !== undefined && HEX_KEYS.has(key)) return fmtHex(v);
    return fmtNum(v, key !== undefined && TWO_DP_KEYS.has(key) ? 2 : 1);
  }
  if (typeof v === 'string') return `'${v}'`;
  if (Array.isArray(v)) return `[${v.map((e) => fmtValue(e)).join(', ')}]`;
  if (v !== null && typeof v === 'object') {
    const inner = Object.entries(v as Record<string, unknown>)
      .map(([k, e]) => `${k}: ${fmtValue(e, k)}`)
      .join(', ');
    return `{ ${inner} }`;
  }
  return String(v);
}

export interface PlacedEntry {
  categoryId: string;
  input: PlacementInput;
}

/** one pasteable array element, e.g. `{ x: 3.5, z: -12, rot: 1.31, scale: 1 }` */
export function formatEntry(entry: PlacedEntry): string {
  const cat = categoryById(entry.categoryId);
  if (!cat) return '';
  return fmtValue(cat.toValue(entry.input));
}

/** the whole session as pasteable fragments, grouped per array (or bucket) */
export function formatPlacements(entries: PlacedEntry[]): string {
  const groups = new Map<PlacementListKey, string[]>();
  for (const e of entries) {
    const cat = categoryById(e.categoryId);
    if (!cat) continue;
    let list = groups.get(cat.listKey);
    if (!list) {
      list = [];
      groups.set(cat.listKey, list);
    }
    list.push(formatEntry(e));
  }
  const out: string[] = [];
  for (const [listKey, lines] of groups) {
    if (listKey === 'npcs') {
      // *_NPCS is a Record<string, NpcDef> keyed by npc id, not an array:
      // each stub pastes in as its own `<npc_id>: { ... },` Record entry.
      out.push('// each entry keys into the *_NPCS Record<string, NpcDef> by its id:');
      for (const line of lines) out.push(`${line},`);
      continue;
    }
    out.push(`${listKey}: [`);
    for (const line of lines) out.push(`  ${line},`);
    out.push('],');
  }
  return out.join('\n');
}

/** base zone props plus this session's placements, for the live preview */
export function buildPreviewProps(base: ZonePropsDef, entries: PlacedEntry[]): ZonePropsDef {
  const props: ZonePropsDef = {
    buildings: [...base.buildings],
    wells: [...base.wells],
    stalls: [...base.stalls],
    mines: [...base.mines],
    docks: [...base.docks],
    tents: [...base.tents],
    crates: [...base.crates],
    campfires: [...base.campfires],
    mudHuts: [...base.mudHuts],
    ruinRings: [...base.ruinRings],
    fences: [...base.fences],
    graveyards: [...base.graveyards],
    delveMarkers: [...(base.delveMarkers ?? [])],
  };
  for (const e of entries) {
    const cat = categoryById(e.categoryId);
    if (!cat) continue;
    // camps/npcs paste into a separate top-level export, not ZonePropsDef;
    // they get a 3D marker (main.ts rebuildMarkers) but no props-preview push.
    if (cat.listKey === 'camps' || cat.listKey === 'npcs') continue;
    // biome-ignore lint/suspicious/noExplicitAny: the category's toValue returns the exact element type of its target array
    (props[cat.listKey] as any[]).push(cat.toValue(e.input));
  }
  return props;
}
