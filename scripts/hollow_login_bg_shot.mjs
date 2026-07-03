import puppeteer from 'puppeteer-core';

const GAME_URL = process.env.GAME_URL || 'http://172.18.0.25:5201';
const BROWSERLESS_WS = process.env.BROWSERLESS_WS || 'ws://10.0.0.100:3000';

const variants = [
  { name: 'video-current', param: '', settleMs: 2500 },
  { name: 'spore-drift', param: '?bg=spore-drift', settleMs: 8000 },
  { name: 'root-pulse', param: '?bg=root-pulse', settleMs: 4000 },
  { name: 'canopy-sway', param: '?bg=canopy-sway', settleMs: 4000 },
];

const browser = await puppeteer.connect({ browserWSEndpoint: BROWSERLESS_WS });
try {
  for (const v of variants) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${GAME_URL}/${v.param}`, { waitUntil: 'networkidle2', timeout: 60000 });
    // Let the ambient animation settle into a representative frame.
    await new Promise((r) => setTimeout(r, v.settleMs ?? 2500));
    await page.screenshot({ path: `/tmp/hollow-login-bg-${v.name}.png` });
    console.log(`captured ${v.name}`);
    await page.close();
  }
} finally {
  await browser.disconnect();
}
