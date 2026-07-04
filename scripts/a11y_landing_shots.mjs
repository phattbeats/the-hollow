// Before/after-style evidence for the UI accessibility pass. Captures the landing
// page in its default spore-field mode, in high-contrast mode, and on an emulated
// phone (where the animated field is dropped for the static dark wash). Needs
// `npm run dev` on :5173.

import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH as EXEC } from './browser_path.mjs';

const BASE = 'http://localhost:5173/';
const OUT = 'pr-assets-a11y';
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EXEC,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

async function shot({ phone = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport(
    phone
      ? { width: 414, height: 896, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { width: 1440, height: 900, deviceScaleFactor: 1 },
  );
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await wait(1500);
  return { page };
}

// 1. Default desktop (animated spore field)
{
  const { page } = await shot();
  await page.screenshot({ path: `${OUT}/landing-default.png` });
  await page.close();
  console.log('landing-default.png');
}

// 2. High-contrast (click the footer toggle)
{
  const { page } = await shot();
  await page.click('#landing-contrast-toggle');
  await wait(600);
  const pressed = await page.$eval('#landing-contrast-toggle', (b) =>
    b.getAttribute('aria-pressed'),
  );
  const isStatic = await page.$eval('#start-screen-backdrop', (b) =>
    b.classList.contains('backdrop-static'),
  );
  await page.screenshot({ path: `${OUT}/landing-highcontrast.png` });
  await page.close();
  console.log(`landing-highcontrast.png (aria-pressed=${pressed}, backdrop-static=${isStatic})`);
}

// 3. Phone (static dark wash, spore field dropped)
{
  const { page } = await shot({ phone: true });
  const isStatic = await page.$eval('#start-screen-backdrop', (b) =>
    b.classList.contains('backdrop-static'),
  );
  await page.screenshot({ path: `${OUT}/landing-phone.png` });
  await page.close();
  console.log(`landing-phone.png (backdrop-static=${isStatic}, expect true)`);
}

await browser.close();
console.log('done', OUT);
