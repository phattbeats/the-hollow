// Visual check for the customizable performance overlay. Boots the offline game
// in headless Chromium, enables the overlay with a rich metric set, and saves
// screenshots of the in-world overlay + the Options > Performance panel to tmp/.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { BROWSER_PATH as EDGE } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
fs.mkdirSync('tmp', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--window-size=1600,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text()); });

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('#btn-offline', { timeout: 15000 });
await page.evaluate(() => document.querySelector('#btn-offline').click());
await new Promise((r) => setTimeout(r, 250));
await page.type('#char-name', 'Adventurer');
await page.click('#offline-select .mini-class[data-class="warrior"]');
await page.click('#btn-start-offline');
await page.waitForFunction(() => window.__game && window.__game.hud && window.__game.hud.optionsHooks, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

// Enable the overlay and turn on a rich set of metrics + the graph.
const applied = await page.evaluate(() => {
  const hud = window.__game.hud;
  const h = hud.optionsHooks;
  h.onSettingChange('showFps', true);
  h.perfOverlay.patch({
    graph: true,
    thresholds: true,
    metrics: {
      fps: true, frameTime: true, fps1Low: true, fps01Low: true,
      ping: true, jitter: true, snapshot: true, connection: true,
      drawCalls: true, triangles: true, geometries: true, textures: true,
      programs: true, renderScale: true, gpu: true, memory: true,
      hitches: true, entities: true,
    },
  });
  return h.perfOverlay.get();
});
console.log('config:', JSON.stringify(applied.metrics));

// Let the frame meter warm up + repaint a few times.
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: 'tmp/perf_overlay_world.png' });
const box = await page.evaluate(() => {
  const el = document.querySelector('#perf-overlay');
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height, visible: getComputedStyle(el).display };
});
console.log('overlay box:', JSON.stringify(box));
if (box.width > 0) {
  await page.screenshot({
    path: 'tmp/perf_overlay_crop.png',
    clip: { x: Math.max(0, box.x - 6), y: Math.max(0, box.y - 6), width: box.width + 12, height: box.height + 12 },
  });
}

// Open Options > Performance and screenshot the panel.
await page.evaluate(() => window.__game.hud.toggleOptionsMenu());
await new Promise((r) => setTimeout(r, 150));
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('#options-menu .opt-btn')].find((b) => /Performance/i.test(b.textContent));
  btn?.click();
});
await new Promise((r) => setTimeout(r, 250));
const panel = await page.evaluate(() => {
  const el = document.querySelector('#options-menu');
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
await page.screenshot({
  path: 'tmp/perf_overlay_panel.png',
  clip: { x: Math.max(0, panel.x), y: Math.max(0, panel.y), width: panel.width, height: Math.min(panel.height, 900 - panel.y) },
});
console.log('panel box:', JSON.stringify(panel));

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
