// PHAA-415 acceptance shots: the greener hub register (canopy ceiling, mossy
// fog, stage-0 flora, glow accents). Connects to a remote Browserless CDP
// endpoint (BROWSERLESS_WS) instead of launching a local browser; the dev
// server must be reachable from that endpoint (GAME_URL). Writes PNGs into
// docs/screenshots/phaa-415/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-415';
fs.mkdirSync(OUT, { recursive: true });

const HUB_X = 4500;
const HUB_Z = -1250;

async function startOffline(page, viewport) {
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
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

// --- desktop pass -----------------------------------------------------------
{
  const page = await browser.newPage();
  const errors = await startOffline(page, { width: 1280, height: 800 });

  // wide overview from the gate walk, looking north at the vase under the canopy
  await tp(page, HUB_X, HUB_Z - 20, 0);
  await page.screenshot({ path: `${OUT}/hub_greener_overview_desktop.png` });

  // vase closeup: glow flowers ringing the centerpiece
  await tp(page, HUB_X - 6, HUB_Z + 6, 2.4);
  await page.screenshot({ path: `${OUT}/hub_greener_vase_desktop.png` });

  // mid-hall: ferns, shrubs, wall vines, dappled pools
  await tp(page, HUB_X - 2, HUB_Z + 40, 0);
  await page.screenshot({ path: `${OUT}/hub_greener_hall_desktop.png` });

  console.log('desktop pass errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await page.close();
}

// --- phone pass -------------------------------------------------------------
{
  const page = await browser.newPage();
  const errors = await startOffline(page, {
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
  });

  await tp(page, HUB_X, HUB_Z - 20, 0);
  await page.screenshot({ path: `${OUT}/hub_greener_overview_phone.png` });

  console.log('phone pass errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await page.close();
}

await browser.disconnect();
console.log('wrote screenshots to', OUT);
