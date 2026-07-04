import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/sim/data';
import { npcIntroAdvance, npcIntroPageAt } from '../src/ui/npc_intro_view';

// The NPC first-meeting intro is DOM-bound in hud.ts, but its line sequencing is
// a pure function over the current index + line count - that's what we pin here
// (the quest dialog stays a thin consumer of this core). PHAA-432.

describe('npcIntroPageAt', () => {
  it('resolves the first line as the opening beat, not the last', () => {
    const page = npcIntroPageAt(0, 3);
    expect(page).not.toBeNull();
    expect(page?.index).toBe(0);
    expect(page?.total).toBe(3);
    expect(page?.isFirst).toBe(true);
    expect(page?.isLast).toBe(false);
  });

  it('resolves the final line as the closing beat that opens the gossip menu', () => {
    const page = npcIntroPageAt(2, 3);
    expect(page?.index).toBe(2);
    expect(page?.isFirst).toBe(false);
    expect(page?.isLast).toBe(true);
  });

  it('returns null for out-of-range, non-integer, or empty sequences', () => {
    expect(npcIntroPageAt(-1, 3)).toBeNull();
    expect(npcIntroPageAt(3, 3)).toBeNull();
    expect(npcIntroPageAt(1.5, 3)).toBeNull();
    expect(npcIntroPageAt(0, 0)).toBeNull();
    expect(npcIntroPageAt(0, -1)).toBeNull();
  });
});

describe('npcIntroAdvance', () => {
  it('steps forward through the sequence and stops (null) past the last line', () => {
    expect(npcIntroAdvance(0, 3)).toBe(1);
    expect(npcIntroAdvance(1, 3)).toBe(2);
    expect(npcIntroAdvance(2, 3)).toBeNull();
  });

  it('treats a single-line sequence as immediately complete', () => {
    expect(npcIntroAdvance(0, 1)).toBeNull();
  });
});

// Guards the shipped content the ticket specifies: Brother Greenpaw pages through
// exactly three in-voice lines before his errand.
describe('Brother Greenpaw intro content', () => {
  it('carries three ordered intro lines the UI can page through', () => {
    const lines = NPCS.brother_greenpaw?.introLines ?? [];
    expect(lines).toHaveLength(3);
    for (const line of lines) expect(line.trim().length).toBeGreaterThan(0);
    // Reachable end state: advancing off the last line completes the sequence.
    expect(npcIntroAdvance(lines.length - 1, lines.length)).toBeNull();
  });
});
