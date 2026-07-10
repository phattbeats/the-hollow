// PHAA-557 acceptance evidence: the chibi female base model spawned beside a
// KayKit roster character THROUGH THE PRODUCTION ROSTER PIPELINE
// (CharacterVisual via src/render/characters/roster_compare_harness.ts), so
// the shots prove she casts a ground shadow and shades under scene lighting
// exactly like the adjacent KayKit model. Successor to the PHAA-550 spike,
// whose raw scene.add path caused the shadowless/flat read in the first place.
// Connects to a remote Browserless CDP endpoint (BROWSERLESS_WS); the dev
// server must be reachable from there (GAME_URL). Writes PNGs into
// docs/screenshots/phaa-557/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-557';
fs.mkdirSync(OUT, { recursive: true });

const KEY = process.env.COMPARE_KEY ?? 'chibi_female_base';

async function startOffline(page, viewport, cls = 'warrior', name = 'Sable') {
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 45000 });
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
  await page.evaluate(() => document.querySelector('.cold-open-skip')?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    btns.find((b) => b.textContent?.includes('Skip Tutorial'))?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  return errors;
}

// Park the player on a clear patch and face a fixed yaw so the compare visual
// (spawned on the player's right) sits cleanly beside them, both broadside to
// the chase cam.
const park = async (page, x, z, yaw, settleMs = 3500) => {
  await page.evaluate(
    (x, z, yaw) => {
      const g = window.__game;
      const p = g.sim.player;
      if (p.dead) g.sim.releaseSpirit?.();
      p.maxHp = p.hp = 99999;
      p.pos.x = x;
      p.pos.z = z;
      p.facing = yaw;
      g.input.camYaw = yaw;
      g.renderer.camYaw = yaw;
    },
    x,
    z,
    yaw,
  );
  await new Promise((r) => setTimeout(r, settleMs));
};

const spawnCompare = async (page, key, offsetX) =>
  page.evaluate(
    async (key, offsetX) => {
      const mod = await import('/src/render/characters/roster_compare_harness.ts');
      return mod.spawnRosterCompare(window.__game, { key, offsetX });
    },
    key,
    offsetX,
  );

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
{
  const page = await browser.newPage();
  const errors = await startOffline(page, { width: 1280, height: 800 });

  // Open grass well clear of the town NPC cluster (probed on PHAA-550: 0
  // entities within 12yd), so the only two figures in frame are the player +
  // the injected compare visual.
  const [OX, OZ] = [40, 40];
  await park(page, OX, OZ, Math.PI / 2, 3500);
  const info = await spawnCompare(page, KEY, 1.15);
  console.log('spawn info:', JSON.stringify(info, null, 2));
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({ path: `${OUT}/01_sidebyside_gameplay_cam.png` });

  // Orbit the chase cam to a three-quarter view of both silhouettes.
  await park(page, OX, OZ, Math.PI / 2 + 0.9, 2500);
  await page.screenshot({ path: `${OUT}/02_sidebyside_angled.png` });

  // Opposite side, so both faces (not just backs) are on record.
  await park(page, OX, OZ, Math.PI / 2 + Math.PI, 2500);
  await page.screenshot({ path: `${OUT}/03_sidebyside_reverse.png` });

  console.log('errors:', errors.length ? errors.slice(0, 20).join('\n') : 'none');
  fs.writeFileSync(`${OUT}/spawn_info.json`, JSON.stringify(info, null, 2));
  await page.close();
}
await browser.disconnect();
console.log('wrote screenshots to', OUT);
