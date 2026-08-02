// Regression coverage for the chat sender-name activation wiring (PHAA-711,
// PHAA-821 follow-up): right-click, left-click/tap, and Enter/Space each open
// the player context menu exactly once per gesture, and none of the three
// paths double-fires another's work. Drives attachChatPlayerNameActivation
// against a tiny fake element (no jsdom), matching this repo's other DOM-free
// wiring tests.
import { describe, expect, it } from 'vitest';
import { attachChatPlayerNameActivation } from '../src/ui/chat_player_name_activation';

type Listener = (ev: unknown) => void;

class FakeChatNameElement {
  private listeners = new Map<string, Listener[]>();
  rect = { left: 10, bottom: 20 };
  addEventListener(type: string, cb: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  }
  getBoundingClientRect() {
    return this.rect;
  }
  dispatch(type: string, ev: unknown): void {
    for (const cb of this.listeners.get(type) ?? []) cb(ev);
  }
  listenerCount(type: string): number {
    return (this.listeners.get(type) ?? []).length;
  }
}

function activationRecorder() {
  const calls: Array<[number, number]> = [];
  return { activate: (x: number, y: number) => calls.push([x, y]), calls };
}

describe('attachChatPlayerNameActivation', () => {
  it('registers exactly one listener per event type', () => {
    const el = new FakeChatNameElement();
    attachChatPlayerNameActivation(el as unknown as HTMLElement, activationRecorder().activate);
    expect(el.listenerCount('contextmenu')).toBe(1);
    expect(el.listenerCount('click')).toBe(1);
    expect(el.listenerCount('keydown')).toBe(1);
  });

  it('a right-click (contextmenu) activates exactly once, at the event coordinates, and suppresses the native menu', () => {
    const el = new FakeChatNameElement();
    const { activate, calls } = activationRecorder();
    attachChatPlayerNameActivation(el as unknown as HTMLElement, activate);

    let prevented = false;
    el.dispatch('contextmenu', {
      clientX: 100,
      clientY: 200,
      preventDefault: () => {
        prevented = true;
      },
    });

    expect(calls).toEqual([[100, 200]]);
    expect(prevented).toBe(true);
  });

  it('a left-click/tap activates exactly once, independent of contextmenu (mobile has no contextmenu event)', () => {
    const el = new FakeChatNameElement();
    const { activate, calls } = activationRecorder();
    attachChatPlayerNameActivation(el as unknown as HTMLElement, activate);

    el.dispatch('click', { clientX: 30, clientY: 40 });

    expect(calls).toEqual([[30, 40]]);
  });

  it('a single contextmenu gesture does not also trigger the click path (no double-fire)', () => {
    const el = new FakeChatNameElement();
    const { activate, calls } = activationRecorder();
    attachChatPlayerNameActivation(el as unknown as HTMLElement, activate);

    // A real right-click dispatches only 'contextmenu' in this repo's target
    // browsers; simulating exactly that single event must yield exactly one
    // activation, not one per registered listener.
    el.dispatch('contextmenu', { clientX: 5, clientY: 6, preventDefault: () => {} });

    expect(calls.length).toBe(1);
  });

  it('Enter or Space on focus activates once at the element bounding rect, other keys do nothing', () => {
    const el = new FakeChatNameElement();
    el.rect = { left: 50, bottom: 60 };
    const { activate, calls } = activationRecorder();
    attachChatPlayerNameActivation(el as unknown as HTMLElement, activate);

    el.dispatch('keydown', { key: 'Tab', preventDefault: () => {} });
    expect(calls).toEqual([]);

    let prevented = false;
    el.dispatch('keydown', {
      key: 'Enter',
      preventDefault: () => {
        prevented = true;
      },
    });
    expect(calls).toEqual([[50, 60]]);
    expect(prevented).toBe(true);

    el.dispatch('keydown', { key: ' ', preventDefault: () => {} });
    expect(calls).toEqual([
      [50, 60],
      [50, 60],
    ]);
  });
});
