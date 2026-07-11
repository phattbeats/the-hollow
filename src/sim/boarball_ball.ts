// Boarball: pure, host-agnostic ball physics (PHAA-572, adapted from
// upstream's Vale Cup ball driver onto our arena pitch, src/sim/boarball_layout.ts).
//
// A deterministic leaf module in the threat.ts/spatial.ts mold: no SimContext, no
// rng, no clocks; every function is a pure step over a plain kinematics record, so
// tests/boarball_ball.test.ts drives it directly. The match driver
// (src/sim/social/boarball.ts) owns WHEN these run; this module owns only the math.
//
// Reflection is analytic (colliders.ts only slides, it never reflects), using the
// same wall segments the arena's real colliders enclose the pit with.

import {
  type BbWallSegment,
  GOAL_HEIGHT,
  GOAL_LINE_NORTH_Z,
  GOAL_LINE_SOUTH_Z,
  GOAL_X_MAX,
  GOAL_X_MIN,
  PITCH_WALLS,
} from './boarball_layout';
import { DT } from './types';

// Tuning constants (all yards / seconds).
export const BB_BALL_GRAVITY = 16;
export const BB_BALL_RADIUS = 0.49; // a real soccer ball
export const BB_BALL_MAX_SPEED = 24; // yd/s cap on ground speed (the pit is compact)
export const BB_BALL_GROUND_RESTITUTION = 0.45; // bounce energy kept on landing
export const BB_BALL_WALL_RESTITUTION = 0.7; // bank energy kept off the boards
export const BB_BALL_ROLL_DECEL = 4; // yd/s^2 rolling friction
export const BB_BALL_SLOW_DECEL = 8; // yd/s^2 once nearly stopped...
export const BB_BALL_SLOW_SPEED = 2; // ...below this speed
export const BB_BALL_BOUNCE_MIN_VY = 1.2; // smaller landings settle instead of bouncing
export const BB_BALL_POCKET_DECEL = 14; // net pockets kill the ball fast (no bank)
// Body control (a ball must never sail through a fighter): a ball FASTER than any
// dribble carry that meets a fighter's body is trapped to a slow controlled roll at
// their feet. The threshold sits above the fastest sprint dribble carry.
export const BB_TRAP_MIN_BALL_SPEED = 13; // yd/s; the dribble-carry ceiling
export const BB_TRAP_ROLL_SPEED = 2.5; // yd/s controlled roll after the trap
export const BB_TRAP_VY_DAMP = 0.25; // vertical speed kept through the trap
export const BB_DRIBBLE_SPEED_MULT = 1.15;
const BB_DRIBBLE_MIN_MOVER_SPEED = 0.5; // yd/s; standing still never nudges

// The mutable kinematics record the match state owns. `y` is the ball's BOTTOM
// height (entity pos.y convention: resting means y === groundY).
export interface BbBallKinematics {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

function capSpeed(b: BbBallKinematics): void {
  const s = Math.hypot(b.vx, b.vz);
  if (s > BB_BALL_MAX_SPEED) {
    const k = BB_BALL_MAX_SPEED / s;
    b.vx *= k;
    b.vz *= k;
  }
}

function applyRollFriction(b: BbBallKinematics, decel: number): void {
  const s = Math.hypot(b.vx, b.vz);
  if (s <= 0) return;
  const rate = s < BB_BALL_SLOW_SPEED ? Math.max(decel, BB_BALL_SLOW_DECEL) : decel;
  const ns = Math.max(0, s - rate * DT);
  if (ns === 0) {
    b.vx = 0;
    b.vz = 0;
  } else {
    const k = ns / s;
    b.vx *= k;
    b.vz *= k;
  }
}

function integrateVertical(b: BbBallKinematics, groundY: number): void {
  b.vy -= BB_BALL_GRAVITY * DT;
  b.y += b.vy * DT;
  if (b.y <= groundY) {
    b.y = groundY;
    if (b.vy < -BB_BALL_BOUNCE_MIN_VY) {
      b.vy = -b.vy * BB_BALL_GROUND_RESTITUTION;
    } else {
      b.vy = 0;
    }
  }
}

function onGround(b: BbBallKinematics, groundY: number): boolean {
  return b.y <= groundY + 1e-3 && Math.abs(b.vy) < 1e-3;
}

// Reflect off one axis-aligned board segment when the ball's center penetrates
// the wall plane (offset inward by the ball radius) moving outward, within the
// segment's span.
function reflectOffWall(b: BbBallKinematics, w: BbWallSegment): boolean {
  if (w.nx !== 0) {
    const plane = w.x1 + w.nx * BB_BALL_RADIUS;
    const penetrated = w.nx > 0 ? b.x < plane : b.x > plane;
    const outbound = w.nx > 0 ? b.vx < 0 : b.vx > 0;
    if (!penetrated || !outbound) return false;
    const z0 = Math.min(w.z1, w.z2) - BB_BALL_RADIUS;
    const z1 = Math.max(w.z1, w.z2) + BB_BALL_RADIUS;
    if (b.z < z0 || b.z > z1) return false;
    b.x = 2 * plane - b.x;
    b.vx = -b.vx * BB_BALL_WALL_RESTITUTION;
    b.vz *= BB_BALL_WALL_RESTITUTION;
    return true;
  }
  const plane = w.z1 + w.nz * BB_BALL_RADIUS;
  const penetrated = w.nz > 0 ? b.z < plane : b.z > plane;
  const outbound = w.nz > 0 ? b.vz < 0 : b.vz > 0;
  if (!penetrated || !outbound) return false;
  const x0 = Math.min(w.x1, w.x2) - BB_BALL_RADIUS;
  const x1 = Math.max(w.x1, w.x2) + BB_BALL_RADIUS;
  if (b.x < x0 || b.x > x1) return false;
  b.z = 2 * plane - b.z;
  b.vz = -b.vz * BB_BALL_WALL_RESTITUTION;
  b.vx *= BB_BALL_WALL_RESTITUTION;
  return true;
}

// One 20 Hz physics step while the ball is IN PLAY. Integrates gravity + ground
// bounce, rolling friction, the speed cap, then the goal planes and the board
// reflections. Returns the SCORING team when the ball's center crossed a goal
// line between the posts this step ('A' scores in the north goal, 'B' in the
// south; south is team A's own goal), else null.
export function stepBallPhysics(b: BbBallKinematics, groundY: number): 'A' | 'B' | null {
  capSpeed(b);
  const px = b.x;
  const pz = b.z;
  const py = b.y;
  b.x += b.vx * DT;
  b.z += b.vz * DT;
  integrateVertical(b, groundY);
  if (onGround(b, groundY)) applyRollFriction(b, BB_BALL_ROLL_DECEL);

  // Goal planes first: a center crossing between the posts (inclusive at the
  // post line), UNDER the crossbar, is a score and must NOT bank off the
  // flanking board segments. A ball crossing above the bar height sails over.
  if (pz >= GOAL_LINE_SOUTH_Z && b.z < GOAL_LINE_SOUTH_Z) {
    const t = (pz - GOAL_LINE_SOUTH_Z) / Math.max(1e-9, pz - b.z);
    const xc = px + (b.x - px) * t;
    const yc = py + (b.y - py) * t;
    if (xc >= GOAL_X_MIN && xc <= GOAL_X_MAX && yc - groundY < GOAL_HEIGHT) return 'B';
  } else if (pz <= GOAL_LINE_NORTH_Z && b.z > GOAL_LINE_NORTH_Z) {
    const t = (GOAL_LINE_NORTH_Z - pz) / Math.max(1e-9, b.z - pz);
    const xc = px + (b.x - px) * t;
    const yc = py + (b.y - py) * t;
    if (xc >= GOAL_X_MIN && xc <= GOAL_X_MAX && yc - groundY < GOAL_HEIGHT) return 'A';
  }

  for (const w of PITCH_WALLS) reflectOffWall(b, w);
  return null;
}

// One 20 Hz step while the ball sits in a net pocket after a goal ('goal'
// phase): pocket hits settle the ball dead, they never bank.
export function settleBallInPocket(
  b: BbBallKinematics,
  side: 'south' | 'north',
  groundY: number,
): void {
  b.x += b.vx * DT;
  b.z += b.vz * DT;
  integrateVertical(b, groundY);
  applyRollFriction(b, BB_BALL_POCKET_DECEL);
  const line = side === 'south' ? GOAL_LINE_SOUTH_Z : GOAL_LINE_NORTH_Z;
  const dir = side === 'south' ? -1 : 1;
  const back = line + dir * 2; // logical net depth, no rendered pocket box
  const lo = Math.min(line, back);
  const hi = Math.max(line, back);
  if (b.z < lo) {
    b.z = lo;
    b.vx = 0;
    b.vz = 0;
  } else if (b.z > hi) {
    b.z = hi;
    b.vx = 0;
    b.vz = 0;
  }
  const xLo = GOAL_X_MIN + BB_BALL_RADIUS;
  const xHi = GOAL_X_MAX - BB_BALL_RADIUS;
  if (b.x < xLo) {
    b.x = xLo;
    b.vx = 0;
    b.vz = 0;
  } else if (b.x > xHi) {
    b.x = xHi;
    b.vx = 0;
    b.vz = 0;
  }
}

// Dribbling is just running with the ball: a mover overlapping the ball nudges
// it along their own movement direction to a bit over their speed, and only
// when the ball is slower than that. `moverDx/moverDz` is the mover's
// displacement THIS tick (pos - prevPos).
export function applyDribbleNudge(b: BbBallKinematics, moverDx: number, moverDz: number): boolean {
  const step = Math.hypot(moverDx, moverDz);
  const moverSpeed = step / DT;
  if (moverSpeed < BB_DRIBBLE_MIN_MOVER_SPEED) return false;
  const target = moverSpeed * BB_DRIBBLE_SPEED_MULT;
  if (Math.hypot(b.vx, b.vz) >= target) return false;
  b.vx = (moverDx / step) * target;
  b.vz = (moverDz / step) * target;
  return true;
}

// Body control: a fighter standing in a fast ball's path TRAPS it, so it drops
// playable at their feet instead of sailing through them. `facing` uses the sim
// convention (facing f points along (sin f, cos f)).
export function applyBodyTrap(
  b: BbBallKinematics,
  moverDx: number,
  moverDz: number,
  facing: number,
): boolean {
  if (Math.hypot(b.vx, b.vz) < BB_TRAP_MIN_BALL_SPEED) return false;
  const step = Math.hypot(moverDx, moverDz);
  let dirX: number;
  let dirZ: number;
  if (step / DT >= BB_DRIBBLE_MIN_MOVER_SPEED) {
    dirX = moverDx / step;
    dirZ = moverDz / step;
  } else {
    dirX = Math.sin(facing);
    dirZ = Math.cos(facing);
  }
  b.vx = dirX * BB_TRAP_ROLL_SPEED;
  b.vz = dirZ * BB_TRAP_ROLL_SPEED;
  b.vy *= BB_TRAP_VY_DAMP;
  return true;
}

// Launch the ball from a kick: `power` is the ground speed (yd/s, capped) along
// the unit direction, `loft` the initial vertical speed.
export function launchBall(
  b: BbBallKinematics,
  dirX: number,
  dirZ: number,
  power: number,
  loft: number,
): void {
  const len = Math.hypot(dirX, dirZ);
  if (len < 1e-6) return;
  const speed = Math.min(BB_BALL_MAX_SPEED, Math.max(0, power));
  b.vx = (dirX / len) * speed;
  b.vz = (dirZ / len) * speed;
  b.vy = Math.max(0, loft);
}
