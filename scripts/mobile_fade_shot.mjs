// Ad-hoc mobile screenshot helper for the offline world.
// Usage: node scripts/mobile_shot.mjs   (needs `npm run dev` running on :5173)
import puppeteer from 'puppeteer-core';

const URL = process.env.GAME_URL ?? 'http://localhost:5173/';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome-stable';
const OUT = process.env.OUT_DIR ?? '/tmp';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
// iPhone-ish portrait with a coarse pointer so body.mobile-touch activates.
await page.emulate({
  viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
});
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERR', m.text()); });

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(500);
await page.click('#btn-offline');
await sleep(400);
await page.click('#offline-select .mini-class[data-class="warrior"]');
await sleep(200);
await page.type('#char-name', 'Thumbwar');
await sleep(150);
await page.click('#btn-start-offline');
// Let the world load and settle.
await sleep(6000);

const idlePath = `${OUT}/mobile-idle-fade.png`;
await page.screenshot({ path: idlePath });
console.log('wrote', idlePath);

// Now simulate a finger resting on the move joystick -> .touching (full opacity).
await page.evaluate(() => {
  document.getElementById('mobile-move-joystick')?.classList.add('touching');
  document.getElementById('mobile-camera-joystick')?.classList.add('touching');
});
await sleep(400);
const activePath = `${OUT}/mobile-active-joystick.png`;
await page.screenshot({ path: activePath });
console.log('wrote', activePath);

await browser.close();
