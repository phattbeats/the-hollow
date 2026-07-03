// The Hollow's outdoor starter zone (PHAA-420, constitution Decision 23). Real
// open-world ground around the shrine gate, built on the same north-running
// terrain strip zone1/zone2/zone3 share (world.ts's terrainHeight) - not the
// portal-instanced pattern the vase hub itself uses (content/hollow.ts). This
// is the ground Homestead v0 (PHAA-417) places plots on.
//
// Geography: prepended south of Eastbrook Vale (this zone's zMax equals
// ZONE1_ZONE.zMin, satisfying the "zones tile the world strip" invariant in
// tests/progression.test.ts), sharing the 'vale' biome palette so no renderer
// biome table needs a new entry (the fork's canopy/root register is a reskin
// pass over the existing look, not a new terrain family). `sealedFrontier`
// closes the mountain pass world.ts would otherwise open at this zone's
// northern boundary, so the inherited, still-neutralized Eastbrook content
// across it stays geographically unreachable on foot - only the vase hub's
// own gate reopens (content/hollow.ts, PHAA-404 partially reversed).

import type { CampDef, ZoneDef } from '../types';

// The overworld side of the shrine gate now lives here instead of inside
// Eastbrook (see content/hollow.ts HOLLOW_HUB_DOOR_POS). It doubles as this
// zone's hub: there is no town, just the clearing the portal opens onto.
export const HOLLOW_ZONE_GATE_POS = { x: 0, z: -290 };
const HOLLOW_ZONE_GRAVEYARD_POS = { x: -12, z: -304 };
const HOLLOW_ZONE_LAKE = { x: 42, z: -235, radius: 16 };

export const HOLLOW_ZONE_ZONE: ZoneDef = {
  id: 'the_hollow_reaches',
  name: 'The Hollow Reaches',
  zMin: -400,
  zMax: -180, // == ZONE1_ZONE.zMin: tiles the strip, sealed at this boundary
  levelRange: [1, 4], // matches the slice's one dungeon, the Under-Shrine
  biome: 'vale',
  hub: {
    x: HOLLOW_ZONE_GATE_POS.x,
    z: HOLLOW_ZONE_GATE_POS.z,
    radius: 22,
    name: 'The Hollow Gate',
  },
  graveyard: HOLLOW_ZONE_GRAVEYARD_POS,
  lakes: [HOLLOW_ZONE_LAKE],
  pois: [
    { x: HOLLOW_ZONE_GATE_POS.x, z: HOLLOW_ZONE_GATE_POS.z, label: 'The Hollow Gate' },
    { x: -46, z: -246, label: 'Fallow Acres' },
    { x: 40, z: -350, label: 'Root Hollow' },
    { x: HOLLOW_ZONE_LAKE.x, z: HOLLOW_ZONE_LAKE.z, label: 'Mossbank' },
  ],
  welcome:
    'The gate opens onto open ground. Fallow Acres, west of the road, looks fit to build on.',
  sealedFrontier: true,
};

// Light wildlife so the ground reads as a real outdoor zone rather than an
// empty staging lot; kept clear of the gate plateau (hub radius 22).
export const HOLLOW_ZONE_CAMPS: CampDef[] = [
  { mobId: 'forest_wolf', center: { x: -46, z: -246 }, radius: 16, count: 4 },
  { mobId: 'wild_boar', center: { x: 40, z: -350 }, radius: 16, count: 4 },
];

// Roads from the gate outward - the "roads connecting the starter zone to the
// vase" the ticket asks for, since the vase itself is reached through the gate.
export const HOLLOW_ZONE_ROADS: { x: number; z: number }[][] = [
  [
    { x: 0, z: -290 },
    { x: -20, z: -270 },
    { x: -46, z: -246 },
  ], // to Fallow Acres
  [
    { x: 0, z: -290 },
    { x: 20, z: -320 },
    { x: 40, z: -350 },
  ], // to Root Hollow
  [
    { x: 0, z: -290 },
    { x: 12, z: -270 },
    { x: 20, z: -255 },
  ], // toward Mossbank, stopping short of the lake basin
];
