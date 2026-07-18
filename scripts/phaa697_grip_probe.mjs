// PHAA-697 grip probe (throwaway): learn the chibi DEF-hand bone frame by
// rendering the warrior sword under a set of candidate Euler rotations, so the
// "up and out" orientation and smaller scale can be baked into CHIBI_HAND_GRIPS
// with evidence instead of guesswork. Not shipped.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.33:5174';
const OUT = process.env.OUT ?? 'docs/screenshots/phaa-697/probe';
const CLS = process.env.CLS ?? 'warrior';
fs.mkdirSync(OUT, { recursive: true });

// Candidate (label, {r:[x,y,z], l:[x,y,z]} degrees, scale).
const CANDS = JSON.parse(
  process.env.CANDS ?? JSON.stringify([['base', { r: [0, 180, 0], l: [0, 0, 0] }, 0.95]]),
);

async function boot(page) {
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForSelector('#btn-offline', { timeout: 90000 });
  await page.evaluate(async () => {
    const { assetsReady } = await import('/src/render/assets/preload.ts');
    await assetsReady();
  });
}

async function mount(page) {
  await page.evaluate(async () => {
    const previewMod = await import('/src/render/characters/preview.ts');
    const host = document.createElement('div');
    host.id = 'probe-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1b1b22;';
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    document.body.appendChild(host);
    const preview = new previewMod.CharacterPreview(host, canvas);
    preview.setContainer(host);
    preview.syncSize();
    window.__probe = { preview };
  });
}

async function setClass(page, cls) {
  await page.evaluate(async (cls) => {
    const { preloadVisual } = await import('/src/render/characters/assets.ts');
    const { CLASSES } = await import('/src/sim/data.ts');
    const key = `player_${cls}_f`;
    await preloadVisual(`player_${cls}`);
    await preloadVisual(key);
    const p = window.__probe.preview;
    p.setVisualKey(key, CLASSES[cls]?.startWeapon ?? null);
    p.isDragging = true;
    p.characterGroup.rotation.y = 0;
  }, cls);
}

// Find every weapon holder group (ancestor of a weaponMesh whose parent is a
// DEF-hand bone), keyed by side. Returns which sides are present.
async function locate(page) {
  return page.evaluate(() => {
    const p = window.__probe.preview;
    const holders = {};
    p.characterGroup.traverse((o) => {
      if (o.userData && o.userData.weaponMesh) {
        let cur = o;
        while (cur.parent) {
          const pn = (cur.parent.name || '').toLowerCase();
          if (pn.includes('def-hand')) {
            const side = pn.endsWith('l') ? 'l' : 'r';
            if (!holders[side]) holders[side] = cur;
            break;
          }
          cur = cur.parent;
        }
      }
    });
    window.__probe.holders = holders;
    return { sides: Object.keys(holders) };
  });
}

// eulerBySide: { r: [x,y,z], l: [x,y,z] } degrees; scaleBySide optional.
async function apply(page, eulerBySide, scale) {
  await page.evaluate(
    ({ eulerBySide, scale }) => {
      const holders = window.__probe.holders || {};
      for (const side of Object.keys(holders)) {
        const e = eulerBySide[side];
        if (!e) continue;
        const [rx, ry, rz] = e.map((d) => (d * Math.PI) / 180);
        holders[side].rotation.set(rx, ry, rz);
        holders[side].scale.setScalar(scale);
      }
    },
    { eulerBySide, scale },
  );
}

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 960 });
await boot(page);
await mount(page);
await setClass(page, CLS);
await new Promise((r) => setTimeout(r, 800));
const loc = await locate(page);
console.log('locate:', JSON.stringify(loc));
for (const [label, euler, scale] of CANDS) {
  await apply(page, euler, scale);
  await new Promise((r) => setTimeout(r, 300));
  await new Promise((r) => setTimeout(r, 600));
  const host = await page.$('#probe-host');
  await host.screenshot({ path: `${OUT}/${CLS}_${label}.png` });
  console.log('shot', label, euler, scale);
}
await page.close();
await browser.disconnect();
