// PHAA-697 full-body grip evidence: pulls back the camera to show head-to-toe.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.32:5174';
const OUT = process.env.OUT ?? 'docs/screenshots/phaa-697';
fs.mkdirSync(OUT, { recursive: true });

const KEYS = [
  'player_warrior_f',
  'player_paladin_f',
  'player_hunter_f',
  'player_druid_f',
  'player_rogue_f',
  'player_warlock_f',
  'player_mage_f',
  'player_priest_f',
  'player_shaman_f',
];

async function startOffline(page) {
  await page.setViewport({ width: 800, height: 1000 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForSelector('#btn-offline', { timeout: 90000 });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('#btn-offline').click());
  await new Promise(r => setTimeout(r, 200));
  await page.type('#char-name', 'Sable');
  await page.evaluate(c => document.querySelector(`#offline-select .mini-class[data-class="${c}"]`).click(), 'warrior');
  await page.evaluate(() => document.querySelector('#btn-start-offline').click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const btn = document.getElementById('mobile-preflight-continue'); if (btn) btn.click(); });
  await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 90000, polling: 250 });
  await page.evaluate(() => { const p = window.__game.sim.player; p.maxHp = p.hp = 99999; });
  await new Promise(r => setTimeout(r, 500));
  for (let i = 0; i < 5; i++) {
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter(
        b => b.offsetParent && /skip|continue|close|ok|begin|got it/i.test(b.textContent ?? '')
      );
      if (btns.length) { btns[0].click(); return true; }
      return false;
    });
    if (!clicked) break;
    await new Promise(r => setTimeout(r, 400));
  }
  return errors;
}

const CAM_YAW = Math.PI / 2;

const setup = async (page) => {
  await page.evaluate((camYaw) => {
    const g = window.__game;
    const p = g.sim.player;
    if (p.dead) g.sim.releaseSpirit?.();
    p.maxHp = p.hp = 99999;
    p.pos.x = 60; p.pos.z = 60;
    p.facing = camYaw + Math.PI;
    // Pull back far enough for full-body chibi (height ~2.3) plus weapon overhead
    g.input.camYaw = camYaw;   g.renderer.camYaw = camYaw;
    g.input.camPitch = 0.22;   g.renderer.camPitch = 0.22; // slightly steeper look-down
    g.input.camDist = 9;       g.renderer.camDist = 9;      // wide enough for full body
    const view = g.renderer.views.get(p.id);
    if (view) view.group.visible = false;
  }, CAM_YAW);
};

const spawnCompare = async (page, key) =>
  page.evaluate(async (key) => {
    const g = window.__game;
    g.sim.player.maxHp = g.sim.player.hp = 99999;
    const mod = await import('/src/render/characters/roster_compare_harness.ts');
    return mod.spawnRosterCompare(g, { key, offsetX: 0 });
  }, key);

const clearCompareVisuals = async (page) =>
  page.evaluate(() => {
    const scene = window.__game.renderer.scene;
    const stale = scene.children.filter(c => c.name?.startsWith('roster_compare_'));
    for (const obj of stale) scene.remove(obj);
  });

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = await startOffline(page);
if (errors.length) console.log('startup errors:', errors.slice(0,5).join('\n'));

const allInfo = {};
for (const key of KEYS) {
  await clearCompareVisuals(page);
  const info = await spawnCompare(page, key);
  allInfo[key] = info;
  await setup(page);
  await new Promise(r => setTimeout(r, 1600));
  const path = `${OUT}/${key}.png`;
  await page.screenshot({ path });
  console.log(`shot ${key} -> ${path} (visualHeight=${info?.visualHeight?.toFixed(3) ?? '?'})`);
}

console.log('errors:', errors.length ? errors.slice(0,10).join('\n') : 'none');
fs.writeFileSync(`${OUT}/spawn_info.json`, JSON.stringify(allInfo, null, 2));
await page.close();
await browser.disconnect();
console.log('done. wrote', KEYS.length, 'screenshots to', OUT);
