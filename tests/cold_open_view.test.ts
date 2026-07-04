import { describe, expect, it } from 'vitest';
import { COLD_OPEN_SEQUENCE, coldOpenAdvance, coldOpenCardAt } from '../src/ui/cold_open_view';

// The cold-open overlay's rendering is DOM-bound, but its card sequencing is a
// pure function over the current index - that's what we pin here (the overlay
// stays a thin consumer of this core).

describe('coldOpenCardAt', () => {
  it('resolves the first card as the opening beat, not the last', () => {
    const card = coldOpenCardAt(0);
    expect(card).not.toBeNull();
    expect(card?.id).toBe('wake');
    expect(card?.index).toBe(0);
    expect(card?.total).toBe(COLD_OPEN_SEQUENCE.length);
    expect(card?.isFirst).toBe(true);
    expect(card?.isLast).toBe(false);
    expect(card?.bodyKey).toBe('coldOpen.wakeBody');
    // A non-final card advances rather than dismisses.
    expect(card?.advanceKey).toBe('coldOpen.continue');
  });

  it('resolves the final card as the closing beat that begins the game', () => {
    const last = COLD_OPEN_SEQUENCE.length - 1;
    const card = coldOpenCardAt(last);
    expect(card?.id).toBe('orient');
    expect(card?.isFirst).toBe(false);
    expect(card?.isLast).toBe(true);
    expect(card?.bodyKey).toBe('coldOpen.orientBody');
    // The final card's advance button dismisses into the world.
    expect(card?.advanceKey).toBe('coldOpen.begin');
  });

  it('maps every card id to its own coldOpen.<id>Body copy key in order', () => {
    for (let i = 0; i < COLD_OPEN_SEQUENCE.length; i++) {
      const card = coldOpenCardAt(i);
      expect(card?.id).toBe(COLD_OPEN_SEQUENCE[i]);
      expect(card?.bodyKey).toBe(`coldOpen.${COLD_OPEN_SEQUENCE[i]}Body`);
      expect(card?.index).toBe(i);
    }
  });

  it('returns null for out-of-range and non-integer indices', () => {
    expect(coldOpenCardAt(-1)).toBeNull();
    expect(coldOpenCardAt(COLD_OPEN_SEQUENCE.length)).toBeNull();
    expect(coldOpenCardAt(0.5)).toBeNull();
    expect(coldOpenCardAt(Number.NaN)).toBeNull();
  });
});

describe('coldOpenAdvance', () => {
  it('walks the sequence to the last card, then returns null to dismiss', () => {
    let index: number | null = 0;
    const visited: number[] = [];
    // Guard the loop so a regression that never terminates fails loudly rather
    // than hanging: it can visit at most the whole sequence.
    for (let step = 0; index !== null && step <= COLD_OPEN_SEQUENCE.length; step++) {
      visited.push(index);
      index = coldOpenAdvance(index);
    }
    expect(visited).toEqual(Array.from({ length: COLD_OPEN_SEQUENCE.length }, (_, i) => i));
    // Advancing off the final card completes the sequence.
    expect(coldOpenAdvance(COLD_OPEN_SEQUENCE.length - 1)).toBeNull();
  });
});
