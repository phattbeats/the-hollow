// Schematic top-down map of the Hollow Reaches starter zone (PHAA-420),
// generated directly from the ZoneDef/CampDef/road data in
// src/sim/content/hollow_zone.ts so the coordinates can't drift from the
// shipped content. Not a render of the 3D engine; a labeled reference
// diagram to answer "what does the layout look like" alongside the in-game
// screenshots.

import fs from 'node:fs';
import sharp from 'sharp';

const GATE = { x: 0, z: -290 };
const GRAVEYARD = { x: -12, z: -304 };
const LAKE = { x: 42, z: -235, radius: 16 };
const POIS = [
  { x: 0, z: -290, label: 'The Hollow Gate' },
  { x: -46, z: -246, label: 'Fallow Acres' },
  { x: 40, z: -350, label: 'Root Hollow' },
  { x: 42, z: -235, label: 'Mossbank' },
];
const CAMPS = [
  { mobId: 'forest wolves', center: { x: -46, z: -246 }, radius: 16 },
  { mobId: 'wild boar', center: { x: 40, z: -350 }, radius: 16 },
];
const ROADS = [
  [
    { x: 0, z: -290 },
    { x: -20, z: -270 },
    { x: -46, z: -246 },
  ],
  [
    { x: 0, z: -290 },
    { x: 20, z: -320 },
    { x: 40, z: -350 },
  ],
  [
    { x: 0, z: -290 },
    { x: 12, z: -270 },
    { x: 20, z: -255 },
  ],
];
const ZMIN = -400;
const ZMAX = -180; // == ZONE1_ZONE.zMin, the sealed frontier to Eastbrook Vale
const XMIN = -90;
const XMAX = 90;

const W = 900;
const H = 900;
const PAD = 70;
const sx = (x) => PAD + ((x - XMIN) / (XMAX - XMIN)) * (W - 2 * PAD);
// z grows south in-sim; put the sealed northern frontier (zMax) at the top
const sz = (z) => PAD + ((ZMAX - z) / (ZMAX - ZMIN)) * (H - 2 * PAD);

const roadPaths = ROADS.map(
  (pts) => `<polyline points="${pts.map((p) => `${sx(p.x)},${sz(p.z)}`).join(' ')}"
    fill="none" stroke="#8a6d3b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 10" />`,
).join('\n');

const campMarkers = CAMPS.map(
  (c) => `<circle cx="${sx(c.center.x)}" cy="${sz(c.center.z)}" r="${
    (c.radius / (XMAX - XMIN)) * (W - 2 * PAD)
  }" fill="#7a2e2e" fill-opacity="0.12" stroke="#7a2e2e" stroke-width="2" stroke-dasharray="4 4" />
  <text x="${sx(c.center.x)}" y="${
    sz(c.center.z) + (c.radius / (XMAX - XMIN)) * (W - 2 * PAD) + 18
  }" font-size="13" fill="#7a2e2e" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic">${c.mobId}</text>`,
).join('\n');

const poiMarkers = POIS.map((p) => {
  const isGate = p.label === 'The Hollow Gate';
  const r = isGate ? 10 : 7;
  const color = isGate ? '#b8860b' : '#2f4f2f';
  return `<circle cx="${sx(p.x)}" cy="${sz(p.z)}" r="${r}" fill="${color}" stroke="#fff" stroke-width="2" />
  <text x="${sx(p.x)}" y="${sz(p.z) - r - 8}" font-size="18" fill="#2b2b2b" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="${isGate ? 'bold' : 'normal'}">${p.label}</text>`;
}).join('\n');

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e9e3c9" />
      <stop offset="100%" stop-color="#cfe0b8" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#f4f1e6" />
  <rect x="${PAD}" y="${PAD}" width="${W - 2 * PAD}" height="${H - 2 * PAD}" fill="url(#ground)" stroke="#5b5030" stroke-width="2" />

  <!-- sealed frontier: the zMax boundary shared with Eastbrook Vale, walled off -->
  <line x1="${PAD}" y1="${sz(ZMAX)}" x2="${W - PAD}" y2="${sz(ZMAX)}" stroke="#5b2020" stroke-width="6" />
  <text x="${W / 2}" y="${sz(ZMAX) + 22}" font-size="15" fill="#5b2020" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif">sealed frontier (Eastbrook Vale, no pass)</text>

  <!-- south edge label -->
  <text x="${W / 2}" y="${sz(ZMIN) + 30}" font-size="14" fill="#6b6b6b" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif">zone edge (z = ${ZMIN})</text>

  ${roadPaths}

  <!-- lake -->
  <circle cx="${sx(LAKE.x)}" cy="${sz(LAKE.z)}" r="${(LAKE.radius / (XMAX - XMIN)) * (W - 2 * PAD)}" fill="#4a7fa5" fill-opacity="0.55" stroke="#2d5a78" stroke-width="2" />

  ${campMarkers}

  <!-- graveyard -->
  <g>
    <rect x="${sx(GRAVEYARD.x) - 8}" y="${sz(GRAVEYARD.z) - 8}" width="16" height="16" fill="#555" stroke="#fff" stroke-width="1.5" transform="rotate(45 ${sx(GRAVEYARD.x)} ${sz(GRAVEYARD.z)})" />
    <text x="${sx(GRAVEYARD.x)}" y="${sz(GRAVEYARD.z) + 26}" font-size="13" fill="#555" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif">graveyard</text>
  </g>

  ${poiMarkers}

  <!-- gate hub radius -->
  <circle cx="${sx(GATE.x)}" cy="${sz(GATE.z)}" r="${(22 / (XMAX - XMIN)) * (W - 2 * PAD)}" fill="none" stroke="#b8860b" stroke-width="1.5" stroke-dasharray="3 3" />

  <text x="${W / 2}" y="36" font-size="26" fill="#2b2b2b" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold">The Hollow Reaches</text>
  <text x="${W / 2}" y="58" font-size="14" fill="#6b6b6b" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif">starter zone schematic, PHAA-420 (levels 1-4)</text>

  <!-- legend -->
  <g font-family="Georgia, 'Times New Roman', serif" font-size="13" fill="#2b2b2b">
    <circle cx="${PAD + 10}" cy="${H - 34}" r="7" fill="#b8860b" stroke="#fff" stroke-width="1.5" />
    <text x="${PAD + 24}" y="${H - 29}">Hollow Gate (hub / exit portal to the vase)</text>
    <circle cx="${PAD + 10}" cy="${H - 14}" r="6" fill="#2f4f2f" stroke="#fff" stroke-width="1.5" />
    <text x="${PAD + 24}" y="${H - 9}">Named POI</text>
    <circle cx="${W - 220}" cy="${H - 34}" r="7" fill="#7a2e2e" fill-opacity="0.3" stroke="#7a2e2e" />
    <text x="${W - 205}" y="${H - 29}">Wildlife camp</text>
    <line x1="${W - 220}" y1="${H - 14}" x2="${W - 190}" y2="${H - 14}" stroke="#8a6d3b" stroke-width="4" stroke-dasharray="2 6" />
    <text x="${W - 180}" y="${H - 9}">Road</text>
  </g>
</svg>
`;

const OUT = 'docs/screenshots/phaa-420';
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/hollow_reaches_map.svg`, svg);
await sharp(Buffer.from(svg)).png().toFile(`${OUT}/hollow_reaches_map.png`);
console.log(`wrote ${OUT}/hollow_reaches_map.png`);
