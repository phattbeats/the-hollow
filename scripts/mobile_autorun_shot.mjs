// Screenshot the mobile move-joystick's autorun lock target in offline mode
// (PHAA-651, adapted from upstream #1724: the toggle button was replaced by a
// reveal-then-lock target that sits above the move joystick).
// Needs `npm run dev` on :5173. No server/Postgres required (offline flow).
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';
import { enterOfflineGame } from './enter_offline_game.mjs';

const URL = process.env.URL || 'http://localhost:5173/';
const OUT = process.env.OUT || '/tmp/woc-autorun';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
const cdp = await page.target().createCDPSession();
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }] });

await page.goto(URL, { waitUntil: 'networkidle2' });
await sleep(800);

// Offline flow: #btn-offline -> pick a class -> name -> start
await enterOfflineGame(page, { charClass: 'warrior', charName: 'Trailblazer', settleMs: 3500 });

async function shot(name) {
  await page.screenshot({ path: `${OUT}-${name}.png` });
  console.log('wrote', `${OUT}-${name}.png`);
}

// Autorun target hidden (default, thumb at rest)
await shot('off');

// Drag the move joystick's thumb well past the top band: reveals the target,
// then locks it (mobile_controls.ts's isMoveAutorunPush/MOVE_AUTORUN_THRESHOLD).
const joystickCenter = await page.evaluate(() => {
  const el = document.getElementById('mobile-move-joystick');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: r.width / 2 };
});
if (!joystickCenter) throw new Error('mobile-move-joystick not found');
const { x, y, radius } = joystickCenter;
await page.touchscreen.touchStart(x, y);
await page.touchscreen.touchMove(x, y - radius * 2.5);
await sleep(300);
await shot('on');

await page.touchscreen.touchEnd();
await sleep(300);
await shot('released-still-locked');

await browser.close();
