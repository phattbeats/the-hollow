// Bestiary: overworld creatures grouped by family, with procedural family crests.
// Data is generated from the per-zone mob lists (content.generated.ts), which excludes
// elite/boss and summoned creatures, so dungeon and raid encounters never appear here.

import { t, formatNumber, type TranslationKey } from '../../ui/i18n';
import { esc } from '../../ui/esc';
import { iconDataUrl } from '../../ui/icons';
import { GUIDE_FAMILIES, type GuideCreature } from '../content.generated';
import { lead } from './ui';
import type { GuidePage } from './types';

const familyCrest = (family: string): string => iconDataUrl('crest', `family_${family}`, 96);

function band(c: GuideCreature): string {
  return c.min === c.max
    ? t('guide.bestiary.levelsSame', { min: formatNumber(c.min) })
    : t('guide.bestiary.levels', { min: formatNumber(c.min), max: formatNumber(c.max) });
}

function creatureRow(c: GuideCreature): string {
  const rare = c.rare ? `<span class="guide-badge guide-badge-rare">${esc(t('guide.bestiary.rare'))}</span>` : '';
  return `<li class="guide-creature">
    <span class="guide-creature-name">${esc(c.name)}${rare}</span>
    <span class="guide-creature-band">${esc(band(c))}</span>
  </li>`;
}

export const bestiary: GuidePage = {
  titleKey: 'guide.nav.bestiary',
  render() {
    const sections = GUIDE_FAMILIES
      .map((f) => {
        const nameKey = `guide.family.${f.family}.name` as TranslationKey;
        const descKey = `guide.family.${f.family}.desc` as TranslationKey;
        return `
          <section class="guide-family">
            <div class="guide-family-head">
              <img class="guide-family-crest" src="${esc(familyCrest(f.family))}" alt="" width="56" height="56" loading="lazy" decoding="async" />
              <div>
                <h2 class="guide-family-name">${esc(t(nameKey))}</h2>
                <p class="guide-family-desc">${esc(t(descKey))}</p>
              </div>
            </div>
            <ul class="guide-creatures">${f.creatures.map(creatureRow).join('')}</ul>
          </section>`;
      })
      .join('');
    return `
      <article class="guide-article guide-bestiary">
        <h1>${esc(t('guide.bestiary.heading'))}</h1>
        ${lead('guide.bestiary.intro')}
        ${sections}
      </article>`;
  },
};
