import { describe, expect, it } from 'vitest';
import { wireEntity } from '../server/game';
import { Sim } from '../src/sim/sim';
import type { Aura } from '../src/sim/types';

// PHAA-644: the aura wire serializer (server/game.ts dynamicFields) was rewritten from
// e.auras.map(...) + a conditional-spread-per-optional-field into a plain loop with direct
// property assignment, to cut per-tick GC pressure. This pins the wire output byte-identical
// across every optional-field combination so the GC-relief refactor cannot drift the protocol.
describe('aura wire serializer (GC relief)', () => {
  it('emits identical key order and values whether an optional field is present or absent', () => {
    const sim = new Sim({ seed: 11, playerClass: 'warrior', autoEquip: true });
    const pid = sim.playerId;
    const e = sim.entities.get(pid)!;

    const full: Aura = {
      id: 'judgement',
      name: 'Judgement',
      kind: 'buff_ap',
      remaining: 5.001,
      duration: 10,
      value: -3.0001,
      value2: 1,
      value3: 9,
      tickInterval: 2,
      sourceId: pid,
      school: 'fire',
      stacks: 3,
      charges: 2,
    };
    const minimal: Aura = {
      id: 'sunder_armor',
      name: 'Sunder Armor',
      kind: 'dot',
      remaining: 1,
      duration: 1,
      value: 0,
      sourceId: pid,
      school: 'physical',
      stacks: 1, // stacks <= 1 must stay OFF the wire
    };
    e.auras = [full, minimal];

    const w = wireEntity(e) as { auras: unknown[] };
    expect(w.auras).toHaveLength(2);
    // exact key order matters: JSON.stringify serializes objects in insertion order
    expect(Object.keys(w.auras[0] as object)).toEqual([
      'id',
      'name',
      'kind',
      'rem',
      'dur',
      'value',
      'value2',
      'value3',
      'tickInterval',
      'school',
      'stacks',
      'charges',
    ]);
    expect(w.auras[0]).toEqual({
      id: 'judgement',
      name: 'Judgement',
      kind: 'buff_ap',
      rem: 5,
      dur: 10,
      value: -3.0001,
      value2: 1,
      value3: 9,
      tickInterval: 2,
      school: 'fire',
      stacks: 3,
      charges: 2,
    });
    // minimal aura: every optional field absent, including stacks (<= 1) and school ('physical')
    expect(Object.keys(w.auras[1] as object)).toEqual([
      'id',
      'name',
      'kind',
      'rem',
      'dur',
      'value',
    ]);
    expect(w.auras[1]).toEqual({
      id: 'sunder_armor',
      name: 'Sunder Armor',
      kind: 'dot',
      rem: 1,
      dur: 1,
      value: 0,
    });
  });

  it('keeps a tiny negative value raw, not rounded to -0', () => {
    const sim = new Sim({ seed: 11, playerClass: 'warrior', autoEquip: true });
    const pid = sim.playerId;
    const e = sim.entities.get(pid)!;
    e.auras = [
      {
        id: 'weak',
        name: 'Weakened',
        kind: 'dot',
        remaining: 1,
        duration: 1,
        value: -0.0001,
        sourceId: pid,
        school: 'physical',
      },
    ];
    const w = wireEntity(e) as { auras: Array<{ value: number }> };
    expect(Object.is(w.auras[0].value, -0)).toBe(false);
    expect(JSON.stringify(w.auras[0].value)).toBe('-0.0001');
  });

  it('omits the auras field entirely when the entity has none', () => {
    const sim = new Sim({ seed: 11, playerClass: 'warrior', autoEquip: true });
    const e = sim.entities.get(sim.playerId)!;
    e.auras = [];
    const w = wireEntity(e) as Record<string, unknown>;
    expect('auras' in w).toBe(false);
  });
});
