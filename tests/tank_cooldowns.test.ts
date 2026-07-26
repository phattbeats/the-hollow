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
import type { Aura, Entity, PlayerClass } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';

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

describe('Sacred Bulwark vs an active duel: the ward must not fire (upstream #1912 defeat-branch fix)', () => {
  // Duels already clamp the loser to 1 hp instead of killing them, so a
  // guardian_ward hit inside an active duel has no death to deny. Before the
  // fix the ward fired anyway: it spent the aura for nothing, the duel never
  // called ctx.endDuel, and the loser (below the 0.35 restore fraction) got a
  // free heal to 350 instead of the correct 1-hp duel clamp.

  function teleport(sim: Sim, pid: number, x: number, z: number) {
    const e = sim.entities.get(pid)!;
    e.pos.x = x;
    e.pos.z = z;
    e.pos.y = groundHeight(x, z, sim.cfg.seed);
    e.prevPos = { ...e.pos };
    (sim as any).rebucket(e);
  }

  // Start an accepted duel between two adjacent players and run the 3s
  // countdown out so the bout is live, same pattern as tests/duel.test.ts.
  function startedDuel(
    aClass: PlayerClass,
    bClass: PlayerClass,
  ): { sim: AnySim; a: number; b: number } {
    const sim = new Sim({ seed: 4242, playerClass: aClass, noPlayer: true }) as AnySim;
    const a = sim.addPlayer(aClass, 'Aleph', { autoEquip: true });
    const b = sim.addPlayer(bClass, 'Bet', { autoEquip: true });
    teleport(sim, a, 0, -40);
    teleport(sim, b, 4, -40);
    sim.duelRequest(b, a);
    sim.duelAccept(b);
    for (let i = 0; i < 20 * 4; i++) {
      sim.tick();
      const d = sim.duels.get(a);
      if (d && d.state === 'active') break;
    }
    return { sim, a, b };
  }

  it('does not fire against the duel opponent: loser clamps to 1 hp, duel ends, ward stays unspent', () => {
    const { sim, a, b } = startedDuel('warrior', 'paladin'); // b (paladin) is the loser
    const ea = sim.entities.get(a) as AnyEntity;
    const eb = sim.entities.get(b) as AnyEntity;
    eb.maxHp = 1000;
    eb.hp = 50; // well under the 0.35 restore fraction, so a wrongly-fired ward would heal past this
    eb.auras.push(guardianWardAura(0.35, eb.id));
    expect(sim.duels.get(a)?.state).toBe('active');
    sim.drainEvents();

    (sim as any).dealDamage(ea, eb, eb.hp + 1000, false, 'physical', 'Finisher', 'hit');

    // duel-clamp behavior, not ward behavior
    expect(eb.hp).toBe(1);
    expect(eb.dead).toBeFalsy();
    expect(sim.duels.has(a)).toBe(false);
    expect(sim.duels.has(b)).toBe(false);

    // the ward is still on the loser, unspent
    expect(eb.auras.some((au: Aura) => au.kind === 'guardian_ward')).toBe(true);
    const events = sim.drainEvents();
    const wardConsumeEvent = events.find(
      (e) => e.type === 'aura' && (e as any).name === 'Sacred Bulwark' && !(e as any).gained,
    );
    expect(wardConsumeEvent).toBeUndefined();
  });

  it('still denies a lethal hit for the same player against a hostile mob (the main path is intact)', () => {
    const sim = makeSim('paladin');
    sim.setPlayerLevel(20);
    const p = sim.player as AnyEntity;
    p.maxHp = 1000;
    p.hp = 50;
    const mob = spawnHostileMob(sim, 'forest_wolf', 5);
    p.auras.push(guardianWardAura(0.35, p.id));
    sim.drainEvents();

    dealDamage(sim.ctx, mob, p, 500, false, 'physical', null, 'hit');

    expect(p.dead).toBeFalsy();
    expect(p.hp).toBe(350); // round(1000 * 0.35), the normal ward restore
    expect(p.auras.some((au) => au.kind === 'guardian_ward')).toBe(false); // consumed
  });

  it('still denies a lethal hit in a ranked arena match (a real death-state defeat, not a duel clamp)', () => {
    const sim = new Sim({ seed: 4242, playerClass: 'warrior', noPlayer: true }) as AnySim;
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('paladin', 'Bet'); // b is the warded loser
    teleport(sim, a, 0, -40);
    teleport(sim, b, 6, -40);
    sim.arenaQueueJoin(a);
    sim.arenaQueueJoin(b);
    sim.tick(); // updateArena() matchmakes the pair

    for (let i = 0; i < 20 * 6; i++) {
      sim.tick();
      const m = sim.arenaMatchFor(a);
      if (m && m.state === 'active') break;
    }
    const match = sim.arenaMatchFor(a);
    expect(match?.state).toBe('active');

    const ea = sim.entities.get(a) as AnyEntity;
    const eb = sim.entities.get(b) as AnyEntity;
    eb.maxHp = 1000;
    eb.hp = 50;
    eb.auras.push(guardianWardAura(0.35, eb.id));
    sim.drainEvents();

    (sim as any).dealDamage(ea, eb, eb.hp + 1000, false, 'physical', 'Finisher', 'hit');

    expect(eb.dead).toBeFalsy();
    expect(eb.hp).toBe(350); // the normal ward restore, not the 0-hp arena elimination
    expect(eb.auras.some((au: Aura) => au.kind === 'guardian_ward')).toBe(false); // consumed
    expect(match?.defeated.has(b)).toBe(false);
    expect(sim.arenaMatchFor(a)?.state).toBe('active'); // match is still live, nobody was eliminated
  });

  // Fiesta arena takedowns are skipped: setting up a live fiesta match needs
  // the bot/queue machinery in social/fiesta.ts and social/fiesta_bots.ts
  // (see tests/fiesta.test.ts / fiesta_module.test.ts), which is disproportionate
  // scaffolding to add here on top of the duel and ranked-arena coverage above.
  // The duel guard change in damage.ts does not touch the fiesta branch at all
  // (fiesta's own guardianWardRestore === 0 check already short-circuits it when
  // the ward fires), so the risk this leaves uncovered is low.
});
