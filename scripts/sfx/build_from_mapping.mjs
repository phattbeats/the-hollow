#!/usr/bin/env node
// Build public/audio/sfx/<key>.mp3 files from a sourcing mapping JSON.
// Usage: node scripts/sfx/build_from_mapping.mjs <mapping.json> <packsRoot> [outDir] [keyFilter...]
// Mapping entry: {
//   key, loop?: bool,
//   sources: [{ path, offsetSec?, durationSec?, pitch?, gainDb? }],  // path relative to packsRoot
//   targetLufs?: number (default -16, ambience should use -22),
//   stereo?: bool (default false: mono),
//   loopCrossfadeSec?: number (default 1.5 for loops, ignored otherwise),
//   fadeOutSec?: number (optional tail fade for one-shots)
// }
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [mappingPath, packsRoot, outDirArg, ...keyFilter] = process.argv.slice(2);
if (!mappingPath || !packsRoot) {
  console.error('usage: build_from_mapping.mjs <mapping.json> <packsRoot> [outDir] [keys...]');
  process.exit(1);
}
const outDir = resolve(outDirArg ?? 'public/audio/sfx');
mkdirSync(outDir, { recursive: true });
const entries = JSON.parse(readFileSync(mappingPath, 'utf8'));
const wanted = new Set(keyFilter);
let built = 0;
const failures = [];

for (const e of entries) {
  if (wanted.size && !wanted.has(e.key)) continue;
  const inputs = [];
  const chains = [];
  e.sources.forEach((s, i) => {
    inputs.push('-i', join(resolve(packsRoot), s.path));
    const f = [];
    if (s.offsetSec != null || s.durationSec != null) {
      const a = [];
      if (s.offsetSec != null) a.push(`start=${s.offsetSec}`);
      if (s.durationSec != null) a.push(`duration=${s.durationSec}`);
      f.push(`atrim=${a.join(':')}`, 'asetpts=N/SR/TB');
    }
    if (s.pitch && s.pitch !== 1) f.push(`asetrate=44100*${s.pitch}`);
    f.push('aresample=44100');
    if (s.gainDb) f.push(`volume=${s.gainDb}dB`);
    chains.push(`[${i}:a]${f.join(',')}[s${i}]`);
  });
  let cur;
  if (e.sources.length > 1) {
    const tags = e.sources.map((_, i) => `[s${i}]`).join('');
    chains.push(`${tags}amix=inputs=${e.sources.length}:duration=longest:normalize=0[mix]`);
    cur = '[mix]';
  } else {
    cur = '[s0]';
  }
  const lufs = e.targetLufs ?? -16;
  const fmt = `aformat=channel_layouts=${e.stereo ? 'stereo' : 'mono'}`;
  const out = join(outDir, `${e.key}.mp3`);
  try {
    if (e.loop) {
      // Pass 1: trim/pitch/mix to a temp wav. Pass 2: seam-crossfade the clip against its
      // own head/tail. NOTE: this build's ffmpeg acrossfade filter is non-deterministic
      // (sometimes silently truncates to near-zero) whenever fed two real-audio inputs
      // where the first is longer than the second, which is exactly our rest/head shape.
      // Work around it with an explicit afade+amix+concat seam instead of acrossfade.
      const c = e.loopCrossfadeSec ?? 1.5;
      const tmp = join(outDir, `.${e.key}.tmp.wav`);
      chains.push(`${cur}anull[out]`);
      execFileSync('ffmpeg', [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        ...inputs,
        '-filter_complex',
        chains.join(';'),
        '-map',
        '[out]',
        tmp,
      ]);
      const total = parseFloat(
        execFileSync('ffprobe', [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'csv=p=0',
          tmp,
        ])
          .toString()
          .trim(),
      );
      if (!(total > 2 * c)) {
        throw new Error(`loop source too short for crossfade (${total}s <= 2x${c}s)`);
      }
      const midEnd = total - c;
      execFileSync('ffmpeg', [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        tmp,
        '-filter_complex',
        `[0:a]atrim=start=${c}:end=${midEnd},asetpts=N/SR/TB[middle];` +
          `[0:a]atrim=start=${midEnd}:end=${total},asetpts=N/SR/TB,afade=t=out:d=${c}:curve=tri[tail];` +
          `[0:a]atrim=start=0:end=${c},asetpts=N/SR/TB,afade=t=in:d=${c}:curve=tri[head];` +
          `[tail][head]amix=inputs=2:duration=first:normalize=0[seam];` +
          `[middle][seam]concat=n=2:v=0:a=1[x];` +
          `[x]loudnorm=I=${lufs}:TP=-1.5:LRA=11,aresample=44100,${fmt}[out]`,
        '-map',
        '[out]',
        '-ar',
        '44100',
        '-b:a',
        '128k',
        out,
      ]);
      execFileSync('rm', ['-f', tmp]);
      built++;
      console.log(`built ${e.key} (loop)`);
      continue;
    }
    const post = [
      `loudnorm=I=${lufs}:TP=-1.5:LRA=11`,
      'aresample=44100',
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02',
    ];
    if (e.fadeOutSec) post.push('areverse', `afade=t=in:d=${e.fadeOutSec}:curve=tri`, 'areverse');
    post.push(fmt);
    chains.push(`${cur}${post.join(',')}[out]`);
    execFileSync('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      ...inputs,
      '-filter_complex',
      chains.join(';'),
      '-map',
      '[out]',
      '-ar',
      '44100',
      '-b:a',
      '128k',
      out,
    ]);
    built++;
    console.log(`built ${e.key}`);
  } catch (err) {
    failures.push(e.key);
    console.error(`FAIL ${e.key}: ${err.message.split('\n')[0]}`);
  }
}
console.log(
  `\n${built} built, ${failures.length} failed${failures.length ? ': ' + failures.join(', ') : ''}`,
);
process.exit(failures.length ? 1 : 0);
