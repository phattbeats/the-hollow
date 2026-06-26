// Combat live-region announcer (WIRING, not a registered pure core): buffers the
// routine combat-log lines hud.combatLog produces and flushes a single off-screen
// polite summary at most once per COMBAT_ANNOUNCE_INTERVAL_MS, so a damage burst
// never floods the screen reader. It is DOM-free by construction (the text sink and
// the clock are injected) so a Vitest drives it without jsdom; hud.ts wires the sink
// to the #combat-live element's textContent and the clock to performance.now.
//
// The per-type politeness decision lives in the pure ./live_region_politeness picker;
// this module owns only the buffer + throttle state. It announces the latest combat
// line per interval (a burst collapses to the most recent), and never re-localizes:
// the line it relays is already a t()-localized string built at the combatLog call
// site, so no new player-visible text is introduced here.
import {
  COMBAT_ANNOUNCE_INTERVAL_MS,
  combatAnnounceDue,
  combatLineKind,
  liveRegionPoliteness,
} from './live_region_politeness';

export class CombatAnnouncer {
  // The latest buffered line awaiting announcement, or null when nothing is pending.
  private pending: string | null = null;
  // Last announcement time; -Infinity so the first line announces immediately.
  private lastAnnounce = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly setText: (summary: string) => void,
    private readonly interval: number = COMBAT_ANNOUNCE_INTERVAL_MS,
  ) {}

  /**
   * Record a combat line, then attempt a throttled flush. Only lines whose kind
   * resolves to a polite announcement are buffered (combat is never assertive); the
   * throttle is what keeps a burst from flooding, not the politeness.
   */
  push(line: string, now: number): void {
    if (liveRegionPoliteness(combatLineKind()) !== 'polite') return;
    const text = line.trim();
    if (!text) return;
    this.pending = text;
    this.flush(now);
  }

  /**
   * Flush the buffered summary if the throttle interval has elapsed. Called from
   * push() and from the HUD per-frame tick so a trailing burst still drains.
   */
  flush(now: number): void {
    if (this.pending === null) return;
    if (!combatAnnounceDue(now, this.lastAnnounce, this.interval)) return;
    this.setText(this.pending);
    this.pending = null;
    this.lastAnnounce = now;
  }
}
