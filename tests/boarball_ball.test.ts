import { describe, expect, it } from 'vitest';
import {
  applyBodyTrap,
  applyDribbleNudge,
  BB_BALL_RADIUS,
  type BbBallKinematics,
  launchBall,
  stepBallPhysics,
} from '../src/sim/boarball_ball';
import {
  GOAL_LINE_NORTH_Z,
  GOAL_LINE_SOUTH_Z,
  GOAL_X_MAX,
  GOAL_X_MIN,
  PITCH,
} from '../src/sim/boarball_layout';

const GROUND_Y = BB_BALL_RADIUS;

function ball(overrides: Partial<BbBallKinematics> = {}): BbBallKinematics {
  return { x: 0, y: GROUND_Y, z: 0, vx: 0, vy: 0, vz: 0, ...overrides };
}

describe('boarball ball physics', () => {
  it('scores for team A when the ball crosses the north goal line under the bar', () => {
    const b = ball({ z: GOAL_LINE_NORTH_Z - 0.2, vz: 20 });
    const scorer = stepBallPhysics(b, GROUND_Y);
    expect(scorer).toBe('A');
  });

  it('scores for team B when the ball crosses the south goal line under the bar', () => {
    const b = ball({ z: GOAL_LINE_SOUTH_Z + 0.2, vz: -20 });
    const scorer = stepBallPhysics(b, GROUND_Y);
    expect(scorer).toBe('B');
  });

  it('does not score when the ball crosses outside the goal posts (banks off the board instead)', () => {
    const b = ball({ x: GOAL_X_MAX + 3, z: GOAL_LINE_NORTH_Z - 0.2, vz: 20 });
    const scorer = stepBallPhysics(b, GROUND_Y);
    expect(scorer).toBeNull();
    // banked off the north board: z stays inside the pitch, vz flips sign
    expect(b.z).toBeLessThanOrEqual(PITCH.zMax);
    expect(b.vz).toBeLessThan(0);
  });

  it('does not score when the ball sails over the crossbar', () => {
    const b = ball({ z: GOAL_LINE_NORTH_Z - 0.2, y: GROUND_Y + 5, vz: 20 });
    const scorer = stepBallPhysics(b, GROUND_Y);
    expect(scorer).toBeNull();
  });

  it('banks off the east/west side boards and stays in bounds', () => {
    const b = ball({ x: PITCH.xMax - 0.1, z: 0, vx: 15 });
    for (let i = 0; i < 5; i++) stepBallPhysics(b, GROUND_Y);
    expect(b.x).toBeLessThanOrEqual(PITCH.xMax + 1e-6);
    expect(b.vx).toBeLessThan(15); // restitution bled off some speed
  });

  it('a stationary ball on goal-mouth line does not falsely register a score', () => {
    const b = ball({ x: (GOAL_X_MIN + GOAL_X_MAX) / 2, z: 0 });
    const scorer = stepBallPhysics(b, GROUND_Y);
    expect(scorer).toBeNull();
  });

  it('launchBall sets ground speed along the aimed direction, capped and normalized', () => {
    const b = ball();
    launchBall(b, 0, 1, 20, 5);
    expect(b.vx).toBeCloseTo(0, 5);
    expect(b.vz).toBeCloseTo(20, 5);
    expect(b.vy).toBe(5);
  });

  it('dribble nudge carries the ball with a moving player, not a stationary one', () => {
    const b = ball({ vx: 0, vz: 0 });
    expect(applyDribbleNudge(b, 0, 0)).toBe(false);
    expect(applyDribbleNudge(b, 0.35, 0)).toBe(true); // ~7yd/s over DT=1/20
    expect(b.vx).toBeGreaterThan(0);
  });

  it('body trap collapses a fast ball to a slow controlled roll', () => {
    const b = ball({ vx: 20, vz: 0 });
    const trapped = applyBodyTrap(b, 0.1, 0, 0);
    expect(trapped).toBe(true);
    expect(Math.hypot(b.vx, b.vz)).toBeLessThan(5);
  });

  it('body trap does not fire on a slow (dribble-speed) ball', () => {
    const b = ball({ vx: 2, vz: 0 });
    expect(applyBodyTrap(b, 0.1, 0, 0)).toBe(false);
  });
});
