// PHAA-609 verification: does an unhelmed male paladin render with no head?
// PR #222 gates `Paladin_Helmet` behind the `helmet` equip slot via
// `bakedArmorSlots`, mirroring the T2a warrior pattern. The warrior GLB has a
// separate always-on `Knight_Head` node so a bare head still shows under the
// helmet; `paladin.glb` has no such node (only Body/Cape/Arm*/Leg*/Helmet).
// This script boots a paladin bare (no helmet), screenshots it, and captures
// mesh visibility + the model's rendered bounding box to check whether a head
// is present when Paladin_Helmet is hidden.
//
// Connects to Browserless (no local Chromium in this container). Run with:
//   env -u NODE_ENV npx vite --host --port 5212   (in the worktree)
//   GAME_URL=http://<container-ip>:5212 node scripts/phaa609_paladin_headless_shot.mjs

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5212';
const OUT = process.env.OUT_DIR ?? 'tmp/phaa609_paladin';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROG = `${OUT}/progress.log`;
fs.writeFileSync(PROG, '');
const step = (m) => {
  const line = `[${new Date().toISOString()}] ${m}\n`;
  fs.appendFileSync(PROG, line);
  process.stdout.write(line);
};

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
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

step('goto');
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(1500);
step('wait #btn-offline');
await page.waitForSelector('#btn-offline', { visible: true, timeout: 30000 });
await page.evaluate(() => document.querySelector('#btn-offline').click());
step('wait #char-name');
await page.waitForSelector('#char-name', { visible: true, timeout: 15000 });
await sleep(400);
await page.type('#char-name', 'Barehead');
await page.waitForSelector('#offline-select .mini-class[data-class="paladin"]', {
  visible: true,
  timeout: 15000,
});
await page.evaluate(() => {
  document.querySelector('#offline-select .mini-class[data-class="paladin"]').click();
  document.querySelector('#btn-start-offline').click();
});
step('started, polling for readiness');

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

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) =>
    /^\s*Skip\s*$/i.test(b.textContent ?? ''),
  );
  btn?.click();
});
await sleep(1500);

await page.evaluate(() => {
  const g = window.__game;
  const p = g.sim.player;
  p.gm = true;
  p.hp = p.maxHp = 99999;
  const inp = g.input;
  inp.camYaw = Math.PI;
  inp.camPitch = 0.15;
  inp.camDist = 3.2; // tight face-level shot
  p.equippedItems = {}; // bare, no helmet
});
await sleep(1000);

// fresh object reference so the renderer's per-frame diff fires
await page.evaluate(() => {
  window.__game.sim.player.equippedItems = {};
});
await sleep(1000);
await page.screenshot({ path: `${OUT}/01_bare_facecam.png` });

const info = await page.evaluate(() => {
  const g = window.__game;
  const p = g.sim.player;
  const model = g.renderer.views.get(p.id)?.visual?.model;
  if (!model) return null;
  const out = { nodes: {} };
  for (const node of [
    'Paladin_Helmet',
    'Paladin_Body',
    'Paladin_Cape',
    'Paladin_ArmLeft',
    'Paladin_ArmRight',
    'Paladin_LegLeft',
    'Paladin_LegRight',
  ]) {
    const o = model.getObjectByName(node);
    out.nodes[node] = o ? o.visible : 'missing';
  }
  return out;
});
console.log('mesh visibility (bare, no helmet):', JSON.stringify(info, null, 2));

// Wide, slightly elevated shot too, for full-body context.
await page.evaluate(() => {
  const inp = window.__game.input;
  inp.camDist = 5.5;
  inp.camPitch = 0.28;
});
await sleep(600);
await page.screenshot({ path: `${OUT}/02_bare_full.png` });

// Now equip a helmet for comparison.
await page.evaluate(() => {
  window.__game.sim.player.equippedItems = { helmet: 'test_helmet' };
});
await sleep(1000);
await page.evaluate(() => {
  const inp = window.__game.input;
  inp.camDist = 3.2;
  inp.camPitch = 0.15;
});
await sleep(500);
await page.screenshot({ path: `${OUT}/03_helmeted_facecam.png` });
const infoHelmeted = await page.evaluate(() => {
  const g = window.__game;
  const p = g.sim.player;
  const model = g.renderer.views.get(p.id)?.visual?.model;
  if (!model) return null;
  const out = {};
  for (const node of ['Paladin_Helmet', 'Paladin_Body']) {
    const o = model.getObjectByName(node);
    out[node] = o ? o.visible : 'missing';
  }
  return out;
});
console.log('mesh visibility (helmeted):', JSON.stringify(infoHelmeted, null, 2));

console.log('errors:', errors.slice(0, 6));
await browser.disconnect();
await sleep(200);
step('done');
