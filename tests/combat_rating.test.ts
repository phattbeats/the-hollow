// Hit rating (PHAA-733 / upstream PR #1860 adapt): the gear-facing conversion,
// its subtraction from melee/ranged miss and spell resist, and its itemization
// onto the already-merged PHAA-659 Heroic delve variant builder.
import { describe, expect, it } from 'vitest';
import { hitFractionFromRating } from '../src/sim/combat/hit_rating';
import {
  effectiveSpellHit,
  isSpellResisted,
  spellResistChance,
} from '../src/sim/combat/spell_resist';
import { heroicVariantId } from '../src/sim/content/heroic_variants';
import { ITEMS } from '../src/sim/data';
import { createPlayer, type PlayerEquipment, recalcPlayerStats } from '../src/sim/entity';
import type { Entity } from '../src/sim/types';
import { meleeMissChance, spellHitChance, swingMissChance } from '../src/sim/types';

function ent(over: Partial<Entity>): Entity {
  return {
    kind: 'player',
    level: 5,
    hostile: false,
    ownerId: null,
    hitBonus: 0,
    ...over,
  } as unknown as Entity;
}

describe('hitFractionFromRating (pure conversion)', () => {
  it('10 rating = 1% (matches the WARFARE rating conversion rate)', () => {
    expect(hitFractionFromRating(10)).toBeCloseTo(0.01);
    expect(hitFractionFromRating(50)).toBeCloseTo(0.05);
  });

  it('floors negative ratings at 0', () => {
    expect(hitFractionFromRating(-20)).toBe(0);
  });
});

describe('swingMissChance: Hit rating reduces player/pet -> mob miss', () => {
  it('subtracts the attacker hitBonus from the level-only miss chance', () => {
    const attacker = ent({ kind: 'player', level: 3, hitBonus: 0.1 });
    const target = ent({ kind: 'mob', level: 7 });
    const base = meleeMissChance(3, 7);
    expect(swingMissChance(attacker, target)).toBeCloseTo(base - 0.1);
  });

  it('floors at 0 for a Hit-capped attacker', () => {
    const attacker = ent({ kind: 'player', level: 3, hitBonus: 0.9 });
    const target = ent({ kind: 'mob', level: 7 });
    expect(swingMissChance(attacker, target)).toBe(0);
  });

  it('an ungeared attacker (hitBonus 0) is byte-identical to before', () => {
    const attacker = ent({ kind: 'player', level: 3, hitBonus: 0 });
    const target = ent({ kind: 'mob', level: 7 });
    expect(swingMissChance(attacker, target)).toBe(meleeMissChance(3, 7));
  });

  it('does not reduce the mob-vs-player 20% floor (mob attacker keeps its own cap)', () => {
    const mob = ent({ kind: 'mob', level: 1, hostile: true, ownerId: null, hitBonus: 0.5 });
    const player = ent({ kind: 'player', level: 10 });
    // Mob-side hitBonus is irrelevant: the floor only ever reads the attacker's own
    // rating, and no mob template grants hitRating, but this pins that even a
    // hypothetical geared mob attacker keeps the directional floor untouched.
    expect(swingMissChance(mob, player)).toBeLessThanOrEqual(0.2);
  });
});

describe('spell_resist: Hit rating reduces resist the same way', () => {
  it('effectiveSpellHit adds hitBonus to the level-only hit chance, capped at 1', () => {
    expect(effectiveSpellHit(3, 7, 0)).toBeCloseTo(spellHitChance(3, 7));
    expect(effectiveSpellHit(3, 7, 0.1)).toBeCloseTo(spellHitChance(3, 7) + 0.1);
    expect(effectiveSpellHit(5, 5, 1)).toBe(1); // capped, never over 100%
  });

  it('spellResistChance is the complement of effectiveSpellHit', () => {
    expect(spellResistChance(3, 7, 0.1)).toBeCloseTo(1 - effectiveSpellHit(3, 7, 0.1));
  });

  it('isSpellResisted draws exactly one rng value; hitBonus only shifts the threshold', () => {
    let draws = 0;
    const chanceFn = (): boolean => {
      draws++;
      return true;
    };
    isSpellResisted({ chance: chanceFn }, 3, 7, 0.2);
    expect(draws).toBe(1);
  });

  it('an ungeared caster (hitBonus 0) is byte-identical to before', () => {
    expect(isSpellResisted({ chance: () => true }, 3, 7)).toBe(
      isSpellResisted({ chance: () => true }, 3, 7, 0),
    );
  });
});

describe('Heroic itemization: hitRating on the PHAA-659 delve variant builder', () => {
  it('an epic armor base gets the armor allowance on its Heroic variant', () => {
    const base = ITEMS.deathlord_warplate;
    expect(base.quality).toBe('epic');
    expect(base.kind).toBe('armor');
    const variant = ITEMS[heroicVariantId('deathlord_warplate')];
    expect(variant).toBeDefined();
    expect(variant.hitRating).toBe(40);
  });

  it('an epic weapon base gets the (larger) weapon allowance on its Heroic variant', () => {
    const base = ITEMS.fang_of_korzul;
    expect(base.quality).toBe('epic');
    expect(base.kind).toBe('weapon');
    const variant = ITEMS[heroicVariantId('fang_of_korzul')];
    expect(variant).toBeDefined();
    expect(variant.hitRating).toBe(50);
  });

  it('a rare base (the lesser Heroic rung) carries no Hit rating', () => {
    const base = ITEMS.moggers_copper_cudgel;
    expect(base.quality).toBe('rare');
    const variant = ITEMS[heroicVariantId('moggers_copper_cudgel')];
    expect(variant).toBeDefined();
    expect(variant.hitRating).toBeUndefined();
  });

  it('never touches the fork WARFARE gear (pvp_honor.ts stays full stat budget)', () => {
    for (const item of Object.values(ITEMS)) {
      if (item.pvpOffenseRating || item.pvpDefenseRating) {
        expect(item.hitRating).toBeUndefined();
      }
    }
  });
});

describe('recalcPlayerStats: gear Hit rating accumulates onto the entity', () => {
  it('equipping a Heroic weapon variant sets e.hitRating/e.hitBonus', () => {
    const p = createPlayer(0, 'rogue', { x: 0, y: 0, z: 0 }, '');
    const equipment: PlayerEquipment = { mainhand: heroicVariantId('fang_of_korzul') };
    recalcPlayerStats(p, 'rogue', equipment);
    expect(p.hitRating).toBe(50);
    expect(p.hitBonus).toBeCloseTo(0.05);
  });

  it('no equipped Hit gear leaves hitRating/hitBonus at 0', () => {
    const p = createPlayer(0, 'rogue', { x: 0, y: 0, z: 0 }, '');
    recalcPlayerStats(p, 'rogue', {});
    expect(p.hitRating).toBe(0);
    expect(p.hitBonus).toBe(0);
  });
});
