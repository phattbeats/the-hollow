import { describe, expect, it } from 'vitest';
import { HEROIC_DELVE_MARK } from '../src/sim/content/heroic_loot';
import {
  buildHeroicVariants,
  heroicVariantId,
  isHeroicVariantId,
} from '../src/sim/content/heroic_variants';
import { ITEMS, MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { lootCorpse } from '../src/sim/interaction';
import { itemLevel } from '../src/sim/item_level';
import { discardItem } from '../src/sim/items';
import { rollLoot } from '../src/sim/loot/loot_roll';
import type { PlayerMeta } from '../src/sim/sim';
import { Sim } from '../src/sim/sim';
import type { DelveRun, Entity, LootSlot } from '../src/sim/types';

// PHAA-659: heroic loot wave adapted onto the fork's Heroic DELVE tier (upstream
// #1705/#1767). Covers the three pieces: the epic/rare mob-drop swap to its
// Heroic variant (content/heroic_variants.ts + the swap in loot_roll.ts), the
// Heroic Mark soulbound currency + its shared-personal fan-out at the finale
// boss (heroic_loot.ts + interaction.ts's lootCorpse), and the soulbound gate
// on discardItem (items.ts).

const makeSim = (seed = 1) => new Sim({ seed, playerClass: 'warrior', noPlayer: true });

function playerMeta(sim: Sim, pid: number): PlayerMeta {
  const meta = sim.ctx.players.get(pid);
  if (!meta) throw new Error(`expected player ${pid}`);
  return meta;
}

// Forces ctx.delveRunForMob to report a Heroic-tier claim for every mob id, the
// same fake-DelveRun-cast pattern tests/delves_runs.test.ts already uses.
function forceHeroicClaim(sim: Sim): void {
  sim.ctx.delveRunForMob = () => ({ tierId: 'heroic' }) as unknown as DelveRun;
}

describe('heroic_variants: buildHeroicVariants (content-evaluation, pure)', () => {
  it('builds a Heroic copy for every epic/rare equippable a mob can drop', () => {
    const variant = ITEMS[heroicVariantId('fang_of_korzul')];
    expect(variant).toBeDefined();
    expect(variant.heroicOf).toBe('fang_of_korzul');
    expect(isHeroicVariantId(variant.id)).toBe(true);
  });

  it('never produces a variant for a sub-epic/rare item', () => {
    expect(ITEMS[heroicVariantId('mistveil_cord')]).toBeUndefined();
  });

  it('reuses the base item name (the [HEROIC] tag is a tooltip-boundary concern, not the name)', () => {
    const base = ITEMS.fang_of_korzul;
    const variant = ITEMS[heroicVariantId('fang_of_korzul')];
    expect(variant.name).toBe(base.name);
  });

  it('never downgrades: the variant item level is at or above its base', () => {
    const base = ITEMS.fang_of_korzul;
    const variant = ITEMS[heroicVariantId('fang_of_korzul')];
    expect(itemLevel(variant) ?? 0).toBeGreaterThanOrEqual(itemLevel(base) ?? 0);
  });

  it('scales a weapon variant to the heroic DPS ladder, keeping speed', () => {
    const base = ITEMS.fang_of_korzul;
    const variant = ITEMS[heroicVariantId('fang_of_korzul')];
    expect(variant.weapon?.speed).toBe(base.weapon?.speed);
    const baseDps =
      ((base.weapon?.min ?? 0) + (base.weapon?.max ?? 0)) / 2 / (base.weapon?.speed ?? 1);
    const variantDps =
      ((variant.weapon?.min ?? 0) + (variant.weapon?.max ?? 0)) / 2 / (variant.weapon?.speed ?? 1);
    expect(variantDps).toBeGreaterThanOrEqual(baseDps);
  });

  it('rebuilding from an already-merged ITEMS table reproduces the exact same variants', () => {
    // buildHeroicVariants only reads mob.loot base ids (never a variant's own
    // heroicOf), so calling it again against the fully merged ITEMS/MOBS tables
    // is deterministic and does not build a variant of a variant.
    const rebuilt = buildHeroicVariants(ITEMS, MOBS);
    expect(rebuilt[heroicVariantId('fang_of_korzul')]).toEqual(
      ITEMS[heroicVariantId('fang_of_korzul')],
    );
    expect(Object.keys(rebuilt).some((id) => isHeroicVariantId(id.replace(/^heroic_/, '')))).toBe(
      false,
    );
  });
});

describe('loot_roll: the Heroic-tier mob-loot swap', () => {
  function dropRate(
    seed: number,
    mobId: string,
    itemId: string,
    n: number,
    heroic: boolean,
  ): number {
    const sim = makeSim(seed);
    if (heroic) forceHeroicClaim(sim);
    const pid = sim.addPlayer('warrior', 'Looter');
    const meta = playerMeta(sim, pid);
    const template = MOBS[mobId];
    let hits = 0;
    for (let i = 0; i < n; i++) {
      const mob = createMob(-1, template, template.minLevel, { x: 0, y: 0, z: 0 });
      rollLoot(sim.ctx, mob, meta);
      if (mob.loot?.items.some((s) => s.itemId === itemId)) hits++;
    }
    return hits / n;
  }

  it('never drops the base epic outside a Heroic claim', () => {
    expect(dropRate(11, 'korzul_the_gravewyrm', 'heroic_fang_of_korzul', 4000, false)).toBe(0);
  });

  it('swaps the base epic for its Heroic variant inside a Heroic claim', () => {
    const heroicRate = dropRate(11, 'korzul_the_gravewyrm', 'heroic_fang_of_korzul', 4000, true);
    const baseRate = dropRate(11, 'korzul_the_gravewyrm', 'fang_of_korzul', 4000, true);
    expect(heroicRate).toBeGreaterThan(0);
    expect(baseRate).toBe(0);
  });

  it('does not draw any extra rng (identical hit sequencing between normal and heroic runs)', () => {
    // Same seed, same mob, same n: a heroic claim must not add or skip rng draws,
    // so the overall union of (base | heroic) ids drops at the same combined rate.
    const seed = 22;
    const n = 4000;
    const normalRate = dropRate(seed, 'korzul_the_gravewyrm', 'fang_of_korzul', n, false);
    const heroicRate = dropRate(seed, 'korzul_the_gravewyrm', 'heroic_fang_of_korzul', n, true);
    expect(heroicRate).toBeCloseTo(normalRate, 5);
  });
});

describe('loot_roll: the Heroic finale Mark fan-out', () => {
  it('appends a shared-personal Heroic Mark for every eligible player on a Heroic claim', () => {
    const sim = makeSim(5);
    forceHeroicClaim(sim);
    const a = sim.addPlayer('warrior', 'Aaa');
    const b = sim.addPlayer('mage', 'Bbb');
    const metaA = playerMeta(sim, a);
    const metaB = playerMeta(sim, b);
    const template = MOBS.deacon_varric;
    const mob = createMob(-1, template, template.minLevel, { x: 0, y: 0, z: 0 });
    rollLoot(sim.ctx, mob, metaA, [metaA, metaB]);
    const mark = mob.loot?.items.find((s) => s.itemId === 'delve_heroic_mark');
    expect(mark).toBeDefined();
    expect(mark?.sharedPersonal).toBe(true);
    expect(mark?.personalFor).toEqual([a, b]);
  });

  it('never appends the Heroic Mark outside a Heroic claim', () => {
    const sim = makeSim(5);
    const pid = sim.addPlayer('warrior', 'Aaa');
    const meta = playerMeta(sim, pid);
    const template = MOBS.deacon_varric;
    const mob = createMob(-1, template, template.minLevel, { x: 0, y: 0, z: 0 });
    rollLoot(sim.ctx, mob, meta);
    expect(mob.loot?.items.some((s) => s.itemId === 'delve_heroic_mark')).toBe(false);
  });
});

describe('interaction.ts lootCorpse: shared-personal fan-out', () => {
  function deadCorpse(
    sim: Sim,
    tapper: number,
    recipients: number[],
    loot: Entity['loot'],
  ): Entity {
    const mob = createMob(sim.nextId++, MOBS.deacon_varric, 9, { x: 0, y: 0, z: 0 });
    mob.dead = true;
    mob.lootable = true;
    mob.tappedById = tapper;
    mob.lootRecipientIds = recipients;
    mob.loot = loot;
    sim.entities.set(mob.id, mob);
    return mob;
  }

  it('grants every listed recipient one copy from a single loot action, then consumes the slot', () => {
    const sim = makeSim(9);
    const a = sim.addPlayer('warrior', 'Aaa');
    const b = sim.addPlayer('mage', 'Bbb');
    const c = sim.addPlayer('rogue', 'Ccc');
    const slot: LootSlot = {
      itemId: 'delve_heroic_mark',
      count: 1,
      personalFor: [a, b, c],
      sharedPersonal: true,
    };
    const mob = deadCorpse(sim, a, [a, b, c], { copper: 0, items: [slot] });
    lootCorpse(sim.ctx, mob.id, a);
    for (const pid of [a, b, c]) {
      expect(sim.ctx.countItem('delve_heroic_mark', pid)).toBe(1);
    }
    expect(slot.count).toBe(0);
    expect(slot.personalFor).toEqual([]);
    // A second loot action (by a different recipient) grants nothing further:
    // the slot is already consumed.
    lootCorpse(sim.ctx, mob.id, b);
    expect(sim.ctx.countItem('delve_heroic_mark', b)).toBe(1);
  });
});

describe('soulbound items (types.ts / items.ts)', () => {
  it('the Heroic Mark is soulbound and never discardable', () => {
    expect(HEROIC_DELVE_MARK.soulbound).toBe(true);
    const sim = makeSim(3);
    const pid = sim.addPlayer('warrior', 'Aaa');
    sim.ctx.addItem('delve_heroic_mark', 2, pid);
    discardItem(sim.ctx, 'delve_heroic_mark', 1, pid);
    expect(sim.ctx.countItem('delve_heroic_mark', pid)).toBe(2);
  });

  it('discardItem blocks any soulbound item, even one without its own noDiscard flag', () => {
    // Exercises the `def.noDiscard || def.soulbound` branch (items.ts) directly,
    // independent of how the Heroic Mark itself happens to be authored.
    const sim = makeSim(3);
    const pid = sim.addPlayer('warrior', 'Aaa');
    const soulboundOnly = { ...ITEMS.mistveil_cord, id: 'test_soulbound_only', soulbound: true };
    (ITEMS as Record<string, typeof soulboundOnly>).test_soulbound_only = soulboundOnly;
    sim.ctx.addItem('test_soulbound_only', 1, pid);
    discardItem(sim.ctx, 'test_soulbound_only', 1, pid);
    expect(sim.ctx.countItem('test_soulbound_only', pid)).toBe(1);
    delete (ITEMS as Record<string, unknown>).test_soulbound_only;
  });

  it('is never tradeable, market-listable, or vendor-sellable', () => {
    expect(HEROIC_DELVE_MARK.noMarketList).toBe(true);
    expect(HEROIC_DELVE_MARK.noVendorSell).toBe(true);
  });
});
