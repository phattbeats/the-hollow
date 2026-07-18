// Procedural decorative flora models (PHAA-581 follow-up). Pure Three.js
// geometry builders for luscious, slightly otherworldly plant DECORATION:
// flowers, bushes, trees, vines, and glowing variants. These are NOT the
// plant-creature mobs in plant_creature_core.ts: no eyes, no maws, no
// tentacles, no combat motion envelopes. This is a prototype gallery module
// for visual review before any zone/IWorld integration.
//
// Determinism: every builder takes a numeric seed and drives a local
// mulberry32 PRNG. Never Math.random. Standalone: no imports from
// sim/ui/game, only three.

import * as THREE from 'three';

/** mulberry32: tiny, fast, deterministic 32-bit PRNG (same algorithm used by
 *  plant_creature_core.ts, kept local here so this module has zero repo
 *  cross-imports beyond three). */
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

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1));
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function stdMat(
  color: number,
  opts: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    metalness: 0,
    flatShading: true,
    ...opts,
  });
}

function glowMat(color: number, emissive: number, intensity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.6,
    metalness: 0,
    flatShading: true,
  });
}

// ---------------------------------------------------------------------------
// Palettes: otherworldly variants (teal, violet, pale) plus warm/earthy
// options so the gallery reads as a garden of possibilities, not one theme.
// ---------------------------------------------------------------------------

const STEM_GREENS = [0x3a6b46, 0x2f5c4a, 0x4a7a3f, 0x1f5a52];
const LEAF_GREENS = [0x4d8c53, 0x3a7a6a, 0x5c9a4a, 0x2d6b5f];
const PETAL_PALETTES: readonly number[][] = [
  [0xf4e0ff, 0xd9a8ff, 0xb87cf0], // violet
  [0xdff9ff, 0x9fe8ff, 0x5cc9e8], // teal/pale cyan
  [0xfff0e0, 0xffd9a8, 0xf0b87c], // warm pale
  [0xffe0f0, 0xffa8d9, 0xf07cb8], // pink/magenta
];
const BARK_TONES = [0x4a3a2f, 0x3a2f26, 0x2f3a3a, 0x3a2f4a];
const OTHERWORLDLY_CANOPY: readonly number[][] = [
  [0x2fa38a, 0x1f7a66], // teal
  [0x8a5cf0, 0x5c3aad], // violet
  [0xe0e8f0, 0xb8c4d9], // pale
];
const BERRY_COLORS = [0xd94a5c, 0x5c9ad9, 0xd9c04a, 0xa84ad9];
const GLOW_COLORS: readonly [number, number][] = [
  [0xb87cf0, 0x9c4aff], // violet glow
  [0x7ce0ff, 0x4ac8ff], // cyan glow
  [0xffd97c, 0xffb84a], // amber glow
  [0x7cffb8, 0x4affa0], // green glow
];

// ---------------------------------------------------------------------------
// Flower
// ---------------------------------------------------------------------------

export function buildFlower(seed: number): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'hollow_flora_flower';

  // kept short so the head stays prominent after any height normalization
  const height = randRange(rng, 0.4, 0.75);
  const stemMat = stdMat(pick(rng, STEM_GREENS));
  const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, height, 5);
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = height / 2;
  group.add(stem);

  const leafMat = stdMat(pick(rng, LEAF_GREENS));
  const leafCount = randInt(rng, 2, 4);
  for (let i = 0; i < leafCount; i++) {
    const leafGeo = new THREE.ConeGeometry(0.06, 0.22, 4, 1, true);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    const t = randRange(rng, 0.2, 0.7);
    leaf.position.y = height * t;
    const yaw = randRange(rng, 0, Math.PI * 2);
    leaf.rotation.z = Math.PI / 2 - randRange(rng, 0.3, 0.7);
    leaf.rotation.y = yaw;
    leaf.position.x = Math.cos(yaw) * 0.05;
    leaf.position.z = Math.sin(yaw) * 0.05;
    group.add(leaf);
  }

  const petalColors = pick(rng, PETAL_PALETTES);
  const petalColor = pick(rng, petalColors);
  const centerColor = pick(rng, petalColors);
  const petalCount = randInt(rng, 6, 10);
  // large petals laid out as a flat radial ring so the head reads as a
  // recognizable flower at gallery distance, not a tiny blob
  const petalLen = randRange(rng, 0.18, 0.28);
  const head = new THREE.Group();
  head.position.y = height;
  const petalMat = stdMat(petalColor, { roughness: 0.5, side: THREE.DoubleSide });
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2 + randRange(rng, -0.06, 0.06);
    const petalGeo = new THREE.ConeGeometry(petalLen * 0.45, petalLen, 5, 1, true);
    const petal = new THREE.Mesh(petalGeo, petalMat);
    // pivot so the petal lies almost flat, tip pointing outward from the
    // center, with a slight upward cup
    const pivot = new THREE.Group();
    pivot.rotation.y = -angle;
    petal.rotation.x = Math.PI / 2 - randRange(rng, 0.15, 0.35);
    petal.position.z = petalLen * 0.55;
    pivot.add(petal);
    head.add(pivot);
  }
  const centerGeo = new THREE.SphereGeometry(petalLen * 0.35, 8, 6);
  const center = new THREE.Mesh(centerGeo, stdMat(centerColor, { roughness: 0.9 }));
  head.add(center);
  group.add(head);

  return group;
}

// ---------------------------------------------------------------------------
// Bush
// ---------------------------------------------------------------------------

export function buildBush(seed: number, opts: { berries?: boolean } = {}): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'hollow_flora_bush';

  const foliageColor = pick(rng, LEAF_GREENS);
  const foliageMat = stdMat(foliageColor, { roughness: 0.85 });
  const blobCount = randInt(rng, 4, 7);
  const baseRadius = randRange(rng, 0.28, 0.42);
  for (let i = 0; i < blobCount; i++) {
    const r = baseRadius * randRange(rng, 0.55, 1);
    const geo = new THREE.IcosahedronGeometry(r, 0);
    const blob = new THREE.Mesh(geo, foliageMat);
    const angle = randRange(rng, 0, Math.PI * 2);
    const dist = i === 0 ? 0 : randRange(rng, 0.08, baseRadius * 0.8);
    blob.position.set(
      Math.cos(angle) * dist,
      r * 0.8 + randRange(rng, -0.03, 0.05),
      Math.sin(angle) * dist,
    );
    blob.rotation.set(
      randRange(rng, 0, Math.PI),
      randRange(rng, 0, Math.PI),
      randRange(rng, 0, Math.PI),
    );
    const s = randRange(rng, 0.9, 1.15);
    blob.scale.set(s, s * randRange(rng, 0.85, 1.05), s);
    group.add(blob);
  }

  if (opts.berries !== false && rng() > 0.35) {
    const berryColor = pick(rng, BERRY_COLORS);
    const berryMat = stdMat(berryColor, { roughness: 0.35 });
    const berryCount = randInt(rng, 5, 12);
    for (let i = 0; i < berryCount; i++) {
      const berryGeo = new THREE.SphereGeometry(randRange(rng, 0.02, 0.035), 6, 5);
      const berry = new THREE.Mesh(berryGeo, berryMat);
      const angle = randRange(rng, 0, Math.PI * 2);
      const dist = randRange(rng, 0.05, baseRadius * 0.85);
      berry.position.set(
        Math.cos(angle) * dist,
        randRange(rng, baseRadius * 0.4, baseRadius * 1.3),
        Math.sin(angle) * dist,
      );
      group.add(berry);
    }
  }

  return group;
}

// ---------------------------------------------------------------------------
// Tree (otherworldly canopy palette variants)
// ---------------------------------------------------------------------------

export function buildTree(seed: number): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'hollow_flora_tree';

  const trunkHeight = randRange(rng, 1.4, 2.4);
  const trunkMat = stdMat(pick(rng, BARK_TONES), { roughness: 0.95 });
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.12, trunkHeight, 6);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = trunkHeight / 2;
  group.add(trunk);

  const canopyPair = pick(rng, OTHERWORLDLY_CANOPY);
  const canopyMats = canopyPair.map((c) => stdMat(c, { roughness: 0.7 }));

  const branchCount = randInt(rng, 2, 4);
  const canopyGroup = new THREE.Group();
  canopyGroup.position.y = trunkHeight;
  for (let i = 0; i < branchCount; i++) {
    const branchLen = randRange(rng, 0.3, 0.55);
    const branchGeo = new THREE.CylinderGeometry(0.02, 0.05, branchLen, 5);
    const branch = new THREE.Mesh(branchGeo, trunkMat);
    const yaw = randRange(rng, 0, Math.PI * 2);
    const pitch = randRange(rng, 0.3, 0.9);
    branch.position.set(0, -0.05, 0);
    branch.rotation.z = Math.PI / 2 - pitch;
    branch.rotation.y = yaw;
    branch.translateY(branchLen / 2);
    canopyGroup.add(branch);

    const blobRadius = randRange(rng, 0.22, 0.36);
    const blobGeo = new THREE.IcosahedronGeometry(blobRadius, 0);
    const blob = new THREE.Mesh(blobGeo, canopyMats[i % canopyMats.length]);
    const tip = new THREE.Vector3(0, branchLen, 0).applyEuler(branch.rotation);
    blob.position.copy(tip);
    blob.rotation.set(randRange(rng, 0, Math.PI), randRange(rng, 0, Math.PI), 0);
    canopyGroup.add(blob);
  }
  const crownGeo = new THREE.IcosahedronGeometry(randRange(rng, 0.3, 0.45), 0);
  const crown = new THREE.Mesh(crownGeo, canopyMats[0]);
  canopyGroup.add(crown);
  group.add(canopyGroup);

  return group;
}

// ---------------------------------------------------------------------------
// Vine (curved segmented crawler for draping)
// ---------------------------------------------------------------------------

export function buildVine(seed: number, length = 1.6): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'hollow_flora_vine';

  const vineMat = stdMat(pick(rng, STEM_GREENS), { roughness: 0.8 });
  const leafMat = stdMat(pick(rng, LEAF_GREENS), { roughness: 0.75 });

  const segmentCount = randInt(rng, 6, 10);
  const curveFreq = randRange(rng, 1.5, 3);
  const curveAmp = randRange(rng, 0.15, 0.35);

  const points: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
  for (let i = 1; i <= segmentCount; i++) {
    const t = i / segmentCount;
    const x = Math.sin(t * Math.PI * curveFreq) * curveAmp;
    const y = -t * length;
    const z = Math.cos(t * Math.PI * curveFreq * 0.7) * curveAmp * 0.5;
    points.push(new THREE.Vector3(x, y, z));
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as THREE.Vector3;
    const b = points[i + 1] as THREE.Vector3;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const segGeo = new THREE.CylinderGeometry(0.015, 0.02, dir.length(), 5);
    const seg = new THREE.Mesh(segGeo, vineMat);
    seg.position.copy(mid);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    group.add(seg);

    if (rng() > 0.3) {
      const leafGeo = new THREE.ConeGeometry(0.05, 0.16, 4, 1, true);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.copy(b);
      const side = rng() > 0.5 ? 1 : -1;
      leaf.rotation.z = (Math.PI / 2) * side * randRange(rng, 0.6, 1);
      leaf.rotation.y = randRange(rng, 0, Math.PI * 2);
      group.add(leaf);
    }
  }

  return group;
}

// ---------------------------------------------------------------------------
// Glowing variants: emissive material + attached soft PointLight
// ---------------------------------------------------------------------------

export function buildGlowFlower(seed: number): THREE.Group {
  const rng = mulberry32(seed);
  const group = buildFlower(seed);
  group.name = 'hollow_flora_glow_flower';

  const [color, emissive] = pick(rng, GLOW_COLORS);
  // replace the flower head petals/center with a glowing material by walking
  // the last-added head group (buildFlower always appends it last).
  const head = group.children[group.children.length - 1] as THREE.Group;
  const mat = glowMat(color, emissive, 1.4);
  head.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.material = mat;
  });

  const light = new THREE.PointLight(emissive, 0.6, 1.4, 2);
  light.position.copy(head.position).add(new THREE.Vector3(0, 0.03, 0));
  group.add(light);

  return group;
}

export function buildGlowMushroom(seed: number): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'hollow_flora_glow_mushroom';

  const [color, emissive] = pick(rng, GLOW_COLORS);
  const stemMat = stdMat(0xe8dfd0, { roughness: 0.7 });
  const capMat = glowMat(color, emissive, 1.6);

  const clusterCount = randInt(rng, 1, 3);
  for (let c = 0; c < clusterCount; c++) {
    const scale = randRange(rng, 0.55, 1) * (c === 0 ? 1 : 0.7);
    const stemHeight = randRange(rng, 0.14, 0.24) * scale;
    const stemGeo = new THREE.CylinderGeometry(0.02 * scale, 0.028 * scale, stemHeight, 6);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    const offsetAngle = randRange(rng, 0, Math.PI * 2);
    const offsetDist = c === 0 ? 0 : randRange(rng, 0.06, 0.14);
    stem.position.set(
      Math.cos(offsetAngle) * offsetDist,
      stemHeight / 2,
      Math.sin(offsetAngle) * offsetDist,
    );
    group.add(stem);

    const capRadius = randRange(rng, 0.06, 0.11) * scale;
    const capGeo = new THREE.SphereGeometry(capRadius, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.8);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(stem.position.x, stemHeight, stem.position.z);
    group.add(cap);

    const light = new THREE.PointLight(emissive, 0.45 * scale, 1.0, 2);
    light.position.set(stem.position.x, stemHeight + 0.02, stem.position.z);
    group.add(light);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Registry for the gallery / any future consumer.
// ---------------------------------------------------------------------------

export type FloraKind = 'flower' | 'bush' | 'tree' | 'vine' | 'glow_flower' | 'glow_mushroom';

export const FLORA_KINDS: readonly FloraKind[] = [
  'flower',
  'bush',
  'tree',
  'vine',
  'glow_flower',
  'glow_mushroom',
];

export function buildFloraModel(kind: FloraKind, seed: number): THREE.Group {
  switch (kind) {
    case 'flower':
      return buildFlower(seed);
    case 'bush':
      return buildBush(seed);
    case 'tree':
      return buildTree(seed);
    case 'vine':
      return buildVine(seed);
    case 'glow_flower':
      return buildGlowFlower(seed);
    case 'glow_mushroom':
      return buildGlowMushroom(seed);
    default: {
      const exhaustive: never = kind;
      throw new Error(`unknown flora kind: ${exhaustive}`);
    }
  }
}
