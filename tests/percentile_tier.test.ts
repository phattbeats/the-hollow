import { describe, expect, it } from 'vitest';
import {
  PERCENTILE_TIERS, PERCENTILE_TIER_MAX, percentileTierForPercent, percentileTierBadgeDataUrl,
} from '../src/ui/percentile_tier';

describe('percentile-tier ladder', () => {
  it('has one rung per whole percent from Top 1% to Top 9%', () => {
    expect(PERCENTILE_TIERS).toHaveLength(9);
    expect(PERCENTILE_TIER_MAX).toBe(9);
    PERCENTILE_TIERS.forEach((tier, i) => {
      expect(tier.percent).toBe(i + 1);
      expect(tier.key).toBe(`top${i + 1}`);
      expect(tier.ring).toMatch(/^#[0-9a-f]{6}$/i);
      expect(tier.glow).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('gives every rung a distinct key and ring colour (nine readable medals)', () => {
    expect(new Set(PERCENTILE_TIERS.map((t) => t.key)).size).toBe(9);
    expect(new Set(PERCENTILE_TIERS.map((t) => t.ring)).size).toBe(9);
  });
});

describe('percentileTierForPercent', () => {
  it('returns null when there is no standing or the input is not a usable number', () => {
    expect(percentileTierForPercent(null)).toBeNull();
    expect(percentileTierForPercent(0)).toBeNull();
    expect(percentileTierForPercent(-3)).toBeNull();
    expect(percentileTierForPercent(Number.NaN)).toBeNull();
    expect(percentileTierForPercent(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('buckets a raw percentile up to the ceiling whole percent', () => {
    // 3.2% sits in the Top 4% bucket; 2.0% exactly is Top 2%.
    expect(percentileTierForPercent(3.2)?.percent).toBe(4);
    expect(percentileTierForPercent(2)?.percent).toBe(2);
    expect(percentileTierForPercent(5.99)?.percent).toBe(6);
  });

  it('maps a sub-1% rank to the apex Top 1% rung', () => {
    expect(percentileTierForPercent(0.4)?.percent).toBe(1);
    expect(percentileTierForPercent(0.99)?.percent).toBe(1);
    expect(percentileTierForPercent(1)?.percent).toBe(1);
  });

  it('returns each whole-percent rung 1..9 for its exact value', () => {
    for (let p = 1; p <= 9; p++) {
      const tier = percentileTierForPercent(p);
      expect(tier?.percent).toBe(p);
      expect(tier?.key).toBe(`top${p}`);
    }
  });

  it('pins the inclusive Top 9% edge — 9 earns top9, 9.01 falls off', () => {
    expect(percentileTierForPercent(9)?.percent).toBe(9);
    expect(percentileTierForPercent(9)?.key).toBe('top9');
    expect(percentileTierForPercent(9.01)).toBeNull();
    expect(percentileTierForPercent(10)).toBeNull();
    expect(percentileTierForPercent(42)).toBeNull();
  });
});

describe('percentileTierBadgeDataUrl', () => {
  it('builds an SVG data URL embedding each rung ring colour + the laurel glyph', () => {
    for (const tier of PERCENTILE_TIERS) {
      const url = percentileTierBadgeDataUrl(tier);
      expect(url.startsWith('data:image/svg+xml,')).toBe(true);
      const svg = decodeURIComponent(url);
      expect(svg).toContain('<svg');
      expect(svg).toContain(tier.ring);
      expect(svg).toContain(tier.glow);
      expect(svg).toContain('radialGradient');
      // The gradient must be both defined and actually referenced by a disc fill,
      // or the medal renders as an unfilled/black circle while the test stays green.
      // The id is per-tier so inlined medals don't collide.
      expect(svg).toContain(`id="g${tier.key}"`);
      expect(svg).toContain(`fill="url(#g${tier.key})"`);
      expect(svg).toContain('<circle');
    }
  });

  it('gives each tier a DISTINCT gradient id so inlined medals never collide', () => {
    const ids = PERCENTILE_TIERS.map((t) => {
      const svg = decodeURIComponent(percentileTierBadgeDataUrl(t));
      return svg.match(/id="(g[^"]+)"/)?.[1];
    });
    expect(new Set(ids).size).toBe(PERCENTILE_TIERS.length);
  });

  it('honours the requested pixel size while keeping the 0 0 64 64 viewBox', () => {
    const url = percentileTierBadgeDataUrl(PERCENTILE_TIERS[0], 256);
    const svg = decodeURIComponent(url);
    expect(svg).toContain('width="256" height="256"');
    expect(svg).toContain('viewBox="0 0 64 64"');
  });
});
