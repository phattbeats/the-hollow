// PHAA-636 (Sable, re-verify of Wren head re-pass 6e0433a70): drive shade_iso.html and
// capture CLOSE framings for exactly the three QA-FAIL defects, defect-critical shots
// FIRST (Browserless can drop the iso session after several captures):
//   1. hair clipping the brows/eyes   -> face_front, face_3q
//   2. headscarf back-drape lump + hair poke-through -> head_back, head_3qback, head_side
//   3. stray prop at the throat        -> throat_front
// then full-body context + one walk phase (proves the wardrobe deforms with the body).
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.21:5176';
const OUT = process.env.OUT ?? 'docs/screenshots/phaa-636/reverify';
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
  const H = dims.height,
    top = dims.headY;
  const eyeY = top - 0.12 * H; // just below crown on this chibi rig
  const crownY = top - 0.05 * H;
  const throatY = top - 0.3 * H; // neck/collar
  const midY = (dims.feetY + dims.headY) / 2;

  async function view(name, d, azDeg, camY, tgtY) {
    const az = (azDeg * Math.PI) / 180;
    const cx = Math.sin(az) * d,
      cz = Math.cos(az) * d;
    await page.evaluate(
      (cx, cy, cz, ty) => window.__shade.cam(cx, cy, cz, 0, ty, 0),
      cx,
      camY,
      cz,
      tgtY,
    );
    await sleep(140);
    await shot(name);
  }

  // DEFECT-CRITICAL (idle), ordered first
  await view('1_face_front', 1.95, 0, eyeY, eyeY); // defect 1: hair on brows/eyes
  await view('2_head_back', 1.95, 180, crownY, crownY - 0.06 * H); // defect 2: scarf back-drape + poke
  await view('3_head_3qback', 1.95, 145, crownY, crownY - 0.05 * H);
  await view('4_head_side', 1.95, 90, eyeY, eyeY); // defect 2 side + defect 3 neck profile
  await view('5_throat_front', 2.05, 12, throatY + 0.1 * H, throatY); // defect 3: stray throat prop
  await view('6_face_3q', 1.95, 35, eyeY, eyeY); // defect 1 from angle

  // context + motion (lose-able if session drops)
  await view('7_ctx_front', 4.2, 0, midY, midY);
  await page.evaluate(() => window.__shade.tickWalk(8));
  await view('8_walk_3q', 4.2, 35, midY, midY);
  await page.evaluate(() => window.__shade.tickWalk(6));
  await view('9_walk_side', 4.2, 90, midY, midY);

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
