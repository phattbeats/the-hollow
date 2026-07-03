// Seeded procedural plant-creature core (PHAA-437): the pure, Three-free,
// deterministic half of the plant-mob generator. It resolves an entity seed
// into a full structural SPEC (stalk segments, leaf whorls, head, root/pot
// base, palette, sway) and owns the clip-less MOTION ENVELOPES (idle sway,
// hit-react recoil, attack lunge). The Three consumer (plant_creature.ts)
// turns a spec into geometry and drives the per-frame pose from these
// envelopes; a Vitest drives this module directly.
//
// Determinism: every per-entity value comes from a mulberry32 PRNG seeded off
// the entity id (hashStringToSeed), never Math.random. Same world seed, same
// entity id, same creature everywhere (offline / server-mirror / RL host all
// render the same visual). This file is a registered RENDER pure core
// (tests/architecture.test.ts): no three, no DOM, no randomness/time outside
// the seed. Keep it that way.

export type PlantArchetype = 'palefeeder' | 'rootmaw' | 'witness_root';

export const PLANT_ARCHETYPES: readonly PlantArchetype[] = [
  'palefeeder',
  'rootmaw',
  'witness_root',
];

export type HeadKind = 'bulb' | 'maw' | 'flower';
export type BaseKind = 'roots' | 'pot';

export interface SegmentSpec {
  /** segment length in local world units (pivot to next pivot) */
  length: number;
  /** trunk radius at this segment's base */
  radius: number;
  /** static posture lean baked into the rest pose (radians) */
  restBendX: number;
  restBendZ: number;
  /** 0 at the root, ~1 at the crown: how much this joint answers to sway/recoil */
  swayWeight: number;
}

export interface LeafSpec {
  /** index into segments where this leaf whorls out */
  segment: number;
  /** yaw around the stalk (radians) */
  yaw: number;
  /** droop below horizontal (radians; larger = more wilted) */
  droop: number;
  length: number;
  width: number;
  /** independent flutter phase so leaves do not beat in unison */
  phase: number;
}

export interface HeadSpec {
  kind: HeadKind;
  size: number;
  /** petal count for the flower head; 0 otherwise */
  petals: number;
  /** 0..1 emissive strength of the head (the emberbulb glows; the maw does not) */
  glow: number;
}

export interface BaseSpec {
  kind: BaseKind;
  /** root prong count (roots) or facet count (pot) */
  prongs: number;
  radius: number;
  height: number;
  /** how far the roots splay from the axis */
  spread: number;
}

export interface PlantPalette {
  stalk: number;
  leaf: number;
  head: number;
  accent: number;
  /** emissive colour used when head.glow > 0 */
  emissive: number;
}

export interface SwaySpec {
  /** idle sway peak bend at the crown (radians) */
  amp: number;
  /** sway angular speed (radians/second) */
  speed: number;
  /** per-entity phase so a cluster does not sway in lockstep */
  phase: number;
  /** leaf flutter peak (radians) */
  flutter: number;
}

export interface PlantCreatureSpec {
  archetype: PlantArchetype;
  seed: number;
  segments: SegmentSpec[];
  leaves: LeafSpec[];
  head: HeadSpec;
  base: BaseSpec;
  palette: PlantPalette;
  sway: SwaySpec;
  /** pivot-to-crown height at scale 1 (nameplate anchor / camera framing) */
  height: number;
}

// --------------------------------------------------------------------------
// Deterministic PRNG (render-local; the sim's Rng never leaves src/sim).
// --------------------------------------------------------------------------

/** Stable string -> uint32 seed (xmur3). Feed it the entity id. */
export function hashStringToSeed(id: string): number {
  let h = 1779033703 ^ id.length;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32: a tiny, fast, well-distributed 32-bit PRNG. Deterministic. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --------------------------------------------------------------------------
// Archetype tables. Ranges (min..max) are sampled per-entity from the seed;
// these are the art-direction knobs the Board signs off on. Cave register:
// palefeeder pale/blanched and glowing, rootmaw earthy with a maw, the
// witness-root a tall dark boss variant.
// --------------------------------------------------------------------------

interface ArchetypeTable {
  /** distinct salt so the same seed reads differently per archetype */
  salt: number;
  segments: [number, number];
  segLength: [number, number];
  baseRadius: [number, number];
  /** trunk taper: crown radius as a fraction of the base radius */
  taper: [number, number];
  lean: number;
  leafPairs: [number, number];
  leafLength: [number, number];
  leafDroop: [number, number];
  head: HeadKind;
  headSize: [number, number];
  petals: [number, number];
  glow: [number, number];
  base: BaseKind;
  prongs: [number, number];
  sway: [number, number];
  swaySpeed: [number, number];
  palettes: PlantPalette[];
}

const TABLES: Record<PlantArchetype, ArchetypeTable> = {
  // Small, pale, light-hating: a slender blanched stalk with a warm glowing
  // bulb head and a few wilted leaves on a shallow root claw.
  palefeeder: {
    salt: 0x9e37,
    segments: [4, 6],
    segLength: [0.26, 0.34],
    baseRadius: [0.08, 0.12],
    taper: [0.4, 0.6],
    lean: 0.13,
    leafPairs: [1, 3],
    leafLength: [0.28, 0.42],
    leafDroop: [0.5, 0.95],
    head: 'bulb',
    headSize: [0.22, 0.32],
    petals: [0, 0],
    glow: [0.55, 0.9],
    base: 'roots',
    prongs: [3, 5],
    sway: [0.1, 0.17],
    swaySpeed: [1.1, 1.6],
    palettes: [
      { stalk: 0xcdd6c6, leaf: 0xb9c8b0, head: 0xffcaa0, accent: 0xe7ede2, emissive: 0xff9d5a },
      { stalk: 0xd7dccb, leaf: 0xc3ccb4, head: 0xffb98a, accent: 0xeef1e6, emissive: 0xff8a48 },
      { stalk: 0xc6cfbe, leaf: 0xaebfa4, head: 0xfdd6ad, accent: 0xdde4d5, emissive: 0xffab63 },
    ],
  },
  // Squat, earthy, wide: a thick brown trunk crowned with a splitting maw
  // (two half-bulbs it opens to bite), broad heavy leaves on a gnarled root mass.
  rootmaw: {
    salt: 0x2c1b,
    segments: [3, 5],
    segLength: [0.24, 0.32],
    baseRadius: [0.14, 0.2],
    taper: [0.55, 0.75],
    lean: 0.1,
    leafPairs: [2, 4],
    leafLength: [0.34, 0.5],
    leafDroop: [0.25, 0.6],
    head: 'maw',
    headSize: [0.3, 0.44],
    petals: [0, 0],
    glow: [0, 0],
    base: 'roots',
    prongs: [4, 6],
    sway: [0.06, 0.12],
    swaySpeed: [0.8, 1.2],
    palettes: [
      { stalk: 0x6b5d4f, leaf: 0x5f6b47, head: 0x7a4a3a, accent: 0x8a6a4a, emissive: 0x000000 },
      { stalk: 0x5f5344, leaf: 0x566141, head: 0x6f4234, accent: 0x7d5f42, emissive: 0x000000 },
      { stalk: 0x746455, leaf: 0x67734d, head: 0x82503d, accent: 0x957250, emissive: 0x000000 },
    ],
  },
  // The boss: a tall, dark, imposing multi-whorl stalk topped by a wide petal
  // flower with a faintly glowing central eye, planted on a heavy root pedestal.
  witness_root: {
    salt: 0x5d8f,
    segments: [6, 8],
    segLength: [0.32, 0.42],
    baseRadius: [0.2, 0.28],
    taper: [0.35, 0.5],
    lean: 0.08,
    leafPairs: [3, 5],
    leafLength: [0.5, 0.72],
    leafDroop: [0.35, 0.7],
    head: 'flower',
    headSize: [0.5, 0.68],
    petals: [6, 9],
    glow: [0.3, 0.55],
    base: 'roots',
    prongs: [5, 7],
    sway: [0.05, 0.1],
    swaySpeed: [0.6, 0.95],
    palettes: [
      { stalk: 0x39412f, leaf: 0x2f3a24, head: 0x6f7a3c, accent: 0x4a5533, emissive: 0x9fd06a },
      { stalk: 0x333c2b, leaf: 0x2a3420, head: 0x66723a, accent: 0x445030, emissive: 0x8fc85e },
      { stalk: 0x3f4833, leaf: 0x354028, head: 0x77833f, accent: 0x505c38, emissive: 0xaad875 },
    ],
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randRange(rng: () => number, range: [number, number]): number {
  return lerp(range[0], range[1], rng());
}

function randInt(rng: () => number, range: [number, number]): number {
  return Math.floor(lerp(range[0], range[1] + 1 - 1e-9, rng()));
}

/**
 * Resolve an archetype + seed into a full deterministic creature spec. The seed
 * is a uint32 (hashStringToSeed(entity.id) in the render layer). Same inputs
 * always yield a deep-equal spec.
 */
export function plantCreatureSpec(archetype: PlantArchetype, seed: number): PlantCreatureSpec {
  const t = TABLES[archetype];
  const rng = mulberry32((seed ^ t.salt) >>> 0);

  const segCount = randInt(rng, t.segments);
  const baseRadius = randRange(rng, t.baseRadius);
  const taper = randRange(rng, t.taper);
  const crownRadius = baseRadius * taper;

  const segments: SegmentSpec[] = [];
  let height = 0;
  for (let i = 0; i < segCount; i++) {
    const f = segCount > 1 ? i / (segCount - 1) : 0;
    const length = randRange(rng, t.segLength);
    // rest posture: a gentle, seed-varied curl that grows toward the crown
    const restBendX = (rng() - 0.5) * 2 * t.lean * f;
    const restBendZ = (rng() - 0.5) * 2 * t.lean * f;
    segments.push({
      length,
      radius: lerp(baseRadius, crownRadius, f),
      restBendX,
      restBendZ,
      // quadratic so the base stays planted and the crown does the sway
      swayWeight: f * f,
    });
    height += length;
  }

  const leafPairs = randInt(rng, t.leafPairs);
  const leaves: LeafSpec[] = [];
  for (let p = 0; p < leafPairs; p++) {
    // whorl leaves onto the upper two-thirds of the stalk
    const seg = Math.min(segCount - 1, 1 + Math.floor(rng() * Math.max(1, segCount - 1)));
    const yaw0 = rng() * Math.PI * 2;
    const droop = randRange(rng, t.leafDroop);
    const length = randRange(rng, t.leafLength);
    const width = length * lerp(0.34, 0.52, rng());
    // a leaf pair: two leaves on opposite sides of the stalk
    for (const side of [0, Math.PI]) {
      leaves.push({
        segment: seg,
        yaw: yaw0 + side,
        droop,
        length,
        width,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  const head: HeadSpec = {
    kind: t.head,
    size: randRange(rng, t.headSize),
    petals: t.head === 'flower' ? randInt(rng, t.petals) : 0,
    glow: randRange(rng, t.glow),
  };

  const base: BaseSpec = {
    kind: t.base,
    prongs: randInt(rng, t.prongs),
    radius: baseRadius * lerp(1.6, 2.4, rng()),
    height: baseRadius * lerp(2.2, 3.2, rng()),
    spread: baseRadius * lerp(2.0, 3.4, rng()),
  };

  const palette = t.palettes[Math.floor(rng() * t.palettes.length)];

  const sway: SwaySpec = {
    amp: randRange(rng, t.sway),
    speed: randRange(rng, t.swaySpeed),
    phase: rng() * Math.PI * 2,
    flutter: randRange(rng, t.sway) * 1.4,
  };

  return {
    archetype,
    seed: seed >>> 0,
    segments,
    leaves,
    head,
    base,
    palette,
    sway,
    height: height + head.size + base.height * 0.3,
  };
}

// --------------------------------------------------------------------------
// Motion envelopes (clip-less procedural animation). All pure functions of
// time; the Three consumer sums them onto each segment pivot's rest bend.
// --------------------------------------------------------------------------

/** Idle sway bend (radians) for a segment: a traveling wave up the stalk. */
export function idleBend(
  spec: PlantCreatureSpec,
  segIndex: number,
  t: number,
): { x: number; z: number } {
  const seg = spec.segments[segIndex];
  if (!seg) return { x: 0, z: 0 };
  const phase = t * spec.sway.speed + spec.sway.phase - segIndex * 0.55;
  const w = spec.sway.amp * seg.swayWeight;
  return {
    x: Math.sin(phase) * w,
    z: Math.cos(phase * 0.72) * w * 0.55,
  };
}

/** Leaf flutter offset (radians) added to a leaf's droop. */
export function leafFlutter(spec: PlantCreatureSpec, leafIndex: number, t: number): number {
  const leaf = spec.leaves[leafIndex];
  if (!leaf) return 0;
  return Math.sin(t * spec.sway.speed * 1.7 + leaf.phase) * spec.sway.flutter;
}

export const HIT_REACT_DURATION = 0.6;
export const ATTACK_DURATION = 0.55;

/**
 * Hit-react recoil weight (0..1-ish, signed) over `elapsed` seconds since the
 * hit: a fast damped oscillation that settles to 0. The consumer multiplies it
 * by a per-segment recoil bend so the whole stalk snaps back and quivers.
 */
export function hitReact(elapsed: number): number {
  if (elapsed < 0 || elapsed >= HIT_REACT_DURATION) return 0;
  return Math.exp(-elapsed * 7) * Math.sin(elapsed * 34);
}

/**
 * Attack lunge weight (0..1) over `elapsed` seconds: a single smooth forward
 * bump. Drives the crown leaning toward the target and, on the maw head, how
 * far the jaw opens.
 */
export function attackLunge(elapsed: number): number {
  if (elapsed < 0 || elapsed >= ATTACK_DURATION) return 0;
  const f = elapsed / ATTACK_DURATION;
  return Math.sin(f * Math.PI);
}
