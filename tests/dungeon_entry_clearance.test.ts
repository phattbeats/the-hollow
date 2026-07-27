// Entering an instance (dungeon OR delve) must never put a mob within aggro
// range of the arrival point: zoning in should never pull a pack. Mob aggro
// radius is clamped to at most MAX_AGGRO_RADIUS yards (mob/locomotion.ts:
// Math.min(MAX_AGGRO_RADIUS, template.aggroRadius + leveldiff * 1.5)), so a
// spawn strictly beyond that from the entry can never aggro on arrival, at any
// level difference (this is what bites heroic, where mobs pin to level 20).
// This guard pins that clearance so a future spawn edit or entry move can't
// reintroduce the pull.
//
// The fork's primary end-game content is DELVES, not heroic dungeons, so the
// "door" side of the test asserts no camp mob sits inside any DUNGEON_DOORS
// ring, where DUNGEON_DOORS is the union of every DUNGEON.doorPos and every
// DELVE.doorPos (see dungeon_door_clearance.ts). PHAA-650 adapts the upstream
// #1706 mechanic to the delve entry path by including both tables.
//
// SCOPE: this pins the SPAWN clearance, i.e. the instant of zone-in, when
// every mob is exactly on its spawnPos. It is not a claim about idle wander:
// an interior mob drifts up to about 9 yd off spawn (locomotion.ts idle
// wander), so a spawn near the boundary can stray inside the clamp mid-wander
// and a late joiner or corpse-run re-entry could still be pulled. First zone-
// in, the reported bug, is what is guaranteed here.
import { describe, expect, it } from 'vitest';
import { CAMPS, DELVE_MODULES, DELVES, DUNGEONS, MOBS } from '../src/sim/data';
import {
  DOOR_CLEAR_RADIUS,
  DUNGEON_DOORS,
  projectOutsideDungeonDoors,
} from '../src/sim/dungeon_door_clearance';
// The single source of truth for the aggro clamp: imported, not re-typed, so
// retuning the clamp moves this guard (and the door-clearance ring) with it
// in lockstep.
import { MAX_AGGRO_RADIUS } from '../src/sim/mob/locomotion';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';

// Module-local entry point matches Sim's delveModuleEntry (delve_layout.ts):
// { x: 0, z: zMin + 8 } in instance-local coords. The first-pack-vs-entry
// distance is the same in instance-local and in the per-spawns table, since
// both use instance-local z.
const DELVE_MODULE_Z_MIN = -19;
const DELVE_MODULE_ENTRY_Z = DELVE_MODULE_Z_MIN + 8;

describe('instance entry clearance: zoning in never aggros a pack', () => {
  for (const dungeon of Object.values(DUNGEONS)) {
    const spawns = dungeon.spawns ?? [];
    if (spawns.length === 0) continue; // e.g. a Nythraxis attunement crypt has no spawns
    it(`${dungeon.id}: no spawn within ${MAX_AGGRO_RADIUS} yd of the entry`, () => {
      for (const s of spawns) {
        const dist = Math.hypot(s.x - dungeon.entry.x, s.z - dungeon.entry.z);
        expect(
          dist,
          `${dungeon.id}: ${s.mobId} at (${s.x},${s.z}) is ${dist.toFixed(1)} yd from entry ` +
            `(${dungeon.entry.x},${dungeon.entry.z}), within aggro range`,
        ).toBeGreaterThanOrEqual(MAX_AGGRO_RADIUS);
      }
    });
  }
  // The fork's end-game is the delve loop. Assert the same clearance for
  // every first-pack spawn in every module of every registered delve, measured
  // against the module's own entry point. This is what pins the interior
  // (zone-in) half of PHAA-650: a future spawn edit that pulls a pack closer
  // to the module entry will trip this test.
  for (const delve of Object.values(DELVES)) {
    for (const moduleId of [...delve.modules, delve.finaleModuleId]) {
      const mod = DELVE_MODULES[moduleId];
      if (!mod) continue;
      for (const spawnSet of mod.spawnSets) {
        const firstPack = spawnSet.spawns;
        if (firstPack.length === 0) continue;
        it(`${delve.id}/${moduleId}/${spawnSet.id}: first pack clears ${MAX_AGGRO_RADIUS} yd from the module entry`, () => {
          for (const s of firstPack) {
            const dist = Math.hypot(s.x - 0, s.z - DELVE_MODULE_ENTRY_Z);
            expect(
              dist,
              `${delve.id}/${moduleId}: ${s.mobId ?? 'mob'} at (${s.x},${s.z}) is ` +
                `${dist.toFixed(1)} yd from the module entry ` +
                `(0,${DELVE_MODULE_ENTRY_Z}), within aggro range`,
            ).toBeGreaterThanOrEqual(MAX_AGGRO_RADIUS);
          }
        });
      }
    }
  }
});

describe('instance door clearance: no camp mob spawns on an overworld door', () => {
  it('projects a point inside a door ring out to the ring edge', () => {
    const door = DUNGEON_DOORS[0];
    const inside = projectOutsideDungeonDoors(door.x + 3, door.z);
    expect(Math.hypot(inside.x - door.x, inside.z - door.z)).toBeCloseTo(DOOR_CLEAR_RADIUS, 5);
    // a point already clear is returned unchanged
    const clear = projectOutsideDungeonDoors(door.x + 500, door.z);
    expect(clear.x).toBe(door.x + 500);
  });

  // The projection runs BEFORE findSafePos, whose inward spiral can walk a
  // shore-side ring-edge point back into the ring, so the spawner re-projects
  // the safe point. That makes the "never inside a door ring" clearance hold
  // for EVERY seed, not just the shipped one: earlier this passed only because
  // a particular seed happened to land every door-adjacent mob at exactly the
  // ring edge (other seeds put mobs 14-18 yd from a door). Loop several seeds
  // and assert exact clearance (no tolerance slack).
  for (const seed of [7, 99, 2024, 20061, 31337]) {
    it(`seed ${seed}: no camp mob spawns within the clear radius of any door`, () => {
      const sim = new Sim({ seed, playerClass: 'warrior', autoEquip: true });
      const mobs = [
        ...(sim as unknown as { entities: Map<number, Entity> }).entities.values(),
      ].filter((e: Entity) => e.kind === 'mob');
      expect(mobs.length).toBeGreaterThan(0);
      for (const mob of mobs) {
        for (const door of DUNGEON_DOORS) {
          const d = Math.hypot(mob.pos.x - door.x, mob.pos.z - door.z);
          // Re-projected mobs land exactly on the ring, so allow float epsilon
          // only (1e-6, sub-micron): this is not tolerance slack, it is IEEE
          // rounding on the exact-ring point (e.g. 19.999999999999996).
          expect(
            d,
            `${mob.name} at (${mob.pos.x.toFixed(1)},${mob.pos.z.toFixed(1)}) is ${d.toFixed(1)} ` +
              `yd from a door (${door.x},${door.z})`,
          ).toBeGreaterThanOrEqual(DOOR_CLEAR_RADIUS - 1e-6);
        }
      }
    });
  }

  it('every camp is a known template (guards the CAMPS table)', () => {
    for (const c of CAMPS) expect(MOBS[c.mobId], `camp ${c.mobId}`).toBeDefined();
  });
});
