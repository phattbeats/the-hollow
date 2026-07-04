// PHAA-430 acceptance shots: the Blender-modeled ornate urn + dried-flower
// bouquet vase (replacing the old procedural terracotta placeholder) and its
// very slight breathing pulse on the bouquet. Connects to a remote
// Browserless CDP endpoint (BROWSERLESS_WS) instead of launching a local
// browser; the dev server must be reachable from that endpoint (GAME_URL).
// Writes PNGs into docs/screenshots/phaa-430/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-430';
fs.mkdirSync(OUT, { recursive: true });

async function startOffline(page, viewport) {
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`);
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
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Skip Tutorial',
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  return errors;
}

// PHAA-431's cold-open modal ("You come to on warm ground...") covers the
// view on first hub entry; dismiss it with Skip if present.
const dismissColdOpen = async (page) => {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      ['Skip', 'Continue', 'Skip Tutorial'].includes(b.textContent?.trim()),
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 300));
};

const enterHub = async (page) => {
  await page.evaluate(() => {
    const sim = window.__game.sim;
    sim.enterDungeon('the_hollow', sim.playerId);
    const p = sim.entities.get(sim.playerId);
    p.maxHp = p.hp = 99999;
  });
};

const vasePos = async (page) =>
  page.evaluate(() => {
    const sim = window.__game.sim;
    const greenpaw = [...sim.entities.values()].find(
      (e) => e.kind === 'npc' && e.templateId === 'brother_greenpaw',
    );
    // Greenpaw sits at hub-local (3, 4), the vase at hub-local (0, 0)
    // (VASE_POS, src/sim/content/hollow.ts), same derivation as
    // hollow_hearth_shot.mjs.
    return { x: greenpaw.pos.x - 3, y: greenpaw.pos.y, z: greenpaw.pos.z - 4 };
  });

const lookAt = (camX, camZ, targetX, targetZ) => Math.atan2(targetX - camX, targetZ - camZ);

const standAt = async (page, x, z, facing) => {
  await page.evaluate(
    (x, z, facing) => {
      const g = window.__game;
      const p = g.sim.player;
      if (p.dead) g.sim.releaseSpirit();
      p.maxHp = p.hp = 99999;
      p.pos.x = x;
      p.pos.z = z;
      p.facing = facing;
      g.input.camYaw = facing;
    },
    x,
    z,
    facing,
  );
  await new Promise((r) => setTimeout(r, 3500));
};

const browser = await puppeteer.connect({ browserWSEndpoint: WS });

const page = await browser.newPage();
const errors = await startOffline(page, { width: 1280, height: 800 });

await enterHub(page);
await dismissColdOpen(page);
const vase = await vasePos(page);
console.log('vase at', JSON.stringify(vase));

// Let the hub props (the vase GLTF, canopy, etc.) stream in on first entry.
await new Promise((r) => setTimeout(r, 4000));
await dismissColdOpen(page);
await dismissColdOpen(page);

// Wide establishing shot, a few paces south facing the vase.
await standAt(page, vase.x, vase.z - 6, lookAt(vase.x, vase.z - 6, vase.x, vase.z));
await page.screenshot({ path: `${OUT}/vase_00_wide.png` });

// Tight close-up on the urn + bouquet itself.
await standAt(page, vase.x, vase.z - 2.5, lookAt(vase.x, vase.z - 2.5, vase.x, vase.z + 1));
await page.screenshot({ path: `${OUT}/vase_01_closeup_a.png` });
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${OUT}/vase_02_closeup_b.png` });
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${OUT}/vase_03_closeup_c.png` });

console.log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
await page.close();
await browser.disconnect();
console.log('wrote screenshots to', OUT);
