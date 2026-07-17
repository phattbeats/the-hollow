// PHAA-634 before/after clip capture. Renders a 2-row (before PHAA-586 / after
// PHAA-634) contact sheet per combat clip using a headless three.js viewer run
// inside Browserless (no local puppeteer/ws). Each row samples the clip at 5
// normalized times across one wide canvas via per-cell viewports; one screenshot
// per clip. GLBs are passed in as base64; three is loaded from a CDN import map.
//
// Usage: node scripts/phaa634_clip_strip.mjs <beforeGlb> <afterGlb> <outDir>
// Requires network access to the Browserless host below and to the CDN.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';

const BROWSERLESS = process.env.BROWSERLESS_URL ?? 'http://10.0.0.100:3000';
const SELF_IP = process.env.SELF_IP ?? '172.18.0.3';
const [beforeGlb, afterGlb, outDir] = process.argv.slice(2);
const CLIPS = [
  'anim_cast', 'anim_castshoot', 'anim_attack_chop',
  'anim_attack_slash', 'anim_shoot', 'anim_hit',
];
const COLS = 5;

const PAGE = `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0;background:#2b2f36}#c{display:block}</style>
  <script type="importmap">{"imports":{
    "three":"https://unpkg.com/three@0.165.0/build/three.module.js",
    "three/addons/":"https://unpkg.com/three@0.165.0/examples/jsm/"}}</script></head>
  <body><canvas id="c"></canvas>
  <script type="module">
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  const loader = new GLTFLoader();
  const parse = (buf) => new Promise((res,rej)=>loader.parse(buf,'',res,rej));
  const fetchBuf = async (u) => await (await fetch(u)).arrayBuffer();
  window.__renderStrip = async (beforeUrl, afterUrl, clip, times, cell) => {
    const cols = times.length, W = cell*cols, H = cell*2;
    const canvas = document.getElementById('c');
    const renderer = new THREE.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true});
    renderer.setPixelRatio(1); renderer.setSize(W,H,false);
    renderer.setScissorTest(true);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2b2f36);
    scene.add(new THREE.HemisphereLight(0xffffff,0x444455,2.2));
    const key = new THREE.DirectionalLight(0xffffff,2.0); key.position.set(2,4,3); scene.add(key);
    const cam = new THREE.PerspectiveCamera(30, cell/cell, 0.1, 100);
    const gltfs = { before: await parse(await fetchBuf(beforeUrl)), after: await parse(await fetchBuf(afterUrl)) };
    const rows = [['before', gltfs.before, H-cell], ['after', gltfs.after, 0]];
    // frame the model
    for (const [,g] of rows.map(r=>[r[0],r[1]])) {
      const box = new THREE.Box3().setFromObject(g.scene);
      g.__box = box;
    }
    for (const [name, g, y0] of rows) {
      const root = g.scene; scene.add(root);
      const box = g.__box; const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()); const h = Math.max(size.y, size.x);
      const clipObj = g.animations.find(a=>a.name===clip);
      const mixer = new THREE.AnimationMixer(root);
      const action = mixer.clipAction(clipObj); action.play();
      const dur = clipObj.duration;
      for (let i=0;i<cols;i++) {
        const t = times[i]*dur;
        mixer.setTime(t); root.updateMatrixWorld(true);
        // camera: front-ish 3/4 view, framed to show the whole figure incl. an
        // overhead arm (chibi head is large, so keep some headroom above center)
        cam.position.set(c.x + h*0.25, c.y + h*0.12, c.z + h*2.05);
        cam.lookAt(c.x, c.y, c.z);
        const x = i*cell, y = y0;
        renderer.setViewport(x,y,cell,cell);
        renderer.setScissor(x,y,cell,cell);
        renderer.render(scene, cam);
      }
      scene.remove(root);
    }
    return canvas.toDataURL('image/png');
  };
  window.__ready = true;
  </script></body></html>`;

const fnCode = `module.exports = async ({ page, context }) => {
  await page.setViewport({ width: context.W, height: context.H });
  await page.setContent(context.page, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 20000 });
  const dataUrl = await page.evaluate(async (c) =>
    await window.__renderStrip(c.before, c.after, c.clip, c.times, c.cell),
    context.args);
  return { data: dataUrl, type: 'application/json' };
}`;

const beforeBuf = readFileSync(beforeGlb);
const afterBuf = readFileSync(afterGlb);
const times = [0, 0.25, 0.5, 0.7, 0.95];
const cell = 220;
mkdirSync(outDir, { recursive: true });

// serve the two GLBs so Browserless Chrome can fetch them (small POST payload)
const server = createServer((req, res) => {
  const buf = req.url.includes('before') ? beforeBuf : afterBuf;
  res.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Access-Control-Allow-Origin': '*' });
  res.end(buf);
});
await new Promise((r) => server.listen(8639, '0.0.0.0', r));
const beforeUrl = `http://${SELF_IP}:8639/before.glb`;
const afterUrl = `http://${SELF_IP}:8639/after.glb`;

try {
  for (const clip of CLIPS) {
    const body = {
      code: fnCode,
      context: {
        page: PAGE, W: cell * COLS, H: cell * 2,
        args: { before: beforeUrl, after: afterUrl, clip, times, cell },
      },
    };
    const r = await fetch(`${BROWSERLESS}/function`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const txt = await r.text();
    if (!r.ok) { console.error(clip, 'HTTP', r.status, txt.slice(0, 300)); continue; }
    let dataUrl;
    try { dataUrl = JSON.parse(txt).data ?? JSON.parse(txt); } catch { dataUrl = txt; }
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      console.error(clip, 'unexpected result:', String(dataUrl).slice(0, 200)); continue;
    }
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    writeFileSync(`${outDir}/${clip}.png`, png);
    console.log(clip, 'ok', png.length, 'bytes');
  }
} finally {
  server.close();
}
