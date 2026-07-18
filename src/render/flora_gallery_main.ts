// Standalone visual review page for PHAA-581: lays out every decorative
// flora builder from hollow_flora_models.ts in a lit grid so the maintainer
// can eyeball model variety before any zone/IWorld integration. Not part of
// the game client bundle (separate flora_gallery.html entry).

import * as THREE from 'three';
import { buildFloraModel, FLORA_KINDS, type FloraKind } from './hollow_flora_models';

type ViewName =
  | 'overview'
  | 'glow'
  | 'daylight'
  | 'flower'
  | 'bush'
  | 'tree'
  | 'vine'
  | 'glow_flower'
  | 'glow_mushroom';

declare global {
  interface Window {
    __galleryReady?: boolean;
    __setView?: (name: ViewName) => void;
  }
}

const SEEDS_PER_KIND = [101, 202, 303, 404];
const CELL_SPACING_X = 1.7;
const CELL_SPACING_Z = 2.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
scene.fog = new THREE.Fog(0x05060a, 6, 22);

// Orthographic overview: rows sit at very different depths (flowers far,
// mushrooms near), and a perspective lens shrinks far rows enough that
// same-height specimens read as wildly different sizes. Orthographic
// projection keeps every specimen's on-screen size tied only to its actual
// (normalized) scale, which is what a fair model gallery needs.
const ORTHO_HALF_HEIGHT = 4.5;
function orthoAspectExtents(): { halfW: number; halfH: number } {
  const aspect = window.innerWidth / window.innerHeight;
  return { halfW: ORTHO_HALF_HEIGHT * aspect, halfH: ORTHO_HALF_HEIGHT };
}
const initialExtents = orthoAspectExtents();
const camera = new THREE.OrthographicCamera(
  -initialExtents.halfW,
  initialExtents.halfW,
  initialExtents.halfH,
  -initialExtents.halfH,
  0.1,
  100,
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Two lighting rigs, toggled per view. Night: dark ambient scene so the
// glow variants read. Day: bright hemisphere + sun so the non-glowing rows
// (flower, bush, tree, vine) can actually be reviewed.
const nightRig = new THREE.Group();
nightRig.add(new THREE.AmbientLight(0x4a4468, 0.85));
const nightKey = new THREE.DirectionalLight(0xcfd8ff, 0.85);
nightKey.position.set(4, 8, 3);
nightRig.add(nightKey);
const nightRim = new THREE.DirectionalLight(0x8a6aff, 0.4);
nightRim.position.set(-5, 3, -4);
nightRig.add(nightRim);
scene.add(nightRig);

const dayRig = new THREE.Group();
dayRig.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a7a5c, 1.35));
const sun = new THREE.DirectionalLight(0xfff2dc, 1.7);
sun.position.set(5, 9, 4);
dayRig.add(sun);
const dayFill = new THREE.DirectionalLight(0xbcd0ff, 0.5);
dayFill.position.set(-5, 4, -3);
dayRig.add(dayFill);
dayRig.visible = false;
scene.add(dayRig);

const NIGHT_BG = 0x05060a;
const DAY_BG = 0x9db8d4;
const NIGHT_GROUND = 0x0c1014;
const DAY_GROUND = 0x5c7a4f;

function setDaylight(on: boolean): void {
  nightRig.visible = !on;
  dayRig.visible = on;
  (scene.background as THREE.Color).setHex(on ? DAY_BG : NIGHT_BG);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(on ? DAY_BG : NIGHT_BG);
    // push the fog far out in daylight so distant rows stay crisp for review
    scene.fog.near = on ? 30 : 6;
    scene.fog.far = on ? 90 : 22;
  }
  groundMat.color.setHex(on ? DAY_GROUND : NIGHT_GROUND);
  document.body.style.setProperty('--label-color', on ? '#1a2030' : '#eae6ff');
}

// ground plane, subdued so specimens pop
const groundMat = new THREE.MeshStandardMaterial({ color: NIGHT_GROUND, roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

interface Specimen {
  kind: FloraKind;
  seed: number;
  position: THREE.Vector3;
  isGlow: boolean;
}

const specimens: Specimen[] = [];
const rowCount = FLORA_KINDS.length;
const colCount = SEEDS_PER_KIND.length;
const gridWidth = (colCount - 1) * CELL_SPACING_X;
const gridDepth = (rowCount - 1) * CELL_SPACING_Z;

// Native sizes vary a lot (a flower is ~0.5-1.1 units tall, a tree ~2-3): a
// raw grid placement makes small specimens vanish next to large ones. Wrap
// each build in a pedestal that re-centers it on X/Z, drops it to sit on the
// ground plane, and rescales it to a consistent on-screen height so every
// row reads at a comparable size in the review gallery.
const TARGET_HEIGHT = 1.15;

function pedestal(group: THREE.Group): THREE.Group {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= box.min.y;
  const height = Math.max(size.y, 0.01);
  const scale = TARGET_HEIGHT / height;
  const wrapper = new THREE.Group();
  wrapper.add(group);
  wrapper.scale.setScalar(scale);
  return wrapper;
}

// Gallery-only display aid: vines build downward from their origin (they
// are meant to drape off walls/branches), so hang each one from a slim
// trellis post rather than letting it float in midair.
function vineOnTrellis(vine: THREE.Group): THREE.Group {
  const holder = new THREE.Group();
  const postHeight = 1.7;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2f, roughness: 0.95 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, postHeight, 6), postMat);
  post.position.y = postHeight / 2;
  holder.add(post);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 6), postMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.22, postHeight, 0);
  holder.add(arm);
  vine.position.set(0.42, postHeight, 0);
  holder.add(vine);
  return holder;
}

FLORA_KINDS.forEach((kind, row) => {
  SEEDS_PER_KIND.forEach((seed, col) => {
    let raw = buildFloraModel(kind, seed + row * 1000);
    if (kind === 'vine') raw = vineOnTrellis(raw);
    const wrapper = pedestal(raw);
    const x = col * CELL_SPACING_X - gridWidth / 2;
    const z = row * CELL_SPACING_Z - gridDepth / 2;
    wrapper.position.set(x, 0, z);
    scene.add(wrapper);
    specimens.push({
      kind,
      seed: seed + row * 1000,
      position: new THREE.Vector3(x, 0, z),
      isGlow: kind === 'glow_flower' || kind === 'glow_mushroom',
    });
  });
});

const labelsRoot = document.getElementById('labels') as HTMLDivElement;
const labelEls: { el: HTMLDivElement; pos: THREE.Vector3 }[] = [];
for (const s of specimens) {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = `${s.kind} #${s.seed}`;
  labelsRoot.appendChild(el);
  labelEls.push({ el, pos: s.position.clone().add(new THREE.Vector3(0, TARGET_HEIGHT + 0.25, 0)) });
}

const rowLabelValues = FLORA_KINDS.map(
  (_kind, row) =>
    new THREE.Vector3(
      -gridWidth / 2 - 1.3,
      TARGET_HEIGHT * 0.5,
      row * CELL_SPACING_Z - gridDepth / 2,
    ),
);
const rowLabelEls: { el: HTMLDivElement; pos: THREE.Vector3 }[] = [];
FLORA_KINDS.forEach((kind, i) => {
  const el = document.createElement('div');
  el.className = 'label';
  el.style.fontWeight = 'bold';
  el.style.fontSize = '15px';
  el.textContent = kind.toUpperCase();
  labelsRoot.appendChild(el);
  rowLabelEls.push({ el, pos: rowLabelValues[i] as THREE.Vector3 });
});

let currentView: ViewName = 'overview';

function setOrthoExtents(halfH: number): void {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -halfH * aspect;
  camera.right = halfH * aspect;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}

function rowZ(kind: FloraKind): number {
  return FLORA_KINDS.indexOf(kind) * CELL_SPACING_Z - gridDepth / 2;
}

function frameOverview(): void {
  setOrthoExtents(ORTHO_HALF_HEIGHT);
  camera.position.set(0, 6, gridDepth / 2 + 6);
  camera.lookAt(0, TARGET_HEIGHT * 0.5, 0);
}

function frameRow(kind: FloraKind): void {
  const z = rowZ(kind);
  // wide enough for all four columns, angled down so the neighboring rows
  // fall below or above the frame instead of crowding the subject row
  setOrthoExtents(1.75);
  camera.position.set(0, 4.2, z + 4.2);
  camera.lookAt(0, TARGET_HEIGHT * 0.45, z);
}

function applyView(name: ViewName): void {
  currentView = name;
  switch (name) {
    case 'overview':
      setDaylight(false);
      frameOverview();
      break;
    case 'daylight':
      setDaylight(true);
      frameOverview();
      break;
    case 'glow': {
      setDaylight(false);
      const glowZ = (rowZ('glow_flower') + rowZ('glow_mushroom')) / 2;
      setOrthoExtents(1.6);
      camera.position.set(0, 1.4, glowZ + 3);
      camera.lookAt(0, 0.6, glowZ);
      break;
    }
    case 'glow_flower':
    case 'glow_mushroom':
      setDaylight(false);
      frameRow(name);
      break;
    case 'flower':
    case 'bush':
    case 'tree':
    case 'vine':
      setDaylight(true);
      frameRow(name);
      break;
  }
}
window.__setView = applyView;
applyView('overview');

function updateLabels(): void {
  const all = [...labelEls, ...rowLabelEls];
  for (const { el, pos } of all) {
    const p = pos.clone().project(camera);
    const inView = p.z < 1 && p.z > -1;
    if (!inView) {
      el.style.display = 'none';
      continue;
    }
    el.style.display = 'block';
    el.style.left = `${((p.x + 1) / 2) * window.innerWidth}px`;
    el.style.top = `${((-p.y + 1) / 2) * window.innerHeight}px`;
  }
}

function onResize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyView(currentView);
}
window.addEventListener('resize', onResize);

let frame = 0;
function animate(): void {
  requestAnimationFrame(animate);
  frame++;
  renderer.render(scene, camera);
  updateLabels();
  if (frame === 2) {
    window.__galleryReady = true;
  }
}
animate();
