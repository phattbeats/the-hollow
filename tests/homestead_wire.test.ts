// Homestead v0 acceptance at the wire level: two accounts claim distinct
// open-world plots, both mirror to both clients through the self snapshot,
// and ownership survives a "restart" (serialize -> fresh server ->
// loadHomestead). Scaffolding mirrors tests/housing_wire.test.ts.

import { describe, expect, it, vi } from 'vitest';

// Mock the db layer so no Postgres is needed; the wire codec is under test.
vi.mock('../server/db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  saveCharacterState: vi.fn(async () => {}),
  openPlaySession: vi.fn(async () => 1),
  closePlaySession: vi.fn(async () => {}),
  insertChatLogs: vi.fn(async () => {}),
  walletForAccount: vi.fn(async () => null),
  markAccountQuestComplete: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  grantAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  loadMarketState: vi.fn(async () => null),
  saveMarketState: vi.fn(async () => {}),
  loadHousingState: vi.fn(async () => null),
  saveHousingState: vi.fn(async () => {}),
  loadHomesteadState: vi.fn(async () => null),
  saveHomesteadState: vi.fn(async () => {}),
}));

import { type ClientSession, GameServer } from '../server/game';
import { ClientWorld } from '../src/net/online';
import { HOLLOW_QUEST_ORDER } from '../src/sim/content/hollow';
import type { PlayerClass } from '../src/sim/types';

interface FakeClient {
  sent: any[];
  ws: any;
}

function fakeWs(): FakeClient {
  const sent: any[] = [];
  return { sent, ws: { readyState: 1, send: (payload: string) => sent.push(JSON.parse(payload)) } };
}

function lastSnap(sent: any[]): any {
  for (let i = sent.length - 1; i >= 0; i--) {
    if (sent[i].t === 'snap') return sent[i];
  }
  return null;
}

function joinServer(
  server: GameServer,
  fc: FakeClient,
  accountId: number,
  name: string,
  cls: PlayerClass = 'warrior',
): ClientSession {
  const session = server.join(fc.ws, accountId, accountId, name, cls, null);
  if ('error' in session) throw new Error(session.error);
  session.blockListLoaded = true;
  return session;
}

function broadcast(server: GameServer): void {
  (server as any).broadcastSnapshots();
}

// Minimal ClientWorld to drive applySnapshot directly (no WebSocket).
function bareClient(pid: number): ClientWorld {
  const c: any = Object.create(ClientWorld.prototype);
  c.cfg = { seed: 20061, playerClass: 'warrior' };
  c.entities = new Map();
  c.playerId = pid;
  c.ownPlayerId = pid;
  c.ownPlayerClass = 'warrior';
  c.spectating = null;
  c.moveInput = {};
  c.inventory = [];
  c.vendorBuyback = [];
  c.equipment = {};
  c.accountCosmetics = { completedQuestIds: [], mechChromaIds: [] };
  c.copper = 0;
  c.xp = 0;
  c.known = [];
  c.questLog = new Map();
  c.questsDone = new Set();
  c.pendingQuestCommands = new Map();
  c.partyInfo = null;
  c.tradeInfo = null;
  c.duelInfo = null;
  c.housingInfo = null;
  c.homesteadInfo = null;
  c.lastSnapAt = 0;
  c.snapInterval = 50;
  c.missingSince = new Map();
  c.pendingFacingDelta = 0;
  c.connected = true;
  c.eventQueue = [];
  c.mouselookFacing = null;
  c.lastInputSentAt = 0;
  c.lastInputSig = '';
  c.inputSeq = 0;
  c.pendingInputSeqSentAt = new Map();
  c.ackedInputSeq = 0;
  c.inputEchoSamples = [];
  c.spectateFacingPending = false;
  c.pendingSpectateFacing = null;
  return c as ClientWorld;
}

function grantAndStand(server: GameServer, pid: number, pos: { x: number; z: number }): void {
  const sim = server.sim;
  const meta = sim.players.get(pid)!;
  for (const qid of HOLLOW_QUEST_ORDER) meta.questsDone.add(qid);
  const e = sim.entities.get(pid)!;
  e.pos.x = pos.x;
  e.pos.z = pos.z;
  e.prevPos = { ...e.pos };
}

const SPOT_A = { x: -85, z: -220 };
const SPOT_B = { x: -90, z: -260 };

describe('homestead over the wire', () => {
  it('two accounts claim distinct plots and both mirror to both clients', () => {
    const server = new GameServer();
    const fcA = fakeWs();
    const fcB = fakeWs();
    const a = joinServer(server, fcA, 1, 'Aki');
    const b = joinServer(server, fcB, 2, 'Bea', 'mage');

    grantAndStand(server, a.pid, SPOT_A);
    server.sim.chat('/homestead claim', a.pid);
    grantAndStand(server, b.pid, SPOT_B);
    server.sim.chat('/homestead claim', b.pid);

    broadcast(server);
    for (const [fc, session, own, other] of [
      [fcA, a, 'Aki', 'Bea'],
      [fcB, b, 'Bea', 'Aki'],
    ] as const) {
      const client = bareClient(session.pid);
      (client as any).applySnapshot(lastSnap(fc.sent));
      const info = client.homesteadInfo!;
      expect(info.plots).toHaveLength(2);
      expect(info.plots.map((p) => p.ownerName).sort()).toEqual([...['Aki', 'Bea']].sort());
      expect(info.plots.find((p) => p.ownerName === own)?.mine).toBe(true);
      expect(info.plots.find((p) => p.ownerName === other)?.mine).toBe(false);
    }
  });

  it('ownership survives a server restart via serialize/loadHomestead', () => {
    const server = new GameServer();
    const fc = fakeWs();
    const s = joinServer(server, fc, 7, 'Keep');
    grantAndStand(server, s.pid, SPOT_A);
    server.sim.chat('/homestead claim', s.pid);
    const blob = JSON.parse(JSON.stringify(server.sim.serializeHomestead()));

    const server2 = new GameServer();
    server2.sim.loadHomestead(blob);
    const fc2 = fakeWs();
    // same account id 7, a different character/session after "restart"
    const s2 = joinServer(server2, fc2, 7, 'Keep');
    broadcast(server2);
    const client = bareClient(s2.pid);
    (client as any).applySnapshot(lastSnap(fc2.sent));
    const plot = client.homesteadInfo!.plots.find((p) => p.x === SPOT_A.x && p.z === SPOT_A.z)!;
    expect(plot.ownerName).toBe('Keep');
    expect(plot.mine).toBe(true);
  });
});
