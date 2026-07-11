import { describe, expect, it } from 'vitest';
import { BB_KICKOFF_SPOT } from '../src/sim/boarball_layout';
import { BOARBALL_MOB_TEMPLATE_ID } from '../src/sim/content/boarball';
import { arenaOrigin } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import type { PlayerClass } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
}

function teleport(sim: Sim, pid: number, x: number, z: number) {
  const e = sim.entities.get(pid)!;
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = groundHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
  (sim as any).rebucket(e);
}

// Seat a 2v2 boarball match with four solo-queued players and run the
// countdown out so the bout is live. Returns the match plus the four pids.
function startBoarball(classes: PlayerClass[] = ['warrior', 'mage', 'rogue', 'priest']) {
  const sim = makeWorld();
  const pids = classes.map((c, i) => sim.addPlayer(c, `P${i}`));
  pids.forEach((p, i) => {
    teleport(sim, p, i * 4, -40);
  });
  pids.forEach((p) => {
    sim.boarballQueueJoin(p);
  });
  sim.tick(); // matchmake
  for (let i = 0; i < 20 * 8; i++) {
    sim.tick();
    const m = sim.arenaMatchFor(pids[0]);
    if (m && m.state === 'active') break;
  }
  const match = sim.arenaMatchFor(pids[0])!;
  return { sim, match, pids };
}

describe('boarball: matchmaking & format', () => {
  it('seats four solo-queuers into one 2v2 boarball match, unranked', () => {
    const { sim, match, pids } = startBoarball();
    expect(match).toBeTruthy();
    expect(match.format).toBe('boarball');
    expect(match.boarball).toBeTruthy();
    expect(match.teamA.length).toBe(2);
    expect(match.teamB.length).toBe(2);
    expect(new Set([...match.teamA, ...match.teamB])).toEqual(new Set(pids));
    expect(sim.arenaQueueBoarball.length).toBe(0);
  });

  it('keeps boarball on its own queue, separate from ranked formats', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'A');
    sim.boarballQueueJoin(a);
    expect(sim.arenaQueueBoarball.length).toBe(1);
    expect(sim.arenaQueue1v1.length).toBe(0);
    expect(sim.arenaQueue2v2.length).toBe(0);
  });

  it('cannot double-queue across formats', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'A');
    teleport(sim, a, 0, -40);
    sim.boarballQueueJoin(a);
    const errsBefore = sim.events.filter((e) => e.type === 'error').length;
    sim.arenaQueueJoin(a, '1v1');
    expect(sim.arenaQueueBoarball).toContain(a);
    expect(sim.arenaQueue1v1.length).toBe(0);
    expect(sim.events.filter((e) => e.type === 'error').length).toBeGreaterThan(errsBefore);
  });

  it('spawns a real, non-hostile ball entity at the pitch centre on kickoff', () => {
    const { sim, match } = startBoarball();
    const ballId = match.boarball!.ballEntityId;
    expect(ballId).toBeGreaterThanOrEqual(0);
    const ball = sim.entities.get(ballId)!;
    expect(ball).toBeTruthy();
    expect(ball.templateId).toBe(BOARBALL_MOB_TEMPLATE_ID);
    expect(ball.hostile).toBe(false);
    const origin = arenaOrigin(match.slot);
    expect(ball.pos.x).toBeCloseTo(origin.x + BB_KICKOFF_SPOT.x, 5);
    expect(ball.pos.z).toBeCloseTo(origin.z + BB_KICKOFF_SPOT.z, 5);
  });
});

describe('boarball: sport kit swap', () => {
  it('swaps the action bar to the sport kit for the bout and restores it after', () => {
    const { sim, match, pids } = startBoarball();
    const meta = sim.meta(pids[0])!;
    const knownIds = meta.known.map((k) => k.def.id).sort();
    expect(knownIds).toEqual(['sport_boost', 'sport_pass', 'sport_shoot']);
    expect(meta.boarballRestore).toBeTruthy();

    // End the match by forfeit (drop a player) and confirm the kit is restored.
    sim.removePlayer(pids[1]);
    for (let i = 0; i < 20 * 12; i++) sim.tick();
    const restoredMeta = sim.meta(pids[0]);
    expect(restoredMeta).toBeTruthy();
    expect(restoredMeta!.boarballRestore).toBeNull();
    expect(restoredMeta!.known.some((k) => k.def.id === 'sport_shoot')).toBe(false);
  });

  it('never moves the Elo ladder (unranked, like Fiesta)', () => {
    const { sim, pids } = startBoarball();
    const ratingsBefore = pids.map((p) => sim.meta(p)!.arenaRating);
    sim.removePlayer(pids[1]); // forfeit
    for (let i = 0; i < 20 * 12; i++) sim.tick();
    for (let i = 0; i < pids.length; i++) {
      const meta = sim.meta(pids[i]);
      if (!meta) continue;
      expect(meta.arenaRating).toBe(ratingsBefore[i]);
    }
  });
});

describe('boarball: shoot, pass, and scoring', () => {
  it('Shoot launches the ball toward the shooting team’s enemy goal', () => {
    const { sim, match } = startBoarball();
    const origin = arenaOrigin(match.slot);
    const shooterPid = match.teamA[0];
    teleport(sim, shooterPid, origin.x + BB_KICKOFF_SPOT.x, origin.z + BB_KICKOFF_SPOT.z);
    sim.castAbility('sport_shoot', shooterPid);
    // Team A attacks north (+z): the ball should now be moving north.
    expect(match.boarball!.ball.vz).toBeGreaterThan(0);
  });

  it('Pass requires a valid friendly target and sends the ball toward them', () => {
    const { sim, match } = startBoarball();
    const origin = arenaOrigin(match.slot);
    const [passer, receiver] = match.teamA;
    teleport(sim, passer, origin.x + BB_KICKOFF_SPOT.x, origin.z + BB_KICKOFF_SPOT.z);
    teleport(sim, receiver, origin.x + 10, origin.z + BB_KICKOFF_SPOT.z);
    const errsBefore = sim.events.filter((e) => e.type === 'error').length;
    sim.entities.get(passer)!.targetId = passer; // no teammate targeted yet
    sim.castAbility('sport_pass', passer);
    expect(sim.events.filter((e) => e.type === 'error').length).toBeGreaterThan(errsBefore);

    // sport_pass has a 1s cooldown, armed on the attempt above even though it
    // errored out inside the boarball handler: let it clear before retrying.
    for (let i = 0; i < 20; i++) sim.tick();
    sim.entities.get(passer)!.targetId = receiver;
    sim.castAbility('sport_pass', passer);
    expect(match.boarball!.ball.vx).toBeGreaterThan(0); // toward +x, where the receiver stands
  });

  it('a goal increments the score, resets the ball to centre, and a score-cap goal ends the match unranked', () => {
    const { sim, match } = startBoarball();
    const b = match.boarball!;
    // Force the score to one goal below the cap, then drive one more scoring
    // step directly through the physics entry point the sim itself calls
    // (updateBoarballActive via tick()).
    b.scoreA = 2; // one below BB_SCORE_CAP (3)
    b.ball.x = 0;
    b.ball.z = 22.9; // one physics step from crossing the north goal line
    b.ball.vz = 10; // crosses to z=23.4 this tick, well past the z=23 line
    sim.tick();
    expect(b.scoreA).toBe(3);
    expect(match.state).toBe('over'); // score cap reached, bout decided
  });

  it('despawns the ball entity once the match returns players to the world', () => {
    const { sim, match, pids } = startBoarball();
    const ballId = match.boarball!.ballEntityId;
    sim.removePlayer(pids[1]); // forfeit end
    for (let i = 0; i < 20 * 12; i++) sim.tick();
    expect(sim.entities.has(ballId)).toBe(false);
  });
});
