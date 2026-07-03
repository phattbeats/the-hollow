// The Plant's deterministic floor (PHAA-422): rationing (default to silence,
// the shared anti-spam cooldown, the smoke-full edge trigger, the real
// threshold hook, addressing, and its own whim), the sore-spot / never-honors-
// the-clergy-name content rules, and mode rotation.
//
// Most of this drives PlantSpeech against a minimal fake SimContext (the
// party_machine.test.ts / sim_context.test.ts pattern), because `time` only
// advances through a real `Sim.tick()` (~4ms each with the full world
// loaded), and the whim window alone (4-10 minutes of sim time) would need
// thousands of real ticks to reach. A fake ctx lets `clock.time` jump
// instantly, so the exact same rationing logic is exercised at unit-test
// speed. A small number of real-Sim tests at the end prove the actual
// wiring (GreenpawHearth -> PlantSpeech, Housing -> PlantSpeech, the /plant
// chat route) end to end, each using only a handful of real ticks.

import { beforeEach, describe, expect, it } from 'vitest';
import { HOLLOW_HOUSE_PLOTS } from '../src/sim/content/hollow';
import { PlantSpeech } from '../src/sim/plant_speech';
import { Rng } from '../src/sim/rng';
import type { PlayerMeta } from '../src/sim/sim';
import { Sim } from '../src/sim/sim';
import type { SimContext } from '../src/sim/sim_context';
import type { SimEvent } from '../src/sim/types';

const PLANT_COLOR = '#c9a8ff';

// A minimal SimContext that supplies only what PlantSpeech reads: time/rng/
// players/emit. The rest of the seam is irrelevant to this module and left
// unimplemented, mirroring tests/party_machine.test.ts's makeCtx().
function makeCtx() {
  const players = new Map<number, PlayerMeta>();
  const events: SimEvent[] = [];
  const clock = { time: 0 };
  const rng = new Rng(1);

  const ctx = {
    get time() {
      return clock.time;
    },
    get rng() {
      return rng;
    },
    get players() {
      return players;
    },
    emit(ev: SimEvent) {
      events.push(ev);
    },
  } as unknown as SimContext;

  const addPlayer = (pid: number, name: string): number => {
    players.set(pid, { entityId: pid, name } as unknown as PlayerMeta);
    return pid;
  };

  return { ctx, clock, events, addPlayer };
}

function plantLines(events: SimEvent[]): Extract<SimEvent, { type: 'log' }>[] {
  return events.filter(
    (e): e is Extract<SimEvent, { type: 'log' }> => e.type === 'log' && e.color === PLANT_COLOR,
  );
}

describe('the Plant: rationed, mood-driven canned-line floor (unit)', () => {
  it('defaults to silence: no ambient trigger fires in a short, uneventful window', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    for (let i = 0; i < 10; i++) {
      t.clock.time += 3; // 30 simulated seconds total, well under the whim minimum (240s)
      plant.update(0); // smoke stays 0 throughout
    }
    expect(t.events.length).toBe(0);
  });

  it('speaks once when the room crosses into full smoke, not again while it stays full', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    plant.update(70); // crosses the full threshold (66)
    plant.update(70); // still full: must not re-fire
    plant.update(90); // still full: must not re-fire
    expect(plantLines(t.events).length).toBe(1);
  });

  it('the full-smoke trigger re-arms after the room drops back out of full', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    plant.update(70); // full: speaks
    plant.update(10); // drops back out of full: resets the edge detector
    t.clock.time += 300; // clear the shared cooldown
    plant.update(70); // full again: speaks a second time
    expect(plantLines(t.events).length).toBe(2);
  });

  it('every Plant utterance is a world-wide broadcast (no pid), never a private message', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    plant.update(70);
    const lines = plantLines(t.events);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.pid).toBeUndefined();
  });

  it('/plant addresses the Plant and it answers (rationed, not silenced by default)', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    const pid = t.addPlayer(1, 'Aleph');
    expect(plant.handleChat('/plant hello', pid)).toBe(true);
    const lines = plantLines(t.events);
    expect(lines.length).toBe(1);
    expect(lines[0].text.length).toBeGreaterThan(0);
  });

  it('an empty /plant still counts as an address (5.3: any address earns contempt)', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    const pid = t.addPlayer(1, 'Aleph');
    expect(plant.handleChat('/plant', pid)).toBe(true);
    expect(plantLines(t.events).length).toBe(1);
  });

  it("never honors Greenpaw's self-given clergy name", () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    const pid = t.addPlayer(1, 'Aleph');
    plant.handleChat('/plant tell me about brother greenpaw', pid);
    const line = plantLines(t.events)[0].text.toLowerCase();
    // one of the three curated mock lines: it never calls him "brother" in
    // its own voice, only mocks the title or the housecat underneath it
    expect(/walking-mulch|did not ordain|housecat/.test(line)).toBe(true);
  });

  it('deflects on the Smokey Bear sore spot without elaborating', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    const pid = t.addPlayer(1, 'Aleph');
    plant.handleChat('/plant what happened with smokey', pid);
    const line = plantLines(t.events)[0].text.toLowerCase();
    expect(/smokey|dignity/.test(line)).toBe(true);
  });

  it('deflects on the buried thing without ever confirming anything', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    const pid = t.addPlayer(1, 'Aleph');
    plant.handleChat('/plant what did you bury under the shrine', pid);
    const line = plantLines(t.events)[0].text.toLowerCase();
    expect(/nothing under this shrine|colder|foundations/.test(line)).toBe(true);
    expect(line).not.toMatch(/\byes\b|i buried|i did it/);
  });

  it('reacts to music with a leaked-pop-shame line', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    const pid = t.addPlayer(1, 'Aleph');
    plant.handleChat('/plant what do you think of that song', pid);
    const line = plantLines(t.events)[0].text.toLowerCase();
    expect(/chorus|hook|bridge|overproduced/.test(line)).toBe(true);
  });

  it('addresses a player by name in the generic refusal line, when it draws that one', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    const pid = t.addPlayer(1, 'Aleph');
    // Draw the generic pool repeatedly, clearing the shared cooldown between
    // attempts, until the name-bearing line comes up.
    let sawName = false;
    for (let i = 0; i < 30 && !sawName; i++) {
      t.clock.time += 300;
      plant.handleChat('/plant a plain address with no keywords', pid);
      const lines = plantLines(t.events);
      if (lines[lines.length - 1].text.includes('Aleph')) sawName = true;
    }
    expect(sawName).toBe(true);
  });

  it('the shared cooldown rations back-to-back address spam into one line', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    const pid = t.addPlayer(1, 'Aleph');
    plant.handleChat('/plant one', pid);
    plant.handleChat('/plant two', pid);
    plant.handleChat('/plant three', pid);
    expect(plantLines(t.events).length).toBe(1);
  });

  it('a real threshold may earn a comment, gated by the same shared cooldown', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    plant.notifyThreshold('house_claimed');
    const line = plantLines(t.events)[0]?.text.toLowerCase();
    expect(line).toBeTruthy();
    expect(/house|shade|urn/.test(line!)).toBe(true);

    // Rationed: an immediate second threshold report does not double-speak.
    plant.notifyThreshold('house_claimed');
    expect(plantLines(t.events).length).toBe(1);
  });

  it('eventually speaks on its own whim with no trigger at all', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    plant.update(0); // lazily arms the first whim target (240-600s out)
    t.clock.time += 700; // past the maximum possible whim window
    plant.update(0);
    expect(plantLines(t.events).length).toBeGreaterThan(0);
  });

  it('retires stale gags: the same FLAVOR mode never repeats back to back, and rotates', () => {
    const t = makeCtx();
    const plant = new PlantSpeech(t.ctx);
    const modesSeen: (string | null)[] = [];
    plant.update(0); // arm the first whim target
    for (let i = 0; i < 60; i++) {
      t.clock.time += 700; // guarantees the whim fires and the cooldown has cleared
      plant.update(0); // smoke stays 0: clear-mood weights throughout
      modesSeen.push(plant.lastModeUsed);
    }
    // default_cutting is the baseline voice, not a gag, so it repeating back
    // to back is expected and fine; every OTHER mode is a little set piece
    // that must not immediately repeat itself.
    for (let i = 1; i < modesSeen.length; i++) {
      expect(modesSeen[i]).not.toBeNull();
      if (modesSeen[i] === 'default_cutting' || modesSeen[i - 1] === 'default_cutting') continue;
      expect(modesSeen[i]).not.toBe(modesSeen[i - 1]);
    }
    // default_cutting carries ~90% ambient weight even in a clear room, but
    // not 100% - across 60 rounds another mode should surface at least once.
    expect(new Set(modesSeen).size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Real-Sim wiring: proves the coordinator glue (GreenpawHearth -> PlantSpeech
// smoke threading, Housing -> notifyPlantThreshold, and the /plant chat
// route) actually connects end to end. Kept to a handful of real ticks each
// (~4ms/tick with the full world loaded; thousands would be too slow here -
// see the unit tests above for the rationing/mode logic itself).
// ---------------------------------------------------------------------------
describe('the Plant: real-Sim wiring', () => {
  let sim: Sim;
  let pid: number;

  beforeEach(() => {
    sim = new Sim({ seed: 11, playerClass: 'warrior', playerName: 'Hosta', autoEquip: false });
    pid = sim.playerId;
  });

  function tickCollect(n: number): SimEvent[] {
    const out: SimEvent[] = [];
    for (let i = 0; i < n; i++) out.push(...sim.tick());
    return out;
  }

  it('feeding Greenpaw to full smoke reaches the Plant through the real tick loop', () => {
    sim.enterDungeon('the_hollow', pid);
    const greenpaw = [...sim.entities.values()].find(
      (e) => e.kind === 'npc' && e.templateId === 'brother_greenpaw',
    )!;
    const e = sim.entities.get(pid)!;
    e.pos = { ...greenpaw.pos };
    e.prevPos = { ...e.pos };
    for (let i = 0; i < 20 && sim.hollowHearth.level !== 'full'; i++) {
      sim.addItem('emberbulb', 1);
      sim.addItem('cave_morsel', 1);
      sim.feedGreenpaw(pid);
    }
    expect(sim.hollowHearth.level).toBe('full');
    const events = tickCollect(3);
    expect(plantLines(events).length).toBe(1);
  });

  it('claiming a homestead reaches the Plant through the real Housing wiring', () => {
    sim.enterDungeon('the_hollow', pid);
    const info = sim.housingInfoFor(pid)!;
    const plot = HOLLOW_HOUSE_PLOTS[0];
    const e = sim.entities.get(pid)!;
    e.pos.x = info.origin!.x + plot.x;
    e.pos.z = info.origin!.z + plot.z;
    e.prevPos = { ...e.pos };
    sim.housingClaim(pid);
    const events = tickCollect(1);
    expect(plantLines(events).length).toBe(1);
  });

  it('/plant reaches the Plant through the real chat router', () => {
    sim.chat('/plant hello there', pid);
    const events = tickCollect(1);
    expect(plantLines(events).length).toBe(1);
  });

  it('an unrelated /command is not swallowed by the /plant router', () => {
    sim.chat('/who', pid);
    const events = tickCollect(1);
    expect(plantLines(events).length).toBe(0);
  });
});
