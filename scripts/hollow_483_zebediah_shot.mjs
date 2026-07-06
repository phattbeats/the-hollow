// PHAA-483 verification shots: Verger Zebediah's 25% height bump (near player
// parity) and the slide-fade-on-move fallback for his clip-less rig (no
// baked walk animation exists in his GLB; see manifest.ts's npc_zebediah
// comment). Connects to a remote Browserless CDP endpoint (BROWSERLESS_WS);
// the dev server must be reachable from that endpoint (GAME_URL). Writes PNGs
// into docs/screenshots/phaa-483/. Not committed; uploaded as issue
// attachments instead.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-483';
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
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => document.querySelector('.cold-open-skip')?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    btns.find((b) => b.textContent?.includes('Skip Tutorial'))?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  return errors;
}

const tp = async (page, x, z, yaw = 0, settleMs = 3500) => {
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
      g.renderer.camYaw = yaw; // snap the actual chase-cam yaw, no smoothed turn to wait out
    },
    x,
    z,
    yaw,
  );
  await new Promise((r) => setTimeout(r, settleMs));
};

// Teleports right up next to Zebediah's LIVE wander position (rather than a
// fixed spot), so every shot is an equally close comparison regardless of
// where he currently is in his 40s wander circle. A short settle (not the
// usual 3.5s) keeps him from drifting back out of frame before the shot.
const tpNextToZebediah = async (page) => {
  const zPos = await page.evaluate(() => {
    const e = [...window.__game.sim.entities.values()].find(
      (e) => e.kind === 'npc' && e.templateId === 'verger_zebediah',
    );
    return { x: e.pos.x, z: e.pos.z };
  });
  await tp(page, zPos.x - 5, zPos.z, Math.PI / 2, 400);
};

const browser = await puppeteer.connect({ browserWSEndpoint: WS });

{
  const page = await browser.newPage();
  const errors = await startOffline(page, { width: 1280, height: 800 });

  // Close scale-parity comparison, standing right next to his live position.
  await tpNextToZebediah(page);
  await page.screenshot({ path: `${OUT}/01_zebediah_scale_parity.png` });

  // Re-teleport next to his (now-moved) live position every few seconds: an
  // equally close shot each time, whatever point of his wander circle he's
  // at, so the slide-fade opacity is visible without guessing his path.
  for (const n of [2, 3, 4]) {
    await new Promise((r) => setTimeout(r, 4000));
    await tpNextToZebediah(page);
    await page.screenshot({ path: `${OUT}/0${n}_zebediah_wander_close.png` });
  }

  console.log('errors:', errors.length ? errors.slice(0, 15).join('\n') : 'none');
  await page.close();
}

await browser.disconnect();
console.log('wrote screenshots to', OUT);
