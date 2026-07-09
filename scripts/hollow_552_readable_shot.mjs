// PHAA-552 acceptance shots: a world-placed readable book in The Hollow Reaches,
// its "Read" proximity prompt, and the opened reader. Connects to a remote
// Browserless CDP endpoint (BROWSERLESS_WS); the dev server must be reachable
// from that endpoint (GAME_URL). Writes PNGs into docs/screenshots/phaa-552/.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = 'docs/screenshots/phaa-552';
fs.mkdirSync(OUT, { recursive: true });

async function startOffline(page, viewport) {
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`);
  });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 45000 });
  await page.evaluate(() => document.querySelector('#btn-offline').click());
  await new Promise((r) => setTimeout(r, 200));
  await page.type('#char-name', 'Wren');
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

const tp = async (page, x, z, yaw = 0) => {
  await page.evaluate(
    (x, z, yaw) => {
      const g = window.__game;
      const p = g.sim.player;
      if (p.dead) g.sim.releaseSpirit();
      p.maxHp = p.hp = 99999;
      p.pos.x = x;
      p.pos.z = z;
      p.facing = yaw;
      g.input.camYaw = yaw;
    },
    x,
    z,
    yaw,
  );
  await new Promise((r) => setTimeout(r, 3500));
};

// Dismiss the PHAA-431 cold-open modal ("You come to on warm ground...") that
// covers the view on first hub/world entry.
const dismissColdOpen = async (page) => {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      ['Skip', 'Continue', 'Skip Tutorial'].includes(b.textContent?.trim()),
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 300));
};

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = await startOffline(page, { width: 1280, height: 800 });

// Cold-open lands at the vase; leave the shrine into the open-world Reaches.
await new Promise((r) => setTimeout(r, 1000));
await dismissColdOpen(page);
await page.evaluate(() => window.__game.sim.leaveDungeon(window.__game.sim.player.id));
await new Promise((r) => setTimeout(r, 1500));
await dismissColdOpen(page);
await dismissColdOpen(page);

// The torn ledger page sits just off the gate clearing at world (6, -262).
const BOOK = { x: 6, z: -262 };
const readable = await page.evaluate(() => {
  const props = window.__game.sim.readableProps;
  return props.find((p) => p.id === 'torn_ledger_page') ?? props[0] ?? null;
});
console.log('readableProps:', JSON.stringify(readable));

// Framing note (PHAA-552): the follow camera sits directly behind the player
// along its facing, so anything DEAD AHEAD (yaw 0, book due north) is occluded
// by the player character model and the near grass tuft. Stand off to one side
// and look diagonally/laterally so the book is beside the player, not behind
// them. Verified projections: at (2,-270) yaw ~PI/4 the lectern frames cleanly
// to the player's right; standing close with yaw -PI/2 puts it screen-left.
//
// Clean prop shot: stand back and to the side, book unoccluded, outside
// READ_RADIUS (3) so no prompt overlay.
await tp(page, 2, -270, Math.PI / 4);
await dismissColdOpen(page);
await page.screenshot({ path: `${OUT}/00_book_prop.png` });

// Step into read range (2.4 paces south of the book) and face west (yaw -PI/2)
// so the book sits screen-left, beside the player, while the "Read" proximity
// prompt shows at bottom-center.
await tp(page, BOOK.x, BOOK.z - 2.4, -Math.PI / 2);
await dismissColdOpen(page);
await page.screenshot({ path: `${OUT}/01_book_and_prompt.png` });
console.log(
  'nearReadable:',
  await page.evaluate(() => JSON.stringify(window.__game.renderer.nearReadable)),
);

// Open the reader on the book the player is standing at (the same call main.ts's
// interact-key handler makes when renderer.nearReadable is set).
await page.evaluate(() => {
  const near = window.__game.renderer.nearReadable;
  window.__game.hud.openReadable(near ? near.id : 'torn_ledger_page');
});
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: `${OUT}/02_reader_page1.png` });

// Turn to the next page (click the Continue button in the reader).
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('#quest-dialog .btn')].pop();
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: `${OUT}/03_reader_page2.png` });

console.log('errors:', errors.length ? errors.slice(0, 12).join('\n') : 'none');
await page.close();
await browser.disconnect();
console.log('wrote screenshots to', OUT);
