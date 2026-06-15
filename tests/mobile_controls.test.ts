import { describe, expect, it } from 'vitest';
import {
  HAPTICS_STORE_KEY,
  isPhoneTouchDevice,
  loadHapticsEnabled,
  mapJoystickVector,
  mapLookVector,
  saveHapticsEnabled,
  triggerHaptic,
} from '../src/game/mobile_controls';

describe('mapJoystickVector', () => {
  it('returns neutral inside the deadzone', () => {
    expect(mapJoystickVector(0, 0)).toEqual({ forward: false, back: false, strafeLeft: false, strafeRight: false });
    expect(mapJoystickVector(0.05, -0.08)).toEqual({ forward: false, back: false, strafeLeft: false, strafeRight: false });
  });

  it('maps cardinal movement directions', () => {
    expect(mapJoystickVector(0, -1)).toEqual({ forward: true, back: false, strafeLeft: false, strafeRight: false });
    expect(mapJoystickVector(0, 1)).toEqual({ forward: false, back: true, strafeLeft: false, strafeRight: false });
    expect(mapJoystickVector(-1, 0)).toEqual({ forward: false, back: false, strafeLeft: true, strafeRight: false });
    expect(mapJoystickVector(1, 0)).toEqual({ forward: false, back: false, strafeLeft: false, strafeRight: true });
  });

  it('maps diagonal movement directions', () => {
    expect(mapJoystickVector(0.7, -0.7)).toEqual({ forward: true, back: false, strafeLeft: false, strafeRight: true });
    expect(mapJoystickVector(-0.7, 0.7)).toEqual({ forward: false, back: true, strafeLeft: true, strafeRight: false });
  });
});

describe('isPhoneTouchDevice', () => {
  it('uses the phone touch media query', () => {
    const queries: string[] = [];
    const win = {
      matchMedia: (q: string) => {
        queries.push(q);
        return { matches: true };
      },
    } as unknown as Window;
    expect(isPhoneTouchDevice(win)).toBe(true);
    expect(queries[0]).toContain('pointer: coarse');
    expect(queries[0]).toContain('max-width: 940px');
    expect(queries[0]).toContain('max-height: 760px');
  });
});

describe('mapLookVector', () => {
  it('returns a neutral camera vector inside the deadzone', () => {
    expect(mapLookVector(0.02, 0.03)).toEqual({ x: 0, y: 0 });
  });

  it('keeps analog camera vector outside the deadzone', () => {
    const v = mapLookVector(0.45, -0.25);
    expect(v.x).toBeCloseTo(0.36);
    expect(v.y).toBeCloseTo(-0.2);
  });
});

describe('haptics', () => {
  const makeStore = (initial: Record<string, string> = {}) => {
    const map = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => { map.set(k, v); },
      map,
    };
  };

  it('defaults to enabled when nothing is stored or storage is missing', () => {
    expect(loadHapticsEnabled(makeStore())).toBe(true);
    expect(loadHapticsEnabled(null)).toBe(true);
  });

  it('round-trips the stored preference (only "0" disables)', () => {
    const store = makeStore();
    saveHapticsEnabled(false, store);
    expect(store.map.get(HAPTICS_STORE_KEY)).toBe('0');
    expect(loadHapticsEnabled(store)).toBe(false);
    saveHapticsEnabled(true, store);
    expect(store.map.get(HAPTICS_STORE_KEY)).toBe('1');
    expect(loadHapticsEnabled(store)).toBe(true);
  });

  it('vibrates only when enabled and the API exists', () => {
    const calls: Array<number | number[]> = [];
    const nav = { vibrate: (p: number | number[]) => { calls.push(p); return true; } };
    expect(triggerHaptic(10, true, nav)).toBe(true);
    expect(triggerHaptic(10, false, nav)).toBe(false); // disabled
    expect(triggerHaptic(10, true, {})).toBe(false);    // no Vibration API
    expect(triggerHaptic(10, true, null)).toBe(false);  // no navigator
    expect(calls).toEqual([10]);
  });

  it('swallows Vibration API exceptions', () => {
    const nav = { vibrate: () => { throw new Error('blocked'); } };
    expect(triggerHaptic([12, 40, 12], true, nav)).toBe(false);
  });
});
