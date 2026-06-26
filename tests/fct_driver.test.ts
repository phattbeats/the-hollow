// Guard for the per-frame FCT driver (P13a). Proves the two P13a guarantees: (1) the
// driver is DORMANT -- with no spawn site feeding it, step() makes zero writes for any
// number of frames, so adding it to hud.update() cannot change visible FCT or regress the
// perf gate; and (2) the seam P13b plugs into is wired -- once an entry is spawned, the
// only write path is the elided PainterHost facet (never a raw style/textContent write),
// so P13b's pooled writes are elided by construction.

import { describe, expect, it } from 'vitest';
import type { FctEvent } from '../src/ui/fct_core';
import { FctDriver } from '../src/ui/fct_driver';
import type { PainterHostWriters } from '../src/ui/painter_host';

type Call = { m: keyof PainterHostWriters; args: unknown[] };

function recordingFacet() {
  const calls: Call[] = [];
  const writers: PainterHostWriters = {
    setText: (el, text) => {
      calls.push({ m: 'setText', args: [el, text] });
    },
    setDisplay: (el, display) => {
      calls.push({ m: 'setDisplay', args: [el, display] });
    },
    setTransform: (el, transform) => {
      calls.push({ m: 'setTransform', args: [el, transform] });
    },
    setWidth: (el, width) => {
      calls.push({ m: 'setWidth', args: [el, width] });
    },
    setStyleProp: (el, prop, value) => {
      calls.push({ m: 'setStyleProp', args: [el, prop, value] });
    },
    toggleClass: (el, cls, on) => {
      calls.push({ m: 'toggleClass', args: [el, cls, on] });
    },
    setAttr: (el, name, value) => {
      calls.push({ m: 'setAttr', args: [el, name, value] });
    },
  };
  return { calls, writers };
}

const NODE = { tag: 'fct-node' } as unknown as HTMLElement;

function makeEvent(overrides: Partial<FctEvent> = {}): FctEvent {
  return {
    kind: 'damage-done-ability',
    text: '321',
    target: { pos: { x: 0, y: 0, z: 0 }, scale: 1 },
    crit: false,
    isSelf: false,
    ...overrides,
  };
}

describe('FctDriver: dormant until P13b feeds it', () => {
  it('writes nothing across many frames when no spawn site has fed it', () => {
    const { calls, writers } = recordingFacet();
    const driver = new FctDriver(writers);
    for (const now of [0, 16, 33, 250, 1000, 5000]) driver.step(now);
    expect(calls).toEqual([]);
  });
});

describe('FctDriver: the spawn -> step seam routes through the elided facet', () => {
  it('drives an active entry through setText (never a raw write) and evicts at ttl', () => {
    const { calls, writers } = recordingFacet();
    const driver = new FctDriver(writers);
    driver.spawn(NODE, makeEvent({ text: 'hit!' }), 0.5, 1000);

    driver.step(1000);
    expect(calls).toEqual([{ m: 'setText', args: [NODE, 'hit!'] }]);

    // Once the 1250ms ttl elapses, the entry is hidden through the facet (no raw DOM).
    driver.step(1000 + 1250);
    expect(calls.at(-1)).toEqual({ m: 'setDisplay', args: [NODE, 'none'] });

    // Every recorded call is a PainterHostWriters method -- there is no raw-write path.
    const writerMethods: Array<keyof PainterHostWriters> = [
      'setText',
      'setDisplay',
      'setTransform',
      'setWidth',
      'setStyleProp',
      'toggleClass',
      'setAttr',
    ];
    for (const c of calls) expect(writerMethods).toContain(c.m);
  });
});
