// PHAA-636 (Sable, temple-tuck re-verify): drive shade_iso.html and capture the
// forward-jutting temple/cheek hair locks Brandon flagged ("i want to see it fixed").
// Defect-critical angles FIRST (Browserless drops the iso session after several shots):
//   side profile (az90) + both 3/4 fronts (az +-45) show the blade across the cheek;
//   face_front confirms brows clean; a walk-side proves the tuck holds in motion.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.21:5176';
const OUT = process.env.OUT ?? 'docs/screenshots/phaa-636/templetuck';
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
  const H = dims.height,
    top = dims.headY;
  const cheekY = top - 0.16 * H; // temple/cheek band where the blade sat
  const eyeY = top - 0.12 * H;
  const midY = (dims.feetY + dims.headY) / 2;

  async function view(name, d, azDeg, camY, tgtY) {
    const az = (azDeg * Math.PI) / 180;
    await page.evaluate(
      (cx, cy, cz, ty) => window.__shade.cam(cx, cy, cz, 0, ty, 0),
      Math.sin(az) * d,
      camY,
      Math.cos(az) * d,
      tgtY,
    );
    await sleep(140);
    await shot(name);
  }

  // DEFECT-CRITICAL idle, tight on the temple/cheek
  await view('1_side_R', 1.7, 90, cheekY, cheekY); // right profile: forward blade
  await view('2_3q_R', 1.7, 45, cheekY, cheekY); // 3/4 front-right temple
  await view('3_3q_L', 1.7, -45, cheekY, cheekY); // 3/4 front-left temple
  await view('4_face_front', 1.8, 0, eyeY, eyeY); // brows/eyes clean
  await view('5_side_L', 1.7, -90, cheekY, cheekY); // left profile
  // motion: tuck must hold in walk
  await page.evaluate(() => window.__shade.tickWalk(8));
  await view('6_walk_3q_R', 1.9, 45, cheekY, cheekY);
  // full-body context (approved wardrobe unchanged)
  await view('7_ctx_front', 4.2, 0, midY, midY);
  await page.evaluate(() => window.__shade.tickWalk(6));
  await view('8_walk_ctx_side', 4.2, 90, midY, midY);

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
