import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the db layer so no Postgres is needed. Mirrors tests/backpressure.test.ts.
vi.mock('../server/db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  saveCharacterState: vi.fn(async () => {}),
  saveCharacterAndMarketState: vi.fn(async () => {}),
  saveMarket: vi.fn(async () => {}),
  saveMail: vi.fn(async () => {}),
  saveGreenpawHearth: vi.fn(async () => {}),
  saveHousing: vi.fn(async () => {}),
  saveHomestead: vi.fn(async () => {}),
  openPlaySession: vi.fn(async () => 1),
  closePlaySession: vi.fn(async () => {}),
  insertChatLogs: vi.fn(async () => {}),
  walletForAccount: vi.fn(async () => null),
  markAccountQuestComplete: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  grantAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
}));

import { GameServer } from '../server/game';
import { WS_BACKPRESSURE_LIMIT_BYTES } from '../server/ws_backpressure';

// Synthetic socket: a healthy client drains its buffer to 0 on every send; a
// stuck client keeps accumulating without bound (mirrors a peer that is not
// reading its socket).
function makeClient(stuck: boolean) {
  const sent: string[] = [];
  let buffered = 0;
  let readyState = 1;
  const ws: any = {
    get readyState() {
      return readyState;
    },
    set readyState(v: number) {
      readyState = v;
    },
    get bufferedAmount() {
      return buffered;
    },
    set bufferedAmount(v: number) {
      buffered = v;
    },
    send(payload: string) {
      if (stuck) {
        buffered += Buffer.byteLength(payload);
      } else {
        sent.push(payload);
        buffered = 0;
      }
    },
    terminate() {
      this.readyState = 3;
    },
  };
  return { ws, sent, stuck };
}

// Sable's QA plan, step (State): bot-harness multi-client session; kill/stall
// one client's socket reads and confirm (a) the other sessions keep receiving
// snapshots on cadence, (b) the stalled session is terminated on backpressure,
// (c) server RSS stays bounded.
describe('backpressure harness', () => {
  let server: GameServer;
  beforeEach(() => {
    server = new GameServer();
  });

  it('keeps healthy clients fed and terminates a stuck client, with bounded RSS', () => {
    const HEALTHY = 32;
    const STUCK = 1;

    const healthy = Array.from({ length: HEALTHY }, (_, i) => makeClient(false));
    const stuckClients = Array.from({ length: STUCK }, (_, i) => makeClient(true));
    const healthySessions = healthy.map((c, i) => {
      const s = server.join(c.ws, 1000 + i, 1000 + i, `Healthy_${i}`, 'warrior', null) as any;
      s.blockListLoaded = true;
      return s;
    });
    const stuckSession = server.join(stuckClients[0].ws, 2000, 2000, 'Stuck', 'warrior', null) as any;
    stuckSession.blockListLoaded = true;
    // Pre-stage the stuck client's buffer above the limit, like a peer that
    // ignored the first few snapshots we sent.
    stuckClients[0].ws.bufferedAmount = WS_BACKPRESSURE_LIMIT_BYTES + 1;

    // Snapshot the RSS + per-iter counts before driving the broadcast loop.
    const initialRssKb = Math.round(process.memoryUsage().rss / 1024);
    const countSnapFrames = (clients: typeof healthy) =>
      clients.reduce(
        (n, c) =>
          n +
          c.sent.reduce((m, payload) => {
            // snap frames start with {"t":"snap",". broadcastSnapshots emits one
            // snap per live session per call; we count those specifically so
            // the helper does not double-count hello or events frames.
            try {
              const j = JSON.parse(payload);
              return m + (j && j.t === 'snap' ? 1 : 0);
            } catch {
              return m;
            }
          }, 0),
        0,
      );
    let stuckTerminatedAt = -1;

    const rssSamples: number[] = [];
    const snapIncrements: number[] = [];
    const stuckInClients: boolean[] = [];

    let prevHealthySnaps = 0;
    const ITERS = 30;
    for (let iter = 0; iter < ITERS; iter++) {
      (server as any).broadcastSnapshots();
      rssSamples.push(Math.round(process.memoryUsage().rss / 1024));
      const totalHealthySnaps = countSnapFrames(healthy);
      snapIncrements.push(totalHealthySnaps - prevHealthySnaps);
      prevHealthySnaps = totalHealthySnaps;
      const stillIn = (server as any).clients.has(2000);
      stuckInClients.push(stillIn);
      if (!stillIn && stuckTerminatedAt < 0) stuckTerminatedAt = iter;
    }

    // (a) healthy sessions kept receiving frames throughout the run. Each iter
    // delivers at least one snap per live healthy session. We assert per-iter
    // increments are positive and bounded by the live healthy count (so a
    // regression that doubles up, or skips them, would show up).
    const liveHealthyAt = (iter: number) =>
      healthySessions.filter((s) => (server as any).clients.has(s.pid)).length;
    for (let iter = 0; iter < ITERS; iter++) {
      expect(snapIncrements[iter]).toBeGreaterThan(0);
      expect(snapIncrements[iter]).toBeLessThanOrEqual(liveHealthyAt(iter));
    }
    expect(liveHealthyAt(ITERS - 1)).toBe(HEALTHY);

    // (b) the stuck client was terminated on its first broadcast attempt.
    expect(stuckTerminatedAt).toBe(0);
    expect(stuckSession.left).toBe(true);
    expect((server as any).clients.has(2000)).toBe(false);

    // (c) RSS stays bounded across the iterations. With one client terminated
    // immediately and the rest draining on every send, the resident set should
    // be flat. Give a generous 32 MiB ceiling for vitest's own noise and the
    // one-time snapshot-string allocations.
    const rssMax = Math.max(...rssSamples);
    const rssMaxDelta = rssMax - initialRssKb;
    const rssFinalDelta = rssSamples[rssSamples.length - 1] - initialRssKb;
    // eslint-disable-next-line no-console
    console.log(
      `\n# backpressure-harness trace\n` +
        `healthy=${HEALTHY} stuck=${STUCK} iters=${ITERS}\n` +
        `initial_rss_kb=${initialRssKb}\n` +
        `rss_max_kb=${rssMax}\n` +
        `rss_max_delta_kb=${rssMaxDelta}\n` +
        `rss_final_delta_kb=${rssFinalDelta}\n` +
        `stuck_terminated_iter=${stuckTerminatedAt}\n` +
        `stuck_in_clients_last=${stuckInClients[stuckInClients.length - 1]}\n` +
        `live_healthy_final=${liveHealthyAt(ITERS - 1)}\n`,
    );
    expect(rssMaxDelta).toBeLessThan(32 * 1024);
  });
});
