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

// PHAA-432 follow-up (Brandon feedback on PR #82): the greeting is the line
// rendered in the gossip dialog every time the player re-opens Greenpaw AFTER
// the click-through intro has played. It must read as already-met voice rather
// than first-meeting voice, so it cannot share its first beat with the intro
// (otherwise it lands on the player as a second "uhh... hi.").
describe("Brother Greenpaw's greeting doesn't re-fight the intro", () => {
  const greeting = NPCS.brother_greenpaw?.greeting ?? '';
  const introLines = NPCS.brother_greenpaw?.introLines ?? [];

  it('is non-empty and distinct from every intro line', () => {
    expect(greeting.trim().length).toBeGreaterThan(0);
    expect(introLines).not.toContain(greeting);
  });

  it('does not share a 24-char opening with any intro line', () => {
    // Strip the trailing "..." off both sides before comparing openings, so
    // "you're back, that's a..." vs "uhh... hi. hi. didn't..." doesn't trip
    // on an ellipsis collision. Use [\s\S] rather than the `s` flag to stay
    // compatible with the project's older TS target.
    const stripDots = (s: string) => s.replace(/\.{3,}[\s\S]*$/, '').trim();
    const greetingOpen = stripDots(greeting).toLowerCase().slice(0, 24);
    expect(greetingOpen.length).toBeGreaterThanOrEqual(8);
    for (const line of introLines) {
      const lineOpen = stripDots(line).toLowerCase().slice(0, 24);
      expect(greetingOpen, `greeting shares an opening with intro: "${lineOpen}"`).not.toBe(
        lineOpen,
      );
    }
  });

  it("drops the 'traveler' / first-meeting opener pattern", () => {
    // The pre-fix greeting opened with "howdy, traveler.": re-introducing that
    // would re-fire the bug Brandon flagged.
    expect(greeting.toLowerCase()).not.toMatch(/^\s*howdy,\s+traveler/);
  });
});
