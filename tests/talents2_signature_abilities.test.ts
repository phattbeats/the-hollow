// Direct runtime coverage for the new determinism-bearing mechanics ported by
// PHAA-715 (Talents 2.0, upstream #1543): Chain Heal's deterministic bounce
// targeting and Fiendlore's pet-damage redirect. Both are exercised through the
// real cast/damage pipeline (not by calling the effect_dispatch cases directly),
// so a regression in the hop-selection ladder or the alreadyFinal plumbing shows
// up here instead of only in a parity golden.

import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';

function readyToCast(sim: Sim, pid: number): void {
  const e = sim.entities.get(pid)!;
  e.resource = e.maxResource;
  e.gcdRemaining = 0;
  e.castingAbility = null;
}

// Chain Heal has a 2.5s cast time: castAbility only STARTS the cast, so drive it to
// completion (tick well past the cast) before reading the result.
function castHealAndFinish(sim: Sim, id: string, casterId: number): void {
  sim.castAbility(id, casterId);
  for (let i = 0; i < 20 * 6 && sim.entities.get(casterId)?.castingAbility; i++) sim.tick();
}

describe('Chain Heal (Restoration shaman signature, PHAA-715)', () => {
  function setUpChainHealScenario(seed: number) {
    const sim = new Sim({ seed, playerClass: 'shaman', noPlayer: true });
    const healerId = sim.addPlayer('shaman', 'Healer');
    sim.setPlayerLevel(20, healerId);
    expect(sim.setSpec('restoration', healerId)).toBe(true);
    const healer = sim.entities.get(healerId)!;

    // Three allies at the same spot as the healer (within Chain Heal's 12yd radius),
    // damaged to different fractions so the most-injured-first ladder is unambiguous.
    const allyIds = [
      sim.addPlayer('warrior', 'MostHurt'),
      sim.addPlayer('warrior', 'MidHurt'),
      sim.addPlayer('warrior', 'LeastHurt'),
    ];
    const fractions = [0.2, 0.5, 0.8];
    for (let i = 0; i < allyIds.length; i++) {
      const a = sim.entities.get(allyIds[i])!;
      a.pos = { ...healer.pos };
      a.hp = Math.max(1, Math.round(a.maxHp * fractions[i]));
    }
    readyToCast(sim, healerId);
    return { sim, healerId, allyIds };
  }

  it('heals the most-injured target first, then the next-most-injured, deterministically', () => {
    const { sim, healerId, allyIds } = setUpChainHealScenario(9001);

    const before = allyIds.map((id) => sim.entities.get(id)!.hp);
    sim.targetEntity(allyIds[0], healerId);
    castHealAndFinish(sim, 'chain_heal', healerId);

    const after = allyIds.map((id) => sim.entities.get(id)!.hp);
    // All three allies are within chain_heal's radius/jump budget (jumps: 2 => primary
    // + 2 hops = 3 targets), so every ally should have been healed...
    expect(after[0]).toBeGreaterThan(before[0]);
    expect(after[1]).toBeGreaterThan(before[1]);
    expect(after[2]).toBeGreaterThan(before[2]);
    // ...but each hop heals 50% less than the last (falloff 0.5), so the primary
    // target (most injured, explicitly targeted) gained strictly more than the
    // first hop, which gained strictly more than the second hop.
    const gained = [after[0] - before[0], after[1] - before[1], after[2] - before[2]];
    expect(gained[0]).toBeGreaterThan(gained[1]);
    expect(gained[1]).toBeGreaterThan(gained[2]);
  });

  it('is deterministic: identical world state produces identical heal amounts on replay', () => {
    const run1 = setUpChainHealScenario(4242);
    sim1Cast(run1);
    const hp1 = run1.allyIds.map((id) => run1.sim.entities.get(id)!.hp);

    const run2 = setUpChainHealScenario(4242);
    sim1Cast(run2);
    const hp2 = run2.allyIds.map((id) => run2.sim.entities.get(id)!.hp);

    expect(hp2).toEqual(hp1);

    function sim1Cast(run: ReturnType<typeof setUpChainHealScenario>): void {
      run.sim.targetEntity(run.allyIds[0], run.healerId);
      castHealAndFinish(run.sim, 'chain_heal', run.healerId);
    }
  });
});

// Drive a cast (e.g. summon_imp) to completion: 6-10s casts, so tick well past it.
function castAndFinish(sim: Sim, id: string, pid: number): void {
  sim.castAbility(id, pid);
  for (let i = 0; i < 20 * 12 && sim.entities.get(pid)?.castingAbility; i++) sim.tick();
}

describe('Fiendlore pet-damage redirect (Demonology warlock mastery, PHAA-715)', () => {
  it('redirects a share of incoming damage to a living demon without double-applying source mods', () => {
    const sim = new Sim({ seed: 77, playerClass: 'warlock', noPlayer: true });
    const warlockId = sim.addPlayer('warlock', 'Lock');
    sim.setPlayerLevel(20, warlockId);
    expect(sim.setSpec('demonology', warlockId)).toBe(true); // petDmgSharePct 0.2
    const warlock = sim.entities.get(warlockId)!;

    const attackerId = sim.addPlayer('warrior', 'Attacker');
    const attacker = sim.entities.get(attackerId)!;
    attacker.pos = { ...warlock.pos };
    attacker.hostile = true;

    castAndFinish(sim, 'summon_imp', warlockId);
    const pet = sim.petOf(warlockId);
    expect(pet).not.toBeNull();
    const petHpBefore = pet!.hp;
    const warlockHpBefore = warlock.hp;

    const dealt = 1000;
    sim.dealDamage(attacker, warlock, dealt, false, 'physical', 'test', 'hit');

    const petHpAfter = pet!.hp;
    const warlockHpAfter = warlock.hp;
    const petDamageTaken = petHpBefore - petHpAfter;
    const warlockDamageTaken = warlockHpBefore - warlockHpAfter;

    // ~20% redirected to the pet, ~80% stays on the warlock (both floor at 1 hp/no
    // overkill semantics aside, so allow the actual clamped amounts to differ from
    // the raw math but still land in the right ballpark and sum close to `dealt`).
    expect(petDamageTaken).toBeGreaterThan(0);
    expect(warlockDamageTaken).toBeGreaterThan(0);
    expect(petDamageTaken + warlockDamageTaken).toBeLessThanOrEqual(dealt);
    expect(petDamageTaken / dealt).toBeGreaterThan(0.1);
    expect(petDamageTaken / dealt).toBeLessThan(0.3);
  });
});
