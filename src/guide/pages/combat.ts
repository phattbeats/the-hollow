// Combat overview. High level by design: concepts only, no formulas, coefficients, or
// numbers, so there is nothing here to min-max or exploit (WoW-style altitude).

import { t, formatNumber } from '../../ui/i18n';
import { esc } from '../../ui/esc';
import { lead } from './ui';
import { LEVEL_CAP } from '../data';
import type { GuidePage } from './types';

const BLOCKS = [
  ['guide.combat.hitTitle', 'guide.combat.hitBody'],
  ['guide.combat.mitigationTitle', 'guide.combat.mitigationBody'],
  ['guide.combat.resourcesTitle', 'guide.combat.resourcesBody'],
] as const;

export const combat: GuidePage = {
  titleKey: 'guide.nav.combat',
  render() {
    const blocks = BLOCKS
      .map(([title, body]) => `<section class="guide-block"><h2>${esc(t(title))}</h2><p>${esc(t(body))}</p></section>`)
      .join('');
    return `
      <article class="guide-article">
        <h1>${esc(t('guide.nav.combat'))}</h1>
        ${lead('guide.combat.intro')}
        ${blocks}
        <section class="guide-block">
          <h2>${esc(t('guide.combat.growTitle'))}</h2>
          <p>${esc(t('guide.combat.growBody', { cap: formatNumber(LEVEL_CAP) }))}</p>
        </section>
      </article>`;
  },
};
