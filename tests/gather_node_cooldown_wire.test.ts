// PHAA-618 acceptance at the wire level: the per-player gather-node respawn
// timer rides the self snapshot ('gnodecd'), so the online ClientWorld's
// nodeHarvestableByMe matches the offline Sim's nodeHarvestableByMeFor for the
// same player and node, instead of the old always-true stub. A node the player
// harvested reads "cooling" on the client until its timer elapses, then "ready"
// again. Scaffolding mirrors tests/homestead_wire.test.ts.

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
import { GATHER_NODES } from '../src/sim/data';
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

// Minimal ClientWorld to drive applySnapshot directly (no WebSocket). Object
// .create bypasses the constructor, so every field applySnapshot touches
// (including the PHAA-618 nodeCooldownSet) is seeded here.
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
  c.gatheringProficiency = { amber: 0, heartwood: 0, spore: 0 };
  c.nodeCooldownSet = new Set();
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

// Assert the online client agrees with the authoritative Sim for EVERY gather
// node, which is the PHAA-618 acceptance ("online and offline players see
// identical ready/cooldown state for the same node given the same timer").
function expectClientMatchesSim(client: ClientWorld, server: GameServer, pid: number): void {
  for (const node of GATHER_NODES) {
    expect(client.nodeHarvestableByMe(node.id)).toBe(
      server.sim.nodeHarvestableByMeFor(node.id, pid),
    );
  }
}

describe('gather-node cooldown over the wire (PHAA-618)', () => {
  it('a harvested node reads "cooling" on the online client and matches Sim', () => {
    const server = new GameServer();
    const fc = fakeWs();
    const s = joinServer(server, fc, 1, 'Gath');

    const node = GATHER_NODES[0];
    // stand exactly on the node so the real harvest command path is in range
    const e = server.sim.entities.get(s.pid)!;
    e.pos.x = node.pos.x;
    e.pos.z = node.pos.z;
    e.prevPos = { ...e.pos };

    // baseline: nothing harvested, every node ready on both sides
    broadcast(server);
    const before = bareClient(s.pid);
    (before as any).applySnapshot(lastSnap(fc.sent));
    expect(before.nodeHarvestableByMe(node.id)).toBe(true);
    expectClientMatchesSim(before, server, s.pid);

    // harvest through the authoritative command path (sets this player's timer)
    server.sim.harvestNode(node.id, s.pid);
    expect(server.sim.nodeHarvestableByMeFor(node.id, s.pid)).toBe(false);

    broadcast(server);
    const during = bareClient(s.pid);
    (during as any).applySnapshot(lastSnap(fc.sent));
    // the harvested node is now cooling online, every other node still ready
    expect(during.nodeHarvestableByMe(node.id)).toBe(false);
    for (const other of GATHER_NODES.slice(1)) {
      expect(during.nodeHarvestableByMe(other.id)).toBe(true);
    }
    expectClientMatchesSim(during, server, s.pid);
  });

  it('the node reads "ready" again on the client once its timer elapses', () => {
    const server = new GameServer();
    const fc = fakeWs();
    const s = joinServer(server, fc, 2, 'Wait');

    const node = GATHER_NODES[0];
    const meta = server.sim.players.get(s.pid)!;
    // seed the per-player timer directly: harvestable again 120s from now
    meta.nodeHarvestReadyAt[node.id] = server.sim.time + 120;

    broadcast(server);
    const cooling = bareClient(s.pid);
    (cooling as any).applySnapshot(lastSnap(fc.sent));
    expect(cooling.nodeHarvestableByMe(node.id)).toBe(false);
    expectClientMatchesSim(cooling, server, s.pid);

    // advance sim time past the respawn window; the diff re-sends 'gnodecd'
    // (now empty) and the client clears the cooldown
    server.sim.time += 121;
    broadcast(server);
    const ready = bareClient(s.pid);
    (ready as any).applySnapshot(lastSnap(fc.sent));
    expect(ready.nodeHarvestableByMe(node.id)).toBe(true);
    expectClientMatchesSim(ready, server, s.pid);
  });
});
