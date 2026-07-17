// Pure-core unit tests for dungeon_finder_view.ts (PHAA-736). Same-input-same-output
// against a DungeonFinderInfo shape, which is identical whether it arrived via the
// offline Sim getter or the online ClientWorld snapshot mirror (see world_api.ts).

import { describe, expect, it } from 'vitest';
import { buildDungeonFinderView } from '../src/ui/dungeon_finder_view';

describe('buildDungeonFinderView', () => {
  it('is offline when info is null (not-yet-synced ClientWorld, or spectator)', () => {
    expect(buildDungeonFinderView({ info: null, playerClass: 'warrior' })).toEqual({
      kind: 'offline',
    });
  });

  it('idle: lists all three roles, flagging which the class can fill', () => {
    const view = buildDungeonFinderView({
      info: { queued: false, role: null, dungeonId: null, position: 0 },
      playerClass: 'mage',
    });
    expect(view.kind).toBe('idle');
    if (view.kind !== 'idle') throw new Error('unreachable');
    expect(view.roles).toEqual([
      { role: 'tank', available: false },
      { role: 'healer', available: false },
      { role: 'dps', available: true },
    ]);
    expect(view.dungeonId).toBe('hollow_crypt');
  });

  it('idle: a hybrid class shows every role it can fill as available', () => {
    const view = buildDungeonFinderView({
      info: { queued: false, role: null, dungeonId: null, position: 0 },
      playerClass: 'paladin',
    });
    expect(view.kind).toBe('idle');
    if (view.kind !== 'idle') throw new Error('unreachable');
    expect(view.roles.every((r) => r.available)).toBe(true);
  });

  it('queued: surfaces the role/dungeon/position from the snapshot', () => {
    const view = buildDungeonFinderView({
      info: { queued: true, role: 'healer', dungeonId: 'hollow_crypt', position: 3 },
      playerClass: 'priest',
    });
    expect(view).toMatchObject({
      kind: 'queued',
      role: 'healer',
      dungeonId: 'hollow_crypt',
      position: 3,
    });
  });

  it('the render-skip signature changes when the queue position changes', () => {
    const a = buildDungeonFinderView({
      info: { queued: true, role: 'dps', dungeonId: 'hollow_crypt', position: 2 },
      playerClass: 'mage',
    });
    const b = buildDungeonFinderView({
      info: { queued: true, role: 'dps', dungeonId: 'hollow_crypt', position: 1 },
      playerClass: 'mage',
    });
    expect(a.kind).toBe('queued');
    expect(b.kind).toBe('queued');
    if (a.kind !== 'queued' || b.kind !== 'queued') throw new Error('unreachable');
    expect(a.sig).not.toBe(b.sig);
  });
});
