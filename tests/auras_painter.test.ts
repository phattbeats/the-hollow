// P12b keyed-pool aura painter: the no-raw-write + no-magic source guards (decisions
// 5a / 12), and an end-to-end pool proof over a tiny fake DOM (no jsdom): the tooltip
// attaches ONCE per pooled node (no duplicate listeners across frames), a recycled node
// reads the NEW aura's LIVE data (the mutable-record rule, Top risk 3), a steady-state
// frame moves no node, and every write routes through the elided writers.

import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AurasPainter, type AurasPainterDeps } from '../src/ui/auras_painter';
import type { AuraSlotState, AurasState } from '../src/ui/auras_view';
import type { PainterHostWriters } from '../src/ui/painter_host';

// ---------------------------------------------------------------------------
// Source guards
// ---------------------------------------------------------------------------

describe('AurasPainter: no raw DOM writes, no magic values (decisions 5a / 12)', () => {
  const src = readFileSync(new URL('../src/ui/auras_painter.ts', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('makes no raw style / textContent / classList / setAttribute / setProperty / innerHTML write', () => {
    // createNode legitimately sets .className once on the pooled node (the structural
    // base class) + appendChild for its children; everything per-frame routes through
    // the facet. So .className may appear once (the base), but no per-frame raw writers.
    expect(code).not.toMatch(/\.style\b/);
    expect(code).not.toMatch(/\.textContent\b/);
    expect(code).not.toMatch(/\.classList\b/);
    expect(code).not.toMatch(/\.setAttribute\b/);
    expect(code).not.toMatch(/\.setProperty\b/);
    expect(code).not.toMatch(/\.innerHTML\b/);
    // No listener churn in the hot painter: the tooltip attaches once in createNode via
    // the injected helper, never addEventListener directly + never per frame.
    expect(code).not.toMatch(/addEventListener/);
  });

  it('carries no literal hex / rgb / px value', () => {
    expect(code.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(code.match(/\brgba?\s*\(/g) ?? []).toEqual([]);
    expect(code.match(/\b\d+px\b/g) ?? []).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// A tiny fake DOM (node env) + a recording facet drive the real painter.
// ---------------------------------------------------------------------------

interface FakeEl {
  tagName: string;
  parentNode: FakeEl | null;
  childNodes: FakeEl[];
  firstChild: FakeEl | null;
  nextSibling: FakeEl | null;
  _mutations: number;
  [k: string]: unknown;
  appendChild(kid: FakeEl): FakeEl;
  insertBefore(node: FakeEl, ref: FakeEl | null): FakeEl;
  _detach(kid: FakeEl): void;
  remove(): void;
}

function fakeEl(tag: string): FakeEl {
  const el = {
    tagName: tag.toUpperCase(),
    parentNode: null as FakeEl | null,
    childNodes: [] as FakeEl[],
    _mutations: 0,
    appendChild(kid: FakeEl) {
      kid.parentNode?._detach(kid);
      kid.parentNode = el;
      el.childNodes.push(kid);
      el._mutations++;
      return kid;
    },
    insertBefore(node: FakeEl, ref: FakeEl | null) {
      node.parentNode?._detach(node);
      node.parentNode = el;
      const i = ref ? el.childNodes.indexOf(ref) : -1;
      if (i < 0) el.childNodes.push(node);
      else el.childNodes.splice(i, 0, node);
      el._mutations++;
      return node;
    },
    get firstChild() {
      return el.childNodes[0] ?? null;
    },
    get nextSibling() {
      const p = el.parentNode;
      if (!p) return null;
      const i = p.childNodes.indexOf(el);
      return p.childNodes[i + 1] ?? null;
    },
    _detach(kid: FakeEl) {
      const i = el.childNodes.indexOf(kid);
      if (i >= 0) el.childNodes.splice(i, 1);
    },
    remove() {
      el.parentNode?._detach(el);
      el.parentNode = null;
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
    setAttr: (el, name, value) => calls.push({ m: 'setAttr', el, args: [name, value] }),
  };
  return { calls, writers };
}

// A recording attachTooltip: stores the (el, htmlFn) so a test can invoke the closure
// and prove it reads the LIVE pooled record.
function recordingTooltips() {
  const attached: Array<{ el: unknown; html: () => string }> = [];
  const attachTooltip = (el: HTMLElement, html: () => string) => {
    attached.push({ el, html });
  };
  return { attached, attachTooltip };
}

// A typed icon-URL spy (a bare `vi.fn()` widens to a non-callable Mock under tsc).
function makeIconUrl() {
  return vi.fn((key: string) => `url(${key})`);
}

function slot(over: Partial<AuraSlotState> & { key: string }): AuraSlotState {
  return {
    iconKey: over.key,
    isDebuff: false,
    durationText: '',
    stacksText: '',
    name: over.key,
    remaining: 0,
    ...over,
  };
}

function state(slots: AuraSlotState[]): AurasState {
  return { slots, count: slots.length };
}

describe('AurasPainter: keyed pool over the elided writers', () => {
  let container: FakeEl;
  let calls: Call[];
  let tooltips: ReturnType<typeof recordingTooltips>;
  let iconUrl: ReturnType<typeof makeIconUrl>;
  let painter: AurasPainter;

  beforeEach(() => {
    container = fakeEl('div');
    const facet = recordingFacet();
    calls = facet.calls;
    tooltips = recordingTooltips();
    iconUrl = makeIconUrl();
    const deps: AurasPainterDeps = {
      resolveIconUrl: (key) => iconUrl(key),
      renderTooltip: (name, remaining) => `${name}|${Math.ceil(remaining)}`,
      attachTooltip: tooltips.attachTooltip,
    };
    painter = new AurasPainter(facet.writers, container as unknown as HTMLElement, deps, fakeDoc);
  });

  const nodes = () => container.childNodes;

  it('builds one .buff node per aura with .dur + .stacks children', () => {
    painter.paint(state([slot({ key: 'a' }), slot({ key: 'b' })]));
    expect(nodes()).toHaveLength(2);
    // each pooled node has the two children (dur, stacks) appended once.
    expect(nodes()[0].childNodes).toHaveLength(2);
    expect(nodes()[0].className).toBe('buff');
  });

  it('attaches the tooltip ONCE per pooled node across frames (no duplicate listeners)', () => {
    painter.paint(state([slot({ key: 'a', name: 'Might', remaining: 8 })]));
    expect(tooltips.attached).toHaveLength(1);
    const nodeA = nodes()[0];
    // Re-paint the SAME aura (a stat changed): the node is reused, not rebuilt, and the
    // tooltip is NOT re-attached.
    painter.paint(state([slot({ key: 'a', name: 'Might', remaining: 7 })]));
    expect(nodes()[0]).toBe(nodeA);
    expect(tooltips.attached).toHaveLength(1);
  });

  it('STALE-CAPTURE regression: a recycled node reads the NEW aura, not the old one', () => {
    // Aura A appears.
    painter.paint(state([slot({ key: 'A', name: 'Aura A', remaining: 5 })]));
    const nodeA = nodes()[0];
    const tipA = tooltips.attached[0];
    expect(tipA.html()).toBe('Aura A|5');
    // Aura A leaves: its node detaches to the free list.
    painter.paint(state([]));
    expect(nodes()).toHaveLength(0);
    // Aura B appears and RECYCLES A's freed node.
    painter.paint(state([slot({ key: 'B', name: 'Aura B', remaining: 9 })]));
    const nodeB = nodes()[0];
    expect(nodeB).toBe(nodeA); // same node recycled
    expect(tooltips.attached).toHaveLength(1); // tooltip NOT re-attached
    // The ORIGINAL closure now renders B's LIVE data (the mutable-record rule); a
    // capture-by-value would still say 'Aura A|5'.
    expect(tipA.html()).toBe('Aura B|9');
  });

  it('resolves the icon URL only when an aura icon key changes (the expensive write)', () => {
    painter.paint(state([slot({ key: 'a', iconKey: 'icon_x' })]));
    expect(iconUrl).toHaveBeenCalledTimes(1);
    // Same icon key next frame: no re-resolve.
    painter.paint(state([slot({ key: 'a', iconKey: 'icon_x' })]));
    expect(iconUrl).toHaveBeenCalledTimes(1);
    // The aura swaps to a new icon: one more resolve.
    painter.paint(state([slot({ key: 'a', iconKey: 'icon_y' })]));
    expect(iconUrl).toHaveBeenCalledTimes(2);
  });

  it('a steady-state frame (same auras) moves no node, so the pool causes no DOM churn', () => {
    painter.paint(state([slot({ key: 'a' }), slot({ key: 'b' })]));
    const movesBefore = container._mutations;
    painter.paint(state([slot({ key: 'a', remaining: 3 }), slot({ key: 'b', remaining: 2 })]));
    expect(container._mutations).toBe(movesBefore); // zero DOM moves in the hot path
    expect(nodes()).toHaveLength(2);
  });

  it('reconciles DOM order on reorder, reusing the SAME nodes', () => {
    painter.paint(state([slot({ key: 'a' }), slot({ key: 'b' }), slot({ key: 'c' })]));
    const [a, b, c] = nodes();
    painter.paint(state([slot({ key: 'c' }), slot({ key: 'a' }), slot({ key: 'b' })]));
    const reordered = nodes();
    expect(reordered).toHaveLength(3);
    expect(reordered[0]).toBe(c);
    expect(reordered[1]).toBe(a);
    expect(reordered[2]).toBe(b);
  });

  it('routes EVERY per-frame write through the elided writers', () => {
    painter.paint(
      state([
        slot({ key: 'a', iconKey: 'ic', isDebuff: true, durationText: '5s', stacksText: '3' }),
      ]),
    );
    const has = (m: Call['m'], pred: (c: Call) => boolean) =>
      calls.some((c) => c.m === m && pred(c));
    // icon via setStyleProp(background-image), not a raw style write.
    expect(
      has('setStyleProp', (c) => c.args[0] === 'background-image' && c.args[1] === 'url(ic)'),
    ).toBe(true);
    // debuff via toggleClass (a structural class, not a color).
    expect(has('toggleClass', (c) => c.args[0] === 'debuff' && c.args[1] === true)).toBe(true);
    // duration + stacks via setText.
    expect(has('setText', (c) => c.args[0] === '5s')).toBe(true);
    expect(has('setText', (c) => c.args[0] === '3')).toBe(true);
    // stacks badge shown via setDisplay('').
    expect(has('setDisplay', (c) => c.args[0] === '')).toBe(true);
  });

  it('hides the stacks badge (setDisplay none) when the aura does not stack', () => {
    painter.paint(state([slot({ key: 'a', stacksText: '' })]));
    expect(calls.some((c) => c.m === 'setDisplay' && c.args[0] === 'none')).toBe(true);
  });
});
