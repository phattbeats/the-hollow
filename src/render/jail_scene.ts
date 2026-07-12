// The Bramble Hold (PHAA-657): the moderation jail's rendered scene. A
// player only ever sees this after a moderator's /jail command, so it is
// built once at world init (like the terrain/foliage/gather-node passes) and
// simply sits at its remote position (src/sim/content/jail.ts JAIL_CENTER)
// rather than streaming in per-instance the way a dungeon interior does.
//
// Plant-World reskin: living bramble and root growth stand in for the stock
// dungeon-kit stone-and-torches look. No borrowed art or kit assets, just the
// same procedural-geometry primitives the rest of src/render/ uses (see
// hollow_flora_core.ts, gather_nodes.ts): gnarled root bars form the cage,
// bioluminescent fungus caps replace torches, and a hollowed stump anchors
// each corner post.

import * as THREE from 'three';
import { isInJailBounds, JAIL_CAGE_HALF, JAIL_CENTER } from '../sim/content/jail';
import { GFX, surfaceMat } from './gfx';

// deterministic per-render jitter (render convention: never Math.random)
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOSS_COLOR = 0x2a3a1f;
const BARK_COLOR = 0x3c2f22;
const LICHEN_COLOR = 0x4f6b35;
const SPORE_GLOW_COLOR = 0x8fe0a8;
const STUMP_COLOR = 0x4a3826;

const BAR_HEIGHT = 3.6;
const BAR_RADIUS = 0.18;
const BAR_SPACING = 1.4; // gap between adjacent cage bars along a wall
const OUTER_YARD_HALF = JAIL_CAGE_HALF + 6; // moss clearing beyond the bars

function gnarledBar(rng: () => number, mat: THREE.Material): THREE.Group {
  const bar = new THREE.Group();
  const lower = new THREE.Mesh(
    new THREE.CylinderGeometry(BAR_RADIUS, BAR_RADIUS * 1.15, BAR_HEIGHT * 0.6, 6),
    mat,
  );
  lower.position.y = (BAR_HEIGHT * 0.6) / 2;
  bar.add(lower);
  const upper = new THREE.Mesh(
    new THREE.CylinderGeometry(BAR_RADIUS * 0.7, BAR_RADIUS, BAR_HEIGHT * 0.42, 6),
    mat,
  );
  upper.position.y = BAR_HEIGHT * 0.6 + (BAR_HEIGHT * 0.42) / 2;
  // a slight gnarled lean, deterministic per bar
  upper.rotation.z = (rng() - 0.5) * 0.12;
  bar.add(upper);
  if (rng() < 0.4) {
    const knot = new THREE.Mesh(new THREE.IcosahedronGeometry(BAR_RADIUS * 1.4, 0), mat);
    knot.position.y = BAR_HEIGHT * (0.35 + rng() * 0.4);
    bar.add(knot);
  }
  return bar;
}

function sporeLantern(x: number, y: number, z: number): THREE.Mesh {
  const usePbr = GFX.standardMaterials;
  const mat = surfaceMat({
    color: SPORE_GLOW_COLOR,
    emissive: SPORE_GLOW_COLOR,
    emissiveIntensity: usePbr ? 1.6 : 1,
    roughness: 0.6,
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat);
  cap.position.set(x, y, z);
  return cap;
}

function cageWall(
  rng: () => number,
  barMat: THREE.Material,
  from: { x: number; z: number },
  to: { x: number; z: number },
): THREE.Group {
  const wall = new THREE.Group();
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  const count = Math.max(2, Math.round(len / BAR_SPACING));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const bar = gnarledBar(rng, barMat);
    bar.position.set(from.x + dx * t, 0, from.z + dz * t);
    wall.add(bar);
  }
  return wall;
}

/** The Bramble Hold: floor, cage, corner posts, spore lanterns. Built once at
 * world init and placed at its fixed remote position; never toggled by scene
 * membership (a jailed player is teleported to it, the geometry stays put). */
export function buildJailScene(seed: number): THREE.Group {
  const rng = mulberry32(seed ^ 0x8657);
  const root = new THREE.Group();
  root.name = 'bramble-hold';
  const cx = JAIL_CENTER.x;
  const cz = JAIL_CENTER.z;

  const usePbr = GFX.standardMaterials;
  const mossMat = surfaceMat({ color: MOSS_COLOR, roughness: 1 });
  const barkMat = surfaceMat({ color: BARK_COLOR, roughness: 0.95, flatShading: true });
  const lichenMat = surfaceMat({ color: LICHEN_COLOR, roughness: 0.9, flatShading: true });
  const stumpMat = surfaceMat({ color: STUMP_COLOR, roughness: 0.9, flatShading: true });

  // Moss clearing carved out of the wilds (world.ts groundHeight flattens this
  // same footprint via isInJailBounds).
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(OUTER_YARD_HALF + 4, 24),
    usePbr ? mossMat : lichenMat,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0.02, cz);
  floor.receiveShadow = true;
  root.add(floor);

  // Square cage: four gnarled-root-bar walls at JAIL_CAGE_HALF, matching
  // isInJailCage's bounding box so the visual bars line up with the escape
  // enforcement in server/game.ts.
  const h = JAIL_CAGE_HALF;
  const corners = [
    { x: cx - h, z: cz - h },
    { x: cx + h, z: cz - h },
    { x: cx + h, z: cz + h },
    { x: cx - h, z: cz + h },
  ];
  for (let i = 0; i < 4; i++) {
    const wall = cageWall(rng, barkMat, corners[i], corners[(i + 1) % 4]);
    root.add(wall);
  }

  // Corner posts: a hollowed stump topped with a spore lantern, standing in
  // for the stock kit's guard-post lamps.
  for (const corner of corners) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.4, 8), stumpMat);
    post.position.set(corner.x, 0.7, corner.z);
    root.add(post);
    root.add(sporeLantern(corner.x, 1.6, corner.z));
  }

  // A gnarled dead root at the cage centre, the visual anchor prisoners spawn
  // clustered around (see jailCageSpawn).
  const centerStump = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 1.1, 7), stumpMat);
  centerStump.position.set(cx, 0.55, cz);
  root.add(centerStump);
  for (let i = 0; i < 5; i++) {
    const bud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), lichenMat);
    const angle = (i / 5) * Math.PI * 2;
    bud.position.set(cx + Math.cos(angle) * 0.7, 1.15, cz + Math.sin(angle) * 0.7);
    root.add(bud);
  }

  // Low bramble hedge marking the outer yard, past the cage but still inside
  // isInJailBounds's flattened footprint.
  const hedgeCount = 20;
  for (let i = 0; i < hedgeCount; i++) {
    const angle = (i / hedgeCount) * Math.PI * 2;
    const radius = OUTER_YARD_HALF - 1 + rng() * 1.5;
    const x = cx + Math.cos(angle) * radius;
    const z = cz + Math.sin(angle) * radius;
    if (!isInJailBounds({ x, z })) continue;
    const knot = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5 + rng() * 0.3, 0),
      i % 3 === 0 ? barkMat : lichenMat,
    );
    knot.position.set(x, 0.4, z);
    root.add(knot);
  }

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      (obj as THREE.Mesh).castShadow = true;
      (obj as THREE.Mesh).receiveShadow = true;
    }
  });

  return root;
}
