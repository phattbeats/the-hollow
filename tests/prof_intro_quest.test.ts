// Professions onboarding starter quest (PHAA-818, adapts upstream #1708):
// q_prof_intro, given by smith_haldren in Eastbrook Vale. Three 'collect'
// objectives (no dedicated craft/gather objective type exists, see
// src/sim/types.ts QuestObjective), each on an item only the taught action
// grants, so progress on one never starves another: gather spider legs
// (src/sim/gathering.ts, spore nodes), craft a Recruit's Tunic
// (src/sim/crafting.ts, PHAA-574), and disenchant something for its dust
// (src/sim/enchanting.ts, PHAA-649). This exercises the real craft/disenchant
// actions the new crafting window (src/ui/crafting_window.ts) dispatches,
// proving quest credit actually follows those systems end to end.

import { beforeEach, describe, expect, it } from 'vitest';
import { QUESTS } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';
import { terrainHeight } from '../src/sim/world';

type AnySim = Sim & Record<string, any>;
type AnyEntity = Entity & Record<string, any>;

function teleportToNpc(sim: AnySim, e: AnyEntity, templateId: string): void {
  const npc = [...sim.entities.values()].find(
    (c: AnyEntity) => c.kind === 'npc' && c.templateId === templateId,
  );
  if (!npc) throw new Error(`npc ${templateId} not in world`);
  e.pos.x = npc.pos.x;
  e.pos.z = npc.pos.z;
  e.pos.y = terrainHeight(e.pos.x, e.pos.z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
  sim.rebucket(e);
}

describe('q_prof_intro (PHAA-818 professions onboarding)', () => {
  const quest = QUESTS.q_prof_intro;

  it('is defined with a giver/turn-in NPC and no known-recipe gate on its objectives', () => {
    expect(quest).toBeDefined();
    expect(quest.giverNpcId).toBe('smith_haldren');
    expect(quest.turnInNpcId).toBe('smith_haldren');
    expect(quest.objectives).toEqual([
      { type: 'collect', itemId: 'spider_leg', count: 2, label: 'Spider Leg gathered' },
      { type: 'collect', itemId: 'recruit_tunic', count: 1, label: "Recruit's Tunic crafted" },
      { type: 'collect', itemId: 'enchanting_dust', count: 1, label: 'Enchanting Dust' },
    ]);
  });

  describe('accept -> real craft/disenchant/gather actions -> turn-in', () => {
    let sim: AnySim;
    let pid: number;

    beforeEach(() => {
      sim = new Sim({ seed: 5, playerClass: 'warrior', noPlayer: true });
      pid = sim.addPlayer('warrior', 'Apprentice');
      const p = sim.entities.get(pid)!;
      teleportToNpc(sim, p, 'smith_haldren');
    });

    it('accepts near the giver and tracks live collect progress from real actions', () => {
      sim.acceptQuest('q_prof_intro', pid);
      expect(sim.questLog.get('q_prof_intro')?.state).toBe('active');

      // Gather: spider_leg is a spore-node harvest item (src/sim/gathering.ts);
      // granting it the same way harvestNode does is enough to prove the
      // objective is wired to the real item id, gathering mechanics are
      // already covered by their own test files.
      sim.addItem('spider_leg', 2, pid);
      expect(sim.questLog.get('q_prof_intro')?.counts[0]).toBe(2);

      // Craft: the real crafting action the new crafting window dispatches
      // (recipe_recruit_tunic needs bone_fragments only, never spider_leg).
      expect(sim.countItem('recruit_tunic', pid)).toBe(0);
      sim.addItem('bone_fragments', 3, pid);
      sim.craftItem('recipe_recruit_tunic', pid);
      expect(sim.countItem('recruit_tunic', pid)).toBe(1);
      expect(sim.questLog.get('q_prof_intro')?.counts[1]).toBe(1);

      // Enchanting groundwork: disenchant something OTHER than the tunic just
      // crafted, so this objective's credit never claws back objective 1.
      sim.addItem('rusty_hatchet', 1, pid);
      sim.disenchantItem('rusty_hatchet', pid);
      expect(sim.countItem('enchanting_dust', pid)).toBe(1);
      expect(sim.countItem('recruit_tunic', pid)).toBe(1); // untouched by the disenchant
      expect(sim.questLog.get('q_prof_intro')?.counts[2]).toBe(1);

      expect(sim.questLog.get('q_prof_intro')?.state).toBe('ready');

      const before = { xp: sim.xp, copper: sim.copper };
      sim.turnInQuest('q_prof_intro', pid);
      expect(sim.questsDone.has('q_prof_intro')).toBe(true);
      expect(sim.xp).toBeGreaterThan(before.xp);
      expect(sim.copper).toBe(before.copper + quest.copperReward);
      // The collect objective items are handed in on turn-in.
      expect(sim.countItem('spider_leg', pid)).toBe(0);
      expect(sim.countItem('recruit_tunic', pid)).toBe(0);
      expect(sim.countItem('enchanting_dust', pid)).toBe(0);
    });

    it('denies turn-in before every objective is met', () => {
      sim.acceptQuest('q_prof_intro', pid);
      sim.addItem('spider_leg', 2, pid);
      expect(sim.questLog.get('q_prof_intro')?.state).toBe('active');
      sim.turnInQuest('q_prof_intro', pid);
      expect(sim.questsDone.has('q_prof_intro')).toBe(false);
    });
  });
});
