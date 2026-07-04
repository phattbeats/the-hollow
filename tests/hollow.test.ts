// The Hollow hub + the Under-Shrine (PHAA-400): the fork's portal-instanced
// plant-world hub, registered exactly like the Drowned Temple (Decision 19,
// docs/plan-the-hollow.md §12). Verifies the hub and cave are registered at
// their own instance bands, the overworld shrine gate leads into the hub,
// Brother Greenpaw lives at the vase inside the instance and his first-run
// quest chain can be taken and completed there, the cave mouth links to the
// Under-Shrine with its full spawn set, and the exits lead home. PHAA-420
// adds the open-world Hollow Reaches around the gate: see the second
// describe block below.
import { describe, expect, it } from 'vitest';
import { resolvePosition } from '../src/sim/colliders';
import {
  HOLLOW_GATE_POS,
  HOLLOW_HUB_DOOR_POS,
  VASE_LANDING_POS,
  VASE_POS,
} from '../src/sim/content/hollow';
import { HOLLOW_ZONE_ZONE } from '../src/sim/content/hollow_zone';
import { ZONE1_ZONE } from '../src/sim/content/zone1';
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
  ZONES,
  zoneAt,
} from '../src/sim/data';
import { TEMPLE_LAYOUT } from '../src/sim/dungeon_layout';
import { Sim } from '../src/sim/sim';
import { dist2d, type PlayerClass } from '../src/sim/types';
import { groundHeight, terrainHeight } from '../src/sim/world';

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
    // entry and the exit portal must land ON the temple room floor: outside
    // TEMPLE_LAYOUT's z-range there is only void (the pre-fix (0, -40) gate
    // stranded arrivals south of the front wall, board bug on PHAA-405)
    for (const pos of [hub.entry, hub.exitOffset]) {
      expect(pos.z).toBeGreaterThan(TEMPLE_LAYOUT.zMin);
      expect(pos.z).toBeLessThan(TEMPLE_LAYOUT.zMax);
      expect(Math.abs(pos.x)).toBeLessThan(23); // inside the side walls
    }
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

    // PHAA-420: the hub gate opens both ways again. An exit portal spawns
    // inside it, and leaving lands back at the gate in the Hollow Reaches.
    const exit = findEntity(
      sim,
      (e) => e.templateId === 'dungeon_exit' && Math.abs(e.pos.x - origin.x) < 120,
    );
    expect(exit).toBeTruthy();
    sim.leaveDungeon(a);
    expect(
      dist2d(ea.pos, { x: HOLLOW_HUB_DOOR_POS.x, y: 0, z: HOLLOW_HUB_DOOR_POS.z - 4 }),
    ).toBeLessThan(1);
  });

  it('the vase is a physical obstacle: a mover cannot walk through it (board bug on PHAA-405)', () => {
    const origin = instanceOrigin(6, 0);
    const resolved = resolvePosition(42, origin.x + VASE_POS.x, origin.z + VASE_POS.z, 0.5);
    const dx = resolved.x - (origin.x + VASE_POS.x);
    const dz = resolved.z - (origin.z + VASE_POS.z);
    expect(Math.hypot(dx, dz)).toBeGreaterThan(0.5);
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

    // PHAA-404: leaving the cave climbs back into the hub instance beside the
    // cave mouth, never the base overworld
    sim.leaveDungeon(a);
    const hubSlot = sim.instanceSlotAt(ea.pos);
    expect(hubSlot).not.toBeNull();
    const hubOrigin = instanceOrigin(6, hubSlot!);
    const exitTo = DUNGEONS.under_shrine.exitTo!;
    expect(
      dist2d(ea.pos, { x: hubOrigin.x + exitTo.x, y: 0, z: hubOrigin.z + exitTo.z }),
    ).toBeLessThan(2);
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

  it('the Under-Shrine is dense and fast-respawning enough to farm the first run solo (PHAA-433)', () => {
    const spawns = DUNGEONS.under_shrine.spawns;
    const palefeeders = spawns.filter((s) => s.mobId === 'palefeeder').length;
    const rootmaws = spawns.filter((s) => s.mobId === 'rootmaw').length;
    const witnesses = spawns.filter((s) => s.mobId === 'the_witness_root').length;
    expect(witnesses).toBe(1); // still exactly one boss at the back

    // The first run needs 5 emberbulb (palefeeder, 0.5 quest-drop) + 4 cave_morsel
    // (rootmaw, 0.6). Density must let a solo player clear those in one descent.
    expect(palefeeders).toBeGreaterThanOrEqual(6);
    expect(rootmaws).toBeGreaterThanOrEqual(5);

    // Respawn is shortened below the 25s default so the room stays fed on the
    // walk back rather than emptying out (the reported "too slow" stall).
    const DEFAULT_RESPAWN_SECONDS = 25; // sim.ts: cfg.respawnSeconds ?? 25
    const sim = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    expect(sim.cfg.respawnSeconds ?? DEFAULT_RESPAWN_SECONDS).toBe(DEFAULT_RESPAWN_SECONDS);
    for (const mobId of ['palefeeder', 'rootmaw'] as const) {
      const mult = MOBS[mobId].respawnMult ?? 1;
      expect(mult).toBeLessThan(1);
      // materially faster than default, but not instant whack-a-mole
      expect(DEFAULT_RESPAWN_SECONDS * mult).toBeLessThanOrEqual(20);
      expect(DEFAULT_RESPAWN_SECONDS * mult).toBeGreaterThanOrEqual(10);
    }

    // Sanity on the farm loop: two laps of the room (the first clear plus one
    // respawn wave, which the shortened timer makes ready before the descent
    // ends) comfortably exceeds the 5 + 4 the quests ask for, so a solo run
    // finishes without dead-waiting even on a below-average drop seed.
    const emberDrop = MOBS.palefeeder.loot.find((l) => l.itemId === 'emberbulb')!.chance;
    const morselDrop = MOBS.rootmaw.loot.find((l) => l.itemId === 'cave_morsel')!.chance;
    expect(2 * palefeeders * emberDrop).toBeGreaterThanOrEqual(5);
    expect(2 * rootmaws * morselDrop).toBeGreaterThanOrEqual(4);
  });

  it('the Witness-Root can close the item gap alone and has a rare drop chance (PHAA-433)', () => {
    const loot = MOBS.the_witness_root.loot;
    const emberRolls = loot.filter((l) => l.itemId === 'emberbulb');
    const morselRolls = loot.filter((l) => l.itemId === 'cave_morsel');
    // Two independent quest-gated rolls each, same pattern as the trash mobs,
    // so a single boss kill can plausibly hand over more than one of each.
    expect(emberRolls).toHaveLength(2);
    expect(morselRolls).toHaveLength(2);
    for (const roll of [...emberRolls, ...morselRolls]) {
      expect(roll.questId).toBeDefined();
    }
    const rare = loot.find((l) => l.itemId === 'witness_root_cincture');
    expect(rare).toBeTruthy();
    expect(ITEMS.witness_root_cincture.quality).toBe('rare');
  });

  it('the Under-Shrine has a found diary page, not enter/leave lore prose (PHAA-433)', () => {
    // Board feedback: lore belongs on a found object, read in its tooltip
    // (flavorText), not shown automatically on dungeon enter/exit.
    const note = DUNGEONS.under_shrine.objects?.find((o) => o.itemId === 'shrine_diary_page');
    expect(note).toBeTruthy();
    expect(ITEMS.shrine_diary_page.flavorText).toBeTruthy();
    expect(DUNGEONS.under_shrine.enterText).not.toContain('kept its own time');
    expect(DUNGEONS.under_shrine.leaveText).not.toContain('slow count');
  });

  it('positions saved at the PRE-fork arena/delve x-bands rejoin inside the hub', () => {
    // The fork moved ARENA_X 4200 to 5400 and DELVE_X_MIN 4800 to 6000 to open
    // dungeon bands 6 and 7. A character saved mid-match or mid-delve at the
    // OLD coordinates now resolves to the new Hollow bands, which are the hub
    // family (homeRespawn): addPlayer rejoins them into a live Hollow hub
    // instance rather than ejecting them to a base-world door (PHAA-404).
    for (const oldX of [4200, 4800]) {
      const sim = new Sim({ seed: 3, playerClass: 'warrior', noPlayer: true });
      const pid = sim.addPlayer('warrior', 'Old', {
        state: {
          pos: { x: oldX, z: -1250 },
          questLog: [],
          questsDone: [],
          inventory: [],
        } as any,
      });
      const e = sim.entities.get(pid)!;
      const slot = sim.instanceSlotAt(e.pos);
      expect(slot).not.toBeNull();
      const origin = instanceOrigin(6, slot!);
      // standing at the hub gate, inside a claimed instance
      expect(
        dist2d(e.pos, { x: origin.x + HOLLOW_GATE_POS.x, y: 0, z: origin.z + HOLLOW_GATE_POS.z }),
      ).toBeLessThan(2);
    }
  });

  it('the hub is one shared instance: solo strangers land in the same slot', () => {
    const sim = new Sim({ seed: 5, playerClass: 'warrior', noPlayer: true });
    const a = sim.addPlayer('warrior', 'Aleph', { hollowStart: true });
    const b = sim.addPlayer('mage', 'Beth', { hollowStart: true });
    const sa = sim.instanceSlotAt(sim.entities.get(a)!.pos);
    const sb = sim.instanceSlotAt(sim.entities.get(b)!.pos);
    expect(sa).not.toBeNull();
    expect(sa).toBe(sb);
    // the Under-Shrine stays per-party: the same two strangers get separate caves
    sim.enterDungeon('under_shrine', a);
    sim.enterDungeon('under_shrine', b);
    expect(sim.instanceSlotAt(sim.entities.get(a)!.pos)).not.toBe(
      sim.instanceSlotAt(sim.entities.get(b)!.pos),
    );
  });

  it('hollowStart spawns a brand-new character at the vase and death returns there (PHAA-404)', () => {
    const sim = new Sim({ seed: 11, playerClass: 'warrior', hollowStart: true });
    const pid = sim.playerId;
    const e = sim.entities.get(pid)!;
    const slot = sim.instanceSlotAt(e.pos);
    expect(slot).not.toBeNull();
    const origin = instanceOrigin(6, slot!);
    // the cold open (constitution §7): land at the vase itself
    expect(
      dist2d(e.pos, { x: origin.x + VASE_LANDING_POS.x, y: 0, z: origin.z + VASE_LANDING_POS.z }),
    ).toBeLessThan(2);

    // a server-shaped fresh character (initial state serialized in the base
    // overworld) also lands at the vase, not the gate
    const sim2 = new Sim({ seed: 11, playerClass: 'mage', noPlayer: true });
    const pid2 = sim2.addPlayer('mage', 'Newling', {
      hollowStart: true,
      state: { pos: { x: 2, z: -2 }, questLog: [], questsDone: [], inventory: [] } as any,
    });
    const e2 = sim2.entities.get(pid2)!;
    const slot2 = sim2.instanceSlotAt(e2.pos)!;
    const origin2 = instanceOrigin(6, slot2);
    expect(
      dist2d(e2.pos, {
        x: origin2.x + VASE_LANDING_POS.x,
        y: 0,
        z: origin2.z + VASE_LANDING_POS.z,
      }),
    ).toBeLessThan(2);

    // dying in the Under-Shrine releases the spirit back to the vase, never a
    // base-world graveyard
    sim.enterDungeon('under_shrine', pid);
    e.hp = 0;
    e.dead = true;
    sim.releaseSpirit(pid);
    expect(e.dead).toBe(false);
    const backSlot = sim.instanceSlotAt(e.pos);
    expect(backSlot).not.toBeNull();
    const backOrigin = instanceOrigin(6, backSlot!);
    expect(
      dist2d(e.pos, {
        x: backOrigin.x + VASE_LANDING_POS.x,
        y: 0,
        z: backOrigin.z + VASE_LANDING_POS.z,
      }),
    ).toBeLessThan(2);
  });
});

describe('The Hollow Reaches (PHAA-420)', () => {
  it('is a real open-world zone prepended to the strip, tiling and sealed at the Eastbrook boundary', () => {
    expect(ZONES[0]).toBe(HOLLOW_ZONE_ZONE);
    expect(HOLLOW_ZONE_ZONE.zMax).toBe(ZONE1_ZONE.zMin);
    expect(HOLLOW_ZONE_ZONE.sealedFrontier).toBe(true);
    expect(zoneAt(HOLLOW_HUB_DOOR_POS.z).id).toBe(HOLLOW_ZONE_ZONE.id);
  });

  it('the shrine gate sits on real, walkable ground (the terrain function, not an instance floor)', () => {
    const seed = 42;
    const h = terrainHeight(HOLLOW_HUB_DOOR_POS.x, HOLLOW_HUB_DOOR_POS.z, seed);
    expect(h).toBeGreaterThan(-4.5); // above WATER_LEVEL
    expect(h).toBeLessThan(10); // the hub plateau is flattened, not a hillside
  });

  it('no mountain pass opens into Eastbrook: the sealed boundary is a wall the whole way across', () => {
    const seed = 42;
    const sealedZ = HOLLOW_ZONE_ZONE.zMax;
    // every sampled x, including the ordinary pass position (0), reads as wall
    for (const x of [-150, -100, -34, -10, 0, 10, 34, 100, 150]) {
      expect(terrainHeight(x, sealedZ, seed), `sealed boundary at x=${x}`).toBeGreaterThan(15);
    }
    // contrast: an ordinary (non-sealed) boundary keeps its walkable pass at x=0
    const openZ = ZONE1_ZONE.zMax;
    expect(terrainHeight(0, openZ, seed)).toBeLessThan(5);
    expect(terrainHeight(100, openZ, seed)).toBeGreaterThan(15);
  });
});
