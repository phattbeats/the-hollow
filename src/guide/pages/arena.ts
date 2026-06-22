// Arena and PvP: a spoiler-safe overview of player versus player, the Ashen Coliseum,
// the two versus two Fiesta augment mode, and the ladder. Concepts only, no ratings math,
// augment numbers, or matchmaking internals.

import { t } from '../../ui/i18n';
import { esc } from '../../ui/esc';
import { hrefFor } from '../routes';
import { pageHeader, section, callout, related } from './ui';
import type { GuidePage } from './types';

export const arena: GuidePage = {
  titleKey: 'guide.nav.arena',
  render() {
    return `
      <article class="guide-article guide-arena">
        ${pageHeader('guide.arenaPage.heading', 'guide.arenaPage.intro')}
        ${section('guide.arenaPage.duelsHeading', `<p>${esc(t('guide.arenaPage.duelsBody'))}</p>`)}
        ${section('guide.arenaPage.coliseumHeading', `<p>${esc(t('guide.arenaPage.coliseumBody'))}</p>`)}
        ${section('guide.arenaPage.fiestaHeading', `<p>${esc(t('guide.arenaPage.fiestaBody'))}</p>${callout(esc(t('guide.arenaPage.augmentsNote')), { variant: 'note' })}`)}
        ${section('guide.arenaPage.ladderHeading', `<p>${esc(t('guide.arenaPage.ladderBody'))}</p>`)}
        ${related([
          { href: hrefFor('dungeons'), key: 'guide.nav.dungeons' },
          { href: hrefFor('classes'), key: 'guide.nav.classes' },
          { href: hrefFor('reference/combat'), key: 'guide.nav.combat' },
        ])}
      </article>`;
  },
};
