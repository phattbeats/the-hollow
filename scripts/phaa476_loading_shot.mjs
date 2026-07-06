// PHAA-476 acceptance shots: render a self-contained preview of the new
// loading screen and screenshot it through browserless via puppeteer-core
// (the repo's idiomatic pattern: scripts/CLAUDE.md -> "Browser E2E /
// screenshot tours"). The preview slices the loading-screen CSS out of
// src/styles/shell.css and stands up the same DOM index.html uses, so the
// captured PNGs are faithful to what players actually see. PNGs go to
// /tmp/phaa476 (gitignored).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const WS = process.env.BROWSERLESS_WS ?? 'ws://10.0.0.100:3000';
const OUT = process.env.PHAA476_OUT ?? '/tmp/phaa476';
mkdirSync(OUT, { recursive: true });

// Slice the loading-screen rules out of src/styles/shell.css. The rules
// live inside @layer shell { ... } so the cascade tier only resolves when
// index.css declares the @layer order; we hoist them into a top-level
// @layer shell wrapper so the standalone preview still cascades the same
// way the real shell does.
const shellCss = readFileSync('src/styles/shell.css', 'utf8');
const start = shellCss.indexOf('/* ---------- loading screen (entering the world) ---------- */');
const end = shellCss.indexOf('/* ---------- play console (realm selector + Play CTA) ---------- */');
const css = shellCss.slice(start, end);
// The original rules are indented by 2 spaces (they live inside a @media query
// AND a @layer); strip the leading 2 spaces so the @layer wrapper picks them up.
const cssFlat = css.replace(/^ {2}/gm, '');

const motesHtml = Array.from({ length: 30 }, () => '<span class="ls-mote"></span>').join('\n        ');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PHAA-476 loading screen preview</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #000; }
@layer shell {
${cssFlat}
}
</style>
</head>
<body>
  <div id="loading-screen" class="visible">
    <div class="ls-backdrop" aria-hidden="true">
      <div class="ls-bloom"></div>
      <div class="ls-motes">
        ${motesHtml}
      </div>
    </div>
    <img class="ls-logo" src="https://thehollow.world/the-hollow-logo.png" alt="The Hollow" />
    <div class="ls-progress">
      <div class="ls-bar"><div id="ls-fill" style="width: 64%"></div></div>
      <div class="ls-meta">
        <div id="ls-status">Loading world... 30/47</div>
        <div id="ls-percent" aria-hidden="true">64%</div>
      </div>
    </div>
  </div>
</body>
</html>`;

// Three sizes, matching desktop / tablet / mobile.
const sizes = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet',  width:  834, height: 1112 },
  { name: 'mobile',  width:  390, height:  844 },
];

const browser = await puppeteer.connect({ browserWSEndpoint: WS });
const errors = [];

try {
  for (const s of sizes) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(`${s.name} PAGEERROR: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`${s.name} CONSOLE: ${m.text()}`);
    });
    await page.setViewport({ width: s.width, height: s.height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
    // Let the bloom + motes settle into mid-animation so the screenshot
    // shows the alive backdrop, not the t=0 state.
    await new Promise((r) => setTimeout(r, 1800));
    const out = `${OUT}/loading-${s.name}.png`;
    await page.screenshot({ path: out, type: 'png' });
    console.log(`shot: ${s.name} -> ${out}`);
    await page.close();
  }
} finally {
  await browser.disconnect();
}

if (errors.length) {
  console.log('errors:');
  for (const e of errors) console.log('  ' + e);
} else {
  console.log('errors: none');
}