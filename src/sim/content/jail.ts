// The Bramble Hold: a moderation jail hidden deep in unclaimed wilds, far
// west and south of the Hollow's zone strip. Not a dungeon instance: no door,
// no party, one shared cage for the whole realm. A moderator's /jail command
// teleports the target here directly (server/moderation_service.ts +
// server/game.ts); there is no walk-in path. Position math only; the render
// side (src/render/jail_scene.ts) and the server wiring own everything else.
//
// The location sits at large negative x/z, clear of every other far-off
// instance band, which all anchor to positive x (see data.ts: dungeons start
// past DUNGEON_X_THRESHOLD=600, the arena at ARENA_X=5400, delves from
// DELVE_BAND_X_MIN=5973 with no upper bound). zoneAt/dungeonAt/isDelvePos all
// degrade gracefully for an arbitrary remote position (checked against the
// current code, not assumed), so this needs no changes to those lookups.

export type JailState = {
  returnPos: { x: number; z: number };
  returnFacing: number;
  // Sentence end, epoch ms (server wall clock). Undefined would mean
  // indefinite, but the command surface always requires a duration, so this
  // is set whenever a JailState exists.
  until: number;
};

export const JAIL_CENTER = { x: -9000, z: -9000 };
export const JAIL_FLOOR_Y = 0;
// Half-extent of the whole hold clearing (cage plus the warden's yard around
// it), used to flatten terrain and gate camera/fog treatment.
export const JAIL_OUTER_HALF = 30;
// Half-extent of the cage prisoners are held in.
export const JAIL_CAGE_HALF = 14;

export function isInJailBounds(pos: { x: number; z: number }): boolean {
  return (
    Math.abs(pos.x - JAIL_CENTER.x) <= JAIL_OUTER_HALF &&
    Math.abs(pos.z - JAIL_CENTER.z) <= JAIL_OUTER_HALF
  );
}

// Escape check for the per-tick enforcement in server/game.ts: a prisoner
// found outside the cage (including one who died and is standing at a
// corpse/graveyard elsewhere) gets teleported back to a cage spawn point.
export function isInJailCage(pos: { x: number; z: number }): boolean {
  return (
    Math.abs(pos.x - JAIL_CENTER.x) <= JAIL_CAGE_HALF &&
    Math.abs(pos.z - JAIL_CENTER.z) <= JAIL_CAGE_HALF
  );
}

// Deterministic per-prisoner spawn point inside the cage, so a full cage
// spreads its occupants out instead of stacking them on the centre point.
export function jailCageSpawn(slot: number): { x: number; z: number } {
  const index = Math.abs(Math.trunc(slot)) % 8;
  if (index === 0) return { x: JAIL_CENTER.x, z: JAIL_CENTER.z };
  const angle = ((index - 1) / 7) * Math.PI * 2;
  const radius = index % 2 === 0 ? 5 : 9;
  return {
    x: JAIL_CENTER.x + Math.cos(angle) * radius,
    z: JAIL_CENTER.z + Math.sin(angle) * radius,
  };
}
