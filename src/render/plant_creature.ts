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

function tintColor(hex: number, tint: number | undefined, strength: number): number {
  if (tint === undefined || strength <= 0) return hex;
  return new THREE.Color(hex).lerp(new THREE.Color(tint), Math.min(1, strength)).getHex();
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

  // Head at the crown pivot.
  const crown = joints.length ? joints[joints.length - 1].pivot : root;
  const headGroup = new THREE.Group();
  headGroup.position.y = joints.length ? spec.segments[spec.segments.length - 1].length : baseY;
  crown.add(headGroup);
  const head = buildHead(headGroup, spec, headMat, accentMat, leafMat);

  const creature: PlantCreatureInternal = {
    root,
    height: spec.height,
    spec,
    joints,
    leaves,
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
  head: HeadRig;
  hitElapsed: number;
  atkElapsed: number;
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

  // flower: a disc, a ring of petals, and a faintly glowing central eye
  const disc = new THREE.Mesh(discHead(), accentMat);
  disc.scale.set(s * 0.7, s * 0.5, s * 0.7);
  disc.position.y = s * 0.7;
  disc.castShadow = true;
  parent.add(disc);

  const petalRing = new THREE.Group();
  petalRing.position.y = s * 0.72;
  parent.add(petalRing);
  for (let i = 0; i < spec.head.petals; i++) {
    const a = (i / spec.head.petals) * Math.PI * 2;
    const petal = new THREE.Mesh(petalBlade(), leafMat);
    petal.scale.set(s * 0.42, s * 0.9, s * 0.14);
    petal.position.set(Math.cos(a) * s * 0.5, 0, Math.sin(a) * s * 0.5);
    petal.rotation.z = Math.cos(a) * 1.15;
    petal.rotation.x = -Math.sin(a) * 1.15;
    petal.rotation.y = -a;
    petal.castShadow = true;
    petalRing.add(petal);
  }

  const eye = new THREE.Mesh(bulbHead(), headMat);
  eye.scale.setScalar(s * 0.34);
  eye.position.y = s * 0.78;
  parent.add(eye);

  return {
    update(t) {
      const m = eye.material as THREE.MeshStandardMaterial;
      if ('emissiveIntensity' in m) {
        m.emissiveIntensity = spec.head.glow * (1.3 + Math.sin(t * 1.4) * 0.4);
      }
      petalRing.rotation.y = Math.sin(t * 0.5) * 0.08;
    },
  };
}
