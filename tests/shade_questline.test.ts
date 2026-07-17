// PHAA-558, expanded PHAA-614: Sister Shade's player-facing questline, the full
// shipped arc of four quests. These are content-shape tests: they guard the
// invariants the Board-accepted brief (shade-brief rev 1e9abd48) makes
// non-negotiable, which the generic progression checks do not encode. The
// headline one is REWARD INVERSION: no stats, ever, on this line. The rest
// guard that the line is dialog-only (no combat), correctly chained, and
// points at NPCs that exist.
import { describe, expect, it } from 'vitest';
import { ITEMS, NPCS, QUESTS } from '../src/sim/data';

const SHADE_LINE = [
  'q_have_you_eaten',
  'q_the_long_way_around',
  'q_someone_your_own_size',
  'q_the_watering_can',
] as const;

describe('Sister Shade questline (PHAA-558)', () => {
  it('Shade gives exactly the shipped arc, in order', () => {
    const shade = NPCS.shade;
    expect(shade).toBeTruthy();
    expect(shade.questIds).toEqual([...SHADE_LINE]);
    // She is a walking NPC (the watering guise), not posted like a quest-giver.
    expect(shade.wanderRadius).toBeGreaterThan(0);
  });

  it('the interact targets exist and are not themselves quest-givers', () => {
    for (const npcId of ['gate_bard', 'goodwife_orla', 'buried_root']) {
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

  it('the sprig is the sole item payoff, granted to every class; the finale is item-free', () => {
    const sprigQuest = QUESTS.q_someone_your_own_size;
    const rewarded = Object.values(sprigQuest.itemRewards).filter(Boolean);
    expect(rewarded.length).toBe(9); // one per class
    expect(new Set(rewarded)).toEqual(new Set(['willow_sprig']));
    // The other three beats (including the PHAA-614 finale) pay only in meaning, no item.
    for (const id of ['q_have_you_eaten', 'q_the_long_way_around', 'q_the_watering_can']) {
      expect(Object.values(QUESTS[id].itemRewards).filter(Boolean)).toEqual([]);
    }
  });

  it('the line is chained and staged so the first sighting stays marker-free', () => {
    // Quests 2 and 3 both open once quest 1 is done; quest 4 (the finale) requires quest 3.
    expect(QUESTS.q_the_long_way_around.requiresQuest).toBe('q_have_you_eaten');
    expect(QUESTS.q_someone_your_own_size.requiresQuest).toBe('q_have_you_eaten');
    expect(QUESTS.q_the_watering_can.requiresQuest).toBe('q_someone_your_own_size');
    // minLevel gating is what keeps a fresh level-1 arrival from seeing a marker, and
    // never drops as the arc proceeds.
    expect(QUESTS.q_have_you_eaten.minLevel).toBeGreaterThanOrEqual(2);
    let prevLevel = 0;
    for (const id of SHADE_LINE) {
      const lvl = QUESTS[id].minLevel ?? 0;
      expect(
        lvl,
        `${id} minLevel should not gate earlier than the previous beat`,
      ).toBeGreaterThanOrEqual(prevLevel);
      prevLevel = lvl;
    }
  });
});
