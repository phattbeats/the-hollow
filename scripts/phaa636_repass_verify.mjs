// PHAA-636 re-pass (Sable): authoritative in-engine verify of the retextured
// bespoke wardrobe (headscarf + apron + satchel + willow-leaf texture tell)
// through the real WebGL pipeline via roster_compare_harness + Browserless.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.33:5173';
const OUT = process.env.OUT ?? 'docs/screenshots/phaa-636';
fs.mkdirSync(OUT, { recursive: true });

async function startOffline(page, viewport, cls = 'warrior', name = 'Sable') {
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => document.querySelector('#btn-offline').click());
  await new Promise((r) => setTimeout(r, 200));
  await page.type('#char-name', name);
  await page.evaluate(
    (c) => document.querySelector(`#offline-select .mini-class[data-class="${c}"]`).click(),
    cls,
  );
  await page.evaluate(() => document.querySelector('#btn-start-offline').click());
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const b = document.getElementById('mobile-preflight-continue');
    if (b) b.click();
  });
  await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 90000, polling: 250 });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('.cold-open-skip')?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const bs = [...document.querySelectorAll('button')];
    bs.find((b) => b.textContent?.includes('Skip Tutorial'))?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  return errors;
}

const spawnCompare = async (page, key, offsetX) =>
  page.evaluate(
    async (key, offsetX) => {
      const mod = await import('/src/render/characters/roster_compare_harness.ts');
      return mod.spawnRosterCompare(window.__game, { key, offsetX });
    },
    key,
    offsetX,
  );

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = await startOffline(page, { width: 900, height: 1000 });
const [OX, OZ] = [40, 40];
await page.evaluate(
  (x, z) => {
    const p = window.__game.sim.player;
    p.maxHp = p.hp = 99999;
    p.pos.x = x;
    p.pos.z = z;
  },
  OX,
  OZ,
);
await new Promise((r) => setTimeout(r, 500));
const info = await spawnCompare(page, 'npc_shade', 1.15);
console.log('spawn info:', JSON.stringify(info));
await new Promise((r) => setTimeout(r, 700));

// freeze camera; SX = shade world x
const SX = OX + 1.15;
async function shot(name, camOff, lookOff) {
  await page.evaluate(
    (sx, z, camOff, lookOff) => {
      const g = window.__game;
      g.renderer.updateCamera = () => {};
      const gy = g.sim.player.pos.y;
      const cam = g.renderer.camera;
      cam.position.set(sx + camOff[0], gy + camOff[1], z + camOff[2]);
      cam.lookAt(sx + lookOff[0], gy + lookOff[1], z + lookOff[2]);
    },
    SX,
    OZ,
    camOff,
    lookOff,
  );
  await new Promise((r) => setTimeout(r, 350));
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
// chibi: head crown sits high; full body ~gy+1.2 center, head ~gy+2.0
await shot('re_full_front', [0, 1.5, 3.4], [0, 1.2, 0]);
await shot('re_full_3q', [2.4, 1.5, 2.4], [0, 1.2, 0]);
await shot('re_torso_front', [0, 1.15, 2.0], [0, 1.0, 0]);
await shot('re_apron_hem', [0, 0.62, 1.05], [0, 0.5, 0]);
await shot('re_head_front', [0, 2.05, 2.3], [0, 2.0, 0]);
await shot('re_head_3q', [1.5, 2.1, 1.9], [0, 2.0, 0]);
await shot('re_hip_left', [-1.9, 0.9, 1.3], [-0.2, 0.75, 0]);
await shot('re_back', [0, 1.5, -3.4], [0, 1.2, 0]);
console.log('errors:', errors.length ? errors.slice(0, 25).join('\n') : 'none');
await page.close();
await browser.disconnect();
console.log('DONE wrote to', OUT);
