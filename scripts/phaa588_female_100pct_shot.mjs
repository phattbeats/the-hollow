// PHAA-588 acceptance evidence (parent PHAA-583 female-chibi-100% gate).
//
// Run target: MUST be a checkout at origin/main (or ahead). The female combat
// clips (PHAA-586: anim_cast/anim_attack_* baked into the chibi GLBs) and the
// manifest `cast:'anim_cast'` mappings only exist from main; an older feature
// branch resolves cast -> idle fallback and would misreport the 100% bar.
//
// Capture strategy (Sable, 2026-07-11 rewrite):
//   Every shot is rendered by ONE offscreen WebGL rig with
//   preserveDrawingBuffer:true and read back via canvas.toDataURL(). That is
//   the only path that reliably returns real pixels under headless Chrome (a
//   clipped-element .screenshot() of a live WebGL canvas comes back blank,
//   which is what produced the byte-identical 1192 B / 4115 B blanks in the
//   two prior runs). The rig drives the REAL CharacterVisual state machine, so
//   the anim frames exercise the shipping clip-resolution code, and we read
//   back visual.current.getClip().name to PROVE which clip actually played
//   (e.g. cast -> anim_cast, not the idle fallback).
//
//   Part A  : 9 female class headshot portraits + 9 full-body shots.
//   Part A.2: color variants (skins 0..2) for one class per outfit family,
//             both portrait and full-body, so we can see which variants show
//             in the head-and-shoulders crop vs only on the body.
//   Part B  : anim-state sheet (idle/run/attack/cast/death) for a caster
//             (mage) and a melee (warrior), each with the played clip name.
//   Part C  : best-effort single in-world screenshot, female beside a live
//             male. Time-boxed so it can never hang the acceptance run.
import crypto from 'node:crypto';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const URL = process.env.GAME_URL ?? 'http://172.18.0.3:5199/play.html';
const OUT = process.env.OUT_DIR ?? 'evidence';
fs.mkdirSync(OUT, { recursive: true });

const CLASSES = [
  'warrior',
  'paladin',
  'hunter',
  'druid',
  'rogue',
  'mage',
  'priest',
  'warlock',
  'shaman',
];
// one class per outfit family: knight(warrior helmeted), archer(hunter),
// ninja(rogue), student(mage), merchant(warlock), basemesh(shaman).
const VARIANT_CLASSES = ['warrior', 'paladin', 'hunter', 'rogue', 'mage', 'warlock', 'shaman'];

const manifest = {};
function saveDataUrl(name, dataUrl, extra) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    console.log('  !! MISSING/invalid dataURL for', name, '->', String(dataUrl).slice(0, 48));
    manifest[name] = { bytes: 0, sha256: 'MISSING', ...extra };
    return;
  }
  const buf = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  fs.writeFileSync(`${OUT}/${name}.png`, buf);
  const sha = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  manifest[name] = { bytes: buf.length, sha256: sha, ...extra };
  console.log(
    `  saved ${name}.png (${buf.length} B, sha ${sha})${extra?.clip ? ' clip=' + extra.clip : ''}`,
  );
}
function saveBuf(name, buf, extra) {
  fs.writeFileSync(`${OUT}/${name}.png`, buf);
  const sha = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  manifest[name] = { bytes: buf.length, sha256: sha, ...extra };
  console.log(`  saved ${name}.png via screenshot (${buf.length} B, sha ${sha})`);
}

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
console.log('goto', URL);
await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
await page.waitForSelector('#btn-offline', { timeout: 90000 });
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => document.querySelector('#btn-offline').click());
await new Promise((r) => setTimeout(r, 600));

// Wait for character assets to preload (portraits + our rig need them).
await page.waitForFunction(
  async () => {
    const mod = await import('/src/render/characters/portrait.ts');
    return mod.portraitsReady();
  },
  { timeout: 120000, polling: 500 },
);
console.log('assets ready');

// ---- install the offscreen render rig in the page ---------------------------
await page.evaluate(async () => {
  // Import the SAME vite-optimized THREE the app uses (a bare 'three' specifier
  // is unresolvable in a runtime-injected import, and a second copy would break
  // cross-instance Object3D sharing with CharacterVisual).
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const { CharacterVisual } = await import('/src/render/characters/visual.ts');
  const W = 512,
    H = 660;
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
  const patch = {
    idle: {},
    run: { speed: 6, moving: true },
    attack: {},
    cast: { casting: true },
    death: { dead: true },
  };
  // Render one (key, skin, state) full-body shot. Returns {url, clip}.
  window.__shoot = async (visualKey, skin, stateName, yawDeg = 18) => {
    const v = new CharacterVisual(visualKey, 0xffffff, skin);
    mount.add(v.root);
    mount.rotation.y = (yawDeg * Math.PI) / 180;
    const st = { ...base, ...(patch[stateName] || {}) };
    for (let i = 0; i < 60; i++) v.update(1 / 20, st, true); // settle base/looping state
    if (stateName === 'attack') {
      v.playAttack();
      for (let i = 0; i < 10; i++) v.update(1 / 20, st, true);
    }
    // frame the whole model from its own bounds
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
    let clip = null;
    try {
      clip = v.current?.getClip?.().name ?? null;
    } catch {
      clip = null;
    }
    mount.remove(v.root);
    v.dispose();
    return { url, clip };
  };
});
console.log('offscreen rig installed');

// ---- Part A.1 portraits -----------------------------------------------------
console.log('Part A.1: 9 class headshot portraits');
for (const cls of CLASSES) {
  const url = await page.evaluate(async (c) => {
    const mod = await import('/src/render/characters/portrait.ts');
    return mod.visualPortraitDataUrl(`player_${c}_f`, 0);
  }, cls);
  saveDataUrl(`class_${cls}_female_portrait`, url);
}

// ---- Part A.1b full-body ----------------------------------------------------
console.log('Part A.1b: 9 class full-body shots');
for (const cls of CLASSES) {
  const { url, clip } = await page.evaluate((c) => window.__shoot(`player_${c}_f`, 0, 'idle'), cls);
  saveDataUrl(`body_${cls}_female_idle`, url, { clip });
}

// ---- Part A.2 variants (portrait + body, skins 0..2) ------------------------
console.log('Part A.2: color variants per outfit family');
for (const cls of VARIANT_CLASSES) {
  const n = await page.evaluate(async (c) => {
    const m = await import('/src/render/characters/chibi_skin_variants.ts');
    return m.chibiSkinCount(`player_${c}_f`);
  }, cls);
  const k = Math.min(3, n);
  console.log(`  ${cls}: ${n} variants`);
  for (let i = 0; i < k; i++) {
    const p = await page.evaluate(
      async (c, s) => {
        const mod = await import('/src/render/characters/portrait.ts');
        return mod.visualPortraitDataUrl(`player_${c}_f`, s);
      },
      cls,
      i,
    );
    saveDataUrl(`variant_${cls}_v${i}_portrait`, p);
    const { url } = await page.evaluate(
      (c, s) => window.__shoot(`player_${c}_f`, s, 'idle'),
      cls,
      i,
    );
    saveDataUrl(`variant_${cls}_v${i}_body`, url);
  }
}

// ---- Part B anim-state sheet ------------------------------------------------
console.log('Part B: anim-state sheet (idle/run/attack/cast/death)');
for (const cls of ['mage', 'warrior']) {
  for (const state of ['idle', 'run', 'attack', 'cast', 'death']) {
    const { url, clip } = await page.evaluate(
      (c, s) => window.__shoot(`player_${c}_f`, 0, s),
      cls,
      state,
    );
    saveDataUrl(`anim_${cls}_${state}`, url, { clip });
  }
}

// ---- Part C best-effort in-world beside a male (time-boxed) ------------------
console.log('Part C: in-world female beside male (best-effort, time-boxed)');
try {
  await Promise.race([
    (async () => {
      await page.waitForSelector('#offline-select .sex-toggle .sex-opt[data-sex="m"]', {
        timeout: 15000,
      });
      await page.evaluate(() =>
        document.querySelector('#offline-select .sex-toggle .sex-opt[data-sex="m"]').click(),
      );
      await page.type('#char-name', 'Refman');
      await page.evaluate(() =>
        document.querySelector('#offline-select .mini-class[data-class="warrior"]').click(),
      );
      await new Promise((r) => setTimeout(r, 300));
      await page.evaluate(() => document.querySelector('#btn-start-offline').click());
      await new Promise((r) => setTimeout(r, 500));
      await page.evaluate(() => {
        const b = document.getElementById('mobile-preflight-continue');
        if (b) b.click();
      });
      await page.waitForFunction(() => window.__game?.sim?.player, {
        timeout: 40000,
        polling: 250,
      });
      await new Promise((r) => setTimeout(r, 800));
      for (let i = 0; i < 6; i++) {
        const clicked = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find(
            (x) =>
              x.offsetParent && /skip|continue|close|ok|begin|got it/i.test(x.textContent ?? ''),
          );
          if (b) {
            b.click();
            return true;
          }
          return false;
        });
        if (!clicked) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      // spawn a female compare figure beside the live male
      const info = await page.evaluate(async () => {
        const mod = await import('/src/render/characters/roster_compare_harness.ts');
        const p = window.__game.sim.player;
        p.maxHp = p.hp = 99999;
        const i = await mod.spawnRosterCompare(window.__game, {
          key: 'player_mage_f',
          offsetX: 1.4,
        });
        return i ?? null;
      });
      await new Promise((r) => setTimeout(r, 1500));
      const buf = await page.screenshot({ type: 'png' });
      saveBuf('inworld_female_beside_male', buf, { spawn: info });
    })(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('inworld timeout 60s')), 60000)),
  ]);
} catch (e) {
  console.log('  Part C skipped:', e.message);
  manifest['inworld_female_beside_male'] = { bytes: 0, sha256: 'SKIPPED', note: e.message };
}

// ---- verification -----------------------------------------------------------
console.log('\n=== EVIDENCE MANIFEST ===');
const rows = Object.entries(manifest).sort();
for (const [n, m] of rows) {
  console.log(
    `${n.padEnd(34)} ${String(m.bytes).padStart(8)}  ${String(m.sha256).padEnd(18)}${m.clip ? ' clip=' + m.clip : ''}`,
  );
}
function distinct(names) {
  const set = new Set();
  let count = 0;
  for (const n of names) {
    if (manifest[n]) {
      set.add(manifest[n].sha256);
      count++;
    }
  }
  return { count, unique: set.size };
}
console.log(
  '\nclass portraits distinct:',
  JSON.stringify(distinct(CLASSES.map((c) => `class_${c}_female_portrait`))),
);
console.log(
  'class bodies distinct:',
  JSON.stringify(distinct(CLASSES.map((c) => `body_${c}_female_idle`))),
);
for (const cls of VARIANT_CLASSES) {
  const ports = [0, 1, 2].map((i) => `variant_${cls}_v${i}_portrait`);
  const bodies = [0, 1, 2].map((i) => `variant_${cls}_v${i}_body`);
  console.log(
    `variant ${cls}: portrait ${JSON.stringify(distinct(ports))}  body ${JSON.stringify(distinct(bodies))}`,
  );
}
console.log(
  '\ncast clip check:',
  'mage=' + (manifest['anim_mage_cast']?.clip ?? '?'),
  'warrior=' + (manifest['anim_warrior_cast']?.clip ?? '?'),
);
console.log('errors:', errors.length ? errors.slice(0, 30).join('\n') : 'none');
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2));
await page.close();
await browser.disconnect();
console.log('done ->', OUT);
