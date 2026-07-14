// PHAA-697 acceptance evidence: renders the female class bodies (player_<cls>_f)
// through the production roster pipeline (roster_compare_harness -> CharacterVisual
// -> assembleModel/attach) so the class-default held weapon mounts on the chibi
// DEF-hand bones. Tight close-up per class (one per grip family) to eyeball grip
// placement/scale. Connects to remote Browserless (BROWSERLESS_WS); GAME_URL must
// be reachable from there. Writes PNGs into docs/screenshots/phaa-697/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.32:5174';
const OUT = 'docs/screenshots/phaa-697';
fs.mkdirSync(OUT, { recursive: true });

// One key per distinct grip family (covers all six: 1H_Sword, 1H_Axe,
// 1H_Crossbow, 2H_Staff, Knife dual-wield, 1H_Wand + spellbook offhand).
const KEYS = process.env.KEYS
  ? process.env.KEYS.split(',')
  : [
      'player_warrior_f',
      'player_paladin_f',
      'player_hunter_f',
      'player_druid_f',
      'player_rogue_f',
      'player_warlock_f',
    ];

async function startOffline(page, viewport, cls = 'warrior', name = 'Sable') {
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForSelector('#btn-offline', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 400));
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
    const btn = document.getElementById('mobile-preflight-continue');
    if (btn) btn.click();
  });
  await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 90000, polling: 250 });
  await page.evaluate(() => {
    const p = window.__game.sim.player;
    p.maxHp = p.hp = 99999;
  });
  await new Promise((r) => setTimeout(r, 500));
  for (let i = 0; i < 5; i++) {
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter(
        (b) => b.offsetParent && /skip|continue|close|ok|begin|got it/i.test(b.textContent ?? ''),
      );
      if (btns.length) {
        btns[0].click();
        return true;
      }
      return false;
    });
    if (!clicked) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  return errors;
}

// Keep the offline player alive but hide its own body, so only the spawned
// compare visual is on screen, centered. The compare inherits player.facing, and
// the follow-cam looks along +camYaw with the player facing AWAY, so face the
// compare toward the camera with facing = camYaw + PI to get a clean front view.
const CAM_YAW = Math.PI / 2;
const setup = async (page) => {
  await page.evaluate((camYaw) => {
    const g = window.__game;
    const p = g.sim.player;
    if (p.dead) g.sim.releaseSpirit?.();
    p.maxHp = p.hp = 99999;
    p.pos.x = 60;
    p.pos.z = 60;
    p.facing = camYaw + Math.PI; // face the camera
    g.input.camYaw = camYaw;
    g.renderer.camYaw = camYaw;
    g.input.camPitch = 0.14;
    g.renderer.camPitch = 0.14;
    g.input.camDist = 4.8;
    g.renderer.camDist = 4.8;
    const view = g.renderer.views.get(p.id);
    if (view) view.group.visible = false; // hide the player's own body
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
    const stale = scene.children.filter((c) => c.name?.startsWith('roster_compare_'));
    for (const obj of stale) scene.remove(obj);
  });

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = await startOffline(page, { width: 700, height: 1000 });

const allInfo = {};
for (const key of KEYS) {
  await clearCompareVisuals(page);
  const info = await spawnCompare(page, key);
  allInfo[key] = info;
  await setup(page);
  await new Promise((r) => setTimeout(r, 1400));
  await page.screenshot({ path: `${OUT}/${key}.png` });
  console.log(`shot ${key}`);
}

console.log('errors:', errors.length ? errors.slice(0, 30).join('\n') : 'none');
fs.writeFileSync(`${OUT}/spawn_info.json`, JSON.stringify(allInfo, null, 2));
await page.close();
await browser.disconnect();
console.log('wrote screenshots to', OUT);
