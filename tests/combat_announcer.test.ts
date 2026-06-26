import { describe, expect, it } from 'vitest';
import { CombatAnnouncer } from '../src/ui/combat_announcer';
import { COMBAT_ANNOUNCE_INTERVAL_MS } from '../src/ui/live_region_politeness';

// The combat live-region announcer (P15a): one polite off-screen summary, throttled
// so a damage burst never floods the screen reader. DOM-free (injected text sink +
// clock), so this drives it directly with a recording sink and controlled time.
function recorder() {
  const calls: string[] = [];
  return { sink: (s: string) => calls.push(s), calls };
}

describe('CombatAnnouncer single-announce', () => {
  it('a single combat event updates the combat region exactly once', () => {
    const { sink, calls } = recorder();
    const announcer = new CombatAnnouncer(sink);
    announcer.push('You hit the Kobold for 42.', 0);
    expect(calls).toEqual(['You hit the Kobold for 42.']);
  });

  it('ignores blank lines (no announcement)', () => {
    const { sink, calls } = recorder();
    const announcer = new CombatAnnouncer(sink);
    announcer.push('   ', 0);
    expect(calls).toEqual([]);
  });

  it('relays the localized line verbatim (no new player-visible text introduced)', () => {
    const { sink, calls } = recorder();
    const announcer = new CombatAnnouncer(sink);
    announcer.push('Le Kobold vous frappe pour 7.', 0);
    expect(calls).toEqual(['Le Kobold vous frappe pour 7.']);
  });
});

describe('CombatAnnouncer burst throttle', () => {
  it('collapses a routine-damage burst to at most one announcement per interval', () => {
    const { sink, calls } = recorder();
    const announcer = new CombatAnnouncer(sink);
    // A burst at t=0: the first announces immediately, the rest buffer (latest wins).
    announcer.push('hit 1', 0);
    announcer.push('hit 2', 0);
    announcer.push('hit 3', 0);
    announcer.push('hit 4', 0);
    expect(calls).toEqual(['hit 1']);

    // Before the interval elapses, still no second announcement.
    announcer.flush(COMBAT_ANNOUNCE_INTERVAL_MS - 1);
    expect(calls).toEqual(['hit 1']);

    // At/after the interval, the latest buffered line flushes (one more announcement).
    announcer.flush(COMBAT_ANNOUNCE_INTERVAL_MS);
    expect(calls).toEqual(['hit 1', 'hit 4']);
  });

  it('does not flush when nothing is pending', () => {
    const { sink, calls } = recorder();
    const announcer = new CombatAnnouncer(sink);
    announcer.flush(0);
    announcer.flush(COMBAT_ANNOUNCE_INTERVAL_MS * 3);
    expect(calls).toEqual([]);
  });

  it('respects an injected interval override', () => {
    const { sink, calls } = recorder();
    const announcer = new CombatAnnouncer(sink, 1000);
    announcer.push('a', 0); // immediate
    announcer.push('b', 500); // within 1000ms -> buffered
    expect(calls).toEqual(['a']);
    announcer.push('c', 1000); // interval elapsed -> flush latest
    expect(calls).toEqual(['a', 'c']);
  });
});
