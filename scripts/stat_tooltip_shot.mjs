// Character-sheet stat tooltip screenshots: desktop + mobile (portrait and
// landscape). Offline flow (no server). Needs `npm run dev`. Writes PNGs to tmp/.
//
// Proves the class-aware stat hover tooltip is beautiful and responsive: it
// captures the rich Agility breakdown (5 lines + header), a derived stat with an
// informational line (Armor -> damage reduction), and the dps estimate note, and
// it exercises the touch long-press peek path at narrow widths to confirm the
// tooltip never overflows / clips. Puppeteer reloads the page when mobile
// emulation is toggled, so each device boots fresh at its own viewport.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { BROWSER_PATH as EDGE } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const CLASS = process.env.GAME_CLASS ?? 'hunter';
const PEEK_MS = 950; // TOOLTIP_PEEK_MS in src/ui/touch_peek.ts
fs.mkdirSync('tmp', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/502|project stats/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

const waitFor = (sel) => page.waitForSelector(sel, { visible: true, timeout: 30000 });

async function bootAndKit() {
  await waitFor('#btn-offline');
  await wait(200);
  await page.evaluate(() => document.querySelector('#btn-offline')?.click());
  await waitFor('#offline-select .mini-class');
  await page.evaluate(() => {
    const n = document.querySelector('#char-name');
    if (n) { n.value = 'Trueshot'; n.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.evaluate((c) => document.querySelector(`#offline-select .mini-class[data-class="${c}"]`)?.click(), CLASS);
  await wait(150);
  await page.evaluate(() => document.querySelector('#btn-start-offline')?.click());
  let booted = false;
  for (let i = 0; i < 40; i++) {
    booted = await page.evaluate(() => !!(window.__game && window.__game.sim));
    if (booted) break;
    await wait(500);
  }
  if (!booted) throw new Error('game never booted');
  await wait(800);
  await page.evaluate(() => {
    const sim = window.__game.sim;
    const pid = sim.player.id;
    sim.setPlayerLevel(20);
    sim.player.maxHp = 99999; sim.player.hp = 99999;
    const set = {
      mainhand: 'worn_sword', helmet: 'cryptbone_helm', shoulder: 'gravewyrm_mantle',
      chest: 'recruit_tunic', waist: 'boundstone_girdle', legs: 'quilted_trousers',
      gloves: 'mistveil_grips', feet: 'oiled_boots',
    };
    for (const id of Object.values(set)) { try { sim.addItem(id, 1, pid); sim.equipItem(id, pid); } catch {} }
  });
  await wait(300);
  await page.evaluate(() => {
    const h = window.__game.hud;
    if (document.querySelector('#char-window').style.display !== 'block') h.toggleChar();
  });
  await wait(500);
}

const ttMetrics = () => page.evaluate(() => {
  const tt = document.querySelector('#tooltip');
  if (tt.style.display !== 'block') return { shown: false };
  const r = tt.getBoundingClientRect();
  return {
    shown: true, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom),
    width: Math.round(r.width), vw: window.innerWidth, vh: window.innerHeight,
    overflow: r.right > window.innerWidth || r.left < 0 || r.top < 0 || r.bottom > window.innerHeight,
  };
});

async function hoverShot(stat, file) {
  await page.evaluate((s) => {
    document.querySelector(`.char-stats [data-stat="${s}"]`)?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  }, stat);
  await wait(250);
  await page.screenshot({ path: file });
  const m = await ttMetrics();
  await page.evaluate(() => window.__game.hud.hideTooltip());
  return m;
}

async function longPressShot(stat, file) {
  await page.evaluate(() => document.body.classList.add('mobile-touch'));
  await page.evaluate((s) => {
    const cell = document.querySelector(`.char-stats [data-stat="${s}"]`);
    const r = cell.getBoundingClientRect();
    cell.dispatchEvent(new PointerEvent('pointerdown', {
      pointerType: 'touch', clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true,
    }));
  }, stat);
  await wait(PEEK_MS + 300);
  await page.screenshot({ path: file });
  const m = await ttMetrics();
  await page.evaluate(() => window.__game.hud.hideTooltip());
  return m;
}

// Re-center/re-render the (already open) character window at the current viewport.
// Toggling isMobile would reload the page (and the WebGL boot fails under headless
// mobile emulation), so we boot once at desktop then plain-resize: the responsive
// layout is width-driven and the tooltip's clamp reads window.innerWidth, both of
// which a plain resize exercises faithfully. mobile-touch enables the long-press peek.
async function reopenChar() {
  if (!(await page.evaluate(() => !!(window.__game && window.__game.sim)))) throw new Error('lost game on resize');
  await page.evaluate(() => {
    const h = window.__game.hud;
    if (document.querySelector('#char-window').style.display === 'block') h.toggleChar();
    h.hideTooltip();
  });
  await wait(150);
  await page.evaluate(() => window.__game.hud.toggleChar());
  await wait(450);
}

const results = {};

// --- desktop -------------------------------------------------------------
await page.setViewport({ width: 1280, height: 860 });
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await bootAndKit();
await page.screenshot({ path: 'tmp/stat_tooltip_char_panel.png' });
results.desktop_agi = await hoverShot('agi', 'tmp/stat_tooltip_desktop_agi.png');
await hoverShot('armor', 'tmp/stat_tooltip_desktop_armor.png');
await hoverShot('dps', 'tmp/stat_tooltip_desktop_dps.png');

// --- mobile portrait (plain resize, touch long-press) --------------------
await page.setViewport({ width: 390, height: 844 });
await reopenChar();
await page.screenshot({ path: 'tmp/stat_tooltip_mobile_portrait_panel.png' });
results.mobile_portrait_agi = await longPressShot('agi', 'tmp/stat_tooltip_mobile_portrait_agi.png');

// --- mobile landscape ----------------------------------------------------
await page.setViewport({ width: 844, height: 390 });
await reopenChar();
await page.screenshot({ path: 'tmp/stat_tooltip_mobile_landscape_panel.png' });
results.mobile_landscape_agi = await longPressShot('agi', 'tmp/stat_tooltip_mobile_landscape_agi.png');

console.log('tooltip metrics:', JSON.stringify(results, null, 2));
console.log(errors.length ? ('PAGE ERRORS:\n' + errors.join('\n')) : 'no page/console errors');
console.log('wrote tmp/stat_tooltip_*.png');
await browser.close();
