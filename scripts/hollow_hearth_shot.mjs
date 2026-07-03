// PHAA-421 acceptance shots: Greenpaw's hunger loop and the vase smoke it
// drives. Connects to a remote Browserless CDP endpoint (BROWSERLESS_WS)
// instead of launching a local browser; the dev server must be reachable
// from that endpoint (GAME_URL). Drives sim.addItem/sim.feedGreenpaw
// directly (offline mode) to walk the room through clear -> hazy -> full
// without needing real farming. Writes PNGs into docs/screenshots/phaa-421/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-421';
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
  // Skip the "Hear the Errand" starter tutorial so its dialog box doesn't
  // cover half the shot; it isn't what this feature ticket is showing off.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Skip Tutorial',
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  return errors;
}

// Walk the sim into the Hollow hub instance proper (src/sim/sim.ts
// enterDungeon, the same call tests/greenpaw_hearth.test.ts uses). Greenpaw
// sits at hub-local (3, 4) and the vase at hub-local (0, 0) (VASE_POS,
// src/sim/content/hollow.ts), so once we know his live absolute position we
// can derive the vase's absolute position too (PHAA-420 reshuffled the
// dungeon index / instance-origin band, so old hardcoded hub coords no
// longer line up; only the hub-local offsets from content are stable).
const enterHub = async (page) => {
  await page.evaluate(() => {
    const sim = window.__game.sim;
    sim.enterDungeon('the_hollow', sim.playerId);
    const p = sim.entities.get(sim.playerId);
    p.maxHp = p.hp = 99999;
  });
};

const greenpawAndVasePos = async (page) =>
  page.evaluate(() => {
    const sim = window.__game.sim;
    const greenpaw = [...sim.entities.values()].find(
      (e) => e.kind === 'npc' && e.templateId === 'brother_greenpaw',
    );
    const g = { x: greenpaw.pos.x, y: greenpaw.pos.y, z: greenpaw.pos.z };
    const vase = { x: g.x - 3, y: g.y, z: g.z - 4 };
    return { greenpaw: g, vase };
  });

// forward vector is (sin(facing), cos(facing)) (src/sim/sim.ts movement,
// src/sim/tab_target.ts), so facing a camera at a target is atan2(dx, dz).
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

// A few paces south of Greenpaw (within FEED_RANGE = INTERACT_RANGE + 2 = 7,
// src/sim/greenpaw_hearth.ts), facing him.
const standNearGreenpaw = async (page, greenpaw) => {
  const camX = greenpaw.x;
  const camZ = greenpaw.z - 4;
  await standAt(page, camX, camZ, lookAt(camX, camZ, greenpaw.x, greenpaw.z));
};

// Framing centered on the vase itself, from VASE_LANDING_POS (hub-local
// (0, -6), src/sim/content/hollow.ts): a known-good spot inside the room,
// south of the vase and facing it, where the smoke column reads clearly.
const standFacingVase = async (page, vase) => {
  const camX = vase.x;
  const camZ = vase.z - 6;
  await standAt(page, camX, camZ, lookAt(camX, camZ, vase.x, vase.z));
};

// Feed Greenpaw once with the given item and let a few sim ticks run so the
// vase smoke VFX (src/render/vfx.ts vaseSmoke, driven off
// IWorld.hollowHearth.smoke) settles at its new intensity before the shot.
const feedOnce = async (page, item) => {
  await page.evaluate((item) => {
    const sim = window.__game.sim;
    sim.addItem(item, 1);
    sim.feedGreenpaw(sim.playerId);
    sim.tick();
  }, item);
  await new Promise((r) => setTimeout(r, 400));
};

const hearth = async (page) => page.evaluate(() => window.__game.sim.hollowHearth);

// Diminishing returns mean the feed count to cross each bucket isn't fixed;
// feed one at a time (capped well past 8, the reference tuning pass's max)
// until the sim itself reports the target bucket.
const feedUntilLevel = async (page, level, cap = 20) => {
  for (let i = 0; i < cap; i++) {
    const state = await hearth(page);
    if (state.level === level) return state;
    await feedOnce(page, 'emberbulb');
  }
  return hearth(page);
};

const browser = await puppeteer.connect({ browserWSEndpoint: WS });

const page = await browser.newPage();
const errors = await startOffline(page, { width: 1280, height: 800 });

await enterHub(page);
const { greenpaw, vase } = await greenpawAndVasePos(page);
console.log('greenpaw at', JSON.stringify(greenpaw), 'vase at', JSON.stringify(vase));

// Give the hub's props (the vase GLTF, canopy, etc.) a moment to stream in
// on first entry; without this the first shot below can beat the loader.
await new Promise((r) => setTimeout(r, 4000));

// One consistent framing for all three states: standing by Greenpaw's side
// happens to sit almost level with the vase (same z), so this single shot
// keeps him, the vase, and its smoke together with nothing changing between
// frames except the sim state. Wide establishing shot first.
await standFacingVase(page, vase);
console.log('state before feeding:', JSON.stringify(await hearth(page)));
await page.screenshot({ path: `${OUT}/hearth_00_wide_clear.png` });

await standNearGreenpaw(page, greenpaw);
await page.screenshot({ path: `${OUT}/hearth_01_clear.png` });

console.log('state at hazy:', JSON.stringify(await feedUntilLevel(page, 'hazy')));
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: `${OUT}/hearth_02_hazy.png` });

console.log('state at full:', JSON.stringify(await feedUntilLevel(page, 'full')));
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: `${OUT}/hearth_03_full.png` });

console.log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
await page.close();
await browser.disconnect();
console.log('wrote screenshots to', OUT);
