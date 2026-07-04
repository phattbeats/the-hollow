// Seeded procedural plant-creature builder (PHAA-437): the Three consumer that
// turns a PlantCreatureSpec (plant_creature_core.ts) into a mob visual and
// drives its clip-less motion. It assembles a mob from parts, a segmented
// stalk (a nested pivot chain, so each joint bends the whole spine), leaf
// whorls, a bulb/maw/flower head, and a root/pot base, with all geometry and
// materials pulled from module-level shared caches (foliage.ts pattern). The
// per-frame update() sums the core's idle-sway / hit-react / attack-lunge
// envelopes onto the pivots, so the same generator gives idle sway, a recoil
// on hit, and a lunge on attack with no animation clips.
//
// Determinism lives in the core: the structural seed derives from the entity
// id, so the same world seed renders the same creature on every host. This
// file is presentation only; it reads a spec, never the sim. It is NOT a
// registered pure core (it imports three) and MUST NOT be named *_core/*_view.
//
// Not yet wired into live mob spawns: the Under-Shrine palefeeder / rootmaw /
// witness-root still render as their GLB family visuals until the art
// direction is Board-signed (see PHAA-437). scripts/render_plant_creatures.mjs
// renders a preview sheet of N seeds for that sign-off.

import * as THREE from 'three';
import {
  ATTACK_DURATION,
  attackLunge,
  HIT_REACT_DURATION,
  hitReact,
  idleBend,
  leafFlutter,
  type PlantArchetype,
  type PlantCreatureSpec,
  plantCreatureSpec,
  tentacleCoil,
} from './plant_creature_core';

export interface PlantCreature {
  /** add to the entity group; pivot at feet (y=0), crown faces +Z */
  readonly root: THREE.Group;
  /** pivot-to-crown height at scale 1 (nameplate anchor / framing) */
  readonly height: number;
  readonly spec: PlantCreatureSpec;
  /** advance idle sway + any active hit/attack envelope. t is a running clock. */
  update(dt: number, t: number): void;
  /** start a hit-react recoil */
  triggerHit(): void;
  /** start an attack lunge (opens the maw / leans the crown) */
  triggerAttack(): void;
  /** detach from the scene; shared geo/materials are cached and never disposed */
  dispose(): void;
}

export interface BuildPlantOpts {
  /** PBR (MeshStandard) when true, Lambert when false. Pass GFX.standardMaterials
   *  from the renderer; the preview harness forces true for the sign-off shots. */
  standardMaterials?: boolean;
  /** extra multiplicative tint lerped onto the whole palette (entity color hook) */
  tint?: number;
  tintStrength?: number;
}

// --------------------------------------------------------------------------
// Shared geometry caches (built once, scaled per instance). Small, low-poly:
// these are cave mobs seen at melee range, and the mob count is tiny.
// --------------------------------------------------------------------------

let segGeo: THREE.CylinderGeometry | null = null;
function segmentGeo(): THREE.CylinderGeometry {
  // unit trunk section, gently tapered, base at the pivot origin
  if (!segGeo) {
    segGeo = new THREE.CylinderGeometry(0.82, 1, 1, 7, 1);
    segGeo.translate(0, 0.5, 0);
  }
  return segGeo;
}

let knuckleGeo: THREE.SphereGeometry | null = null;
function jointGeo(): THREE.SphereGeometry {
  knuckleGeo ??= new THREE.SphereGeometry(1, 7, 5);
  return knuckleGeo;
}

let leafGeo: THREE.SphereGeometry | null = null;
function leafBlade(): THREE.SphereGeometry {
  // a lens: unit sphere the mesh squashes flat and stretches along +Z
  if (!leafGeo) {
    leafGeo = new THREE.SphereGeometry(0.5, 6, 4);
    leafGeo.translate(0, 0, 0.5);
  }
  return leafGeo;
}

let bulbGeo: THREE.SphereGeometry | null = null;
function bulbHead(): THREE.SphereGeometry {
  bulbGeo ??= new THREE.SphereGeometry(1, 12, 10);
  return bulbGeo;
}

let jawGeo: THREE.SphereGeometry | null = null;
function jawHead(): THREE.SphereGeometry {
  // upper half-dome (theta 0..PI/2); flipped for the lower jaw via mesh scale.y
  jawGeo ??= new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  return jawGeo;
}

let petalGeo: THREE.ConeGeometry | null = null;
function petalBlade(): THREE.ConeGeometry {
  // a flat-ish petal card; the mesh squashes it and lays it outward
  if (!petalGeo) {
    petalGeo = new THREE.ConeGeometry(0.5, 1, 4);
    petalGeo.translate(0, 0.5, 0);
  }
  return petalGeo;
}

let discGeo: THREE.CylinderGeometry | null = null;
function discHead(): THREE.CylinderGeometry {
  discGeo ??= new THREE.CylinderGeometry(1, 1, 0.3, 12);
  return discGeo;
}

let prongGeo: THREE.ConeGeometry | null = null;
function rootProng(): THREE.ConeGeometry {
  // wide end up at the hub, tip down at the ground
  if (!prongGeo) {
    prongGeo = new THREE.ConeGeometry(1, 1, 5);
    prongGeo.translate(0, -0.5, 0);
  }
  return prongGeo;
}

let potGeo: THREE.CylinderGeometry | null = null;
function potBody(): THREE.CylinderGeometry {
  if (!potGeo) {
    potGeo = new THREE.CylinderGeometry(1, 0.78, 1, 12);
    potGeo.translate(0, 0.5, 0);
  }
  return potGeo;
}

// --------------------------------------------------------------------------
// Material cache: dedup by (tier, color, emissive). Mirrors surfaceMat's
// Standard-vs-Lambert split without coupling the builder to the live GFX
// singleton (so the preview harness and the Vitest can build it standalone).
// --------------------------------------------------------------------------

const matCache = new Map<string, THREE.Material>();

function mat(
  std: boolean,
  color: number,
  emissive = 0x000000,
  emissiveIntensity = 0,
): THREE.Material {
  const key = `${std ? 's' : 'l'}|${color}|${emissive}|${emissiveIntensity}`;
  const cached = matCache.get(key);
  if (cached) return cached;
  const m = std
    ? new THREE.MeshStandardMaterial({
        color,
        roughness: 0.78,
        metalness: 0,
        emissive,
        emissiveIntensity,
      })
    : new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity });
  matCache.set(key, m);
  return m;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function tintColor(hex: number, tint: number | undefined, strength: number): number {
  if (tint === undefined || strength <= 0) return hex;
  return new THREE.Color(hex).lerp(new THREE.Color(tint), Math.min(1, strength)).getHex();
}

/** Lerp a color toward pale bone so thorns/spikes read against a dark body. */
function lightenColor(hex: number, strength: number): number {
  return new THREE.Color(hex).lerp(new THREE.Color(0xcfc7ab), strength).getHex();
}

// --------------------------------------------------------------------------
// Build
// --------------------------------------------------------------------------

interface Joint {
  pivot: THREE.Group;
  swayWeight: number;
  restX: number;
  restZ: number;
}

interface LeafNode {
  pivot: THREE.Group;
  droop: number;
  index: number;
}

interface TentacleNode {
  basePivot: THREE.Group;
  tipPivot: THREE.Group;
  index: number;
}

/** Build a seeded procedural plant creature for the given archetype + seed. */
export function buildPlantCreature(
  archetype: PlantArchetype,
  seed: number,
  opts: BuildPlantOpts = {},
): PlantCreature {
  const spec = plantCreatureSpec(archetype, seed);
  return buildFromSpec(spec, opts);
}

/** Build directly from a resolved spec (used by the preview harness). */
export function buildFromSpec(spec: PlantCreatureSpec, opts: BuildPlantOpts = {}): PlantCreature {
  const std = opts.standardMaterials ?? true;
  const ts = opts.tintStrength ?? 0;
  const pal = spec.palette;
  const stalkMat = mat(std, tintColor(pal.stalk, opts.tint, ts));
  const leafMat = mat(std, tintColor(pal.leaf, opts.tint, ts));
  const accentMat = mat(std, tintColor(pal.accent, opts.tint, ts));
  // thorns/spikes lighten toward bone so they read against a dark boss body
  const thornMat = mat(std, tintColor(lightenColor(pal.accent, 0.55), opts.tint, ts));
  const headEmissiveI = spec.head.glow > 0 ? spec.head.glow * 1.6 : 0;
  const headMat = mat(
    std,
    tintColor(pal.head, opts.tint, ts),
    spec.head.glow > 0 ? pal.emissive : 0x000000,
    headEmissiveI,
  );

  const root = new THREE.Group();
  root.name = `plant_${spec.archetype}_${spec.seed}`;

  buildBase(root, spec, stalkMat, accentMat);

  // Segmented stalk: a nested pivot chain. Each pivot sits at the previous
  // segment's crown, so rotating joint i bends every joint above it (a spine).
  const joints: Joint[] = [];
  let parent: THREE.Object3D = root;
  let baseY = spec.base.height * 0.35; // stalk erupts from the top of the base
  const leaves: LeafNode[] = [];

  for (let i = 0; i < spec.segments.length; i++) {
    const seg = spec.segments[i];
    const pivot = new THREE.Group();
    pivot.position.y = i === 0 ? baseY : spec.segments[i - 1].length;
    parent.add(pivot);

    const trunk = new THREE.Mesh(segmentGeo(), stalkMat);
    trunk.scale.set(seg.radius, seg.length, seg.radius);
    trunk.castShadow = true;
    pivot.add(trunk);

    // a knuckle sphere at the joint reads the stalk as segmented
    const knuckle = new THREE.Mesh(jointGeo(), stalkMat);
    knuckle.scale.setScalar(seg.radius * 1.12);
    pivot.add(knuckle);

    joints.push({ pivot, swayWeight: seg.swayWeight, restX: seg.restBendX, restZ: seg.restBendZ });
    parent = pivot;
    baseY = 0;
  }

  // Leaves whorl onto their segment's pivot (so they ride the spine's bend).
  spec.leaves.forEach((leaf, index) => {
    const joint = joints[Math.min(leaf.segment, joints.length - 1)];
    const yawPivot = new THREE.Group();
    yawPivot.rotation.y = leaf.yaw;
    // lift the leaf up the segment a touch so it sprouts, not from the joint
    yawPivot.position.y = spec.segments[Math.min(leaf.segment, joints.length - 1)].length * 0.5;
    joint.pivot.add(yawPivot);

    const droopPivot = new THREE.Group();
    yawPivot.add(droopPivot);

    const blade = new THREE.Mesh(leafBlade(), leafMat);
    blade.scale.set(leaf.width, leaf.width * 0.16, leaf.length);
    blade.castShadow = true;
    droopPivot.add(blade);

    leaves.push({ pivot: droopPivot, droop: leaf.droop, index });
  });

  // Thorned tentacles whip off the upper stalk (boss-tier archetypes only).
  const tentacles: TentacleNode[] = spec.tentacles.map((tc, index) => {
    const joint = joints[Math.min(tc.segment, joints.length - 1)];
    const yawPivot = new THREE.Group();
    yawPivot.rotation.y = tc.yaw;
    yawPivot.position.y = spec.segments[Math.min(tc.segment, joints.length - 1)].length * 0.5;
    joint.pivot.add(yawPivot);

    const basePivot = new THREE.Group();
    yawPivot.add(basePivot);

    const seg1Len = tc.length * 0.55;
    const seg2Len = tc.length * 0.45;
    const midRadius = (tc.baseRadius + tc.tipRadius) * 0.5;

    const seg1 = new THREE.Mesh(segmentGeo(), accentMat);
    seg1.scale.set(tc.baseRadius, seg1Len, tc.baseRadius);
    seg1.castShadow = true;
    basePivot.add(seg1);
    addThorns(basePivot, tc, seg1Len, tc.baseRadius, midRadius, thornMat);

    const tipPivot = new THREE.Group();
    tipPivot.position.y = seg1Len;
    basePivot.add(tipPivot);

    const seg2 = new THREE.Mesh(segmentGeo(), accentMat);
    seg2.scale.set(midRadius, seg2Len, midRadius);
    seg2.castShadow = true;
    tipPivot.add(seg2);
    addThorns(tipPivot, tc, seg2Len, midRadius, tc.tipRadius, thornMat);

    return { basePivot, tipPivot, index };
  });

  // Head at the crown pivot.
  const crown = joints.length ? joints[joints.length - 1].pivot : root;
  const headGroup = new THREE.Group();
  headGroup.position.y = joints.length ? spec.segments[spec.segments.length - 1].length : baseY;
  crown.add(headGroup);
  const head = buildHead(headGroup, spec, headMat, accentMat, leafMat, thornMat);

  const creature: PlantCreatureInternal = {
    root,
    height: spec.height,
    spec,
    joints,
    leaves,
    tentacles,
    head,
    hitElapsed: Infinity,
    atkElapsed: Infinity,
    update(dt: number, t: number) {
      if (this.hitElapsed < HIT_REACT_DURATION) this.hitElapsed += dt;
      if (this.atkElapsed < ATTACK_DURATION) this.atkElapsed += dt;
      const recoil = hitReact(this.hitElapsed);
      const lunge = attackLunge(this.atkElapsed);
      for (let i = 0; i < this.joints.length; i++) {
        const j = this.joints[i];
        const idle = idleBend(this.spec, i, t);
        // recoil kicks the stalk backward (-Z lean via +x), the lunge forward
        const bendX = j.restX + idle.x + (recoil * 0.5 - lunge * 0.6) * j.swayWeight;
        const bendZ = j.restZ + idle.z + recoil * 0.22 * j.swayWeight;
        j.pivot.rotation.set(bendX, 0, bendZ);
      }
      for (const leaf of this.leaves) {
        leaf.pivot.rotation.x = leaf.droop + leafFlutter(this.spec, leaf.index, t);
      }
      for (const tn of this.tentacles) {
        const tc = this.spec.tentacles[tn.index];
        const coil = tentacleCoil(this.spec, tn.index, t);
        // tentacles lash forward hard on attack, well past the trunk's lunge
        const lash = lunge * 0.85;
        tn.basePivot.rotation.x = tc.baseDroop + coil.x + recoil * 0.3 - lash * 0.45;
        tn.basePivot.rotation.z = coil.z;
        tn.tipPivot.rotation.x = tc.curl + coil.x * 1.5 - lash * 0.65 + recoil * 0.5;
      }
      this.head.update(t, lunge, this.spec);
    },
    triggerHit() {
      this.hitElapsed = 0;
    },
    triggerAttack() {
      this.atkElapsed = 0;
    },
    dispose() {
      this.root.removeFromParent();
    },
  };
  // prime the rest pose so a single-frame capture is not a bind-pose snap
  creature.update(0, 0);
  return creature;
}

interface HeadRig {
  update(t: number, lunge: number, spec: PlantCreatureSpec): void;
}

interface PlantCreatureInternal extends PlantCreature {
  joints: Joint[];
  leaves: LeafNode[];
  tentacles: TentacleNode[];
  head: HeadRig;
  hitElapsed: number;
  atkElapsed: number;
}

/** Small thorn cones jutting off a tentacle segment, spread by a deterministic
 *  golden-angle azimuth so a cluster never lines up on one side. */
function addThorns(
  parent: THREE.Group,
  tc: import('./plant_creature_core').TentacleSpec,
  segLen: number,
  radiusNear: number,
  radiusFar: number,
  mat: THREE.Material,
): void {
  const count = Math.max(1, Math.round(tc.thornCount / 2));
  for (let i = 0; i < count; i++) {
    const f = (i + 0.5) / count;
    const r = lerp(radiusNear, radiusFar, f);
    const thorn = new THREE.Mesh(petalBlade(), mat);
    thorn.scale.set(tc.thornSize, tc.thornSize * 1.8, tc.thornSize);
    const azimuth = i * 2.399963 + segLen; // golden-angle spread, deterministic
    thorn.position.set(Math.cos(azimuth) * r * 0.95, segLen * f, Math.sin(azimuth) * r * 0.95);
    thorn.rotation.z = -Math.cos(azimuth) * 1.15;
    thorn.rotation.x = Math.sin(azimuth) * 1.15;
    thorn.castShadow = true;
    parent.add(thorn);
  }
}

function buildBase(
  root: THREE.Group,
  spec: PlantCreatureSpec,
  stalkMat: THREE.Material,
  accentMat: THREE.Material,
): void {
  const b = spec.base;
  if (b.kind === 'pot') {
    const pot = new THREE.Mesh(potBody(), accentMat);
    pot.scale.set(b.radius, b.height, b.radius);
    pot.castShadow = true;
    root.add(pot);
    return;
  }
  // roots: a splayed claw of prongs plus a small hub dome
  const hub = new THREE.Mesh(jointGeo(), stalkMat);
  hub.scale.setScalar(b.radius * 0.6);
  hub.position.y = b.height * 0.32;
  root.add(hub);
  for (let i = 0; i < b.prongs; i++) {
    const a = (i / b.prongs) * Math.PI * 2;
    const prong = new THREE.Mesh(rootProng(), stalkMat);
    const r = b.radius * 0.22;
    prong.scale.set(r, b.height * 0.9, r);
    prong.position.set(
      Math.cos(a) * b.spread * 0.55,
      b.height * 0.32,
      Math.sin(a) * b.spread * 0.55,
    );
    // lean the prong outward so the tips grip the ground away from the axis
    prong.rotation.z = -Math.cos(a) * 0.6;
    prong.rotation.x = Math.sin(a) * 0.6;
    prong.castShadow = true;
    root.add(prong);
  }
}

function buildHead(
  parent: THREE.Group,
  spec: PlantCreatureSpec,
  headMat: THREE.Material,
  accentMat: THREE.Material,
  leafMat: THREE.Material,
  thornMat: THREE.Material,
): HeadRig {
  const s = spec.head.size;
  if (spec.head.kind === 'bulb') {
    const bulb = new THREE.Mesh(bulbHead(), headMat);
    bulb.scale.set(s * 0.8, s, s * 0.8);
    bulb.position.y = s * 0.7;
    bulb.castShadow = true;
    parent.add(bulb);
    return {
      update(t) {
        // a slow breathing pulse on the glow bulb
        const m = bulb.material as THREE.MeshStandardMaterial;
        if ('emissiveIntensity' in m) {
          m.emissiveIntensity = spec.head.glow * (1.4 + Math.sin(t * 2.1) * 0.35);
        }
      },
    };
  }

  if (spec.head.kind === 'maw') {
    const throat = new THREE.Mesh(bulbHead(), accentMat);
    throat.scale.setScalar(s * 0.62);
    throat.position.y = s * 0.7;
    parent.add(throat);

    const upper = new THREE.Group();
    upper.position.y = s * 0.7;
    parent.add(upper);
    const upperJaw = new THREE.Mesh(jawHead(), headMat);
    upperJaw.scale.set(s * 0.85, s * 0.7, s * 0.85);
    upperJaw.castShadow = true;
    upper.add(upperJaw);

    const lower = new THREE.Group();
    lower.position.y = s * 0.7;
    parent.add(lower);
    const lowerJaw = new THREE.Mesh(jawHead(), headMat);
    lowerJaw.scale.set(s * 0.85, -s * 0.55, s * 0.85);
    lowerJaw.castShadow = true;
    lower.add(lowerJaw);

    return {
      update(t, lunge) {
        // idle breathing gape plus a wide bite on the lunge
        const open = 0.12 + Math.abs(Math.sin(t * 1.6)) * 0.06 + lunge * 0.5;
        upper.rotation.x = -open;
        lower.rotation.x = open;
      },
    };
  }

  // crown: a small dark sunken socket (not a broad hat-brim disc), a single
  // sunken glowing eye, and a wide antler-like crown of jagged spikes that
  // flare outward and up: no two the same length or flare, so the silhouette
  // reads craggy and boss-like, not a tidy even flower.
  const socket = new THREE.Mesh(discHead(), accentMat);
  socket.scale.set(s * 0.42, s * 0.24, s * 0.42);
  socket.position.y = s * 0.6;
  socket.castShadow = true;
  parent.add(socket);

  const eye = new THREE.Mesh(bulbHead(), headMat);
  eye.scale.setScalar(s * 0.22);
  eye.position.y = s * 0.72;
  parent.add(eye);

  const spikeGroup = new THREE.Group();
  spikeGroup.position.y = s * 0.58;
  parent.add(spikeGroup);
  for (const sp of spec.head.spikes ?? []) {
    const spike = new THREE.Mesh(petalBlade(), sp.thorny ? thornMat : leafMat);
    spike.scale.set(s * 0.17, s * 1.1 * sp.length, s * 0.17);
    spike.position.set(Math.cos(sp.angle) * s * 0.5, 0, Math.sin(sp.angle) * s * 0.5);
    // a bigger base flare so the ring reads as antler-like horns radiating
    // outward, not a tuft of quills pointing straight up
    const flare = 1.5 + sp.tilt;
    spike.rotation.z = Math.cos(sp.angle) * flare;
    spike.rotation.x = -Math.sin(sp.angle) * flare;
    spike.rotation.y = -sp.angle;
    spike.castShadow = true;
    spikeGroup.add(spike);
  }

  return {
    update(t) {
      const m = eye.material as THREE.MeshStandardMaterial;
      if ('emissiveIntensity' in m) {
        m.emissiveIntensity = spec.head.glow * (1.2 + Math.sin(t * 1.1) * 0.5);
      }
      spikeGroup.rotation.y = Math.sin(t * 0.35) * 0.05;
    },
  };
}
