import { describe, expect, it } from 'vitest';
import { GROUND_OBJECTS, ITEMS, NPCS, QUESTS, questRewardItemId } from '../src/sim/data';
import { Sim } from '../src/sim/sim';

const QUEST_ID = 'q_aldrics_fallen_star';
const METEOR_ITEM_ID = 'unknown_alien_weaponry';
const REWARD_ITEM_ID = 'alien_armor_plate';

function teleportTo(sim: Sim, x: number, z: number): void {
  const pos = sim.groundPos(x, z);
  sim.player.pos = { ...pos };
  sim.player.prevPos = { ...pos };
}

describe('Brother Aldric fallen star quest', () => {
  it('is offered by Mirefen Aldric and resolves through the meteor pickup', () => {
    const quest = QUESTS[QUEST_ID];
    expect(quest).toBeTruthy();
    expect(quest.giverNpcId).toBe('brother_aldric_fen');
    expect(quest.turnInNpcId).toBe('brother_aldric_fen');
    expect(quest.objectives).toEqual([
      { type: 'collect', itemId: METEOR_ITEM_ID, count: 1, label: 'Unknown Alien Weaponry' },
    ]);
    expect(NPCS.brother_aldric_fen.questIds).toContain(QUEST_ID);
    expect(ITEMS[METEOR_ITEM_ID]?.questId).toBe(QUEST_ID);
    expect(ITEMS[REWARD_ITEM_ID]?.kind).toBe('armor');
    expect(ITEMS[REWARD_ITEM_ID]?.slot).toBe('chest');
    expect(ITEMS[REWARD_ITEM_ID]?.quality).toBe('rare');
    expect(questRewardItemId(quest, 'warrior')).toBe(REWARD_ITEM_ID);

    const meteorObjectDef = GROUND_OBJECTS.find((obj) => obj.itemId === METEOR_ITEM_ID);
    expect(meteorObjectDef).toBeTruthy();
    expect(meteorObjectDef!.positions.some((pos) => Math.hypot(pos.x - 152, pos.z - 294) <= 8)).toBe(true);

    const sim = new Sim({ seed: 20061, playerClass: 'warrior', playerName: 'Reuben', autoEquip: false });
    sim.player.level = 8;

    const aldric = [...sim.entities.values()].find((e) => e.kind === 'npc' && e.templateId === 'brother_aldric_fen');
    expect(aldric).toBeTruthy();
    teleportTo(sim, aldric!.pos.x + 1, aldric!.pos.z);

    sim.acceptQuest(QUEST_ID);
    expect(sim.questState(QUEST_ID)).toBe('active');

    const meteorObject = [...sim.entities.values()]
      .find((e) => e.kind === 'object' && e.objectItemId === METEOR_ITEM_ID);
    expect(meteorObject).toBeTruthy();
    teleportTo(sim, meteorObject!.pos.x + 1, meteorObject!.pos.z);

    sim.pickUpObject(meteorObject!.id);
    expect(sim.countItem(METEOR_ITEM_ID)).toBe(1);
    expect(sim.questState(QUEST_ID)).toBe('ready');

    teleportTo(sim, aldric!.pos.x + 1, aldric!.pos.z);
    sim.turnInQuest(QUEST_ID);

    expect(sim.questState(QUEST_ID)).toBe('done');
    expect(sim.countItem(METEOR_ITEM_ID)).toBe(0);
    expect(sim.countItem(REWARD_ITEM_ID)).toBe(1);

    sim.useItem(REWARD_ITEM_ID);
    expect(sim.equipment.chest).toBe(REWARD_ITEM_ID);
  });
});
