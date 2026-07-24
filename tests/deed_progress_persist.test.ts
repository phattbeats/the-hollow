// Server persistence round-trip for the Book of Asphodelia engine (PHAA-744):
// deed progress + earned titles + the selected active title all ride the same
// CharacterState JSONB blob as quests (see quest_progress_persist.test.ts), so
// this mirrors that suite's leave/rejoin shape. No schema migration: `deedLog`/
// `deedsDone`/`earnedTitles`/`activeTitle` are optional CharacterState fields,
// so a pre-deed save (all four absent) must also load cleanly.

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('deed progress + earned titles survive logout/login (server save -> load)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restores in-progress deed counts, earned titles, and the active title after a rejoin', async () => {
    const server = new GameServer();
    const sim = (server as any).sim;

    const fc1 = fakeWs();
    const s1 = join(server, fc1, 201, 'Annihilator', null);
    const pid = s1.pid;
    const meta = sim.meta(pid);

    meta.deedLog.set('d_wolves', { deedId: 'd_wolves', counts: [2], state: 'active' });
    meta.deedsDone.add('d_boars');
    meta.earnedTitles.add('t_boarslayer');
    meta.activeTitle = 't_boarslayer';

    await server.leave(s1, 'disconnected');
    const saved = (saveCharacterAndMarketState as any).mock.calls.at(-1)?.[2] as CharacterState;
    expect(saved).toBeTruthy();

    const fc2 = fakeWs();
    const s2 = join(server, fc2, 201, 'Annihilator', saved);
    const meta2 = sim.meta(s2.pid);

    const dp2 = meta2.deedLog.get('d_wolves');
    expect(dp2?.state).toBe('active');
    expect(dp2?.counts[0]).toBe(2); // progress must NOT reset to 0
    expect(meta2.deedsDone.has('d_boars')).toBe(true);
    expect(meta2.earnedTitles.has('t_boarslayer')).toBe(true);
    expect(meta2.activeTitle).toBe('t_boarslayer');
  });

  it('drops the active title on rejoin if it is no longer in earnedTitles (tampered/stale save)', async () => {
    const server = new GameServer();
    const sim = (server as any).sim;

    const fc1 = fakeWs();
    const s1 = join(server, fc1, 202, 'Annihilator', null);
    const meta = sim.meta(s1.pid);
    meta.activeTitle = 't_never_earned'; // not in earnedTitles

    await server.leave(s1, 'disconnected');
    const saved = (saveCharacterAndMarketState as any).mock.calls.at(-1)?.[2] as CharacterState;

    const fc2 = fakeWs();
    const s2 = join(server, fc2, 202, 'Annihilator', saved);
    const meta2 = sim.meta(s2.pid);
    expect(meta2.activeTitle).toBeNull();
  });

  it('loads a pre-deed save (deedLog/deedsDone/earnedTitles/activeTitle absent) with empty defaults', async () => {
    const server = new GameServer();
    const sim = (server as any).sim;

    // Produce a real, complete save, then strip the four PHAA-744 fields to
    // simulate a save written before deeds existed.
    const fc1 = fakeWs();
    const s1 = join(server, fc1, 203, 'OldTimer', null);
    await server.leave(s1, 'disconnected');
    const saved = { ...(saveCharacterAndMarketState as any).mock.calls.at(-1)?.[2] } as Record<
      string,
      unknown
    >;
    delete saved.deedLog;
    delete saved.deedsDone;
    delete saved.earnedTitles;
    delete saved.activeTitle;

    const fc2 = fakeWs();
    const s = join(server, fc2, 203, 'OldTimer', saved as unknown as CharacterState);
    const meta = sim.meta(s.pid);
    expect(meta.deedLog.size).toBe(0);
    expect(meta.deedsDone.size).toBe(0);
    expect(meta.earnedTitles.size).toBe(0);
    expect(meta.activeTitle).toBeNull();
  });
});
