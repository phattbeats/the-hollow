// PHAA-631 verification evidence: knight-outfit (warrior/paladin) variant
// retarget. Confirms armorthigh/armorplastron tints (instead of the
// helmet-occluded hair / tiny armorbelt) produce visually distinct
// full-body renders and portraits across skins 0..2.
import crypto from 'node:crypto';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.3:5199/play.html';
const OUT = process.env.OUT_DIR ?? 'evidence';
fs.mkdirSync(OUT, { recursive: true });

const VARIANT_CLASSES = ['warrior', 'paladin'];

const manifest = {};
function saveDataUrl(name, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    console.log('  !! MISSING/invalid dataURL for', name, '->', String(dataUrl).slice(0, 48));
    manifest[name] = { bytes: 0, sha256: 'MISSING' };
    return;
  }
  const buf = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  fs.writeFileSync(`${OUT}/${name}.png`, buf);
  const sha = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  manifest[name] = { bytes: buf.length, sha256: sha };
  console.log(`  saved ${name}.png (${buf.length} B, sha ${sha})`);
}

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`);
});
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
console.log('goto', URL);
await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
await page.waitForSelector('#btn-offline', { timeout: 90000 });
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => document.querySelector('#btn-offline').click());
await new Promise((r) => setTimeout(r, 600));

await page.waitForFunction(
  async () => {
    const mod = await import('/src/render/characters/portrait.ts');
    return mod.portraitsReady();
  },
  { timeout: 120000, polling: 500 },
);
console.log('assets ready');

await page.evaluate(async () => {
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const { CharacterVisual } = await import('/src/render/characters/visual.ts');
  const W = 512,
    H = 660;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-3, 2, -3);
  scene.add(fill);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
  const mount = new THREE.Group();
  scene.add(mount);
  const base = {
    speed: 0,
    moving: false,
    airborne: false,
    backwards: false,
    dead: false,
    casting: false,
    swimming: false,
    sitting: false,
  };
  window.__shoot = async (visualKey, skin, yawDeg = 18) => {
    const v = new CharacterVisual(visualKey, 0xffffff, skin);
    mount.add(v.root);
    mount.rotation.y = (yawDeg * Math.PI) / 180;
    for (let i = 0; i < 60; i++) v.update(1 / 20, base, true);
    const box = new THREE.Box3().setFromObject(v.root);
    const c = new THREE.Vector3();
    box.getCenter(c);
    const s = new THREE.Vector3();
    box.getSize(s);
    const h = s.y || 2.2;
    const dist = (h * 0.62) / Math.tan((cam.fov * Math.PI) / 180 / 2);
    cam.position.set(c.x, c.y + h * 0.05, box.max.z + dist);
    cam.lookAt(c.x, c.y, c.z);
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    mount.remove(v.root);
    v.dispose();
    return { url };
  };
});
console.log('offscreen rig installed');

for (const cls of VARIANT_CLASSES) {
  const n = await page.evaluate(async (c) => {
    const m = await import('/src/render/characters/chibi_skin_variants.ts');
    return m.chibiSkinCount(`player_${c}_f`);
  }, cls);
  const k = Math.min(3, n);
  console.log(`${cls}: ${n} variants`);
  for (let i = 0; i < k; i++) {
    const p = await page.evaluate(
      async (c, s) => {
        const mod = await import('/src/render/characters/portrait.ts');
        return mod.visualPortraitDataUrl(`player_${c}_f`, s);
      },
      cls,
      i,
    );
    saveDataUrl(`variant_${cls}_v${i}_portrait`, p);
    const { url } = await page.evaluate((c, s) => window.__shoot(`player_${c}_f`, s), cls, i);
    saveDataUrl(`variant_${cls}_v${i}_body`, url);
  }
}

if (errors.length) console.log(`PAGE ERRORS:\n${errors.join('\n')}`);
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log('done, manifest written to', `${OUT}/manifest.json`);
await browser.close();
