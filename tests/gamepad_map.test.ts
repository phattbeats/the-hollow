import { describe, it, expect } from 'vitest';
import {
  applyRadialDeadzone,
  stickToMoveFlags,
  stickToLook,
  risingEdges,
  DEFAULT_GAMEPAD_BINDINGS,
  BINDABLE_BUTTONS,
  GP,
} from '../src/game/gamepad_map';

describe('applyRadialDeadzone', () => {
  it('zeroes a vector inside the deadzone', () => {
    expect(applyRadialDeadzone(0.1, 0.05, 0.2)).toEqual({ x: 0, y: 0 });
    expect(applyRadialDeadzone(0, 0, 0.2)).toEqual({ x: 0, y: 0 });
  });

  it('rescales so the deadzone edge maps to ~0 and the unit circle to 1', () => {
    // straight up, just past the deadzone -> small magnitude
    const justOut = applyRadialDeadzone(0, -0.2001, 0.2);
    expect(Math.hypot(justOut.x, justOut.y)).toBeLessThan(0.01);
    // full deflection stays at magnitude 1
    const full = applyRadialDeadzone(0, -1, 0.2);
    expect(Math.hypot(full.x, full.y)).toBeCloseTo(1, 6);
  });
});

describe('stickToMoveFlags', () => {
  it('produces nothing inside the deadzone', () => {
    expect(stickToMoveFlags(0.1, 0.1, 0.25)).toEqual({
      forward: false, back: false, strafeLeft: false, strafeRight: false,
    });
  });

  it('maps up to forward and down to back (y inverted)', () => {
    expect(stickToMoveFlags(0, -1, 0.2).forward).toBe(true);
    expect(stickToMoveFlags(0, 1, 0.2).back).toBe(true);
  });

  it('fires both axes on a diagonal', () => {
    const f = stickToMoveFlags(-0.9, -0.9, 0.2);
    expect(f.forward).toBe(true);
    expect(f.strafeLeft).toBe(true);
  });
});

describe('stickToLook', () => {
  it('returns zero inside the deadzone', () => {
    expect(stickToLook(0.1, 0.1, 0.2, 2, false, 0.016)).toEqual({ yaw: 0, pitch: 0 });
  });

  it('turns right (negative yaw delta) when pushed right and scales with dt', () => {
    const a = stickToLook(1, 0, 0.2, 2, false, 0.016);
    const b = stickToLook(1, 0, 0.2, 2, false, 0.032);
    expect(a.yaw).toBeLessThan(0);
    expect(b.yaw).toBeCloseTo(a.yaw * 2, 6);
  });

  it('inverts pitch when invertY is set', () => {
    const normal = stickToLook(0, -1, 0.2, 2, false, 0.016);
    const inverted = stickToLook(0, -1, 0.2, 2, true, 0.016);
    expect(Math.sign(normal.pitch)).toBe(-Math.sign(inverted.pitch));
  });
});

describe('risingEdges', () => {
  it('reports only up->down transitions', () => {
    const prev = [false, true, false];
    const cur = [true, true, true];
    expect(risingEdges(prev, cur)).toEqual([0, 2]);
  });

  it('reports nothing when held', () => {
    expect(risingEdges([true, true], [true, true])).toEqual([]);
  });
});

describe('default layout', () => {
  it('binds every console-MMO button to a known action and stays within the bindable set', () => {
    expect(DEFAULT_GAMEPAD_BINDINGS[GP.A]).toBe('jump');
    expect(DEFAULT_GAMEPAD_BINDINGS[GP.START]).toBe('escape');
    for (const idx of Object.keys(DEFAULT_GAMEPAD_BINDINGS).map(Number)) {
      expect(BINDABLE_BUTTONS).toContain(idx);
    }
  });
});
