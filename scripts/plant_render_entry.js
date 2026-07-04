// Browser-side entry for the PHAA-437 procedural plant-creature preview.
// Bundled by esbuild into a self-contained IIFE (tmp/plant_render_bundle.js)
// and injected into a blank page by scripts/render_plant_creatures.mjs. Mirrors
// mech_render_entry.js. Exposes:
//   window.renderPlantSheet({ archetype, seeds, cols, cellPx, pose, title }) -> png data URL
// It builds each creature from the REAL src/render generator (buildPlantCreature),
// frames it in a 3/4 hero shot, poses it (idle / attack / hit), captures each
// cell and composites a labelled contact sheet. Runs offline under swiftshader.
import * as THREE from 'three';
import { buildPlantCreature } from '../src/render/plant_creature.ts';
import { ATTACK_DURATION } from '../src/render/plant_creature_core.ts';

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
  // cool cave key + warm bounce, tuned to read the green/earth palettes
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

// Render one creature centered in a square, returns an HTMLCanvasElement.
function renderCell(archetype, seed, pose, cellPx) {
  const SS = cellPx * 2; // supersample
  renderer.setSize(SS, SS, false);

  const scene = new THREE.Scene();
  scene.add(makeLights());
  scene.add(ground());

  const creature = buildPlantCreature(archetype, seed, { standardMaterials: true });
  scene.add(creature.root);

  const tBase = (seed % 97) * 0.37;
  if (pose === 'attack') {
    creature.triggerAttack();
    creature.update(ATTACK_DURATION * 0.5, tBase);
  } else if (pose === 'hit') {
    creature.triggerHit();
    creature.update(0.06, tBase);
  } else {
    creature.update(0, tBase);
  }

  const box = new THREE.Box3().setFromObject(creature.root);
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

  creature.dispose();
  return out;
}

window.renderPlantSheet = ({ archetype, seeds, cols = 3, cellPx = 420, pose = 'idle', title }) => {
  const rows = Math.ceil(seeds.length / cols);
  const header = 64;
  const sheet = document.createElement('canvas');
  sheet.width = cols * cellPx;
  sheet.height = header + rows * cellPx;
  const cx = sheet.getContext('2d');
  cx.fillStyle = '#14171d';
  cx.fillRect(0, 0, sheet.width, sheet.height);

  cx.fillStyle = '#e8ece4';
  cx.font = '600 34px system-ui, sans-serif';
  cx.textBaseline = 'middle';
  cx.fillText(title ?? `${archetype} (${pose})`, 22, header / 2);

  seeds.forEach((seed, i) => {
    const cell = renderCell(archetype, seed, pose, cellPx);
    const gx = (i % cols) * cellPx;
    const gy = header + Math.floor(i / cols) * cellPx;
    cx.drawImage(cell, gx, gy);
    cx.fillStyle = 'rgba(0,0,0,0.55)';
    cx.fillRect(gx + 10, gy + 10, 168, 34);
    cx.fillStyle = '#cfe0c4';
    cx.font = '500 22px ui-monospace, monospace';
    cx.fillText(`seed ${seed}`, gx + 18, gy + 28);
  });

  return sheet.toDataURL('image/png');
};

window.__ready = true;
