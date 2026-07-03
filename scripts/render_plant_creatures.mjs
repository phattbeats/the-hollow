// Render the PHAA-437 procedural plant-creature preview sheets. Drives the
// remote Browserless Chrome (this container has no local Chromium) running the
// esbuild bundle of scripts/plant_render_entry.js, which calls the REAL
// src/render generator. One contact sheet per archetype (idle), plus a motion
// sheet showing idle / attack / hit for the same seed.
//
// Prereq: bundle the entry first:
//   npx esbuild scripts/plant_render_entry.js --bundle --format=iife --outfile=tmp/plant_render_bundle.js
// Run:
//   node scripts/render_plant_creatures.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS || 'ws://10.0.0.100:3000';
const OUT = process.argv[2] || 'tmp/plant_shots';
mkdirSync(OUT, { recursive: true });

const BUNDLE = 'tmp/plant_render_bundle.js';
if (!existsSync(BUNDLE)) {
  console.error(`missing ${BUNDLE}: bundle the entry first (see header)`);
  process.exit(1);
}
const bundle = readFileSync(BUNDLE, 'utf8');
const html = `<!doctype html><html><head><meta charset="utf8"><style>html,body{margin:0;background:#14171d}</style></head><body><script>${bundle}</script></body></html>`;

const SEEDS = [11, 42, 108, 256, 517, 823];

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
let pageErr = 0;
page.on('pageerror', (e) => {
  pageErr++;
  console.error('PAGEERR', e.message);
});
page.on('console', (m) => {
  if (m.type() === 'error') console.error('CONSOLE', m.text());
});

await page.setContent(html, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 30000 });

async function sheet(opts, outName) {
  const dataUrl = await page.evaluate((o) => window.renderPlantSheet(o), opts);
  writeFileSync(path.join(OUT, outName), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`ok ${outName}`);
}

const ARCHETYPES = [
  ['palefeeder', 'Palefeeder (emberbulb) - idle'],
  ['rootmaw', 'Rootmaw (cave morsel) - idle'],
  ['witness_root', 'The Witness-Root (boss) - idle'],
];

for (const [archetype, title] of ARCHETYPES) {
  await sheet(
    { archetype, seeds: SEEDS, cols: 3, cellPx: 420, pose: 'idle', title },
    `${archetype}_idle.png`,
  );
}

// motion sheet: one seed of each archetype in idle / attack / hit
await sheet(
  {
    archetype: 'rootmaw',
    seeds: [42, 42, 42],
    cols: 3,
    cellPx: 460,
    pose: 'idle',
    title: 'Rootmaw seed 42 - idle | (see attack/hit sheets)',
  },
  'rootmaw_idle_single.png',
);
await sheet(
  {
    archetype: 'rootmaw',
    seeds: [42, 108, 517],
    cols: 3,
    cellPx: 460,
    pose: 'attack',
    title: 'Rootmaw - attack (maw open, crown lunges)',
  },
  'rootmaw_attack.png',
);
await sheet(
  {
    archetype: 'witness_root',
    seeds: [9, 42, 823],
    cols: 3,
    cellPx: 460,
    pose: 'attack',
    title: 'Witness-Root - attack lunge',
  },
  'witness_root_attack.png',
);
await sheet(
  {
    archetype: 'palefeeder',
    seeds: [11, 42, 256],
    cols: 3,
    cellPx: 460,
    pose: 'hit',
    title: 'Palefeeder - hit-react recoil',
  },
  'palefeeder_hit.png',
);

await browser.close();
console.log(`\nrendered sheets -> ${OUT}  pageErrors=${pageErr}`);
