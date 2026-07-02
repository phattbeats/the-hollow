import { afterEach, describe, expect, it, vi } from 'vitest';
import { type GamepadCallbacks, GamepadManager } from '../src/game/gamepad';
import { GamepadBindings } from '../src/game/gamepad_bindings';
import { GP, STANDARD_BUTTON_COUNT } from '../src/game/gamepad_map';
import type { Input } from '../src/game/input';

function gamepadWithPressed(...pressed: number[]): Gamepad {
  const pressedSet = new Set(pressed);
  return {
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: STANDARD_BUTTON_COUNT }, (_, index) => ({
      pressed: pressedSet.has(index),
      touched: pressedSet.has(index),
      value: pressedSet.has(index) ? 1 : 0,
    })),
    connected: true,
    id: 'test gamepad',
    index: 0,
    mapping: 'standard',
    timestamp: 0,
    vibrationActuator: null,
  } as unknown as Gamepad;
}

describe('GamepadManager window focus', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    let pad = gamepadWithPressed();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { getGamepads: () => [pad] },
    });
    const onAction = vi.fn();
    const setGamepadMove = vi.fn();
    const clearGamepadMove = vi.fn();
    const input = {
      applyGamepadLook: vi.fn(),
      setGamepadMove,
      clearGamepadMove,
      triggerGamepadJump: vi.fn(),
    } as unknown as Input;
    const callbacks = {
      onAction,
      isPointerMode: () => false,
    } satisfies GamepadCallbacks;
    const manager = new GamepadManager(input, new GamepadBindings(), callbacks);
    (manager as unknown as { index: number | null }).index = 0;
    return {
      manager,
      onAction,
      setGamepadMove,
      clearGamepadMove,
      setPad: (p: Gamepad) => {
        pad = p;
      },
    };
  }

  it('takes no pad input while the window is unfocused', () => {
    const { manager, onAction, setGamepadMove, clearGamepadMove, setPad } = setup();
    vi.stubGlobal('document', { hasFocus: () => false });

    manager.poll(1 / 60);
    setPad(gamepadWithPressed(GP.A));
    manager.poll(1 / 60);

    expect(onAction).not.toHaveBeenCalled();
    expect(setGamepadMove).not.toHaveBeenCalled();
    expect(clearGamepadMove).toHaveBeenCalled();
  });

  it('does not fire a stale action for a button held across a refocus', () => {
    const { manager, onAction, setPad } = setup();
    let focused = false;
    vi.stubGlobal('document', { hasFocus: () => focused });

    // GP.B (bound to 'interact' by default) dispatches through onAction, unlike
    // GP.A (bound to 'jump', which calls Input.triggerGamepadJump directly).
    setPad(gamepadWithPressed(GP.B));
    manager.poll(1 / 60); // pressed while unfocused: consumed, never dispatched
    focused = true;
    manager.poll(1 / 60); // still held on refocus: no rising edge
    expect(onAction).not.toHaveBeenCalled();

    setPad(gamepadWithPressed());
    manager.poll(1 / 60);
    setPad(gamepadWithPressed(GP.B));
    manager.poll(1 / 60); // a fresh press after the refocus dispatches normally
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('resumes movement once the window regains focus', () => {
    const { manager, setGamepadMove, setPad } = setup();
    let focused = false;
    vi.stubGlobal('document', { hasFocus: () => focused });

    manager.poll(1 / 60);
    focused = true;
    setPad(gamepadWithPressed(GP.A));
    manager.poll(1 / 60);

    expect(setGamepadMove).toHaveBeenCalled();
  });
});
