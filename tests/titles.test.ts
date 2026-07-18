// Title registry + activeTitle + select/equip command (PHAA-762, child 1 of
// PHAA-686). Covers: the registry folds the 3 existing kind:'title'
// milestones without touching grantXp's auto-unlock rule, equipTitle
// validates unlock state server-side, and activeTitle persists/backfills.
import { describe, expect, it } from 'vitest';
import { TITLES, TITLES_BY_ID } from '../src/sim/data';
import { isTitleUnlocked } from '../src/sim/progression/titles';
import { Sim } from '../src/sim/sim';
import { MAX_LEVEL, MILESTONES } from '../src/sim/types';

function makeSim(): Sim {
  return new Sim({ seed: 1, playerClass: 'warrior', autoEquip: true });
}

describe('title registry', () => {
  it('folds the 3 existing kind:title milestones as its first entries', () => {
    const titleMilestoneIds = MILESTONES.filter((m) => m.kind === 'title').map((m) => m.id);
    expect(titleMilestoneIds).toEqual(['veteran', 'champion', 'eternal']);
    for (const id of titleMilestoneIds) {
      expect(TITLES_BY_ID[id]).toBeDefined();
      expect(TITLES_BY_ID[id].unlockedByMilestone).toBe(id);
    }
    // cosmetic border milestones (paragon/mythic) are not titles
    expect(TITLES_BY_ID.paragon).toBeUndefined();
    expect(TITLES_BY_ID.mythic).toBeUndefined();
    expect(TITLES.length).toBe(3);
  });
});

describe('equipTitle command', () => {
  it('rejects an unknown title id', () => {
    const sim = makeSim();
    expect(sim.equipTitle('not_a_real_title')).toBe(false);
    expect(sim.meta(sim.playerId)!.activeTitle).toBeNull();
  });

  it('rejects a title that has not been unlocked yet', () => {
    const sim = makeSim();
    expect(isTitleUnlocked(sim.meta(sim.playerId)!, 'veteran')).toBe(false);
    expect(sim.equipTitle('veteran')).toBe(false);
    expect(sim.meta(sim.playerId)!.activeTitle).toBeNull();
  });

  it('accepts an equip once the backing milestone unlocks, via the unchanged grantXp rule', () => {
    const sim = makeSim();
    sim.setPlayerLevel(MAX_LEVEL);
    sim.grantXp(MILESTONES.find((m) => m.id === 'veteran')!.lifetimeXp + 1);
    expect(sim.unlockedMilestones).toContain('veteran');
    expect(sim.equipTitle('veteran')).toBe(true);
    expect(sim.meta(sim.playerId)!.activeTitle).toBe('veteran');
  });

  it('clears the active title when equipped with null', () => {
    const sim = makeSim();
    sim.setPlayerLevel(MAX_LEVEL);
    sim.grantXp(MILESTONES.find((m) => m.id === 'veteran')!.lifetimeXp + 1);
    expect(sim.equipTitle('veteran')).toBe(true);
    expect(sim.equipTitle(null)).toBe(true);
    expect(sim.meta(sim.playerId)!.activeTitle).toBeNull();
  });
});

describe('activeTitle persistence', () => {
  it('round-trips an equipped title', () => {
    const sim = makeSim();
    sim.setPlayerLevel(MAX_LEVEL);
    sim.grantXp(MILESTONES.find((m) => m.id === 'champion')!.lifetimeXp + 1);
    expect(sim.equipTitle('champion')).toBe(true);
    const state = sim.serializeCharacter(sim.playerId)!;
    expect(state.activeTitle).toBe('champion');

    const sim2 = new Sim({ seed: 2, playerClass: 'warrior', noPlayer: true });
    const pid = sim2.addPlayer('warrior', 'Reloaded', { state });
    expect(sim2.meta(pid)!.activeTitle).toBe('champion');
  });

  it('backfills pre-titles saves (no activeTitle field) to null', () => {
    const sim = makeSim();
    const state = sim.serializeCharacter(sim.playerId)!;
    delete state.activeTitle;

    const sim2 = new Sim({ seed: 3, playerClass: 'warrior', noPlayer: true });
    const pid = sim2.addPlayer('warrior', 'Reloaded', { state });
    expect(sim2.meta(pid)!.activeTitle).toBeNull();
  });

  it('drops a saved title on load if it is no longer unlocked', () => {
    const sim = makeSim();
    sim.setPlayerLevel(MAX_LEVEL);
    sim.grantXp(MILESTONES.find((m) => m.id === 'eternal')!.lifetimeXp + 1);
    expect(sim.equipTitle('eternal')).toBe(true);
    const state = sim.serializeCharacter(sim.playerId)!;
    // Simulate a save that predates the milestone unlock (e.g. hand-edited/corrupt).
    state.unlockedMilestones = [];

    const sim2 = new Sim({ seed: 4, playerClass: 'warrior', noPlayer: true });
    const pid = sim2.addPlayer('warrior', 'Reloaded', { state });
    expect(sim2.meta(pid)!.activeTitle).toBeNull();
  });
});
