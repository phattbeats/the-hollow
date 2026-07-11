// NPC journal/lore pagination - pure, host-agnostic, unit-tested. An NpcDef
// may carry an optional ordered `journalLines[]` a curious player can re-read
// at any time via the gossip-menu "read the journal" affordance (PHAA-480),
// deeper lore than the quest text and NOT first-meeting-only like introLines:
// the journal is always available and re-readable, no shown-once gate. This
// module owns the single decision of WHICH line is showing and the
// navigation edges, so the DOM-bound gossip painter (hud.ts) stays a thin
// consumer and the ordering is testable without a browser. It holds no
// world/DOM state: the line text is resolved by the consumer through
// tEntity, and the button labels are t() keys the consumer owns.

export interface NpcJournalPageView {
  index: number; // 0-based position in the sequence
  total: number; // number of journal lines
  isFirst: boolean;
  isLast: boolean;
  // Whether forward navigation is available from this page. The journal is
  // always re-readable, so we report a real boolean (not a "sequence end"
  // null) - the consumer still draws a Close affordance, not a Continue that
  // hands off to another dialog.
  canAdvance: boolean;
  canRetreat: boolean;
}

// Resolve the page view at an index within a sequence of `total` lines, or
// null when either argument is out of range (an NPC with no journalLines
// never pages).
export function npcJournalPageAt(index: number, total: number): NpcJournalPageView | null {
  if (!Number.isInteger(total) || total <= 0) return null;
  if (!Number.isInteger(index) || index < 0 || index >= total) return null;
  return {
    index,
    total,
    isFirst: index === 0,
    isLast: index === total - 1,
    canAdvance: index < total - 1,
    canRetreat: index > 0,
  };
}

// Clamp an arbitrary target index into the legal range for a sequence of
// `total` lines. Useful when the consumer wants to step by an arbitrary
// delta (page-up/page-down, jump to end) without an explicit bounds check.
export function npcJournalClampIndex(target: number, total: number): number {
  if (!Number.isInteger(total) || total <= 0) return 0;
  if (!Number.isInteger(target) || target < 0) return 0;
  if (target >= total) return total - 1;
  return target;
}
