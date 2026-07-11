// PHAA-588 Part C: in-world proof. Female chibi spawned beside the live male
// player THROUGH the production roster pipeline (roster_compare_harness ->
// CharacterVisual), so the screenshot exercises the same shadow/lit-material
// path every shipped character uses. Fresh page (not bolted onto the offscreen
// run) for reliability. Time-boxed by an outer `timeout`.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.3:5199/play.html';
const OUT = process.env.OUT_DIR ?? 'evidence';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});
await page.setViewport({ width: 1400, height: 900 });

await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
await page.waitForSelector('#btn-offline', { timeout: 90000 });
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => document.querySelector('#btn-offline').click());
await new Promise((r) => setTimeout(r, 300));
// live reference character is a MALE warrior
await page.evaluate(() => {
  const m = document.querySelector('#offline-select .sex-toggle .sex-opt[data-sex="m"]');
  if (m) m.click();
});
await page.type('#char-name', 'Refman');
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="warrior"]').click(),
);
await page.evaluate(() => document.querySelector('#btn-start-offline').click());
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => {
  const b = document.getElementById('mobile-preflight-continue');
  if (b) b.click();
});
await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 90000, polling: 250 });
await new Promise((r) => setTimeout(r, 600));
for (let i = 0; i < 6; i++) {
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.offsetParent && /skip|continue|close|ok|begin|got it/i.test(x.textContent ?? ''),
    );
    if (b) {
      b.click();
      return true;
    }
    return false;
  });
  if (!clicked) break;
  await new Promise((r) => setTimeout(r, 400));
}

// park the male broadside to the chase cam on flat ground
await page.evaluate(
  (x, z, yaw) => {
    const g = window.__game,
      p = g.sim.player;
    if (p.dead) g.sim.releaseSpirit?.();
    p.maxHp = p.hp = 99999;
    p.pos.x = x;
    p.pos.z = z;
    p.facing = yaw;
    g.input.camYaw = yaw;
    g.renderer.camYaw = yaw;
  },
  60,
  60,
  Math.PI / 2,
);
await new Promise((r) => setTimeout(r, 3000));

async function shootBeside(key, file) {
  await page.evaluate(() => {
    const scene = window.__game.renderer.scene;
    for (const o of scene.children.filter((c) => c.name?.startsWith('roster_compare_')))
      scene.remove(o);
  });
  const info = await page.evaluate(async (k) => {
    const mod = await import('/src/render/characters/roster_compare_harness.ts');
    return mod.spawnRosterCompare(window.__game, { key: k, offsetX: 1.4 });
  }, key);
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${OUT}/${file}.png` });
  console.log(
    `shot ${file}: scale=${info.scale?.toFixed(3)} pHeight=${info.playerHeight?.toFixed(2)} vHeight=${info.visualHeight?.toFixed(2)}`,
  );
  return info;
}

const infos = {};
infos.mage = await shootBeside('player_mage_f', 'inworld_mage_f_beside_male');
infos.warrior = await shootBeside('player_warrior_f', 'inworld_warrior_f_beside_male');

console.log('errors:', errors.length ? errors.slice(0, 20).join('\n') : 'none');
fs.writeFileSync(`${OUT}/inworld_info.json`, JSON.stringify(infos, null, 2));
await page.close();
await browser.disconnect();
console.log('done');
