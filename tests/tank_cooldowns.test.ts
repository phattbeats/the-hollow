// Upstream #1912: tank defensive cooldowns (PHAA-737 C). The three are deliberately
// distinct so timing matters:
//   - Ironhold (Warrior) is a flat mitigation wall read in damage.ts as the
//     `shield_wall` aura kind.
//   - Sacred Bulwark (Paladin) is a divine cheat-death: the `guardian_ward` aura
//     kind, consumed at lethal threshold by an enemy hit, restores a fraction of
//     maxHp, and emits a heal event.
//   - Primal Reflexes (Druid, bear form) is a dodge bonus surfaced via the existing
//     `buff_dodge` path; `usableInForm` lets the gate accept it while shapeshifted.
//
// Pinned by schema assertions (id/class/learnLevel/cooldown/effect/usability) and
// runtime assertions on the post-mitigation damage.ts pathway + the
// recalcPlayerStats fold for dodge.

import { describe, expect, it } from 'vitest';
import { dealDamage } from '../src/sim/combat/damage';
import { ABILITIES, abilitiesKnownAt, CLASSES } from '../src/sim/content/classes';
import { MOBS } from '../src/sim/data';
import { createMob, recalcPlayerStats } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Aura, Entity } from '../src/sim/types';

type AnyEntity = Entity & Record<string, any>;
type AnySim = Sim & Record<string, any>;

function makeSim(playerClass: 'warrior' | 'paladin' | 'druid' = 'warrior', seed = 4242): Sim {
  return new Sim({ seed, playerClass, autoEquip: true });
}

function spawnHostile(sim: Sim, key: string, level: number): AnyEntity {
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

function shieldWallAura(ownerId: number, value: number, id = 'ironhold'): Aura {
  return {
    id,
    name: 'Ironhold',
    kind: 'shield_wall',
    remaining: 8,
    duration: 8,
    value,
    sourceId: ownerId,
    school: 'physical',
  };
}

function guardianWardAura(ownerId: number, value = 0.35): Aura {
  return {
    id: 'sacred_bulwark',
    name: 'Sacred Bulwark',
    kind: 'guardian_ward',
    remaining: 10,
    duration: 10,
    value,
    sourceId: ownerId,
    school: 'holy',
  };
}

function dodgeBuffAura(ownerId: number, value = 0.5): Aura {
  return {
    id: 'primal_reflexes',
    name: 'Primal Reflexes',
    kind: 'buff_dodge',
    remaining: 6,
    duration: 6,
    value,
    sourceId: ownerId,
    school: 'nature',
  };
}

describe('Ironhold (Warrior defensive cooldown)', () => {
  it('is a warrior physical self-buff learned at level 20 with shield_wall kind', () => {
    const def = ABILITIES.ironhold;
    expect(def).toBeTruthy();
    expect(def.class).toBe('warrior');
    expect(def.learnLevel).toBe(20);
    expect(def.school).toBe('physical');
    expect(def.castTime).toBe(0);
    expect(def.offGcd).toBe(true);
    expect(def.effects).toEqual([
      { type: 'selfBuff', kind: 'shield_wall', value: 0.4, duration: 8 },
    ]);
  });

  it('is unknown at level 19 and known from level 20 in the warrior kit', () => {
    expect(abilitiesKnownAt('warrior', 19).map((k) => k.def.id)).not.toContain('ironhold');
    expect(abilitiesKnownAt('warrior', 20).map((k) => k.def.id)).toContain('ironhold');
  });

  it('damage.ts multiplies a post-mitigation hit by (1 - ward) for the strongest shield_wall', () => {
    // Two-clone diff: pin the strongest-wins semantic and the 0.4 ward's specific
    // 60% mitigation on a survivable hit. Without the ward the player would die
    // (1000 vs 812 max HP at level 20), so we raise HP to a value where both hits
    // are survivable AND a clear margin separates the 40% ward from the 60% ward.
    const simU = makeSim();
    simU.setPlayerLevel(20);
    const pU = simU.player as AnyEntity;
    pU.maxHp = 5000;
    pU.hp = 5000;

    const simW = makeSim();
    simW.setPlayerLevel(20);
    const pW = simW.player as AnyEntity;
    pW.maxHp = 5000;
    pW.hp = 5000;
    pW.auras.push(shieldWallAura(pW.id, 0.4));
    pW.auras.push(shieldWallAura(pW.id, 0.2, 'weaker_ward'));

    const mobU = spawnHostile(simU, 'forest_wolf', 5);
    const mobW = spawnHostile(simW, 'forest_wolf', 5);

    const incoming = 1000;
    dealDamage((simU as AnySim).ctx, mobU, pU, incoming, false, 'physical', null, 'hit');
    dealDamage((simW as AnySim).ctx, mobW, pW, incoming, false, 'physical', null, 'hit');

    const lostU = 5000 - pU.hp;
    const lostW = 5000 - pW.hp;

    // Warded victim loses ~60% of the unwarded amount (strongest ward wins, NOT
    // stacked 0.4+0.2=0.6). Allow rounding wiggle.
    expect(lostW).toBeLessThan(lostU);
    expect(Math.abs(lostW - lostU * 0.6)).toBeLessThanOrEqual(2);
    // Strongest wins: a 60% mitigation exactly, not the stacked 0.4+0.2=0.6 → 40% loss.
    expect(Math.abs(lostW - lostU * (1 - (0.4 + 0.2)))).toBeGreaterThan(2);
  });
});

describe('Sacred Bulwark (Paladin divine cheat-death)', () => {
  it('is a paladin holy self-buff learned at level 20 with guardian_ward kind', () => {
    const def = ABILITIES.sacred_bulwark;
    expect(def).toBeTruthy();
    expect(def.class).toBe('paladin');
    expect(def.learnLevel).toBe(20);
    expect(def.school).toBe('holy');
    expect(def.castTime).toBe(0);
    expect(def.offGcd).toBe(true);
    expect(def.effects).toEqual([
      { type: 'selfBuff', kind: 'guardian_ward', value: 0.35, duration: 10 },
    ]);
  });

  it('is unknown at level 19 and known from level 20 in the paladin kit', () => {
    expect(abilitiesKnownAt('paladin', 19).map((k) => k.def.id)).not.toContain('sacred_bulwark');
    expect(abilitiesKnownAt('paladin', 20).map((k) => k.def.id)).toContain('sacred_bulwark');
  });

  it('consumes the ward on a lethal enemy hit, restores 35% of maxHp, and emits a heal', () => {
    const sim = new Sim({ seed: 5, playerClass: 'paladin', autoEquip: true });
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.maxHp = 1000;
    p.hp = 100; // a 500-dmg hit would have been lethal.
    p.auras.push(guardianWardAura(p.id));

    const mob = spawnHostile(sim, 'forest_wolf', 5);
    sim.drainEvents();

    dealDamage((sim as AnySim).ctx, mob, p, 500, false, 'physical', null, 'hit');

    // ward spent.
    expect(p.auras.some((a: Aura) => a.kind === 'guardian_ward')).toBe(false);
    // survived (not at 0).
    expect(p.hp).toBeGreaterThan(0);
    // the heal event was emitted for 35% of maxHp = 350.
    const events = sim.drainEvents();
    const heal = events.find((e: any) => e.type === 'heal' && e.targetId === p.id) as any;
    expect(heal).toBeTruthy();
    expect(heal.amount).toBe(Math.round(p.maxHp * 0.35));
  });

  it('does NOT trigger when the incoming hit is non-lethal (gate requires lethal threshold)', () => {
    // damage.ts only consumes the ward when `target.hp - amount <= 0` AND the
    // attacker is hostile. A 100-HP player taking a 40-HP self-hit has both
    // conditions false: not lethal, and the source/target id match qualifies
    // as self. The ward must persist in either dimension.
    const sim = new Sim({ seed: 6, playerClass: 'paladin', autoEquip: true });
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.maxHp = 1000;
    p.hp = 1000;
    p.auras.push(guardianWardAura(p.id));

    // Non-lethal self-damage (no kill, ward still must not fire).
    dealDamage((sim as AnySim).ctx, p, p, 40, false, 'physical', null, 'hit');

    expect(p.auras.some((a: Aura) => a.kind === 'guardian_ward')).toBe(true);
  });

  it('consumes on a hostile-source lethal but leaves the ward on a non-lethal hit', () => {
    // Critical asymmetry: the ward exists for one-shot saves. A high-HP target
    // hit hard by a hostile mob but NOT taken to 0 must keep the ward for later.
    const sim = new Sim({ seed: 7, playerClass: 'paladin', autoEquip: true });
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.maxHp = 1000;
    p.hp = 1000;
    p.auras.push(guardianWardAura(p.id));

    const mob = spawnHostile(sim, 'forest_wolf', 5);
    dealDamage((sim as AnySim).ctx, mob, p, 100, false, 'physical', null, 'hit');

    expect(p.auras.some((a: Aura) => a.kind === 'guardian_ward')).toBe(true);
  });
});

describe('Primal Reflexes (Druid bear-form dodge cooldown)', () => {
  it('is a druid nature self-buff learned at level 20 with buff_dodge + usableInForm', () => {
    const def = ABILITIES.primal_reflexes;
    expect(def).toBeTruthy();
    expect(def.class).toBe('druid');
    expect(def.learnLevel).toBe(20);
    expect(def.school).toBe('nature');
    expect(def.usableInForm).toBe(true);
    expect(def.castTime).toBe(0);
    expect(def.cooldown).toBeGreaterThan(0);
    expect(def.effects).toEqual([
      { type: 'selfBuff', kind: 'buff_dodge', value: 0.5, duration: 6 },
    ]);
  });

  it('is unknown at level 19 and known from level 20 in the druid kit', () => {
    expect(abilitiesKnownAt('druid', 19).map((k) => k.def.id)).not.toContain('primal_reflexes');
    expect(abilitiesKnownAt('druid', 20).map((k) => k.def.id)).toContain('primal_reflexes');
    expect(CLASSES.druid.abilities).toContain('primal_reflexes');
  });

  it('is accepted by the casting gate while shapeshifted (usableInForm)', () => {
    // Without usableInForm, casting_lifecycle rejects every caster-kit ability
    // while in form with "You can't do that while shapeshifted." Primal Reflexes
    // must slip past because it opted in.
    const sim = new Sim({ seed: 13, playerClass: 'druid', autoEquip: true });
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.auras.push({
      id: 'bear_form',
      name: 'Bear Form',
      kind: 'form_bear',
      remaining: 30,
      duration: 30,
      sourceId: p.id,
    } as Aura);

    sim.drainEvents();
    sim.castAbility('primal_reflexes');
    const events = sim.drainEvents();
    expect(events.some((e: any) => e.type === 'error')).toBe(false);
    expect(p.auras.some((a: Aura) => a.id === 'primal_reflexes')).toBe(true);
  });

  it('a non-usableInForm caster-kit ability is rejected while shapeshifted', () => {
    // Defends the gating change: without usableInForm, the same cast in form
    // still emits the shapeshifted error (the gate is branch-scoped, not global).
    const sim = new Sim({ seed: 14, playerClass: 'druid', autoEquip: true });
    sim.setPlayerLevel(20);
    expect(ABILITIES.starfire.usableInForm).toBeFalsy();
    const p = sim.player as AnyEntity;
    p.auras.push({
      id: 'bear_form',
      name: 'Bear Form',
      kind: 'form_bear',
      remaining: 30,
      duration: 30,
      sourceId: p.id,
    } as Aura);

    sim.drainEvents();
    sim.castAbility('starfire');
    const events = sim.drainEvents();
    expect(events.some((e: any) => e.type === 'error')).toBe(true);
  });

  it('recalc folds the buff_dodge into the player dodgeChance stat', () => {
    // Use the top-level recalcPlayerStats from src/sim/entity.ts (the same path
    // haste_set_bonus.test.ts uses). mods is optional and is omitted.
    const sim = new Sim({ seed: 17, playerClass: 'druid', autoEquip: true });
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    const before = p.dodgeChance;
    p.auras.push(dodgeBuffAura(p.id, 0.5));
    const eq: any = (p as any).equipment ?? {};
    recalcPlayerStats(p, 'druid' as any, eq);
    const after = p.dodgeChance;
    // dodgeChance floor is 0.05 base + agi*0.0005 + bonusDodge (entity.ts:353).
    // Adding 0.5 contributes exactly 0.5 to bonusDodge (modulo base+agi contribution
    // which is unchanged between the two recalcs).
    expect(after).toBeGreaterThan(before);
    expect(Math.abs(after - (before + 0.5))).toBeLessThanOrEqual(0.0001);
  });
});
