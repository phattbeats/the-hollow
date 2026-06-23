// Regression for the "completed quests are offered again" report.
// No two quests should share an identical giver + objective signature. The
// actual bug was content, not logic: a duplicate kill task from the same NPC
// made a finished quest indistinguishable from a brand-new one to the player.
import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/sim/data';

describe('no quest duplicates another (same giver + identical objectives)', () => {
  it('every quest has a unique giver+objective signature', () => {
    const sig = (id: string): string => {
      const q = QUESTS[id];
      const obj = q.objectives
        .map((o) =>
          (o.type === 'kill' ? `kill ${o.targetMobId}`
            : o.type === 'collect' ? `collect ${o.itemId}`
              : `interact ${(o as any).targetNpcId}`) + ` x${o.count}`)
        .join(' + ');
      return `${q.giverNpcId} :: ${obj}`;
    };
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const id of Object.keys(QUESTS)) {
      const s = sig(id);
      const prev = seen.get(s);
      if (prev) collisions.push(`${prev} <-> ${id}  (${s})`);
      else seen.set(s, id);
    }
    expect(collisions).toEqual([]);
  });
});
