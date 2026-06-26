// P11c keyed-pool party painter: the routing + no-magic-values source guards
// (decisions 5a / 12), the live-slot handler contract (top-risk 3), and an
// end-to-end pool proof (no duplicate listeners across rebuilds, a recycled row
// reads the new member, every write routed through the elided writers). The pool is
// driven over a tiny fake DOM in the default `node` env (no jsdom); iconDataUrl is
// stubbed because the crest's procedural canvas path needs a real DOM.

import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PainterHostWriters } from '../src/ui/painter_host';
import { createPartyRow, type PartyRowSlot, partyRowHandlers } from '../src/ui/party_frame_row';
import type { PartyFrameMember } from '../src/ui/party_frames';
import { PartyFramesPainter } from '../src/ui/party_frames_painter';

vi.mock('../src/ui/icons', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/ui/icons')>()),
  // The crest icon's procedural path needs a canvas; the pool only needs a string.
  iconDataUrl: () => 'data:image/png;base64,stub',
}));

// ---------------------------------------------------------------------------
// Source guards
// ---------------------------------------------------------------------------

describe('PartyFramesPainter: no raw DOM writes, no magic values (decisions 5a / 12)', () => {
  const src = readFileSync(new URL('../src/ui/party_frames_painter.ts', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('makes no raw style / textContent / className / classList / setAttribute / setProperty / innerHTML write', () => {
    expect(code).not.toMatch(/\.style\b/);
    expect(code).not.toMatch(/\.textContent\b/);
    expect(code).not.toMatch(/\.className\b/);
    expect(code).not.toMatch(/\.classList\b/);
    expect(code).not.toMatch(/\.setAttribute\b/);
    expect(code).not.toMatch(/\.setProperty\b/);
    expect(code).not.toMatch(/\.innerHTML\b/);
    // No per-rebuild listener churn in the hot painter (listeners live in the builder).
    expect(code).not.toMatch(/addEventListener/);
  });

  it('carries no literal hex / rgb / px value (the class color is the --cls token)', () => {
    expect(code.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(code.match(/\brgba?\s*\(/g) ?? []).toEqual([]);
    expect(code.match(/\b\d+px\b/g) ?? []).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Live-slot handlers (top-risk 3): the closure reads the slot, not a captured member
// ---------------------------------------------------------------------------

describe('partyRowHandlers: the closures read the LIVE slot, never a captured member', () => {
  const mk = (pid: number, name: string): PartyFrameMember => ({
    pid,
    name,
    cls: 'mage',
    level: 10,
    hp: 1,
    mhp: 1,
    res: 0,
    mres: 0,
    rtype: 'mana',
    x: 0,
    z: 0,
    dead: 0,
    inCombat: 0,
    group: 1,
    oor: false,
  });

  it('a row recycled to a new member targets the NEW pid + name (not the stale one)', () => {
    const targets: number[] = [];
    const menus: Array<[number, string]> = [];
    const slot: PartyRowSlot = { member: mk(5, 'Alice') };
    const handlers = partyRowHandlers(slot, {
      onTarget: (pid) => targets.push(pid),
      onContextMenu: (pid, name) => menus.push([pid, name]),
    });

    handlers.click();
    expect(targets).toEqual([5]);

    // Recycle the slot to a different identity reusing pid 5 (entity-id reuse).
    slot.member = mk(5, 'Bob');
    handlers.click();
    expect(targets).toEqual([5, 5]);
    handlers.contextmenu({ clientX: 4, clientY: 9, preventDefault() {} } as unknown as MouseEvent);
    // The context menu reads the LIVE name (Bob), proving no capture-by-value.
    expect(menus).toEqual([[5, 'Bob']]);
  });

  it('Enter and Space activate; the keyboard contextmenu falls back to the row box', () => {
    const targets: number[] = [];
    const menus: Array<[number, number, number]> = [];
    const slot: PartyRowSlot = { member: mk(7, 'Cora') };
    const handlers = partyRowHandlers(slot, {
      onTarget: (pid) => targets.push(pid),
      onContextMenu: (pid, _name, x, y) => menus.push([pid, x, y]),
    });
    for (const key of ['Enter', ' ']) {
      handlers.keydown({ key, preventDefault() {} } as unknown as KeyboardEvent);
    }
    expect(targets).toEqual([7, 7]);
    // A keyboard contextmenu (0,0) falls back to the focused row's box (here 12,34).
    handlers.contextmenu({
      clientX: 0,
      clientY: 0,
      preventDefault() {},
      currentTarget: { getBoundingClientRect: () => ({ left: 12, bottom: 34 }) },
    } as unknown as MouseEvent);
    expect(menus).toEqual([[7, 12, 34]]);
  });
});

// ---------------------------------------------------------------------------
// End-to-end pool: a tiny fake DOM + a recording facet drive the real painter.
// ---------------------------------------------------------------------------

interface FakeEl {
  tagName: string;
  parentNode: FakeEl | null;
  childNodes: FakeEl[];
  listeners: Record<string, Array<(ev: unknown) => void>>;
  [k: string]: unknown;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
  addEventListener(type: string, fn: (ev: unknown) => void): void;
  append(...kids: FakeEl[]): void;
  appendChild(kid: FakeEl): FakeEl;
  _detach(kid: FakeEl): void;
  remove(): void;
  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number };
  fire(type: string, ev: unknown): void;
}

function fakeEl(tag: string): FakeEl {
  const el = {
    tagName: tag.toUpperCase(),
    parentNode: null as FakeEl | null,
    childNodes: [] as FakeEl[],
    listeners: {} as Record<string, Array<(ev: unknown) => void>>,
    setAttribute(k: string, v: string) {
      (el as Record<string, unknown>)[k] = v;
    },
    getAttribute(k: string) {
      return ((el as Record<string, unknown>)[k] as string) ?? null;
    },
    addEventListener(type: string, fn: (ev: unknown) => void) {
      el.listeners[type] ??= [];
      el.listeners[type].push(fn);
    },
    append(...kids: FakeEl[]) {
      for (const k of kids) el.appendChild(k);
    },
    appendChild(kid: FakeEl) {
      kid.parentNode?._detach(kid);
      kid.parentNode = el;
      el.childNodes.push(kid);
      return kid;
    },
    _detach(kid: FakeEl) {
      const i = el.childNodes.indexOf(kid);
      if (i >= 0) el.childNodes.splice(i, 1);
    },
    remove() {
      el.parentNode?._detach(el);
      el.parentNode = null;
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 }),
    fire(type: string, ev: unknown) {
      for (const fn of el.listeners[type] ?? []) fn(ev);
    },
  } as unknown as FakeEl;
  return el;
}

const fakeDoc = { createElement: (tag: string) => fakeEl(tag) } as unknown as Document;

type Call = { m: keyof PainterHostWriters; el: unknown; args: unknown[] };
function recordingFacet() {
  const calls: Call[] = [];
  const writers: PainterHostWriters = {
    setText: (el, text) => calls.push({ m: 'setText', el, args: [text] }),
    setDisplay: (el, display) => calls.push({ m: 'setDisplay', el, args: [display] }),
    setTransform: (el, transform) => calls.push({ m: 'setTransform', el, args: [transform] }),
    setWidth: (el, width) => calls.push({ m: 'setWidth', el, args: [width] }),
    setStyleProp: (el, prop, value) => calls.push({ m: 'setStyleProp', el, args: [prop, value] }),
    toggleClass: (el, cls, on) => calls.push({ m: 'toggleClass', el, args: [cls, on] }),
  };
  return { calls, writers };
}

const member = (over: Partial<PartyFrameMember> & { pid: number }): PartyFrameMember => ({
  name: `P${over.pid}`,
  cls: 'priest',
  level: 20,
  hp: 50,
  mhp: 100,
  res: 30,
  mres: 100,
  rtype: 'mana',
  x: 0,
  z: 0,
  dead: 0,
  inCombat: 0,
  group: 1,
  oor: false,
  ...over,
});

describe('createPartyRow: decorative badges + relocalize hook (a11y + live language switch)', () => {
  const build = () =>
    createPartyRow(
      fakeDoc,
      recordingFacet().writers,
      { onTarget() {}, onContextMenu() {} },
      member({ pid: 1 }),
    );

  it('marks the dead/combat/oor badges aria-hidden so their glyphs do not pollute the row button name', () => {
    const row = build();
    expect(row.badges.dead.getAttribute('aria-hidden')).toBe('true');
    expect(row.badges.combat.getAttribute('aria-hidden')).toBe('true');
    expect(row.badges.oor.getAttribute('aria-hidden')).toBe('true');
  });

  it('relocalize() re-sets every badge tooltip (the pool reuses row DOM, so a switch needs it)', () => {
    const row = build();
    // Localized once at build.
    expect(row.badges.dead.title).toBeTruthy();
    expect(row.badges.oor.title).toBeTruthy();
    // Stale the titles, then prove relocalize re-applies them (the language-switch path).
    row.badges.dead.title = '';
    row.badges.oor.title = '';
    row.relocalize();
    expect(row.badges.dead.title).toBeTruthy();
    expect(row.badges.oor.title).toBeTruthy();
  });
});

describe('PartyFramesPainter: keyed pool over the elided writers', () => {
  let container: FakeEl;
  let calls: Call[];
  let painter: PartyFramesPainter;
  let targeted: number[];
  let leftParty: number;

  beforeEach(() => {
    container = fakeEl('div');
    const facet = recordingFacet();
    calls = facet.calls;
    targeted = [];
    leftParty = 0;
    painter = new PartyFramesPainter(
      facet.writers,
      container as unknown as HTMLElement,
      {
        classCss: () => 'var(--cls)',
        onTarget: (pid) => targeted.push(pid),
        onContextMenu: () => {},
        onLeave: () => {
          leftParty++;
        },
        leaveLabel: () => 'Leave Party',
      },
      fakeDoc,
    );
  });

  const rows = () => container.childNodes.filter((c) => c.tagName === 'DIV');

  it('attaches click/contextmenu/keydown ONCE per pooled row across rebuilds (no dup listeners)', () => {
    painter.sync([member({ pid: 2, name: 'Alice' })], 1);
    const rowA = rows()[0];
    expect(rowA.listeners.click).toHaveLength(1);
    expect(rowA.listeners.contextmenu).toHaveLength(1);
    expect(rowA.listeners.keydown).toHaveLength(1);

    // Re-sync the SAME member (a stat changed): the row is reused, not rebuilt.
    painter.sync([member({ pid: 2, name: 'Alice', hp: 10 })], 1);
    expect(rows()[0]).toBe(rowA);
    expect(rowA.listeners.click).toHaveLength(1);

    rowA.fire('click', {});
    expect(targeted).toEqual([2]);
  });

  it('recycles a departed row to a new pid and the recycled listener reads the NEW member', () => {
    painter.sync([member({ pid: 2, name: 'Alice' })], 1);
    const rowA = rows()[0];
    // Alice leaves: the row detaches to the free list (listeners intact).
    painter.sync([], 1);
    expect(rows()).toHaveLength(0);
    // A new member (pid 9) reuses the freed row node.
    painter.sync([member({ pid: 9, name: 'Bob' })], 1);
    const rowB = rows()[0];
    expect(rowB).toBe(rowA); // same node recycled
    expect(rowB.listeners.click).toHaveLength(1); // NOT re-attached
    rowB.fire('click', {});
    expect(targeted).toEqual([9]); // the live slot, not the stale Alice (pid 2)
  });

  it('orders rows in member order with the leave button last', () => {
    painter.sync([member({ pid: 2 }), member({ pid: 3 }), member({ pid: 4 })], 1);
    const kids = container.childNodes;
    expect(kids.filter((c) => c.tagName === 'DIV')).toHaveLength(3);
    expect(kids[kids.length - 1].tagName).toBe('BUTTON'); // leave button last
  });

  it('clear() empties the container (no-party transition)', () => {
    painter.sync([member({ pid: 2 })], 1);
    expect(container.childNodes.length).toBeGreaterThan(0);
    painter.clear();
    expect(container.childNodes).toHaveLength(0);
  });

  it('routes EVERY write through the elided writers (--cls token, combat / state classes, badges, leave label)', () => {
    painter.setBelowTarget(true);
    painter.sync(
      [
        member({ pid: 2, name: 'Alice', dead: 0, inCombat: 1, hp: 50, mhp: 100, oor: false }),
        member({ pid: 3, name: 'Bob', dead: 1, oor: false }),
        member({ pid: 4, name: 'Cora', dead: 0, inCombat: 0, oor: true }),
      ],
      2, // leader = pid 2 (Alice)
    );
    const has = (m: Call['m'], pred: (c: Call) => boolean) =>
      calls.some((c) => c.m === m && pred(c));

    // --cls custom property via setStyleProp (decision 5a), not a raw style write.
    expect(has('setStyleProp', (c) => c.args[0] === '--cls')).toBe(true);
    // below-target on the container via toggleClass.
    expect(has('toggleClass', (c) => c.args[0] === 'below-target' && c.args[1] === true)).toBe(
      true,
    );
    // combat (party-only), dead + oor (family state classes) all via toggleClass.
    expect(has('toggleClass', (c) => c.args[0] === 'combat' && c.args[1] === true)).toBe(true);
    expect(has('toggleClass', (c) => c.args[0] === 'dead' && c.args[1] === true)).toBe(true);
    expect(has('toggleClass', (c) => c.args[0] === 'oor' && c.args[1] === true)).toBe(true);
    // A combat member is NOT also dead (dead wins), so its combat is on but dead off.
    // The hp bar keeps the inline .toFixed(3) precision via formatScaleX.
    expect(has('setTransform', (c) => /^scaleX\(\d\.\d{3}\)$/.test(String(c.args[0])))).toBe(true);
    // The leader's level chip carries the star glyph; names go through setText.
    expect(has('setText', (c) => c.args[0] === '★' + '20')).toBe(true);
    expect(has('setText', (c) => c.args[0] === 'Alice')).toBe(true);
    // The leave label is set (and re-localizable) through setText.
    expect(has('setText', (c) => c.args[0] === 'Leave Party')).toBe(true);
    // Badges toggle via setDisplay (the forced-colors-safe icon cue): dead/combat/oor
    // each show at least once across the three members.
    expect(has('setDisplay', (c) => c.args[0] === '')).toBe(true);
    expect(has('setDisplay', (c) => c.args[0] === 'none')).toBe(true);
  });

  it('relocalize() re-localizes the leave label in place (the live language-switch hook)', () => {
    painter.sync([member({ pid: 2 })], 1);
    calls.length = 0;
    painter.relocalize();
    expect(calls.some((c) => c.m === 'setText' && c.args[0] === 'Leave Party')).toBe(true);
  });

  it('the leave button click leaves the party', () => {
    painter.sync([member({ pid: 2 })], 1);
    const leave = container.childNodes.find((c) => c.tagName === 'BUTTON');
    leave?.fire('click', {});
    expect(leftParty).toBe(1);
  });
});
