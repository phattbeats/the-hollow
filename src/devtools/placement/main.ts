// Dev-only zone placement tool (see docs/plan-the-hollow.md, "The placement
// tool"). One page: pick a zone, fly around, pick a kit piece (or a camp/NPC
// spawn stub), click the ground, copy the pasteable literal. No save/load, no
// undo, no gizmos, no terrain sculpting; reload loses everything by design.
//
// NEVER in the player build: placement.html is not a rollup input in
// vite.config.ts (dev server only) and this module refuses to run outside
// `import.meta.env.DEV`.

if (!import.meta.env.DEV) {
  throw new Error('placement tool is dev-only and must never ship in a player build');
}

import * as THREE from 'three';
import { assetsReady } from '../../render/assets/preload';
import { buildProps } from '../../render/props';
import { terrainHeight, WATER_LEVEL } from '../../sim/world';
import { FlyCamera } from './fly_camera';
import {
  buildPreviewProps,
  categoryById,
  categoryCounts,
  filterCategories,
  formatEntry,
  formatPlacements,
  type PlacedEntry,
  type PlacementCategory,
  stepYaw,
} from './placement_core';
import { AUTHORABLE_ZONES } from './placement_zones';

const WORLD_SEED = 20061; // the fixed client world seed (src/main.ts)
const GROUND_EXTENT = 640; // ground mesh side length, centered on the zone start
const GROUND_SEGS = 256;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

async function boot(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('missing #app');
  const status = document.getElementById('status') as HTMLElement;
  status.textContent = 'loading prop assets...';
  await assetsReady();
  status.textContent = 'ready';

  // ---- three scene ---------------------------------------------------------
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb4d9);
  scene.fog = new THREE.Fog(0x8fb4d9, 250, 900);
  scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x54634a, 1.15));
  const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
  sun.position.set(80, 140, 60);
  scene.add(sun);

  const fly = new FlyCamera(1);
  fly.attach(canvas);

  function resize(): void {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    fly.camera.aspect = w / h;
    fly.camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // ---- state ---------------------------------------------------------------
  let zone = AUTHORABLE_ZONES[0];
  let armed: PlacementCategory | null = null;
  let yaw = 0;
  let fenceStart: { x: number; z: number } | null = null;
  const placed: PlacedEntry[] = [];
  let ground: THREE.Mesh | null = null;
  let propsGroup: THREE.Group | null = null;
  let markerGroup: THREE.Group | null = null;

  function buildGround(): void {
    if (ground) scene.remove(ground);
    const geo = new THREE.PlaneGeometry(GROUND_EXTENT, GROUND_EXTENT, GROUND_SEGS, GROUND_SEGS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + zone.start.x;
      const z = pos.getZ(i) + zone.start.z;
      pos.setXYZ(i, x, terrainHeight(x, z, WORLD_SEED), z);
    }
    geo.computeVertexNormals();
    ground = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ color: 0x5d7a4c, flatShading: false }),
    );
    ground.receiveShadow = true;
    scene.add(ground);
    // a simple water sheet so shorelines read while placing docks
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_EXTENT, GROUND_EXTENT),
      new THREE.MeshLambertMaterial({ color: 0x2c5a78, transparent: true, opacity: 0.8 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(zone.start.x, WATER_LEVEL, zone.start.z);
    ground.add(water);
  }

  function rebuildProps(): void {
    // NOTE: leaked on purpose, disposing would also kill the shared cached
    // part geometries the next build reuses; this is a dev tool, sessions are
    // short and rebuilds are few.
    if (propsGroup) scene.remove(propsGroup);
    const preview = buildPreviewProps(zone.props, placed);
    const result = buildProps(WORLD_SEED, (id) => id, preview);
    propsGroup = result.group;
    scene.add(propsGroup);
    rebuildMarkers();
  }

  // camps/npcs have no GLB kit piece (buildPreviewProps skips them entirely),
  // so mark them with a plain colored cone instead of a rendered prop.
  const MARKER_COLOR: Record<string, number> = { camps: 0xd9534f, npcs: 0x4fa3d9 };
  function rebuildMarkers(): void {
    if (markerGroup) scene.remove(markerGroup);
    markerGroup = new THREE.Group();
    for (const entry of placed) {
      const cat = categoryById(entry.categoryId);
      const color = cat ? MARKER_COLOR[cat.listKey] : undefined;
      if (color === undefined) continue;
      const y = terrainHeight(entry.input.x, entry.input.z, WORLD_SEED);
      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(1.2, 2.4, 8),
        new THREE.MeshLambertMaterial({ color }),
      );
      mesh.position.set(entry.input.x, y + 1.2, entry.input.z);
      markerGroup.add(mesh);
    }
    scene.add(markerGroup);
  }

  function loadZone(): void {
    placed.length = 0;
    fenceStart = null;
    buildGround();
    rebuildProps();
    renderOutput();
    renderList();
    const y = terrainHeight(zone.start.x, zone.start.z, WORLD_SEED);
    fly.camera.position.set(zone.start.x, y + 24, zone.start.z + 34);
    setStatus();
  }

  function setStatus(msg?: string): void {
    const deg = Math.round((yaw * 180) / Math.PI);
    const armText = armed
      ? `armed: ${armed.label} (yaw ${deg} deg, R rotates)${armed.twoClick && fenceStart ? ' , click the end point' : ''}`
      : 'nothing armed: pick a piece, then left-click the ground';
    status.textContent = msg ?? armText;
  }

  // ---- picking / placing ---------------------------------------------------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !armed || !ground) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, fly.camera);
    const hit = ray.intersectObject(ground, false)[0];
    if (!hit) return;
    // snap y to the analytic ground height (the zone files only store x/z; the
    // renderer grounds every prop itself, so the literal carries no y)
    const x = hit.point.x,
      z = hit.point.z;
    if (armed.twoClick && !fenceStart) {
      fenceStart = { x, z };
      setStatus();
      return;
    }
    const input = fenceStart
      ? { x: fenceStart.x, z: fenceStart.z, x2: x, z2: z, yaw }
      : { x, z, yaw };
    fenceStart = null;
    placed.push({ categoryId: armed.id, input });
    rebuildProps();
    renderOutput();
    setStatus();
  });

  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
    if (e.code === 'KeyR') {
      yaw = stepYaw(yaw, e.shiftKey ? -1 : 1);
      setStatus();
    } else if (e.code === 'Escape') {
      armed = null;
      fenceStart = null;
      renderList();
      setStatus();
    }
  });

  // ---- panel ----------------------------------------------------------------
  const zoneSelect = document.getElementById('zone') as HTMLSelectElement;
  for (const z of AUTHORABLE_ZONES) {
    const opt = el('option', undefined, z.label);
    opt.value = z.id;
    zoneSelect.append(opt);
  }
  zoneSelect.addEventListener('change', () => {
    zone = AUTHORABLE_ZONES.find((z) => z.id === zoneSelect.value) ?? AUTHORABLE_ZONES[0];
    loadZone();
  });

  const filter = document.getElementById('filter') as HTMLInputElement;
  const list = document.getElementById('pieces') as HTMLElement;
  function renderList(): void {
    list.textContent = '';
    const counts = new Map(categoryCounts(placed).map((c) => [c.id, c.count]));
    for (const cat of filterCategories(filter.value)) {
      const row = el('button', `piece${armed?.id === cat.id ? ' armed' : ''}`);
      row.append(el('div', 'piece-label', cat.label));
      const placedCount = counts.get(cat.id);
      row.append(
        el(
          'div',
          'piece-meta',
          `${cat.listKey} , kits: ${cat.kits.join(', ')}${placedCount ? ` , placed: ${placedCount}` : ''}`,
        ),
      );
      row.addEventListener('click', () => {
        armed = categoryById(cat.id) ?? null;
        fenceStart = null;
        renderList();
        setStatus();
      });
      list.append(row);
    }
  }
  filter.addEventListener('input', renderList);
  renderList();

  const outSummary = document.getElementById('out-summary') as HTMLElement;
  const outList = document.getElementById('out-list') as HTMLElement;
  const copyAll = document.getElementById('copy-all') as HTMLButtonElement;
  const clearAll = document.getElementById('clear-all') as HTMLButtonElement;
  function renderOutput(): void {
    outList.textContent = '';
    placed.forEach((entry, i) => {
      const cat = categoryById(entry.categoryId);
      const row = el('div', 'out-row');
      const code = el('code', undefined, `${cat?.listKey}: ${formatEntry(entry)}`);
      const copyBtn = el('button', 'copy', 'copy');
      copyBtn.addEventListener(
        'click',
        () => void navigator.clipboard.writeText(formatEntry(entry)),
      );
      const removeBtn = el('button', 'remove', 'x');
      removeBtn.title = 'remove this placement from the session';
      removeBtn.addEventListener('click', () => {
        placed.splice(i, 1);
        rebuildProps();
        renderOutput();
        renderList();
      });
      row.append(code, copyBtn, removeBtn);
      outList.append(row);
    });
    const counts = categoryCounts(placed);
    outSummary.textContent = placed.length
      ? `${placed.length} placed: ${counts.map((c) => `${c.label} x${c.count}`).join(', ')}`
      : 'nothing placed yet';
    copyAll.disabled = placed.length === 0;
    clearAll.disabled = placed.length === 0;
  }
  copyAll.addEventListener('click', () => {
    void navigator.clipboard.writeText(formatPlacements(placed));
  });
  clearAll.addEventListener('click', () => {
    placed.length = 0;
    fenceStart = null;
    rebuildProps();
    renderOutput();
    renderList();
    setStatus();
  });

  // ---- loop -----------------------------------------------------------------
  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    resize();
    fly.update(dt);
    renderer.render(scene, fly.camera);
    requestAnimationFrame(frame);
  }
  loadZone();
  requestAnimationFrame(frame);
}

void boot();
