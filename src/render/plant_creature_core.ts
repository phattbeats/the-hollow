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

/** Under-Shrine mob template id -> archetype (PHAA-531 live-spawn wiring). */
export const PLANT_MOB_ARCHETYPES: Readonly<Record<string, PlantArchetype>> = {
  palefeeder: 'palefeeder',
  rootmaw: 'rootmaw',
  the_witness_root: 'witness_root',
  // Greenpaw's cutting companion (PHAA-751, src/sim/greenpaw_cutting.ts): no
  // new GLB/art assets, reuses this seeded generator as the on-theme,
  // asset-free small-creature visual. Each rolled variant id maps to a
  // different archetype so the "random color/design" the design calls for
  // comes from shape family (this table) crossed with the seeded palette
  // pick inside plantCreatureSpec (color), both driven off the stable
  // templateId, not the entity id, so a companion looks the same across
  // logouts/respawns even though its live entity id changes every session.
  greenpaw_cutting_dawn: 'palefeeder',
  greenpaw_cutting_moss: 'rootmaw',
  greenpaw_cutting_ash: 'witness_root',
};

export type HeadKind = 'bulb' | 'maw' | 'crown';
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

/** One jagged spike on a crown head: irregular length/tilt so the ring reads
 *  craggy and asymmetric rather than a tidy, even flower. */
export interface SpikeSpec {
  /** azimuth around the head axis (radians), already jittered off an even ring */
  angle: number;
  /** relative length multiplier vs. the head size */
  length: number;
  /** extra outward/upward flare added to the base fan angle (radians) */
  tilt: number;
  /** this spike renders in the darker accent tone instead of the head tone */
  thorny: boolean;
}

export interface HeadSpec {
  kind: HeadKind;
  size: number;
  /** spike count for the crown head; 0 otherwise */
  petals: number;
  /** 0..1 emissive strength of the head (the emberbulb glows; the maw does not) */
  glow: number;
  /** per-spike jitter for the crown head; unset otherwise */
  spikes?: SpikeSpec[];
}

/** A single thorned, whip-limbed tentacle grown off the upper stalk (boss-tier
 *  archetypes only). Two-segment chain (base + tip) so it coils and lashes
 *  independently of the trunk's sway. */
export interface TentacleSpec {
  /** stalk segment index it grows from */
  segment: number;
  /** yaw around the stalk (radians) */
  yaw: number;
  /** rest pitch below horizontal at the attach point (radians) */
  baseDroop: number;
  length: number;
  baseRadius: number;
  tipRadius: number;
  thornCount: number;
  thornSize: number;
  /** independent coil phase so tentacles do not whip in unison */
  phase: number;
  /** coil/whip amplitude (radians) */
  coilAmp: number;
  /** coil angular speed (radians/second) */
  coilSpeed: number;
  /** static hook/curl baked into the tip's rest pose (radians) */
  curl: number;
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
  /** thorned whip limbs; empty for non-boss archetypes */
  tentacles: TentacleSpec[];
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
  /** boss-tier only: thorned tentacle knobs. Unset -> no tentacles grown. */
  tentacle?: TentacleTable;
}

interface TentacleTable {
  count: [number, number];
  length: [number, number];
  baseRadius: [number, number];
  tipRadius: [number, number];
  thornCount: [number, number];
  thornSize: [number, number];
  droop: [number, number];
  coilAmp: [number, number];
  coilSpeed: [number, number];
  curl: [number, number];
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
  // Squat, earthy, much wider than tall: a thick, barely-tapered brown trunk
  // crowned with a splitting maw (two half-bulbs it opens to bite), broad
  // heavy leaves splayed wide, on a gnarled root mass.
  rootmaw: {
    salt: 0x2c1b,
    segments: [3, 5],
    segLength: [0.24, 0.32],
    baseRadius: [0.26, 0.36],
    taper: [0.8, 0.95],
    lean: 0.1,
    leafPairs: [2, 4],
    leafLength: [0.52, 0.74],
    leafDroop: [0.25, 0.6],
    head: 'maw',
    headSize: [0.48, 0.66],
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
  // The boss: a tall, heavy-trunked stalk that barely tapers, thorned tentacle
  // limbs lashing from the shoulders, and a jagged crown head sunk around a
  // single glowing socket, planted on a wide gnarled root mass. Redesigned per
  // Board feedback (PHAA-437): the old wide-petal flower head read as cute /
  // "pokemon-like"; this pass trades foliage silhouette for imposing mass and
  // a dark, cold palette instead of garden green.
  witness_root: {
    salt: 0x5d8f,
    segments: [7, 9],
    segLength: [0.34, 0.46],
    baseRadius: [0.34, 0.46],
    taper: [0.62, 0.78],
    lean: 0.05,
    leafPairs: [1, 2],
    leafLength: [0.4, 0.55],
    leafDroop: [0.5, 0.85],
    head: 'crown',
    headSize: [0.62, 0.82],
    petals: [7, 11],
    glow: [0.35, 0.6],
    base: 'roots',
    prongs: [7, 10],
    sway: [0.03, 0.06],
    swaySpeed: [0.45, 0.7],
    palettes: [
      { stalk: 0x2a2420, leaf: 0x3a3226, head: 0x241c2e, accent: 0x4a3a2e, emissive: 0x8a4fd6 },
      { stalk: 0x241f1c, leaf: 0x332c22, head: 0x1e1626, accent: 0x40332a, emissive: 0x7a3fc2 },
      { stalk: 0x2e2822, leaf: 0x3d3428, head: 0x2a2030, accent: 0x50402f, emissive: 0x9a5fe0 },
    ],
    tentacle: {
      count: [3, 5],
      length: [1.7, 2.4],
      baseRadius: [0.13, 0.18],
      tipRadius: [0.035, 0.055],
      thornCount: [4, 6],
      thornSize: [0.09, 0.14],
      droop: [0.85, 1.25],
      coilAmp: [0.25, 0.45],
      coilSpeed: [0.5, 0.9],
      curl: [0.3, 0.7],
    },
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
    petals: t.head === 'crown' ? randInt(rng, t.petals) : 0,
    glow: randRange(rng, t.glow),
  };
  if (t.head === 'crown') {
    const spikes: SpikeSpec[] = [];
    for (let i = 0; i < head.petals; i++) {
      spikes.push({
        // jitter off an even ring so the crown reads craggy, not a tidy flower
        angle: (i / head.petals) * Math.PI * 2 + (rng() - 0.5) * 0.5,
        length: lerp(0.75, 1.45, rng()),
        tilt: lerp(-0.25, 0.5, rng()),
        thorny: rng() < 0.5,
      });
    }
    head.spikes = spikes;
  }

  const tentacleTable = t.tentacle;
  const tentacles: TentacleSpec[] = [];
  if (tentacleTable) {
    const count = randInt(rng, tentacleTable.count);
    // whip limbs grow off the mid stalk (shoulders), not the crown or the base
    const lowSeg = Math.max(0, Math.floor(segCount * 0.4));
    for (let i = 0; i < count; i++) {
      const span = Math.max(1, segCount - lowSeg);
      tentacles.push({
        segment: Math.min(segCount - 1, lowSeg + Math.floor(rng() * span)),
        yaw: rng() * Math.PI * 2,
        baseDroop: randRange(rng, tentacleTable.droop),
        length: randRange(rng, tentacleTable.length),
        baseRadius: randRange(rng, tentacleTable.baseRadius),
        tipRadius: randRange(rng, tentacleTable.tipRadius),
        thornCount: randInt(rng, tentacleTable.thornCount),
        thornSize: randRange(rng, tentacleTable.thornSize),
        phase: rng() * Math.PI * 2,
        coilAmp: randRange(rng, tentacleTable.coilAmp),
        coilSpeed: randRange(rng, tentacleTable.coilSpeed),
        curl: randRange(rng, tentacleTable.curl),
      });
    }
  }

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
    tentacles,
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

/** Independent coil/whip offset (radians) for one tentacle: its own phase and
 *  amplitude so a cluster of limbs never lash in lockstep. */
export function tentacleCoil(
  spec: PlantCreatureSpec,
  index: number,
  t: number,
): { x: number; z: number } {
  const tc = spec.tentacles[index];
  if (!tc) return { x: 0, z: 0 };
  const phase = t * tc.coilSpeed + tc.phase;
  return {
    x: Math.sin(phase) * tc.coilAmp,
    z: Math.cos(phase * 0.83 + 0.6) * tc.coilAmp * 0.6,
  };
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
