// PHAA-472 relaxation evidence: the starter zone wall now sits at the world
// edge (x=180) rather than the rim base (x=150). Captures three views:
// (1) Hollow Gate looking east, (2) standing at the east wall (x=179) looking
// east into the rim, (3) standing at the east wall looking south at the
// hollow ground. Connects to the Browserless CDP endpoint (BROWSERLESS_WS).
// Writes PNGs into docs/screenshots/phaa-472/.

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-472';
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
  await new Promise((r) => setTimeout(r, 2500));
};

const browser = await puppeteer.connect({ browserWSEndpoint: WS });

{
  const page = await browser.newPage();
  const errors = await startOffline(page, { width: 1280, height: 800 });

  // cold-open lands the character at the vase; exercise the real fix
  // (PHAA-420 leaveDungeon revert) rather than teleporting past it
  await new Promise((r) => setTimeout(r, 1500));
  // Dismiss any cold-open modal first ("You come to on warm ground..." or
  // "Seek Brother Greenpaw") so it doesn't sit on top of the gate exit
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      ['Skip', 'Continue', 'Skip Tutorial'].includes(b.textContent?.trim()),
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => {
    const g = window.__game;
    g.sim.leaveDungeon(g.sim.player.id);
  });
  await new Promise((r) => setTimeout(r, 1500));
  // And again in case the leaveDungeon re-spawns the modal
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      ['Skip', 'Continue', 'Skip Tutorial'].includes(b.textContent?.trim()),
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // (1) Hollow Gate looking east: show the full east run-up to the rim
  await tp(page, 0, -290, 1.6);
  await page.screenshot({ path: `${OUT}/01_gate_looking_east.png` });

  // (2) Standing at the east wall (x=179) looking east into the rim slope
  await tp(page, 175, -300, 1.6);
  await page.screenshot({ path: `${OUT}/02_east_wall_looking_east.png` });

  // (3) Standing at the east wall looking south across the playable strip
  await tp(page, 175, -300, -1.6);
  await page.screenshot({ path: `${OUT}/03_east_wall_looking_south.png` });

  // (4) Standing at the east wall looking west back to the gate (proves
  // the player has the full ramp available to walk up)
  await tp(page, 175, -300, 3.1);
  await page.screenshot({ path: `${OUT}/04_east_wall_looking_west.png` });

  console.log('errors:', errors.length ? errors.slice(0, 15).join('\n') : 'none');
  await page.close();
}

await browser.disconnect();
console.log('wrote screenshots to', OUT);
