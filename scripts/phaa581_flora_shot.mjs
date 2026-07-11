// PHAA-581 acceptance shots: otherworldly plant-creature flora clustered
// around the Hollow Reaches camps and NPC posts. Connects to a remote
// Browserless CDP endpoint (BROWSERLESS_WS); the dev server must be reachable
// from that endpoint (GAME_URL). Writes PNGs into tmp/phaa-581/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'tmp/phaa-581';
fs.mkdirSync(OUT, { recursive: true });

async function startOffline(page, viewport) {
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });
  await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
  await page.waitForSelector('#btn-offline', { timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1500));
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
  // dismiss the cold-open intro dialog (and any follow-up pane) so shots are clean
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter(
        (b) => b.offsetParent && /skip|continue|close|ok/i.test(b.textContent ?? ''),
      );
      if (btns.length) {
        btns[0].click();
        return true;
      }
      return false;
    });
    if (!clicked) break;
  }
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
const page = await browser.newPage();
const errors = await startOffline(page, { width: 1280, height: 800 });

// wolf camp at Fallow Acres (-46,-246): approach from the south looking north
await tp(page, -46, -262, 0);
await page.screenshot({ path: `${OUT}/wolf_camp_north.png` });

// second wolf camp (-64,-222) from the north looking south
await tp(page, -64, -210, Math.PI);
await page.screenshot({ path: `${OUT}/wolf_camp2_south.png` });

// boar camp at Root Hollow (40,-350) from the north looking south
await tp(page, 40, -336, Math.PI);
await page.screenshot({ path: `${OUT}/boar_camp_south.png` });

// NPC post (34,-334) close-up looking toward the post
await tp(page, 26, -326, Math.PI * 0.75);
await page.screenshot({ path: `${OUT}/npc_post_closeup.png` });

// north edge of the starter zone looking into vanilla zone1: flora stops here
await tp(page, 0, -196, 0);
await page.screenshot({ path: `${OUT}/zone_boundary_north.png` });

console.log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
await page.close();
await browser.disconnect();
console.log('wrote screenshots to', OUT);
