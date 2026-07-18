// PHAA-581 follow-up: screenshots the decorative flora model gallery
// (flora_gallery.html) for maintainer visual review. Connects to a remote
// Browserless CDP endpoint (BROWSERLESS_WS) instead of a local browser; the
// dev server must be reachable from that endpoint (GALLERY_URL). Writes PNGs
// into shots/ at the worktree root.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GALLERY_URL ?? 'http://localhost:5199/flora_gallery.html';
const OUT = 'shots';
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await puppeteer.connect({ browserWSEndpoint: WS });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });

  await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(() => window.__galleryReady === true, {
    timeout: 30000,
    polling: 100,
  });
  await new Promise((r) => setTimeout(r, 300));

  const shot = async (view, file) => {
    if (view) {
      await page.evaluate((v) => window.__setView(v), view);
      await new Promise((r) => setTimeout(r, 400));
    }
    await page.screenshot({ path: `${OUT}/${file}` });
    console.log('wrote', `${OUT}/${file}`);
  };

  await shot(null, 'phaa581_gallery_overview.png');
  await shot('glow', 'phaa581_gallery_glow_variants.png');
  await shot('daylight', 'phaa581_gallery_daylight_overview.png');
  await shot('flower', 'phaa581_gallery_day_flower_row.png');
  await shot('bush', 'phaa581_gallery_day_bush_row.png');
  await shot('tree', 'phaa581_gallery_day_tree_row.png');
  await shot('vine', 'phaa581_gallery_day_vine_row.png');

  if (errors.length) {
    console.log('--- page errors ---');
    for (const e of errors) console.log(e);
  } else {
    console.log('no page errors');
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
