// The Hollow: the sealed hub every new arrival lands in (the vase, the two hub NPCs, the
// first quest chain, housing, and the Under-Shrine). NPCs and quest names are generated
// from the sim (content/hollow.ts) so they never drift; the flavor bodies are curated
// guide copy, keyed by id like dungeons.ts's BODY map. Spoiler-safe: no coordinates,
// balance numbers, or the Under-Shrine's own boss name.

import { esc } from '../../ui/esc';
import { formatNumber, type TranslationKey, t } from '../../ui/i18n';
import { GUIDE_HOLLOW_HUB, type GuideHollowNpc, type GuideHollowQuest } from '../content.generated';
import { hrefFor } from '../routes';
import type { GuidePage } from './types';
import { loreQuote, p, pageHeader, related, section } from './ui';

const NPC_BODY: Record<string, TranslationKey> = {
  brother_greenpaw: 'guide.hollowPage.greenpawBody',
  elder_yarrow: 'guide.hollowPage.yarrowBody',
};

function npcFigure(n: GuideHollowNpc): string {
  const bodyKey = NPC_BODY[n.id];
  if (!bodyKey) return '';
  const label = n.title ? t('guide.hollowPage.npcFmt', { name: n.name, title: n.title }) : n.name;
  return `<div class="guide-figure">
    <div class="guide-figure-head">
      <span class="guide-figure-name">${esc(label)}</span>
    </div>
    <p class="guide-figure-line">${esc(t(bodyKey))}</p>
  </div>`;
}

const QUEST_BODY: Record<string, TranslationKey> = {
  q_what_burns: 'guide.hollowPage.questBurnsBody',
  q_what_fills: 'guide.hollowPage.questFillsBody',
  q_the_wavelength: 'guide.hollowPage.questWavelengthBody',
  q_keep_him_lit: 'guide.hollowPage.questKeepLitBody',
};

function questBeat(q: GuideHollowQuest): string {
  const bodyKey = QUEST_BODY[q.id];
  if (!bodyKey) return '';
  return `<div class="guide-beat"><h3 class="guide-beat-h">${esc(q.name)}</h3><p>${esc(t(bodyKey))}</p></div>`;
}

export const hollow: GuidePage = {
  titleKey: 'guide.nav.hollow',
  render() {
    const figures = GUIDE_HOLLOW_HUB.npcs.map(npcFigure).join('');
    const beats = GUIDE_HOLLOW_HUB.quests.map(questBeat).join('');
    const shrine = GUIDE_HOLLOW_HUB.underShrine;
    const shrineLevel =
      shrine.min != null && shrine.max != null
        ? t('guide.dungeonsPage.levelBand', {
            min: formatNumber(shrine.min),
            max: formatNumber(shrine.max),
          })
        : '';
    return `
      <article class="guide-article guide-hollow">
        ${pageHeader('guide.hollowPage.heading', 'guide.hollowPage.intro')}
        ${loreQuote('guide.hollowPage.greeting', t('guide.hollowPage.greeter'))}

        ${section('guide.hollowPage.vaseHeading', p('guide.hollowPage.vaseBody'))}

        ${section('guide.hollowPage.outsiderHeading', p('guide.hollowPage.outsiderBody'))}

        <section class="guide-block">
          <h2>${esc(t('guide.hollowPage.figuresHeading'))}</h2>
          <p>${esc(t('guide.hollowPage.figuresBody'))}</p>
          <div class="guide-figures">${figures}</div>
        </section>

        <section class="guide-block">
          <h2>${esc(t('guide.hollowPage.questsHeading'))}</h2>
          <p>${esc(t('guide.hollowPage.questsBody'))}</p>
          <div class="guide-beat-grid">${beats}</div>
        </section>

        ${section(
          'guide.hollowPage.housingHeading',
          `<p>${esc(t('guide.hollowPage.housingBody', { n: formatNumber(GUIDE_HOLLOW_HUB.housePlots) }))}</p>`,
        )}

        <section class="guide-block">
          <h2>${esc(t('guide.hollowPage.shrineHeading'))}</h2>
          <p>${esc(t('guide.hollowPage.shrineBody'))}</p>
          <section class="guide-dungeon-card">
            <div class="guide-dungeon-head">
              <h3 class="guide-dungeon-name">${esc(shrine.name)}</h3>
              ${shrineLevel ? `<span class="guide-badge guide-badge-level">${esc(shrineLevel)}</span>` : ''}
            </div>
            <p class="guide-dungeon-meta">${esc(t('guide.dungeonsPage.partySize', { n: formatNumber(shrine.suggestedPlayers) }))}</p>
          </section>
        </section>

        ${related([
          { href: hrefFor('world'), key: 'guide.nav.world' },
          { href: hrefFor('quests'), key: 'guide.nav.quests' },
          { href: hrefFor('dungeons'), key: 'guide.nav.dungeons' },
          { href: hrefFor('professions'), key: 'guide.nav.professions' },
        ])}
      </article>`;
  },
};
