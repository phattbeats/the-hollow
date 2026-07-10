// PHAA-552 support-variety acceptance shots. Bundles readable_supports_scene.mjs
// (the real buildReadable geometry) with esbuild, then renders it headless on a
// remote Browserless over CDP and writes PNGs. No dev server / GLB boot needed:
// the scene is self-contained, so page.setContent with the inlined bundle draws
// the exact procedural props the world builds. Writes into docs/screenshots/phaa-552/.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const OUT = path.join(root, 'docs/screenshots/phaa-552');
fs.mkdirSync(OUT, { recursive: true });

// Bundle the scene to a single browser-ready IIFE.
const entry = path.join(here, 'readable_supports_scene.mjs');
const bundlePath = path.join(root, 'node_modules/.cache/phaa552_scene.js');
fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
execFileSync(
  path.join(root, 'node_modules/.bin/esbuild'),
  [entry, '--bundle', '--format=iife', '--loader:.ts=ts', `--outfile=${bundlePath}`],
  { stdio: 'inherit', cwd: root },
);
const bundle = fs.readFileSync(bundlePath, 'utf8');

const html = (hash) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>readable supports</title></head>` +
  `<body></body>` +
  // Under setContent the page has an opaque origin, so window.localStorage's
  // getter throws SecurityError; the game's gfx module probes it at import. Shim
  // a no-op store before the bundle so that access is benign in the shot.
  `<script>try{Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:function(){return null;},setItem:function(){},removeItem:function(){}}});}catch(e){}</script>` +
  `<script>window.__errs=[];window.onerror=(m,s,l,c)=>window.__errs.push(m+' @'+l+':'+c);location.hash=${JSON.stringify(hash)};</script>` +
  `<script>${bundle}</script></html>`;

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
try {
  for (const [hash, file] of [
    ['page', '10_supports_page.png'],
    ['journal', '11_supports_journal.png'],
  ]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`CONSOLE: ${m.text()}`));
    await page.setViewport({ width: 1400, height: 720, deviceScaleFactor: 2 });
    await page.setContent(html(hash), { waitUntil: 'load', timeout: 30000 });
    try {
      await page.waitForFunction(() => window.__shotReady === true, { timeout: 20000 });
    } catch {
      const diag = await page.evaluate(() => ({
        errs: window.__errs ?? [],
        ready: window.__shotReady ?? false,
        gl: (() => {
          try {
            return !!document.createElement('canvas').getContext('webgl2');
          } catch (e) {
            return `gl-check-threw: ${e.message}`;
          }
        })(),
      }));
      console.error(
        `[${hash}] not ready:`,
        JSON.stringify(diag),
        'page errors:',
        errors.join(' | '),
      );
      throw new Error(`scene ${hash} did not become ready`);
    }
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({ path: path.join(OUT, file) });
    console.log(`wrote ${file}`, errors.length ? `errors: ${errors.join(' | ')}` : '(no errors)');
    await page.close();
  }
} finally {
  await browser.disconnect();
}
console.log('done ->', OUT);
