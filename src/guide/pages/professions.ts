// Professions and multiclassing: the secondary-class system (GW1 build system,
// Phase 3, PHAA-464/465/466). A spoiler-safe explainer for the public wiki: what a
// secondary profession is, the level-10 gate, the dual-tree talent split with the
// shared pool and its half cap, the escalating respec gold cost, and where the
// Profession Trainer NPC lives. No balance numbers, no mechanic names, no loot.
//
// It mirrors the in-game "How do secondary professions work?" copy
// (questUi.dialog.trainerHowBody) so the guide and the trainer panel agree, and it
// cross-links the Classes and Talents pages. Pure prose from `guide.*` t() keys; no
// generated content, no DOM hooks (it is a static article).

import { esc } from '../../ui/esc';
import { t } from '../../ui/i18n';
import { hrefFor } from '../routes';
import type { GuidePage } from './types';
import { callout, p, pageHeader, related, section } from './ui';

export const professions: GuidePage = {
  titleKey: 'guide.nav.professions',
  render() {
    return `
      <article class="guide-article guide-professions">
        ${pageHeader('guide.professionsPage.heading', 'guide.professionsPage.intro')}
        ${section('guide.professionsPage.whatHeading', p('guide.professionsPage.whatBody'))}
        ${section(
          'guide.professionsPage.howHeading',
          p('guide.professionsPage.howBody') + p('guide.professionsPage.costBody'),
        )}
        ${callout(esc(t('guide.professionsPage.resetNote')), {
          variant: 'note',
          titleKey: 'guide.professionsPage.resetTitle',
        })}
        ${section('guide.professionsPage.talentsHeading', p('guide.professionsPage.talentsBody'))}
        ${section('guide.professionsPage.trainersHeading', p('guide.professionsPage.trainersBody'))}
        ${related([
          { href: hrefFor('classes'), key: 'guide.nav.classes' },
          { href: hrefFor('reference/talents'), key: 'guide.nav.talents' },
          { href: hrefFor('how-to-play'), key: 'guide.nav.howToPlay' },
        ])}
      </article>`;
  },
};
