// PHAA-502 T2a proof shots: the baked accessory meshes (Knight_Helmet +
// Knight_HelmetVisor for the helm, Knight_Cape for the cloak) on the male chibi
// warrior are now driven by the wearer's `equippedItems`. Boots
// the offline client as a warrior, then drives the player entity's `equippedItems`
// through four states (bare -> helmet -> helmet+chest -> bare again) and captures a
// tight shot of each so the equip/unequip toggle is visible. Each shot also reads
// the actual mesh `.visible` flags off the rendered warrior as a hard assertion.
//
// The renderer's per-frame diff reads `e.equippedItems` and calls setArmor, which
// runs setBakedArmorVisibility: no inventory/equip UI is needed to exercise the
// render path this ticket delivers (the sim-side equip flow is pre-existing and out
// of T2a scope). Uses real helmet + chest item ids so the map mirrors a true set.
//
// Connects to Browserless (no local Chromium in this container). Run with:
//   env -u NODE_ENV npx vite --host --port 5211   (in the worktree)
//   GAME_URL=http://<container-ip>:5211 node scripts/phaa603_baked_armor_shot.mjs

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5211';
const OUT = process.env.OUT_DIR ?? 'tmp/phaa603';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROG = `${OUT}/progress.log`;
fs.writeFileSync(PROG, '');
const step = (m) => {
  const line = `[${new Date().toISOString()}] ${m}\n`;
  fs.appendFileSync(PROG, line);
  process.stdout.write(line);
};

const HELMET = 'cryptbone_helm'; // slot: 'helmet'
const CHEST = 'recruit_tunic'; // slot: 'chest'

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
// Always release the Browserless session, even on a thrown step: a leaked session
// holds a concurrency slot and makes later runs hang.
const bail = async (why, err) => {
  try {
    fs.appendFileSync(PROG, `BAIL ${why}: ${err?.message ?? err}\n`);
  } catch {}
  try {
    await browser.disconnect();
  } catch {}
  process.exit(3);
};
process.on('unhandledRejection', (e) => bail('unhandledRejection', e));
process.on('uncaughtException', (e) => bail('uncaughtException', e));
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`);
});

// domcontentloaded, not networkidle0: the offline client keeps retrying /api
// stats (harmless 502s), so the network never goes idle and networkidle0 hangs.
// The readiness poll below is the real gate.
step('goto');
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(1500);
step('wait #btn-offline');
await page.waitForSelector('#btn-offline', { visible: true, timeout: 30000 });
await page.evaluate(() => document.querySelector('#btn-offline').click());
step('wait #char-name');
await page.waitForSelector('#char-name', { visible: true, timeout: 15000 });
await sleep(400); // let the panel settle before typing
await page.type('#char-name', 'Ironhelm');
await page.waitForSelector('#offline-select .mini-class[data-class="warrior"]', {
  visible: true,
  timeout: 15000,
});
// DOM .click() rather than page.click(): bypasses the interactability race while
// the panel is still animating in (page.click threw "not clickable").
await page.evaluate(() => {
  document.querySelector('#offline-select .mini-class[data-class="warrior"]').click();
  document.querySelector('#btn-start-offline').click();
});
step('started, polling for readiness');

// Poll for the offline game + player view to come up (dep-optimize boot is slow).
let ready = null;
for (let i = 0; i < 90; i++) {
  ready = await page.evaluate(() => {
    const g = window.__game;
    if (!g?.sim?.player || !g.renderer?.views) return null;
    const p = g.sim.player;
    return { cls: p.templateId, sex: p.sex ?? 'm', hasView: g.renderer.views.has(p.id) };
  });
  if (ready?.hasView) break;
  await sleep(700);
}
step(`ready poll done: ${JSON.stringify(ready)}`);
if (!ready?.hasView) {
  console.error('game/player view never came up:', JSON.stringify(ready), errors.slice(0, 6));
  await browser.disconnect();
  process.exit(1);
}
console.log(`ready: ${JSON.stringify(ready)}  visualKey=player_${ready.cls}`);

// Dismiss the cold-open intro modal (it fades the world from black); the lit
// world only shows once it is gone.
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) =>
    /^\s*Skip\s*$/i.test(b.textContent ?? ''),
  );
  btn?.click();
});
await sleep(1500);

// God-mode, hold still, zoom the chase cam in on the warrior (ends up roughly
// front-on, so the helmet A/B reads clearly; the back cape is confirmed by the
// mesh-visibility assertion below rather than the camera). Start bare.
await page.evaluate(() => {
  const g = window.__game;
  const p = g.sim.player;
  p.gm = true;
  p.hp = p.maxHp = 99999;
  const inp = g.input;
  inp.camYaw = Math.PI;
  inp.camPitch = 0.28;
  inp.camDist = 5.5;
  p.equippedItems = {};
});
await sleep(800);

async function shot(name, equipped, label) {
  step(`shot ${name}: set equip`);
  await page.evaluate((eq) => {
    // fresh object reference each time so the renderer's per-frame diff fires
    window.__game.sim.player.equippedItems = { ...eq };
  }, equipped);
  await sleep(1000); // let a few ticks paint the swap
  await page.screenshot({ path: `${OUT}/${name}.png` });
  step(`shot ${name}: captured`);
  const visible = await page.evaluate(() => {
    const g = window.__game;
    const p = g.sim.player;
    const model = g.renderer.views.get(p.id)?.visual?.model;
    if (!model) return null;
    const out = {};
    for (const node of ['Knight_Helmet', 'Knight_HelmetVisor', 'Knight_Cape']) {
      const o =
        model.getObjectByName(node) ?? model.getObjectByName(node.replace(/[^a-zA-Z0-9]/g, ''));
      out[node] = o ? o.visible : 'missing';
    }
    return out;
  });
  console.log(`${label}: ${name}.png  meshVisible=${JSON.stringify(visible)}`);
  return visible;
}

const results = {
  bare: await shot('01_bare', {}, 'bare (nothing equipped)'),
  helmet: await shot('02_helmet', { helmet: HELMET }, 'helmet equipped'),
  full: await shot('03_helmet_chest', { helmet: HELMET, chest: CHEST }, 'helmet + chest'),
  unequip: await shot('04_unequipped', {}, 'unequipped again'),
};

// Hard pass/fail on the mesh visibility flags.
const helm = (r) => r?.Knight_Helmet === true && r?.Knight_HelmetVisor === true;
const noHelm = (r) => r?.Knight_Helmet === false && r?.Knight_HelmetVisor === false;
const ok =
  noHelm(results.bare) &&
  results.bare?.Knight_Cape === false &&
  helm(results.helmet) &&
  results.helmet?.Knight_Cape === false &&
  helm(results.full) &&
  results.full?.Knight_Cape === true &&
  noHelm(results.unequip) &&
  results.unequip?.Knight_Cape === false;
console.log(`\nVISIBILITY ASSERTION: ${ok ? 'PASS' : 'FAIL'}`);
console.log('errors:', errors.slice(0, 6));
await browser.disconnect();
await sleep(200);
process.exitCode = ok ? 0 : 2;
