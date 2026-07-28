// Hit rating: a gear-facing stat that reduces both melee/ranged miss and spell
// resist by the same percent, converted to a fraction here exactly like the
// WARFARE rating conversion in src/sim/pvp/power.ts. Pure and host-agnostic: no
// state, rng, or clock reads.

export const HIT_RATING_PER_PCT = 10; // 10 hit rating = +1% hit (less miss/resist)

export function hitFractionFromRating(rating: number): number {
  return Math.max(0, rating) / (HIT_RATING_PER_PCT * 100);
}
