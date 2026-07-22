import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the db layer so no Postgres is needed.
vi.mock('../server/db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  saveCharacterState: vi.fn(async () => {}),
  saveCharacterAndMarketState: vi.fn(async () => {}),
  openPlaySession: vi.fn(async () => 1),
  closePlaySession: vi.fn(async () => {}),
  insertChatLogs: vi.fn(async () => {}),
  markAccountQuestComplete: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  grantAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
}));

import { saveCharacterAndMarketState } from '../server/db';
import { type ClientSession, GameServer } from '../server/game';
import type { CharacterState } from '../src/sim/sim';
import type { PlayerClass } from '../src/sim/types';

function fakeWs() {
  const sent: any[] = [];
  return { sent, ws: { readyState: 1, send: (p: string) => sent.push(JSON.parse(p)) } };
}

function join(
  server: GameServer,
  fc: ReturnType<typeof fakeWs>,
  id: number,
  name: string,
  state: CharacterState | null,
  cls: PlayerClass = 'warrior',
): ClientSession {
  const s = server.join(fc.ws as any, id, id, name, cls, state);
  if ('error' in s) throw new Error(s.error);
  s.blockListLoaded = true;
  return s;
}

describe('Book of Asphodelia deed progress survives logout/login (PHAA-744)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restores in-progress deed counts, completed deed ids, and earned titles after a rejoin', async () => {
    const server = new GameServer();
    const sim = (server as any).sim;

    const fc1 = fakeWs();
    const s1 = join(server, fc1, 201, 'Deedbound', null);
    const pid = s1.pid;
    const meta = sim.meta(pid);

    meta.deedLog.set('deed_test_progress', { deedId: 'deed_test_progress', counts: [2] });
    meta.deedsDone.add('deed_test_completed');
    meta.earnedTitles.add('title_test_earned');

    await server.leave(s1, 'disconnected');
    const saved = (saveCharacterAndMarketState as any).mock.calls.at(-1)?.[2] as CharacterState;
    expect(saved).toBeTruthy();
    expect(saved.deedLog).toEqual([{ deedId: 'deed_test_progress', counts: [2] }]);
    expect(saved.deedsDone).toEqual(['deed_test_completed']);
    expect(saved.earnedTitles).toEqual(['title_test_earned']);

    const fc2 = fakeWs();
    const s2 = join(server, fc2, 201, 'Deedbound', saved);
    const meta2 = sim.meta(s2.pid);

    expect(meta2.deedLog.get('deed_test_progress')).toEqual({
      deedId: 'deed_test_progress',
      counts: [2],
    });
    expect(meta2.deedsDone.has('deed_test_completed')).toBe(true);
    expect(meta2.earnedTitles.has('title_test_earned')).toBe(true);
  });

  it('loads cleanly for a pre-PHAA-744 save with no deed fields at all', async () => {
    const server = new GameServer();
    const sim = (server as any).sim;

    const fc1 = fakeWs();
    const s1 = join(server, fc1, 202, 'Elder', null);
    await server.leave(s1, 'disconnected');
    const saved = (saveCharacterAndMarketState as any).mock.calls.at(-1)?.[2] as CharacterState;
    // Simulate a legacy save from before this child landed.
    const legacy = { ...saved };
    delete (legacy as any).deedLog;
    delete (legacy as any).deedsDone;
    delete (legacy as any).earnedTitles;

    const fc2 = fakeWs();
    const s2 = join(server, fc2, 202, 'Elder', legacy);
    const meta2 = sim.meta(s2.pid);

    expect(meta2.deedLog.size).toBe(0);
    expect(meta2.deedsDone.size).toBe(0);
    expect(meta2.earnedTitles.size).toBe(0);
  });
});
