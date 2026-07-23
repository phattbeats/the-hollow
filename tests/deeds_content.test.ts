// Content-integrity checks for the Book of Asphodelia roster (PHAA-745): every
// reference a deed makes into other content tables must resolve, and every
// record's own id must be internally consistent. Credit/completion math itself
// is covered by tests/deeds.test.ts against synthetic DeedDefs; this file only
// validates the authored DEEDS/TITLES data.

import { describe, expect, it } from 'vitest';
import { DEEDS, TITLES } from '../src/sim/content/deeds';
import { DELVES, ITEMS, MOBS, QUESTS } from '../src/sim/data';
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

  it('every level objective has an atLeast within [1, MAX_LEVEL]', () => {
    for (const def of Object.values(DEEDS)) {
      for (const obj of def.objectives) {
        if (obj.type === 'level') {
          expect(obj.atLeast, `${def.id}: level objective missing atLeast`).toBeDefined();
          expect(obj.atLeast as number, `${def.id}: atLeast below 1`).toBeGreaterThanOrEqual(1);
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
