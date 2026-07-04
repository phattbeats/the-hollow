// One-off preview render for the PHAA-437 Witness-Root redesign pass: boss-like
// mass, thorned tentacles, jagged crown head. Same harness pattern as
// render_plant_creatures.mjs, scoped to witness_root only for this sign-off.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS || 'ws://10.0.0.100:3000';
const OUT = process.argv[2] || 'tmp/witness_root_shots';
mkdirSync(OUT, { recursive: true });

const BUNDLE = 'tmp/plant_render_bundle.js';
if (!existsSync(BUNDLE)) {
  console.error(`missing ${BUNDLE}: bundle the entry first`);
  process.exit(1);
}
const bundle = readFileSync(BUNDLE, 'utf8');
const html = `<!doctype html><html><head><meta charset="utf8"><style>html,body{margin:0;background:#14171d}</style></head><body><script>${bundle}</script></body></html>`;

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

await sheet(
  {
    archetype: 'witness_root',
    seeds: [9, 42, 108, 256, 517, 823],
    cols: 3,
    cellPx: 460,
    pose: 'idle',
    title: 'Witness-Root REDESIGN - idle (thorned tentacles, crown head)',
  },
  'witness_root_redesign_idle.png',
);

await sheet(
  {
    archetype: 'witness_root',
    seeds: [42, 42, 42],
    cols: 3,
    cellPx: 460,
    pose: 'attack',
    title: 'Witness-Root REDESIGN - attack (tentacles lash)',
  },
  'witness_root_redesign_attack.png',
);

await browser.close();
console.log(`\nrendered sheets -> ${OUT}  pageErrors=${pageErr}`);
