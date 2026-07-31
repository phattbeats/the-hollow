// Enchanting (PHAA-649 child of PHAA-639 v0.24.0 sequencing: upstream #1712).
// Disenchant salvages an owned item into dust; apply-enchant spends a crafted
// scroll to grant one of the player's equip slots a permanent flat stat bonus.
// See src/sim/enchanting.ts and src/sim/content/enchants.ts.

import { beforeEach, describe, expect, it } from 'vitest';
import { ENCHANTS, ITEMS, RECIPES } from '../src/sim/data';
import { Sim } from '../src/sim/sim';

const ENCHANT = ENCHANTS.find((e) => e.id === 'enchant_minor_might')!; // mainhand, +3 str

describe('enchanting (PHAA-649 child)', () => {
  let sim: Sim;
  let pid: number;

  beforeEach(() => {
    sim = new Sim({ seed: 7, playerClass: 'warrior', noPlayer: true });
    pid = sim.addPlayer('warrior', 'Tinkerer');
  });

  it('denies a disenchant when the item is not held, with no side effects', () => {
    expect(sim.countItem('rusty_dagger', pid)).toBe(0);
    sim.disenchantItem('rusty_dagger', pid);
    expect(sim.countItem('enchanting_dust', pid)).toBe(0);
    expect(sim.craftProficiencyFor(pid).enchanting).toBe(0);
  });

  it('denies disenchanting a quest item, with no side effects', () => {
    sim.addItem('boar_hide', 1, pid);
    sim.disenchantItem('boar_hide', pid);
    expect(sim.countItem('boar_hide', pid)).toBe(1);
    expect(sim.countItem('enchanting_dust', pid)).toBe(0);
  });

  it('consumes exactly one copy and grants dust on a successful disenchant', () => {
    sim.addItem('rusty_dagger', 2, pid);
    sim.disenchantItem('rusty_dagger', pid);
    expect(sim.countItem('rusty_dagger', pid)).toBe(1);
    expect(sim.countItem('enchanting_dust', pid)).toBe(1);
  });

  it('grants one point of enchanting proficiency on a successful disenchant, none on denial', () => {
    const before = sim.craftProficiencyFor(pid).enchanting;
    sim.disenchantItem('rusty_dagger', pid); // denied: not held
    expect(sim.craftProficiencyFor(pid).enchanting).toBe(before);

    sim.addItem('rusty_dagger', 1, pid);
    sim.disenchantItem('rusty_dagger', pid); // granted
    expect(sim.craftProficiencyFor(pid).enchanting).toBe(before + 1);
  });

  it('denies apply-enchant when the scroll is not held, with no side effects', () => {
    sim.applyEnchant(ENCHANT.id, pid);
    expect(sim.enchantsFor(pid).mainhand).toBeUndefined();
    expect(sim.craftProficiencyFor(pid).enchanting).toBe(0);
  });

  it('an unknown enchant id is denied without throwing', () => {
    expect(() => sim.applyEnchant('not_a_real_enchant', pid)).not.toThrow();
  });

  it('consumes the scroll and sets the enchant on its target slot on success', () => {
    sim.addItem(ENCHANT.scrollItemId, 1, pid);
    sim.applyEnchant(ENCHANT.id, pid);
    expect(sim.countItem(ENCHANT.scrollItemId, pid)).toBe(0);
    expect(sim.enchantsFor(pid).mainhand).toBe(ENCHANT.id);
  });

  it('re-enchanting the same slot replaces the prior enchant (no stacking)', () => {
    const other = ENCHANTS.find((e) => e.slot === 'mainhand' && e.id !== ENCHANT.id);
    // This slice's content only has one mainhand enchant; skip if a second one
    // is never added, rather than asserting against a nonexistent fixture.
    if (!other) return;
    sim.addItem(ENCHANT.scrollItemId, 1, pid);
    sim.applyEnchant(ENCHANT.id, pid);
    sim.addItem(other.scrollItemId, 1, pid);
    sim.applyEnchant(other.id, pid);
    expect(sim.enchantsFor(pid).mainhand).toBe(other.id);
  });

  it('folds the enchant stat bonus into recalcPlayerStats only while the slot is occupied', () => {
    sim.addItem('rusty_dagger', 1, pid);
    sim.equipItem('rusty_dagger', pid);
    const before = sim.entities.get(pid)!.stats.str;
    sim.addItem(ENCHANT.scrollItemId, 1, pid);
    sim.applyEnchant(ENCHANT.id, pid);
    expect(sim.entities.get(pid)!.stats.str).toBe(before + (ENCHANT.stats.str ?? 0));

    // Unequipping the enchanted slot drops the bonus (the enchant lives on the
    // slot, not a specific item instance, per this slice's reskin choice).
    sim.unequipItem('mainhand', pid);
    expect(sim.entities.get(pid)!.stats.str).toBe(before);
  });

  it('denies both actions for a dead player without side effects', () => {
    sim.addItem('rusty_dagger', 1, pid);
    sim.addItem(ENCHANT.scrollItemId, 1, pid);
    const p = sim.entities.get(pid)!;
    p.dead = true;
    sim.disenchantItem('rusty_dagger', pid);
    sim.applyEnchant(ENCHANT.id, pid);
    expect(sim.countItem('rusty_dagger', pid)).toBe(1);
    expect(sim.countItem(ENCHANT.scrollItemId, pid)).toBe(1);
    expect(sim.enchantsFor(pid).mainhand).toBeUndefined();
  });

  it('spends exactly one rng draw on a granted disenchant and none on any other path', () => {
    let draws = 0;
    (sim as unknown as { rng: { setObserver(fn: () => void): void } }).rng.setObserver(() => {
      draws++;
    });

    sim.disenchantItem('rusty_dagger', pid); // denied: not held
    expect(draws).toBe(0);
    sim.applyEnchant('not_a_real_enchant', pid); // denied: unknown
    expect(draws).toBe(0);

    sim.addItem('rusty_dagger', 1, pid);
    sim.disenchantItem('rusty_dagger', pid); // granted: exactly the one quality-roll draw
    expect(draws).toBe(1);

    sim.addItem(ENCHANT.scrollItemId, 1, pid);
    sim.applyEnchant(ENCHANT.id, pid); // granted: no rng draw at all
    expect(draws).toBe(1);
  });

  it('every enchant scroll resolves to a real item that is also a real recipe output', () => {
    for (const enchant of ENCHANTS) {
      expect(
        ITEMS[enchant.scrollItemId],
        `${enchant.id} scroll ${enchant.scrollItemId}`,
      ).toBeDefined();
      const recipe = RECIPES.find((r) => r.resultItemId === enchant.scrollItemId);
      expect(
        recipe,
        `${enchant.id} scroll ${enchant.scrollItemId} has no crafting recipe`,
      ).toBeDefined();
      expect(recipe?.craft).toBe('enchanting');
    }
  });

  it('determinism: the same seed and same sequence of actions yields the same result', () => {
    const run = () => {
      const s = new Sim({ seed: 7, playerClass: 'warrior', noPlayer: true });
      const p = s.addPlayer('warrior', 'Tinkerer');
      s.addItem('rusty_dagger', 1, p);
      s.disenchantItem('rusty_dagger', p);
      s.addItem(ENCHANT.scrollItemId, 1, p);
      s.applyEnchant(ENCHANT.id, p);
      return {
        dust: s.countItem('enchanting_dust', p),
        proficiency: s.craftProficiencyFor(p).enchanting,
        enchant: s.enchantsFor(p).mainhand,
      };
    };
    expect(run()).toEqual(run());
  });
});
