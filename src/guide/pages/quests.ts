// Quests: how the quest loop works, plus a spoiler-safe story hook (the early thread,
// not its resolution).

import { t } from '../../ui/i18n';
import { esc } from '../../ui/esc';
import { lead } from './ui';
import type { GuidePage } from './types';

const STEPS = [
  ['guide.questsPage.acceptTitle', 'guide.questsPage.acceptBody'],
  ['guide.questsPage.objectivesTitle', 'guide.questsPage.objectivesBody'],
  ['guide.questsPage.turninTitle', 'guide.questsPage.turninBody'],
  ['guide.questsPage.partyTitle', 'guide.questsPage.partyBody'],
] as const;

export const quests: GuidePage = {
  titleKey: 'guide.nav.quests',
  render() {
    const blocks = STEPS
      .map(([title, body]) => `<section class="guide-block"><h2>${esc(t(title))}</h2><p>${esc(t(body))}</p></section>`)
      .join('');
    return `
      <article class="guide-article">
        <h1>${esc(t('guide.questsPage.heading'))}</h1>
        ${lead('guide.questsPage.intro')}
        ${blocks}
        <section class="guide-block">
          <h2>${esc(t('guide.questsPage.storyTitle'))}</h2>
          <p>${esc(t('guide.questsPage.storyBody'))}</p>
          <p class="guide-callout">${esc(t('guide.questsPage.soloNote'))}</p>
        </section>
      </article>`;
  },
};
