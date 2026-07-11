// PHAA-588 LIVE combat + close-up pass (Brandon's follow-up): same live
// register -> create FEMALE -> realm -> enter-world flow as the E2E script, but
// this pass (a) zooms the camera in for a clean close-up of the female model per
// class and (b) stages a REAL fight: dev_level for a fuller kit, dev_teleport to
// the near-immortal training dummy (world -40,648), target + auto-attack + cast a
// class ability, and record the dummy's HP delta so damage is PROVEN, not assumed.
//   BROWSERLESS_WS=ws://10.0.0.100:3000  GAME_URL=http://<container-ip>:<port>
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const BASE = process.env.GAME_URL ?? 'http://localhost:5266';
const URL = `${BASE}/play.html`;
const OUT = process.env.OUT ?? 'tmp/phaa588-live';
fs.mkdirSync(OUT, { recursive: true });

const uniq = Date.now().toString(36).slice(-5);
const alpha = uniq.replace(/[0-9]/g, (d) => 'abcdefghij'[Number(d)]);
const DUMMY = { x: -40, z: 648 };
const PLAN = [
  { cls: 'mage', name: `Fem${alpha}a`, ability: 'fireball' },
  { cls: 'warrior', name: `Fem${alpha}b`, ability: 'heroic_strike' },
  { cls: 'hunter', name: `Fem${alpha}c`, ability: 'arcane_shot' },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
// Optional comma-separated idx filter, e.g. ONLY=1,2 to re-run warrior+hunter.
const ONLY = (process.env.ONLY ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s !== '')
  .map(Number);

const browser = await puppeteer.connect({ browserWSEndpoint: WS, protocolTimeout: 120000 });

for (let idx = 0; idx < PLAN.length; idx++) {
  if (ONLY.length && !ONLY.includes(idx)) continue;
  const { cls, name, ability } = PLAN[idx];
  const user = `qac${uniq}${idx}`;
  const pass = 'hunter22';
  const rec = { cls, name, user, steps: [], errors: [] };
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 820 });
  page.on('pageerror', (e) => rec.errors.push('PE: ' + e.message));
  const shot = async (label) => {
    const p = `${OUT}/${idx}_${cls}_${label}.png`;
    await page.screenshot({ path: p });
    rec.steps.push(label);
    console.log(`  shot ${p}`);
  };
  const send = (payload) => page.evaluate((pl) => window.__game?.online?.cmd?.(pl), payload);

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(900);
    await page.evaluate(
      async (u, p) => {
        await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p }),
        });
      },
      user,
      pass,
    );
    await page.evaluate(() => document.querySelector('#btn-online')?.click());
    await sleep(400);
    await page.evaluate(
      (u, p) => {
        document.querySelector('#login-user').value = u;
        document.querySelector('#login-pass').value = p;
        document.querySelector('#btn-login').click();
      },
      user,
      pass,
    );
    await page.waitForFunction(
      () => {
        const v = (id) => document.querySelector(id)?.offsetParent != null;
        return v('#realm-panel') || v('#charselect-panel') || v('#charcreate-panel');
      },
      { timeout: 20000, polling: 200 },
    );
    await page.evaluate(() => {
      if (document.querySelector('#realm-panel')?.offsetParent != null)
        document.querySelector('#realm-list .realm-row')?.click();
    });
    await page.waitForFunction(
      () => {
        const v = (id) => document.querySelector(id)?.offsetParent != null;
        return v('#charselect-panel') || v('#charcreate-panel');
      },
      { timeout: 20000, polling: 200 },
    );
    await page.evaluate(() => {
      const cc = document.querySelector('#charcreate-panel');
      if (!cc || cc.offsetParent == null) document.querySelector('#btn-new-character')?.click();
    });
    await page.waitForFunction(
      () => document.querySelector('#charcreate-panel')?.offsetParent != null,
      { timeout: 10000, polling: 200 },
    );
    await sleep(1000);
    // Select class + female, type the name, and confirm all three registered
    // before creating; retry the create if the roster stays empty (create can
    // silently no-op if the class .sel hasn't applied yet).
    const roster = () =>
      page.evaluate(
        (name) =>
          [...document.querySelectorAll('#char-list .char-row')].some((r) =>
            r.querySelector('.char-name')?.textContent?.includes(name),
          ),
        name,
      );
    let created = false;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      rec.femaleToggle = await page.evaluate(
        (cls, name) => {
          document.querySelector(`#charcreate-panel .mini-class[data-class="${cls}"]`)?.click();
          document.querySelector('#charcreate-panel .sex-toggle .sex-opt[data-sex="f"]')?.click();
          const input = document.querySelector('#new-char-name');
          if (input && input.value !== name) input.value = name;
          return {
            classSel: document
              .querySelector(`#charcreate-panel .mini-class[data-class="${cls}"]`)
              ?.classList.contains('sel'),
            femSel: document
              .querySelector('#charcreate-panel .sex-toggle .sex-opt[data-sex="f"]')
              ?.classList.contains('sel'),
            name: input?.value,
          };
        },
        cls,
        name,
      );
      if (rec.femaleToggle.name !== name) {
        await page.evaluate(() => (document.querySelector('#new-char-name').value = ''));
        await page.type('#new-char-name', name);
      }
      await sleep(800);
      await page.evaluate(() => document.querySelector('#btn-create-char').click());
      await sleep(1800);
      rec.createErr = await page.evaluate(
        () => document.querySelector('#charselect-error')?.textContent || '',
      );
      created = await roster();
      // if we bounced back to the roster, re-open the create panel for a retry
      if (!created) {
        await page.evaluate(() => {
          if (document.querySelector('#charcreate-panel')?.offsetParent == null)
            document.querySelector('#btn-new-character')?.click();
        });
        await sleep(600);
      }
    }
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll('#char-list .char-row')].some((r) =>
          r.querySelector('.char-name')?.textContent?.includes(name),
        ),
      { timeout: 15000, polling: 300 },
      name,
    );
    await page.evaluate((name) => {
      const row = [...document.querySelectorAll('#char-list .char-row')].find((r) =>
        r.querySelector('.char-name')?.textContent?.includes(name),
      );
      row?.querySelector('.enter-world-btn')?.click();
    }, name);
    await page.waitForFunction(() => window.__game?.world?.player?.pos, {
      timeout: 40000,
      polling: 300,
    });
    await sleep(1200);
    // dismiss intro dialogs
    for (let i = 0; i < 8; i++) {
      const c = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].filter(
          (x) =>
            x.offsetParent &&
            /skip|continue|close|ok|begin|got it|accept/i.test(x.textContent ?? ''),
        );
        if (b.length) {
          b[0].click();
          return true;
        }
        return false;
      });
      if (!c) break;
      await sleep(350);
    }
    await sleep(800);
    rec.sex = await page.evaluate(() => window.__game.world.player.sex);

    // ---- CLOSE-UP of the female model in the live world ----
    await page.evaluate(() => {
      const g = window.__game;
      g.renderer.camDist = 4.2; // zoom in (default 12)
      g.renderer.camPitch = 0.25;
    });
    for (const [label, yaw] of [
      ['closeup_front', Math.PI],
      ['closeup_side', Math.PI / 2],
    ]) {
      await page.evaluate((y) => {
        const g = window.__game;
        g.input.camYaw = y;
        g.renderer.camYaw = y;
      }, yaw);
      await sleep(1200);
      await shot(label);
    }

    // ---- REAL FIGHT vs the training dummy ----
    await send({ cmd: 'dev_level', level: 20 });
    await sleep(600);
    await send({ cmd: 'dev_teleport', x: DUMMY.x + 3, z: DUMMY.z + 1 });
    await sleep(1800); // let the interest snapshot bring the dummy in
    const dummy0 = await page.evaluate(() => {
      const g = window.__game;
      const me = g.world.player;
      const d = [...g.world.entities.values()].find(
        (e) => e.name === 'Training Dummy' || /dummy/i.test(e.name ?? ''),
      );
      if (d) {
        // face the dummy
        g.input.camYaw = Math.atan2(d.pos.x - me.pos.x, d.pos.z - me.pos.z);
        g.renderer.camYaw = g.input.camYaw;
      }
      return d
        ? {
            id: d.id,
            name: d.name,
            hp: d.hp,
            maxHp: d.maxHp,
            dist: Math.round(Math.hypot(d.pos.x - me.pos.x, d.pos.z - me.pos.z)),
          }
        : null;
    });
    rec.dummy0 = dummy0;

    if (dummy0) {
      // pull the camera back a touch so both combatants + FCT are visible
      await page.evaluate(() => {
        window.__game.renderer.camDist = 8;
        window.__game.renderer.camPitch = 0.5;
      });
      await send({ cmd: 'target', id: dummy0.id });
      await sleep(300);
      await send({ cmd: 'attack' });
      // hammer the class ability + auto-attack for a few seconds
      for (let i = 0; i < 10; i++) {
        await send({ cmd: 'cast', ability });
        await send({ cmd: 'attack' });
        if (i === 3) await shot('fight_cast'); // grab a mid-cast/swing frame
        await sleep(700);
      }
      await sleep(500);
      const dummy1 = await page.evaluate((id) => {
        const g = window.__game;
        const d = [...g.world.entities.values()].find((e) => e.id === id);
        const log = [...document.querySelectorAll('#combatlog div, #chatlog div')]
          .slice(-14)
          .map((x) => x.textContent?.trim())
          .filter(Boolean);
        // any floating combat text numbers currently on screen?
        const fct = [...document.querySelectorAll('#fct div, .fct, .fct-num, [class*="fct"]')]
          .map((x) => x.textContent?.trim())
          .filter(Boolean)
          .slice(-10);
        return { hp: d ? d.hp : 'gone', maxHp: d ? d.maxHp : null, log: log.slice(-10), fct };
      }, dummy0.id);
      rec.dummy1 = dummy1;
      rec.damaged = dummy0.hp != null && dummy1.hp !== 'gone' ? dummy0.hp - dummy1.hp : 'n/a';
      await shot('fight');
    } else {
      await shot('fight_no_dummy');
    }
  } catch (err) {
    rec.fatal = String(err.message ?? err);
    console.log(`[${cls}] FATAL ${rec.fatal}`);
    try {
      await shot('error');
    } catch {}
  }
  results.push(rec);
  await page.close();
}

fs.writeFileSync(`${OUT}/combat_results.json`, JSON.stringify(results, null, 2));
console.log('\n==== COMBAT SUMMARY ====');
for (const r of results)
  console.log(
    `${r.cls}/${r.name}: sex=${r.sex} dummyHP ${r.dummy0?.hp}->${r.dummy1?.hp} damaged=${r.damaged} fct=${JSON.stringify(r.dummy1?.fct)} err=${r.errors.length} fatal=${r.fatal ?? '-'}`,
  );
await browser.disconnect();
console.log('wrote', OUT);
