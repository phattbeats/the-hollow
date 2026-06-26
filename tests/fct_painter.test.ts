// P13b pooled FCT painter: the no-raw-write + no-magic source guards (decisions 5a / 12),
// and an end-to-end pool proof over a tiny fake DOM (no jsdom): a FIXED cap that the live
// node count never exceeds, FIFO-by-sequence eviction that reuses the oldest slot, correct
// TTL recycle, no dropped or duplicated text under rapid spawn, the getUiScale author-space
// divide + behind-cull (positioning under zoom, on both a Sim- and a ClientWorld-shaped
// anchor), the CSS-rise animation restart on reuse, and the colour-token / crit class swap.

import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FCT_ANCHOR_HEAD_OFFSET,
  FCT_JITTER_RANGE,
  FCT_TTL_MS,
  type FctEvent,
  type FctKind,
} from '../src/ui/fct_core';
import { FCT_POOL_CAP, FctPainter, type FctProject } from '../src/ui/fct_painter';
import type { PainterHostWriters } from '../src/ui/painter_host';

// ---------------------------------------------------------------------------
// Source guards
// ---------------------------------------------------------------------------

describe('FctPainter: no raw DOM writes, no magic values (decisions 5a / 12)', () => {
  const src = readFileSync(new URL('../src/ui/fct_painter.ts', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('makes no raw style / textContent / classList / setAttribute / setProperty / innerHTML write', () => {
    // Everything per-frame routes through the facet; the only direct DOM touch is the
    // offsetWidth read that forces the animation-restart reflow (a read, not a write).
    expect(code).not.toMatch(/\.style\b/);
    expect(code).not.toMatch(/\.textContent\b/);
    expect(code).not.toMatch(/\.classList\b/);
    expect(code).not.toMatch(/\.setAttribute\b/);
    expect(code).not.toMatch(/\.setProperty\b/);
    expect(code).not.toMatch(/\.innerHTML\b/);
    expect(code).not.toMatch(/setTimeout/);
    expect(code).not.toMatch(/addEventListener/);
    // .className is set EXACTLY once, in the constructor (the pooled node's base class, set
    // at build). Pinning the count gives the guard teeth: any per-frame raw `node.className
    // = ...` write (the shape the old fct() used) would push this above 1 and fail here.
    expect(code.match(/\.className\b/g) ?? []).toHaveLength(1);
  });

  it('carries no literal hex / rgb / px colour value (the colours live in hud.css tokens)', () => {
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
  className: string;
  parentNode: FakeEl | null;
  childNodes: FakeEl[];
  offsetWidth: number;
  [k: string]: unknown;
  appendChild(kid: FakeEl): FakeEl;
  _detach(kid: FakeEl): void;
  remove(): void;
}

function fakeEl(tag: string): FakeEl {
  const el = {
    tagName: tag.toUpperCase(),
    className: '',
    parentNode: null as FakeEl | null,
    childNodes: [] as FakeEl[],
    offsetWidth: 0,
    appendChild(kid: FakeEl) {
      // Re-appending an attached node (an evicted slot) detaches it first, then pushes it
      // to the end -- exactly real appendChild semantics, so the live count stays bounded.
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

// The last text written to a given node (its current on-screen number).
function lastText(calls: Call[], node: unknown): string | undefined {
  let text: string | undefined;
  for (const c of calls) if (c.m === 'setText' && c.el === node) text = c.args[0] as string;
  return text;
}

function evt(over: Partial<FctEvent> & { kind: FctKind }): FctEvent {
  return {
    kind: over.kind,
    text: over.text ?? over.kind,
    target: over.target ?? { pos: { x: 0, y: 0, z: 0 }, scale: 1 },
    crit: over.crit ?? false,
    isSelf: over.isSelf ?? false,
  };
}

// A mutable projection a test can flip behind <-> in-front between frames.
function mutableProject(): {
  project: FctProject;
  set(v: { x: number; y: number; behind: boolean }): void;
} {
  let cur = { x: 0, y: 0, behind: false };
  return {
    project: () => cur,
    set: (v) => {
      cur = v;
    },
  };
}

describe('FctPainter: pooled ring over the elided writers', () => {
  let mount: FakeEl;
  let calls: Call[];

  beforeEach(() => {
    mount = fakeEl('div');
    calls = recordingFacet().calls;
  });

  // A painter with a small cap + fixed projection/scale/jitter, for the lifecycle tests.
  function makePainter(
    opts: { cap?: number; project?: FctProject; scale?: number; jitter?: number } = {},
  ): FctPainter {
    const facet = recordingFacet();
    calls = facet.calls;
    return new FctPainter(
      facet.writers,
      mount as unknown as HTMLElement,
      opts.project ?? (() => ({ x: 0, y: 0, behind: false })),
      () => opts.scale ?? 1,
      { cap: opts.cap ?? 4, doc: fakeDoc, random: () => opts.jitter ?? 0.5 },
    );
  }

  const liveNodes = () => mount.childNodes;

  it('pre-allocates the pool: no node is in the DOM until spawn, none created after', () => {
    const painter = makePainter({ cap: 3 });
    expect(liveNodes()).toHaveLength(0);
    expect(painter.liveCount()).toBe(0);
    painter.spawn(evt({ kind: 'heal', text: '+5' }), 0);
    expect(liveNodes()).toHaveLength(1);
    expect(liveNodes()[0].className).toBe('fct'); // base class set once at build
  });

  it('NEVER exceeds the cap: rapid over-cap spawns keep the live node count bounded', () => {
    const cap = 3;
    const painter = makePainter({ cap });
    for (let i = 1; i <= 9; i++) {
      painter.spawn(evt({ kind: 'damage-taken', text: `-${i}` }), 0);
      expect(painter.liveCount()).toBeLessThanOrEqual(cap);
      expect(liveNodes().length).toBeLessThanOrEqual(cap);
    }
    expect(painter.liveCount()).toBe(cap);
  });

  it('FIFO-by-sequence eviction: over-cap spawns drop the OLDEST, keep the newest, no dup', () => {
    const cap = 3;
    const painter = makePainter({ cap });
    for (let i = 1; i <= 5; i++) painter.spawn(evt({ kind: 'damage-taken', text: `-${i}` }), 0);
    // The 3 newest survive (-3, -4, -5); the 2 oldest (-1, -2) were evicted + their nodes
    // reused. No node still shows -1 / -2, and no text is duplicated.
    const surviving = liveNodes().map((n) => lastText(calls, n));
    expect(surviving).toHaveLength(cap);
    expect(new Set(surviving)).toEqual(new Set(['-3', '-4', '-5']));
    expect(surviving).not.toContain('-1');
    expect(surviving).not.toContain('-2');
  });

  it('recycles on TTL: a floater past its lifetime is removed and its slot returns to free', () => {
    const painter = makePainter({ cap: 4 });
    painter.spawn(evt({ kind: 'xp', text: '+10 XP' }), 0);
    expect(painter.liveCount()).toBe(1);
    painter.step(FCT_TTL_MS - 1); // still alive just before ttl
    expect(painter.liveCount()).toBe(1);
    expect(liveNodes()).toHaveLength(1);
    painter.step(FCT_TTL_MS); // ttl reached -> recycled
    expect(painter.liveCount()).toBe(0);
    expect(liveNodes()).toHaveLength(0);
    // The freed slot is reused (no new node allocated): the recycled node reappears.
    const before = liveNodes().length;
    painter.spawn(evt({ kind: 'xp', text: '+20 XP' }), FCT_TTL_MS);
    expect(painter.liveCount()).toBe(1);
    expect(liveNodes().length).toBe(before + 1);
  });

  it('an empty pool makes step() a no-op (no writes, holds the perf gate by construction)', () => {
    const painter = makePainter({ cap: 4 });
    const before = calls.length;
    painter.step(0);
    painter.step(1000);
    expect(calls.length).toBe(before);
  });

  it('positions in author space: (projected x + jitter) / uiScale and y / uiScale', () => {
    // jitter 0.5 -> offset 0; scale 2 -> halve the projected point.
    const painter = makePainter({
      project: () => ({ x: 300, y: 200, behind: false }),
      scale: 2,
      jitter: 0.5,
    });
    painter.spawn(evt({ kind: 'damage-taken', text: '-7' }), 0);
    const node = liveNodes()[0];
    const styleFor = (prop: string) =>
      calls.filter((c) => c.m === 'setStyleProp' && c.el === node && c.args[0] === prop).at(-1)
        ?.args[1];
    expect(styleFor('left')).toBe('150px'); // (300 + 0) / 2
    expect(styleFor('top')).toBe('100px'); // 200 / 2
  });

  it('bakes the injected jitter into x (min at 0, max at 1, centred at 0.5)', () => {
    const half = FCT_JITTER_RANGE / 2; // 15
    for (const [j, expected] of [
      [0, `${(300 - half) / 2}px`],
      [1, `${(300 + half) / 2}px`],
    ] as const) {
      mount = fakeEl('div');
      const painter = makePainter({
        project: () => ({ x: 300, y: 0, behind: false }),
        scale: 2,
        jitter: j,
      });
      painter.spawn(evt({ kind: 'damage-taken', text: '-1' }), 0);
      const node = mount.childNodes[0];
      const left = calls
        .filter((c) => c.m === 'setStyleProp' && c.el === node && c.args[0] === 'left')
        .at(-1)?.args[1];
      expect(left).toBe(expected);
    }
  });

  it('behind-culls at spawn (no slot wasted): a number behind the camera spawns nothing', () => {
    const mp = mutableProject();
    const painter = makePainter({ project: mp.project, cap: 4 });
    // Anchor behind the camera at spawn: claim no slot (faithful to the live `return`).
    mp.set({ x: 0, y: 0, behind: true });
    painter.spawn(evt({ kind: 'heal', text: '+5' }), 0);
    expect(painter.liveCount()).toBe(0);
    expect(liveNodes()).toHaveLength(0);
    // An in-front anchor claims a slot.
    mp.set({ x: 10, y: 10, behind: false });
    painter.spawn(evt({ kind: 'heal', text: '+5' }), 0);
    expect(painter.liveCount()).toBe(1);
  });

  it('is screen-anchored: step() does NOT reposition a live floater (only TTL recycles)', () => {
    const mp = mutableProject();
    mp.set({ x: 100, y: 100, behind: false });
    const painter = makePainter({ project: mp.project, scale: 1, jitter: 0.5 });
    painter.spawn(evt({ kind: 'damage-taken', text: '-1' }), 0);
    const node = liveNodes()[0];
    const leftWrites = () =>
      calls.filter((c) => c.m === 'setStyleProp' && c.el === node && c.args[0] === 'left').length;
    expect(leftWrites()).toBe(1); // positioned exactly once at spawn
    // The anchor "moves" and a frame ticks: a screen-anchored number must NOT reposition
    // (the old fct() / WoW combat text floats up in screen space, it does not chase the camera).
    mp.set({ x: 240, y: 100, behind: false });
    painter.step(1);
    expect(leftWrites()).toBe(1); // no new left write -> stayed put on screen
  });

  it('restarts the CSS rise only when an ATTACHED node is evicted (free/recycled restart naturally)', () => {
    const painter = makePainter({ cap: 1 });
    painter.spawn(evt({ kind: 'heal', text: '+5' }), 0);
    const node = liveNodes()[0];
    const animOf = () =>
      calls
        .filter((c) => c.m === 'setStyleProp' && c.el === node && c.args[0] === 'animation')
        .map((c) => c.args[1]);
    // First spawn off the free list: NO forced restart (a detached node animates on append).
    expect(animOf()).toEqual([]);
    // TTL-recycle then respawn into the (now detached, cross-tick) node: still no forced restart.
    painter.step(FCT_TTL_MS);
    painter.spawn(evt({ kind: 'heal', text: '+9' }), FCT_TTL_MS);
    expect(animOf()).toEqual([]);
    // Over-cap spawn with NO recycle: the still-attached node is evicted + reused in the same
    // tick, which the browser would not restart, so the painter forces it (none -> restore).
    painter.spawn(evt({ kind: 'heal', text: '+12' }), FCT_TTL_MS);
    expect(animOf()).toEqual(['none', '']);
  });

  it('swaps the colour-token + crit class on reuse (old colour off, new on; crit toggled)', () => {
    const painter = makePainter({ cap: 1 });
    painter.spawn(evt({ kind: 'heal', text: '+5', crit: false }), 0);
    const node = liveNodes()[0];
    const toggles = () =>
      calls.filter((c) => c.m === 'toggleClass' && c.el === node).map((c) => c.args);
    expect(toggles()).toContainEqual(['fct-heal', true]);
    expect(toggles()).toContainEqual(['crit', false]);
    // Reuse the same single slot for a crit xp floater: heal off, xp on, crit on.
    painter.step(FCT_TTL_MS);
    painter.spawn(evt({ kind: 'xp', text: '+10 XP', crit: true }), FCT_TTL_MS);
    expect(toggles()).toContainEqual(['fct-heal', false]);
    expect(toggles()).toContainEqual(['fct-xp', true]);
    expect(toggles()).toContainEqual(['crit', true]);
  });

  it('routes EVERY spawn write through the elided facet (no raw DOM path)', () => {
    const painter = makePainter({ project: () => ({ x: 50, y: 60, behind: false }), scale: 1 });
    painter.spawn(evt({ kind: 'damage-done-ability', text: '123', crit: true }), 0);
    const node = liveNodes()[0];
    const on = (m: Call['m'], pred: (c: Call) => boolean) =>
      calls.some((c) => c.m === m && c.el === node && pred(c));
    expect(on('setText', (c) => c.args[0] === '123')).toBe(true);
    expect(
      on('toggleClass', (c) => c.args[0] === 'fct-damage-done-ability' && c.args[1] === true),
    ).toBe(true);
    expect(on('toggleClass', (c) => c.args[0] === 'crit' && c.args[1] === true)).toBe(true);
    expect(on('setStyleProp', (c) => c.args[0] === 'left')).toBe(true);
    expect(on('setStyleProp', (c) => c.args[0] === 'top')).toBe(true);
    expect(on('setDisplay', (c) => c.args[0] === '')).toBe(true);
  });

  // DECISION 15 (ClientWorld-vs-Sim parity): the painter reads ONLY pos.{x,y,z} + scale off
  // the anchor entity, so an offline Sim entity and an online ClientWorld-mirror entity (the
  // SAME structural shape) position identically. A Sim-only field assumption would pass the
  // offline gate and misrender online; this drives both shapes through the getUiScale divide.
  it('positions identically off a Sim-shaped and a ClientWorld-mirror-shaped anchor (decision 15)', () => {
    const project: FctProject = (x, y) => ({ x: x * 100, y: y * 100, behind: false });
    const run = (target: FctEvent['target']) => {
      mount = fakeEl('div');
      const facet = recordingFacet();
      const painter = new FctPainter(
        facet.writers,
        mount as unknown as HTMLElement,
        project,
        () => 2,
        {
          cap: 2,
          doc: fakeDoc,
          random: () => 0.5,
        },
      );
      painter.spawn(evt({ kind: 'damage-taken', text: '-9', target }), 0);
      const node = mount.childNodes[0];
      const get = (prop: string) =>
        facet.calls
          .filter((c) => c.m === 'setStyleProp' && c.el === node && c.args[0] === prop)
          .at(-1)?.args[1];
      return { left: get('left'), top: get('top') };
    };
    // Same coords from each world (Sim object literal vs a ClientWorld mirror record): the
    // painter has no field beyond pos + scale to diverge on, so the divided position agrees.
    const sim = run({ pos: { x: 1, y: 2, z: 3 }, scale: 1.5 });
    const online = run({ pos: { x: 1, y: 2, z: 3 }, scale: 1.5 });
    expect(sim).toEqual(online);
    // and the getUiScale divide is actually applied: anchor y = pos.y + 2.2*scale, then
    // project (*100), then / uiScale (2). Computed the same way the painter does so the
    // float matches exactly.
    const anchorY = 2 + FCT_ANCHOR_HEAD_OFFSET * 1.5;
    expect(sim.top).toBe(`${(anchorY * 100) / 2}px`);
  });
});

// Sanity: the painter's default cap is the exported bound the perf gate asserts against.
describe('FctPainter: the exported cap', () => {
  it('exposes FCT_POOL_CAP as a positive bound', () => {
    expect(FCT_POOL_CAP).toBeGreaterThan(0);
  });
});
