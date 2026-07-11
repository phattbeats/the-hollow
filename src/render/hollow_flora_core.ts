// Deterministic placement for the Hollow Reaches' otherworldly flora (PHAA-581).
//
// The starter zone (content/hollow_zone.ts, "The Hollow Reaches") reads lusher
// and stranger than the vale strip it prepends: the ground dressing already
// gets a density boost there (foliage.ts HOLLOW_REACHES_DRESS_BOOST), and this
// pass adds a scatter of the procedural plant-creatures (PHAA-437, the parent
// ticket) as static garden flora clustered around each NPC camp and post. When
// the player crosses into the vanilla first zone (zone1, north of zMax) the
// flora stops and the world reads normal again.
//
// This module is the PURE placement half: DOM/Three-free so a Vitest can import
// and assert determinism + exclusion directly. The painter half
// (hollow_flora.ts) turns each placement into a plant-creature group. Placement
// is cosmetic and walk-through (no colliders, no sim/rng state), so it can sit
// entirely in render/ like the ground-dressing scatter it complements.

import {
  HOLLOW_ZONE_CAMPS,
  HOLLOW_ZONE_GATE_POS,
  HOLLOW_ZONE_NPCS,
  HOLLOW_ZONE_PROPS,
  HOLLOW_ZONE_ZONE,
} from '../sim/content/hollow_zone';
import { hash2 } from '../sim/rng';
import { roadDistance, terrainHeight, WATER_LEVEL } from '../sim/world';
import type { PlantArchetype } from './plant_creature_core';
import { PLANT_ARCHETYPES } from './plant_creature_core';

export interface FloraPlacement {
  x: number;
  z: number;
  archetype: PlantArchetype;
  /** rest-pose scale: these are decor, kept smaller than the mob visuals */
  scale: number;
  rotY: number;
  /** per-instance seed for plantCreatureSpec (shape variety) */
  seed: number;
}

// Cluster anchors: every camp center plus every posted NPC. Fixed order (camps
// then NPCs, both in declaration order) so the hash-driven scatter is stable.
interface Anchor {
  x: number;
  z: number;
  inner: number;
  outer: number;
}

function anchors(): Anchor[] {
  const out: Anchor[] = [];
  for (const c of HOLLOW_ZONE_CAMPS) {
    // ring the camp from half-radius to a little past its edge: "around" it,
    // not on top of the spawn point.
    out.push({ x: c.center.x, z: c.center.z, inner: c.radius * 0.5, outer: c.radius + 6 });
  }
  for (const npc of Object.values(HOLLOW_ZONE_NPCS)) {
    const wr = npc.wanderRadius ?? 4;
    out.push({ x: npc.pos.x, z: npc.pos.z, inner: wr + 2.5, outer: wr + 10 });
  }
  return out;
}

// Point obstacles the flora must not clip: hand-placed props and the NPC posts.
interface Exclusion {
  x: number;
  z: number;
  r: number;
}

function exclusions(): Exclusion[] {
  const p = HOLLOW_ZONE_PROPS;
  const out: Exclusion[] = [];
  for (const w of p.wells) out.push({ x: w.x, z: w.z, r: w.r + 1.6 });
  for (const t of p.tents) out.push({ x: t.x, z: t.z, r: 2.2 * t.scale });
  for (const [x, z] of p.crates) out.push({ x, z, r: 1.8 });
  for (const [x, z] of p.campfires) out.push({ x, z, r: 2.0 });
  for (const npc of Object.values(HOLLOW_ZONE_NPCS)) {
    const wr = npc.wanderRadius ?? 4;
    out.push({ x: npc.pos.x, z: npc.pos.z, r: wr + 1.5 });
  }
  return out;
}

function distToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const len2 = abx * abx + abz * abz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / len2)) : 0;
  const dx = apx - abx * t;
  const dz = apz - abz * t;
  return Math.hypot(dx, dz);
}

const SLOTS_PER_ANCHOR = 8;
const KEEP_PER_ANCHOR = 5;
const MIN_SEPARATION = 2.4;
const FENCE_CLEARANCE = 1.6;
const ROAD_CLEARANCE = 3;
const GATE_CLEARANCE = HOLLOW_ZONE_ZONE.hub.radius + 4;

/**
 * Deterministic scatter of otherworldly plant-creature flora around the Hollow
 * Reaches camps and NPC posts. Same seed to same list; empty spots only (skips
 * props, the gate hub, roads, water, fences, NPC posts, and its own placements).
 */
export function hollowFloraLayout(seed: number): FloraPlacement[] {
  const out: FloraPlacement[] = [];
  const excl = exclusions();
  const fences = HOLLOW_ZONE_PROPS.fences;
  const anchorList = anchors();

  for (let ai = 0; ai < anchorList.length; ai++) {
    const a = anchorList[ai];
    let kept = 0;
    for (let si = 0; si < SLOTS_PER_ANCHOR && kept < KEEP_PER_ANCHOR; si++) {
      const angle = hash2(ai, si, seed + 401) * Math.PI * 2;
      const radius = a.inner + hash2(ai, si, seed + 402) * (a.outer - a.inner);
      const x = a.x + Math.cos(angle) * radius;
      const z = a.z + Math.sin(angle) * radius;

      // starter zone only: the world goes back to normal past its north edge
      if (z < HOLLOW_ZONE_ZONE.zMin || z >= HOLLOW_ZONE_ZONE.zMax) continue;
      if (Math.hypot(x - HOLLOW_ZONE_GATE_POS.x, z - HOLLOW_ZONE_GATE_POS.z) < GATE_CLEARANCE) {
        continue;
      }
      if (roadDistance(x, z) < ROAD_CLEARANCE) continue;
      if (terrainHeight(x, z, seed) < WATER_LEVEL + 1.2) continue;

      let blocked = false;
      for (const e of excl) {
        if (Math.hypot(x - e.x, z - e.z) < e.r) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      for (const f of fences) {
        if (distToSegment(x, z, f.x1, f.z1, f.x2, f.z2) < FENCE_CLEARANCE) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      for (const placed of out) {
        if (Math.hypot(x - placed.x, z - placed.z) < MIN_SEPARATION) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const archetype =
        PLANT_ARCHETYPES[Math.floor(hash2(ai, si, seed + 403) * PLANT_ARCHETYPES.length)];
      out.push({
        x,
        z,
        archetype,
        scale: 0.42 + hash2(ai, si, seed + 404) * 0.46,
        rotY: hash2(ai, si, seed + 405) * Math.PI * 2,
        seed: Math.floor(hash2(ai, si, seed + 406) * 0xffffff),
      });
      kept++;
    }
  }
  return out;
}
