// Multiclass secondary-ability resource-cost translation at cast time
// (PHAA-467), implementing the board-accepted rule from
// docs/design/multiclass-resource-translation.md (PHAA-462).

import { describe, expect, it } from 'vitest';
import { needsCostTranslation, translateAbilityCost } from '../src/sim/combat/ability_cost';
import { abilitiesKnownAt } from '../src/sim/content/classes';
import { ABILITIES } from '../src/sim/data';
import { Sim } from '../src/sim/sim';

function makeWorld() {
  return new Sim({ seed: 7, playerClass: 'warrior', noPlayer: true });
}

describe('translateAbilityCost (pure)', () => {
  it('translates a mana-native cost onto a rage/energy live pool by percentage of the native max', () => {
    // mage nativeMax at level 10: baseMana 100 + manaPerLevel 24 * 9 = 316.
    // fireball costs 30 mana natively -> ~9.49% of the bar -> round to a
    // warrior's 100-cap rage pool.
    const translated = translateAbilityCost(30, 'mage', 'rage', 100, 10);
    expect(translated).toBe(Math.round((30 / 316) * 100));
  });

  it('translates a rage-native cost onto a mana live pool the same way', () => {
    const primaryMax = 250;
    const translated = translateAbilityCost(15, 'warrior', 'mana', primaryMax, 1);
    expect(translated).toBe(Math.round((15 / 100) * primaryMax));
  });

  it('is a no-op when the native and live resource types match (same-type)', () => {
    expect(translateAbilityCost(30, 'warlock', 'mana', 400, 20)).toBe(30);
    expect(translateAbilityCost(45, 'rogue', 'energy', 100, 20)).toBe(45);
  });

  it('rage<->energy both cap at 100 so translation degenerates to the plain number', () => {
    expect(translateAbilityCost(45, 'rogue', 'rage', 100, 20)).toBe(45);
    expect(translateAbilityCost(15, 'warrior', 'energy', 100, 20)).toBe(15);
  });

  it('nativeMax is stat-neutral: the fraction is identical regardless of the primary class', () => {
    const level = 15;
    const cost = 30;
    const nativeCls = 'mage';
    // Two different-sized live pools (standing in for two different primary
    // classes/stat blocks) must land on the exact same fraction of each pool.
    const primaryA = 180;
    const primaryB = 340;
    const translatedA = translateAbilityCost(cost, nativeCls, 'rage', primaryA, level);
    const translatedB = translateAbilityCost(cost, nativeCls, 'energy', primaryB, level);
    const nativeMax = 100 + 24 * (level - 1);
    expect(translatedA).toBe(Math.round((cost / nativeMax) * primaryA));
    expect(translatedB).toBe(Math.round((cost / nativeMax) * primaryB));
  });

  it('clamps a floored small cost up to a minimum of 1', () => {
    // 1 / 1000 * 100 = 0.1, which round() would floor to 0.
    const translated = translateAbilityCost(1, 'priest', 'rage', 100, 1);
    expect(translated).toBeGreaterThan(0);
  });

  it('caps an overshooting translation at the live pool max', () => {
    const translated = translateAbilityCost(1000, 'warrior', 'mana', 250, 1);
    expect(translated).toBeLessThanOrEqual(250);
  });

  it('guards divide-by-zero (or negative) on a degenerate nativeMax', () => {
    // A contrived very-low level drives the mage mana curve to zero/negative;
    // the guard must fall back to a plain clamp instead of dividing by it.
    expect(() => translateAbilityCost(50, 'mage', 'rage', 250, -20)).not.toThrow();
    const translated = translateAbilityCost(50, 'mage', 'rage', 250, -20);
    expect(translated).toBe(Math.min(50, 250));
  });

  it('a zero native cost stays zero (nothing to clamp up)', () => {
    expect(translateAbilityCost(0, 'mage', 'rage', 100, 20)).toBe(0);
  });
});

describe('needsCostTranslation', () => {
  it("is false for an ability native to the caster's own primary class", () => {
    expect(needsCostTranslation(ABILITIES.heroic_strike, 'warrior', false)).toBe(false);
  });

  it('is true for a secondary-kit ability from a different class', () => {
    expect(needsCostTranslation(ABILITIES.fireball, 'warrior', false)).toBe(true);
  });

  it('is false for a form toggle regardless of class, preserving the druid-form exemption', () => {
    expect(needsCostTranslation(ABILITIES.bear_form, 'warrior', true)).toBe(false);
  });
});

describe('resolvedAbility applies the translation at cast time (Sim integration)', () => {
  it("translates a mage secondary ability onto a warrior primary's rage pool", () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Multi');
    sim.setPlayerLevel(10, pid);
    const meta = sim.meta(pid)!;
    meta.secondaryCls = 'mage';
    meta.known = abilitiesKnownAt(meta.cls, 10, meta.talentMods, meta.secondaryCls);
    const resolved = sim.resolvedAbility('fireball', pid)!;
    // Rank 2 is learned by level 10 (cost 45), not rank 1's base 30.
    expect(resolved.cost).toBe(Math.round((45 / (100 + 24 * 9)) * 100));
  });

  it('leaves a same-primary-class ability cost untouched', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Solo');
    sim.setPlayerLevel(10, pid);
    const resolved = sim.resolvedAbility('heroic_strike', pid)!;
    expect(resolved.cost).toBe(15);
  });

  it('never translates a druid form toggle even when druid is the secondary class', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Shifter');
    sim.setPlayerLevel(30, pid);
    const meta = sim.meta(pid)!;
    meta.secondaryCls = 'druid';
    meta.known = abilitiesKnownAt(meta.cls, 30, meta.talentMods, meta.secondaryCls);
    const resolved = sim.resolvedAbility('bear_form', pid)!;
    expect(resolved.cost).toBe(30);
  });
});
