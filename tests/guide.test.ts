import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  matchRoute, toSub, topbarRoutes, groupedRoutes, hrefFor, GUIDE_ROUTES, GUIDE_BASE,
} from '../src/guide/routes';
import { GUIDE_CLASSES } from '../src/guide/content.generated';
import { t, setLanguage } from '../src/ui/i18n';

const guideHtml = readFileSync(new URL('../guide.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const serverMain = readFileSync(new URL('../server/main.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sitemapXml = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('Guide routes', () => {
  it('treats the base and empty sub as the home route', () => {
    expect(matchRoute('/guide')?.route.id).toBe('home');
    expect(matchRoute('/guide/')?.route.id).toBe('home');
    expect(toSub('/guide/classes/')).toBe('classes');
    expect(toSub('/guide')).toBe('');
  });

  it('matches static section routes exactly', () => {
    expect(matchRoute('/guide/classes')?.route.id).toBe('classes');
    expect(matchRoute('/guide/how-to-play')?.route.id).toBe('how-to-play');
    expect(matchRoute('/guide/reference/controls')?.route.id).toBe('controls');
  });

  it('claims deeper segments as params (class/creature detail pages)', () => {
    const m = matchRoute('/guide/classes/warrior');
    expect(m?.route.id).toBe('classes');
    expect(m?.params).toEqual(['warrior']);
  });

  it('returns null for unknown paths so the app can render notFound', () => {
    expect(matchRoute('/guide/nonexistent')).toBeNull();
  });

  it('derives nav from the single route list', () => {
    expect(topbarRoutes().some((r) => r.id === 'classes')).toBe(true);
    expect(topbarRoutes().some((r) => r.id === 'home')).toBe(false);
    const groups = groupedRoutes();
    expect(groups.map((g) => g.group)).toEqual(['start', 'compendium', 'reference']);
    expect(hrefFor('')).toBe(GUIDE_BASE);
    expect(hrefFor('classes')).toBe('/guide/classes');
  });

  it('keeps every route nav label resolvable as an English t() key', () => {
    setLanguage('en');
    for (const r of GUIDE_ROUTES) {
      expect(typeof t(r.navKey)).toBe('string');
      expect(t(r.navKey).length).toBeGreaterThan(0);
    }
    expect(t('guide.nav.playNow')).toBe('Play Now');
    expect(t('guide.skipToContent')).toBe('Skip to main content');
  });
});

describe('Guide entry wiring', () => {
  it('registers the /guide pretty URL in BOTH alias tables (kept in sync)', () => {
    expect(viteConfig).toContain("['/guide', '/guide.html']");
    expect(serverMain).toContain("['/guide', '/guide.html']");
  });

  it('falls back deep /guide paths to the guide shell in dev and prod', () => {
    expect(viteConfig).toContain('isGuideSpaPath');
    expect(serverMain).toContain("const isGuide = urlPath === '/guide' || urlPath.startsWith('/guide/');");
    expect(serverMain).toContain("isGuide ? 'guide.html'");
  });

  it('ships the guide as its own Vite build entry', () => {
    expect(viteConfig).toContain("guide: fileURLToPath(new URL('guide.html', import.meta.url))");
  });

  it('lists the guide in the sitemap', () => {
    expect(sitemapXml).toContain('<loc>https://worldofclaudecraft.com/guide</loc>');
  });
});

describe('guide.html shell', () => {
  it('allows pinch-zoom and user scaling (WCAG), unlike the locked game viewport', () => {
    expect(guideHtml).toContain('name="viewport"');
    expect(guideHtml).not.toContain('user-scalable=no');
    expect(guideHtml).not.toContain('maximum-scale=1.0');
  });

  it('ships crawlable canonical + social metadata for /guide', () => {
    expect(guideHtml).toContain('<link rel="canonical" href="https://worldofclaudecraft.com/guide" />');
    expect(guideHtml).toContain('<meta property="og:url" content="https://worldofclaudecraft.com/guide" />');
    expect(guideHtml).toContain('content="index, follow, max-image-preview:large"');
  });

  it('loads the guide client module and a noscript fallback', () => {
    expect(guideHtml).toContain('<script type="module" src="/src/guide/main.ts"></script>');
    expect(guideHtml).toContain('<noscript>');
  });
});

describe('Guide generated class content', () => {
  it('covers all nine classes with grounded data', () => {
    expect(GUIDE_CLASSES).toHaveLength(9);
    for (const c of GUIDE_CLASSES) {
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(['rage', 'mana', 'energy']).toContain(c.resource);
      expect(c.roles.length).toBeGreaterThan(0);
      expect(c.specs.length).toBeGreaterThan(0);
      expect(c.signatureAbilities.length).toBeGreaterThan(0);
      for (const s of c.specs) expect(['tank', 'healer', 'dps']).toContain(s.role);
      // every class nav name resolves
      expect(t(`classes.${c.id}` as never).length).toBeGreaterThan(0);
      expect(t(`guide.classHook.${c.id}` as never).length).toBeGreaterThan(0);
    }
  });

  it('matches the sim (regenerating leaves the committed file unchanged)', () => {
    execFileSync('node', ['scripts/wiki/build_content.mjs'], { cwd: new URL('..', import.meta.url) });
    // No diff means the committed content is derived from the current sim data.
    expect(() =>
      execFileSync('git', ['diff', '--exit-code', '--', 'src/guide/content.generated.ts'], {
        cwd: new URL('..', import.meta.url),
        encoding: 'utf8',
      }),
    ).not.toThrow();
  });
});
