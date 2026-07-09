// The player movement kernel, moved VERBATIM out of Sim.updatePlayerMovement
// (everything after the charge/follow/fear short-circuits and the anti-AFK
// bookkeeping): keyboard turn integration, the wish vector, swept static
// collision, and the vertical step (swim tread, jump, gravity, fall damage,
// ledge snap-down).
//
// Host-agnostic on purpose: the step is a pure function of the entity pose,
// the held MoveInput, the world seed, and the PlayerMotionDeps callbacks. The
// live Sim binds the deps to its own methods (fiesta-aware moveSpeedMult,
// delve-aware resolveMove, real cancelCast/standUp/dealDamage); the online
// client's display-only self extrapolator (src/render/self_motion.ts) binds
// pure/no-op equivalents, so the SAME math animates both hosts and stays in
// lockstep by construction (tests/player_motion.test.ts runs the client dep
// shape against a live Sim every CI run).
//
// `src/sim`-pure: imports only sibling sim modules and draws no rng itself.
// The one rng-reachable callee, dealDamage (fall damage), is invoked through
// deps at the identical call site, so the Sim's global draw order is unchanged
// by the extraction. Behavior is byte-identical to the pre-extraction Sim
// (proven by the parity gate, tests/parity).

import { isRooted, isStunned } from './combat/cc';
import { PLAYER_BODY_RADIUS, PLAYER_MAX_CLIMB_SLOPE, PLAYER_SWIM_DEPTH } from './pathfind';
import { DT, type Entity, type MoveInput, normAngle, RUN_SPEED, TURN_SPEED } from './types';
import { groundHeight, waterLevelAt } from './world';

export const BACKPEDAL_MULT = 0.65;
export const GRAVITY = 16;
export const JUMP_VELOCITY = 6; // apex = v^2/2g ≈ 1.125 yd
// Re-exported by sim.ts for social/chat_readouts.ts (the /falling readout shares
// the landing-damage threshold with the fall-damage model below).
export const FALL_SAFE_DISTANCE = 12; // yards of free fall before damage
export const SWIM_SPEED_MULT = 0.65;
const SWIM_DEPTH = PLAYER_SWIM_DEPTH; // ground this far under the water line = deep water
const MAX_CLIMB_SLOPE = PLAYER_MAX_CLIMB_SLOPE; // rise/run above which a ground move is blocked (cliffs, world rim)
const BODY_RADIUS = PLAYER_BODY_RADIUS;

// Body bobs just below the water line AT this location (terrain/feature-aware:
// -Infinity outside a declared lake, so this is never called off a waterline
// that doesn't exist there).
export function swimSurfaceY(x: number, z: number): number {
  return waterLevelAt(x, z) - 0.75;
}

// A buff_jump aura multiplies jump height (Fiesta "Moon Boots" power-up).
export function jumpMult(e: Entity): number {
  let m = 1;
  for (const a of e.auras) if (a.kind === 'buff_jump') m = Math.max(m, a.value);
  return m;
}

export function isSwimming(e: Entity, seed: number): boolean {
  return (
    groundHeight(e.pos.x, e.pos.z, seed) < waterLevelAt(e.pos.x, e.pos.z) - SWIM_DEPTH &&
    e.pos.y <= swimSurfaceY(e.pos.x, e.pos.z) + 0.15
  );
}

export interface PlayerMotionDeps {
  seed: number;
  /** Fiesta-aware on the live Sim; the pure moveSpeedMult(e) on the client. */
  moveSpeedMult(e: Entity): number;
  /** Swept static collision; the live Sim layers delve module bounds + doors on top. */
  resolveMove(
    fromX: number,
    fromZ: number,
    nx: number,
    nz: number,
    r: number,
    e: Entity,
    ignoreFences: boolean,
  ): { x: number; z: number };
  cancelCast(p: Entity): void;
  standUp(p: Entity): void;
  /** Fall damage: the one rng-reachable callee. A no-op on the client. */
  dealDamage(
    source: null,
    target: Entity,
    amount: number,
    crit: boolean,
    school: string,
    ability: string | null,
    kind: 'hit',
    noRage: boolean,
  ): void;
}

export function stepPlayerMotion(deps: PlayerMotionDeps, p: Entity, inp: MoveInput): void {
  const seed = deps.seed;
  // Convention: facing f points along (sin f, cos f); the camera sits behind
  // the player, so screen-right is the world vector (-cos f, sin f).
  // Turning right therefore DECREASES facing.
  if (!isStunned(p)) {
    if (inp.turnLeft) p.facing = normAngle(p.facing + TURN_SPEED * DT);
    if (inp.turnRight) p.facing = normAngle(p.facing - TURN_SPEED * DT);
  }

  let mx = 0,
    mz = 0; // local: z forward, x strafe-right
  if (inp.forward) mz += 1;
  if (inp.back) mz -= 1;
  if (inp.strafeLeft) mx -= 1;
  if (inp.strafeRight) mx += 1;

  const wantsMove = mx !== 0 || mz !== 0 || inp.jump;
  if (wantsMove && p.sitting) deps.standUp(p);

  const hasMoveInput = mx !== 0 || mz !== 0;
  const moving = hasMoveInput && !isRooted(p);
  const swimming = isSwimming(p, seed);
  let wishX = 0,
    wishZ = 0,
    wishSpeed = 0;
  if (moving) {
    if (p.castingAbility) deps.cancelCast(p);
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    let speed = RUN_SPEED * deps.moveSpeedMult(p);
    if (mz < 0) speed *= BACKPEDAL_MULT;
    if (swimming) speed *= SWIM_SPEED_MULT;
    // world = forward * mz + right * mx, with right = (-cos f, sin f)
    const sin = Math.sin(p.facing),
      cos = Math.cos(p.facing);
    const wx = mz * sin - mx * cos;
    const wz = mz * cos + mx * sin;
    wishX = wx;
    wishZ = wz;
    wishSpeed = speed;
  }

  const movingOnGround = moving && (p.onGround || swimming);
  if (movingOnGround || (!p.onGround && (p.vx !== 0 || p.vz !== 0))) {
    const stepX = movingOnGround ? wishX * wishSpeed : p.vx;
    const stepZ = movingOnGround ? wishZ * wishSpeed : p.vz;
    let nx = p.pos.x + stepX * DT;
    let nz = p.pos.z + stepZ * DT;
    // cliffs and the world rim are walls, not ramps
    if (p.onGround && !swimming) {
      const h0 = groundHeight(p.pos.x, p.pos.z, seed);
      const h1 = groundHeight(nx, nz, seed);
      const run = Math.hypot(nx - p.pos.x, nz - p.pos.z);
      if (h1 > h0 && run > 1e-5 && (h1 - h0) / run > MAX_CLIMB_SLOPE) {
        nx = p.pos.x;
        nz = p.pos.z;
        if (!p.onGround) {
          p.vx = 0;
          p.vz = 0;
        }
      }
    }
    // Slide along buildings, trees, crypt walls, but while airborne from a
    // jump, pass through fences for the whole arc. Keying off the jump itself
    // (not a height threshold) makes this independent of slope: an uphill
    // approach no longer flickers the clearance off right at the rail.
    const clearFences = !p.onGround && p.jumping;
    const resolved = deps.resolveMove(p.pos.x, p.pos.z, nx, nz, BODY_RADIUS, p, clearFences);
    p.pos.x = resolved.x;
    p.pos.z = resolved.z;
    if (!p.onGround && (resolved.x !== nx || resolved.z !== nz)) {
      p.vx = (resolved.x - p.prevPos.x) / DT;
      p.vz = (resolved.z - p.prevPos.z) / DT;
    }
  }

  // Vertical: jumping, gravity, swimming, fall damage
  const ground = groundHeight(p.pos.x, p.pos.z, seed);
  const deepWater = ground < waterLevelAt(p.pos.x, p.pos.z) - SWIM_DEPTH;
  if (deepWater && p.pos.y <= swimSurfaceY(p.pos.x, p.pos.z) + 0.05) {
    // treading water at the surface
    p.pos.y = swimSurfaceY(p.pos.x, p.pos.z);
    p.vy = 0;
    p.vx = 0;
    p.vz = 0;
    p.onGround = true;
    p.jumping = false;
    p.fallStartY = p.pos.y;
    if (inp.jump && !isRooted(p)) {
      // small hop to climb onto shores and docks
      p.vy = JUMP_VELOCITY * 0.7 * jumpMult(p);
      p.vx = wishX * wishSpeed;
      p.vz = wishZ * wishSpeed;
      p.onGround = false;
      p.jumping = true;
    }
    return;
  }
  if (inp.jump && p.onGround && !isRooted(p)) {
    p.vy = JUMP_VELOCITY * jumpMult(p);
    p.vx = wishX * wishSpeed;
    p.vz = wishZ * wishSpeed;
    p.onGround = false;
    p.jumping = true;
    p.fallStartY = p.pos.y;
  }
  if (!p.onGround) {
    p.vy -= GRAVITY * DT;
    p.pos.y += p.vy * DT;
    p.fallStartY = Math.max(p.fallStartY, p.pos.y);
    if (deepWater && p.pos.y <= swimSurfaceY(p.pos.x, p.pos.z)) {
      // splashing into deep water breaks the fall
      p.pos.y = swimSurfaceY(p.pos.x, p.pos.z);
      p.vy = 0;
      p.vx = 0;
      p.vz = 0;
      p.onGround = true;
      p.jumping = false;
      p.fallStartY = p.pos.y;
      return;
    }
    if (p.pos.y <= ground) {
      p.pos.y = ground;
      p.vy = 0;
      p.vx = 0;
      p.vz = 0;
      p.onGround = true;
      p.jumping = false;
      const drop = p.fallStartY - ground;
      if (drop > FALL_SAFE_DISTANCE) {
        const dmg = Math.round(p.maxHp * (drop - FALL_SAFE_DISTANCE) * 0.07);
        if (dmg > 0) deps.dealDamage(null, p, dmg, false, 'physical', 'Falling', 'hit', true);
      }
      p.fallStartY = ground;
    }
  } else {
    // Distinguish a walkable downhill slope from a genuine cliff/ledge. The
    // drop the ground can take in one tick scales with how far we moved: a
    // slope no steeper than MAX_CLIMB_SLOPE (the same gate that blocks uphill
    // climbs) is walkable, so we snap down to follow it instead of falling.
    // Only a steeper-than-walkable drop counts as walking off a ledge. The
    // 0.4 base keeps a near-stationary player snapped over tiny terrain noise.
    const run = Math.hypot(p.pos.x - p.prevPos.x, p.pos.z - p.prevPos.z);
    const maxStepDown = 0.4 + run * MAX_CLIMB_SLOPE;
    if (ground < p.pos.y - maxStepDown) {
      // walked off a ledge (not a jump), so fences still block
      p.onGround = false;
      p.jumping = false;
      p.vx = 0;
      p.vz = 0;
      p.vy = 0;
      p.fallStartY = p.pos.y;
    } else {
      p.pos.y = ground;
      p.fallStartY = ground;
    }
  }
}
