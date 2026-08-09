// Visual proof for PHAA-573 slice 3: the Protect Yumi maze renders a real body
// for its collision corridors. Boots the offline client, teleports the player
// into the far-east yumi band (the maze streams in on entry), and screenshots
// a pulled-back establishing shot plus a corridor-level view.
//
// Needs a client server. Local browser: `npm run dev` on :5173 then
//   node scripts/phaa573_yumi_maze_shot.mjs
// Browserless: set BROWSERLESS_WS and GAME_URL (an address the browser host can
// reach), e.g.
//   GAME_URL=http://172.19.0.2:5173 BROWSERLESS_WS=ws://10.0.0.100:3000 \
//     node scripts/phaa573_yumi_maze_shot.mjs

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const WS = process.env.BROWSERLESS_WS ?? '';
fs.mkdirSync('tmp', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

let browser;
if (WS) {
  browser = await puppeteer.connect({ browserWSEndpoint: WS });
} else {
  const { BROWSER_PATH } = await import('./browser_path.mjs');
  browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: 'new',
    args: [
      '--window-size=1600,1000',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
    ],
    defaultViewport: { width: 1600, height: 1000 },
  });
}

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`);
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(2500);
// Drive the offline flow with evaluate-clicks (the buttons are hidden behind
// the play flow, so page.click's visibility check rejects them).
await page.evaluate(() => document.querySelector('#btn-offline')?.click());
await sleep(600);
await page.evaluate(() => {
  document.querySelector('#char-name').value = 'Yumiward';
  const sel =
    document.querySelector('#offline-select .mini-class[data-class="mage"]') ??
    document.querySelector('#offline-select .mini-class');
  sel?.click();
  document.querySelector('#btn-start-offline')?.click();
});
await page.waitForFunction(() => window.__game?.sim?.player != null, {
  timeout: 70000,
  polling: 300,
});
await sleep(1500);

// Teleport into the first yumi maze slot centre and frame the maze from above.
const placed = await page.evaluate(() => {
  const g = window.__game;
  const sim = g.sim;
  const p = sim.player;
  p.gm = true;
  // yumiMazeOrigin(0): x = YUMI_MAZE_X (8400), z = YUMI_MAZE_Z0 (-1250).
  const ox = 8400;
  const oz = -1250;
  p.pos.x = ox;
  p.pos.z = oz;
  p.prevPos = { ...p.pos };
  g.input.camYaw = 0;
  g.input.camPitch = 0.9; // look down to read the corridors
  g.input.camDist = 60;
  return { x: p.pos.x, z: p.pos.z };
});
console.log('player at', placed);
await sleep(3500); // let the band stream in + fog settle

await page.screenshot({ path: 'tmp/phaa573_yumi_maze_top.png' });

// Drop to a corridor eye-level shot.
await page.evaluate(() => {
  const g = window.__game;
  g.input.camPitch = 0.25;
  g.input.camDist = 8;
});
await sleep(1500);
await page.screenshot({ path: 'tmp/phaa573_yumi_maze_corridor.png' });

console.log('shots written to tmp/phaa573_yumi_maze_*.png');
if (errors.length) console.log('PAGE ERRORS:\n' + errors.slice(0, 20).join('\n'));
await page.close();
if (WS) await browser.disconnect();
else await browser.close();
