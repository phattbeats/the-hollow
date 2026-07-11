// Boarball (PHAA-572): the unranked 2v2 sport minigame, ADAPTED from upstream's
// Vale Cup onto this fork's existing Ashen Coliseum arena instance (see
// boarball_layout.ts for why: the ticket calls for landing it on OUR arena/
// fiesta system, not a new outdoor Sowfield zone). Move-and-adapt, not a
// straight port: queue + matchmaking stay in arena.ts (every format's queue
// lives there; matchmakeBoarball is a flat FIFO fill, unranked, no premades,
// no bot backfill, this fork's online server never spawns bot players for
// any format, see fiesta_bots.ts); this module owns only the live-match
// mechanics (ball physics, the sport-kit swap, kickoff/goal/end lifecycle),
// reached from arena.ts exclusively through SimContext callbacks (arena.ts
// never imports this module directly, keeping fiesta.ts's one-way dependency
// precedent: this module imports arena.ts, never the reverse).
//
// Hard exclusions per the ticket (SKIP, do not port): the recordValeCupResult
// daily-reward hook (DailyRewardService does not exist in this fork; the
// daily-reward category is banned, docs/plan-the-hollow.md:412, PHAA-518) and
// spectator betting/wagering (SKIP(conflict) pending a Board call, PHAA-565).
// Neither has any code path here: boarball never touches currency, and
// endArenaMatch's `ranked` flag treats it exactly like Fiesta (never moves the
// Elo ladder, never grants a reward).
//
// Determinism: ZERO rng draws (ball physics/matchmaking are pure functions of
// sim state, the fiesta.ts precedent's professions note), so the tick-path
// parity goldens are untouched.

import {
  applyBodyTrap,
  applyDribbleNudge,
  BB_BALL_RADIUS,
  BB_TRAP_MIN_BALL_SPEED,
  type BbBallKinematics,
  launchBall,
  stepBallPhysics,
} from '../boarball_ball';
import {
  BB_KICKOFF_SPOT,
  GOAL_LINE_NORTH_Z,
  GOAL_LINE_SOUTH_Z,
  PITCH_CENTER_X,
} from '../boarball_layout';
import { BOARBALL_MOB_TEMPLATE_ID, resolveBoarballKit } from '../content/boarball';
import { arenaOrigin, DUNGEON_FLOOR_Y, MOBS } from '../data';
import { createMob } from '../entity';
import type { ArenaMatch, BoarballState, PlayerMeta } from '../sim';
import type { SimContext } from '../sim_context';
import { dist2d, type Entity } from '../types';
import * as arenaMod from './arena';

// Tuning consts (duplicated in social/arena.ts: BOARBALL_COUNTDOWN,
// BOARBALL_SCORE_CAP, the FIESTA_COUNTDOWN precedent, keeping arena.ts's
// dependency on this module to zero).
export const BB_SCORE_CAP = 3; // first team to this many goals wins outright
export const BB_MATCH_DURATION = 180; // s; highest score wins at the whistle, tie = draw
// A player must be roughly a body's width from the ball to touch it (dribble
// nudge / body trap); PLAYER_BODY_RADIUS-ish without importing pathfind.ts for one number.
const BB_TOUCH_RADIUS = BB_BALL_RADIUS + 1.0;

const ballGroundY = DUNGEON_FLOOR_Y + BB_BALL_RADIUS;

function freshBallKinematics(): BbBallKinematics {
  return { x: BB_KICKOFF_SPOT.x, y: ballGroundY, z: BB_KICKOFF_SPOT.z, vx: 0, vy: 0, vz: 0 };
}

// A no-arg placeholder (the arena.ts startArenaMatch inline-object-literal
// precedent: createFiestaState() is also called before `match` exists).
// boarballKickoff does the real entity spawn once `match` exists.
export function createBoarballState(): BoarballState {
  return {
    scoreA: 0,
    scoreB: 0,
    ball: freshBallKinematics(),
    ballEntityId: -1,
    kickoffTeam: 'A',
  };
}

// Reset the ball to the kickoff spot (spawning its entity on the very first
// call), and record which team restarts. Called once at match start
// (concedingTeam null) and again after every goal (concedingTeam = the side
// that conceded, real-football convention: they take the restart).
export function boarballKickoff(
  ctx: SimContext,
  match: ArenaMatch,
  concedingTeam: 'A' | 'B' | null,
): void {
  const b = match.boarball!;
  if (concedingTeam !== null) b.kickoffTeam = concedingTeam;
  b.ball = freshBallKinematics();
  const origin = arenaOrigin(match.slot);
  const worldPos = { x: origin.x + b.ball.x, y: b.ball.y, z: origin.z + b.ball.z };
  if (b.ballEntityId < 0) {
    const template = MOBS[BOARBALL_MOB_TEMPLATE_ID];
    const id = ctx.nextId++;
    const e = createMob(id, template, 1, worldPos);
    e.hostile = false;
    ctx.addEntity(e);
    b.ballEntityId = id;
    return;
  }
  const e = ctx.entities.get(b.ballEntityId);
  if (!e) return;
  e.pos = worldPos;
  e.prevPos = { ...worldPos };
  ctx.rebucket(e);
}

// Swap the action bar to the class-agnostic sport kit for the bout, saving the
// real known-abilities list to restore on exit (the fiestaStandardize/
// fiestaRestoreChar precedent, but simpler: boarball changes no level/talents,
// only the ability bar).
export function boarballStandardize(meta: PlayerMeta, e: Entity): void {
  if (meta.boarballRestore) return;
  meta.boarballRestore = meta.known;
  meta.known = resolveBoarballKit();
  void e; // stats/talents are untouched; kept for signature symmetry with fiestaStandardize
}

export function boarballRestoreChar(meta: PlayerMeta, e: Entity): void {
  if (!meta.boarballRestore) return;
  meta.known = meta.boarballRestore;
  meta.boarballRestore = null;
  void e;
}

// Shoot: no target, auto-aimed at the enemy goal from the caster's current
// position (this fork's ability system has no ground-aim-reticle primitive,
// upstream's `targetMode: 'position'`; upstream's own Shoot handler already
// auto-aims at goal, so this drops only the extra charge-by-aim-distance
// nuance, not the auto-aim itself).
export function boarballShoot(ctx: SimContext, p: Entity, power: number, loft: number): void {
  const match = ctx.arenaMatches.get(p.id) ?? null;
  if (!match?.boarball) return;
  const b = match.boarball;
  const team = arenaMod.arenaTeamOf(ctx, match, p.id);
  if (!team) return;
  const origin = arenaOrigin(match.slot);
  const localX = p.pos.x - origin.x,
    localZ = p.pos.z - origin.z;
  if (
    dist2d({ x: localX, y: 0, z: localZ }, { x: b.ball.x, y: 0, z: b.ball.z }) > BB_TOUCH_RADIUS
  ) {
    ctx.error(p.id, "You're not close enough to the ball.");
    return;
  }
  // Team A attacks the north goal line, team B the south.
  const goalZ = team === 'A' ? GOAL_LINE_NORTH_Z : GOAL_LINE_SOUTH_Z;
  const dirX = PITCH_CENTER_X - localX;
  const dirZ = goalZ - localZ;
  launchBall(b.ball, dirX, dirZ, power, loft);
}

// Pass: an explicit friendly-target primitive (this fork's existing
// requiresTarget+targetType:'friendly'), standing in for upstream's
// aim-a-point-and-auto-lead-the-receiver Pass.
export function boarballPass(ctx: SimContext, p: Entity, target: Entity, power: number): void {
  if (target.id === p.id) {
    ctx.error(p.id, 'No teammate targeted.');
    return;
  }
  const match = ctx.arenaMatches.get(p.id) ?? null;
  if (!match?.boarball) return;
  const b = match.boarball;
  const origin = arenaOrigin(match.slot);
  const localX = p.pos.x - origin.x,
    localZ = p.pos.z - origin.z;
  if (
    dist2d({ x: localX, y: 0, z: localZ }, { x: b.ball.x, y: 0, z: b.ball.z }) > BB_TOUCH_RADIUS
  ) {
    ctx.error(p.id, "You're not close enough to the ball.");
    return;
  }
  const dirX = target.pos.x - origin.x - localX;
  const dirZ = target.pos.z - origin.z - localZ;
  launchBall(b.ball, dirX, dirZ, power, 0);
}

// The per-tick driver while the outer ArenaMatch is 'active'. Any live,
// present fighter standing on the ball nudges/traps it, then one physics step
// runs (banking off the pit walls), then a goal or the score cap / clock ends
// the bout via arena.ts's shared endArenaMatch (unranked: see the `ranked`
// flag there).
export function updateBoarballActive(ctx: SimContext, match: ArenaMatch): void {
  const b = match.boarball!;
  const e = ctx.entities.get(b.ballEntityId);
  if (!e) return;
  const origin = arenaOrigin(match.slot);

  for (const pid of arenaMod.arenaAllPids(match)) {
    const pe = ctx.entities.get(pid);
    if (!pe || pe.dead) continue;
    const localX = pe.pos.x - origin.x,
      localZ = pe.pos.z - origin.z;
    const d = Math.hypot(localX - b.ball.x, localZ - b.ball.z);
    if (d > BB_TOUCH_RADIUS) continue;
    const moverDx = pe.pos.x - pe.prevPos.x,
      moverDz = pe.pos.z - pe.prevPos.z;
    const ballSpeed = Math.hypot(b.ball.vx, b.ball.vz);
    if (ballSpeed >= BB_TRAP_MIN_BALL_SPEED) applyBodyTrap(b.ball, moverDx, moverDz, pe.facing);
    else applyDribbleNudge(b.ball, moverDx, moverDz);
  }

  const scoringTeam = stepBallPhysics(b.ball, ballGroundY);
  e.pos = { x: origin.x + b.ball.x, y: b.ball.y, z: origin.z + b.ball.z };
  e.prevPos = { ...e.pos };
  ctx.rebucket(e);

  if (scoringTeam) {
    if (scoringTeam === 'A') b.scoreA++;
    else b.scoreB++;
    for (const mPid of arenaMod.arenaAllPids(match)) {
      ctx.emit({ type: 'boarballGoal', team: scoringTeam, scorerName: '', pid: mPid });
      ctx.emit({
        type: 'boarballScore',
        a: b.scoreA,
        b: b.scoreB,
        limit: BB_SCORE_CAP,
        team: arenaMod.arenaTeamOf(ctx, match, mPid)!,
        pid: mPid,
      });
    }
    if (b.scoreA >= BB_SCORE_CAP || b.scoreB >= BB_SCORE_CAP) {
      ctx.endArenaMatch(match, b.scoreA > b.scoreB ? 'A' : 'B', 'defeat');
      return;
    }
    const concedingTeam = scoringTeam === 'A' ? 'B' : 'A';
    boarballKickoff(ctx, match, concedingTeam);
    for (const mPid of arenaMod.arenaAllPids(match)) {
      ctx.emit({ type: 'boarballKickoff', team: concedingTeam, pid: mPid });
    }
    return;
  }

  if (match.timer >= BB_MATCH_DURATION) {
    const winner = b.scoreA === b.scoreB ? null : b.scoreA > b.scoreB ? 'A' : 'B';
    ctx.endArenaMatch(match, winner, 'timeout');
  }
}
