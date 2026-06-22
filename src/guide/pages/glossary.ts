// Glossary: short, plain definitions of the terms used across the guide and in chat.

import { t, type TranslationKey } from '../../ui/i18n';
import { esc } from '../../ui/esc';
import { lead } from './ui';
import type { GuidePage } from './types';

const TERMS: [TranslationKey, TranslationKey][] = [
  ['guide.glossary.aggroTerm', 'guide.glossary.aggroDef'],
  ['guide.glossary.gcdTerm', 'guide.glossary.gcdDef'],
  ['guide.glossary.dpsTerm', 'guide.glossary.dpsDef'],
  ['guide.glossary.eliteTerm', 'guide.glossary.eliteDef'],
  ['guide.glossary.rareTerm', 'guide.glossary.rareDef'],
  ['guide.glossary.tankTerm', 'guide.glossary.tankDef'],
  ['guide.glossary.healerTerm', 'guide.glossary.healerDef'],
  ['guide.glossary.pullTerm', 'guide.glossary.pullDef'],
  ['guide.glossary.instanceTerm', 'guide.glossary.instanceDef'],
];

export const glossary: GuidePage = {
  titleKey: 'guide.nav.glossary',
  render() {
    const items = TERMS
      .map(([term, def]) => `<div class="guide-term"><dt>${esc(t(term))}</dt><dd>${esc(t(def))}</dd></div>`)
      .join('');
    return `
      <article class="guide-article">
        <h1>${esc(t('guide.nav.glossary'))}</h1>
        ${lead('guide.glossary.intro')}
        <dl class="guide-glossary">${items}</dl>
      </article>`;
  },
};
