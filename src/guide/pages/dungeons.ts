// Dungeons and Raids: group-content overview plus teaser cards. Thematic only, no boss
// scripts, timers, or loot. The endgame raid is teased without naming its boss.

import { t, formatNumber } from '../../ui/i18n';
import { esc } from '../../ui/esc';
import { lead } from './ui';
import type { GuidePage } from './types';

export const dungeons: GuidePage = {
  titleKey: 'guide.nav.dungeons',
  render() {
    // Recompute per render so a language switch re-localizes the level labels.
    const cards = ([
      { nameKey: 'guide.dungeonsPage.hollowName', bodyKey: 'guide.dungeonsPage.hollowBody', level: t('guide.dungeonsPage.levelAround', { n: formatNumber(10) }), raid: false },
      { nameKey: 'guide.dungeonsPage.bastionName', bodyKey: 'guide.dungeonsPage.bastionBody', level: t('guide.dungeonsPage.levelAround', { n: formatNumber(13) }), raid: false },
      { nameKey: 'guide.dungeonsPage.templeName', bodyKey: 'guide.dungeonsPage.templeBody', level: t('guide.dungeonsPage.levelAround', { n: formatNumber(17) }), raid: false },
      { nameKey: 'guide.dungeonsPage.sanctumName', bodyKey: 'guide.dungeonsPage.sanctumBody', level: t('guide.dungeonsPage.levelExact', { n: formatNumber(20) }), raid: false },
      { nameKey: 'guide.dungeonsPage.raidName', bodyKey: 'guide.dungeonsPage.raidBody', level: t('guide.dungeonsPage.raidSize', { n: formatNumber(20) }), raid: true },
    ] as const)
      .map((c) => `
        <section class="guide-dungeon-card${c.raid ? ' guide-dungeon-raid' : ''}">
          <div class="guide-dungeon-head">
            <h2 class="guide-dungeon-name">${esc(t(c.nameKey))}</h2>
            <span class="guide-badge guide-badge-level">${esc(c.level)}</span>
          </div>
          <p>${esc(t(c.bodyKey))}</p>
        </section>`)
      .join('');
    return `
      <article class="guide-article guide-dungeons">
        <h1>${esc(t('guide.dungeonsPage.heading'))}</h1>
        ${lead('guide.dungeonsPage.intro')}
        <p>${esc(t('guide.dungeonsPage.party'))}</p>
        <p class="guide-callout">${esc(t('guide.dungeonsPage.soloLead'))}</p>
        <div class="guide-dungeon-grid">${cards}</div>
      </article>`;
  },
};
