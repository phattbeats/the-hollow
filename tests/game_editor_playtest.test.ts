import { beforeEach, describe, expect, it } from 'vitest';
import { EDITOR_PLAYTEST_KEY, takeEditorPlaytestRequest } from '../src/game/editor_playtest';

// The map editor hands the game a custom world through sessionStorage (never
// the network: playtest is a same-origin, offline-only handoff). This exercises
// the reader side only, independently of the editor UI that writes the key.

function installSessionStorage(): void {
  const map = new Map<string, string>();
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
}

function validWorldContent(): Record<string, unknown> {
  return {
    zones: [
      {
        zMin: 0,
        zMax: 100,
        hub: { x: 0, z: 0 },
        lakes: [],
        pois: [],
      },
    ],
    camps: [],
    groundObjects: [],
    roads: [],
    props: {},
    playerStart: { x: 0, z: 0 },
  };
}

beforeEach(() => installSessionStorage());

describe('takeEditorPlaytestRequest', () => {
  it('returns null when no request is pending', () => {
    expect(takeEditorPlaytestRequest()).toBeNull();
  });

  it('reads back a valid request and consumes the key', () => {
    sessionStorage.setItem(
      EDITOR_PLAYTEST_KEY,
      JSON.stringify({
        content: validWorldContent(),
        seed: 12345,
        playerClass: 'mage',
        playerName: 'Tester',
      }),
    );
    const req = takeEditorPlaytestRequest();
    expect(req).not.toBeNull();
    expect(req!.seed).toBe(12345);
    expect(req!.playerClass).toBe('mage');
    expect(req!.playerName).toBe('Tester');
    // Consumed: a second read (e.g. after a refresh) sees nothing.
    expect(sessionStorage.getItem(EDITOR_PLAYTEST_KEY)).toBeNull();
    expect(takeEditorPlaytestRequest()).toBeNull();
  });

  it('falls back to defaults for a missing seed/class/name', () => {
    sessionStorage.setItem(EDITOR_PLAYTEST_KEY, JSON.stringify({ content: validWorldContent() }));
    const req = takeEditorPlaytestRequest();
    expect(req).not.toBeNull();
    expect(req!.seed).toBe(20061);
    expect(req!.playerClass).toBe('warrior');
    expect(req!.playerName).toBe('Mapmaker');
  });

  it('rejects an unknown player class rather than trusting the blob', () => {
    sessionStorage.setItem(
      EDITOR_PLAYTEST_KEY,
      JSON.stringify({ content: validWorldContent(), playerClass: 'necromancer' }),
    );
    expect(takeEditorPlaytestRequest()!.playerClass).toBe('warrior');
  });

  it('returns null for content missing required WorldContent shape', () => {
    sessionStorage.setItem(EDITOR_PLAYTEST_KEY, JSON.stringify({ content: { zones: [] } }));
    expect(takeEditorPlaytestRequest()).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    sessionStorage.setItem(EDITOR_PLAYTEST_KEY, '{not valid json');
    expect(takeEditorPlaytestRequest()).toBeNull();
  });

  it('returns null when sessionStorage throws (blocked storage)', () => {
    (globalThis as any).sessionStorage = {
      getItem: () => {
        throw new Error('storage blocked');
      },
    };
    expect(takeEditorPlaytestRequest()).toBeNull();
  });
});
