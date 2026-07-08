// PHAA-531 verification shot: proves the three Under-Shrine mobs (palefeeder,
// rootmaw, the_witness_root) render as seeded plant creatures, not their old
// GLB spider/wolf/elemental rigs, and that hit-react + attack-lunge fire.
// Connects to a remote Browserless CDP endpoint instead of launching a local
// browser (no Chromium in this container); the dev server must be reachable
// from that endpoint. Writes PNGs into tmp/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
fs.mkdirSync('tmp', { recursive: true });

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});
await page.setViewport({ width: 1600, height: 900 });
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 45000 });
await page.evaluate(() => document.querySelector('#btn-offline').click());
await new Promise((r) => setTimeout(r, 200));
await page.type('#char-name', 'Wren');
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="warrior"]').click(),
);
await page.evaluate(() => document.querySelector('#btn-start-offline').click());
await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 90000, polling: 250 });
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => {
  const skip = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Skip'));
  if (skip) skip.click();
});
await new Promise((r) => setTimeout(r, 600));
await page.evaluate(() => {
  const btn = document.querySelector('.tut-skip');
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 3000)); // settle asset preload / shader compile

const staged = await page.evaluate(() => {
  const g = window.__game;
  const sim = g.sim;
  const p = sim.player;
  p.hp = p.maxHp = 99999;
  p.pos = { x: -30, y: 0, z: -20 };
  p.prevPos = { ...p.pos };
  p.facing = 0;
  p.prevFacing = 0;

  let template = null;
  for (const e of sim.entities.values()) {
    if (e.kind === 'mob') {
      template = e;
      break;
    }
  }
  if (!template) return { ok: false, reason: 'no live mob entity to clone the Entity shape from' };

  const specs = [
    { templateId: 'palefeeder', name: 'Palefeeder', color: 0xcfd8cf, scale: 0.9, dx: -5 },
    { templateId: 'rootmaw', name: 'Rootmaw', color: 0x6b5d4f, scale: 1.1, dx: 0 },
    {
      templateId: 'the_witness_root',
      name: 'The Witness-Root',
      color: 0x39412f,
      scale: 1.6,
      dx: 5,
    },
  ];
  const ids = [];
  for (const s of specs) {
    const e = structuredClone(template);
    e.id = sim.nextId++;
    e.templateId = s.templateId;
    e.name = s.name;
    e.color = s.color;
    e.scale = s.scale;
    e.kind = 'mob';
    e.dead = false;
    e.hp = e.maxHp = 1000;
    e.moveSpeed = 0;
    e.aiState = 'idle';
    e.aggroTargetId = null;
    e.ownerId = null;
    e.hostile = true;
    e.auras = [];
    e.pos = { x: p.pos.x + s.dx, y: p.pos.y, z: p.pos.z + 6 };
    e.prevPos = { ...e.pos };
    e.facing = Math.PI;
    e.prevFacing = Math.PI;
    sim.addEntity(e);
    sim.rebucket(e);
    ids.push(e.id);
  }
  g.renderer.camYaw = 0;
  g.renderer.camPitch = 0.26;
  g.renderer.camDist = 10;
  return { ok: true, ids };
});
console.log('staged:', JSON.stringify(staged));
if (!staged.ok) {
  console.error('staging failed', staged);
  await browser.close();
  process.exit(1);
}

await new Promise((r) => setTimeout(r, 1500)); // let views build + idle sway settle
await page.screenshot({ path: 'tmp/phaa531_idle_sway.png' });

// hit-react + attack-lunge on the boss (the_witness_root)
const bossId = staged.ids[2];
await page.evaluate((id) => {
  window.__game.renderer.triggerHit(id);
}, bossId);
await new Promise((r) => setTimeout(r, 180)); // near the recoil peak
await page.screenshot({ path: 'tmp/phaa531_hit_react.png' });

await page.evaluate((id) => {
  window.__game.renderer.triggerAttack(id);
}, bossId);
await new Promise((r) => setTimeout(r, 220)); // near the lunge peak
await page.screenshot({ path: 'tmp/phaa531_attack_lunge.png' });

if (errors.length) console.log('page errors:\n' + errors.join('\n'));
await browser.close();
console.log('done; wrote tmp/phaa531_*.png');
