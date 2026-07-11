// PHAA-551 before/after: mountain crag haze draw-in trim and cooled peaks
// palette, viewed from the Highwatch hub plaza in Thornpeak Heights (the
// fork's only live `peaks` biome zone). Connects to a remote Browserless CDP
// endpoint (BROWSERLESS_WS); the dev server must be reachable from that
// endpoint (GAME_URL). Writes a PNG into docs/screenshots/phaa-551/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-551';
const TAG = process.env.SHOT_TAG ?? 'shot';
fs.mkdirSync(OUT, { recursive: true });

async function startOffline(page, viewport) {
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`);
  });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 45000 });
  await page.evaluate(() => document.querySelector('#btn-offline').click());
  await new Promise((r) => setTimeout(r, 200));
  await page.type('#char-name', 'Wren');
  await page.evaluate(() =>
    document.querySelector('#offline-select .mini-class[data-class="warrior"]').click(),
  );
  await page.evaluate(() => document.querySelector('#btn-start-offline').click());
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const btn = document.getElementById('mobile-preflight-continue');
    if (btn) btn.click();
  });
  await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 90000, polling: 250 });
  await page.evaluate(() => {
    const p = window.__game.sim.player;
    p.maxHp = p.hp = 99999;
  });
  return errors;
}

const dismissColdOpen = async (page) => {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      ['Skip', 'Continue', 'Skip Tutorial'].includes(b.textContent?.trim()),
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 300));
};

const tp = async (page, x, z, yaw = 0) => {
  await page.evaluate(
    (x, z, yaw) => {
      const g = window.__game;
      const p = g.sim.player;
      if (p.dead) g.sim.releaseSpirit();
      p.maxHp = p.hp = 99999;
      p.pos.x = x;
      p.pos.z = z;
      p.facing = yaw;
      g.input.camYaw = yaw;
    },
    x,
    z,
    yaw,
  );
  await new Promise((r) => setTimeout(r, 3500));
};

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = await startOffline(page, { width: 1280, height: 800 });

await new Promise((r) => setTimeout(r, 1000));
await dismissColdOpen(page);
await page.evaluate(() => window.__game.sim.leaveDungeon(window.__game.sim.player.id));
await new Promise((r) => setTimeout(r, 1500));
await dismissColdOpen(page);
await dismissColdOpen(page);

// Highwatch hub plaza, looking north up the ridge road: the distant hills
// carry both the BIOME_FOG draw-in trim and the cooled peaks palette.
const SPOT = JSON.parse(process.env.SHOT_SPOT ?? '[0,650,3.14]');
await tp(page, SPOT[0], SPOT[1], SPOT[2]);
await new Promise((r) => setTimeout(r, 1500));

const file = `${OUT}/${TAG}_hub.png`;
await page.screenshot({ path: file });
console.log('Saved', file);
console.log('Console/page errors:', JSON.stringify(errors));

await browser.close();
