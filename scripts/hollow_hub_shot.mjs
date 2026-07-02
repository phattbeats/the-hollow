// PHAA-402 acceptance: the Hollow hub's warm root-and-soil register, the vase
// centerpiece + smoke, and the first HOLLOW_PROPS dressing slice, at desktop
// and mid-tier phone viewports. Needs `npm run dev` (:5173). Writes PNGs into
// docs/screenshots/phaa-402/ (not committed; PR comment links use the two
// committed copies under docs/pr-assets/).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

import { BROWSER_PATH as EDGE } from './browser_path.mjs';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-402';
fs.mkdirSync(OUT, { recursive: true });

// hub instance origin: instanceOrigin(the_hollow.index=6, slot=0) in sim/data.ts
const HUB_X = 4500;
const HUB_Z = -1250;

async function startOffline(page, viewport) {
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => document.querySelector('#btn-offline').click());
  await new Promise((r) => setTimeout(r, 200));
  await page.type('#char-name', 'Wren');
  await page.evaluate(() =>
    document.querySelector('#offline-select .mini-class[data-class="warrior"]').click(),
  );
  await page.evaluate(() => document.querySelector('#btn-start-offline').click());
  // phone viewports show the "Play in Landscape Fullscreen" preflight modal
  // (src/main.ts, #mobile-preflight) over the loading screen; dismiss it.
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const btn = document.getElementById('mobile-preflight-continue');
    if (btn) btn.click();
  });
  await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 60000, polling: 250 });
  await page.evaluate(() => {
    const p = window.__game.sim.player;
    p.maxHp = p.hp = 99999;
  });
  return errors;
}

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
  await new Promise((r) => setTimeout(r, 2500));
};

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: [
    '--window-size=1280,800',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    ...(process.env.PUPPETEER_NO_SANDBOX ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
  ],
  defaultViewport: { width: 1280, height: 800 },
});

// --- desktop pass: overview, vase closeup, props dressing -------------------
{
  const page = await browser.newPage();
  const errors = await startOffline(page, { width: 1280, height: 800 });

  // wide overview of the hub clearing from the gate walk, looking north at the vase
  await tp(page, HUB_X, HUB_Z - 20, 0);
  await page.screenshot({ path: `${OUT}/hub_overview_desktop.png` });

  // vase centerpiece close-up: hub-local (0,0), camera pulled back a few yards
  // so the smoke column reads against the torches behind it
  await tp(page, HUB_X - 6, HUB_Z + 6, 2.4);
  await page.screenshot({ path: `${OUT}/hub_vase_closeup_desktop.png` });

  // props dressing slice: south colonnade crates + the garden croft fence,
  // hub-local roughly (-13..11, -12..14)
  await tp(page, HUB_X - 2, HUB_Z + 10, -1.6);
  await page.screenshot({ path: `${OUT}/hub_props_dressing_desktop.png` });

  console.log('desktop pass errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await page.close();
}

// --- phone pass: overview + vase closeup, touch UI active ------------------
{
  const page = await browser.newPage();
  const errors = await startOffline(page, { width: 390, height: 844, isMobile: true, hasTouch: true });

  await tp(page, HUB_X, HUB_Z - 20, 0);
  await page.screenshot({ path: `${OUT}/hub_overview_phone.png` });

  await tp(page, HUB_X - 6, HUB_Z + 6, 2.4);
  await page.screenshot({ path: `${OUT}/hub_vase_closeup_phone.png` });

  console.log('phone pass errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await page.close();
}

await browser.close();
console.log('wrote screenshots to', OUT);
