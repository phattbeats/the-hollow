// Cold-open intro card sequencing - pure, host-agnostic, unit-tested.
//
// A fresh character sees a brief, presentation-only cold-open before the
// first-errand tutorial (tutorial.ts): a two-beat sequence that frames the
// amnesia mystery, then gives the player a moment to reorient in the shrine and
// follow the light toward Brother Greenpaw. This module owns the single
// decision of WHICH card is showing and how the sequence advances, so the
// DOM-bound overlay (cold_open.ts) stays a thin consumer and the ordering is
// testable without a browser. It reads no world state: the cold-open is pure
// narration, gated only by isFreshCharacter plus a shown-once localStorage flag
// held by the overlay.

import type { TranslationKey } from './i18n';

// The ordered card ids. Each maps to a `coldOpen.<id>Body` copy key. `wake`
// frames the amnesia; `orient` reorients the player in the shrine and points
// them at the light (and the NPC beyond it) before the tutorial takes over.
export const COLD_OPEN_SEQUENCE = ['wake', 'orient'] as const;
export type ColdOpenCardId = (typeof COLD_OPEN_SEQUENCE)[number];

export interface ColdOpenCardView {
  id: ColdOpenCardId;
  index: number; // 0-based position in the sequence
  total: number; // sequence length
  isFirst: boolean;
  isLast: boolean;
  bodyKey: TranslationKey; // coldOpen.<id>Body
  // The advance button reads "Begin" on the final card (it dismisses into the
  // world) and "Continue" on every earlier card.
  advanceKey: TranslationKey;
}

// Resolve the card view at an index, or null when the index is out of range.
export function coldOpenCardAt(index: number): ColdOpenCardView | null {
  if (!Number.isInteger(index) || index < 0 || index >= COLD_OPEN_SEQUENCE.length) return null;
  const id = COLD_OPEN_SEQUENCE[index];
  const isLast = index === COLD_OPEN_SEQUENCE.length - 1;
  return {
    id,
    index,
    total: COLD_OPEN_SEQUENCE.length,
    isFirst: index === 0,
    isLast,
    bodyKey: `coldOpen.${id}Body` as TranslationKey,
    advanceKey: isLast ? 'coldOpen.begin' : 'coldOpen.continue',
  };
}

// The next index after advancing from `index`, or null when the sequence is
// complete (the overlay dismisses and hands off to the tutorial).
export function coldOpenAdvance(index: number): number | null {
  const next = index + 1;
  return next >= COLD_OPEN_SEQUENCE.length ? null : next;
}
