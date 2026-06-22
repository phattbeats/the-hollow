// Single source of truth for the Guide's routes and navigation. Pure data + pure
// helpers (no DOM), so the router, the nav chrome, and tests all derive from one list.
// The Guide is a client-rendered SPA mounted at GUIDE_BASE; deep paths (/guide/classes)
// fall back to guide.html in both vite.config.ts and server/main.ts.

import type { TranslationKey } from '../ui/i18n';

export const GUIDE_BASE = '/guide';

// Sidebar groupings, in display order.
export type GuideGroup = 'start' | 'compendium' | 'reference';
export const GUIDE_GROUP_ORDER: GuideGroup[] = ['start', 'compendium', 'reference'];

export interface GuideRoute {
  /** Stable id, also the page-registry key. */
  id: string;
  /** Path after GUIDE_BASE. '' is the home/overview landing. */
  sub: string;
  /** i18n key for the nav label and the page title. */
  navKey: TranslationKey;
  /** Sidebar group, or null for pages reached another way (home). */
  group: GuideGroup | null;
  /** Appears in the top navigation bar. */
  topbar?: boolean;
}

// Static top-level routes. Dynamic entries (per class, per creature family) are
// layered on later phases via resolveDynamic(); unknown paths render notFound.
export const GUIDE_ROUTES: GuideRoute[] = [
  { id: 'home', sub: '', navKey: 'guide.nav.overview', group: null, topbar: true },
  { id: 'how-to-play', sub: 'how-to-play', navKey: 'guide.nav.howToPlay', group: 'start', topbar: true },
  { id: 'wish-i-knew', sub: 'wish-i-knew', navKey: 'guide.nav.wishIKnew', group: 'start' },
  { id: 'faq', sub: 'faq', navKey: 'guide.nav.faq', group: 'start' },
  { id: 'social', sub: 'social', navKey: 'guide.nav.social', group: 'start' },
  { id: 'classes', sub: 'classes', navKey: 'guide.nav.classes', group: 'compendium', topbar: true },
  { id: 'bestiary', sub: 'bestiary', navKey: 'guide.nav.bestiary', group: 'compendium', topbar: true },
  { id: 'models', sub: 'models', navKey: 'guide.nav.models', group: 'compendium' },
  { id: 'world', sub: 'world', navKey: 'guide.nav.world', group: 'compendium', topbar: true },
  { id: 'gear', sub: 'gear', navKey: 'guide.nav.gear', group: 'compendium' },
  { id: 'economy', sub: 'economy', navKey: 'guide.nav.economy', group: 'compendium' },
  { id: 'quests', sub: 'quests', navKey: 'guide.nav.quests', group: 'compendium' },
  { id: 'dungeons', sub: 'dungeons', navKey: 'guide.nav.dungeons', group: 'compendium' },
  { id: 'arena', sub: 'arena', navKey: 'guide.nav.arena', group: 'compendium' },
  { id: 'controls', sub: 'reference/controls', navKey: 'guide.nav.controls', group: 'reference' },
  { id: 'combat', sub: 'reference/combat', navKey: 'guide.nav.combat', group: 'reference' },
  { id: 'stats', sub: 'reference/stats', navKey: 'guide.nav.stats', group: 'reference' },
  { id: 'progression', sub: 'reference/progression', navKey: 'guide.nav.progression', group: 'reference' },
  { id: 'talents', sub: 'reference/talents', navKey: 'guide.nav.talents', group: 'reference' },
  { id: 'glossary', sub: 'reference/glossary', navKey: 'guide.nav.glossary', group: 'reference' },
];

export interface RouteMatch {
  route: GuideRoute;
  /** Path segments after the matched route, e.g. ['warrior'] for /guide/classes/warrior. */
  params: string[];
}

/** Normalize a browser pathname to the Guide sub-path ('' for the landing). */
export function toSub(pathname: string): string {
  // Drop any #hash or ?query so an in-page anchor (e.g. /guide/classes#kit) still
  // resolves to its route; the hash is handled separately for scroll/focus.
  let p = pathname.split('#')[0].split('?')[0];
  if (p.startsWith(GUIDE_BASE)) p = p.slice(GUIDE_BASE.length);
  // Strip leading and trailing slashes; collapse to a clean 'a/b' form.
  return p.replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * Match a pathname to a route. Prefers the longest exact sub match; a route may also
 * claim deeper segments as params (e.g. 'classes' matches 'classes/warrior' with
 * params ['warrior']). Returns null when nothing matches (caller renders notFound).
 */
export function matchRoute(pathname: string): RouteMatch | null {
  const sub = toSub(pathname);
  if (sub === '') return { route: GUIDE_ROUTES[0], params: [] };

  // Exact match first.
  const exact = GUIDE_ROUTES.find((r) => r.sub === sub);
  if (exact) return { route: exact, params: [] };

  // Prefix match: the route whose sub is the longest prefix of the path.
  const segs = sub.split('/');
  let best: GuideRoute | null = null;
  for (const r of GUIDE_ROUTES) {
    if (!r.sub) continue;
    const rSegs = r.sub.split('/');
    const isPrefix = rSegs.every((s, i) => segs[i] === s);
    if (isPrefix && (!best || r.sub.length > best.sub.length)) best = r;
  }
  if (best) {
    const depth = best.sub.split('/').length;
    return { route: best, params: segs.slice(depth) };
  }
  return null;
}

/** Top navigation bar entries, in order. */
export function topbarRoutes(): GuideRoute[] {
  return GUIDE_ROUTES.filter((r) => r.topbar && r.id !== 'home');
}

/** Sidebar entries grouped by section, preserving declaration order. */
export function groupedRoutes(): { group: GuideGroup; routes: GuideRoute[] }[] {
  return GUIDE_GROUP_ORDER.map((group) => ({
    group,
    routes: GUIDE_ROUTES.filter((r) => r.group === group),
  })).filter((g) => g.routes.length > 0);
}

/** Absolute href for a route sub-path. */
export function hrefFor(sub: string): string {
  return sub ? `${GUIDE_BASE}/${sub}` : GUIDE_BASE;
}
