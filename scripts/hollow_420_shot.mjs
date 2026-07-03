// PHAA-420 acceptance shots requested by Brandon on the issue thread: the
// Hollow Reaches open-world starter zone plus its landmarks. Connects to a
// remote Browserless CDP endpoint (BROWSERLESS_WS) instead of launching a
// local browser; the dev server must be reachable from that endpoint
// (GAME_URL). Writes PNGs into docs/screenshots/phaa-420/. Not committed;
// uploaded as issue attachments instead.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-420';
fs.mkdirSync(OUT, { recursive: true });

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

{
  const page = await browser.newPage();
  const errors = await startOffline(page, { width: 1280, height: 800 });

  // cold-open lands the character at the vase; exercise the real fix (this
  // ticket's leaveDungeon revert) rather than teleporting past it.
  await new Promise((r) => setTimeout(r, 1000));
  await page.evaluate(() => {
    const g = window.__game;
    g.sim.leaveDungeon(g.sim.player.id);
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${OUT}/01_gate_exit.png` });

  // wide overview of the gate clearing, looking down the road split
  await tp(page, 0, -270, 3.1);
  await page.screenshot({ path: `${OUT}/02_gate_clearing.png` });

  // world map window, opened at the full-zone view
  await page.evaluate(() => window.__game.hud.toggleMap());
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT}/03_map_window.png` });
  await page.evaluate(() => window.__game.hud.toggleMap());

  // Fallow Acres (west road, wolf camp, homestead candidate ground)
  await tp(page, -46, -246, 1.2);
  await page.screenshot({ path: `${OUT}/04_fallow_acres.png` });

  // Root Hollow (south road, boar camp)
  await tp(page, 40, -350, 0);
  await page.screenshot({ path: `${OUT}/05_root_hollow.png` });

  // Mossbank / the lake
  await tp(page, 42, -235, 4.7);
  await page.screenshot({ path: `${OUT}/06_mossbank_lake.png` });

  console.log('errors:', errors.length ? errors.slice(0, 15).join('\n') : 'none');
  await page.close();
}

await browser.disconnect();
console.log('wrote screenshots to', OUT);
