// Inspect a GLB without invoking the renderer-side texture loader.
// Reads the JSON chunk of the binary glTF and dumps skeleton + animation metadata.
import { readFile } from 'node:fs/promises';

const path = process.argv[2];
if (!path) {
  console.error('usage: node inspect.mjs <glb>');
  process.exit(1);
}

const buf = await readFile(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const dv = new DataView(ab);
const u8 = new Uint8Array(ab);

const magic = new TextDecoder().decode(u8.subarray(0, 4));
if (magic !== 'glTF') {
  console.error(`not a glb: magic=${magic}`);
  process.exit(2);
}
const version = dv.getUint32(4, true);
const totalLen = dv.getUint32(8, true);
console.log(`glb v${version} bytes=${totalLen}`);

let off = 12;
let json = null;
let binStart = null;
let binLen = 0;
while (off < u8.length) {
  const chunkLen = dv.getUint32(off, true);
  off += 4;
  const chunkType = new TextDecoder().decode(u8.subarray(off, off + 4));
  off += 4;
  if (chunkType === 'JSON') {
    const text = new TextDecoder().decode(u8.subarray(off, off + chunkLen));
    json = JSON.parse(text);
  } else if (chunkType === 'BIN') {
    binStart = off;
    binLen = chunkLen;
  }
  off += chunkLen;
}

if (!json) {
  console.error('no JSON chunk');
  process.exit(3);
}

const nodes = json.nodes ?? [];
const skins = json.skins ?? [];
const animations = json.animations ?? [];
const meshes = json.meshes ?? [];

// Walk: find a skin, then its skeleton root, then walk joints.
function nodeName(idx) {
  const n = nodes[idx];
  return n?.name ?? `node_${idx}`;
}

const meshNodeNames = nodes
  .filter((n) => n.mesh !== undefined)
  .map((n) => `${n.name ?? '(unnamed)'}  mesh=${meshes[n.mesh]?.name ?? n.mesh}`);

console.log(`\nnodes: ${nodes.length}`);
console.log(`skins: ${skins.length}`);
console.log(`animations: ${animations.length}`);
console.log(`meshes: ${meshes.length}`);

console.log('\nmesh nodes (visible body meshes):');
for (const s of meshNodeNames) console.log(`  ${s}`);

if (skins.length > 0) {
  const skin = skins[0];
  console.log(`\nskin[0]: name=${skin.name ?? '(no name)'}  joints=${skin.joints.length}`);
  console.log('joints (in glTF order; the order is the bone hierarchy):');
  skin.joints.forEach((j, i) => {
    const n = nodes[j];
    console.log(`  [${i}] ${n.name ?? '(no name)'}  translation=(${n.translation?.map((v) => v.toFixed(2)).join(',') ?? '-'})  children=${(n.children ?? []).map(nodeName).join(',') || '-'}`);
  });
  if (skin.inverseBindMatrices !== undefined) {
    const acc = json.accessors?.[skin.inverseBindMatrices];
    console.log(`inverseBindMatrices: accessor count=${acc?.count}`);
  }
  if (skin.skeleton !== undefined) {
    console.log(`skeleton root: ${nodes[skin.skeleton]?.name ?? skin.skeleton}`);
  }
}

console.log(`\nanimations (${animations.length}):`);
for (const a of animations) {
  // Decode duration: look at every track's input accessor max if present.
  let dur = 0;
  if (a.samplers && json.accessors) {
    for (const s of a.samplers) {
      const acc = json.accessors[s.input];
      if (acc?.max?.[0] != null && acc.max[0] > dur) dur = acc.max[0];
    }
  }
  const sampleTargets = [...new Set(a.tracks?.slice(0, 4).map((t) => t.name.split('.')[0]))];
  console.log(`  ${a.name}  tracks=${a.tracks?.length ?? 0}  dur~=${dur.toFixed(2)}s  firstTargets: ${sampleTargets.join(', ')}`);
}