// PHAA-558 / PHAA-614: Sister Shade's player-facing questline. Originally shipped
// as quests 1 and 3 (the unblocked pair); PHAA-614 / PR #199 landed quests 2 and 4
// ("The Long Way Around", "The Watering Can") once their gates cleared, so the
// SHIPPED line is now all four, in giver order. These are content-shape tests: they
// guard the invariants the Board-accepted brief (shade-brief rev 1e9abd48) makes
// non-negotiable, which the generic progression checks do not encode. The headline
// one is REWARD INVERSION: no stats, ever, on this line. The rest guard that the
// line is dialog-only (no combat), correctly chained, first-sighting marker-free,
// and points at NPCs that exist.
//
// Reconciled to the 4-quest line under PHAA-694 (main was RED because this test
// still asserted the old two-quest pair after PR #199 expanded the source data;
// the expansion is sound: progression.test.ts is green, both new targets exist,
// both new quests are interact-only and stat-free).
import { describe, expect, it } from 'vitest';
import { ITEMS, NPCS, QUESTS } from '../src/sim/data';

// The full shipped line, in the giver order committed in hollow_zone.ts.
const SHADE_LINE = [
  'q_have_you_eaten',
  'q_the_long_way_around',
  'q_someone_your_own_size',
  'q_the_watering_can',
] as const;

describe('Sister Shade questline (PHAA-558 / PHAA-614)', () => {
  it('Shade gives exactly the shipped line, in order', () => {
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

  it('the sprig is the payoff for the shippable arc, granted to every class; the beats around it pay only in meaning', () => {
    const sprigQuest = QUESTS.q_someone_your_own_size;
    const rewarded = Object.values(sprigQuest.itemRewards).filter(Boolean);
    expect(rewarded.length).toBe(9); // one per class
    expect(new Set(rewarded)).toEqual(new Set(['willow_sprig']));
    // The opener and the finale both pay only in meaning, no item.
    expect(Object.values(QUESTS.q_have_you_eaten.itemRewards).filter(Boolean)).toEqual([]);
    expect(Object.values(QUESTS.q_the_watering_can.itemRewards).filter(Boolean)).toEqual([]);
  });

  it('the line is chained and staged so the first sighting stays marker-free', () => {
    // Quests 2 and 3 both open off quest 1; the finale (4) rides quest 3.
    expect(QUESTS.q_the_long_way_around.requiresQuest).toBe('q_have_you_eaten');
    expect(QUESTS.q_someone_your_own_size.requiresQuest).toBe('q_have_you_eaten');
    expect(QUESTS.q_the_watering_can.requiresQuest).toBe('q_someone_your_own_size');
    // minLevel gating is what keeps a fresh level-1 arrival from seeing a marker:
    // every quest on the line is gated at level 2 or above.
    for (const id of SHADE_LINE) {
      expect(QUESTS[id].minLevel ?? 0, `${id} must be minLevel-gated (>=2)`).toBeGreaterThanOrEqual(
        2,
      );
    }
    // The line stages upward: the sprig payoff and the finale sit above the opener.
    expect(QUESTS.q_someone_your_own_size.minLevel ?? 0).toBeGreaterThanOrEqual(
      QUESTS.q_have_you_eaten.minLevel ?? 0,
    );
    expect(QUESTS.q_the_watering_can.minLevel ?? 0).toBeGreaterThanOrEqual(
      QUESTS.q_someone_your_own_size.minLevel ?? 0,
    );
  });
});
