// Greenpaw's hunger loop and smoke-as-mood (PHAA-421): the hunger/feed/decay
// state machine, its IWorld read surface, and the serialize/load round trip,
// mirroring the housing.test.ts / market.test.ts persistence pattern. The
// /feed chat command was removed (PHAA-482); feeding is now feedGreenpaw()
// only (called from Greenpaw's dialogue menu online).

import { beforeEach, describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import type { SimEvent } from '../src/sim/types';

function findGreenpaw(sim: Sim) {
  return [...sim.entities.values()].find(
    (e) => e.kind === 'npc' && e.templateId === 'brother_greenpaw',
  )!;
}

// Stand the player at Greenpaw's side, inside the hub instance.
function standAtGreenpaw(sim: Sim, pid: number): void {
  sim.enterDungeon('the_hollow', pid);
  const greenpaw = findGreenpaw(sim);
  const e = sim.entities.get(pid)!;
  e.pos = { ...greenpaw.pos };
  e.prevPos = { ...e.pos };
}

function errorTexts(events: SimEvent[]): string[] {
  return events
    .filter((e): e is Extract<SimEvent, { type: 'error' }> => e.type === 'error')
    .map((e) => e.text);
}

function logTexts(events: SimEvent[]): string[] {
  return events
    .filter((e): e is Extract<SimEvent, { type: 'log' }> => e.type === 'log')
    .map((e) => e.text);
}

describe("Greenpaw's hearth: hunger/feed/decay", () => {
  let sim: Sim;
  let pid: number;

  beforeEach(() => {
    sim = new Sim({ seed: 9, playerClass: 'warrior', playerName: 'Hosta', autoEquip: false });
    pid = sim.playerId;
  });

  it('starts clear, with no smoke, before anyone feeds him', () => {
    expect(sim.hollowHearth).toEqual({ smoke: 0, level: 'clear' });
  });

  it("refuses to feed from outside Greenpaw's reach", () => {
    // still out in the overworld, nowhere near the hub
    sim.addItem('emberbulb', 1);
    sim.feedGreenpaw(pid);
    const events = sim.tick();
    expect(errorTexts(events).some((t) => /near brother greenpaw/i.test(t))).toBe(true);
    expect(sim.hollowHearth.smoke).toBe(0);
    expect(sim.countItem('emberbulb')).toBe(1); // untouched
  });

  it('feeding emberbulb ("what burns") consumes it and raises smoke', () => {
    standAtGreenpaw(sim, pid);
    sim.addItem('emberbulb', 1);
    sim.feedGreenpaw(pid);
    const events = sim.tick();
    expect(sim.countItem('emberbulb')).toBe(0);
    expect(sim.hollowHearth.smoke).toBeGreaterThan(0);
    expect(sim.hollowHearth.level).toBe('clear'); // one feed alone isn't enough for hazy
    expect(logTexts(events).length).toBeGreaterThan(0);
  });

  it('feeding cave_morsel ("what fills") consumes it and raises smoke too', () => {
    standAtGreenpaw(sim, pid);
    sim.addItem('cave_morsel', 1);
    sim.feedGreenpaw(pid);
    sim.tick();
    expect(sim.countItem('cave_morsel')).toBe(0);
    expect(sim.hollowHearth.smoke).toBeGreaterThan(0);
  });

  it('feeding both at once consumes both and stacks the smoke gain', () => {
    standAtGreenpaw(sim, pid);
    sim.addItem('emberbulb', 1);
    sim.feedGreenpaw(pid);
    const smokeAfterOne = sim.hollowHearth.smoke;
    sim.addItem('cave_morsel', 1);
    sim.feedGreenpaw(pid);
    expect(sim.countItem('emberbulb')).toBe(0);
    expect(sim.countItem('cave_morsel')).toBe(0);
    expect(sim.hollowHearth.smoke).toBeGreaterThan(smokeAfterOne);
  });

  it('empty-handed feeding leaves the hearth untouched but still answers in voice', () => {
    standAtGreenpaw(sim, pid);
    sim.feedGreenpaw(pid);
    const events = sim.tick();
    expect(sim.hollowHearth.smoke).toBe(0);
    expect(logTexts(events).length).toBeGreaterThan(0);
  });

  it('repeated feeding climbs clear -> hazy -> full', () => {
    standAtGreenpaw(sim, pid);
    const lastLevel = sim.hollowHearth.level;
    const seen = new Set([lastLevel]);
    for (let i = 0; i < 20 && sim.hollowHearth.level !== 'full'; i++) {
      sim.addItem('emberbulb', 1);
      sim.addItem('cave_morsel', 1);
      sim.feedGreenpaw(pid);
      seen.add(sim.hollowHearth.level);
    }
    expect(sim.hollowHearth.level).toBe('full');
    expect(seen.has('hazy')).toBe(true);
    expect(sim.hollowHearth.smoke).toBeLessThanOrEqual(100);
  });

  it('smoke decays back toward clear over time when nobody feeds him', () => {
    standAtGreenpaw(sim, pid);
    for (let i = 0; i < 15; i++) {
      sim.addItem('emberbulb', 1);
      sim.feedGreenpaw(pid);
    }
    const fed = sim.hollowHearth.smoke;
    expect(fed).toBeGreaterThan(0);
    // fast-forward twenty real minutes of decay in one call (deterministic dt
    // integration, no wall-clock / Date.now involved)
    sim.greenpawHearth.update(20 * 60);
    expect(sim.hollowHearth.smoke).toBe(0);
    expect(sim.hollowHearth.level).toBe('clear');
  });

  it('hunger rises over time and feeding relieves it', () => {
    const startHunger = sim.greenpawHearth.hungerValue;
    sim.greenpawHearth.update(5 * 60);
    expect(sim.greenpawHearth.hungerValue).toBeGreaterThan(startHunger);

    standAtGreenpaw(sim, pid);
    const beforeFeed = sim.greenpawHearth.hungerValue;
    sim.addItem('cave_morsel', 1);
    sim.feedGreenpaw(pid);
    expect(sim.greenpawHearth.hungerValue).toBeLessThan(beforeFeed);
  });

  it('feeding while he is hungrier yields a bigger smoke gain (the loop renews, it does not one-shot max)', () => {
    // Drive hunger to the top first.
    sim.greenpawHearth.update(60 * 60);
    const hungryHunger = sim.greenpawHearth.hungerValue;
    standAtGreenpaw(sim, pid);
    sim.addItem('emberbulb', 1);
    sim.feedGreenpaw(pid);
    const gainWhenHungry = sim.hollowHearth.smoke;

    // Reset to a fresh sim, feed immediately (mostly-full hunger reserve is the
    // same starting point, but simulate "already just fed" by feeding twice
    // back to back: the second feed's marginal gain should be smaller because
    // hunger was just relieved by the first).
    const sim2 = new Sim({
      seed: 9,
      playerClass: 'warrior',
      playerName: 'Hosta',
      autoEquip: false,
    });
    const pid2 = sim2.playerId;
    standAtGreenpaw(sim2, pid2);
    sim2.addItem('emberbulb', 2);
    sim2.feedGreenpaw(pid2);
    const smokeAfterFirst = sim2.hollowHearth.smoke;
    sim2.feedGreenpaw(pid2);
    const marginalSecondGain = sim2.hollowHearth.smoke - smokeAfterFirst;

    expect(hungryHunger).toBeGreaterThan(0);
    expect(gainWhenHungry).toBeGreaterThan(0);
    expect(marginalSecondGain).toBeGreaterThan(0);
    expect(marginalSecondGain).toBeLessThan(smokeAfterFirst);
  });

  it('serializes and reloads hunger/smoke exactly', () => {
    standAtGreenpaw(sim, pid);
    sim.addItem('emberbulb', 3);
    sim.feedGreenpaw(pid);
    sim.feedGreenpaw(pid);
    const save = sim.serializeGreenpawHearth();
    expect(save.smoke).toBeGreaterThan(0);

    const fresh = new Sim({ seed: 1, playerClass: 'mage', noPlayer: true });
    expect(fresh.hollowHearth.smoke).toBe(0);
    fresh.loadGreenpawHearth(save);
    expect(fresh.serializeGreenpawHearth()).toEqual(save);
    expect(fresh.hollowHearth.smoke).toBe(sim.hollowHearth.smoke);
  });

  it('remembers the keeper: the last feeder round-trips, and an old save without one is fine', () => {
    standAtGreenpaw(sim, pid);
    sim.addItem('emberbulb', 1);
    sim.feedGreenpaw(pid);
    const save = sim.serializeGreenpawHearth();
    expect(typeof save.lastFeeder).toBe('string');
    expect((save.lastFeeder as string).length).toBeGreaterThan(0);

    const fresh = new Sim({ seed: 1, playerClass: 'mage', noPlayer: true });
    fresh.loadGreenpawHearth(save);
    expect(fresh.serializeGreenpawHearth().lastFeeder).toBe(save.lastFeeder);

    // A pre-PHAA-484 save has no lastFeeder key at all: load() must tolerate it.
    const legacy = new Sim({ seed: 1, playerClass: 'mage', noPlayer: true });
    legacy.loadGreenpawHearth({ hunger: 10, smoke: 10 });
    expect(legacy.serializeGreenpawHearth().lastFeeder).toBe(null);
  });

  it('loadGreenpawHearth(null) is a safe no-op', () => {
    expect(() => sim.loadGreenpawHearth(null)).not.toThrow();
    expect(() => sim.loadGreenpawHearth(undefined)).not.toThrow();
    expect(sim.hollowHearth.smoke).toBe(0);
  });

  it('rejects a garbage save instead of NaN-ing the hearth', () => {
    sim.loadGreenpawHearth({ hunger: Number.NaN, smoke: 'nope' as unknown as number });
    expect(Number.isFinite(sim.hollowHearth.smoke)).toBe(true);
  });

  it('a successful feed credits an active feed-type quest objective once per call (PHAA-484)', () => {
    standAtGreenpaw(sim, pid);
    sim.acceptQuest('q_what_burns');
    sim.addItem('emberbulb', 5);
    sim.tick();
    sim.turnInQuest('q_what_burns');
    sim.acceptQuest('q_what_fills');
    sim.addItem('cave_morsel', 4);
    sim.tick();
    sim.turnInQuest('q_what_fills');
    sim.acceptQuest('q_the_wavelength');
    const meta = (sim as any).primary;

    // Feeding both item types in one call still credits the objective once.
    sim.addItem('emberbulb', 1);
    sim.addItem('cave_morsel', 1);
    sim.feedGreenpaw(pid);
    expect(meta.questLog.get('q_the_wavelength')?.counts[1]).toBe(1);

    // An empty-handed feed (nothing consumed) does not credit it further.
    sim.feedGreenpaw(pid);
    expect(meta.questLog.get('q_the_wavelength')?.counts[1]).toBe(1);
  });

  it('/feed is no longer a chat command (PHAA-482): it falls through to the unknown-command error', () => {
    standAtGreenpaw(sim, pid);
    sim.addItem('emberbulb', 1);
    sim.chat('/feed', pid);
    const events = sim.tick();
    expect(errorTexts(events).some((t) => /unknown command: \/feed/i.test(t))).toBe(true);
    // nothing consumed: chat never reaches feedGreenpaw() any more
    expect(sim.countItem('emberbulb')).toBe(1);
    expect(sim.hollowHearth.smoke).toBe(0);
  });
});
