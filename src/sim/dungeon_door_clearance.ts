// Overworld half of "never aggro on entry": keep a clear ring around every
// instanced content's overworld door so a player walking up to (or zoning out
// of) a dungeon OR a delve is never standing inside a camp mob's aggro radius.
// The interior half (the arrival point and interior packs) is handled by the
// dungeon/delve entry/spawn data; this covers the OUTSIDE door.
//
// "Instanced content" here is BOTH `DUNGEONS` (the Hollow Crypt, the Under-
// Shrine, the moongate temple, ...) AND `DELVES` (the Collapsed Reliquary at
// Brother Halven's porch). The fork's primary end-game loop is delves, but
// standard heroic-style dungeons still ship and share the same doorPos
// semantics, so the projection enumerates both tables at module load. The
// upstream (#1706) covered only `DUNGEONS`; the fork's spec (PHAA-650) maps
// the mechanic onto the delve entry path explicitly, so we include the
// delve doors here too.
//
// Pure and deterministic (no rng, no clock): the camp spawner projects each
// rolled mob position out of any door's clear ring BEFORE resolving safe
// ground, so the draw order is untouched and only the resulting position
// changes. findSafePos's inward spiral can walk a shore-side ring-edge point
// back toward land, i.e. back INTO the ring; the spawner re-projects the safe
// point so the "never inside a door ring" guarantee holds for every seed.

import { DELVES, DUNGEONS } from './data';
import { MAX_AGGRO_RADIUS } from './mob/locomotion';

// The clear radius around a door is exactly the aggro-radius clamp (imported,
// not a re-typed literal), so a mob spawned strictly outside this ring can
// never aggro a player standing on the door. Retuning the clamp in
// locomotion.ts moves this in lockstep, and the guard test pins the same
// imported constant.
export const DOOR_CLEAR_RADIUS = MAX_AGGRO_RADIUS;

// Every instanced content's overworld door, deduped (some share one entrance,
// e.g. the Nythraxis crypt + raid arena). Computed once at module load from the
// merged tables.
export const DUNGEON_DOORS: ReadonlyArray<{ x: number; z: number }> = (() => {
  const seen = new Set<string>();
  const doors: { x: number; z: number }[] = [];
  for (const d of Object.values(DUNGEONS)) {
    const door = d.doorPos;
    if (!door) continue;
    const key = `${door.x},${door.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    doors.push({ x: door.x, z: door.z });
  }
  // Delves sit alongside dungeons in the camp-spawner's door-clearance ring:
  // a player walking up to Brother Halven's porch is on the same overworld
  // surface and would be chain-pulled by a Gravecaller-camp mob the same way.
  // The fork ships only one delve (collapsed_reliquary at index 0) right now,
  // but the loop is data-driven so a future delve gets the same protection
  // without a code change.
  for (const d of Object.values(DELVES)) {
    const door = d.doorPos;
    if (!door) continue;
    const key = `${door.x},${door.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    doors.push({ x: door.x, z: door.z });
  }
  return doors;
})();

// If (x,z) falls inside any door's clear ring, push it straight out to the
// ring's edge (along the door-to-point direction); a point exactly on a door
// is pushed along +x so the result is deterministic. Points already clear
// are returned as-is.
export function projectOutsideDungeonDoors(x: number, z: number): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (const door of DUNGEON_DOORS) {
    const dx = px - door.x;
    const dz = pz - door.z;
    const dist = Math.hypot(dx, dz);
    if (dist >= DOOR_CLEAR_RADIUS) continue;
    if (dist < 1e-6) {
      px = door.x + DOOR_CLEAR_RADIUS;
      pz = door.z;
    } else {
      const s = DOOR_CLEAR_RADIUS / dist;
      px = door.x + dx * s;
      pz = door.z + dz * s;
    }
  }
  return { x: px, z: pz };
}
