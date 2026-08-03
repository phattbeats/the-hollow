// PHAA-697 evidence montage (throwaway): a before/after pair sheet for the 4
// classes captured both ways, and a 3x3 "after" sheet for all 9 female classes.
import fs from 'node:fs';
import sharp from 'sharp';

const DIR = 'docs/screenshots/phaa-697';
const TW = 256;
const TH = 384;
const GAP = 8;

async function tile(path, label) {
  const img = await sharp(path)
    .resize(TW, TH, { fit: 'contain', background: '#12121a' })
    .toBuffer();
  const svg = Buffer.from(
    `<svg width="${TW}" height="24"><rect width="100%" height="100%" fill="#000"/><text x="6" y="17" font-family="monospace" font-size="14" fill="#e6e6ea">${label}</text></svg>`,
  );
  return sharp({ create: { width: TW, height: TH, channels: 3, background: '#12121a' } })
    .composite([
      { input: img, top: 0, left: 0 },
      { input: svg, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function grid(tiles, cols, out) {
  const rows = Math.ceil(tiles.length / cols);
  const W = cols * TW + (cols + 1) * GAP;
  const H = rows * TH + (rows + 1) * GAP;
  const comp = [];
  for (let i = 0; i < tiles.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    comp.push({ input: tiles[i], top: GAP + r * (TH + GAP), left: GAP + c * (TW + GAP) });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } })
    .composite(comp)
    .png()
    .toFile(out);
  console.log('wrote', out, `${W}x${H}`);
}

// before/after pairs
const pairClasses = ['warrior', 'hunter', 'rogue', 'mage'];
const pairTiles = [];
for (const c of pairClasses) {
  pairTiles.push(await tile(`${DIR}/before/player_${c}_f.png`, `${c} BEFORE`));
  pairTiles.push(await tile(`${DIR}/after/player_${c}_f.png`, `${c} AFTER`));
}
await grid(pairTiles, 2, `${DIR}/phaa697_before_after.png`);

// after 3x3
const all = [
  'warrior',
  'paladin',
  'hunter',
  'druid',
  'rogue',
  'warlock',
  'mage',
  'priest',
  'shaman',
];
const allTiles = [];
for (const c of all) allTiles.push(await tile(`${DIR}/after/player_${c}_f.png`, c));
await grid(allTiles, 3, `${DIR}/phaa697_after_all9.png`);
