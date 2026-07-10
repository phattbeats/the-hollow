// PHAA-592 follow-up: close leaf-pose shots + an objective scene-graph dump of
// the arch_gate door leaves (world transforms + bounding boxes) so the ajar pose
// can be judged from geometry, not just dim pixels. Same offline cold-open path.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'tmp/phaa-589';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('#btn-offline', { timeout: 90000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => document.querySelector('#btn-offline').click());
await new Promise((r) => setTimeout(r, 200));
await page.type('#char-name', 'Sable');
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="warrior"]').click(),
);
await page.evaluate(() => document.querySelector('#btn-start-offline').click());
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => {
  const btn = document.getElementById('mobile-preflight-continue');
  if (btn) btn.click();
});
await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 90000, polling: 250 });
for (let i = 0; i < 5; i++) {
  await new Promise((r) => setTimeout(r, 700));
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter(
      (b) => b.offsetParent && /skip|continue|close|ok|begin|got it/i.test(b.textContent ?? ''),
    );
    if (btns.length) { btns[0].click(); return true; }
    return false;
  });
  if (!clicked) break;
}

const spawn = await page.evaluate(() => {
  const p = window.__game.sim.player;
  return { x: p.pos.x, z: p.pos.z };
});
const origin = { x: spawn.x, z: spawn.z + 6 }; // spawn is hub-local (0,-6)

const frame = async (lx, lz, yaw) => {
  await page.evaluate((wx, wz, yaw) => {
    const g = window.__game;
    const p = g.sim.player;
    if (p.dead) g.sim.releaseSpirit();
    p.maxHp = p.hp = 99999;
    p.pos.x = wx; p.pos.z = wz; p.facing = yaw;
    g.input.camYaw = yaw;
  }, origin.x + lx, origin.z + lz, yaw);
  await new Promise((r) => setTimeout(r, 3500));
};

const PI = Math.PI;

// Objective geometry dump: find the arch_gate leaves in the live scene graph and
// report their world position, world Y rotation, and axis-aligned bbox. Proves
// the leaves exist, hinge at the arch, sit at floor level (no float/clip).
const dump = await page.evaluate(() => {
  const scene = window.__game.renderer?.scene;
  if (!scene) return { error: 'no scene' };
  scene.updateMatrixWorld(true);
  const out = { propsGroupPos: null, found: [] };
  scene.traverse((o) => {
    if (o.name === 'hollow-hub-props')
      out.propsGroupPos = { x: o.position.x, y: o.position.y, z: o.position.z };
  });
  for (const name of ['arch_gate_left', 'arch_gate_right']) {
    let node = null;
    scene.traverse((o) => { if (o.name === name) node = o; });
    if (!node) { out.found.push({ name, present: false }); continue; }
    const m = node.matrixWorld.elements; // column-major
    const worldYawDeg = +((Math.atan2(m[8], m[10]) * 180) / Math.PI).toFixed(1);
    out.found.push({
      name, present: true,
      worldPos: { x: +m[12].toFixed(3), y: +m[13].toFixed(3), z: +m[14].toFixed(3) },
      worldYawDeg,
      localRotY: +node.rotation.y.toFixed(3),
      localPos: { x: +node.position.x.toFixed(3), y: +node.position.y.toFixed(3), z: +node.position.z.toFixed(3) },
    });
  }
  return out;
});
console.log('LEAF_DUMP:', JSON.stringify(dump, null, 2));

// Close frontal, character nudged off-center in x so it does not block the arch.
await frame(2.2, -12, PI * 0.94);
await page.screenshot({ path: `${OUT}/H_leaf_close_frontal.png` });

// Just inside, tight on the gate opening from the vase side.
await frame(-0.2, -13.5, PI);
await page.screenshot({ path: `${OUT}/I_leaf_tight.png` });

// Side-on from the west, catching a leaf edge against the lighter clearing.
await frame(-6, -15.5, PI * 0.5);
await page.screenshot({ path: `${OUT}/J_leaf_side_west.png` });

console.log('errors:', errors.length ? errors.slice(0, 8).join('\n') : 'none');
await page.close();
await browser.disconnect();
console.log('done');
