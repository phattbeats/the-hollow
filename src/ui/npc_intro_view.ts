// NPC first-meeting intro click-through sequencing - pure, host-agnostic,
// unit-tested. An NpcDef may carry an optional ordered `introLines[]` the player
// clicks through once, in-voice, before the gossip/quest hook (PHAA-432). This
// module owns the single decision of WHICH line is showing and how the sequence
// advances, so the DOM-bound quest dialog (hud.ts) stays a thin consumer and the
// ordering is testable without a browser. It holds no world/DOM state: the line
// text is resolved by the consumer through tEntity, the button label is a plain
// t() key it owns, and the shown-once gate is a client-side localStorage flag
// held by hud.ts.

export interface NpcIntroPageView {
  index: number; // 0-based position in the sequence
  total: number; // number of intro lines
  isFirst: boolean;
  isLast: boolean; // the last line hands off to the gossip menu when advanced
}

// Resolve the page view at an index within a sequence of `total` lines, or null
// when either argument is out of range (an NPC with no introLines never pages).
export function npcIntroPageAt(index: number, total: number): NpcIntroPageView | null {
  if (!Number.isInteger(total) || total <= 0) return null;
  if (!Number.isInteger(index) || index < 0 || index >= total) return null;
  return {
    index,
    total,
    isFirst: index === 0,
    isLast: index === total - 1,
  };
}

// The next index after advancing from `index`, or null when the sequence is
// complete (the consumer marks the intro seen and opens the gossip menu).
export function npcIntroAdvance(index: number, total: number): number | null {
  const next = index + 1;
  return !Number.isInteger(total) || next >= total ? null : next;
}
