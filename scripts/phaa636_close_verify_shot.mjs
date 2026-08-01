// PHAA-636 follow-up: close-range in-engine verification after fixing the
// reported clipping (shoulder/shirt/headscarf) and the cube-in-hand satchel.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-636';
fs.mkdirSync(OUT, { recursive: true });

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
  const errors = await startOffline(page, { width: 900, height: 900 });

  const [OX, OZ] = [40, 40];
  await page.evaluate(
    (x, z) => {
      const g = window.__game;
      const p = g.sim.player;
      p.maxHp = p.hp = 99999;
      p.pos.x = x;
      p.pos.z = z;
    },
    OX,
    OZ,
  );
  await new Promise((r) => setTimeout(r, 500));
  const info = await spawnCompare(page, 'npc_shade', 1.15);
  console.log('spawn info:', JSON.stringify(info, null, 2));

  // freeze the camera and hand-place it for a tight product shot of Shade,
  // sidestepping the player-relative chase cam (per hollow-blender-glb-export memory)
  await page.evaluate(
    (x, z) => {
      const g = window.__game;
      g.renderer.updateCamera = () => {};
      const groundY = g.sim.player.pos.y;
      const cam = g.renderer.camera;
      cam.position.set(x + 1.15, groundY + 1.6, z + 2.1);
      cam.lookAt(x + 1.15, groundY + 1.3, z);
    },
    OX,
    OZ,
  );
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT}/04_close_front.png` });

  await page.evaluate(
    (x, z) => {
      const g = window.__game;
      const groundY = g.sim.player.pos.y;
      const cam = g.renderer.camera;
      cam.position.set(x + 1.15 + 1.9, groundY + 1.65, z + 0.3);
      cam.lookAt(x + 1.15, groundY + 1.45, z);
    },
    OX,
    OZ,
  );
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/05_close_shoulder.png` });

  console.log('errors:', errors.length ? errors.slice(0, 20).join('\n') : 'none');
  await page.close();
}
await browser.disconnect();
console.log('wrote screenshots to', OUT);
