// Content-integrity checks for the Book of Asphodelia roster (PHAA-745): every
// reference a deed makes into other content tables must resolve, and every
// record's own id must be internally consistent. Credit/completion math itself
// is covered by tests/deeds.test.ts against synthetic DeedDefs; this file only
// validates the authored DEEDS/TITLES data.

import { describe, expect, it } from 'vitest';
import { DEEDS, TITLES } from '../src/sim/content/deeds';
import { DELVES, ITEMS, MOBS, NPCS, QUESTS, ZONES } from '../src/sim/data';
import { MAX_LEVEL } from '../src/sim/types';

describe('deeds content: referential integrity', () => {
  it('keys every DEEDS/TITLES record under its own id', () => {
    for (const [key, def] of Object.entries(DEEDS)) expect(def.id).toBe(key);
    for (const [key, def] of Object.entries(TITLES)) expect(def.id).toBe(key);
  });

  it('has at least one authored deed and title', () => {
    expect(Object.keys(DEEDS).length).toBeGreaterThan(0);
    expect(Object.keys(TITLES).length).toBeGreaterThan(0);
  });

  it('every kill objective targetMobId (when set) resolves to a real mob', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'kill' && obj.targetMobId) {
          expect(MOBS[obj.targetMobId], `${def.id}: unknown mob ${obj.targetMobId}`).toBeDefined();
        }
      }
    }
  });

  it('never uses an empty-string targetMobId (that silently wildcards, unlike an omitted id)', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'kill') {
          expect(obj.targetMobId, `${def.id}: targetMobId must be omitted, not ''`).not.toBe('');
        }
      }
    }
  });

  it('every quest objective questId (when set) resolves to a real quest', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'quest' && obj.questId) {
          expect(QUESTS[obj.questId], `${def.id}: unknown quest ${obj.questId}`).toBeDefined();
        }
      }
    }
  });

  it('never uses an empty-string questId (that silently wildcards, unlike an omitted id)', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'quest') {
          expect(obj.questId, `${def.id}: questId must be omitted, not ''`).not.toBe('');
        }
      }
    }
  });

  it('every delve objective delveId (when set) resolves to a real delve', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'delve' && obj.delveId) {
          expect(DELVES[obj.delveId], `${def.id}: unknown delve ${obj.delveId}`).toBeDefined();
        }
      }
    }
  });

  it('every delve objective tierId (when set) resolves to a real tier of its delve', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'delve' && obj.tierId) {
          const delve = obj.delveId ? DELVES[obj.delveId] : undefined;
          expect(delve, `${def.id}: tierId set without a resolvable delveId`).toBeDefined();
          expect(
            delve?.tiers.some((t) => t.id === obj.tierId),
            `${def.id}: unknown tier ${obj.tierId} for delve ${obj.delveId}`,
          ).toBe(true);
        }
      }
    }
  });

  it('never uses an empty-string delveId (that silently wildcards, unlike an omitted id)', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'delve') {
          expect(obj.delveId, `${def.id}: delveId must be omitted, not ''`).not.toBe('');
        }
      }
    }
  });

  it('every collect objective itemId resolves to a real item', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'collect') {
          expect(obj.itemId, `${def.id}: collect objective missing itemId`).toBeDefined();
          expect(
            ITEMS[obj.itemId as string],
            `${def.id}: unknown item ${obj.itemId}`,
          ).toBeDefined();
        }
      }
    }
  });

  it('every explore objective zoneId (when set) resolves to a real zone', () => {
    const zoneIds = new Set(ZONES.map((z) => z.id));
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'explore' && obj.zoneId) {
          expect(zoneIds.has(obj.zoneId), `${def.id}: unknown zone ${obj.zoneId}`).toBe(true);
        }
      }
    }
  });

  it('never uses an empty-string zoneId (that silently wildcards, unlike an omitted id)', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'explore') {
          expect(obj.zoneId, `${def.id}: zoneId must be omitted, not ''`).not.toBe('');
        }
      }
    }
  });

  it('every level objective has a creditable atLeast within [2, MAX_LEVEL]', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'level') {
          expect(obj.atLeast, `${def.id}: level objective missing atLeast`).toBeDefined();
          // The onLevelReachedForDeeds hook only fires inside the grantXp
          // level-up loop after p.level++, so its lowest possible firing level
          // is 2 (characters start at level 1 with no level-up event). An
          // atLeast of 0 or 1 would never credit, so it is an authoring error.
          expect(
            obj.atLeast as number,
            `${def.id}: atLeast ${obj.atLeast} can never credit (lowest firing level is 2)`,
          ).toBeGreaterThanOrEqual(2);
          expect(
            obj.atLeast as number,
            `${def.id}: atLeast ${obj.atLeast} above MAX_LEVEL ${MAX_LEVEL}`,
          ).toBeLessThanOrEqual(MAX_LEVEL);
        }
      }
    }
  });

  it('every titleReward resolves to a real title', () => {
    for (const def of Object.values(DEEDS)) {
      if (def.titleReward) {
        expect(
          TITLES[def.titleReward],
          `${def.id}: unknown title ${def.titleReward}`,
        ).toBeDefined();
      }
    }
  });

  it('every objective has a positive count and a non-empty label', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        expect(obj.count, `${def.id}: non-positive count`).toBeGreaterThan(0);
        expect(obj.label.length, `${def.id}: empty objective label`).toBeGreaterThan(0);
      }
    }
  });
});

describe('deeds content: dungeon category', () => {
  const dungeonDeeds = Object.values(DEEDS).filter((d) => d.category === 'dungeon');

  it('every dungeon deed credits only through kill objectives (rides the shipped kill hook)', () => {
    // The dungeon category adds no new engine hook: a dungeon clear is its final
    // boss kill, so every dungeon deed must be a 'kill' objective the existing
    // onMobKilledForDeeds path already credits. If this fails, the objective type
    // needs its own hook wired before the content can credit.
    expect(dungeonDeeds.length).toBeGreaterThan(0);
    for (const def of dungeonDeeds) {
      for (const obj of def.objectives) {
        expect(obj.type, `${def.id}: dungeon deed uses unsupported objective ${obj.type}`).toBe(
          'kill',
        );
      }
    }
  });

  it('every dungeon deed targets a real final-boss mob (MOBS[id].boss === true)', () => {
    for (const def of dungeonDeeds) {
      for (const obj of def.objectives) {
        expect(obj.targetMobId, `${def.id}: dungeon objective missing a boss target`).toBeDefined();
        const mob = MOBS[obj.targetMobId as string];
        expect(mob, `${def.id}: unknown dungeon boss ${obj.targetMobId}`).toBeDefined();
        expect(mob.boss, `${def.id}: ${obj.targetMobId} is not a final boss (boss !== true)`).toBe(
          true,
        );
      }
    }
  });

  it('the grand-slam capstone covers every distinct dungeon final boss', () => {
    const capstone = DEEDS.dgn_hollow_conqueror;
    expect(capstone, 'missing dgn_hollow_conqueror capstone').toBeDefined();
    const capstoneBosses = new Set(capstone.objectives.map((o) => o.targetMobId));
    // Every boss:true mob the dungeon deeds reference must appear in the capstone,
    // so completing it truly means "cleared every dungeon".
    const allDungeonBosses = new Set(
      dungeonDeeds.flatMap((d) => d.objectives.map((o) => o.targetMobId)),
    );
    for (const bossId of allDungeonBosses) {
      expect(capstoneBosses.has(bossId), `capstone omits dungeon boss ${bossId}`).toBe(true);
    }
  });
});

describe('deeds content: exploration category', () => {
  const exploreDeeds = Object.values(DEEDS).filter((d) => d.category === 'exploration');

  it('every exploration deed credits only through explore objectives (rides the zone-visit hook)', () => {
    expect(exploreDeeds.length).toBeGreaterThan(0);
    for (const def of exploreDeeds) {
      for (const obj of def.objectives) {
        expect(obj.type, `${def.id}: exploration deed uses unsupported objective ${obj.type}`).toBe(
          'explore',
        );
      }
    }
  });

  it('every exploration objective targets a specific zone with count 1 (a zone is entered once)', () => {
    // The zone-visit hook fires once per entry and caps at the objective count;
    // targeting a specific zone with count 1 makes each zone credit its
    // objective exactly once. A wildcard or count>1 explore objective would
    // over-count across re-entries, so authored content must avoid it.
    for (const def of exploreDeeds) {
      for (const obj of def.objectives) {
        expect(
          obj.zoneId,
          `${def.id}: exploration objective missing a specific zoneId`,
        ).toBeDefined();
        expect(obj.count, `${def.id}: exploration objective count must be 1`).toBe(1);
      }
    }
  });

  it('the grand-tour capstone covers every distinct zone the exploration deeds reference', () => {
    const capstone = DEEDS.exp_grand_tour;
    expect(capstone, 'missing exp_grand_tour capstone').toBeDefined();
    const capstoneZones = new Set(capstone.objectives.map((o) => o.zoneId));
    const allZones = new Set(exploreDeeds.flatMap((d) => d.objectives.map((o) => o.zoneId)));
    for (const zoneId of allZones) {
      expect(capstoneZones.has(zoneId), `capstone omits zone ${zoneId}`).toBe(true);
    }
  });
});

describe('deeds content: feat category', () => {
  const featDeeds = Object.values(DEEDS).filter((d) => d.category === 'feat');
  // The feat category adds no new engine hook: every objective must reuse a type
  // whose credit path already ships. If a feat needs a new objective type, that
  // type's hook has to be wired before the content can credit.
  const SHIPPED_TYPES = new Set(['kill', 'delve', 'quest', 'level', 'explore', 'collect']);

  it('has at least one authored feat, each rewarding a title', () => {
    expect(featDeeds.length).toBeGreaterThan(0);
    for (const def of featDeeds) {
      expect(def.titleReward, `${def.id}: a feat should reward a title`).toBeDefined();
    }
  });

  it('every feat objective reuses an already-shipped objective type', () => {
    for (const def of featDeeds) {
      for (const obj of def.objectives) {
        expect(
          SHIPPED_TYPES.has(obj.type),
          `${def.id}: feat uses objective type ${obj.type} with no shipped hook`,
        ).toBe(true);
      }
    }
  });

  it('the Grand Asphodelian capstone spans several distinct systems (a true cross-system feat)', () => {
    const capstone = DEEDS.feat_grand_asphodelian;
    expect(capstone, 'missing feat_grand_asphodelian capstone').toBeDefined();
    const kinds = new Set(capstone.objectives.map((o) => o.type));
    expect(
      kinds.size,
      'the capstone should combine at least three objective kinds',
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('deeds content: hidden category', () => {
  const hiddenDeeds = Object.values(DEEDS).filter((d) => d.category === 'hidden');
  // Hidden deeds are secret (concealed in the book until earned, PHAA-748) but
  // add no new engine hook: every objective must reuse a type whose credit path
  // already ships. The category rides only the kill and collect paths today.
  const SHIPPED_HIDDEN_TYPES = new Set(['kill', 'collect']);

  it('has at least one authored hidden deed', () => {
    expect(hiddenDeeds.length).toBeGreaterThan(0);
  });

  it('every hidden objective reuses an already-shipped objective type (no new hook)', () => {
    for (const def of hiddenDeeds) {
      for (const obj of def.objectives) {
        expect(
          SHIPPED_HIDDEN_TYPES.has(obj.type),
          `${def.id}: hidden deed uses objective type ${obj.type} with no shipped hook`,
        ).toBe(true);
      }
    }
  });

  it('every hidden kill objective targets a specific mob (a secret is not a wildcard grind)', () => {
    for (const def of hiddenDeeds) {
      for (const obj of def.objectives) {
        if (obj.type === 'kill') {
          expect(
            obj.targetMobId,
            `${def.id}: hidden kill objective must name a specific mob`,
          ).toBeDefined();
          expect(
            MOBS[obj.targetMobId ?? ''],
            `${def.id}: unknown mob ${obj.targetMobId}`,
          ).toBeDefined();
        }
      }
    }
  });

  it('every hidden collect objective names a real item', () => {
    for (const def of hiddenDeeds) {
      for (const obj of def.objectives) {
        if (obj.type === 'collect') {
          expect(obj.itemId, `${def.id}: hidden collect objective must name an item`).toBeDefined();
          expect(ITEMS[obj.itemId ?? ''], `${def.id}: unknown item ${obj.itemId}`).toBeDefined();
        }
      }
    }
  });
});

describe('deeds content: pvp category', () => {
  const pvpDeeds = Object.values(DEEDS).filter((d) => d.category === 'pvp');

  it('has at least one authored pvp deed', () => {
    expect(pvpDeeds.length).toBeGreaterThan(0);
  });

  it('every pvp deed credits only through pvp objectives (rides the shipped pvp-win hook)', () => {
    for (const def of pvpDeeds) {
      for (const obj of def.objectives) {
        expect(obj.type, `${def.id}: pvp deed uses unsupported objective ${obj.type}`).toBe('pvp');
      }
    }
  });

  it('never uses an empty-string pvpKind (that silently wildcards, unlike an omitted kind)', () => {
    for (const def of pvpDeeds) {
      for (const obj of def.objectives) {
        expect(obj.pvpKind, `${def.id}: pvpKind must be omitted, not ''`).not.toBe('');
      }
    }
  });
});

describe('deeds content: social category', () => {
  const socialDeeds = Object.values(DEEDS).filter((d) => d.category === 'social');

  it('has at least one authored social deed', () => {
    expect(socialDeeds.length).toBeGreaterThan(0);
  });

  it('every social deed credits only through social objectives (rides the shipped social-action hook)', () => {
    for (const def of socialDeeds) {
      for (const obj of def.objectives) {
        expect(obj.type, `${def.id}: social deed uses unsupported objective ${obj.type}`).toBe(
          'social',
        );
      }
    }
  });

  it('never authors a bank-kind deed (the vault has no banker NPC placed yet, see bank.ts)', () => {
    // Deferred like the dungeon category's deathless-clear deed: the engine hook
    // exists and is tested, but content would be permanently uncompletable
    // until a follow-up ticket places banker NPCs in zone content.
    for (const def of socialDeeds) {
      for (const obj of def.objectives) {
        expect(obj.socialKind, `${def.id}: bank-kind deed is unreachable, see bank.ts`).not.toBe(
          'bank',
        );
      }
    }
  });

  it('every talk objective npcId (when set) resolves to a real NPC', () => {
    for (const def of socialDeeds) {
      for (const obj of def.objectives) {
        if (obj.socialKind === 'talk' && obj.npcId) {
          expect(NPCS[obj.npcId], `${def.id}: unknown NPC ${obj.npcId}`).toBeDefined();
        }
      }
    }
  });

  it('never uses an empty-string npcId (that silently wildcards, unlike an omitted id)', () => {
    for (const def of socialDeeds) {
      for (const obj of def.objectives) {
        if (obj.socialKind === 'talk') {
          expect(obj.npcId, `${def.id}: npcId must be omitted, not ''`).not.toBe('');
        }
      }
    }
  });
});
