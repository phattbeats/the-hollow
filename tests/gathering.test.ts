// Gathering v0 (PHAA-504): single-use, first-come corpse harvest. This is the
// deliberate OPPOSITE of a world gathering node (per-player, everyone gets
// their own harvest); here two players racing the same corpse must resolve to
// exactly one success, deterministically, even when both commands land in the
// SAME 20 Hz tick (the server processes a tick's command batch synchronously,
// one command at a time, so there is no interleaving to race).

import { beforeEach, describe, expect, it } from 'vitest';
import { GATHER_NODES, MOBS, zoneById } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import {
  HARVEST_COMPONENT_ITEMS,
  isHarvestableCorpse,
  NODE_HARVEST_TABLE,
} from '../src/sim/gathering';
import { Sim } from '../src/sim/sim';
import { type Entity, MAX_LEVEL, mobXpValue } from '../src/sim/types';

function makeCorpse(id: number, templateId: keyof typeof MOBS): Entity {
  const template = MOBS[templateId];
  const mob = createMob(id, template, template.maxLevel, { x: 0, y: 0, z: 0 });
  mob.dead = true;
  mob.aiState = 'dead';
  mob.corpseTimer = 9999;
  mob.respawnTimer = 9999;
  return mob;
}

describe('isHarvestableCorpse', () => {
  it('is false for undefined or empty component tags', () => {
    expect(isHarvestableCorpse(undefined)).toBe(false);
    expect(isHarvestableCorpse([])).toBe(false);
  });

  it('is true for any non-empty component tags', () => {
    expect(isHarvestableCorpse(['hide'])).toBe(true);
  });
});

describe('HARVEST_COMPONENT_ITEMS', () => {
  it('maps forest_wolf / wild_boar / webwood_spider tags to their existing loot items', () => {
    expect(HARVEST_COMPONENT_ITEMS.hide).toBe('boar_hide');
    expect(HARVEST_COMPONENT_ITEMS.fang).toBe('wolf_fang');
    expect(HARVEST_COMPONENT_ITEMS.silk).toBe('webwood_silk');
  });
});

describe('corpse harvest: single-use, first-come (PHAA-504)', () => {
  let sim: Sim;
  let a: number;
  let b: number;
  let mob: Entity;

  beforeEach(() => {
    sim = new Sim({ seed: 11, playerClass: 'warrior', noPlayer: true });
    a = sim.addPlayer('warrior', 'Alpha');
    b = sim.addPlayer('warrior', 'Bravo');
    sim.tick();
    for (const pid of [a, b]) {
      const e = sim.entities.get(pid)!;
      e.pos = { x: 0, y: 0, z: 0 };
      e.prevPos = { x: 0, y: 0, z: 0 };
    }
    mob = makeCorpse(9999, 'forest_wolf');
    sim.entities.set(mob.id, mob);
  });

  it('is unclaimed on a fresh corpse', () => {
    expect(mob.harvestClaimedBy).toBeNull();
  });

  it('the first attempt succeeds and claims the corpse', () => {
    sim.harvestCorpse(mob.id, a);
    expect(mob.harvestClaimedBy).toBe(a);
  });

  it('a later attempt against an already-claimed corpse is denied', () => {
    sim.harvestCorpse(mob.id, a);
    for (let i = 0; i < 20; i++) sim.tick();
    sim.harvestCorpse(mob.id, b);
    expect(mob.harvestClaimedBy).toBe(a);
  });

  it('exactly one of two attempts in the SAME tick succeeds, deterministically', () => {
    sim.harvestCorpse(mob.id, a);
    sim.harvestCorpse(mob.id, b);
    expect(mob.harvestClaimedBy).toBe(a);
  });

  it('is order-independent: whichever command is processed first wins, never both', () => {
    sim.harvestCorpse(mob.id, b);
    sim.harvestCorpse(mob.id, a);
    expect(mob.harvestClaimedBy).toBe(b);
  });

  it('grants the mapped component item only to the winner', () => {
    sim.harvestCorpse(mob.id, a);
    sim.harvestCorpse(mob.id, b);
    // forest_wolf's componentTags include 'hide'/'fang', both mapped to a real item.
    const total = sim.countItem('boar_hide', a) + sim.countItem('wolf_fang', a);
    expect(total).toBe(1);
    expect(sim.countItem('boar_hide', b) + sim.countItem('wolf_fang', b)).toBe(0);
  });

  it('rejects a harvest attempt on a corpse with no component tags', () => {
    const plain = makeCorpse(9998, 'mogger');
    sim.entities.set(plain.id, plain);
    sim.harvestCorpse(plain.id, a);
    expect(plain.harvestClaimedBy).toBeNull();
  });

  it('is reset by respawnMob', () => {
    sim.harvestCorpse(mob.id, a);
    expect(mob.harvestClaimedBy).toBe(a);
    mob.respawnTimer = 0;
    mob.corpseTimer = 0;
    for (let i = 0; i < 40 && mob.dead; i++) sim.tick();
    expect(mob.dead).toBe(false);
    expect(mob.harvestClaimedBy).toBeNull();
  });
});

describe('Sim.gathering.harvestItemFor', () => {
  it('returns null when no component tag maps to a wired item', () => {
    const sim = new Sim({ seed: 5, playerClass: 'warrior', noPlayer: true });
    expect(sim.gathering.harvestItemFor(['claw', 'tusk'])).toBeNull();
  });

  it('returns the sole mapped item when there is exactly one candidate', () => {
    const sim = new Sim({ seed: 5, playerClass: 'warrior', noPlayer: true });
    expect(sim.gathering.harvestItemFor(['hide'])).toBe('boar_hide');
  });
});

describe('gather node harvest (PHAA-505): per-player, everyone gets their own', () => {
  const NODE_ID = GATHER_NODES[0].id;
  const NODE_TYPE = GATHER_NODES[0].type;
  const ENTRY = NODE_HARVEST_TABLE[NODE_TYPE];

  let sim: Sim;
  let pid: number;

  beforeEach(() => {
    sim = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    pid = sim.addPlayer('warrior', 'Miner');
    const e = sim.entities.get(pid)!;
    e.pos = { x: GATHER_NODES[0].pos.x, y: 0, z: GATHER_NODES[0].pos.z };
    e.prevPos = { ...e.pos };
  });

  it('a player near a node receives the material item and their own respawn timer', () => {
    const before = sim.countItem(ENTRY.itemId, pid);
    sim.harvestNode(NODE_ID, pid);
    expect(sim.countItem(ENTRY.itemId, pid)).toBe(before + 1);
    expect(sim.nodeHarvestableByMeFor(NODE_ID, pid)).toBe(false);
  });

  it('denies harvest when the player is too far from the node', () => {
    const e = sim.entities.get(pid)!;
    e.pos = { x: -9999, y: 0, z: -9999 };
    e.prevPos = { ...e.pos };
    const before = sim.countItem(ENTRY.itemId, pid);
    sim.harvestNode(NODE_ID, pid);
    expect(sim.countItem(ENTRY.itemId, pid)).toBe(before);
  });

  it("two players harvesting the same node each get their own respawn timer: A's harvest never blocks B", () => {
    const pidB = sim.addPlayer('warrior', 'Bravo');
    const eB = sim.entities.get(pidB)!;
    eB.pos = { x: GATHER_NODES[0].pos.x, y: 0, z: GATHER_NODES[0].pos.z };
    eB.prevPos = { ...eB.pos };

    sim.harvestNode(NODE_ID, pid);
    expect(sim.countItem(ENTRY.itemId, pid)).toBe(1);
    expect(sim.nodeHarvestableByMeFor(NODE_ID, pid)).toBe(false);
    // B never harvested yet, so B can still harvest the SAME node: A's harvest
    // never touched B's timer.
    expect(sim.nodeHarvestableByMeFor(NODE_ID, pidB)).toBe(true);
    sim.harvestNode(NODE_ID, pidB);
    expect(sim.countItem(ENTRY.itemId, pidB)).toBe(1);
    expect(sim.nodeHarvestableByMeFor(NODE_ID, pidB)).toBe(false);
    expect(sim.nodeHarvestableByMeFor(NODE_ID, pid)).toBe(false);
  });

  it('denies a second harvest by the SAME player before their own timer elapses, allows it after', () => {
    sim.harvestNode(NODE_ID, pid);
    expect(sim.countItem(ENTRY.itemId, pid)).toBe(1);

    sim.harvestNode(NODE_ID, pid);
    expect(sim.countItem(ENTRY.itemId, pid)).toBe(1);

    sim.time += ENTRY.respawnSeconds + 1;
    expect(sim.nodeHarvestableByMeFor(NODE_ID, pid)).toBe(true);
    sim.harvestNode(NODE_ID, pid);
    expect(sim.countItem(ENTRY.itemId, pid)).toBe(2);
  });

  it('an unknown node id is denied without throwing', () => {
    expect(() => sim.harvestNode('not_a_real_node', pid)).not.toThrow();
    expect(sim.nodeHarvestableByMeFor('not_a_real_node', pid)).toBe(false);
  });

  it('a harvest grants the matching node type one point of gathering proficiency', () => {
    const before = sim.gatheringProficiencyFor(pid)[NODE_TYPE];
    sim.harvestNode(NODE_ID, pid);
    expect(sim.gatheringProficiencyFor(pid)[NODE_TYPE]).toBe(before + 1);
  });

  it('a harvest grants character XP with the same green-to-gray level-diff falloff as kill XP (PHAA-712)', () => {
    const meta = sim.players.get(pid)!;
    const zone = zoneById(GATHER_NODES[0].zoneId)!;
    const expectedXp = mobXpValue(zone.levelRange[0], sim.entities.get(pid)!.level);
    expect(expectedXp).toBeGreaterThan(0); // a fresh level-1 character is well within the zone's band
    const before = meta.lifetimeXp;
    sim.harvestNode(NODE_ID, pid);
    expect(meta.lifetimeXp).toBe(before + expectedXp);
  });

  it('grants zero XP once the node is trivial (gray) for the player level (PHAA-712)', () => {
    const p = sim.entities.get(pid)!;
    p.level = MAX_LEVEL;
    const meta = sim.players.get(pid)!;
    const before = meta.lifetimeXp;
    sim.harvestNode(NODE_ID, pid);
    // The item and proficiency still grant; only the character-XP award falls off.
    expect(sim.countItem(ENTRY.itemId, pid)).toBe(1);
    expect(meta.lifetimeXp).toBe(before);
  });

  it('denies harvest for a dead player without granting the item or the timer', () => {
    const p = sim.entities.get(pid)!;
    p.dead = true;
    const before = sim.countItem(ENTRY.itemId, pid);
    sim.harvestNode(NODE_ID, pid);
    expect(sim.countItem(ENTRY.itemId, pid)).toBe(before);
    expect(sim.nodeHarvestableByMeFor(NODE_ID, pid)).toBe(true);
  });

  it('determinism: the same seed and same sequence of harvests yields the same result', () => {
    const run = () => {
      const s = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
      const p = s.addPlayer('warrior', 'Det');
      const e = s.entities.get(p)!;
      e.pos = { x: GATHER_NODES[0].pos.x, y: 0, z: GATHER_NODES[0].pos.z };
      e.prevPos = { ...e.pos };
      s.harvestNode(NODE_ID, p);
      s.time += ENTRY.respawnSeconds - 1;
      const notYetReady = s.nodeHarvestableByMeFor(NODE_ID, p);
      s.time += 2;
      const nowReady = s.nodeHarvestableByMeFor(NODE_ID, p);
      return {
        count: s.countItem(ENTRY.itemId, p),
        notYetReady,
        nowReady,
        proficiency: s.gatheringProficiencyFor(p)[NODE_TYPE],
      };
    };
    expect(run()).toEqual(run());
  });

  it('spends exactly one rng draw on a granted harvest and none on any denial path (PHAA-506)', () => {
    // The rarity roll pulls from the SHARED sim rng, so a draw on a denial
    // would advance the whole sim's stream and desync every downstream roll.
    // harvestNode dispatches synchronously and nothing ticks inside this
    // bracket, so every counted draw belongs to the harvest path.
    let draws = 0;
    (sim as unknown as { rng: { setObserver(fn: () => void): void } }).rng.setObserver(() => {
      draws++;
    });

    sim.harvestNode(NODE_ID, pid); // granted: exactly the one rarity draw
    expect(draws).toBe(1);

    draws = 0;
    sim.harvestNode(NODE_ID, pid); // denied: not respawned for this player yet
    expect(draws).toBe(0);
    sim.harvestNode('no_such_node_id', pid); // denied: unknown node
    expect(draws).toBe(0);
    const p = sim.entities.get(pid)!;
    p.pos.x = GATHER_NODES[0].pos.x + 100;
    p.prevPos = { ...p.pos };
    sim.harvestNode(NODE_ID, pid); // denied: too far away
    expect(draws).toBe(0);
    p.dead = true;
    sim.harvestNode(NODE_ID, pid); // denied: dead, the first guard in the chain
    expect(draws).toBe(0);
  });

  it('a dead player triggers no rarity roll even when their node timer is ready (PHAA-506 ghost gate)', () => {
    // Upstream regression guard (ghost_dead_gate): the dead check sits before
    // resolveHarvest, so a dead or released-spirit player can neither harvest
    // nor advance the shared rng stream, even with a fresh (always-ready)
    // per-player timer for the node.
    const p = sim.entities.get(pid)!;
    p.dead = true;
    expect(sim.nodeHarvestableByMeFor(NODE_ID, pid)).toBe(true);
    let draws = 0;
    (sim as unknown as { rng: { setObserver(fn: () => void): void } }).rng.setObserver(() => {
      draws++;
    });
    const before = sim.countItem(ENTRY.itemId, pid);
    sim.harvestNode(NODE_ID, pid);
    expect(sim.countItem(ENTRY.itemId, pid)).toBe(before);
    expect(sim.nodeHarvestableByMeFor(NODE_ID, pid)).toBe(true);
    expect(draws).toBe(0);
  });
});
