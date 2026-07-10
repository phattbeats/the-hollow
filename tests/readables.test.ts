import { describe, expect, it } from 'vitest';
import { READABLES } from '../src/sim/content/readables';
import { READABLES_BY_ID, ZONES } from '../src/sim/data';
import { readablePropsAt } from '../src/sim/readables_query';
import type { ReadableSupport } from '../src/sim/types';
import { npcIntroAdvance, npcIntroPageAt } from '../src/ui/npc_intro_view';

const ZONE_IDS = new Set(ZONES.map((z) => z.id));

describe('READABLES content', () => {
  it('has unique, non-empty ids placed in real overworld zones', () => {
    const ids = new Set<string>();
    for (const r of READABLES) {
      expect(r.id.length).toBeGreaterThan(0);
      expect(ids.has(r.id), `duplicate readable id ${r.id}`).toBe(false);
      ids.add(r.id);
      expect(ZONE_IDS.has(r.zoneId), `unknown zoneId ${r.zoneId}`).toBe(true);
      expect(Number.isFinite(r.facing)).toBe(true);
    }
  });

  it('declares a known loose-object prop kind (PHAA-552 follow-up)', () => {
    // The board rejected the "book on a pedestal" look: a readable must render as
    // a loose item (a single page or an open field notebook), so `prop` gates the
    // render in src/render/readables.ts and only these two kinds are drawn.
    for (const r of READABLES) {
      expect(['page', 'journal'], `readable ${r.id} has unknown prop ${r.prop}`).toContain(r.prop);
    }
    // A torn ledger page must be the loose sheet, not a bound book.
    expect(READABLES_BY_ID.torn_ledger_page.prop).toBe('page');
  });

  it('declares a known support kind when one is set (PHAA-552 variety follow-up)', () => {
    // The board asked for variety in what a readable rests on/against ("up
    // against a tree, or on a chest, or a table"); `support` gates the render in
    // src/render/readables.ts. It is optional (default 'stone'), but any value
    // present must be one the renderer draws, or the readable falls back silently.
    const KNOWN: ReadableSupport[] = ['stone', 'table', 'chest', 'tree'];
    for (const r of READABLES) {
      if (r.support !== undefined) {
        expect(KNOWN, `readable ${r.id} has unknown support ${r.support}`).toContain(r.support);
      }
    }
    // Live content exercises more than the original single rock, so the world
    // shows the variety even before new chest/tree placements land (those carry a
    // translation pass, see the note in content/readables.ts). The renderer's
    // coverage of all four supports is guarded by tests/readables_render.test.ts.
    const supports = new Set(READABLES.map((r) => r.support ?? 'stone'));
    expect(supports.size, 'live readables should exercise more than one support').toBeGreaterThan(
      1,
    );
  });

  it('carries a title and at least one non-empty page per book', () => {
    for (const r of READABLES) {
      expect(r.title.trim().length).toBeGreaterThan(0);
      expect(r.pages.length).toBeGreaterThan(0);
      for (const page of r.pages) expect(page.trim().length).toBeGreaterThan(0);
    }
  });

  it('is exposed by id through READABLES_BY_ID', () => {
    expect(Object.keys(READABLES_BY_ID).sort()).toEqual(READABLES.map((r) => r.id).sort());
  });
});

describe('readablePropsAt (shared Sim/ClientWorld resolver)', () => {
  it('returns the current overworld zone books, positioned in world space', () => {
    const inReaches = readablePropsAt(6, -262);
    const reachesIds = READABLES.filter((r) => r.zoneId === 'the_hollow_reaches').map((r) => r.id);
    expect(inReaches.map((p) => p.id).sort()).toEqual([...reachesIds].sort());
    const torn = inReaches.find((p) => p.id === 'torn_ledger_page');
    const def = READABLES_BY_ID.torn_ledger_page;
    expect(torn).toEqual({ id: def.id, x: def.pos.x, z: def.pos.z, facing: def.facing });
  });

  it('is empty in a different overworld zone', () => {
    expect(readablePropsAt(0, 0)).toEqual([]);
  });

  it('is empty inside an instance (dungeon x-band)', () => {
    expect(readablePropsAt(4500, -262)).toEqual([]);
  });
});

describe('readable pagination reuses the intro paginator', () => {
  it('pages forward through a multi-page book and stops at the end', () => {
    const total = READABLES_BY_ID.torn_ledger_page.pages.length;
    expect(total).toBeGreaterThan(1);
    expect(npcIntroPageAt(0, total)?.isFirst).toBe(true);
    expect(npcIntroPageAt(total - 1, total)?.isLast).toBe(true);
    expect(npcIntroAdvance(total - 1, total)).toBeNull();
    expect(npcIntroAdvance(0, total)).toBe(1);
  });
});
