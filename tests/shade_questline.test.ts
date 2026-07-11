// PHAA-558: Sister Shade's player-facing questline (quests 1 and 3, the fully
// unblocked pair). These are content-shape tests: they guard the invariants the
// Board-accepted brief (shade-brief rev 1e9abd48) makes non-negotiable, which the
// generic progression checks do not encode. The headline one is REWARD INVERSION:
// no stats, ever, on this line. The rest guard that the line is dialog-only (no
// combat), correctly chained, and points at NPCs that exist.
import { describe, expect, it } from 'vitest';
import { ITEMS, NPCS, QUESTS } from '../src/sim/data';

const SHADE_LINE = ['q_have_you_eaten', 'q_someone_your_own_size'] as const;

describe('Sister Shade questline (PHAA-558)', () => {
  it('Shade gives exactly the shipped, unblocked pair', () => {
    const shade = NPCS.shade;
    expect(shade).toBeTruthy();
    expect(shade.questIds).toEqual([...SHADE_LINE]);
    // She is a walking NPC (the watering guise), not posted like a quest-giver.
    expect(shade.wanderRadius).toBeGreaterThan(0);
  });

  it('the interact targets exist and are not themselves quest-givers', () => {
    for (const npcId of ['gate_bard', 'goodwife_orla']) {
      const npc = NPCS[npcId];
      expect(npc, `${npcId} missing`).toBeTruthy();
      expect(npc.questIds, `${npcId} should not give quests`).toEqual([]);
    }
  });

  it('every quest on the line is dialog-only: no combat, only interact objectives', () => {
    for (const id of SHADE_LINE) {
      const q = QUESTS[id];
      expect(q, `${id} missing`).toBeTruthy();
      for (const obj of q.objectives) {
        expect(obj.type, `${id}: ${obj.type} is combat/farming, not allowed on this line`).toBe(
          'interact',
        );
        expect(
          NPCS[obj.targetNpcId ?? ''],
          `${id}: interact target ${obj.targetNpcId} missing`,
        ).toBeTruthy();
      }
    }
  });

  it('REWARD INVERSION: no quest on the line grants an item that carries stats', () => {
    for (const id of SHADE_LINE) {
      const q = QUESTS[id];
      for (const itemId of Object.values(q.itemRewards)) {
        if (!itemId) continue;
        const item = ITEMS[itemId];
        expect(item, `${id}: reward ${itemId} missing`).toBeTruthy();
        expect(item.stats, `${id}: reward ${itemId} must be stat-free`).toBeUndefined();
        expect(item.sellValue, `${id}: keepsake ${itemId} must not be sellable`).toBe(0);
      }
    }
  });

  it('the willow_sprig keepsake is a stat-free, unsellable charm', () => {
    const sprig = ITEMS.willow_sprig;
    expect(sprig).toBeTruthy();
    expect(sprig.kind).toBe('quest');
    expect(sprig.stats).toBeUndefined();
    expect(sprig.slot).toBeUndefined();
    expect(sprig.sellValue).toBe(0);
  });

  it('the sprig is the payoff for the END of the shippable arc, granted to every class', () => {
    const end = QUESTS.q_someone_your_own_size;
    const rewarded = Object.values(end.itemRewards).filter(Boolean);
    expect(rewarded.length).toBe(9); // one per class
    expect(new Set(rewarded)).toEqual(new Set(['willow_sprig']));
    // The earlier beat pays only in meaning, no item.
    expect(Object.values(QUESTS.q_have_you_eaten.itemRewards).filter(Boolean)).toEqual([]);
  });

  it('the line is chained and staged so the first sighting stays marker-free', () => {
    expect(QUESTS.q_someone_your_own_size.requiresQuest).toBe('q_have_you_eaten');
    // minLevel gating is what keeps a fresh level-1 arrival from seeing a marker.
    expect(QUESTS.q_have_you_eaten.minLevel).toBeGreaterThanOrEqual(2);
    expect(QUESTS.q_someone_your_own_size.minLevel).toBeGreaterThanOrEqual(
      QUESTS.q_have_you_eaten.minLevel ?? 0,
    );
  });
});
