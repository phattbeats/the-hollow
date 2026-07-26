// Tests for the three v0.26.0 tank defensive cooldowns (upstream #1912):
// - warrior Ironhold (shield_wall aura, damage.ts): flat, non-stacking damage
//   reduction from any source/school.
// - paladin Sacred Bulwark (guardian_ward aura, damage.ts): a cheat-death that
//   denies a lethal ENEMY hit, clamps overkill, and restores a health fraction.
// - druid Primal Reflexes (usableInForm, casting_lifecycle.ts): a class-kit
//   ability usable while shapeshifted, unlike the rest of the druid caster kit.
//
// Drives the real dealDamage/castAbility paths against a real Sim.ctx, the same
// pattern as tests/combat_damage.test.ts and tests/combat_casting_lifecycle.test.ts.

import { describe, expect, it } from 'vitest';
import { dealDamage } from '../src/sim/combat/damage';
import { ABILITIES, CLASSES } from '../src/sim/content/classes';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Aura, Entity } from '../src/sim/types';

type AnyEntity = Entity & Record<string, any>;
type AnySim = Sim & Record<string, any>;

function makeSim(cls: 'warrior' | 'paladin' | 'druid', seed = 4242): AnySim {
  return new Sim({ seed, playerClass: cls, autoEquip: true }) as AnySim;
}

function spawnHostileMob(sim: AnySim, key: string, level: number): AnyEntity {
  const p = sim.player as AnyEntity;
  const mob = createMob(sim.nextId++, MOBS[key], level, {
    x: p.pos.x + 2,
    y: p.pos.y,
    z: p.pos.z,
  }) as AnyEntity;
  mob.hostile = true;
  sim.addEntity(mob);
  return mob;
}

function shieldWallAura(value: number, sourceId: number): Aura {
  return {
    id: `ironhold_${sourceId}`,
    name: 'Ironhold',
    kind: 'shield_wall',
    remaining: 8,
    duration: 8,
    value,
    sourceId,
    school: 'physical',
  } as Aura;
}

function guardianWardAura(value: number, sourceId: number): Aura {
  return {
    id: 'sacred_bulwark',
    name: 'Sacred Bulwark',
    kind: 'guardian_ward',
    remaining: 10,
    duration: 10,
    value,
    sourceId,
    school: 'holy',
  } as Aura;
}

describe('Ironhold (shield_wall aura): flat damage-taken reduction', () => {
  it('reduces incoming damage by the aura fraction, any source/school', () => {
    const sim = makeSim('warrior');
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.maxHp = 10000;
    p.hp = 10000;
    const mob = spawnHostileMob(sim, 'forest_wolf', 5);
    p.auras.push(shieldWallAura(0.4, p.id));

    dealDamage(sim.ctx, mob, p, 100, false, 'fire', null, 'hit');

    expect(p.hp).toBe(9940); // 100 * (1 - 0.4) = 60 lands
  });

  it('does not stack: two shield_wall auras use the strongest ward, not additive', () => {
    const sim = makeSim('warrior');
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.maxHp = 10000;
    p.hp = 10000;
    const mob = spawnHostileMob(sim, 'forest_wolf', 5);
    p.auras.push(shieldWallAura(0.4, p.id));
    p.auras.push(shieldWallAura(0.6, mob.id)); // a stronger ward from another source

    dealDamage(sim.ctx, mob, p, 100, false, 'physical', null, 'hit');

    // strongest ward (0.6) wins, not 1 - (0.4 + 0.6) or a double reduction
    expect(p.hp).toBe(9960); // 100 * (1 - 0.6) = 40 lands
  });
});

describe('Sacred Bulwark (guardian_ward aura): cheat-death vs an enemy lethal hit', () => {
  it('denies a lethal enemy hit, clamps overkill, restores value*maxHp, and consumes the aura', () => {
    const sim = makeSim('paladin');
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.maxHp = 1000;
    p.hp = 50; // a 500-damage swing would be lethal several times over
    const mob = spawnHostileMob(sim, 'forest_wolf', 5);
    p.auras.push(guardianWardAura(0.35, p.id));
    sim.drainEvents();

    dealDamage(sim.ctx, mob, p, 500, false, 'physical', null, 'hit');

    expect(p.dead).toBeFalsy();
    expect(p.hp).toBe(350); // round(1000 * 0.35)
    expect(p.auras.some((a) => a.kind === 'guardian_ward')).toBe(false); // consumed

    const events = sim.drainEvents();
    const auraEvent = events.find(
      (e) =>
        e.type === 'aura' && (e as any).targetId === p.id && (e as any).name === 'Sacred Bulwark',
    ) as any;
    expect(auraEvent).toBeTruthy();
    expect(auraEvent.gained).toBe(false);

    const dmgEvent = events.find((e) => e.type === 'damage' && (e as any).targetId === p.id) as any;
    expect(dmgEvent.amount).toBe(50); // clamped to the health actually lost (50 -> 0)
  });

  it('is not reusable: the next lethal hit after consumption is not denied', () => {
    const sim = makeSim('paladin');
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.maxHp = 1000;
    p.hp = 50;
    const mob = spawnHostileMob(sim, 'forest_wolf', 5);
    p.auras.push(guardianWardAura(0.35, p.id));

    dealDamage(sim.ctx, mob, p, 500, false, 'physical', null, 'hit'); // consumes the ward
    expect(p.dead).toBeFalsy();
    expect(p.hp).toBe(350);

    dealDamage(sim.ctx, mob, p, 500, false, 'physical', null, 'hit'); // no ward left

    expect(p.hp).toBe(0);
    expect(p.dead).toBe(true);
  });

  it('does not trigger on self-inflicted damage', () => {
    const sim = makeSim('paladin');
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.maxHp = 1000;
    p.hp = 50;
    p.auras.push(guardianWardAura(0.35, p.id));
    sim.drainEvents();

    dealDamage(sim.ctx, p, p, 500, false, 'fire', null, 'hit');

    // the ward did not deny the blow: the player actually dies (death clears
    // all auras as a side effect, so absence of the aura alone would not prove
    // the ward went untouched; the death itself, plus no consume event, does).
    expect(p.hp).toBe(0);
    expect(p.dead).toBe(true);
    const consumeEvent = sim
      .drainEvents()
      .find((e) => e.type === 'aura' && (e as any).name === 'Sacred Bulwark' && !(e as any).gained);
    expect(consumeEvent).toBeUndefined();
  });

  it('does not trigger on sourceless damage (e.g. environmental)', () => {
    const sim = makeSim('paladin');
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.maxHp = 1000;
    p.hp = 50;
    p.auras.push(guardianWardAura(0.35, p.id));
    sim.drainEvents();

    dealDamage(sim.ctx, null, p, 500, false, 'fire', null, 'hit');

    expect(p.hp).toBe(0);
    expect(p.dead).toBe(true);
    const consumeEvent = sim
      .drainEvents()
      .find((e) => e.type === 'aura' && (e as any).name === 'Sacred Bulwark' && !(e as any).gained);
    expect(consumeEvent).toBeUndefined();
  });
});

describe('Primal Reflexes: usableInForm opts a druid ability into shapeshift casting', () => {
  function giveBearForm(sim: AnySim, p: AnyEntity) {
    p.auras.push({
      id: 'bear_form',
      name: 'Bear Form',
      kind: 'form_bear',
      remaining: 3600,
      duration: 3600,
      value: 1,
      sourceId: p.id,
      school: 'physical',
    } as Aura);
  }

  it('lets a shapeshifted druid cast primal_reflexes', () => {
    const sim = makeSim('druid');
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.resource = p.maxResource;
    giveBearForm(sim, p);
    sim.drainEvents();

    sim.castAbility('primal_reflexes');

    expect(p.auras.some((a) => a.kind === 'buff_dodge')).toBe(true);
    const errors = sim
      .drainEvents()
      .filter((e) => e.type === 'error')
      .map((e: any) => e.text);
    expect(errors).not.toContain("You can't do that while shapeshifted.");
  });

  it('still blocks a normal (non-form, non-usableInForm) class-kit ability while shapeshifted', () => {
    const sim = makeSim('druid');
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.resource = p.maxResource;
    giveBearForm(sim, p);
    sim.drainEvents();

    sim.castAbility('starfire'); // ordinary caster-kit spell, not usableInForm

    const errors = sim
      .drainEvents()
      .filter((e) => e.type === 'error')
      .map((e: any) => e.text);
    expect(errors).toContain("You can't do that while shapeshifted.");
    expect(p.castingAbility).toBeFalsy();
  });
});

describe('tank cooldown content: kit membership and AbilityDef shape', () => {
  it('ironhold is in the warrior kit and well formed', () => {
    expect(CLASSES.warrior.abilities).toContain('ironhold');
    const a = ABILITIES.ironhold;
    expect(a.class).toBe('warrior');
    expect(a.learnLevel).toBeGreaterThan(0);
    expect(a.cooldown).toBeGreaterThan(0);
    const buff = a.effects.find((e) => e.type === 'selfBuff') as any;
    expect(buff).toBeTruthy();
    expect(buff.kind).toBe('shield_wall');
    expect(buff.value).toBeGreaterThan(0);
    expect(buff.value).toBeLessThan(1);
    expect(buff.duration).toBeGreaterThan(0);
    expect(a.description).toContain('40%');
    expect(a.description).toContain('8 sec');
  });

  it('sacred_bulwark is in the paladin kit and well formed', () => {
    expect(CLASSES.paladin.abilities).toContain('sacred_bulwark');
    const a = ABILITIES.sacred_bulwark;
    expect(a.class).toBe('paladin');
    expect(a.learnLevel).toBeGreaterThan(0);
    expect(a.cooldown).toBeGreaterThan(0);
    const buff = a.effects.find((e) => e.type === 'selfBuff') as any;
    expect(buff).toBeTruthy();
    expect(buff.kind).toBe('guardian_ward');
    expect(buff.value).toBeGreaterThan(0);
    expect(buff.value).toBeLessThan(1);
    expect(buff.duration).toBeGreaterThan(0);
    expect(a.description).toContain('35%');
    expect(a.description).toContain('10 sec');
  });

  it('primal_reflexes is in the druid kit, usableInForm, and well formed', () => {
    expect(CLASSES.druid.abilities).toContain('primal_reflexes');
    const a = ABILITIES.primal_reflexes;
    expect(a.class).toBe('druid');
    expect(a.usableInForm).toBe(true);
    expect(a.learnLevel).toBeGreaterThan(0);
    expect(a.cooldown).toBeGreaterThan(0);
    const buff = a.effects.find((e) => e.type === 'selfBuff') as any;
    expect(buff).toBeTruthy();
    expect(buff.kind).toBe('buff_dodge');
    expect(buff.value).toBeGreaterThan(0);
    expect(buff.duration).toBeGreaterThan(0);
    expect(a.description).toContain('50%');
    expect(a.description).toContain('6 sec');
  });
});
