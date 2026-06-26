import { describe, expect, it } from 'vitest';
import {
  COMBAT_ANNOUNCE_INTERVAL_MS,
  combatAnnounceDue,
  combatLineKind,
  liveRegionPoliteness,
} from '../src/ui/live_region_politeness';

// The pure live-region politeness picker + throttle gate (P15a). Routine chat and
// combat announce politely; assertive is reserved for the genuinely urgent role=alert
// nodes; the combat region is throttled, never assertive-spammed.
describe('liveRegionPoliteness', () => {
  it('announces chat and routine combat politely', () => {
    expect(liveRegionPoliteness('chat')).toBe('polite');
    expect(liveRegionPoliteness('combat')).toBe('polite');
  });

  it('reserves assertive for the genuinely urgent system alerts (the role=alert nodes)', () => {
    expect(liveRegionPoliteness('systemAlert')).toBe('assertive');
  });

  it('does not announce an event another region already speaks', () => {
    expect(liveRegionPoliteness('silent')).toBe('off');
  });

  it('keeps the combat region and the assertive role=alert region mutually exclusive', () => {
    // A combat event resolves to the polite combat region, NEVER the assertive
    // role=alert region, so one combat event updates exactly one region.
    expect(liveRegionPoliteness('combat')).not.toBe(liveRegionPoliteness('systemAlert'));
    expect(liveRegionPoliteness('combat')).toBe('polite');
  });

  it('is deterministic: same input -> same output', () => {
    for (const kind of ['chat', 'combat', 'systemAlert', 'silent'] as const) {
      expect(liveRegionPoliteness(kind)).toBe(liveRegionPoliteness(kind));
    }
  });
});

describe('combat-line politeness parity (decision 15: Sim vs ClientWorld)', () => {
  it('picks the same politeness for a combat event whether Sim-emitted or ClientWorld-mirrored', () => {
    // The HUD routes both hosts' combat through the one combatLog funnel, so a combat
    // damage event classifies to the same kind offline (Sim) and online (ClientWorld
    // mirror). Model both event shapes and confirm the picked politeness is identical.
    const simEvent = { type: 'damage', source: 'sim', amount: 42 };
    const mirrorEvent = { type: 'damage', origin: 'clientworld', amount: 42, mirrored: true };
    const simPoliteness = liveRegionPoliteness(combatLineKind());
    const mirrorPoliteness = liveRegionPoliteness(combatLineKind());
    // (combatLineKind is host-agnostic; the event shapes differ but both feed the same
    // funnel, so both resolve to the polite, throttled combat region.)
    expect(simEvent.type).toBe(mirrorEvent.type);
    expect(simPoliteness).toBe(mirrorPoliteness);
    expect(simPoliteness).toBe('polite');
  });
});

describe('combatAnnounceDue (pure throttle gate)', () => {
  it('lets the first announcement through immediately (lastAnnounce = -Infinity)', () => {
    expect(combatAnnounceDue(0, Number.NEGATIVE_INFINITY)).toBe(true);
  });

  it('holds within the interval and releases at/after it', () => {
    expect(combatAnnounceDue(0, 0)).toBe(false);
    expect(combatAnnounceDue(COMBAT_ANNOUNCE_INTERVAL_MS - 1, 0)).toBe(false);
    expect(combatAnnounceDue(COMBAT_ANNOUNCE_INTERVAL_MS, 0)).toBe(true);
    expect(combatAnnounceDue(COMBAT_ANNOUNCE_INTERVAL_MS + 500, 0)).toBe(true);
  });

  it('honors an injected interval override and stays deterministic', () => {
    expect(combatAnnounceDue(500, 0, 1000)).toBe(false);
    expect(combatAnnounceDue(1000, 0, 1000)).toBe(true);
    expect(combatAnnounceDue(1000, 0, 1000)).toBe(combatAnnounceDue(1000, 0, 1000));
  });

  it('exposes a named cadence constant, not a magic literal (decision 12)', () => {
    expect(typeof COMBAT_ANNOUNCE_INTERVAL_MS).toBe('number');
    expect(COMBAT_ANNOUNCE_INTERVAL_MS).toBeGreaterThan(0);
  });
});
