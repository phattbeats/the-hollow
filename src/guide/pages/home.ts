// Home / overview landing. Phase 00 ships a minimal hero so the scaffold renders the
// real design language; the full landing (teasers, FAQ, community) lands next phase.

import { t } from '../../ui/i18n';
import { esc } from '../../ui/esc';
import type { GuidePage } from './types';

export const home: GuidePage = {
  titleKey: 'guide.home.title',
  render() {
    return `
    <section class="guide-hero" aria-labelledby="guide-hero-title">
      <div class="guide-hero-inner">
        <p class="guide-eyebrow">${esc(t('guide.home.eyebrow'))}</p>
        <h1 class="guide-hero-title" id="guide-hero-title">${esc(t('guide.home.title'))}</h1>
        <p class="guide-hero-sub">${esc(t('guide.home.subtitle'))}</p>
        <div class="guide-hero-cta">
          <a class="guide-cta" href="/play">${esc(t('guide.home.ctaPlay'))}</a>
          <a class="guide-cta guide-cta-ghost" href="/guide/how-to-play">${esc(t('guide.home.ctaLearn'))}</a>
        </div>
      </div>
    </section>`;
  },
};
