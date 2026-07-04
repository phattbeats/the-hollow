// The Plant's live LLM ceiling (PHAA-423): proves GameServer's wiring, not
// just server/plant_llm.ts in isolation. Two invariants that only show up at
// this layer:
//   1. `.plant` metadata NEVER reaches the wire, whether or not the live
//      feature is configured (types.ts: "the online server strips it before
//      broadcasting"). The shipped-dark default must not leak it either.
//   2. When configured, the canned line is pulled out of the tick's normal
//      batch and the (live-or-fallback) line broadcasts once, server-wide,
//      asynchronously, without ever sending the canned line first.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  saveCharacterState: vi.fn(async () => {}),
  openPlaySession: vi.fn(async () => 1),
  closePlaySession: vi.fn(async () => {}),
  insertChatLogs: vi.fn(async () => {}),
  markAccountQuestComplete: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  grantAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
}));

import { GameServer } from '../server/game';
import { resetPlantLlmBudgetForTests } from '../server/plant_llm';
import type { PlantUtteranceMeta, SimEvent } from '../src/sim/types';

const PLANT_COLOR = '#c9a8ff';

function plantEvent(text: string, plant: PlantUtteranceMeta): SimEvent {
  return { type: 'log', text, color: PLANT_COLOR, plant };
}

function makeMeta(): PlantUtteranceMeta {
  return { mode: 'default_cutting', mood: 'clear', trigger: 'whim' };
}

function fakeWs() {
  const messages: unknown[] = [];
  return {
    ws: {
      readyState: 1,
      send: (payload: string) => messages.push(JSON.parse(payload)),
    },
    messages,
  };
}

const ENV_KEYS = ['PLANT_LLM_ENABLED', 'PLANT_LLM_API_KEY'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  resetPlantLlmBudgetForTests();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
});

describe('GameServer: the Plant live LLM ceiling wiring (PHAA-423)', () => {
  it('shipped dark (unconfigured): strips .plant but still broadcasts the canned line same-tick', () => {
    const server = new GameServer();
    const client = fakeWs();
    const session = server.join(client.ws as any, 1, 1, 'Aleph', 'warrior', null);
    if ('error' in session) throw new Error(session.error);

    const events = [plantEvent('you again.', makeMeta())];
    const out = (server as any).interceptPlantUtterances(events) as SimEvent[];

    // stripped before it ever reaches routeEvents/the wire
    expect(out).toHaveLength(1);
    expect((out[0] as any).plant).toBeUndefined();
    expect((out[0] as any).text).toBe('you again.');

    (server as any).routeEvents(out);
    const logMsgs = (client.messages as any[]).filter(
      (m: any) =>
        m.t === 'events' && m.list.some((e: any) => e.type === 'log' && e.color === PLANT_COLOR),
    );
    expect(logMsgs.length).toBe(1);
    const logged = logMsgs[0].list.find((e: any) => e.color === PLANT_COLOR);
    expect(logged.text).toBe('you again.');
    expect(logged.plant).toBeUndefined();
  });

  it('configured: pulls the tagged event out of the tick batch and never sends the canned line first', async () => {
    process.env.PLANT_LLM_ENABLED = '1';
    process.env.PLANT_LLM_API_KEY = 'sk-test';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ content: [{ type: 'text', text: 'a live line.' }] }), {
            status: 200,
          }),
      ),
    );

    const server = new GameServer();
    const client = fakeWs();
    const session = server.join(client.ws as any, 1, 1, 'Aleph', 'warrior', null);
    if ('error' in session) throw new Error(session.error);

    const events = [plantEvent('canned fallback line.', makeMeta())];
    const out = (server as any).interceptPlantUtterances(events) as SimEvent[];

    // pulled out of this tick's batch entirely: nothing to route yet
    expect(out).toHaveLength(0);
    (server as any).routeEvents(out);
    const liveOrCannedMsgs = () =>
      (client.messages as any[]).filter(
        (m: any) =>
          m.t === 'events' &&
          m.list.some(
            (e: any) =>
              e.type === 'log' && (e.text === 'a live line.' || e.text === 'canned fallback line.'),
          ),
      );
    expect(liveOrCannedMsgs().length).toBe(0); // canned line never sent up front

    // let the async generatePlantLine(...).then(broadcastPlantLine) resolve
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const logMsgs = liveOrCannedMsgs();
    expect(logMsgs.length).toBe(1);
    const logged = logMsgs[0].list.find((e: any) => e.text === 'a live line.');
    expect(logged.color).toBe(PLANT_COLOR);
    expect(logged.plant).toBeUndefined();
  });

  it('configured but the model call fails: still broadcasts, falling back to the canned line, .plant stripped', async () => {
    process.env.PLANT_LLM_ENABLED = '1';
    process.env.PLANT_LLM_API_KEY = 'sk-test';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );

    const server = new GameServer();
    const client = fakeWs();
    const session = server.join(client.ws as any, 1, 1, 'Aleph', 'warrior', null);
    if ('error' in session) throw new Error(session.error);

    const events = [plantEvent('canned fallback line.', makeMeta())];
    (server as any).interceptPlantUtterances(events);

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const logMsgs = (client.messages as any[]).filter(
      (m: any) =>
        m.t === 'events' &&
        m.list.some((e: any) => e.type === 'log' && e.text === 'canned fallback line.'),
    );
    expect(logMsgs.length).toBe(1);
  });

  it('a non-Plant log event is left completely untouched either way', () => {
    const server = new GameServer();
    const events: SimEvent[] = [{ type: 'log', text: 'a mob died.', color: '#ffffff' }];
    const out = (server as any).interceptPlantUtterances(events) as SimEvent[];
    expect(out).toBe(events); // same reference: true no-op when nothing is tagged
  });
});
