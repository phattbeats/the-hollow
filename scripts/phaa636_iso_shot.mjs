// PHAA-636 (Sable): drive the shade_iso.html isolation entry over Browserless and
// capture front / 3q / side / back + head + a walk pose. No world boot.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.21:5173';
const OUT = process.env.OUT ?? 'docs/screenshots/phaa-636/iso';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({ browserWSEndpoint: WS, protocolTimeout: 180000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message.slice(0, 200)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200));
});

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log('shot', name);
}

try {
  await page.setViewport({ width: 820, height: 980 });
  log('goto', URL + '/scripts/shade_iso.html');
  await page.goto(URL + '/scripts/shade_iso.html', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(() => window.__shotReady || window.__shotErr, {
    timeout: 90000,
    polling: 300,
  });
  const err = await page.evaluate(() => window.__shotErr || null);
  if (err) {
    log('SCENE ERROR', err.slice(0, 400));
    throw new Error('scene failed');
  }

  const dims = await page.evaluate(() => {
    const s = window.__shade;
    return { feetY: s.feetY, headY: s.headY, height: s.height };
  });
  log('dims', JSON.stringify(dims));
  const midY = (dims.feetY + dims.headY) / 2;
  const torsoY = dims.feetY + dims.height * 0.62;

  // camera helper: distance d, azimuth deg, elevation targetY
  async function view(name, d, azDeg, camY, tgtY) {
    const az = (azDeg * Math.PI) / 180;
    const cx = Math.sin(az) * d,
      cz = Math.cos(az) * d;
    await page.evaluate(
      (cx, cy, cz, tx, ty, tz) => window.__shade.cam(cx, cy, cz, tx, ty, tz),
      cx,
      camY,
      cz,
      0,
      tgtY,
      0,
    );
    await sleep(120);
    await shot(name);
  }

  // IDLE lineup
  await view('idle_front', 4.2, 0, midY, midY);
  await view('idle_3q', 4.2, 35, midY, midY);
  await view('idle_side', 4.2, 90, midY, midY);
  await view('idle_back', 4.2, 180, midY, midY);
  await view('idle_torso', 2.6, 15, torsoY, torsoY);
  await view('idle_head', 2.0, 10, dims.headY - 0.15, dims.headY - 0.25);
  await view(
    'idle_hands',
    2.4,
    40,
    dims.feetY + dims.height * 0.5,
    dims.feetY + dims.height * 0.48,
  );

  // WALK cycle (proves the wardrobe deforms WITH the body, no clip-through)
  await page.evaluate(() => window.__shade.tickWalk(8));
  await view('walk_p1_front', 4.2, 0, midY, midY);
  await page.evaluate(() => window.__shade.tickWalk(5));
  await view('walk_p2_3q', 4.2, 35, midY, midY);
  await page.evaluate(() => window.__shade.tickWalk(5));
  await view('walk_p3_side', 4.2, 90, midY, midY);

  log('errors:', errors.length ? errors.slice(0, 10).join(' | ') : 'none');
  log('DONE');
} catch (e) {
  log('CAUGHT', String(e).slice(0, 300));
  log('errors so far:', errors.slice(0, 10).join(' | '));
} finally {
  try {
    await page.close();
  } catch {}
  try {
    await browser.disconnect();
  } catch {}
}
