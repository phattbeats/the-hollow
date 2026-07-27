import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import type { SimEvent } from '../src/sim/types';

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
}

function formParty(sim: Sim, leader: number, members: number[]) {
  for (const m of members) {
    sim.partyInvite(m, leader);
    sim.partyAccept(m);
  }
}

function errorText(events: SimEvent[], pid: number): string | undefined {
  return events.find(
    (ev): ev is Extract<SimEvent, { type: 'error' }> => ev.type === 'error' && ev.pid === pid,
  )?.text;
}

function logTexts(events: SimEvent[], pid: number): string[] {
  return events
    .filter((ev): ev is Extract<SimEvent, { type: 'log' }> => ev.type === 'log' && ev.pid === pid)
    .map((ev) => ev.text);
}

function readyCheckStartsFor(events: SimEvent[]): { pid: number | undefined; fromName: string }[] {
  return events
    .filter(
      (ev): ev is Extract<SimEvent, { type: 'readyCheckStart' }> => ev.type === 'readyCheckStart',
    )
    .map((ev) => ({ pid: ev.pid, fromName: ev.fromName }));
}

describe('/ready party ready check', () => {
  it('rejects a non-party-member', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    sim.tick();
    sim.chat('/ready', a);
    expect(errorText(sim.tick(), a)).toBe('You must be in a party to start a ready check.');
  });

  it('rejects a non-leader', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('mage', 'Bet');
    sim.tick();
    formParty(sim, a, [b]);
    sim.chat('/ready', b);
    expect(errorText(sim.tick(), b)).toBe('You are not the party leader.');
  });

  it('sends the readyCheckStart event to every other member, not the leader', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('mage', 'Bet');
    const c = sim.addPlayer('rogue', 'Gimel');
    sim.tick();
    formParty(sim, a, [b, c]);

    sim.chat('/ready', a);
    const starts = readyCheckStartsFor(sim.tick());
    expect(starts).toHaveLength(2);
    expect(starts.every((s) => s.fromName === 'Aleph')).toBe(true);
    expect(starts.map((s) => s.pid).sort()).toEqual([b, c].sort());
  });

  it('rejects starting a second check while one is in progress', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('mage', 'Bet');
    sim.tick();
    formParty(sim, a, [b]);

    sim.chat('/ready', a);
    sim.tick();
    sim.chat('/ready', a);
    expect(errorText(sim.tick(), a)).toBe('A ready check is already in progress.');
  });

  it('finalizes immediately once every member has answered, tallying counts-only', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('mage', 'Bet');
    const c = sim.addPlayer('rogue', 'Gimel');
    sim.tick();
    formParty(sim, a, [b, c]);

    sim.chat('/ready', a);
    sim.tick();
    sim.readyCheckRespond(true, b);
    sim.readyCheckRespond(false, c);
    const events = sim.tick();

    const summary = 'Ready check: 2 ready, 1 not ready, 0 no response.';
    expect(logTexts(events, a)).toContain(summary);
    expect(logTexts(events, b)).toContain(summary);
    expect(logTexts(events, c)).toContain(summary);
  });

  it('a member who never answers is tallied as no response after the timeout', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('mage', 'Bet');
    const c = sim.addPlayer('rogue', 'Gimel');
    sim.tick();
    formParty(sim, a, [b, c]);

    sim.chat('/ready', a);
    sim.tick();
    sim.readyCheckRespond(true, b);
    sim.tick();

    const events: SimEvent[] = [];
    for (let i = 0; i < 31 * 20; i++) events.push(...sim.tick());

    const summary = 'Ready check: 2 ready, 0 not ready, 1 no response.';
    expect(logTexts(events, a)).toContain(summary);
  });

  it('allows a new check once the previous one finalizes', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('mage', 'Bet');
    sim.tick();
    formParty(sim, a, [b]);

    sim.chat('/ready', a);
    sim.tick();
    sim.readyCheckRespond(true, b);
    sim.tick();

    sim.chat('/ready', a);
    const starts = readyCheckStartsFor(sim.tick());
    expect(starts).toHaveLength(1);
  });
});
