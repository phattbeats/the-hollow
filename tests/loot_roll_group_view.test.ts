// Pure view-core for the group-visible loot-roll vote strip (PHAA-568, port of
// upstream #1599). Drives loot_roll_group_view.ts against fixture
// LootRollGroupStatus values (the shape both Sim and ClientWorld return from
// IWorld.lootRollGroupStatus()) and pins the choice -> localized-label mapping,
// the pending sentinel, viewerIsCandidate, and the localized aria label. No DOM,
// no Rng, no time: same input maps to same output.

import { describe, expect, it } from 'vitest';
import type { LootRollGroupStatus } from '../src/sim/types';
import { lootRollGroupRollView, lootRollGroupView } from '../src/ui/loot_roll_group_view';
import type { IWorld } from '../src/world_api';

function status(over: Partial<LootRollGroupStatus> = {}): LootRollGroupStatus {
  return {
    rollId: 1,
    itemId: 'greyjaw_hide_boots',
    itemName: 'Greyjaw Hide Boots',
    quality: 'uncommon',
    expiresAt: 100,
    entries: [
      { pid: 10, name: 'Aaa', choice: 'need' },
      { pid: 20, name: 'Bbb', choice: null },
      { pid: 30, name: 'Ccc', choice: 'pass' },
    ],
    ...over,
  };
}

describe('loot_roll_group_view: choice -> localized label mapping', () => {
  it('maps need/greed/pass to their catalog labels and null to the Waiting sentinel', () => {
    const view = lootRollGroupRollView(
      status({
        entries: [
          { pid: 1, name: 'A', choice: 'need' },
          { pid: 2, name: 'B', choice: 'greed' },
          { pid: 3, name: 'C', choice: 'pass' },
          { pid: 4, name: 'D', choice: null },
        ],
      }),
      1,
    );
    expect(view.entries.map((e) => e.choice)).toEqual(['need', 'greed', 'pass', 'pending']);
    expect(view.entries.map((e) => e.label)).toEqual(['Need', 'Greed', 'Pass', 'Waiting...']);
  });

  it('preserves pid, name, rollId, itemName, and quality verbatim', () => {
    const view = lootRollGroupRollView(status(), 99);
    expect(view.rollId).toBe(1);
    expect(view.itemName).toBe('Greyjaw Hide Boots');
    expect(view.quality).toBe('uncommon');
    expect(view.entries.map((e) => ({ pid: e.pid, name: e.name }))).toEqual([
      { pid: 10, name: 'Aaa' },
      { pid: 20, name: 'Bbb' },
      { pid: 30, name: 'Ccc' },
    ]);
  });

  it('sets viewerIsCandidate only when the viewer pid is among the entries', () => {
    expect(lootRollGroupRollView(status(), 20).viewerIsCandidate).toBe(true);
    expect(lootRollGroupRollView(status(), 999).viewerIsCandidate).toBe(false);
  });

  it('builds a localized aria label carrying the item name', () => {
    expect(lootRollGroupRollView(status(), 1).ariaLabel).toBe(
      'Group roll status for Greyjaw Hide Boots',
    );
  });

  it('is a pure derivation: same input maps to a value-identical view', () => {
    expect(lootRollGroupRollView(status(), 10)).toEqual(lootRollGroupRollView(status(), 10));
  });
});

describe('loot_roll_group_view: world iteration', () => {
  it('emits one view roll per open status in the server-stable order', () => {
    const rolls: LootRollGroupStatus[] = [
      status({ rollId: 5, itemName: 'Boots' }),
      status({ rollId: 6, itemName: 'Cloak' }),
    ];
    const world = { lootRollGroupStatus: () => rolls } as unknown as IWorld;
    const view = lootRollGroupView(world, 10);
    expect(view.rolls.map((r) => r.rollId)).toEqual([5, 6]);
    expect(view.rolls.map((r) => r.itemName)).toEqual(['Boots', 'Cloak']);
  });

  it('returns an empty roll list when nothing is open', () => {
    const world = { lootRollGroupStatus: () => [] } as unknown as IWorld;
    expect(lootRollGroupView(world, 10).rolls).toEqual([]);
  });
});
