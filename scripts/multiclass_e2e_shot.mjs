// PHAA-466 end-to-end acceptance script: the multiclass / secondary-profession
// loop, through the real game UI surfaces (the talents window and the
// Profession Trainer NPC panel), screenshot for QA evidence.
//
// Recipe (browserless): a dev server is started with ALLOW_DEV_COMMANDS=1 and
// `vite --host` so the remote headless browser can reach it, then this script
// connects to the Browserless CDP endpoint (BROWSERLESS_WS) and drives the
// game. Leveling uses the dev /level cheat (ALLOW_DEV_COMMANDS=1, dev only).
//
//   GAME_URL=http://10.0.0.100:5173 BROWSERLESS_WS=ws://10.0.0.100:3000 \
//     ALLOW_DEV_COMMANDS=1 npm run dev -- --host & \
//   node scripts/multiclass_e2e_shot.mjs
//
// Offline mode is the same deterministic sim the server runs, so the trainer
// gate, the dual-tree allocation, and the half-cap all resolve identically.
// Outputs PNGs into docs/screenshots/phaa-466/ (copied to Nextcloud QA by the
// operator; see the PHAA-466 ticket).
//
// What it proves, in order:
//   1. A character is created (offline flow picks Warrior).
//   2. Levels to 20 (dev only, ALLOW_DEV_COMMANDS=1) so the level-10 secondary
//      profession gate is clear.
//   3. Enters the Hollow hub instance, where Elder Yarrow (the Profession
//      Trainer NPC) is spawned, and stands next to him.
//   4. Picks Priest as the secondary profession via the trainer NPC command
//      (sim.setSecondaryClass, the same server-authoritative call the trainer
//      panel makes), which slots the Priest ability kit onto the Warrior.
//   5. Allocates points in BOTH trees: a primary Arms build plus a Priest
//      secondary build, validated by the sim (shared pool + half-cap).
//   6. Opens the talents window (HUD), captures the primary and secondary tabs.
//   7. Opens the trainer panel (HUD), captures the picker showing the current
//      secondary bound and the other classes on offer.

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/screenshots/phaa-466';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({
  browserWSEndpoint: WS,
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`);
});

console.log('connecting to', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#btn-offline', { timeout: 60000 });

// 1) Character creation: offline flow, Warrior.
await page.evaluate(() => document.querySelector('#btn-offline').click());
await sleep(250);
await page.type('#char-name', 'Finch');
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="warrior"]').click(),
);
await page.evaluate(() => document.querySelector('#btn-start-offline').click());
await page.evaluate(() => {
  const btn = document.getElementById('mobile-preflight-continue');
  if (btn) btn.click();
});
await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 90000, polling: 250 });
await sleep(2500);
console.log('character created');

// 2) Level to 20 with the dev cheat (ALLOW_DEV_COMMANDS=1, dev only). Done
//    through the sim directly so the proof does not depend on chat parsing.
await page.evaluate(() => {
  window.__game.sim.setPlayerLevel(20);
  const p = window.__game.sim.player;
  p.maxHp = p.hp = 99999;
});
await sleep(400);

// 3) Enter the Hollow hub instance and stand next to Elder Yarrow, the
//    Profession Trainer NPC who teaches every class as a secondary.
const _trainer = await page.evaluate(() => {
  const sim = window.__game.sim;
  sim.enterDungeon('the_hollow', sim.playerId);
  const p = sim.entities.get(sim.playerId);
  p.maxHp = p.hp = 99999;
  return null;
});
await sleep(800);
const yarrow = await page.evaluate(() => {
  const sim = window.__game.sim;
  const npc = [...sim.entities.values()].find(
    (e) => e.kind === 'npc' && e.templateId === 'elder_yarrow',
  );
  if (!npc) throw new Error('Elder Yarrow not found in the Hollow hub');
  // Stand inside the trainer's interact range so the pick command is legal.
  const p = sim.player;
  p.pos.x = npc.pos.x;
  p.pos.z = npc.pos.z + 2;
  p.facing = Math.atan2(npc.pos.x - p.pos.x, npc.pos.z - p.pos.z);
  window.__game.input.camYaw = p.facing;
  return { id: npc.id, templateId: npc.templateId, x: npc.pos.x, z: npc.pos.z };
});
await sleep(600);
console.log('trainer located:', JSON.stringify(yarrow));

// 4) Pick Priest as the secondary profession. setSecondaryClass is the same
//    server-authoritative command the trainer panel calls through IWorldTrainer;
//    it checks the level gate, the trainer's profession list, interact range,
//    and cost (first pick is free). It also refreshes known abilities so the
//    Priest kit is slotted onto the Warrior.
const pickOk = await page.evaluate((yarrowId) => {
  const sim = window.__game.sim;
  try {
    sim.setSecondaryClass(yarrowId, 'priest');
    return window.__game.sim.secondaryCls === 'priest';
  } catch (e) {
    return `THREW: ${e.message}`;
  }
}, yarrow.id);
console.log('secondary pick result:', pickOk);
if (pickOk !== true) throw new Error(`setSecondaryClass did not bind priest: ${pickOk}`);

// 5) Allocate points in both trees. Primary: Arms spec + class-tree ranks.
//    Secondary: Priest class-tree rank (Wand Specialization). Validated by
//    the sim: shared pool (10 points at level 20) and the secondary half-cap
//    (floor(10/2) = 5). 5 primary + 3 secondary = 8, under both ceilings.
const allocOk = await page.evaluate(() => {
  const sim = window.__game.sim;
  const alloc = {
    spec: 'arms',
    ranks: { war_toughness: 3, war_cruelty: 2 },
    choices: {},
    secondary: {
      spec: 'discipline',
      ranks: { pri_wand_specialization: 3 },
      choices: {},
    },
  };
  try {
    const ok = sim.applyTalents(alloc);
    return { ok, secondary: sim.talents.secondary, primarySpent: 5 };
  } catch (e) {
    return `THREW: ${e.message}`;
  }
});
console.log('allocation result:', JSON.stringify(allocOk));
if (allocOk?.ok !== true) throw new Error(`applyTalents failed: ${JSON.stringify(allocOk)}`);

// 6) Open the talents window and capture the primary (Arms/Warrior) and
//    secondary (Priest) tabs.
await page.evaluate(() => window.__game.hud.toggleTalents());
await sleep(900);
await page.screenshot({ path: `${OUT}/talents-window-primary.png` });
console.log('shot talents-window-primary.png');

// Switch to the secondary tab (data-tab="secondary") and capture it.
const switched = await page.evaluate(() => {
  const tab = document.querySelector('#talents-window .tal-tab[data-tab="secondary"]');
  if (!tab) return false;
  tab.click();
  return true;
});
await sleep(700);
if (!switched) throw new Error('secondary tab not present in the talents window');
await page.screenshot({ path: `${OUT}/talents-window-secondary.png` });
console.log('shot talents-window-secondary.png');

// Close the talents window before opening the trainer panel.
await page.evaluate(() => {
  const el = document.querySelector('#talents-window');
  if (el) el.style.display = 'none';
});
await sleep(300);

// 7) Open the Profession Trainer panel and capture the picker. This is the
//    same TrainerPanel the HUD mounts when a player clicks "Train Secondary"
//    on the NPC's gossip menu; here it is opened directly so the shot is
//    stable. Priest shows as the bound ("Current") class; the other eight
//    classes are pickable rows.
await page.evaluate(
  (npcId, tpl) => {
    const hud = window.__game.hud;
    // The trainer panel is private in TS but reachable at runtime; it is the
    // one TrainerPanel instance the HUD owns (src/ui/hud.ts).
    hud.trainerPanel.open(npcId, tpl);
  },
  yarrow.id,
  yarrow.templateId,
);
await sleep(700);
await page.screenshot({ path: `${OUT}/trainer-panel.png` });
console.log('shot trainer-panel.png');

// Collect a structured report alongside the PNGs so the QA evidence records
// the deterministic state, not just pixels.
const report = await page.evaluate(() => {
  const sim = window.__game.sim;
  return {
    cls: sim.primaryCls,
    secondaryCls: sim.secondaryCls,
    level: sim.player.level,
    secondaryChanges: sim.secondaryClsChanges,
    talents: sim.talents,
  };
});
report._pageErrors = errors; // Node-side console/pageerror log
fs.writeFileSync(`${OUT}/e2e-report.json`, JSON.stringify(report, null, 2));
console.log('report:', JSON.stringify({ ...report, errors: undefined }, null, 2));

await browser.disconnect();
console.log('done; PNGs + e2e-report.json written to', OUT);
