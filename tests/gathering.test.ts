// Gathering v0 (PHAA-504): single-use, first-come corpse harvest. This is the
// deliberate OPPOSITE of a world gathering node (per-player, everyone gets
// their own harvest); here two players racing the same corpse must resolve to
// exactly one success, deterministically, even when both commands land in the
// SAME 20 Hz tick (the server processes a tick's command batch synchronously,
// one command at a time, so there is no interleaving to race).

import { beforeEach, describe, expect, it } from 'vitest';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { HARVEST_COMPONENT_ITEMS, isHarvestableCorpse } from '../src/sim/gathering';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';

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
