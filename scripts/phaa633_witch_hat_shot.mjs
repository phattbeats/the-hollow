// PHAA-633: witch hat placement pass evidence. Uses the same offscreen
// CharacterVisual rig pioneered on PHAA-588 (preserveDrawingBuffer readback,
// the only path that returns real pixels under headless Chrome). Captures
// the warlock class (the "chibi_female_merchant" outfit, the only chibi
// outfit that ships a `hat` mesh) plus its male counterpart, portrait and
// full-body, across every color variant, so before/after is comparable.
import crypto from 'node:crypto';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.3:5233/play.html';
const OUT = process.env.OUT_DIR ?? 'evidence';
const TAG = process.env.SHOT_TAG ?? 'shot';
fs.mkdirSync(OUT, { recursive: true });

function saveDataUrl(name, dataUrl, extra) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    console.log('  !! MISSING/invalid dataURL for', name, '->', String(dataUrl).slice(0, 48));
    return;
  }
  const buf = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  fs.writeFileSync(`${OUT}/${name}.png`, buf);
  const sha = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  console.log(`  saved ${name}.png (${buf.length} B, sha ${sha})`);
}

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});
await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 1 });
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
  const W = 640,
    H = 800;
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

  // full-body framed shot
  window.__shootBody = async (visualKey, skin, yawDeg = 18) => {
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

  // tight head-and-shoulders framed shot (where hat placement is most legible)
  window.__shootHead = async (visualKey, skin, yawDeg = 18) => {
    const v = new CharacterVisual(visualKey, 0xffffff, skin);
    mount.add(v.root);
    mount.rotation.y = (yawDeg * Math.PI) / 180;
    for (let i = 0; i < 60; i++) v.update(1 / 20, base, true);
    const box = new THREE.Box3().setFromObject(v.root);
    const full = new THREE.Vector3();
    box.getSize(full);
    const topY = box.max.y;
    const headH = full.y * 0.32; // crop to the top ~third (head + hat)
    const cx = (box.min.x + box.max.x) / 2;
    const cz = box.max.z;
    const cy = topY - headH * 0.5;
    const dist = (headH * 0.75) / Math.tan((cam.fov * Math.PI) / 180 / 2);
    cam.position.set(cx, cy, cz + dist * 0.35);
    cam.lookAt(cx, cy, box.min.z + (box.max.z - box.min.z) / 2);
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    mount.remove(v.root);
    v.dispose();
    return { url };
  };
});
console.log('offscreen rig installed');

const TARGETS = [
  { key: 'player_warlock_f', label: 'warlock_f' },
  { key: 'player_warlock', label: 'warlock_m' },
];

for (const t of TARGETS) {
  const n = await page.evaluate(async (k) => {
    try {
      const m = await import('/src/render/characters/chibi_skin_variants.ts');
      return m.chibiSkinCount(k);
    } catch {
      return 1;
    }
  }, t.key);
  const variants = Math.max(1, n || 1);
  console.log(`${t.label}: ${variants} variant(s)`);
  for (let skin = 0; skin < variants; skin++) {
    const body = await page.evaluate((k, s) => window.__shootBody(k, s), t.key, skin);
    saveDataUrl(`${TAG}_${t.label}_v${skin}_body`, body.url);
    const head = await page.evaluate((k, s) => window.__shootHead(k, s), t.key, skin);
    saveDataUrl(`${TAG}_${t.label}_v${skin}_head`, head.url);
  }
}

console.log('errors:', errors.length ? errors.slice(0, 30).join('\n') : 'none');
await page.close();
await browser.disconnect();
console.log('done ->', OUT);
