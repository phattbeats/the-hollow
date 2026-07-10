// PHAA-592 acceptance shots for the PHAA-589 shrine gate at the Hollow hub
// threshold. Cold-opens a fresh offline character (auto-spawns at the vase
// landing, hub-local (0,-6)), then frames the arched gate that stands on the
// walk-out trigger line at hub-local (0,-16), 10 units south (-z) of spawn.
// Connects to a remote Browserless CDP endpoint (BROWSERLESS_WS); the dev
// server must be reachable from that endpoint (GAME_URL). Writes PNGs to
// tmp/phaa-589/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'tmp/phaa-589';
fs.mkdirSync(OUT, { recursive: true });

async function startOffline(page, viewport) {
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });
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
  await page.evaluate(() => {
    const p = window.__game.sim.player;
    p.maxHp = p.hp = 99999;
  });
  return errors;
}

// Dismiss the cold-open intro dialog (and any follow-up pane) so shots are clean.
async function dismissDialogs(page) {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 700));
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

// Read the live spawn/pos so we can compute hub-local frames without hardcoding
// the instance origin (each portal slot has its own).
const state = (page) =>
  page.evaluate(() => {
    const p = window.__game.sim.player;
    return { x: p.pos.x, z: p.pos.z, facing: p.facing, dungeonId: p.dungeonId ?? null };
  });

// Move the player to a hub-local (lx,lz) offset from the recorded spawn origin
// and aim both facing + camera yaw. originWorld is spawn - localSpawn.
const frame = async (page, origin, lx, lz, yaw) => {
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
    origin.x + lx,
    origin.z + lz,
    yaw,
  );
  await new Promise((r) => setTimeout(r, 3500));
};

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = await startOffline(page, { width: 1280, height: 800 });

// Shot A: cold-open initial framing, untouched. Player faces the vase (+z);
// the gate should sit behind the arrival.
await dismissDialogs(page);
const spawn = await state(page);
console.log('cold-open spawn:', JSON.stringify(spawn));
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${OUT}/A_coldopen_initial.png` });

// Origin so that hub-local (0,-6) maps to the recorded spawn.
const origin = { x: spawn.x - 0, z: spawn.z - -6 };
const PI = Math.PI;

// Shot B: turn around at the vase landing, look south (-z) at the gate 10u ahead.
await frame(page, origin, 0, -6, PI);
await page.screenshot({ path: `${OUT}/B_turnaround_gate.png` });

// Shot C: step closer, mid-approach frontal view of the open leaves.
await frame(page, origin, 0, -11, PI);
await page.screenshot({ path: `${OUT}/C_approach_leaves.png` });

// Shot D: under the arch, on the trigger line, looking south out through the gate.
await frame(page, origin, 0, -15.5, PI);
await page.screenshot({ path: `${OUT}/D_under_arch_out.png` });

// Shot E: stepped through to the south, look back north (+z) at the gate from
// outside, so leaving reads as having passed through it.
await frame(page, origin, 0, -20, 0);
await page.screenshot({ path: `${OUT}/E_stepped_through_lookback.png` });

// Shot F: oblique close-up of the door-leaf hinge pose (offset in x, look across).
await frame(page, origin, 7, -10, PI * 0.72);
await page.screenshot({ path: `${OUT}/F_leaf_hinge_oblique.png` });

// Shot G: re-entry arrival point hub-local (0,-10), just inside the gate.
await frame(page, origin, 0, -10, PI);
await page.screenshot({ path: `${OUT}/G_reentry_point.png` });

console.log('errors:', errors.length ? errors.slice(0, 12).join('\n') : 'none');
await page.close();
await browser.disconnect();
console.log('wrote screenshots to', OUT);
