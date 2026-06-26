// P12b keyed-pool aura painter: the no-raw-write + no-magic source guards (decisions
// 5a / 12), and an end-to-end pool proof over a tiny fake DOM (no jsdom): the tooltip
// attaches ONCE per pooled node (no duplicate listeners across frames), a recycled node
// reads the NEW aura's LIVE data (the mutable-record rule, Top risk 3), a steady-state
// frame moves no node, and every write routes through the elided writers.

import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UiEffectsTier } from '../src/game/ui_effects_profile';
import { AURA_VISIBLE_CAP_LOW } from '../src/game/ui_tier_knobs';
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
    // Everything per-frame routes through the facet; no raw single-slot writers.
    expect(code).not.toMatch(/\.style\b/);
    expect(code).not.toMatch(/\.textContent\b/);
    expect(code).not.toMatch(/\.classList\b/);
    expect(code).not.toMatch(/\.setAttribute\b/);
    expect(code).not.toMatch(/\.setProperty\b/);
    expect(code).not.toMatch(/\.innerHTML\b/);
    // No listener churn in the hot painter: the tooltip attaches once in createNode via
    // the injected helper, never addEventListener directly + never per frame.
    expect(code).not.toMatch(/addEventListener/);
    // .className is set EXACTLY 3 times, all in createNode (the pooled node + its .dur /
    // .stacks children, set once at build). Pinning the count gives the guard teeth: the
    // debuff state must flow through toggleClass, so any per-frame raw `rec.el.className =`
    // write (the shape the old inline code used) would push this above 3 and fail here.
    expect(code.match(/\.className\b/g) ?? []).toHaveLength(3);
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

  it('detaches only the departed node on a PARTIAL departure, keeping the rest in order', () => {
    // One of several auras leaves (a -> still here, b -> gone, c -> still here). The
    // detach sweep must remove exactly b (recycle it to the free list) and leave a + c
    // in place, then recycle b's freed node to a new aura d. This exercises deleting a
    // non-last map entry mid-iteration (the values()-iteration detach path).
    painter.paint(state([slot({ key: 'a' }), slot({ key: 'b' }), slot({ key: 'c' })]));
    const [a, b, c] = nodes();
    painter.paint(state([slot({ key: 'a' }), slot({ key: 'c' })]));
    expect(nodes()).toHaveLength(2);
    expect(nodes()[0]).toBe(a);
    expect(nodes()[1]).toBe(c);
    expect(b.parentNode).toBe(null); // b detached, not orphaned in the container
    // d recycles b's freed node (no new node allocated), proving the free list took it.
    painter.paint(state([slot({ key: 'a' }), slot({ key: 'c' }), slot({ key: 'd' })]));
    const after = nodes();
    expect(after).toHaveLength(3);
    expect(after[2]).toBe(b); // b's node reused for d
    expect(tooltips.attached).toHaveLength(3); // a, b, c built once; d reused b's node
  });

  it('renders two NODES for two auras sharing an id from different sources (no collapse)', () => {
    // The sim dedups auras by id+sourceId, so one entity can carry two auras with the
    // same ability id from different casters (e.g. two warlocks' Corruption on a boss,
    // or two healers' same shield on the player). The old renderAuras appended one .buff
    // per aura, so the pool must NOT collapse same-id auras onto one node (the wire also
    // zeroes sourceId, so disambiguation is by per-frame occurrence, not the composite).
    painter.paint(
      state([
        slot({ key: 'corruption', name: 'Corruption A', remaining: 6 }),
        slot({ key: 'corruption', name: 'Corruption B', remaining: 12 }),
      ]),
    );
    expect(nodes()).toHaveLength(2);
    expect(tooltips.attached).toHaveLength(2);
    // Each node's tooltip reads its OWN aura's live data (no collapse to the second).
    expect(tooltips.attached[0].html()).toBe('Corruption A|6');
    expect(tooltips.attached[1].html()).toBe('Corruption B|12');
    // Steady state: the same two auras next frame reuse the SAME two nodes, no churn.
    const [a, b] = nodes();
    const moves = container._mutations;
    painter.paint(
      state([
        slot({ key: 'corruption', name: 'Corruption A', remaining: 5 }),
        slot({ key: 'corruption', name: 'Corruption B', remaining: 11 }),
      ]),
    );
    expect(nodes()[0]).toBe(a);
    expect(nodes()[1]).toBe(b);
    expect(container._mutations).toBe(moves);
    // When one of the duplicates leaves, the survivor keeps a node and the other detaches.
    painter.paint(state([slot({ key: 'corruption', name: 'Corruption A', remaining: 4 })]));
    expect(nodes()).toHaveLength(1);
    expect(nodes()[0].childNodes).toHaveLength(2); // a real pooled node, not orphaned
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

// ---------------------------------------------------------------------------
// P14a Slice C: the visible-count cap is a pure function of the STATIC ui effects tier
// (data-fx-level), NEVER the governor, injected via getFxTier. Ultra renders every active
// aura (byte-equivalent to the untiered painter); low renders at most AURA_VISIBLE_CAP_LOW
// and recycles the overflow out of the pool, identically under a Sim- and a ClientWorld-
// shaped state. (The refresh/tick-granularity throttle is the Hud's call-site gate, tested
// in the tier-knobs cadence suite; the painter owns only the count cap.)
// ---------------------------------------------------------------------------

describe('AurasPainter: P14a static-preset visible-count cap (Slice C)', () => {
  let container: FakeEl;
  let tooltips: ReturnType<typeof recordingTooltips>;

  beforeEach(() => {
    container = fakeEl('div');
    tooltips = recordingTooltips();
  });

  function tierPainter(tier: UiEffectsTier): AurasPainter {
    const facet = recordingFacet();
    const deps: AurasPainterDeps = {
      resolveIconUrl: (key) => `url(${key})`,
      renderTooltip: (name, remaining) => `${name}|${Math.ceil(remaining)}`,
      attachTooltip: tooltips.attachTooltip,
    };
    return new AurasPainter(
      facet.writers,
      container as unknown as HTMLElement,
      deps,
      fakeDoc,
      () => tier,
    );
  }
  const nodes = () => container.childNodes;
  const manyAuras = (count: number) =>
    state(Array.from({ length: count }, (_, i) => slot({ key: `aura${i}` })));

  it('ultra renders every active aura (uncapped, byte-equivalent)', () => {
    const over = AURA_VISIBLE_CAP_LOW + 5;
    tierPainter('ultra').paint(manyAuras(over));
    expect(nodes()).toHaveLength(over);
  });

  it('low caps the rendered aura count at AURA_VISIBLE_CAP_LOW, dropping the overflow', () => {
    const over = AURA_VISIBLE_CAP_LOW + 5;
    const painter = tierPainter('low');
    painter.paint(manyAuras(over));
    expect(nodes()).toHaveLength(AURA_VISIBLE_CAP_LOW);
    // The first cap auras (display order) are the ones kept.
    expect(nodes().length).toBeLessThan(over);
  });

  it('low under the cap renders every aura (the cap only bites past the limit)', () => {
    const painter = tierPainter('low');
    painter.paint(manyAuras(AURA_VISIBLE_CAP_LOW - 2));
    expect(nodes()).toHaveLength(AURA_VISIBLE_CAP_LOW - 2);
  });

  it('decision 15: the low cap renders an identical count for a Sim- and ClientWorld-shaped state', () => {
    // The painter consumes AurasState (the parity-identical view output). Build the same
    // logical aura set two ways: a Sim-shaped slot carrying view-only extras and a lean
    // ClientWorld-mirror slot. The cap applies to the count, so both render the cap.
    const over = AURA_VISIBLE_CAP_LOW + 4;
    const simState = state(
      Array.from({ length: over }, (_, i) => slot({ key: `s${i}`, stacksText: '2', remaining: 9 })),
    );
    const clientState = state(Array.from({ length: over }, (_, i) => slot({ key: `s${i}` })));
    const simPainter = tierPainter('low');
    simPainter.paint(simState);
    const simCount = nodes().length;
    container = fakeEl('div'); // fresh container for the client run
    const clientPainter = tierPainter('low');
    clientPainter.paint(clientState);
    expect(nodes().length).toBe(simCount);
    expect(nodes().length).toBe(AURA_VISIBLE_CAP_LOW);
  });
});
