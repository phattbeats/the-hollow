// PHAA-772 live render smoke: browser-side entry that renders Greenpaw's cutting
// companion through the SAME dispatch the running game uses. Unlike
// scripts/plant_render_entry.js (which builds by archetype), this drives the
// REAL src/render/characters/plant_dispatch.ts#createPlantMobVisual on a minimal
// mob entity ({ templateId, id }), so it exercises the actual templateId ->
// PLANT_MOB_ARCHETYPES lookup and the `${templateId}#${id}` seed the companion
// gets in-world. One labelled cell per (variant, entity-id), so the sheet proves
// each of the three rolled variants renders and that they are visually distinct.
//
// Bundled by esbuild into a self-contained IIFE and injected by
// scripts/greenpaw_cutting_render_shot.mjs. Exposes:
//   window.renderGreenpawSheet({ ids, cellPx }) -> png data URL
import * as THREE from 'three';
import {
  createPlantMobVisual,
  plantArchetypeFor,
} from '../src/render/characters/plant_dispatch.ts';
import { GREENPAW_COMPANION_MOB_IDS } from '../src/sim/content/hollow.ts';

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  alpha: true,
});
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

function makeLights() {
  const g = new THREE.Group();
  const key = new THREE.DirectionalLight(0xdfeaff, 2.5);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 20;
  g.add(key);
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.9);
  fill.position.set(-4, 1.5, 2);
  g.add(fill);
  const rim = new THREE.DirectionalLight(0xb8ffcf, 1.2);
  rim.position.set(-1, 3, -5);
  g.add(rim);
  g.add(new THREE.AmbientLight(0x9fb0a8, 0.55));
  return g;
}

function ground() {
  const geo = new THREE.CircleGeometry(3, 32);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x2a2c24, roughness: 1 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

// Render one companion entity (templateId + id) via the real dispatch.
function renderCell(templateId, id, cellPx) {
  const SS = cellPx * 2; // supersample
  renderer.setSize(SS, SS, false);

  const scene = new THREE.Scene();
  scene.add(makeLights());
  scene.add(ground());

  const visual = createPlantMobVisual({ templateId, id });
  if (!visual) throw new Error(`createPlantMobVisual returned null for ${templateId}`);
  scene.add(visual.root);
  // settle the idle pose
  visual.update(0.2, { dead: false }, true);

  const box = new THREE.Box3().setFromObject(visual.root);
  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = sphere.radius || 1;

  const fov = 32;
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.01, 100);
  const dist = (r / Math.sin((fov * Math.PI) / 360)) * 1.12;
  cam.position.set(center.x + dist * 0.32, center.y + dist * 0.12, center.z + dist);
  cam.lookAt(center.x, center.y - r * 0.02, center.z);

  renderer.setClearColor(0x14171d, 0);
  renderer.render(scene, cam);

  const out = document.createElement('canvas');
  out.width = cellPx;
  out.height = cellPx;
  const cx = out.getContext('2d');
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(renderer.domElement, 0, 0, cellPx, cellPx);

  visual.dispose();
  return out;
}

window.renderGreenpawSheet = ({ ids = [408, 512, 777], cellPx = 440 } = {}) => {
  const variants = [...GREENPAW_COMPANION_MOB_IDS];
  const cols = ids.length;
  const rows = variants.length;
  const header = 68;
  const rowLabel = 210;
  const sheet = document.createElement('canvas');
  sheet.width = rowLabel + cols * cellPx;
  sheet.height = header + rows * cellPx;
  const cx = sheet.getContext('2d');
  cx.fillStyle = '#14171d';
  cx.fillRect(0, 0, sheet.width, sheet.height);

  cx.fillStyle = '#e8ece4';
  cx.font = '600 34px system-ui, sans-serif';
  cx.textBaseline = 'middle';
  cx.fillText("PHAA-772 Greenpaw's Cutting: 3 variants via createPlantMobVisual", 22, header / 2);

  variants.forEach((templateId, rowI) => {
    const archetype = plantArchetypeFor(templateId);
    const gy = header + rowI * cellPx;
    // row label: templateId -> resolved archetype
    cx.fillStyle = '#cfe0c4';
    cx.font = '600 24px ui-monospace, monospace';
    cx.fillText(templateId, 14, gy + cellPx / 2 - 16);
    cx.fillStyle = '#8fb2c8';
    cx.font = '500 20px ui-monospace, monospace';
    cx.fillText(`-> ${archetype}`, 14, gy + cellPx / 2 + 16);

    ids.forEach((id, colI) => {
      const cell = renderCell(templateId, id, cellPx);
      const gx = rowLabel + colI * cellPx;
      cx.drawImage(cell, gx, gy);
      cx.fillStyle = 'rgba(0,0,0,0.55)';
      cx.fillRect(gx + 10, gy + 10, 150, 34);
      cx.fillStyle = '#cfe0c4';
      cx.font = '500 22px ui-monospace, monospace';
      cx.fillText(`id ${id}`, gx + 18, gy + 28);
    });
  });

  return sheet.toDataURL('image/png');
};

window.__ready = true;
