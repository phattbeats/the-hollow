import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PLAYTEST_SEED, launchPlaytest } from '../src/editor/playtest';
import { EDITOR_PLAYTEST_KEY } from '../src/game/editor_playtest';
import type { WorldContent } from '../src/sim/types';

// Editor-side half of the PHAA-679 play-test handoff: launchPlaytest stashes a
// WorldContent + player options into sessionStorage and navigates to the game
// page. The game-side reader (takeEditorPlaytestRequest) is covered separately
// in tests/editor_playtest.test.ts; these pin the writer's contract with it -
// same storage key, same payload shape - plus the blocked-storage fallback.
//
// No jsdom here (matches editor_playtest.test.ts): sessionStorage/window are
// stubbed directly on globalThis rather than pulling in a DOM environment.

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
    playerStart: { x: 1, z: 2 },
  };
}

let href: string;

beforeEach(() => {
  installSessionStorageStub();
  href = '';
  (globalThis as unknown as { window: { location: { href: string } } }).window = {
    location: {
      get href() {
        return href;
      },
      set href(v: string) {
        href = v;
      },
    },
  };
});

describe('launchPlaytest', () => {
  it('stashes the world + options under the shared key and navigates to the game', () => {
    const world = validWorldContent();
    const ok = launchPlaytest(world, {
      seed: DEFAULT_PLAYTEST_SEED,
      playerClass: 'warrior',
      playerName: 'Mapmaker',
    });
    expect(ok).toBe(true);
    expect(href).toBe('/index.html');
    const raw = sessionStorage.getItem(EDITOR_PLAYTEST_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.content.zones).toHaveLength(1);
    expect(parsed.seed).toBe(DEFAULT_PLAYTEST_SEED);
    expect(parsed.playerClass).toBe('warrior');
    expect(parsed.playerName).toBe('Mapmaker');
  });

  it('returns false and does not navigate when storage is blocked', () => {
    const original = sessionStorage.setItem;
    sessionStorage.setItem = () => {
      throw new Error('storage blocked');
    };
    try {
      const ok = launchPlaytest(validWorldContent(), {
        seed: 1,
        playerClass: 'mage',
        playerName: 'Testy',
      });
      expect(ok).toBe(false);
      expect(href).toBe('');
    } finally {
      sessionStorage.setItem = original;
    }
  });
});
