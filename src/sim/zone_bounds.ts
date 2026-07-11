// Starter zone bounds (PHAA-420, sealed starter zone; PHAA-472 closes the
// walk-out exploit at the world rim). The Hollow Reaches is the open-world
// starter ground prepended south of Eastbrook Vale; its latitudinal
// (zMin/zMax) strip is already enforced by the sealed mountain ridge to the
// north (sealedFrontier on ZoneDef, world.ts's ZONE_RIDGES) and the world
// heightfield rim to the south. The lateral (xMin/xMax) direction is open:
// nothing stops a mover from walking out to the world edge. The board
// reported BRAPADIN at (179, -224), standing on the eastern world rim slope
// after walking east for over 30 yards past the rim's visual base.
//
// The per-tick MOVEMENT gate at MAX_CLIMB_SLOPE (sim.ts ~2932) is supposed
// to block the rim: its ratio of (height gained) / (run length) must stay
// under 1.5, and the rim's smoothstep(150, 180, |x|) does exceed that gate
// partway up the slope (~1.78 around x=160). But the gate is only checked
// while grounded; an airborne jump skips it entirely, and a determined
// player can hop up the slope in stages. To close the exploit without
// making the visible rim steeper, this file gives the strip a hard box
// clamp that fires AFTER per-tick collision resolves (colliders.ts), so it
// catches escapes regardless of the bypass the player used: jump, swim,
// slow-walk, anything.
//
// Bounds sit at the TOP of each visible rim, not the base, per board
// follow-up ("make sure its not too restrictive"): the player walks the
// full ramp up to the world edge before the clamp catches them, so the
// wall reads as the slope itself rather than an invisible barrier on
// flat ground. The climb-slope gate still blocks grounded walking past
// ~x=155; the clamp only matters for jumpers (and for the absolute top
// of the ramp). All Hollow Reaches content lives inside |x| < 100 and z
// in [-374, -238] (Hollow Zone camps, NPCs, gate, lake); pushing the x
// bounds to the world edge gives the player the entire rim ramp to
// explore without sacrificing the closure of the original exploit.
//
// z bounds stay at their original positions: the south bound sits a hair
// past the southernmost boar camp (z=-374 center, radius 12 -> edge
// -386, zMin=-388) so camp content stays reachable, and the north bound
// sits at the sealed mountain ridge (zMax=-180). The Hollow Gate at
// (0, -290) is the portal into the next zone; the open-world Hollow
// Reaches does not tile into Eastbrook Vale on foot (PHAA-420 / parent
// PHAA-419 keep the vase hub as the only forward route), so the z
// direction is already closed by terrain and needs no further relaxation.
//
// Pure, sim-side: zero DOM/three/render imports, no Math.random. Run from
// node and from the browser without dragging the renderer.

import { HOLLOW_ZONE_ZONE } from './content/hollow_zone';

// Visible Hollow Reaches extents clamp. x edges sit at the world edge
// (WORLD_MAX_X = 180), the top of the smoothstep rim ramp
// (smoothstep(WORLD_MAX_X - 30, WORLD_MAX_X, |x|) in world.ts). Pushing
// the clamp from the ramp base (150) up to the world edge (180) per
// board feedback lets the climb-slope gate do most of the work on the
// visible ramp while the clamp only catches the airborne-jump bypass
// at the world edge. z edges: south pulled in past the southernmost
// boar camp (z=-374 center, radius 12 -> edge -386; zMin=-388 leaves a
// 2-unit crawl so the player can still reach camp content); north at
// the sealed mountain ridge (zMax=-180). PLAYER bodies carry a radius
// (0.6), so the player stops a body-radius shy of each bound. The
// padding keeps the visual base of the wall readable as a one-pixel
// shimmer rather than clipping into the terrain.
export const STARTER_ZONE_BOUNDS = {
  xMin: -180,
  xMax: 180,
  zMin: -388,
  zMax: -180,
} as const;

// Gate buffer around the z strip. The isInsideStarterZone gate decides
// whether to apply the clamp at all. With a band pressed flush to the
// strip, a jumping player who landed 1 yard past zMax would pop OUT of the
// gate and the clamp would stop firing, undoing the catch. We ring the
// zone's z strip (NOT the visible-bounds strip, which is tighter; the
// south bound is at z=-388 but the zone extends to z=-400) with a 10-unit
// buffer so a jumped-or-walked escape lands in gated space and the clamp
// pulls it back. South of the zone is pure heightfield ramp (no content),
// and zone 1 has nothing south of z=-97, so the 10-unit ring only enters
// an empty strip on both ends.
const STARTER_ZONE_GATE_BUFFER = 10;

// Is a given z inside the starter zone's z-band (gate-band: HOLLOW_ZONE z
// strip plus the z-buffer). x is intentionally not checked: the world strip
// is a single horizontal band at every x, and clamping x at every in-band z
// is exactly what closes the east-west walk-out. The gate powers both
// movement clamping (colliders.ts) and any future queries (UI ping, debug
// overlay).
export function isInsideStarterZone(z: number): boolean {
  return (
    z >= HOLLOW_ZONE_ZONE.zMin - STARTER_ZONE_GATE_BUFFER &&
    z <= HOLLOW_ZONE_ZONE.zMax + STARTER_ZONE_GATE_BUFFER
  );
}

// Pull a point back inside the visible starter zone strip, padding the wall
// by the mover's body radius so a 0r mover pressing up against the wall sits
// flush against it. Called from resolvePosition AFTER per-cell collider
// resolution (colliders.ts) so existing tree/fence slide still applies and
// the wall only kicks in at the visual rim. Caller decides whether to apply
// the clamp (resolvePosition only invokes it when the mover's z is inside
// the gate-band), so this helper itself is just an unconditional box clamp
// on the strip.
export function clampToStarterZoneBounds(
  x: number,
  z: number,
  r: number,
): { x: number; z: number } {
  const pad = Math.max(0, r);
  const minX = STARTER_ZONE_BOUNDS.xMin + pad;
  const maxX = STARTER_ZONE_BOUNDS.xMax - pad;
  return {
    x: Math.min(Math.max(x, minX), maxX),
    z: Math.min(Math.max(z, STARTER_ZONE_BOUNDS.zMin + pad), STARTER_ZONE_BOUNDS.zMax - pad),
  };
}
