// PHAA-588 LIVE end-to-end acceptance (Brandon's follow-up request): drive the
// REAL play.html client against the authoritative server, register an account,
// create a FEMALE character (sex toggle -> 'f') for ~3 classes, enter the live
// world, walk, and fight a real mob. Captures screenshots at creation, idle,
// walking, and mid-combat for each class and dumps per-class world state so we
// can prove the character is server-side female and actually took/​dealt damage.
//
// Connects to a remote Browserless CDP endpoint (this container has no Chrome).
// Needs: authoritative server on :8787, vite --host serving play.html, both
// reachable from Browserless.
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
// caster / plate-melee / ranged for animation variety
const PLAN = [
  { cls: 'mage', name: `Mag${alpha}` },
  { cls: 'warrior', name: `War${alpha}` },
  { cls: 'hunter', name: `Hun${alpha}` },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

const browser = await puppeteer.connect({ browserWSEndpoint: WS, protocolTimeout: 120000 });

for (let idx = 0; idx < PLAN.length; idx++) {
  const { cls, name } = PLAN[idx];
  const user = `qaf${uniq}${idx}`;
  const pass = 'hunter22';
  const rec = { cls, name, user, steps: [], errors: [] };
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 820 });
  page.on('pageerror', (e) => rec.errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') rec.errors.push('CONSOLE: ' + m.text());
  });
  const shot = async (label) => {
    const p = `${OUT}/${idx}_${cls}_${label}.png`;
    await page.screenshot({ path: p });
    rec.steps.push(label);
    console.log(`  shot ${p}`);
  };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1000);

    // Register the account via the same-origin REST endpoint the client uses,
    // then log in through the real UI.
    const reg = await page.evaluate(
      async (u, p) => {
        const r = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p }),
        });
        return { status: r.status, body: await r.text() };
      },
      user,
      pass,
    );
    console.log(`[${cls}] register ${user}: ${reg.status}`);

    // Login through the UI (default auth mode is login).
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

    // After login the realm list appears; pick the (only) realm to advance.
    await page.waitForFunction(
      () => {
        const vis = (id) => {
          const el = document.querySelector(id);
          return el && el.offsetParent !== null;
        };
        return vis('#realm-panel') || vis('#charselect-panel') || vis('#charcreate-panel');
      },
      { timeout: 20000, polling: 200 },
    );
    await page.evaluate(() => {
      const rp = document.querySelector('#realm-panel');
      if (rp && rp.offsetParent !== null) {
        const row = document.querySelector('#realm-list .realm-row');
        row?.click();
      }
    });

    // Wait for either the roster or the create panel to be visible.
    await page.waitForFunction(
      () => {
        const vis = (id) => {
          const el = document.querySelector(id);
          return el && el.offsetParent !== null;
        };
        return vis('#charselect-panel') || vis('#charcreate-panel');
      },
      { timeout: 20000, polling: 200 },
    );

    // Fresh account: open the create panel if we landed on the roster.
    await page.evaluate(() => {
      const cc = document.querySelector('#charcreate-panel');
      if (!cc || cc.offsetParent === null) {
        document.querySelector('#btn-new-character')?.click();
      }
    });
    await page.waitForFunction(
      () => document.querySelector('#charcreate-panel')?.offsetParent !== null,
      { timeout: 10000, polling: 200 },
    );
    await sleep(500);

    // Choose class, then toggle sex -> Female, and let the live preview settle.
    const picked = await page.evaluate((cls) => {
      const clsBtn = document.querySelector(`#charcreate-panel .mini-class[data-class="${cls}"]`);
      clsBtn?.click();
      const fem = document.querySelector('#charcreate-panel .sex-toggle .sex-opt[data-sex="f"]');
      fem?.click();
      document.querySelector('#new-char-name').value = '';
      const femSelected = document
        .querySelector('#charcreate-panel .sex-toggle .sex-opt[data-sex="f"]')
        ?.classList.contains('sel');
      return { hadClass: !!clsBtn, hadFemToggle: !!fem, femSelected };
    }, cls);
    rec.femaleToggle = picked;
    await page.type('#new-char-name', name);
    // The female outfit GLBs are multi-MB; give the preview time to load/render.
    await sleep(5000);
    // Record whether the preview canvas actually painted non-black pixels.
    rec.previewPainted = await page.evaluate(() => {
      const cv = document.querySelector('#charcreate-preview-container canvas');
      if (!cv) return { canvas: false };
      try {
        const g = cv.getContext('webgl2') || cv.getContext('webgl');
        // can't easily read a webgl backbuffer post-swap; report canvas size only
        return { canvas: true, w: cv.width, h: cv.height };
      } catch (e) {
        return { canvas: true, err: String(e) };
      }
    });
    await shot('create_female_preview');

    // Create.
    await page.evaluate(() => document.querySelector('#btn-create-char').click());
    await sleep(1500);

    // Back on the roster: wait for our freshly-created row to appear.
    await page.waitForFunction(
      () => document.querySelector('#charselect-panel')?.offsetParent !== null,
      { timeout: 15000, polling: 250 },
    );
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll('#char-list .char-row')].some((r) =>
          r.querySelector('.char-name')?.textContent?.includes(name),
        ),
      { timeout: 15000, polling: 300 },
      name,
    );
    const entered = await page.evaluate((name) => {
      const rows = [...document.querySelectorAll('#char-list .char-row')];
      const row = rows.find((r) => r.querySelector('.char-name')?.textContent?.includes(name));
      if (!row) return { ok: false, rows: rows.map((r) => r.textContent) };
      row.querySelector('.enter-world-btn')?.click();
      return { ok: true };
    }, name);
    rec.entered = entered;
    if (!entered.ok) throw new Error(`no roster row for ${name}: ${JSON.stringify(entered.rows)}`);

    // Wait until our player exists in the mirrored world.
    await page.waitForFunction(
      () => {
        const g = window.__game;
        return g && g.world && g.world.player && g.world.player.pos;
      },
      { timeout: 40000, polling: 300 },
    );
    await sleep(1200);
    // Clear any intro/tutorial dialogs first (a modal blocks input + view).
    for (let i = 0; i < 8; i++) {
      const clicked = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].filter(
          (b) =>
            b.offsetParent &&
            /skip|continue|close|ok|begin|got it|accept/i.test(b.textContent ?? ''),
        );
        if (btns.length) {
          btns[0].click();
          return true;
        }
        return false;
      });
      if (!clicked) break;
      await sleep(400);
    }
    await sleep(1500);

    // Prove the server-side character is female + capture idle.
    const self0 = await page.evaluate(() => {
      const g = window.__game;
      const p = g.world.player;
      return {
        name: p?.name,
        cls: p?.cls ?? p?.class,
        sex: p?.sex,
        hp: p?.hp,
        maxHp: p?.maxHp,
        pos: p?.pos ? { x: Math.round(p.pos.x), z: Math.round(p.pos.z) } : null,
        entities: g.world.entities.size,
      };
    });
    rec.selfIdle = self0;
    await shot('world_idle');

    // WALK: hold W and confirm position changes.
    await page.bringToFront();
    await sleep(300);
    await page.keyboard.down('w');
    await sleep(2200);
    await page.keyboard.up('w');
    await sleep(500);
    const self1 = await page.evaluate(() => {
      const p = window.__game.world.player;
      return { pos: { x: Math.round(p.pos.x), z: Math.round(p.pos.z) } };
    });
    rec.walkedYd =
      self0.pos && self1.pos
        ? Math.round(Math.hypot(self1.pos.x - self0.pos.x, self1.pos.z - self0.pos.z))
        : 0;
    await shot('world_walk');

    // FIGHT: find nearest hostile mob, target it, and attack.
    const target = await page.evaluate(() => {
      const g = window.__game;
      const me = g.world.player;
      const ents = [...g.world.entities.values()];
      const mobs = ents.filter(
        (e) => e.kind === 'mob' || e.kind === 'npc' || (e.kind !== 'player' && e.hostile),
      );
      let best = null;
      let bd = Infinity;
      for (const e of mobs) {
        if (!e.pos || e.dead) continue;
        const d = Math.hypot(e.pos.x - me.pos.x, e.pos.z - me.pos.z);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      return best
        ? { id: best.id, name: best.name, kind: best.kind, dist: Math.round(bd), hp: best.hp }
        : null;
    });
    rec.targetFound = target;

    if (target) {
      // Walk toward the mob, then target (Tab) and mash the first ability + auto-attack.
      await page.evaluate(
        (tx, tz) => {
          const g = window.__game;
          const me = g.world.player;
          g.input.camYaw = Math.atan2(tx - me.pos.x, tz - me.pos.z);
        },
        0,
        0,
      );
      // approach
      await page.keyboard.down('w');
      await sleep(1200);
      await page.keyboard.up('w');
      await sleep(300);
      // target nearest
      await page.keyboard.press('Tab');
      await sleep(400);
      // fire abilities / auto-attack a few times
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press(String((i % 3) + 1));
        await sleep(600);
      }
      await sleep(600);
      const combat = await page.evaluate((tid) => {
        const g = window.__game;
        const me = g.world.player;
        const t = [...g.world.entities.values()].find((e) => e.id === tid);
        // read combat log lines for damage evidence
        const log = [...document.querySelectorAll('#combatlog div, #chatlog div')]
          .slice(-12)
          .map((d) => d.textContent?.trim())
          .filter(Boolean);
        return {
          myHp: me.hp,
          myMaxHp: me.maxHp,
          targetHp: t ? t.hp : 'gone',
          targetDead: t ? !!t.dead : true,
          castingId: me.castId ?? me.casting ?? null,
          log: log.slice(-8),
        };
      }, target.id);
      rec.combat = combat;
      await shot('world_combat');
    } else {
      rec.combat = 'no mob in interest range';
      await shot('world_combat_nomob');
    }

    // A cast-specific capture for the mage: trigger and grab mid-cast.
    if (cls === 'mage' || cls === 'hunter') {
      await page.keyboard.press('Tab');
      await sleep(200);
      await page.keyboard.press('2');
      await sleep(250); // grab during the cast/wind-up
      await shot('world_cast');
    }
  } catch (err) {
    rec.fatal = String(err.message ?? err);
    console.log(`[${cls}] FATAL: ${rec.fatal}`);
    try {
      await shot('error_state');
    } catch {}
  }

  results.push(rec);
  await page.close();
}

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
console.log('\n==== SUMMARY ====');
for (const r of results) {
  console.log(
    `${r.cls}/${r.name}: femToggle=${JSON.stringify(r.femaleToggle)} sex=${r.selfIdle?.sex} walked=${r.walkedYd}yd target=${JSON.stringify(r.targetFound)} combat=${JSON.stringify(r.combat)} err=${r.errors.length} fatal=${r.fatal ?? '-'}`,
  );
}
await browser.disconnect();
console.log('\nwrote', OUT);
