// Generate every sound effect via the ElevenLabs Sound Effects API
// (POST /v1/sound-generation) from the catalog in scripts/sfx/sfx_prompts.mjs.
//
//   ELEVENLABS_API_KEY=… node scripts/gen_sfx.mjs [--force]
//
// Output:
//   public/audio/sfx/<key>.mp3            the audio (served at /audio/sfx/…)
//   public/audio/sfx/<key>_2.mp3          additional takes when entry.takes > 1
//   src/game/sfx_manifest.generated.ts    key -> { url, loop, variants? }
//
// A catalog entry may declare `takes: N` (default 1). The first take lands at
// `<key>.mp3` (the canonical `url`); takes 2..N land at `<key>_2.mp3`, ...
// `<key>_N.mp3`, and the manifest records the extras under `variants`. The
// runtime picker in src/game/sfx.ts (Rng-driven, no Math.random) selects one
// of [url, ...variants] per play with a no-repeat-biased weight, porting the
// upstream #1901 weighted-random SFX variant behaviour onto the fork.
//
// Idempotent: existing files are skipped unless --force. Offline-only; the key is
// read from the environment / local .env and never committed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SFX } from './sfx/sfx_prompts.mjs';

const API = 'https://api.elevenlabs.io';
const OUTPUT_FORMAT = 'mp3_44100_128';
const PROMPT_INFLUENCE = 0.4; // adhere to the prompt but allow some character
const root = process.cwd();
const sfxDir = path.join(root, 'public/audio/sfx');
const manifestPath = path.join(root, 'src/game/sfx_manifest.generated.ts');

const force = process.argv.includes('--force');

try {
  process.loadEnvFile();
} catch {
  /* no .env — rely on the ambient env */
}
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error('ELEVENLABS_API_KEY is not set (env or .env). Aborting.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(entry, { retries = 4 } = {}) {
  const body = {
    text: entry.prompt,
    duration_seconds: entry.duration,
    prompt_influence: PROMPT_INFLUENCE,
    output_format: OUTPUT_FORMAT,
  };
  if (entry.loop) body.loop = true;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/v1/sound-generation`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const detail = await res.text().catch(() => '');
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < retries) {
      const wait = 1500 * (attempt + 1);
      console.warn(`  ${entry.key} -> ${res.status}; retrying in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${entry.key} -> ${res.status} ${detail.slice(0, 200)}`);
  }
}

mkdirSync(sfxDir, { recursive: true });
let made = 0;
let skipped = 0;
let seconds = 0;
const failed = [];

// Each catalog entry may declare `takes: N` (default 1). The first take lands at
// `<key>.mp3` (the canonical `url`); takes 2..N land at `<key>_2.mp3` ...,
// `<key>_N.mp3`, and the manifest records the extras under `variants`. The
// runtime picker in src/game/sfx.ts (Rng-driven, no Math.random) selects one
// of [url, ...variants] per play with a no-repeat-biased weight.
function clipPath(key, take) {
  return path.join(sfxDir, take === 1 ? `${key}.mp3` : `${key}_${take}.mp3`);
}
function clipUrl(key, take) {
  return take === 1 ? `/audio/sfx/${key}.mp3` : `/audio/sfx/${key}_${take}.mp3`;
}
function takeCount(entry) {
  const n = Number.isFinite(entry.takes) ? Math.max(1, Math.floor(entry.takes)) : 1;
  return Math.min(n, 16); // hard cap; one logical key with absurd variant pools is a smell
}

for (const entry of SFX) {
  const total = takeCount(entry);
  let entryMade = 0;
  for (let take = 1; take <= total; take++) {
    const dest = clipPath(entry.key, take);
    if (existsSync(dest) && !force) {
      skipped++;
      continue;
    }
    process.stdout.write(
      `sfx  ${entry.key}${total > 1 ? ` (take ${take}/${total})` : ''} (${entry.duration}s${entry.loop ? ', loop' : ''})… `,
    );
    try {
      const mp3 = await generate(entry);
      writeFileSync(dest, mp3);
      seconds += entry.duration;
      made++;
      entryMade++;
      console.log('ok');
      await sleep(200);
    } catch (err) {
      // One bad clip shouldn't abort the whole run: record it and continue so
      // even a partial multi-take entry ships whatever takes did succeed.
      console.log('FAILED');
      console.error(`  ${err.message}`);
      failed.push(`${entry.key}${take > 1 ? `:take${take}` : ''}`);
      process.exitCode = 1;
    }
  }
  if (entryMade === 0 && !existsSync(clipPath(entry.key, 1))) {
    // No usable takes at all, skip silently; runtime treats a missing key as a
    // silent no-op already.
  }
}

// Rebuild the manifest from whatever exists on disk so runtime never points at
// a missing clip after a partial run. `variants` is populated with the URLs of
// takes 2..N that actually landed on disk; if any are missing, the runtime
// filters them out of the playable pool (see picker's caller contract).
const entries = {};
for (const entry of SFX) {
  const total = takeCount(entry);
  const urls = [];
  let haveAny = false;
  for (let take = 1; take <= total; take++) {
    if (existsSync(clipPath(entry.key, take))) {
      urls.push(clipUrl(entry.key, take));
      haveAny = true;
    }
  }
  if (!haveAny) continue;
  const [first, ...rest] = urls;
  const record = { url: first, loop: !!entry.loop };
  if (rest.length > 0) record.variants = rest;
  entries[entry.key] = record;
}
const sorted = Object.fromEntries(
  Object.keys(entries)
    .sort()
    .map((k) => [k, entries[k]]),
);
mkdirSync(path.dirname(manifestPath), { recursive: true });
writeFileSync(
  manifestPath,
  [
    '// Generated by scripts/gen_sfx.mjs. Do not edit by hand.',
    '// Maps a sound-effect key to its public audio path and loop flag. Entries',
    '// with multiple takes carry `variants?: string[]` listing the URLs of takes',
    '// 2..N; the runtime Rng-weighted picker in src/game/sfx.ts selects one of',
    '// [url, ...variants] per play with a no-repeat bias.',
    'export interface SfxEntry { url: string; loop: boolean; variants?: string[] }',
    'export const SFX_CLIPS: Record<string, SfxEntry> =',
    `${JSON.stringify(sorted, null, 2)} as const;`,
    '',
  ].join('\n'),
);

console.log(
  `\nDone: ${made} generated, ${skipped} skipped, ${Object.keys(sorted).length}/${SFX.length} clips on disk.`,
);
console.log(
  `Billed ~${seconds.toFixed(1)} seconds of audio this run. Manifest: ${path.relative(root, manifestPath)}`,
);
if (failed.length) console.log(`Failed (${failed.length}): ${failed.join(', ')}`);
