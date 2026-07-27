// Crafting (PHAA-574, professions-depth batch slice 1): turns a recipe plus
// its reagents into the output item. Common-tier only: any player with the
// materials can craft any recipe, no per-recipe skill/known gate. See
// src/sim/crafting.ts and src/sim/content/recipes.ts.

import { beforeEach, describe, expect, it } from 'vitest';
import { ITEMS, RECIPES } from '../src/sim/data';
import { Sim } from '../src/sim/sim';

const RECIPE = RECIPES.find((r) => r.id === 'recipe_tough_jerky')!;

describe('crafting (PHAA-574)', () => {
  let sim: Sim;
  let pid: number;

  beforeEach(() => {
    sim = new Sim({ seed: 7, playerClass: 'warrior', noPlayer: true });
    pid = sim.addPlayer('warrior', 'Chef');
  });

  it('denies a craft when a reagent is short, with no side effects', () => {
    // recipe_tough_jerky needs 1 spider_leg; the player has none.
    expect(sim.countItem('spider_leg', pid)).toBe(0);
    sim.craftItem(RECIPE.id, pid);
    expect(sim.countItem('tough_jerky', pid)).toBe(0);
    expect(sim.craftProficiencyFor(pid).cooking).toBe(0);
  });

  it('consumes exact reagent quantities and grants the output on success', () => {
    sim.addItem('spider_leg', 1, pid);
    sim.craftItem(RECIPE.id, pid);
    expect(sim.countItem('spider_leg', pid)).toBe(0);
    expect(sim.countItem('tough_jerky', pid)).toBe(1);
  });

  it('never partially consumes reagents on a multi-reagent recipe when one is short', () => {
    const multi = RECIPES.find((r) => r.id === 'recipe_rusty_dagger')!; // bone_fragments x2, linen_scrap x1
    sim.addItem('bone_fragments', 2, pid);
    // linen_scrap intentionally withheld.
    sim.craftItem(multi.id, pid);
    expect(sim.countItem('bone_fragments', pid)).toBe(2); // untouched, not partially spent
    expect(sim.countItem('rusty_dagger', pid)).toBe(0);
  });

  it('grants the recipe craft one point of craft proficiency on success, none on denial', () => {
    const before = sim.craftProficiencyFor(pid).cooking;
    sim.craftItem(RECIPE.id, pid); // denied: no materials
    expect(sim.craftProficiencyFor(pid).cooking).toBe(before);

    sim.addItem('spider_leg', 1, pid);
    sim.craftItem(RECIPE.id, pid); // granted
    expect(sim.craftProficiencyFor(pid).cooking).toBe(before + 1);
  });

  it('denies craft for a dead player without consuming materials or granting the item', () => {
    sim.addItem('spider_leg', 1, pid);
    const p = sim.entities.get(pid)!;
    p.dead = true;
    sim.craftItem(RECIPE.id, pid);
    expect(sim.countItem('spider_leg', pid)).toBe(1);
    expect(sim.countItem('tough_jerky', pid)).toBe(0);
  });

  it('an unknown recipe id is denied without throwing', () => {
    expect(() => sim.craftItem('not_a_real_recipe', pid)).not.toThrow();
  });

  it('every declared reagent and result item id resolves to a real item', () => {
    for (const recipe of RECIPES) {
      for (const reagent of recipe.reagents) {
        expect(ITEMS[reagent.itemId], `${recipe.id} reagent ${reagent.itemId}`).toBeDefined();
      }
      expect(
        ITEMS[recipe.resultItemId],
        `${recipe.id} result ${recipe.resultItemId}`,
      ).toBeDefined();
    }
  });

  it('spends exactly one rng draw on a granted craft and none on any denial path', () => {
    let draws = 0;
    (sim as unknown as { rng: { setObserver(fn: () => void): void } }).rng.setObserver(() => {
      draws++;
    });

    sim.craftItem(RECIPE.id, pid); // denied: no materials
    expect(draws).toBe(0);
    sim.craftItem('not_a_real_recipe', pid); // denied: unknown recipe
    expect(draws).toBe(0);
    const p = sim.entities.get(pid)!;
    p.dead = true;
    sim.craftItem(RECIPE.id, pid); // denied: dead, the first guard in the chain
    expect(draws).toBe(0);
    p.dead = false;

    sim.addItem('spider_leg', 1, pid);
    sim.craftItem(RECIPE.id, pid); // granted: exactly the one quality-roll draw
    expect(draws).toBe(1);
  });

  it('determinism: the same seed and same sequence of crafts yields the same result', () => {
    const run = () => {
      const s = new Sim({ seed: 7, playerClass: 'warrior', noPlayer: true });
      const p = s.addPlayer('warrior', 'Chef');
      s.addItem('spider_leg', 1, p);
      s.craftItem(RECIPE.id, p);
      return {
        count: s.countItem('tough_jerky', p),
        proficiency: s.craftProficiencyFor(p).cooking,
      };
    };
    expect(run()).toEqual(run());
  });
});
