// PHAA-612 definitive probe: the Hollow-family transition doors are dark
// underground, so identify each door's BODY from the live scene graph instead
// of by eye. A shrine-gate body contains the arch_gate kit's named leaf nodes
// (arch_gate_left / arch_gate_right) and renders at nameplate height 8.2; the
// generic stone arch has neither and sits at 4.6.
//
// Verifies, per the PHAA-589 follow-up (commit 0e80c8337):
//   1. overworld dungeon_door(the_hollow)   -> GATE
//   2. hub dungeon_door(under_shrine)        -> GATE
//   3. under_shrine dungeon_exit             -> GATE
//   4. hub dungeon_exit(the_hollow)          -> STONE ARCH (not a 2nd gate)
//      and exactly ONE arch_gate frame stands near the walk-out line (0,-16):
//      the static shrine-gate prop from hollow_props, no doubled mesh.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'tmp/phaa-612';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startOffline(page) {
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#btn-offline', { timeout: 90000 });
  await sleep(1500);
  await page.evaluate(() => document.querySelector('#btn-offline').click());
  await sleep(200);
  await page.type('#char-name', 'Sable');
  await page.evaluate(() =>
    document.querySelector('#offline-select .mini-class[data-class="warrior"]').click(),
  );
  await page.evaluate(() => document.querySelector('#btn-start-offline').click());
  await sleep(300);
  await page.evaluate(() => {
    const btn = document.getElementById('mobile-preflight-continue');
    if (btn) btn.click();
  });
  await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 90000, polling: 250 });
  return errors;
}

// Inspect every live door view: is its body a shrine gate (arch_gate leaves) or
// the stone arch? Also scan the whole scene for arch_gate frames + their world
// x,z so we can count gates near the hub walk-out line.
const inspect = (page) =>
  page.evaluate(() => {
    const g = window.__game;
    const sim = g.sim;
    const raw = sim.entities;
    const ents = Array.isArray(raw) ? raw : [...(raw.values ? raw.values() : raw)];
    const byId = new Map(ents.map((e) => [e.id, e]));
    const views = g.renderer.views;
    const doorRows = [];
    for (const [id, view] of views) {
      const e = byId.get(id);
      if (!e || (e.templateId !== 'dungeon_door' && e.templateId !== 'dungeon_exit')) continue;
      let leftLeaf = false;
      let rightLeaf = false;
      let meshCount = 0;
      view.group.traverse((o) => {
        if (o.name === 'arch_gate_left') leftLeaf = true;
        if (o.name === 'arch_gate_right') rightLeaf = true;
        if (o.isMesh) meshCount++;
      });
      doorRows.push({
        id,
        templateId: e.templateId,
        dungeonId: e.dungeonId ?? null,
        x: Math.round(e.pos.x * 10) / 10,
        z: Math.round(e.pos.z * 10) / 10,
        viewHeight: view.height,
        hasGateLeaves: leftLeaf && rightLeaf,
        body: leftLeaf && rightLeaf ? 'shrine_gate' : 'stone_arch',
        meshCount,
      });
    }
    // Every arch_gate frame anywhere in the scene (door bodies AND the static
    // hollow_props prop), reported at its leaf's world position.
    const gateFrames = [];
    g.renderer.scene.traverse((o) => {
      if (o.name === 'arch_gate_left') {
        const wp = o.getWorldPosition(o.position.clone());
        gateFrames.push({ x: Math.round(wp.x * 10) / 10, z: Math.round(wp.z * 10) / 10 });
      }
    });
    return {
      player: {
        x: sim.player.x ?? sim.player.pos.x,
        z: sim.player.pos.z,
        dungeonId: sim.player.dungeonId ?? null,
      },
      doors: doorRows,
      gateFrames,
    };
  });

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = await startOffline(page);
await sleep(2500); // let hub views build

const report = {};
report.hub = await inspect(page);

await page.evaluate(() =>
  window.__game.sim.enterDungeon('under_shrine', window.__game.sim.player.id),
);
await sleep(2500);
report.under_shrine = await inspect(page);

await page.evaluate(() => window.__game.sim.leaveDungeon(window.__game.sim.player.id));
await sleep(2500);
report.overworld = await inspect(page);

fs.writeFileSync(`${OUT}/body_probe.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await page.close();
await browser.disconnect();
