// The Hollow hub + the Under-Shrine (PHAA-400): the fork's portal-instanced
// plant-world hub, registered exactly like the Drowned Temple (Decision 19,
// docs/plan-the-hollow.md §12). Verifies the hub and cave are registered at
// their own instance bands, the overworld shrine gate leads into the hub,
// Brother Greenpaw lives at the vase inside the instance and his first-run
// quest chain can be taken and completed there, the cave mouth links to the
// Under-Shrine with its full spawn set, and the exits lead home.
import { describe, expect, it } from 'vitest';
import { HOLLOW_GATE_POS, HOLLOW_HUB_DOOR_POS, VASE_POS } from '../src/sim/content/hollow';
import {
  ARENA_X,
  ARENA_X_MIN,
  DELVE_X_MIN,
  DUNGEON_LIST,
  DUNGEONS,
  ITEMS,
  instanceOrigin,
  MOBS,
  NPCS,
  QUESTS,
  questRewardItemId,
} from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import { dist2d, type PlayerClass } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';

function teleport(sim: Sim, pid: number, x: number, z: number) {
  const e = sim.entities.get(pid)!;
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = groundHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
}

function nearestMob(sim: Sim, templateId: string, from: { x: number; z: number }) {
  let best: any = null;
  let bestD = Infinity;
  for (const e of sim.entities.values()) {
    if (e.kind !== 'mob' || e.dead || e.templateId !== templateId) continue;
    const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function findEntity(sim: Sim, pred: (e: any) => boolean) {
  return [...sim.entities.values()].find(pred);
}

describe('The Hollow hub', () => {
  it('is registered as a portal dungeon at its own instance band, past every base band', () => {
    const hub = DUNGEONS.the_hollow;
    expect(hub).toBeTruthy();
    expect(hub.index).toBe(6);
    expect(hub.interior).toBe('temple');
    expect(hub.doorPos).toEqual(HOLLOW_HUB_DOOR_POS);
    expect(hub.entry).toEqual(HOLLOW_GATE_POS);
    // no combat on the shrine floor; the cave below holds all of it
    expect(hub.spawns).toEqual([]);
    expect(DUNGEON_LIST.some((d) => d.id === 'the_hollow')).toBe(true);

    const shrine = DUNGEONS.under_shrine;
    expect(shrine).toBeTruthy();
    expect(shrine.index).toBe(7);
    expect(shrine.overworldDoor).toBe(false); // reached only through the hub's cave mouth

    // every dungeon index is unique and the arena/delve bands sit east of them all
    const indices = DUNGEON_LIST.map((d) => d.index);
    expect(new Set(indices).size).toBe(indices.length);
    const maxDungeonX = instanceOrigin(Math.max(...indices), 0).x;
    expect(ARENA_X_MIN).toBeGreaterThan(maxDungeonX);
    expect(DELVE_X_MIN).toBeGreaterThan(ARENA_X);
  });

  it('walking the shrine gate leads into the hub, with Greenpaw at the vase and the exit home', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    // Greenpaw is dynamic: he must NOT stand in the overworld at raw (3, 4)
    expect(NPCS.brother_greenpaw.dynamic).toBe(true);
    expect(
      findEntity(sim, (e) => e.kind === 'npc' && e.templateId === 'brother_greenpaw'),
    ).toBeUndefined();
    // the overworld shrine-gate portal exists at HOLLOW_HUB_DOOR_POS
    const door = findEntity(
      sim,
      (e) => e.templateId === 'dungeon_door' && e.dungeonId === 'the_hollow',
    )!;
    expect(door).toBeTruthy();
    expect(
      dist2d(door.pos, { x: HOLLOW_HUB_DOOR_POS.x, y: 0, z: HOLLOW_HUB_DOOR_POS.z }),
    ).toBeLessThan(1);

    const a = sim.addPlayer('warrior', 'Aleph');
    teleport(sim, a, HOLLOW_HUB_DOOR_POS.x, HOLLOW_HUB_DOOR_POS.z);
    sim.enterDungeon('the_hollow', a);
    const ea = sim.entities.get(a)!;
    const slot = sim.instanceSlotAt(ea.pos)!;
    const origin = instanceOrigin(6, slot);
    // arrival at the hub gate, a short walk from the vase
    expect(
      dist2d(ea.pos, { x: origin.x + HOLLOW_GATE_POS.x, y: 0, z: origin.z + HOLLOW_GATE_POS.z }),
    ).toBeLessThan(2);

    // Greenpaw stands at the foot of the vase, inside the instance
    const greenpaw = findEntity(
      sim,
      (e) => e.kind === 'npc' && e.templateId === 'brother_greenpaw',
    )!;
    expect(greenpaw).toBeTruthy();
    expect(
      dist2d(greenpaw.pos, { x: origin.x + VASE_POS.x, y: 0, z: origin.z + VASE_POS.z }),
    ).toBeLessThan(6);

    // the cave mouth into the Under-Shrine is an internal door object
    const caveMouth = findEntity(
      sim,
      (e) =>
        e.templateId === 'dungeon_door' &&
        e.dungeonId === 'under_shrine' &&
        Math.abs(e.pos.x - origin.x) < 120,
    );
    expect(caveMouth).toBeTruthy();

    // and no hostiles share the shrine floor
    for (const e of sim.entities.values()) {
      if (e.kind === 'mob' && !e.dead && Math.abs(e.pos.x - origin.x) < 120) {
        expect.fail(`hostile ${e.templateId} on the shrine floor`);
      }
    }

    sim.leaveDungeon(a);
    expect(
      dist2d(ea.pos, { x: HOLLOW_HUB_DOOR_POS.x, y: 0, z: HOLLOW_HUB_DOOR_POS.z }),
    ).toBeLessThan(10);
  });

  it('the Under-Shrine populates its descent and the Witness-Root waits in the far room', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    const a = sim.addPlayer('warrior', 'Aleph');
    teleport(sim, a, HOLLOW_HUB_DOOR_POS.x, HOLLOW_HUB_DOOR_POS.z);
    sim.enterDungeon('under_shrine', a);
    const ea = sim.entities.get(a)!;
    const slot = sim.instanceSlotAt(ea.pos)!;
    const origin = instanceOrigin(7, slot);

    expect(nearestMob(sim, 'palefeeder', origin)).toBeTruthy();
    expect(nearestMob(sim, 'rootmaw', origin)).toBeTruthy();
    const witness = nearestMob(sim, 'the_witness_root', origin);
    expect(witness).toBeTruthy();
    expect(witness.level).toBe(4);

    // leaving the cave returns you beside the hub portal in the overworld
    sim.leaveDungeon(a);
    expect(
      dist2d(ea.pos, { x: HOLLOW_HUB_DOOR_POS.x, y: 0, z: HOLLOW_HUB_DOOR_POS.z }),
    ).toBeLessThan(10);
  });

  it("Greenpaw's first-run chain can be taken and completed at the vase", () => {
    const cls: PlayerClass = 'druid';
    const sim = new Sim({ seed: 7, playerClass: cls, playerName: 'Q', autoEquip: false });
    const meta = (sim as any).primary;
    const pid = meta.entityId as number;
    teleport(sim, pid, HOLLOW_HUB_DOOR_POS.x, HOLLOW_HUB_DOOR_POS.z);
    sim.enterDungeon('the_hollow', pid);
    const greenpaw = findEntity(
      sim,
      (e) => e.kind === 'npc' && e.templateId === 'brother_greenpaw',
    )!;
    sim.player.pos = { ...greenpaw.pos };

    // q_what_burns: accept at Greenpaw, gather five emberbulbs, turn in
    sim.acceptQuest('q_what_burns');
    expect(meta.questLog.get('q_what_burns')?.state).toBe('active');
    sim.addItem('emberbulb', 5);
    sim.tick(); // collect objectives re-count on tick
    expect(meta.questLog.get('q_what_burns')?.state).toBe('ready');
    sim.turnInQuest('q_what_burns');
    expect(meta.questsDone.has('q_what_burns')).toBe(true);

    // q_what_fills unlocks behind it and hands every class the first cutting
    sim.acceptQuest('q_what_fills');
    expect(meta.questLog.get('q_what_fills')?.state).toBe('active');
    sim.addItem('cave_morsel', 4);
    sim.tick();
    const reward = questRewardItemId(QUESTS.q_what_fills, cls);
    expect(reward).toBe('first_cutting');
    sim.turnInQuest('q_what_fills');
    expect(meta.questsDone.has('q_what_fills')).toBe(true);
    expect(sim.countItem('first_cutting')).toBe(1);
  });

  it('the quest loot and rewards resolve to real items on the right mobs', () => {
    expect(QUESTS.q_what_fills.requiresQuest).toBe('q_what_burns');
    expect(NPCS.brother_greenpaw.questIds).toEqual(['q_what_burns', 'q_what_fills']);
    for (const id of ['emberbulb', 'cave_morsel', 'first_cutting']) {
      expect(ITEMS[id], `item ${id}`).toBeTruthy();
    }
    const bulb = MOBS.palefeeder.loot.find((l) => l.itemId === 'emberbulb');
    expect(bulb?.questId).toBe('q_what_burns');
    const morsel = MOBS.rootmaw.loot.find((l) => l.itemId === 'cave_morsel');
    expect(morsel?.questId).toBe('q_what_fills');
  });
});
