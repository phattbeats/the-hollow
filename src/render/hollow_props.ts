// The Hollow hub's interior dressing (PHAA-402): renders HOLLOW_PROPS (the
// hub-local ZonePropsDef slice in sim/content/hollow.ts) inside the hub's
// portal instance, plus the vase centerpiece at hub-local (0,0) and a few
// render-only lantern posts. The hub floor is the flat interior plane (y=0),
// so no terrain sampling is needed; everything is offset by the instance
// origin. Render-only by design: HOLLOW_PROPS is excluded from the overworld
// PROPS merge and the collider grid, so nothing placed here blocks movement
// (see the note in sim/data.ts).
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { HOLLOW_FLORA, HOLLOW_PROPS, type HollowFloraDef, VASE_POS } from '../sim/content/hollow';
import { DUNGEONS, INSTANCE_SLOT_COUNT, instanceOrigin } from '../sim/data';
import { DUNGEON_WALL_HEIGHT } from '../sim/dungeon_layout';
import { hash2 } from '../sim/rng';
import { loadGltf } from './assets/loader';

const HOLLOW_INDEX = (): number => DUNGEONS.the_hollow?.index ?? 6;

/** True when an interior instance origin sits in the Hollow hub's x-band. */
export function isHollowHubOrigin(ox: number): boolean {
  return Math.abs(ox - instanceOrigin(HOLLOW_INDEX(), 0).x) < 250;
}

/** True when a world-space position is inside the hub's x-band. */
export function isHollowHubPos(px: number): boolean {
  return isHollowHubOrigin(px);
}

/**
 * World-space position of the vase for the instance slot nearest pz (each
 * slot is a full copy of the hub). Used by the renderer to anchor the vase
 * smoke column, the visible interface to the god.
 */
export function hollowVaseWorldPos(pz: number): { x: number; y: number; z: number } {
  const first = instanceOrigin(HOLLOW_INDEX(), 0);
  const step = instanceOrigin(HOLLOW_INDEX(), 1).z - first.z;
  const slot = Math.max(0, Math.min(INSTANCE_SLOT_COUNT - 1, Math.round((pz - first.z) / step)));
  const o = instanceOrigin(HOLLOW_INDEX(), slot);
  return { x: o.x + VASE_POS.x, y: 0, z: o.z + VASE_POS.z };
}

/**
 * Vase-smoke particle intensity (0..1) from Greenpaw's hearth (PHAA-421,
 * IWorld.hollowHearth): a straight smoke/100 read, so `vfx.vaseSmoke` scales
 * continuously with the sim's smoke value rather than jumping at the
 * clear/hazy/full bucket edges. `null` (no hearth data yet) reads as clear.
 */
export function hollowSmokeIntensity(hearth: { smoke: number } | null): number {
  if (!hearth) return 0;
  return Math.max(0, Math.min(1, hearth.smoke / 100));
}

// GLB kit pieces reused from the overworld prop set (same files props.ts
// loads, so they are already part of the asset budget).
const KIT = {
  crate: '/models/props/crate_wooden.glb',
  barrel: '/models/props/barrel.glb',
  fence: '/models/props/fence.glb',
  bonfire: '/models/props/bonfire.glb',
  column: '/models/props/column.glb',
  columnBroken: '/models/props/column_broken.glb',
  lantern: '/models/dungeon/lantern_standing.glb',
  shrine: '/models/dungeon/shrine.glb',
  shrineCandles: '/models/dungeon/shrine_candles.glb',
} as const;

// Foliage kit GLBs for the flora dressing (same files foliage.ts already
// loads for the overworld, so they add nothing to the asset budget).
const FLORA_KIT = {
  fern: '/models/foliage/fern.glb',
  bush: '/models/foliage/bush.glb',
  bushFlowers: '/models/foliage/bush_flowers.glb',
} as const;

function clonePiece(gltf: GLTF): THREE.Object3D {
  const obj = gltf.scene.clone(true);
  obj.traverse((c) => {
    c.castShadow = false;
    c.receiveShadow = false;
  });
  return obj;
}

// Deterministic per-spot jitter (same convention as props.ts propRand).
function jitter(x: number, z: number, salt: number): number {
  return hash2(x * 3.1, z * 1.7, salt);
}

/** The vase: a procedural terracotta urn on a low stone plinth. */
function buildVase(): THREE.Group {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.7, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 0.95 }),
  );
  plinth.position.y = 0.25;
  g.add(plinth);
  // urn profile: foot, belly, shoulder, neck, lip
  const pts = [
    [0.32, 0],
    [0.42, 0.08],
    [0.36, 0.25],
    [0.62, 0.7],
    [0.72, 1.1],
    [0.58, 1.55],
    [0.34, 1.8],
    [0.3, 1.98],
    [0.4, 2.1],
    [0.36, 2.16],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const urn = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 18),
    new THREE.MeshStandardMaterial({
      color: 0xb0623a,
      roughness: 0.85,
      emissive: 0x3a180a,
      emissiveIntensity: 0.35,
    }),
  );
  urn.position.y = 0.5;
  g.add(urn);
  // the living cutting rising from the mouth: a few flat leaf fins
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x5c8f3c,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.85, 4), leafMat);
    const a = (i / 5) * Math.PI * 2 + 0.4;
    leaf.position.set(Math.sin(a) * 0.12, 2.95, Math.cos(a) * 0.12);
    leaf.rotation.set(Math.cos(a) * 0.45, a, Math.sin(a) * 0.45);
    g.add(leaf);
  }
  // No PointLight here on purpose: the renderer keeps the visible point-light
  // count constant (budgetFireLights), and an unmanaged light would force a
  // shader recompile. The urn's emissive plus the interior torch pools carry it.
  return g;
}

/**
 * The hearth: the mantel-altar the urn stands before, the ash and the hollow
 * at its foot, and the flue climbing behind it to the ceiling (plan section
 * 4: "the shrine's architecture is a hearth... a flue running to the
 * surface"). Faces the gate (-z) so arriving players see the vase framed
 * against it. Positioned relative to the vase; the caller offsets by VASE_POS
 * and the instance origin.
 */
function buildHearth(shrine: GLTF, shrineCandles: GLTF): THREE.Group {
  const g = new THREE.Group();

  // the hollow: a shallow sunken pit at the foot, darker than the ash ring
  // around it, the negative space the plan's canon calls out by name
  const hollow = new THREE.Mesh(
    new THREE.CircleGeometry(1.3, 20),
    new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 1 }),
  );
  hollow.rotation.x = -Math.PI / 2;
  hollow.position.y = -0.03;
  g.add(hollow);

  // the ash: the wider bed the hollow sits inside
  const ash = new THREE.Mesh(
    new THREE.CircleGeometry(2.7, 24),
    new THREE.MeshStandardMaterial({ color: 0x322c26, roughness: 1 }),
  );
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = -0.01;
  g.add(ash);

  // the mantel-altar: the shrine kit piece, enlarged, backing the urn on the
  // side away from the gate so it reads as a hearth surround, not a headstone
  const altar = clonePiece(shrine);
  altar.position.set(0, 0, 1.1);
  altar.scale.setScalar(2.2);
  g.add(altar);
  const candles = clonePiece(shrineCandles);
  candles.position.set(0, 0, 1.1);
  candles.scale.setScalar(2.0);
  g.add(candles);

  // the flue: a tapering stone duct climbing from behind the altar to the
  // ceiling, the channel the plan says was always there, carrying the vase's
  // smoke to the surface.
  const flueHeight = DUNGEON_WALL_HEIGHT - 0.4;
  const flue = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.95, flueHeight, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.95 }),
  );
  flue.position.set(0, flueHeight / 2, 1.9);
  g.add(flue);

  return g;
}

// Shared procedural-flora materials, created once and reused by every
// instance copy (no lights anywhere: the point-light budget stays untouched).
let floraMats: {
  moss: THREE.MeshStandardMaterial;
  vine: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  glowStem: THREE.MeshStandardMaterial;
  glowBulb: THREE.MeshStandardMaterial;
} | null = null;

function getFloraMats() {
  floraMats ??= {
    moss: new THREE.MeshStandardMaterial({ color: 0x3d5c2a, roughness: 1 }),
    vine: new THREE.MeshStandardMaterial({ color: 0x466b2e, roughness: 0.95 }),
    leaf: new THREE.MeshStandardMaterial({
      color: 0x5c8f3c,
      roughness: 0.85,
      side: THREE.DoubleSide,
    }),
    glowStem: new THREE.MeshStandardMaterial({ color: 0x3a5a28, roughness: 0.9 }),
    glowBulb: new THREE.MeshStandardMaterial({
      color: 0xb9f07e,
      roughness: 0.6,
      emissive: 0x86d94a,
      emissiveIntensity: 1.7,
    }),
  };
  return floraMats;
}

/** Low moss-and-leaf clump hugging a wall foot. */
function buildUndergrowth(x: number, z: number, scale: number): THREE.Group {
  const m = getFloraMats();
  const g = new THREE.Group();
  const n = 3 + Math.floor(jitter(x, z, 10) * 3);
  for (let i = 0; i < n; i++) {
    const r = 0.45 + jitter(x + i, z, 11) * 0.5;
    const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), m.moss);
    blob.position.set(
      (jitter(x, z + i, 12) - 0.5) * 1.8,
      r * 0.35,
      (jitter(x + i, z + i, 13) - 0.5) * 1.8,
    );
    blob.scale.y = 0.5;
    g.add(blob);
  }
  g.scale.setScalar(scale);
  return g;
}

/** Glowing flora accent: a stem, an emissive bulb, a fan of leaves. No light. */
function buildGlowFlower(x: number, z: number, scale: number): THREE.Group {
  const m = getFloraMats();
  const g = new THREE.Group();
  const h = 0.9 + jitter(x, z, 14) * 0.5;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, h, 5), m.glowStem);
  stem.position.y = h / 2;
  g.add(stem);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), m.glowBulb);
  bulb.position.y = h + 0.12;
  bulb.scale.y = 1.35;
  g.add(bulb);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + jitter(x, z, 15 + i) * 0.8;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 4), m.leaf);
    leaf.position.set(Math.sin(a) * 0.16, 0.22, Math.cos(a) * 0.16);
    leaf.rotation.set(Math.cos(a) * 0.9, a, Math.sin(a) * 0.9);
    g.add(leaf);
  }
  g.scale.setScalar(scale);
  return g;
}

/**
 * Vine strands climbing a side wall: thin tapered runners from near the wall
 * top down to the floor, with leaf sprigs. The record's x carries the side
 * (negative = west wall), so the strands lean into the wall behind them.
 */
function buildVineWall(x: number, z: number, scale: number): THREE.Group {
  const m = getFloraMats();
  const g = new THREE.Group();
  const lean = x < 0 ? -0.09 : 0.09; // tip the strands into the wall face
  const strands = 3 + Math.floor(jitter(x, z, 20) * 2);
  for (let i = 0; i < strands; i++) {
    const len = (DUNGEON_WALL_HEIGHT - 1.2) * (0.55 + jitter(x, z + i, 21) * 0.45);
    const dz = (i - (strands - 1) / 2) * 1.1 + (jitter(x + i, z, 22) - 0.5) * 0.6;
    const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.09, len, 5), m.vine);
    strand.position.set(0, len / 2, dz);
    strand.rotation.z = lean;
    g.add(strand);
    // leaf sprigs along the strand
    const sprigs = 2 + Math.floor(jitter(x, z + i, 23) * 3);
    for (let s = 0; s < sprigs; s++) {
      const sy = len * ((s + 0.6) / (sprigs + 0.6));
      const a = jitter(x + s, z + i, 24) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 4), m.leaf);
      leaf.position.set(Math.sin(a) * 0.16 + lean * sy, sy, dz + Math.cos(a) * 0.16);
      leaf.rotation.set(Math.PI * 0.55, a, 0);
      g.add(leaf);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

/**
 * Build the hub dressing group for one instance copy at origin (ox, oz).
 * Async because the kit GLBs load on demand; the caller adds the resolved
 * group to the scene (the renderer does this once per built hub interior).
 */
export async function buildHollowProps(ox: number, oz: number): Promise<THREE.Group> {
  const [
    crate,
    barrel,
    fence,
    bonfire,
    column,
    columnBroken,
    lantern,
    shrine,
    shrineCandles,
    fern,
    bush,
    bushFlowers,
  ] = await Promise.all([
    loadGltf(KIT.crate),
    loadGltf(KIT.barrel),
    loadGltf(KIT.fence),
    loadGltf(KIT.bonfire),
    loadGltf(KIT.column),
    loadGltf(KIT.columnBroken),
    loadGltf(KIT.lantern),
    loadGltf(KIT.shrine),
    loadGltf(KIT.shrineCandles),
    loadGltf(FLORA_KIT.fern),
    loadGltf(FLORA_KIT.bush),
    loadGltf(FLORA_KIT.bushFlowers),
  ]);
  const group = new THREE.Group();
  group.name = 'hollow-hub-props';

  const place = (
    gltf: GLTF,
    x: number,
    z: number,
    ry: number,
    scale: number,
    y = 0,
  ): THREE.Object3D => {
    const obj = clonePiece(gltf);
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    obj.scale.setScalar(scale);
    group.add(obj);
    return obj;
  };

  // the hearth: mantel-altar, ash and hollow, and the flue, all centred on
  // the vase (the plan's canon architecture around the god's urn)
  const hearth = buildHearth(shrine, shrineCandles);
  hearth.position.set(VASE_POS.x, 0, VASE_POS.z);
  group.add(hearth);

  // the vase, the center of gravity of the whole room
  const vase = buildVase();
  vase.position.set(VASE_POS.x, 0, VASE_POS.z);
  group.add(vase);

  // crates: wooden crate / barrel mix, same cadence as the overworld set
  HOLLOW_PROPS.crates.forEach(([x, z], i) => {
    const isBarrel = i % 3 === 2;
    place(
      isBarrel ? barrel : crate,
      x,
      z,
      jitter(x, z, 1) * Math.PI * 2,
      isBarrel ? 1.25 : 1.3 + jitter(x, z, 2) * 0.15,
    );
  });

  // the cold firepit: the bonfire base only, DELIBERATELY unlit (no flame, no
  // light). It is the furnace's future footprint; lighting it later is the
  // world visibly changing (sim/content/hollow.ts).
  for (const [x, z] of HOLLOW_PROPS.campfires) {
    place(bonfire, x, z, jitter(x, z, 3) * Math.PI * 2, 4.3, -0.05);
  }

  // ruin rings: broken column circles, alternating whole and toppled
  for (const ring of HOLLOW_PROPS.ruinRings) {
    for (let i = 0; i < ring.columns; i++) {
      const a = (i / ring.columns) * Math.PI * 2 + jitter(ring.x, ring.z, i) * 0.3;
      const x = ring.x + Math.sin(a) * ring.ringR;
      const z = ring.z + Math.cos(a) * ring.ringR;
      place(i % 2 === 0 ? column : columnBroken, x, z, jitter(x, z, 4) * Math.PI * 2, 2.4);
    }
  }

  // fences: village fence modules along each segment
  for (const f of HOLLOW_PROPS.fences) {
    const len = Math.hypot(f.x2 - f.x1, f.z2 - f.z1);
    const n = Math.max(1, Math.round(len / 3));
    const yaw = Math.atan2(f.x2 - f.x1, f.z2 - f.z1) + Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = f.x1 + (f.x2 - f.x1) * t;
      const z = f.z1 + (f.z2 - f.z1) * t;
      const obj = clonePiece(fence);
      obj.position.set(x, -0.05, z);
      obj.rotation.y = yaw;
      obj.scale.set(3.0, 2.9 + (jitter(x, z, 5) - 0.5) * 0.4, 3.0);
      group.add(obj);
    }
  }

  // render-only lantern posts marking the walk: gate approach and cave mouth
  for (const [x, z] of [
    [-5, -17.5],
    [5, -17.5],
    [-4, 24],
  ] as const) {
    place(lantern, x, z, jitter(x, z, 6) * Math.PI * 2, 2.2);
  }

  // the living flora (PHAA-415 greener pass): rendered per-record from the
  // stage-0 HOLLOW_FLORA table so the Phase 2 growth-stage swap only edits
  // data, never this renderer, and nothing here is merged static geometry
  const floraGltf: Partial<Record<HollowFloraDef['kind'], GLTF>> = {
    fern,
    bush,
    bush_flowers: bushFlowers,
  };
  const floraBaseScale: Record<HollowFloraDef['kind'], number> = {
    fern: 1.5,
    bush: 1.7,
    bush_flowers: 1.6,
    undergrowth: 1,
    glow_flower: 1,
    vine_wall: 1,
  };
  for (const f of HOLLOW_FLORA) {
    const scale = floraBaseScale[f.kind] * (f.scale ?? 1) * (0.85 + jitter(f.x, f.z, 30) * 0.3);
    const gltf = floraGltf[f.kind];
    if (gltf) {
      place(gltf, f.x, f.z, jitter(f.x, f.z, 31) * Math.PI * 2, scale);
      continue;
    }
    const obj =
      f.kind === 'undergrowth'
        ? buildUndergrowth(f.x, f.z, scale)
        : f.kind === 'glow_flower'
          ? buildGlowFlower(f.x, f.z, scale)
          : buildVineWall(f.x, f.z, scale);
    obj.position.set(f.x, 0, f.z);
    if (f.kind !== 'vine_wall') obj.rotation.y = jitter(f.x, f.z, 32) * Math.PI * 2;
    group.add(obj);
  }

  group.position.set(ox, 0, oz);
  return group;
}
