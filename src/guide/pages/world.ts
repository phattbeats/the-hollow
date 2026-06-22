// World / zones: the world overview plus a card per zone, from sim zone data
// (name, level band, hub) with a curated, spoiler-safe blurb.

import { t, formatNumber, type TranslationKey } from '../../ui/i18n';
import { esc } from '../../ui/esc';
import { GUIDE_ZONES } from '../content.generated';
import { lead } from './ui';
import type { GuidePage } from './types';

// Zones come south to north; blurbs are keyed to that order.
const BLURBS: TranslationKey[] = ['guide.worldPage.valeBlurb', 'guide.worldPage.marshBlurb', 'guide.worldPage.peaksBlurb'];

export const world: GuidePage = {
  titleKey: 'guide.nav.world',
  render() {
    const cards = GUIDE_ZONES
      .map((z, i) => `
        <section class="guide-zone-card guide-zone-${esc(z.biome)}">
          <div class="guide-zone-body">
            <span class="guide-zone-band">${esc(t('guide.home.world.levels', { min: formatNumber(z.min), max: formatNumber(z.max) }))}</span>
            <h2 class="guide-zone-name">${esc(z.name)}</h2>
            <p class="guide-zone-blurb">${esc(t(BLURBS[i] ?? BLURBS[0]))}</p>
            ${z.hub ? `<p class="guide-zone-hub"><span>${esc(t('guide.worldPage.hub'))}:</span> ${esc(z.hub)}</p>` : ''}
          </div>
        </section>`)
      .join('');
    return `
      <article class="guide-article guide-world">
        <h1>${esc(t('guide.worldPage.heading'))}</h1>
        ${lead('guide.worldPage.intro')}
        <div class="guide-zone-grid">${cards}</div>
      </article>`;
  },
};
