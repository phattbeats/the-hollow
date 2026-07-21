// PHAA-657 acceptance: the Bramble Hold moderation jail scene (Plant-World
// reskin, no borrowed dungeon-kit art). Connects to a remote Browserless CDP
// endpoint (BROWSERLESS_WS) instead of launching a local browser; the dev
// server must be reachable from that endpoint (GAME_URL, --host bound).
// Writes PNGs into docs/screenshots/phaa-657/ (not committed).

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-657';
fs.mkdirSync(OUT, { recursive: true });

// src/sim/content/jail.ts JAIL_CENTER
const JAIL_X = -9000;
const JAIL_Z = -9000;

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
  // Dismiss the one-time cold-open lore intro, then the first-errand tutorial
  // card, so neither obscures the scene.
  await page.evaluate(() => document.querySelector('.cold-open-skip')?.click());
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => document.querySelector('.tut-skip')?.click());
  await new Promise((r) => setTimeout(r, 200));
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

  // wide overview from just outside the yard, looking in at the cage
  await tp(page, JAIL_X, JAIL_Z - 26, 0);
  await page.screenshot({ path: `${OUT}/jail_overview.png` });

  // inside the cage, looking at the bramble bars and spore lanterns
  await tp(page, JAIL_X, JAIL_Z, 1.6);
  await page.screenshot({ path: `${OUT}/jail_cage_interior.png` });

  // close on a corner post / gnarled bar cluster
  await tp(page, JAIL_X - 10, JAIL_Z - 10, 2.4);
  await page.screenshot({ path: `${OUT}/jail_cage_closeup.png` });

  console.log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await page.close();
}

await browser.disconnect();
console.log('wrote screenshots to', OUT);
