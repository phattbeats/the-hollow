// Pure, DOM-free weighted-random SFX variant picker.
//
// Upstream PR #1901 ("restore no-repeat-biased random SFX variant selection")
// replaces the round-robin variant cursor with a weighted-random pick: every
// usable variant gets weight 1 except the immediately previous one, which gets
// a low (0.15) weight so it can still recur occasionally, just rarely. Hard
// exclusion on a 2-take pool degenerates into rigid A-B-A-B alternation, which
// reads as just as metronomic as the round-robin it replaces; a low-but-nonzero
// weight keeps a small pool sounding genuinely random while an audible
// back-to-back repeat stays rare.
//
// Fork adaptations vs upstream:
//   - `rng.next()` (the sim `Rng`) is the only source of randomness. Upstream
//     uses `Math.random()`; the fork hard rule routes all randomness through
//     `Rng`, and audio is sim-adjacent enough to honour it (deterministic seed
//     gives a deterministic variant sequence, which matters for replays and
//     for QA parity).
//   - The picker is a pure function. The caller (sfx.ts) owns the Rng instance
//     and the per-key `lastVariant` cursor; this module has no state.
//   - Failed loads are filtered by the caller BEFORE calling the picker: the
//     picker only sees the usable subset. That keeps the picker free of any
//     side-channel state (`failedLoads`) and lets it be exercised directly
//     from Vitest with no DOM stub.
//
// The picker returns an INDEX into `usable`, not a buffer; the caller maps the
// index back to the resolved `AudioBuffer` so the picker stays pure and DOM-free.

import type { Rng } from '../sim/rng';

/**
 * No-repeat-biased random variant picker.
 *
 * The immediately previous variant index gets `REPEAT_VARIANT_WEIGHT` (0.15)
 * instead of 1.0: low enough that an occasional back-to-back repeat stays
 * rare, high enough that a 2-take pool does NOT degenerate into a predictable
 * A-B-A-B alternation. A variant that failed to load is the caller's
 * responsibility: pass only the usable indices and the picker never has to
 * know about load state.
 *
 * @param rng   A `Rng` instance. Required: sim-scope randomness is Rng-only.
 * @param usable Indices into the caller's variant array, in any order. Must be
 *               non-empty. Duplicates are not deduplicated here.
 * @param last  The previously chosen index, or `undefined` if no play has
 *               occurred yet for this key. A value that is not in `usable` is
 *               treated as "no previous play" (the weight match will simply
 *               never fire).
 * @returns     An index from `usable`.
 */
export const REPEAT_VARIANT_WEIGHT = 0.15;

export function pickWeightedVariant(rng: Rng, usable: number[], last: number | undefined): number {
  if (usable.length === 0) {
    // Defensive: caller should never invoke with an empty pool, but fail
    // loudly rather than throw so the audio hot path stays non-fatal.
    return 0;
  }
  if (usable.length === 1) {
    // The single usable variant wins regardless of last; no weight math needed.
    return usable[0]!;
  }
  // Compute weights: 1.0 for "fresh" picks, REPEAT_VARIANT_WEIGHT for the
  // immediately previous one. A `last` that isn't in `usable` contributes 0
  // repeats (no entry matches) so the picker behaves identically to a fresh
  // key.
  const weights: number[] = new Array(usable.length);
  let total = 0;
  for (let i = 0; i < usable.length; i++) {
    const w = usable[i] === last ? REPEAT_VARIANT_WEIGHT : 1;
    weights[i] = w;
    total += w;
  }
  // `Rng.range` is half-open [min, max); draw into [0, total) and walk down
  // the weights array. The `while` is a belt-and-braces guard against floating
  // point drift: if rng() returns exactly total - epsilon and one weight is
  // epsilon short, the linear walk would underflow. Falling through to the
  // last entry is the documented fallback in upstream's picker too.
  let roll = rng.range(0, total);
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return usable[i]!;
  }
  return usable[usable.length - 1]!;
}
