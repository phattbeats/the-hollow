// PHAA-697 edge-path verification: exercises the two grip paths the default
// start-weapon roster does NOT hit -- the 1H_Wand family grip (warlock default,
// no swap) and the origin-at-grip variant path applyChibiVariantGrip (an equipped
// adv_* drop). Pairs are [visualKey, equippedItemIdOrNull, label].
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.33:5174';
const OUT = process.env.OUT ?? 'docs/screenshots/phaa-697/edge';
fs.mkdirSync(OUT, { recursive: true });

// warlock default = wand (1H_Wand grip); warrior + adv_* drop = variant path.
const PAIRS = [
  ['player_warlock_f', null, 'warlock_wand'],
  ['player_warrior_f', 'highwatch_warblade', 'warrior_variant_advsword'],
  ['player_rogue_f', 'gravewardens_shiv', 'rogue_variant_advdagger'],
];

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 960 });
await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
await page.waitForSelector('#btn-offline', { timeout: 90000 });
await page.evaluate(async () => {
  const { assetsReady } = await import('/src/render/assets/preload.ts');
  await assetsReady();
});
await page.evaluate(async () => {
  const previewMod = await import('/src/render/characters/preview.ts');
  const host = document.createElement('div');
  host.id = 'edge-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1b1b22;';
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  document.body.appendChild(host);
  const preview = new previewMod.CharacterPreview(host, canvas);
  preview.setContainer(host);
  preview.syncSize();
  window.__edge = { preview };
});

for (const [key, weapon, label] of PAIRS) {
  await page.evaluate(
    async ({ key, weapon }) => {
      const { preloadVisual } = await import('/src/render/characters/assets.ts');
      const cls = key.replace(/^player_/, '').replace(/_f$/, '');
      await preloadVisual(`player_${cls}`);
      await preloadVisual(key);
      const p = window.__edge.preview;
      p.setVisualKey(key, weapon);
      p.isDragging = true;
      p.characterGroup.rotation.y = 0;
    },
    { key, weapon },
  );
  await new Promise((r) => setTimeout(r, 1200));
  const host = await page.$('#edge-host');
  await host.screenshot({ path: `${OUT}/${label}.png` });
  console.log('shot', label, key, weapon ?? '(def default)');
}
await page.close();
await browser.disconnect();
