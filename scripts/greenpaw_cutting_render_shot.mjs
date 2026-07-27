// PHAA-772 live render smoke: capture the Greenpaw's cutting companion contact
// sheet over the remote Browserless Chrome (this container has no local
// Chromium). Drives the esbuild bundle of scripts/greenpaw_cutting_render_entry.js,
// which calls the REAL createPlantMobVisual dispatch for the three rolled
// variants (dawn/moss/ash).
//
// Bundle first, then run (both handled here):
//   node scripts/greenpaw_cutting_render_shot.mjs [outDir]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS || 'ws://10.0.0.100:3000';
const OUT = process.argv[2] || 'qa/screenshots/phaa-772';
mkdirSync(OUT, { recursive: true });
mkdirSync('tmp', { recursive: true });

const BUNDLE = 'tmp/greenpaw_cutting_render_bundle.js';
console.log('bundling entry...');
execFileSync(
  'npx',
  [
    'esbuild',
    'scripts/greenpaw_cutting_render_entry.js',
    '--bundle',
    '--format=iife',
    '--loader:.ts=ts',
    `--outfile=${BUNDLE}`,
  ],
  { stdio: 'inherit' },
);

const bundle = readFileSync(BUNDLE, 'utf8');
// The gfx module (pulled in by createPlantMobVisual) probes localStorage at
// import; under setContent's opaque origin that getter throws SecurityError, so
// shim a no-op store BEFORE the bundle runs (paid for on PHAA-552, see
// docs/qa-screenshot-harnesses.md).
const shim = `Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});`;
const html = `<!doctype html><html><head><meta charset="utf8"><style>html,body{margin:0;background:#14171d}</style></head><body><script>${shim}</script><script>${bundle}</script></body></html>`;

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

const dataUrl = await page.evaluate(() => window.renderGreenpawSheet({ ids: [408, 512, 777] }));
const outFile = path.join(OUT, 'greenpaw_cutting_variants.png');
writeFileSync(outFile, Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log(`ok -> ${outFile}  pageErrors=${pageErr}`);

await browser.close();
if (pageErr > 0) process.exit(1);
