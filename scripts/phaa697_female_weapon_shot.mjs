// PHAA-697 acceptance evidence: renders each female class body (player_<cls>_f)
// holding its class weapon, one clean full-body shot per class.
//
// Why this harness and not a world roster-compare: the previous pass spawned a
// female compare model at the live player's position (offsetX 0) and tried to
// hide the male player body with `view.group.visible = false`. The render loop
// re-derives that visibility every frame (renderer.ts updateVisibility), so the
// hide was overwritten and the male warrior stood INSIDE the female model in
// every shot (Brandon, 2026-07-16). This harness renders only ONE body: it
// drives the real CharacterPreview turntable (the exact renderer + pipeline
// char-select uses) through setVisualKey('player_<cls>_f', <class start weapon>),
// so the female body and its class weapon are the only things on screen. No
// world, no follow-cam, no second body.
//
// Connects to remote Browserless (BROWSERLESS_WS); GAME_URL must be reachable
// from there. Writes PNGs into docs/screenshots/phaa-697/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.32:5174';
const OUT = process.env.OUT ?? 'docs/screenshots/phaa-697';
fs.mkdirSync(OUT, { recursive: true });

// All 9 classes. Rogue dual-wields; hunter keeps its crossbow; casters hold a
// staff/wand; the female def mirrors each male sibling's weapon layout.
const CLASSES = process.env.CLASSES
  ? process.env.CLASSES.split(',')
  : ['warrior', 'paladin', 'hunter', 'druid', 'rogue', 'warlock', 'mage', 'priest', 'shaman'];

// Boot the app far enough that the asset system and manifest are initialized,
// then leave it at the landing screen. We build our own CharacterPreview on top,
// so we never actually enter the world (no follow-cam, no second body).
async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`);
  });
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForSelector('#btn-offline', { timeout: 90000 });
  // Await the real boot preload sweep so every character AND weapon GLB is in
  // the cache (assetsReady = the same gate main.ts waits on before the Renderer
  // exists). preloadVisual only loads a body; the held-weapon GLBs come from
  // this sweep (manifestUrls -> itemWeaponModelUrls), and CharacterVisual throws
  // synchronously on any un-preloaded weapon url.
  await page.evaluate(async () => {
    const { assetsReady } = await import('/src/render/assets/preload.ts');
    await assetsReady();
  });
  return errors;
}

// Create a full-screen overlay hosting a private CharacterPreview instance.
async function mountPreview(page) {
  await page.evaluate(async () => {
    const previewMod = await import('/src/render/characters/preview.ts');
    const host = document.createElement('div');
    host.id = 'phaa697-preview-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1b1b22;display:block;';
    const canvas = document.createElement('canvas');
    canvas.id = 'phaa697-preview-canvas';
    host.appendChild(canvas);
    document.body.appendChild(host);
    const preview = new previewMod.CharacterPreview(host, canvas);
    preview.setContainer(host); // reparent the canvas into our host and size it
    preview.syncSize();
    window.__phaa697 = { preview };
  });
}

// Render one female class body holding its class start weapon. Freezes the
// turntable to a clean front-on pose so every shot is comparable.
async function poseClass(page, cls) {
  return page.evaluate(async (cls) => {
    const { preloadVisual } = await import('/src/render/characters/assets.ts');
    const { CLASSES } = await import('/src/sim/data.ts');
    const key = `player_${cls}_f`;
    await preloadVisual(`player_${cls}`); // male base (setVisualKey re-resolve source)
    await preloadVisual(key); // female variant must be loaded before the sync build
    const startWeapon = CLASSES[cls]?.startWeapon ?? null;
    const p = window.__phaa697.preview;
    // Build the female body holding the real class start weapon directly (setSex
    // would rebuild with a null weapon; we want the class weapon on screen).
    p.setVisualKey(key, startWeapon);
    // Freeze the auto-rotation and face the character straight at the camera.
    p.isDragging = true; // animate() skips auto-rotate while "dragging"
    p.characterGroup.rotation.y = 0;
    return { key, startWeapon: startWeapon ?? '(def default)' };
  }, cls);
}

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 960 }); // portrait: full head-to-toe
const errors = await boot(page);
await mountPreview(page);

const info = {};
for (const cls of CLASSES) {
  const meta = await poseClass(page, cls);
  info[cls] = meta;
  // Let the idle clip settle and a few frames render at the frozen pose.
  await new Promise((r) => setTimeout(r, 1200));
  const path = `${OUT}/player_${cls}_f.png`;
  const host = await page.$('#phaa697-preview-host');
  await host.screenshot({ path });
  console.log(`shot player_${cls}_f -> ${path} (weapon=${meta.startWeapon})`);
}

console.log('errors:', errors.length ? errors.slice(0, 30).join('\n') : 'none');
fs.writeFileSync(`${OUT}/pose_info.json`, JSON.stringify(info, null, 2));
await page.close();
await browser.disconnect();
console.log('wrote', CLASSES.length, 'screenshots to', OUT);
