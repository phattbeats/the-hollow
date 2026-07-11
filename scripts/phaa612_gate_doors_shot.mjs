// PHAA-612 acceptance shots: the PHAA-589 follow-up (commit 0e80c8337) that
// renders the Hollow-family TRANSITION DOORS as the shrine gate instead of the
// generic stone arch. Cold-opens offline (spawns in the_hollow hub), then
// visits each door via the sim's own enter/leave-dungeon API and frames it:
//   1. Overworld shrine gate  (dungeon_door, the_hollow, entering) -> GATE
//   2. Hub cave mouth (0,28)   (dungeon_door, under_shrine)         -> GATE
//   3. Under-Shrine exit       (dungeon_exit, under_shrine)         -> GATE
//   4. Hub walk-out (0,-16)    (dungeon_exit, the_hollow)           -> stone arch + ONE static gate
// Connects to a remote Browserless CDP endpoint; the dev server must be
// reachable from it (GAME_URL). Writes PNGs to tmp/phaa-612/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'tmp/phaa-612';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startOffline(page, viewport) {
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#btn-offline', { timeout: 90000 });
  await sleep(1500);
  await page.evaluate(() => document.querySelector('#btn-offline').click());
  await sleep(200);
  await page.type('#char-name', 'Sable');
  await page.evaluate(() =>
    document.querySelector('#offline-select .mini-class[data-class="warrior"]').click(),
  );
  await page.evaluate(() => document.querySelector('#btn-start-offline').click());
  await sleep(300);
  await page.evaluate(() => {
    const btn = document.getElementById('mobile-preflight-continue');
    if (btn) btn.click();
  });
  await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 90000, polling: 250 });
  await page.evaluate(() => {
    const p = window.__game.sim.player;
    p.maxHp = p.hp = 99999;
  });
  return errors;
}

async function dismissDialogs(page) {
  for (let i = 0; i < 6; i++) {
    await sleep(700);
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter(
        (b) => b.offsetParent && /skip|continue|close|ok|begin|got it/i.test(b.textContent ?? ''),
      );
      if (btns.length) {
        btns[0].click();
        return true;
      }
      return false;
    });
    if (!clicked) break;
  }
}

// Enumerate the live door entities (dungeon_door / dungeon_exit) with world pos
// + dungeonId so we frame the real thing rather than hardcoded local coords.
const doors = (page) =>
  page.evaluate(() => {
    const sim = window.__game.sim;
    const raw = sim.entities;
    const list = Array.isArray(raw) ? raw : [...(raw.values ? raw.values() : raw)];
    const p = sim.player;
    return {
      player: { x: p.pos.x, z: p.pos.z, dungeonId: p.dungeonId ?? null, id: p.id },
      doors: list
        .filter((e) => e.templateId === 'dungeon_door' || e.templateId === 'dungeon_exit')
        .map((e) => ({
          id: e.id,
          templateId: e.templateId,
          dungeonId: e.dungeonId ?? null,
          x: Math.round(e.pos.x * 10) / 10,
          z: Math.round(e.pos.z * 10) / 10,
        })),
    };
  });

// Position the player at (wx,wz) with facing/camera yaw, then let the renderer
// settle so the door view + swirl animate into place.
const frameAt = async (page, wx, wz, yaw) => {
  await page.evaluate(
    (wx, wz, yaw) => {
      const g = window.__game;
      const p = g.sim.player;
      if (p.dead) g.sim.releaseSpirit();
      p.maxHp = p.hp = 99999;
      p.pos.x = wx;
      p.pos.z = wz;
      p.facing = yaw;
      g.input.camYaw = yaw;
    },
    wx,
    wz,
    yaw,
  );
  await sleep(3200);
};

const PI = Math.PI;
const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = await startOffline(page, { width: 1280, height: 800 });
await dismissDialogs(page);

const log = {};

// ---- HUB (cold-open lands here) ----
let s = await doors(page);
log.hub = s;
console.log('HUB doors:', JSON.stringify(s, null, 2));

// Item 2: hub cave mouth (dungeon_door -> under_shrine). Frame from the north
// (vase side, +z) looking south (-z) at the gate into the Under-Shrine.
const cave = s.doors.find((d) => d.templateId === 'dungeon_door' && d.dungeonId === 'under_shrine');
if (cave) {
  await frameAt(page, cave.x, cave.z - 9, 0); // stand south, look north (+z) into the hill
  await page.screenshot({ path: `${OUT}/02a_hub_cavemouth_front.png` });
  await frameAt(page, cave.x + 7, cave.z - 7, PI * 0.25);
  await page.screenshot({ path: `${OUT}/02b_hub_cavemouth_oblique.png` });
}

// Item 4: hub walk-out (dungeon_exit -> the_hollow) at (0,-16). Must show ONE
// gate (the static shrine-gate prop) around a STONE-ARCH exit swirl, no doubled
// gate mesh / z-fight.
const hubExit = s.doors.find(
  (d) => d.templateId === 'dungeon_exit' && d.dungeonId === 'the_hollow',
);
if (hubExit) {
  await frameAt(page, hubExit.x, hubExit.z + 9, PI); // north of it, look south
  await page.screenshot({ path: `${OUT}/04a_hub_walkout_front.png` });
  await frameAt(page, hubExit.x + 8, hubExit.z + 8, PI * 0.72);
  await page.screenshot({ path: `${OUT}/04b_hub_walkout_oblique.png` });
  await frameAt(page, hubExit.x, hubExit.z + 4, PI); // close, under the arch
  await page.screenshot({ path: `${OUT}/04c_hub_walkout_close.png` });
}

// ---- UNDER-SHRINE ----
await page.evaluate(() =>
  window.__game.sim.enterDungeon('under_shrine', window.__game.sim.player.id),
);
await sleep(1500);
s = await doors(page);
log.under_shrine = s;
console.log('UNDER_SHRINE doors:', JSON.stringify(s, null, 2));

// Item 3: Under-Shrine exit (dungeon_exit -> under_shrine) -> GATE body.
const usExit = s.doors.find(
  (d) => d.templateId === 'dungeon_exit' && d.dungeonId === 'under_shrine',
);
if (usExit) {
  await frameAt(page, usExit.x, usExit.z + 9, PI);
  await page.screenshot({ path: `${OUT}/03a_undershrine_exit_front.png` });
  await frameAt(page, usExit.x + 7, usExit.z + 7, PI * 0.72);
  await page.screenshot({ path: `${OUT}/03b_undershrine_exit_oblique.png` });
}

// ---- OVERWORLD ----
await page.evaluate(() => window.__game.sim.leaveDungeon(window.__game.sim.player.id));
await sleep(1500);
s = await doors(page);
log.overworld = s;
console.log('OVERWORLD doors:', JSON.stringify(s, null, 2));

// Item 1: overworld shrine gate (dungeon_door -> the_hollow) at (0,-290) -> GATE.
const owGate = s.doors.find((d) => d.templateId === 'dungeon_door' && d.dungeonId === 'the_hollow');
if (owGate) {
  await frameAt(page, owGate.x, owGate.z - 10, 0); // south of gate, look north toward hub entry
  await page.screenshot({ path: `${OUT}/01a_overworld_gate_front.png` });
  await frameAt(page, owGate.x + 8, owGate.z - 8, PI * 0.25);
  await page.screenshot({ path: `${OUT}/01b_overworld_gate_oblique.png` });
  await frameAt(page, owGate.x, owGate.z + 10, PI); // other side
  await page.screenshot({ path: `${OUT}/01c_overworld_gate_back.png` });
}

fs.writeFileSync(`${OUT}/doors.json`, JSON.stringify(log, null, 2));
console.log('errors:', errors.length ? errors.slice(0, 15).join('\n') : 'none');
await page.close();
await browser.disconnect();
console.log('wrote screenshots + doors.json to', OUT);
