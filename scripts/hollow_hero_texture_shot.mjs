// PHAA-414 acceptance shots: Brother Greenpaw's textured hero model (the
// material/shader coating pass) rendering in the real client, not just a
// Blender preview. Connects to a remote Browserless CDP endpoint
// (BROWSERLESS_WS); the dev server must be reachable from that endpoint
// (GAME_URL). Writes PNGs into docs/pr-assets/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/pr-assets';
fs.mkdirSync(OUT, { recursive: true });

const HUB_X = 4500;
const HUB_Z = -1250;

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
  await page.evaluate(() => {
    const g = window.__game;
    g.sim.enterDungeon('the_hollow', g.sim.player.id);
  });
  await new Promise((r) => setTimeout(r, 500));
  return errors;
}

const tp = async (page, x, z, yaw = 0, wait = 2500) => {
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
  await new Promise((r) => setTimeout(r, wait));
};

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = await startOffline(page, { width: 1280, height: 800 });

// Greenpaw stands at local (3,4)
await tp(page, HUB_X + 1, HUB_Z + 3.2, 1.9, 3000);
await page.screenshot({ path: `${OUT}/hollow-hero-textures-greenpaw-hub-desktop.png` });

await tp(page, HUB_X + 2.2, HUB_Z + 3.4, 2.7, 3000);
await page.screenshot({ path: `${OUT}/hollow-hero-textures-greenpaw-closeup-desktop.png` });

console.log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
await browser.disconnect();
console.log('done');
