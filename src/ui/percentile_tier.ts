// Leaderboard "Top N%" percentile tiers — a cosmetic rank ladder for the
// shareable player card, parallel to the $WOC holder-tier flair but driven by
// the character's realm standing by lifetime XP (server: lifetimeXpStanding),
// not wallet balance. Purely presentational: it grants no gameplay power.
//
// A character's raw percentile (rank/total × 100, e.g. 3.2) buckets to the
// ceiling whole percent — 3.2 → "Top 4%", 0.6 → "Top 1%" — so each of Top 1%
// through Top 9% has its own tier medal (gold at the apex, fading to bronze).
// Above 9% there is no tier (the card shows a plain "Top N%" chip instead).
//
// DOM/Three/network-free: plain data + an SVG data-URL builder, unit-testable in
// Node and drawable on a canvas or in an <img>.

/** Highest percentile bucket that earns a tier medal (Top 1%…Top 9%). */
export const PERCENTILE_TIER_MAX = 9;

export interface PercentileTier {
  /** Whole-percent bucket and 1-based rung: 1 = Top 1% (apex) … 9 = Top 9%. */
  percent: number;
  /** Stable machine key (CSS hooks / analytics). */
  key: string;
  /** Primary ring/accent colour (hex). */
  ring: string;
  /** Outer glow colour (hex). */
  glow: string;
}

// Gold → silver → bronze prestige gradient, brightest at the apex. Each rung is a
// distinct shade so the nine medals never read as the same colour at a glance.
export const PERCENTILE_TIERS: readonly PercentileTier[] = [
  { percent: 1, key: 'top1', ring: '#ffe27a', glow: '#ffaa00' },
  { percent: 2, key: 'top2', ring: '#ffd24a', glow: '#e0a52a' },
  { percent: 3, key: 'top3', ring: '#f0c674', glow: '#c99a3e' },
  { percent: 4, key: 'top4', ring: '#e6dab4', glow: '#bfb083' },
  { percent: 5, key: 'top5', ring: '#dfe7f0', glow: '#aebccd' },
  { percent: 6, key: 'top6', ring: '#c6d0dc', glow: '#93a3b6' },
  { percent: 7, key: 'top7', ring: '#e0a45a', glow: '#b9792e' },
  { percent: 8, key: 'top8', ring: '#d18f4a', glow: '#a8551f' },
  { percent: 9, key: 'top9', ring: '#c07f44', glow: '#8a4f24' },
] as const;

// A laurel wreath framing a five-point star — the universal "top rank" motif,
// filled in the cream tone so it reads on every ring colour. Shared by all rungs;
// the ring colour is what distinguishes them.
const GLYPH_FILL = '#fff6df';
const LAUREL_STAR =
  `<path d="M32 17.5l2.7 6 6.5.6-4.9 4.4 1.4 6.4-5.7-3.3-5.7 3.3 1.4-6.4-4.9-4.4 6.5-.6z" fill="${GLYPH_FILL}"/>` +
  `<g fill="none" stroke="${GLYPH_FILL}" stroke-width="2.3" stroke-linecap="round">` +
  `<path d="M23 45c-6.5-3.5-9.5-10.5-7.5-19"/>` +
  `<path d="M41 45c6.5-3.5 9.5-10.5 7.5-19"/>` +
  `</g>` +
  `<g fill="${GLYPH_FILL}">` +
  `<ellipse cx="17.5" cy="30" rx="2.2" ry="3.4" transform="rotate(-32 17.5 30)"/>` +
  `<ellipse cx="19.5" cy="37" rx="2.2" ry="3.4" transform="rotate(-20 19.5 37)"/>` +
  `<ellipse cx="46.5" cy="30" rx="2.2" ry="3.4" transform="rotate(32 46.5 30)"/>` +
  `<ellipse cx="44.5" cy="37" rx="2.2" ry="3.4" transform="rotate(20 44.5 37)"/>` +
  `</g>`;

/**
 * The percentile tier a raw realm percentile earns, or null when there is none —
 * no standing (`pct === null`), a non-finite/non-positive value, or a percentile
 * worse than Top {@link PERCENTILE_TIER_MAX}% (which the card shows as a plain
 * chip). The bucket is the ceiling whole percent, clamped so a sub-1% rank maps
 * to the apex Top 1% rung.
 */
export function percentileTierForPercent(pct: number | null): PercentileTier | null {
  if (pct === null || !Number.isFinite(pct) || pct <= 0 || pct > PERCENTILE_TIER_MAX) return null;
  const bucket = Math.max(1, Math.ceil(pct));
  return PERCENTILE_TIERS[bucket - 1] ?? null;
}

/**
 * A standalone SVG data URL for a tier's medal: a ring→glow radial disc with the
 * laurel-and-star glyph centred. Suitable for an `<img>` src or for drawing onto a
 * canvas; the viewBox is always `0 0 64 64`, so it scales crisply. `px` sets the
 * rasterised pixel box.
 */
export function percentileTierBadgeDataUrl(tier: PercentileTier, px = 128): string {
  // Per-tier gradient id so several medals can be inlined into one document (a
  // tier-ladder panel) without their `url(#…)` references colliding.
  const gid = `g${tier.key}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64">` +
    `<defs>` +
    `<radialGradient id="${gid}" cx="38%" cy="32%" r="72%">` +
    `<stop offset="0%" stop-color="${tier.ring}"/>` +
    `<stop offset="100%" stop-color="${tier.glow}"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<circle cx="32" cy="32" r="30" fill="url(#${gid})"/>` +
    `<circle cx="32" cy="32" r="30" fill="none" stroke="#1c140a" stroke-width="2"/>` +
    `<circle cx="32" cy="32" r="26" fill="none" stroke="#fff6df" stroke-opacity="0.35" stroke-width="1.5"/>` +
    LAUREL_STAR +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
