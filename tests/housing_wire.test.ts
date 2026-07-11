// Housing v0 acceptance at the wire level: two accounts claim distinct plots,
// both houses (owner name + objects) mirror to both clients through the self
// snapshot, and ownership survives a "restart" (serialize -> fresh server ->
// loadHousing). Scaffolding mirrors tests/snapshots.test.ts.

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
}));

import { type ClientSession, GameServer } from '../server/game';
import { ClientWorld } from '../src/net/online';
import { HOLLOW_HOUSE_PLOTS } from '../src/sim/content/hollow';
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

function standOnPlot(server: GameServer, pid: number, plotIndex: number): void {
  const sim = server.sim;
  sim.enterDungeon('the_hollow', pid);
  const info = sim.housingInfoFor(pid)!;
  const plot = HOLLOW_HOUSE_PLOTS[plotIndex];
  const e = sim.entities.get(pid)!;
  e.pos.x = info.origin!.x + plot.x;
  e.pos.z = info.origin!.z + plot.z;
  e.prevPos = { ...e.pos };
}

describe('housing over the wire', () => {
  it('two accounts claim distinct plots and both mirror to both clients', () => {
    const server = new GameServer();
    const fcA = fakeWs();
    const fcB = fakeWs();
    const a = joinServer(server, fcA, 1, 'Aki');
    const b = joinServer(server, fcB, 2, 'Bea', 'mage');

    standOnPlot(server, a.pid, 0);
    server.sim.housingClaim(a.pid);
    server.sim.housingPlace(0, 'lantern', a.pid);
    standOnPlot(server, b.pid, 5);
    server.sim.housingClaim(b.pid);

    broadcast(server);
    for (const [fc, session, own, other] of [
      [fcA, a, 'Aki', 'Bea'],
      [fcB, b, 'Bea', 'Aki'],
    ] as const) {
      const client = bareClient(session.pid);
      (client as any).applySnapshot(lastSnap(fc.sent));
      const info = client.housingInfo!;
      expect(info.origin).not.toBeNull();
      const owners = info.plots.filter((p) => p.ownerName !== null);
      expect(owners.map((p) => p.ownerName).sort()).toEqual([...['Aki', 'Bea']].sort());
      expect(info.plots.find((p) => p.ownerName === own)?.mine).toBe(true);
      expect(info.plots.find((p) => p.ownerName === other)?.mine).toBe(false);
      // Aki's lantern is visible to both viewers
      expect(info.plots.find((p) => p.ownerName === 'Aki')?.objects).toEqual([
        { slot: 0, kind: 'lantern' },
      ]);
    }
  });

  it('ownership survives a server restart via serialize/loadHousing', () => {
    const server = new GameServer();
    const fc = fakeWs();
    const s = joinServer(server, fc, 7, 'Keep');
    standOnPlot(server, s.pid, 2);
    server.sim.housingClaim(s.pid);
    const blob = JSON.parse(JSON.stringify(server.sim.serializeHousing()));

    const server2 = new GameServer();
    server2.sim.loadHousing(blob);
    const fc2 = fakeWs();
    // same account id 7, a different character/session after "restart"
    const s2 = joinServer(server2, fc2, 7, 'Keep');
    server2.sim.enterDungeon('the_hollow', s2.pid);
    broadcast(server2);
    const client = bareClient(s2.pid);
    (client as any).applySnapshot(lastSnap(fc2.sent));
    const plot = client.housingInfo!.plots.find((p) => p.plotId === HOLLOW_HOUSE_PLOTS[2].id)!;
    expect(plot.ownerName).toBe('Keep');
    expect(plot.mine).toBe(true);
  });

  it('claims and decorates via the housingClaim/Place/Remove wire commands (PHAA-405 interact flow)', () => {
    const server = new GameServer();
    const fc = fakeWs();
    const s = joinServer(server, fc, 3, 'Rue');
    standOnPlot(server, s.pid, 4);

    server.handleMessage(s, JSON.stringify({ t: 'cmd', cmd: 'housingClaim' }));
    server.handleMessage(
      s,
      JSON.stringify({ t: 'cmd', cmd: 'housingPlace', slot: 0, kind: 'lantern' }),
    );
    broadcast(server);
    const client = bareClient(s.pid);
    (client as any).applySnapshot(lastSnap(fc.sent));
    let plot = client.housingInfo!.plots.find((p) => p.plotId === HOLLOW_HOUSE_PLOTS[4].id)!;
    expect(plot.ownerName).toBe('Rue');
    expect(plot.mine).toBe(true);
    expect(plot.objects).toEqual([{ slot: 0, kind: 'lantern' }]);

    server.handleMessage(s, JSON.stringify({ t: 'cmd', cmd: 'housingRemove', slot: 0 }));
    broadcast(server);
    (client as any).applySnapshot(lastSnap(fc.sent));
    plot = client.housingInfo!.plots.find((p) => p.plotId === HOLLOW_HOUSE_PLOTS[4].id)!;
    expect(plot.objects).toEqual([]);
  });
});
