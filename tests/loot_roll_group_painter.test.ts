// @vitest-environment jsdom
// Keyed-pool painter for the group-visible loot-roll vote strip (PHAA-568). The
// headline guard is the DOUBLED-CHIP regression: an earlier revision built one
// untracked chip per candidate in createStrip AND a second tracked set in
// paintStrip, so every strip rendered 2N chips (N of them blank). This drives
// the real painter over a real jsdom DOM through an APPLYING writer facet and
// asserts exactly N chips per roll, plus the pool behaviors (steady frame moves
// no node, a fresh answer flips one label, the localized aria label lands via
// setAttr, an empty view prunes the pool).

import { beforeEach, describe, expect, it } from 'vitest';
import { LootRollGroupPainter } from '../src/ui/loot_roll_group_painter';
import type {
  GroupChoice,
  LootRollGroupView,
  LootRollGroupViewRoll,
} from '../src/ui/loot_roll_group_view';
import type { PainterHostWriters } from '../src/ui/painter_host';

// An APPLYING facet: it performs the real DOM write (so the jsdom tree reflects
// the paint) AND records the call, so a test can assert both the DOM result and
// the routing (e.g. aria-label went through setAttr).
type Call = { m: keyof PainterHostWriters; el: HTMLElement; args: unknown[] };
function applyingFacet() {
  const calls: Call[] = [];
  const writers: PainterHostWriters = {
    setText: (el, text) => {
      calls.push({ m: 'setText', el, args: [text] });
      el.textContent = text;
    },
    setDisplay: (el, display) => {
      calls.push({ m: 'setDisplay', el, args: [display] });
      el.style.display = display;
    },
    setTransform: (el, transform) => {
      calls.push({ m: 'setTransform', el, args: [transform] });
      el.style.transform = transform;
    },
    setWidth: (el, width) => {
      calls.push({ m: 'setWidth', el, args: [width] });
      el.style.width = width;
    },
    setStyleProp: (el, prop, value) => {
      calls.push({ m: 'setStyleProp', el, args: [prop, value] });
      el.style.setProperty(prop, value);
    },
    toggleClass: (el, cls, on) => {
      calls.push({ m: 'toggleClass', el, args: [cls, on] });
      el.classList.toggle(cls, on);
    },
    setAttr: (el, name, value) => {
      calls.push({ m: 'setAttr', el, args: [name, value] });
      el.setAttribute(name, value);
    },
  };
  return { calls, writers };
}

function entry(pid: number, name: string, choice: GroupChoice) {
  const label = { need: 'Need', greed: 'Greed', pass: 'Pass', pending: 'Waiting...' }[choice];
  return { pid, name, choice, label };
}

function roll(over: Partial<LootRollGroupViewRoll> = {}): LootRollGroupViewRoll {
  return {
    rollId: 1,
    itemName: 'Greyjaw Hide Boots',
    quality: 'uncommon',
    viewerIsCandidate: true,
    ariaLabel: 'Group roll status for Greyjaw Hide Boots',
    entries: [entry(10, 'Aaa', 'need'), entry(20, 'Bbb', 'pending'), entry(30, 'Ccc', 'pass')],
    ...over,
  };
}

function view(rolls: LootRollGroupViewRoll[]): LootRollGroupView {
  return { rolls };
}

describe('LootRollGroupPainter: keyed pool over a real DOM', () => {
  let host: HTMLElement;
  let facet: ReturnType<typeof applyingFacet>;
  let painter: LootRollGroupPainter;

  beforeEach(() => {
    host = document.createElement('div');
    facet = applyingFacet();
    painter = new LootRollGroupPainter(facet.writers);
  });

  const strips = () => host.querySelectorAll('.loot-roll-group');
  const chips = (stripEl: Element) => stripEl.querySelectorAll('.loot-roll-chip');

  it('DOUBLED-CHIP regression: renders exactly one chip per candidate, not two', () => {
    painter.paint(view([roll()]), host, null);
    expect(strips()).toHaveLength(1);
    // The bug rendered 2N (6) chips, N of them blank. Exactly N (3) is correct.
    expect(chips(strips()[0])).toHaveLength(3);
    // Every chip carries its candidate's name and label text (no blank chips).
    const texts = [...chips(strips()[0])].map((c) => c.textContent?.trim());
    expect(texts).toEqual(['Aaa Need', 'Bbb Waiting...', 'Ccc Pass']);
  });

  it('a steady re-paint reuses the same strip and chip nodes (no churn, no growth)', () => {
    painter.paint(view([roll()]), host, null);
    const strip0 = strips()[0];
    const chip0 = chips(strip0)[0];
    painter.paint(view([roll()]), host, null);
    expect(strips()).toHaveLength(1);
    expect(strips()[0]).toBe(strip0);
    expect(chips(strips()[0])).toHaveLength(3);
    expect(chips(strips()[0])[0]).toBe(chip0);
  });

  it('a fresh answer flips a single chip label in place', () => {
    painter.paint(view([roll()]), host, null);
    const before = chips(strips()[0]);
    // Bbb answers greed; everyone else unchanged.
    const answered = roll({
      entries: [entry(10, 'Aaa', 'need'), entry(20, 'Bbb', 'greed'), entry(30, 'Ccc', 'pass')],
    });
    painter.paint(view([answered]), host, null);
    expect(chips(strips()[0])).toHaveLength(3);
    // Same chip node, new label text; the choice class flipped to greed.
    expect(chips(strips()[0])[1]).toBe(before[1]);
    expect(chips(strips()[0])[1].textContent?.trim()).toBe('Bbb Greed');
    expect(chips(strips()[0])[1].classList.contains('greed')).toBe(true);
    expect(chips(strips()[0])[1].classList.contains('pending')).toBe(false);
  });

  it('sets the localized aria label on the strip via the setAttr writer', () => {
    painter.paint(view([roll()]), host, null);
    expect(strips()[0].getAttribute('aria-label')).toBe('Group roll status for Greyjaw Hide Boots');
    expect(
      facet.calls.some(
        (c) =>
          c.m === 'setAttr' &&
          c.args[0] === 'aria-label' &&
          c.args[1] === 'Group roll status for Greyjaw Hide Boots',
      ),
    ).toBe(true);
  });

  it('adds a chip when a candidate joins mid-vote and drops one who leaves', () => {
    painter.paint(view([roll()]), host, null);
    expect(chips(strips()[0])).toHaveLength(3);
    // A fourth candidate joins.
    painter.paint(
      view([roll({ entries: [...roll().entries, entry(40, 'Ddd', 'pending')] })]),
      host,
      null,
    );
    expect(chips(strips()[0])).toHaveLength(4);
    // Ccc leaves the party mid-roll.
    painter.paint(
      view([roll({ entries: [entry(10, 'Aaa', 'need'), entry(20, 'Bbb', 'pending')] })]),
      host,
      null,
    );
    expect(chips(strips()[0])).toHaveLength(2);
    expect([...chips(strips()[0])].map((c) => c.textContent?.trim())).toEqual([
      'Aaa Need',
      'Bbb Waiting...',
    ]);
  });

  it('hides pooled strips and prunes the pool when the view goes empty', () => {
    painter.paint(view([roll()]), host, null);
    expect((strips()[0] as HTMLElement).style.display).not.toBe('none');
    painter.paint(view([]), host, null);
    // The strip node remains in the DOM but is hidden; the pool no longer tracks it,
    // so a re-open builds a fresh strip.
    const stripEl = host.querySelector('.loot-roll-group') as HTMLElement;
    expect(stripEl.style.display).toBe('none');
    expect(painter.stripFor(1)).toBeNull();
  });

  it('keys strips by rollId and shows one strip per open roll', () => {
    painter.paint(
      view([roll({ rollId: 1, itemName: 'Boots' }), roll({ rollId: 2, itemName: 'Cloak' })]),
      host,
      null,
    );
    expect(strips()).toHaveLength(2);
    expect(painter.stripFor(1)).not.toBeNull();
    expect(painter.stripFor(2)).not.toBeNull();
  });
});
