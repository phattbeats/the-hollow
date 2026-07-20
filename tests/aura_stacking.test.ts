// Direct + integration tests for src/sim/combat/aura_stacking.ts (upstream #1711):
// a fixed list of group buffs (Blessing of Might, Arcane Intellect, Power Word:
// Fortitude, Mark of the Wild, Battle Shout, Devotion Aura) replace across casters
// instead of stacking one aura per source. Everything else keeps the existing
// per-source stacking rule.

import { describe, expect, it } from 'vitest';
import { auraReplacementConflicts } from '../src/sim/combat/aura_stacking';
import { Sim } from '../src/sim/sim';
import type { Aura, Entity } from '../src/sim/types';

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
}

const ready = (sim: Sim, pid: number) => {
  const e = sim.entities.get(pid)!;
  e.resource = e.maxResource;
};

function blessingAura(sourceId: number, value: number, remaining = 300): Aura {
  return {
    id: 'blessing_of_might',
    name: 'Blessing of Might',
    kind: 'buff_ap',
    remaining,
    duration: remaining,
    value,
    sourceId,
    school: 'holy',
  };
}

describe('auraReplacementConflicts', () => {
  it('replaces an existing group buff regardless of source', () => {
    const auras: Aura[] = [blessingAura(1, 15), blessingAura(2, 15)];
    const conflicts = auraReplacementConflicts(auras, blessingAura(3, 30));
    expect(conflicts.sort()).toEqual([0, 1]);
  });

  it('leaves a non-group buff alone unless the source matches', () => {
    const shield: Aura = {
      id: 'power_word_shield',
      name: 'Power Word: Shield',
      kind: 'absorb',
      remaining: 30,
      duration: 30,
      value: 100,
      sourceId: 1,
      school: 'holy',
    };
    const sameSource = auraReplacementConflicts([shield], { ...shield, value: 200 });
    expect(sameSource).toEqual([0]);

    const otherSource = auraReplacementConflicts([shield], { ...shield, sourceId: 2 });
    expect(otherSource).toEqual([]);
  });
});

describe('group buffs replace across casters', () => {
  it('replaces the previous Blessing of Might from another caster', () => {
    const sim = makeWorld();
    const first = sim.addPlayer('paladin', 'Ald');
    const second = sim.addPlayer('paladin', 'Borin');
    const targetId = sim.addPlayer('warrior', 'War');
    const target = sim.entities.get(targetId)!;
    sim.setPlayerLevel(4, first);
    sim.setPlayerLevel(4, second);

    ready(sim, first);
    sim.targetEntity(targetId, first);
    sim.castAbility('blessing_of_might', first);
    expect(target.auras.filter((a) => a.id === 'blessing_of_might')).toHaveLength(1);

    ready(sim, second);
    sim.targetEntity(targetId, second);
    sim.castAbility('blessing_of_might', second);

    const blessings = target.auras.filter((a) => a.id === 'blessing_of_might');
    expect(blessings).toHaveLength(1);
    expect(blessings[0].sourceId).toBe(second);
  });

  it('keeps per-source stacking for auras outside the group-buff list', () => {
    const sim = makeWorld();
    const first = sim.addPlayer('warrior', 'Ald');
    const second = sim.addPlayer('warrior', 'Borin');
    const targetId = sim.addPlayer('warrior', 'War');
    const target = sim.entities.get(targetId)! as Entity & Record<string, unknown>;

    (sim as unknown as { applyAura(target: Entity, aura: Aura): void }).applyAura(target, {
      id: 'rend',
      name: 'Rend',
      kind: 'dot',
      remaining: 15,
      duration: 15,
      value: 10,
      sourceId: first,
      school: 'physical',
    });
    (sim as unknown as { applyAura(target: Entity, aura: Aura): void }).applyAura(target, {
      id: 'rend',
      name: 'Rend',
      kind: 'dot',
      remaining: 15,
      duration: 15,
      value: 10,
      sourceId: second,
      school: 'physical',
    });

    expect((target.auras as Aura[]).filter((a) => a.id === 'rend')).toHaveLength(2);
  });
});
