// Screenshot a Drowned Litany polygon-shell room to eyeball the wall spans.
// Offline single-player; needs a dev server (GAME_URL). Writes OUT (default
// tmp/litany_wall.png). Used to produce docs/screenshots/drowned-litany-wall-spans.

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'tmp/litany_wall.png';
const MODULE_INDEX = Number(process.env.MODULE_INDEX ?? 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('tmp', { recursive: true });

// BROWSER_WS attaches to a remote Chrome (browserless); otherwise launch local.
const browser = process.env.BROWSER_WS
  ? await puppeteer.connect({ browserWSEndpoint: process.env.BROWSER_WS })
  : await puppeteer.launch({
      executablePath: BROWSER_PATH,
      headless: 'new',
      protocolTimeout: 60000,
      args: [
        '--window-size=1280,820',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
      ],
    });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 820 });
page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 200)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(1200);
await page.evaluate(() => document.querySelector('#btn-offline')?.click());
await sleep(600);
await page.evaluate(() => {
  document.querySelector('#offline-select .mini-class[data-class="warrior"]')?.click();
  const n = document.querySelector('#char-name');
  if (n) n.value = 'Wallcheck';
  document.querySelector('#btn-start-offline')?.click();
});
await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 120000, polling: 300 });

await page.evaluate(() => {
  const sim = window.__game.sim;
  sim.setPlayerLevel(20);
  // Step out of the hub interior band first: canEnterDelve rejects a player
  // standing inside a dungeon/hub x band.
  const p = sim.player;
  p.pos.x = 0;
  p.pos.z = 0;
  p.prevPos = { ...p.pos };
  sim.enterDelve('drowned_litany', 'normal');
});
await sleep(3000);

await page.evaluate(async () => {
  const dl = await import('/src/sim/delve_layout.ts');
  const data = await import('/src/sim/data.ts');
  window.__DELVE_LAYOUTS = dl.DELVE_MODULE_LAYOUTS;
  window.__delveModuleZOffset = data.delveModuleZOffset;
});

const mods = await page.evaluate(() => {
  const sim = window.__game.sim;
  return sim.delveRunForPlayer(sim.playerId).modules.slice();
});
console.log('modules:', mods.join(', '));

await page.evaluate((target) => {
  const sim = window.__game.sim;
  const run = sim.delveRunForPlayer(sim.playerId);
  while (run.moduleIndex < target && run.moduleIndex < run.modules.length - 1) {
    run.exitPortalOpen = true;
    sim.advanceDelveModule(run);
  }
}, MODULE_INDEX);
await sleep(3000);

await page.evaluate(() => {
  const sim = window.__game.sim;
  const run = sim.delveRunForPlayer(sim.playerId);
  const id = run.modules[run.moduleIndex];
  const L = window.__DELVE_LAYOUTS[id];
  const zBase = window.__delveModuleZOffset(run.modules, run.moduleIndex);
  const p = sim.player;
  p.pos.x = run.origin.x + 2;
  p.pos.z = run.origin.z + zBase + (L.zMin + L.zMax) / 2;
  p.pos.y = 0;
  p.prevPos = { ...p.pos };
  p.facing = -Math.PI / 2;
});
await sleep(1500);
// Dismiss the intro story modal so it does not cover the room.
await page.evaluate(() => {
  for (const b of document.querySelectorAll('button')) {
    if ((b.textContent ?? '').trim().toLowerCase() === 'skip') b.click();
  }
});
await sleep(1500);
await page.screenshot({ path: OUT });
console.log('wrote', OUT, 'module', mods[MODULE_INDEX]);
await page.close();
if (process.env.BROWSER_WS) await browser.disconnect();
else await browser.close();
