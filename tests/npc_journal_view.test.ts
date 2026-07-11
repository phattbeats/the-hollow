import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/sim/data';
import { npcJournalClampIndex, npcJournalPageAt } from '../src/ui/npc_journal_view';

// The NPC journal/lore pagination is DOM-bound in hud.ts, but its line
// sequencing is a pure function over the current index + line count - that
// is what we pin here (the gossip painter stays a thin consumer of this
// core). PHAA-480. Distinct from the intro sequencer (tests/npc_intro_view.test.ts):
// the journal has no advance-end condition (always re-readable), the page
// reports real canAdvance / canRetreat booleans (the consumer draws a Close
// affordance, not a Continue that hands off to another dialog), and the
// shown-once gate is absent (the gossip menu is always available).

describe('npcJournalPageAt', () => {
  it('resolves the first line as the opening page with retreat disabled', () => {
    const page = npcJournalPageAt(0, 3);
    expect(page).not.toBeNull();
    expect(page?.index).toBe(0);
    expect(page?.total).toBe(3);
    expect(page?.isFirst).toBe(true);
    expect(page?.isLast).toBe(false);
    expect(page?.canAdvance).toBe(true);
    expect(page?.canRetreat).toBe(false);
  });

  it('resolves a middle line with both directions enabled', () => {
    const page = npcJournalPageAt(1, 3);
    expect(page?.index).toBe(1);
    expect(page?.isFirst).toBe(false);
    expect(page?.isLast).toBe(false);
    expect(page?.canAdvance).toBe(true);
    expect(page?.canRetreat).toBe(true);
  });

  it('resolves the final line as the closing page with advance disabled', () => {
    // Distinct from npc_intro_view: the last journal line does NOT hand off
    // to a "sequence complete" state; the player stays on the page until
    // they choose Close.
    const page = npcJournalPageAt(2, 3);
    expect(page?.index).toBe(2);
    expect(page?.isFirst).toBe(false);
    expect(page?.isLast).toBe(true);
    expect(page?.canAdvance).toBe(false);
    expect(page?.canRetreat).toBe(true);
  });

  it('returns null for out-of-range, non-integer, or empty sequences', () => {
    expect(npcJournalPageAt(-1, 3)).toBeNull();
    expect(npcJournalPageAt(3, 3)).toBeNull();
    expect(npcJournalPageAt(1.5, 3)).toBeNull();
    expect(npcJournalPageAt(0, 0)).toBeNull();
    expect(npcJournalPageAt(0, -1)).toBeNull();
  });
});

describe('npcJournalClampIndex', () => {
  it('clamps negative or fractional targets to the opening page', () => {
    expect(npcJournalClampIndex(-5, 3)).toBe(0);
    expect(npcJournalClampIndex(0.5, 3)).toBe(0);
  });

  it('clamps overflow targets to the closing page', () => {
    expect(npcJournalClampIndex(99, 3)).toBe(2);
    expect(npcJournalClampIndex(3, 3)).toBe(2);
  });

  it('passes through legal in-range targets unchanged', () => {
    expect(npcJournalClampIndex(0, 3)).toBe(0);
    expect(npcJournalClampIndex(1, 3)).toBe(1);
    expect(npcJournalClampIndex(2, 3)).toBe(2);
  });

  it('returns 0 for an empty sequence so the consumer does not page', () => {
    expect(npcJournalClampIndex(0, 0)).toBe(0);
    expect(npcJournalClampIndex(7, -1)).toBe(0);
  });
});

// Guards the shipped content the ticket specifies: Verger Zebediah and Sexton
// Faddick each carry three journal/lore lines, and every index pages cleanly
// through the pure core (no advance-end condition).
describe('Hollow Reaches journal content (PHAA-480)', () => {
  for (const npcId of ['verger_zebediah', 'sexton_faddick'] as const) {
    it(`${npcId} carries three ordered journal lines the UI can page through`, () => {
      const lines = NPCS[npcId]?.journalLines ?? [];
      expect(lines).toHaveLength(3);
      for (const line of lines) expect(line.trim().length).toBeGreaterThan(0);
      // First page opens, middle pages, last page closes with canAdvance off.
      const first = npcJournalPageAt(0, lines.length);
      const middle = npcJournalPageAt(1, lines.length);
      const last = npcJournalPageAt(lines.length - 1, lines.length);
      expect(first?.canRetreat).toBe(false);
      expect(middle?.canAdvance).toBe(true);
      expect(middle?.canRetreat).toBe(true);
      expect(last?.canAdvance).toBe(false);
      expect(last?.canRetreat).toBe(true);
    });
  }
});
