import { describe, expect, it, vi } from 'vitest';

const openPlaySession = vi.fn(async () => 1);
const closePlaySession = vi.fn(async () => {});

vi.mock('../server/db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  saveCharacterState: vi.fn(async () => {}),
  saveCharacterAndMarketState: vi.fn(async () => {}),
  openPlaySession: (...args: unknown[]) => openPlaySession(...(args as [])),
  closePlaySession: (...args: unknown[]) => closePlaySession(...(args as [])),
  insertChatLogs: vi.fn(async () => {}),
  markAccountQuestComplete: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  grantAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  revokeAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
}));

import { type ClientSession, GameServer } from '../server/game';
import { LINKDEAD_GRACE_MS, planJoin } from '../server/linkdead';
import {
  isTransientReconnectRejection,
  MAX_CONFLICT_REJECTIONS,
  RECONNECT_CONFLICT_ERROR,
} from '../src/net/reconnect_policy';

function fakeWs() {
  const ws: any = {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(() => {
      ws.readyState = 3;
    }),
  };
  return ws;
}

function expectJoined(result: ClientSession | { error: string }): ClientSession {
  if ('error' in result) throw new Error(result.error);
  return result;
}

// Simulate the transport-level drop: the real WebSocketServer close/error
// handlers in server/main.ts call game.socketClosed(session, ws).
function dropSocket(server: GameServer, session: ClientSession, ws: any): boolean {
  ws.readyState = 3; // CLOSED
  return server.socketClosed(session, ws);
}

describe('planJoin (pure decision core)', () => {
  const base = { accountId: 7, isGm: false, liveOtherSessions: 0, maxPerAccount: 1 };

  it('resumes the same character when its held session is linkdead and same-account', () => {
    expect(planJoin({ ...base, sameCharacter: { accountId: 7, linkdead: true } })).toEqual({
      action: 'resume',
    });
  });

  it('takes over the same character immediately when its session socket is still live, same account', () => {
    expect(planJoin({ ...base, sameCharacter: { accountId: 7, linkdead: false } })).toEqual({
      action: 'takeover',
    });
  });

  it('rejects a live session owned by a different account (never auto-takes-over)', () => {
    expect(planJoin({ ...base, sameCharacter: { accountId: 8, linkdead: false } })).toEqual({
      action: 'reject',
      error: 'character already in world',
    });
  });

  it('rejects a linkdead session owned by a different account (takeover stays explicit)', () => {
    expect(planJoin({ ...base, sameCharacter: { accountId: 8, linkdead: true } })).toEqual({
      action: 'reject',
      error: 'character already in world',
    });
  });

  it('lets a different character join over the account cap when the blockers are linkdead', () => {
    // liveOtherSessions excludes linkdead sessions; the caller displaces them
    expect(planJoin({ ...base, sameCharacter: null, liveOtherSessions: 0 })).toEqual({
      action: 'join',
    });
  });

  it('still enforces the per-account cap against live sessions', () => {
    expect(planJoin({ ...base, sameCharacter: null, liveOtherSessions: 1 })).toEqual({
      action: 'reject',
      error: 'too many characters on this account are already in the world',
    });
  });

  it('exempts GMs from the per-account cap', () => {
    expect(planJoin({ ...base, isGm: true, sameCharacter: null, liveOtherSessions: 1 })).toEqual({
      action: 'join',
    });
  });
});

describe('linkdead grace lifecycle', () => {
  it('holds the character in-world and online after a socket drop', () => {
    closePlaySession.mockClear();
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Heldin', 'warrior', null));

    expect(dropSocket(server, session, ws)).toBe(true);

    expect(session.linkdead).toBe(true);
    expect(session.left).toBe(false);
    expect(session.graceUntil).toBeGreaterThan(Date.now());
    expect(session.graceUntil).toBeLessThanOrEqual(Date.now() + LINKDEAD_GRACE_MS);
    // still in the world, still counted online, still online for friends
    expect(server.sim.entities.has(session.pid)).toBe(true);
    expect(server.clients.size).toBe(1);
    expect((server as any).sessionByCharacterId(101)).toBe(session);
    // the play-session analytics row stays open for the whole grace window
    expect(closePlaySession).not.toHaveBeenCalled();
  });

  it('zeroes held movement input at grace start', () => {
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Runner', 'warrior', null));
    server.handleMessage(
      session,
      JSON.stringify({ t: 'input', seq: 1, mi: { f: 1, b: 0, tl: 0, tr: 0, sl: 0, sr: 0, j: 0 } }),
    );
    expect(server.sim.meta(session.pid)?.moveInput.forward).toBe(true);

    dropSocket(server, session, ws);

    expect(server.sim.meta(session.pid)?.moveInput.forward).toBe(false);
  });

  it('resumes the held session on a same-character re-join: same pid, fresh socket, full re-sync', () => {
    const server = new GameServer();
    const setTrackingConnection = vi.spyOn((server as any).botDetector, 'setTrackingConnection');
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Comeback', 'warrior', null));
    expect(setTrackingConnection).not.toHaveBeenCalled();
    server.handleMessage(
      session,
      JSON.stringify({ t: 'input', seq: 9, mi: { f: 0, b: 0, tl: 0, tr: 0, sl: 0, sr: 0, j: 0 } }),
    );
    session.sentEnts.set(4242, {} as any);
    dropSocket(server, session, ws);
    expect(setTrackingConnection).toHaveBeenCalledTimes(1);
    expect(setTrackingConnection).toHaveBeenCalledWith(session.botTrackingContext, false);

    const ws2 = fakeWs();
    const resumeMeta = {
      ip: '203.0.113.45',
      userAgent: 'Mozilla/5.0 linkdead-test',
      clientSeed: 'seed-after-resume',
    };
    const resumed = expectJoined(
      server.join(ws2, 11, 101, 'Comeback', 'warrior', null, false, resumeMeta),
    );

    expect(resumed).toBe(session);
    expect(resumed.linkdead).toBe(false);
    expect(resumed.graceUntil).toBe(0);
    expect(resumed.ws).toBe(ws2);
    expect(setTrackingConnection).toHaveBeenCalledTimes(2);
    expect(setTrackingConnection).toHaveBeenLastCalledWith(
      session.botTrackingContext,
      true,
      resumeMeta,
    );
    // per-connection wire/input state restarts so the new client gets a full
    // snapshot and its input sequence (restarting at 1) is acked correctly
    expect(resumed.lastInputSeq).toBe(0);
    expect(resumed.sentEnts.size).toBe(0);
    expect(resumed.selfHeavyDirty).toBe(true);
    expect(resumed.lastWireRev).toBe(-1);
    // the fresh socket got its hello
    const hello = ws2.send.mock.calls
      .map((c: any[]) => JSON.parse(c[0]))
      .find((m: any) => m.t === 'hello');
    expect(hello).toMatchObject({ pid: session.pid, name: 'Comeback', cls: 'warrior' });
    // one session, one character: no duplicates were created
    expect(server.clients.size).toBe(1);
  });

  it('ignores a late close event from the pre-resume socket', () => {
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Latecl', 'warrior', null));
    dropSocket(server, session, ws);
    const ws2 = fakeWs();
    expectJoined(server.join(ws2, 11, 101, 'Latecl', 'warrior', null));

    // the old transport's close/error fires after the resume: must be a no-op
    expect(server.socketClosed(session, ws)).toBe(false);
    expect(session.linkdead).toBe(false);
    expect(session.ws).toBe(ws2);
  });

  it('does not resurrect a kicked session when its socket close lands afterwards', async () => {
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Kicked', 'warrior', null));

    server.disconnectAccount(11, 'moderation action');
    await vi.waitFor(() => {
      expect(session.left).toBe(true);
    });

    expect(server.socketClosed(session, ws)).toBe(false);
    expect(session.linkdead).toBe(false);
    expect(server.clients.size).toBe(0);
  });

  it('fully logs the character out when the grace window expires', async () => {
    closePlaySession.mockClear();
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Expired', 'warrior', null));
    dropSocket(server, session, ws);

    session.graceUntil = Date.now() - 1;
    (server as any).expireLinkdeadSessions();

    await vi.waitFor(() => {
      expect((server as any).sessionByCharacterId(101)).toBeNull();
    });
    expect(session.left).toBe(true);
    expect(server.sim.entities.has(session.pid)).toBe(false);
    expect(server.clients.size).toBe(0);
    expect(closePlaySession).toHaveBeenCalled();
  });

  it('leaves a not-yet-expired linkdead session alone on the expiry sweep', () => {
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Waiting', 'warrior', null));
    dropSocket(server, session, ws);

    (server as any).expireLinkdeadSessions();

    expect(session.left).toBe(false);
    expect(session.linkdead).toBe(true);
    expect(server.clients.size).toBe(1);
  });

  it("logging in on a different character displaces the account's linkdead session immediately", async () => {
    const server = new GameServer();
    const ws = fakeWs();
    const a = expectJoined(server.join(ws, 11, 101, 'Olda', 'warrior', null));
    dropSocket(server, a, ws);

    const b = expectJoined(server.join(fakeWs(), 11, 102, 'Newb', 'mage', null));

    expect(a.left).toBe(true);
    expect(b.characterId).toBe(102);
    expect(server.clients.size).toBe(1);
    await vi.waitFor(() => {
      expect((server as any).sessionByCharacterId(101)).toBeNull();
    });
    expect((server as any).sessionByCharacterId(102)).toBe(b);
    expect(server.sim.entities.has(a.pid)).toBe(false);
  });

  it("a linkdead session does not count against the account's live-session cap", () => {
    const server = new GameServer();
    const ws = fakeWs();
    const a = expectJoined(server.join(ws, 11, 101, 'Linka', 'warrior', null));
    dropSocket(server, a, ws);

    // a fresh live character now joins over the top of the linkdead one,
    // filling the fork's cap of 1 live session per account
    const b = expectJoined(server.join(fakeWs(), 11, 102, 'Liveb', 'mage', null));
    expect(server.join(fakeWs(), 11, 103, 'Livec', 'rogue', null)).toEqual({
      error: 'too many characters on this account are already in the world',
    });
    expect(b.characterId).toBe(102);
  });

  it('rejects a linkdead character for a different account, but takeover still works', async () => {
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Mine', 'warrior', null));
    dropSocket(server, session, ws);

    // another account cannot slide into the held session
    expect(server.join(fakeWs(), 12, 101, 'Mine', 'warrior', null)).toEqual({
      error: 'character already in world',
    });

    // the owner's explicit takeover tears the held session down
    expect(await server.takeOverCharacter(11, 101)).toBe('taken-over');
    await vi.waitFor(() => {
      expect((server as any).sessionByCharacterId(101)).toBeNull();
    });
    expectJoined(server.join(fakeWs(), 11, 101, 'Mine', 'warrior', null));
  });

  it('immediately takes over the same character for the same account while its socket is still live (no linkdead grace, no reject)', async () => {
    const server = new GameServer();
    const ws1 = fakeWs();
    const first = expectJoined(server.join(ws1, 11, 101, 'Reclaimed', 'warrior', null));
    expect(server.clients.size).toBe(1);

    // ws1 never dropped (still readyState 1): a plain re-auth used to reject
    // with 'character already in world' and require a separate REST takeover
    // call. It now admits immediately with a fresh session.
    const ws2 = fakeWs();
    const second = expectJoined(
      server.join(ws2, 11, 101, 'Reclaimed', 'warrior', null, false, { ip: '203.0.113.9' }),
    );

    expect(second).not.toBe(first);
    expect(second.pid).not.toBe(first.pid);
    expect(second.ws).toBe(ws2);
    expect(ws1.send).toHaveBeenCalledWith(
      JSON.stringify({ t: 'error', error: 'character taken over' }),
    );
    expect(ws1.close).toHaveBeenCalled();

    // Only the new session should end up resolvable by characterId, even
    // after the old session's async leave()/save resolves.
    await vi.waitFor(() => {
      expect((server as any).sessionByCharacterId(101)).toBe(second);
    });
    expect(server.clients.size).toBe(1);
    expect(server.clients.get(second.pid)).toBe(second);
  });

  it('a different account can never auto-take-over a live same-character session', () => {
    const server = new GameServer();
    const ws = fakeWs();
    expectJoined(server.join(ws, 11, 101, 'Guarded', 'warrior', null));

    expect(server.join(fakeWs(), 12, 101, 'Guarded', 'warrior', null)).toEqual({
      error: 'character already in world',
    });
    expect(ws.close).not.toHaveBeenCalled();
    expect(server.clients.size).toBe(1);
  });

  it('adjusts per-IP session counts when a resume arrives from a different IP', () => {
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(
      server.join(ws, 11, 101, 'Roamer', 'warrior', null, false, { ip: '198.51.100.1' }),
    );
    expect(server.countIpSessions('198.51.100.1')).toBe(1);
    dropSocket(server, session, ws);
    // the held session keeps its IP slot during grace (the hard cap counts it)
    expect(server.countIpSessions('198.51.100.1')).toBe(1);

    expectJoined(
      server.join(fakeWs(), 11, 101, 'Roamer', 'warrior', null, false, { ip: '198.51.100.2' }),
    );

    expect(server.countIpSessions('198.51.100.1')).toBe(0);
    expect(server.countIpSessions('198.51.100.2')).toBe(1);
  });

  it('keepalive sweep pings live sessions and holds a pong-silent socket linkdead', () => {
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Blackhole', 'warrior', null));

    // first sweep: ping goes out, pong now outstanding
    server.pingLiveSessions();
    expect(ws.ping).toHaveBeenCalledTimes(1);
    expect(session.awaitingPong).toBe(true);

    // the pong arrives (main.ts wires ws 'pong' to clear the flag): the next
    // sweep pings again instead of terminating
    session.awaitingPong = false;
    server.pingLiveSessions();
    expect(ws.ping).toHaveBeenCalledTimes(2);
    expect(ws.terminate).not.toHaveBeenCalled();

    // no pong before the following sweep: black-holed socket, terminated
    // into the linkdead grace (never a full logout)
    server.pingLiveSessions();
    expect(ws.terminate).toHaveBeenCalledTimes(1);
    expect(session.linkdead).toBe(true);
    expect(session.left).toBe(false);
    expect(server.clients.size).toBe(1);
  });

  it('re-arms instead of mass-terminating when the sweep itself was delayed by a stall', () => {
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Stalled', 'warrior', null));

    server.pingLiveSessions();
    expect(ws.ping).toHaveBeenCalledTimes(1);
    expect(session.awaitingPong).toBe(true);

    // Simulate a long event-loop stall between sweeps: the next sweep runs
    // far later than WS_KEEPALIVE_PING_MS would predict, so the still-missing
    // pong is not evidence of a dead socket.
    (server as any).lastKeepaliveSweepAt = Date.now() - 10 * 60 * 1000;
    server.pingLiveSessions();

    expect(ws.terminate).not.toHaveBeenCalled();
    expect(session.linkdead).toBe(false);
    expect(ws.ping).toHaveBeenCalledTimes(2);
    expect(session.awaitingPong).toBe(true);

    // The very next sweep (normal cadence again) still terminates a socket
    // that genuinely never answers.
    server.pingLiveSessions();
    expect(ws.terminate).toHaveBeenCalledTimes(1);
    expect(session.linkdead).toBe(true);
  });

  it('a throw for one session during the sweep does not skip the rest', () => {
    const server = new GameServer();
    const bad = fakeWs();
    const badSession = expectJoined(server.join(bad, 11, 101, 'Thrower', 'warrior', null));
    const good = fakeWs();
    const goodSession = expectJoined(server.join(good, 12, 102, 'Fine', 'mage', null));
    badSession.awaitingPong = true;
    goodSession.awaitingPong = true;
    const socketClosedSpy = vi
      .spyOn(server, 'socketClosed')
      .mockImplementationOnce(() => {
        throw new Error('boom');
      })
      .mockImplementation((session, ws) =>
        GameServer.prototype.socketClosed.call(server, session, ws),
      );

    server.pingLiveSessions();

    // the first (throwing) session still had terminate attempted; the second
    // session, iterated after it, still got its own liveness check
    expect(bad.terminate).toHaveBeenCalledTimes(1);
    expect(good.terminate).toHaveBeenCalledTimes(1);
    expect(goodSession.linkdead).toBe(true);
    socketClosedSpy.mockRestore();
  });

  it('keepalive sweep leaves linkdead sessions alone and resume clears the pong flag', () => {
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Pongreset', 'warrior', null));
    server.pingLiveSessions();
    dropSocket(server, session, ws);

    server.pingLiveSessions();
    expect(ws.terminate).not.toHaveBeenCalled();

    const resumed = expectJoined(server.join(fakeWs(), 11, 101, 'Pongreset', 'warrior', null));
    expect(resumed.awaitingPong).toBe(false);
  });

  it('resume sends no self entered-the-world notice (the player never saw themselves leave)', () => {
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Quietback', 'warrior', null));
    dropSocket(server, session, ws);

    const ws2 = fakeWs();
    expectJoined(server.join(ws2, 11, 101, 'Quietback', 'warrior', null));

    const frames = ws2.send.mock.calls.map((c: any[]) => JSON.parse(c[0]));
    const enteredNotice = frames.find(
      (f: any) =>
        f.t === 'events' && f.list?.some((ev: any) => String(ev.text ?? '').includes('entered')),
    );
    expect(enteredNotice).toBeUndefined();
  });

  it('skips snapshot building for linkdead sessions', () => {
    const server = new GameServer();
    const ws = fakeWs();
    const session = expectJoined(server.join(ws, 11, 101, 'Quiet', 'warrior', null));
    dropSocket(server, session, ws);
    ws.send.mockClear();

    (server as any).broadcastSnapshots();

    expect(ws.send).not.toHaveBeenCalled();
  });
});

describe('GameServer.livenessStatus (backs /livez, /readyz)', () => {
  it('reads healthy right after construction (cold-boot backstop)', () => {
    const server = new GameServer();
    const status = server.livenessStatus();
    expect(status.ok).toBe(true);
    expect(status.sinceLastTickMs).toBeLessThan(1000);
  });

  it('reads unhealthy once the last completed tick is stale', () => {
    const server = new GameServer();
    (server as any).lastTickCompletedAtMs = Date.now() - 60_000;
    const status = server.livenessStatus();
    expect(status.ok).toBe(false);
    expect(status.sinceLastTickMs).toBeGreaterThanOrEqual(60_000);
  });
});

describe('reconnect policy (client-side conflict tolerance)', () => {
  it('tolerates the in-world conflict only while a reconnect is in flight', () => {
    expect(isTransientReconnectRejection(RECONNECT_CONFLICT_ERROR, 1, 0)).toBe(true);
    // not reconnecting (a fresh char-select join): the takeover prompt path
    expect(isTransientReconnectRejection(RECONNECT_CONFLICT_ERROR, 0, 0)).toBe(false);
  });

  it('never tolerates any other server rejection', () => {
    expect(isTransientReconnectRejection('character taken over', 3, 0)).toBe(false);
    expect(isTransientReconnectRejection('not authenticated', 3, 0)).toBe(false);
    expect(isTransientReconnectRejection(undefined, 3, 0)).toBe(false);
  });

  it('gives up after the bounded number of conflict rejections (a real takeover stays fatal)', () => {
    expect(
      isTransientReconnectRejection(RECONNECT_CONFLICT_ERROR, 5, MAX_CONFLICT_REJECTIONS - 1),
    ).toBe(true);
    expect(
      isTransientReconnectRejection(RECONNECT_CONFLICT_ERROR, 5, MAX_CONFLICT_REJECTIONS),
    ).toBe(false);
  });

  it('matches the exact wire string planJoin sends', () => {
    // The same-account/live-socket case now auto-takes-over instead of
    // rejecting (see the planJoin describe block above); the wire string
    // this policy tolerates only fires for a different account's live hold.
    const plan = planJoin({
      accountId: 7,
      isGm: false,
      sameCharacter: { accountId: 8, linkdead: false },
      liveOtherSessions: 0,
      maxPerAccount: 1,
    });
    expect(plan).toEqual({ action: 'reject', error: RECONNECT_CONFLICT_ERROR });
  });
});
