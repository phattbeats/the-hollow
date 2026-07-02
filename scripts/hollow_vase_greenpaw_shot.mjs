// PHAA-402 follow-up acceptance shots: the vase now blocks movement (no more
// walking into the urn/hearth), and Brother Greenpaw uses his real hero model
// (PHAA-413 v1) instead of the generic npc_villager placeholder. Connects to
// a remote Browserless CDP endpoint (BROWSERLESS_WS); the dev server must be
// reachable from that endpoint (GAME_URL). Writes PNGs into docs/pr-assets/.
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
  // actually enter the hub instance: claims the slot, so Greenpaw (an
  // instance-resident NPC, sim/instances/dungeons.ts claimInstance) spawns
  await page.evaluate(() => {
    const g = window.__game;
    g.sim.enterDungeon('the_hollow', g.sim.player.id);
  });
  await new Promise((r) => setTimeout(r, 500));
  return errors;
}

const tp = async (page, x, z, yaw = 0, wait = 4000) => {
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

// walk-into-the-vase: place the player a few units south of it, hold the
// real "move forward" key through the game's own loop, then release. If the
// collider works the body stops short of the vase instead of clipping in.
const walkInto = async (page) => {
  await tp(page, HUB_X, HUB_Z - 3, 0, 300);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', repeat: false }));
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
  });
  await new Promise((r) => setTimeout(r, 300));
  return page.evaluate(() => {
    const p = window.__game.sim.player;
    return { x: p.pos.x - 4500, z: p.pos.z - -1250 };
  });
};

const browser = await puppeteer.connect({ browserWSEndpoint: WS });

// --- desktop pass -----------------------------------------------------------
{
  const page = await browser.newPage();
  const errors = await startOffline(page, { width: 1280, height: 800 });

  // wide overview from the gate
  await tp(page, HUB_X, HUB_Z - 20, 0);
  await page.screenshot({ path: `${OUT}/hollow-hub-vase-greenpaw-overview-desktop.png` });

  // walk straight into the vase and take the resting position
  const rest = await walkInto(page);
  console.log('walk-into-vase resting local pos:', rest);
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT}/hollow-hub-vase-blocked-desktop.png` });

  // vase side angle, close, to show the collider stopping the body from clipping
  await tp(page, HUB_X - 3, HUB_Z, -Math.PI / 2, 3000);
  await page.screenshot({ path: `${OUT}/hollow-hub-vase-side-desktop.png` });

  // Brother Greenpaw, his real hero model
  await tp(page, HUB_X, HUB_Z + 1, 1.3, 3000);
  await page.screenshot({ path: `${OUT}/hollow-hub-greenpaw-desktop.png` });

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
  await page.screenshot({ path: `${OUT}/hollow-hub-vase-greenpaw-overview-phone.png` });

  await tp(page, HUB_X, HUB_Z + 1, 1.3, 3000);
  await page.screenshot({ path: `${OUT}/hollow-hub-greenpaw-phone.png` });

  console.log('phone pass errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await page.close();
}

await browser.disconnect();
console.log('wrote screenshots to', OUT);
