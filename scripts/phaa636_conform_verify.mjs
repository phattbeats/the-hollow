// PHAA-636 (Sable): in-engine verify of the body-CONFORMING wardrobe re-skin.
// Spawns npc_shade through the real WebGL pipeline (roster_compare_harness) and
// drives the WALK clip to prove the wardrobe deforms WITH the body (no clipping),
// plus static shots for z-fighting / visibility. Needs `npm run dev` + Browserless.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.25:5173';
const OUT = process.env.OUT ?? 'docs/screenshots/phaa-636/conform';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({ browserWSEndpoint: WS, protocolTimeout: 240000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message.slice(0, 160)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 160));
});
const [OX, OZ] = [40, 40];
const SX = OX + 1.15;
async function freezeCam(camOff, lookOff) {
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
  await sleep(200);
}
async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log('shot', name);
}
async function tickWalk(steps) {
  await page.evaluate((steps) => {
    const WALK = {
      speed: 2.2,
      moving: true,
      airborne: false,
      backwards: false,
      dead: false,
      casting: false,
      swimming: false,
      sitting: false,
    };
    for (let i = 0; i < steps; i++) window.__shadeVisual.update(1 / 20, WALK, true);
  }, steps);
  await sleep(120);
}
try {
  await page.setViewport({ width: 820, height: 980 });
  log('goto');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
  log('offline');
  await page.evaluate(() => document.querySelector('#btn-offline').click());
  await sleep(300);
  await page.type('#char-name', 'Sable');
  await page.evaluate(() =>
    document.querySelector('#offline-select .mini-class[data-class="warrior"]').click(),
  );
  await page.evaluate(() => document.querySelector('#btn-start-offline').click());
  await sleep(400);
  await page.evaluate(() => {
    const b = document.getElementById('mobile-preflight-continue');
    if (b) b.click();
  });
  log('wait player');
  await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 80000, polling: 300 });
  await sleep(500);
  await page.evaluate(() => document.querySelector('.cold-open-skip')?.click());
  await page.evaluate(() => {
    const bs = [...document.querySelectorAll('button')];
    bs.find((b) => b.textContent?.includes('Skip Tutorial'))?.click();
  });
  await sleep(400);
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
  await sleep(500);
  log('spawn shade');
  const info = await page.evaluate(async () => {
    const mod = await import('/src/render/characters/roster_compare_harness.ts');
    const res = await mod.spawnRosterCompare(window.__game, { key: 'npc_shade', offsetX: 1.15 });
    window.__shadeVisual = res.visual;
    return { scale: res.scale, spawnPos: res.spawnPos };
  });
  log('spawned', JSON.stringify(info));
  await sleep(400);
  // idle shots first (cheap, prove visibility + z-fight)
  await freezeCam([0, 1.5, 3.4], [0, 1.2, 0]);
  await shot('idle_full_front');
  await freezeCam([0, 1.15, 2.0], [0, 1.0, 0]);
  await shot('idle_torso_front');
  await freezeCam([2.5, 1.5, 2.3], [0, 1.2, 0]);
  await shot('idle_full_3q');
  await freezeCam([3.2, 1.5, 0.2], [0, 1.2, 0]);
  await shot('idle_side');
  await freezeCam([0, 2.05, 2.3], [0, 2.0, 0]);
  await shot('idle_head');
  // walk cycle
  await freezeCam([0, 1.5, 3.4], [0, 1.2, 0]);
  await tickWalk(8);
  await shot('walk_p1_front');
  await tickWalk(5);
  await shot('walk_p2_front');
  await tickWalk(5);
  await shot('walk_p3_front');
  await freezeCam([2.6, 1.5, 2.2], [0, 1.2, 0]);
  await tickWalk(5);
  await shot('walk_p4_3q');
  await freezeCam([3.2, 1.4, 0.2], [0, 1.15, 0]);
  await tickWalk(5);
  await shot('walk_p5_side');
  log('errors:', errors.length ? errors.slice(0, 12).join(' | ') : 'none');
  log('DONE');
} catch (e) {
  log('CAUGHT', String(e).slice(0, 200));
  log('errors so far:', errors.slice(0, 12).join(' | '));
} finally {
  try {
    await page.close();
  } catch {}
  try {
    await browser.disconnect();
  } catch {}
}
