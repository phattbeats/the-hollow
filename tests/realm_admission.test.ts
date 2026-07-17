import { describe, expect, it, vi } from 'vitest';
import { isRealmFull } from '../server/realm_admission';

describe('isRealmFull (pure decision core)', () => {
  it('refuses once online reaches the cap', () => {
    expect(isRealmFull({ online: 5, cap: 5, isAdmin: false })).toBe(true);
    expect(isRealmFull({ online: 4, cap: 5, isAdmin: false })).toBe(false);
  });

  it('exempts admins regardless of population', () => {
    expect(isRealmFull({ online: 999, cap: 5, isAdmin: true })).toBe(false);
  });

  it('a zero or negative cap disables the check', () => {
    expect(isRealmFull({ online: 999, cap: 0, isAdmin: false })).toBe(false);
    expect(isRealmFull({ online: 999, cap: -1, isAdmin: false })).toBe(false);
  });
});

// MAX_PLAYERS_PER_REALM is read from process.env at server/game.ts import
// time, so it must be set before that module (or anything importing it) is
// first loaded. Isolated in its own file for that reason.
vi.mock('../server/db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  saveCharacterState: vi.fn(async () => {}),
  saveCharacterAndMarketState: vi.fn(async () => {}),
  openPlaySession: vi.fn(async () => 1),
  closePlaySession: vi.fn(async () => {}),
  insertChatLogs: vi.fn(async () => {}),
  markAccountQuestComplete: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  grantAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  revokeAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
}));
process.env.MAX_PLAYERS_PER_REALM = '2';
const { GameServer } = await import('../server/game');

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

describe('realm admission cap wired into GameServer.join', () => {
  it('refuses a fresh join once the realm is at the configured cap', () => {
    const server = new GameServer();
    const a = server.join(fakeWs(), 1, 101, 'A', 'warrior', null);
    const b = server.join(fakeWs(), 2, 102, 'B', 'mage', null);
    expect('error' in a).toBe(false);
    expect('error' in b).toBe(false);

    const c = server.join(fakeWs(), 3, 103, 'C', 'rogue', null);
    expect(c).toEqual({ error: 'realm is full' });
    expect(server.clients.size).toBe(2);
  });

  it('exempts GM joins from the cap', () => {
    const server = new GameServer();
    server.join(fakeWs(), 1, 101, 'A', 'warrior', null);
    server.join(fakeWs(), 2, 102, 'B', 'mage', null);

    const gm = server.join(fakeWs(), 3, 103, 'GM', 'rogue', null, true);
    expect('error' in gm).toBe(false);
  });

  it('a same-account takeover is not blocked by an already-full realm', async () => {
    const server = new GameServer();
    const ws1 = fakeWs();
    server.join(ws1, 1, 101, 'A', 'warrior', null);
    server.join(fakeWs(), 2, 102, 'B', 'mage', null);

    // account 1 reconnects on the same character while the realm sits at cap
    const retry = server.join(fakeWs(), 1, 101, 'A', 'warrior', null);
    expect('error' in retry).toBe(false);
    expect(server.clients.size).toBe(2);
  });
});
