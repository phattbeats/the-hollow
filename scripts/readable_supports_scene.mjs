// PHAA-552 support-variety scene: renders the four readable SUPPORTS (stone,
// table, chest, tree) in a row on a grassy ground, using the real
// buildReadable() from src/render/readables.ts so the shot is the exact
// procedural geometry the world builds -- no full-world GLB boot (which does not
// decode under the remote Browserless). The prop kind (page/journal) is taken
// from the URL hash so one scene covers both. Bundled to a single browser file
// by scripts/readable_supports_shot.mjs (esbuild) and screenshotted headless.
import * as THREE from 'three';
import { buildReadable } from '../src/render/readables.ts';

const SUPPORTS = ['stone', 'table', 'chest', 'tree'];
const prop = location.hash.replace('#', '') === 'journal' ? 'journal' : 'page';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb9c9); // soft overcast Reaches sky

// Grassy ground, tuned to the Reaches' green so the cream paper reads against it.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x4f6a33, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Lighting: a bright key sun (shadow-casting) + sky/ground hemisphere fill, the
// same shape as the outdoor scene so materials and the paper glow read true.
const sun = new THREE.DirectionalLight(0xfff3d8, 2.1);
sun.position.set(6, 12, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -10;
sun.shadow.camera.right = 10;
sun.shadow.camera.top = 10;
sun.shadow.camera.bottom = -10;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd4e6, 0x3a4a24, 0.9));

// The four supports in a row, evenly spaced, each turned a touch toward camera.
const GAP = 2.7;
SUPPORTS.forEach((support, i) => {
  const g = buildReadable(prop, support);
  g.position.x = (i - (SUPPORTS.length - 1) / 2) * GAP;
  g.rotation.y = 0.55; // three-quarter view so the paper face is visible
  scene.add(g);
});

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.7, 9.4);
camera.lookAt(0, 0.55, -0.1);

renderer.render(scene, camera);
// A couple of frames to be safe, then flag ready for the screenshotter.
requestAnimationFrame(() => {
  renderer.render(scene, camera);
  window.__shotReady = true;
});
