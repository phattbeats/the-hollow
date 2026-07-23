// Content-integrity checks for the Book of Asphodelia roster (PHAA-745): every
// reference a deed makes into other content tables must resolve, and every
// record's own id must be internally consistent. Credit/completion math itself
// is covered by tests/deeds.test.ts against synthetic DeedDefs; this file only
// validates the authored DEEDS/TITLES data.

import { describe, expect, it } from 'vitest';
import { DEEDS, TITLES } from '../src/sim/content/deeds';
import { ITEMS, MOBS } from '../src/sim/data';

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
