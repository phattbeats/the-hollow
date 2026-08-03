import { beforeEach, describe, expect, it } from 'vitest';
import { EDITOR_PLAYTEST_KEY, takeEditorPlaytestRequest } from '../src/game/editor_playtest';
import type { WorldContent } from '../src/sim/types';

// Game-side reader for the editor -> game play-test handoff (sessionStorage key
// woc_editor_playtest). This deliberately imports nothing from src/editor: it
// only depends on sim types, so the editor code never enters the shipped game
// bundle. These tests pin the round-trip, the defensive shape-check, the class
// fallback, and the read-and-consume-once semantics via a minimal storage stub.

function installSessionStorageStub(): void {
  const map = new Map<string, string>();
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

function validWorldContent(): WorldContent {
  return {
    zones: [
      {
        id: 'z1',
        name: 'Zone 1',
        zMin: 0,
        zMax: 100,
        levelRange: [1, 10],
        biome: 'vale',
        hub: { x: 0, z: 0, radius: 10, name: 'Hub' },
        graveyard: { x: 0, z: 5 },
        lakes: [],
        pois: [],
        welcome: 'Welcome!',
      },
    ],
    camps: [],
    npcs: {},
    groundObjects: [],
    roads: [],
    props: {} as WorldContent['props'],
    playerStart: { x: 0, z: 0 },
  };
}

function payload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    content: validWorldContent(),
    seed: 12345,
    playerClass: 'mage',
    playerName: 'Testy',
    ...overrides,
  });
}

beforeEach(() => {
  installSessionStorageStub();
});

describe('takeEditorPlaytestRequest', () => {
  it('returns null when no request is pending', () => {
    expect(takeEditorPlaytestRequest()).toBeNull();
  });

  it('round-trips a valid payload', () => {
    sessionStorage.setItem(EDITOR_PLAYTEST_KEY, payload());
    const req = takeEditorPlaytestRequest();
    expect(req).not.toBeNull();
    expect(req!.seed).toBe(12345);
    expect(req!.playerClass).toBe('mage');
    expect(req!.playerName).toBe('Testy');
    expect(req!.content.zones).toHaveLength(1);
  });

  it('consumes the request so a second read returns null', () => {
    sessionStorage.setItem(EDITOR_PLAYTEST_KEY, payload());
    expect(takeEditorPlaytestRequest()).not.toBeNull();
    expect(takeEditorPlaytestRequest()).toBeNull();
    expect(sessionStorage.getItem(EDITOR_PLAYTEST_KEY)).toBeNull();
  });

  it('rejects malformed content (missing zones)', () => {
    const bad = JSON.stringify({
      content: { camps: [], groundObjects: [], roads: [], props: {}, playerStart: { x: 0, z: 0 } },
      seed: 1,
      playerClass: 'mage',
      playerName: 'Testy',
    });
    sessionStorage.setItem(EDITOR_PLAYTEST_KEY, bad);
    expect(takeEditorPlaytestRequest()).toBeNull();
  });

  it('rejects malformed content (zone missing hub.x)', () => {
    const content = validWorldContent() as unknown as { zones: Array<Record<string, unknown>> };
    content.zones[0].hub = { radius: 10 };
    const bad = JSON.stringify({ content, seed: 1, playerClass: 'mage', playerName: 'Testy' });
    sessionStorage.setItem(EDITOR_PLAYTEST_KEY, bad);
    expect(takeEditorPlaytestRequest()).toBeNull();
  });

  it('rejects non-JSON garbage', () => {
    sessionStorage.setItem(EDITOR_PLAYTEST_KEY, 'not json{{{');
    expect(takeEditorPlaytestRequest()).toBeNull();
  });

  it('falls back to warrior for a missing/invalid player class', () => {
    sessionStorage.setItem(EDITOR_PLAYTEST_KEY, payload({ playerClass: 'necromancer' }));
    expect(takeEditorPlaytestRequest()!.playerClass).toBe('warrior');
  });

  it('falls back to the default seed and name when absent', () => {
    sessionStorage.setItem(
      EDITOR_PLAYTEST_KEY,
      JSON.stringify({ content: validWorldContent(), playerClass: 'mage' }),
    );
    const req = takeEditorPlaytestRequest();
    expect(req!.seed).toBe(20061);
    expect(req!.playerName).toBe('Mapmaker');
  });

  it('truncates an overlong player name to 24 characters', () => {
    sessionStorage.setItem(EDITOR_PLAYTEST_KEY, payload({ playerName: 'x'.repeat(50) }));
    expect(takeEditorPlaytestRequest()!.playerName).toHaveLength(24);
  });
});
