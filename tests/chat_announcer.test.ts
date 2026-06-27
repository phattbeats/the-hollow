import { describe, expect, it } from 'vitest';
import { ChatAnnouncer } from '../src/ui/chat_announcer';
import { CHAT_ANNOUNCE_INTERVAL_MS } from '../src/ui/live_region_politeness';

// The dedicated chat live-region announcer (P18d items 3 + 5): one polite off-screen
// summary into the tab-independent #chat-live region, throttled so a chat burst never
// floods the screen reader. DOM-free (injected text sink + clock), so this drives it
// directly with a recording sink and controlled time, no jsdom.
function recorder() {
  const calls: string[] = [];
  return { sink: (s: string) => calls.push(s), calls };
}

describe('ChatAnnouncer single-announce', () => {
  it('a single chat line announces the line exactly once', () => {
    const { sink, calls } = recorder();
    new ChatAnnouncer(sink).push('Thrall: For the Horde!', 0);
    expect(calls).toEqual(['Thrall: For the Horde!']);
  });

  it('ignores blank / whitespace-only lines (no announcement)', () => {
    const { sink, calls } = recorder();
    const announcer = new ChatAnnouncer(sink);
    announcer.push('   ', 0);
    announcer.push('', 0);
    expect(calls).toEqual([]);
  });

  it('relays the rendered line verbatim (no new player-visible text introduced)', () => {
    const { sink, calls } = recorder();
    new ChatAnnouncer(sink).push('[Guilde] Aria: bonjour a tous', 0);
    expect(calls).toEqual(['[Guilde] Aria: bonjour a tous']);
  });
});

describe('ChatAnnouncer burst throttle (CHAT_ANNOUNCE_INTERVAL_MS, never assertive)', () => {
  it('collapses a chat burst to at most one announcement per interval (latest wins)', () => {
    const { sink, calls } = recorder();
    const announcer = new ChatAnnouncer(sink);
    // A burst at t=0: the first announces immediately, the rest buffer (latest wins).
    announcer.push('line 1', 0);
    announcer.push('line 2', 0);
    announcer.push('line 3', 0);
    expect(calls).toEqual(['line 1']);

    // Before the interval elapses, still no second announcement.
    announcer.flush(CHAT_ANNOUNCE_INTERVAL_MS - 1);
    expect(calls).toEqual(['line 1']);

    // At/after the interval, the latest buffered line flushes (one more announcement).
    announcer.flush(CHAT_ANNOUNCE_INTERVAL_MS);
    expect(calls).toEqual(['line 1', 'line 3']);
  });

  it('does not flush when nothing is pending', () => {
    const { sink, calls } = recorder();
    const announcer = new ChatAnnouncer(sink);
    announcer.flush(0);
    announcer.flush(CHAT_ANNOUNCE_INTERVAL_MS * 5);
    expect(calls).toEqual([]);
  });

  it('honors an injected interval override and stays deterministic', () => {
    const { sink, calls } = recorder();
    const announcer = new ChatAnnouncer(sink, 1000);
    announcer.push('a', 0); // immediate
    announcer.push('b', 500); // within 1000ms -> buffered
    expect(calls).toEqual(['a']);
    announcer.push('c', 1000); // interval elapsed -> flush latest
    expect(calls).toEqual(['a', 'c']);
  });
});
