// PHAA-577: percent whole-group raid buffs + a percent armor debuff (Board-approved
// exception to the classic-era flat-buff formula, see docs/design/percent-raid-buffs.md).
// State-validation + determinism coverage for the two new sim primitives:
//   - AbilityEffect 'buffTarget' with `party: true` (whole party/raid delivery)
//   - AuraKind buff_ap_pct/buff_sta_pct/buff_armor_pct/buff_int_pct (percent stat fold)
//   - AbilityEffect 'armorDebuffPct' / AuraKind debuff_armor_pct (percent armor debuff)
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { dist2d, type Entity } from '../src/sim/types';
import { terrainHeight } from '../src/sim/world';

function nearestMob(sim: Sim, templateId: string): Entity {
  const p = sim.player;
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const e of sim.entities.values()) {
    if (e.kind !== 'mob' || e.dead || e.ownerId !== null || e.templateId !== templateId) continue;
    const d = dist2d(p.pos, e.pos);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best!;
}

function teleport(sim: Sim, e: Entity, x: number, z: number) {
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = terrainHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
}

function partyOfThree(seed = 42) {
  const sim = new Sim({ seed, playerClass: 'warrior', autoEquip: true });
  const a = sim.playerId;
  const b = sim.addPlayer('priest', 'Priest');
  const c = sim.addPlayer('mage', 'Mage');
  sim.partyInvite(b, a);
  sim.partyAccept(b);
  sim.partyInvite(c, a);
  sim.partyAccept(c);
  return { sim, a, b, c };
}

describe('PHAA-577 percent whole-group raid buffs', () => {
  it('Battle Shout lands on the caster and every party member, not just the caster', () => {
    const { sim, a, b, c } = partyOfThree();
    const player = sim.entities.get(a)!;
    const priest = sim.entities.get(b)!;
    const mage = sim.entities.get(c)!;
    const apBefore = { a: player.attackPower, b: priest.attackPower, c: mage.attackPower };

    player.resource = 100;
    sim.castAbility('battle_shout', a);

    for (const [id, before] of [
      [a, apBefore.a],
      [b, apBefore.b],
      [c, apBefore.c],
    ] as const) {
      const e = sim.entities.get(id)!;
      expect(e.auras.some((au) => au.id === 'battle_shout')).toBe(true);
      expect(e.attackPower).toBeGreaterThan(before);
    }
  });

  it('folds the percent as a percent of the fully-summed stat, not a flat add', () => {
    const sim = new Sim({ seed: 42, playerClass: 'druid', autoEquip: true });
    const p = sim.player;
    const armorBefore = p.stats.armor;
    p.resource = 100;
    sim.castAbility('mark_of_the_wild');
    // rank 1 at level 1 is +5%
    expect(p.stats.armor).toBe(Math.round(armorBefore * 1.05));
  });

  it('a whole-group buff still lands on an explicit friendly target outside the party', () => {
    const sim = new Sim({ seed: 42, playerClass: 'priest', autoEquip: true });
    const p = sim.player;
    const otherId = sim.addPlayer('warrior', 'Lonewolf'); // not partied with the priest
    const other = sim.entities.get(otherId)!;
    const otherMaxHpBefore = other.maxHp;
    p.resource = 100;
    sim.targetEntity(otherId);
    sim.castAbility('power_word_fortitude');
    expect(other.auras.some((a) => a.id === 'power_word_fortitude')).toBe(true);
    expect(other.maxHp).toBeGreaterThan(otherMaxHpBefore);
  });

  it('is deterministic: casting the same buff in the same party produces identical auras', () => {
    const run = () => {
      const { sim, a, b, c } = partyOfThree(7);
      sim.entities.get(a)!.resource = 100;
      sim.castAbility('commanding_shout', a);
      return [a, b, c].map((id) => {
        const e = sim.entities.get(id)!;
        return { id, sta: e.stats.sta, aura: e.auras.find((au) => au.id === 'commanding_shout') };
      });
    };
    expect(run()).toEqual(run());
  });
});

describe('PHAA-577 percent armor debuff', () => {
  it('Sunder Armor reduces armor multiplicatively and stacks up to 5', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior', autoEquip: true });
    sim.setPlayerLevel(10);
    const p = sim.player;
    const wolf = nearestMob(sim, 'forest_wolf');
    wolf.maxHp = 5000;
    wolf.hp = 5000; // keep it alive through scripted casts (death wipes auras)
    wolf.stats.armor = 200;
    teleport(sim, p, wolf.pos.x + 2, wolf.pos.z);
    sim.targetEntity(wolf.id);
    p.facing = Math.atan2(wolf.pos.x - p.pos.x, wolf.pos.z - p.pos.z);
    const armorBefore = (
      sim as unknown as { effectiveArmor(e: typeof wolf): number }
    ).effectiveArmor(wolf);

    let stacks = 0;
    for (let guard = 0; guard < 40 && stacks < 5; guard++) {
      p.resource = 100;
      sim.castAbility('sunder_armor');
      for (let i = 0; i < 32; i++) sim.tick();
      const aura = wolf.auras.find((a) => a.kind === 'debuff_armor_pct');
      stacks = aura?.stacks ?? stacks;
    }
    expect(stacks).toBe(5);
    const effectiveArmor = (
      sim as unknown as { effectiveArmor(e: typeof wolf): number }
    ).effectiveArmor(wolf);
    expect(effectiveArmor).toBeCloseTo(armorBefore * (1 - 0.02 * 5));
  });

  it('never touches mob corrosion (the flat sunder AuraKind stays flat)', () => {
    // A synthetic mob-corrosion-shaped aura on the flat 'sunder' kind must still
    // subtract a FLAT amount, unaffected by the new percent debuff path.
    const sim = new Sim({ seed: 42, playerClass: 'warrior', autoEquip: true });
    const wolf = nearestMob(sim, 'forest_wolf');
    wolf.stats.armor = 200;
    wolf.auras.push({
      id: 'corrode_test',
      name: 'Corrosive Bite',
      kind: 'sunder',
      remaining: 30,
      duration: 30,
      value: 15,
      stacks: 2,
      sourceId: wolf.id,
      school: 'nature',
    });
    const effectiveArmor = (
      sim as unknown as { effectiveArmor(e: typeof wolf): number }
    ).effectiveArmor(wolf);
    expect(effectiveArmor).toBe(200 - 15 * 2);
  });
});
