// TEMPORARY (Phase 3). The 13 non-English locales are now flat dotted-key overlays
// (src/ui/i18n.locales/<lang>.ts, `Record<string, string>`). This phase keeps them
// DENSE: every overlay must carry exactly the leaf set of the authoritative nested
// `en`, with string values. That is the type guarantee tsc cannot give here -
// `Record<TranslationKey, string>` can't type the overlays because
// `TranslationKey = Leaves<typeof en, 5>` stops at depth 5 while the deepest real
// leaves (entities.quests.<id>.objectives.0.label) are 6 segments deep - so a test
// enforces it instead (the phase invariant: a typo'd dotted key must fail tsc OR a
// test). Phase 6 relaxes the overlays to sparse and this dense check is replaced by
// the registry-driven coverage gate; delete it then.

import { describe, expect, it } from 'vitest';
import { en } from '../src/ui/i18n.en';
import { es } from '../src/ui/i18n.locales/es';
import { es_ES } from '../src/ui/i18n.locales/es_ES';
import { fr_FR } from '../src/ui/i18n.locales/fr_FR';
import { fr_CA } from '../src/ui/i18n.locales/fr_CA';
import { en_CA } from '../src/ui/i18n.locales/en_CA';
import { it_IT } from '../src/ui/i18n.locales/it_IT';
import { de_DE } from '../src/ui/i18n.locales/de_DE';
import { zh_CN } from '../src/ui/i18n.locales/zh_CN';
import { zh_TW } from '../src/ui/i18n.locales/zh_TW';
import { ko_KR } from '../src/ui/i18n.locales/ko_KR';
import { ja_JP } from '../src/ui/i18n.locales/ja_JP';
import { pt_BR } from '../src/ui/i18n.locales/pt_BR';
import { ru_RU } from '../src/ui/i18n.locales/ru_RU';

// Recurse into plain objects only (arrays/non-objects are leaves) - the same
// object-vs-leaf rule scripts/i18n_flatten.mjs and the build's deepMerge use.
function flatten(node: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const key of Object.keys(node as Record<string, unknown>)) {
    const value = (node as Record<string, unknown>)[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out[path] = value;
    }
  }
  return out;
}

const overlays: Record<string, Record<string, string>> = {
  es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE,
  zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU,
};

describe('flat locale overlays are dense and key-exact against en', () => {
  const enKeys = Object.keys(flatten(en)).sort();

  it('en has a non-trivial leaf set', () => {
    expect(enKeys.length).toBeGreaterThan(1000);
  });

  for (const [lang, overlay] of Object.entries(overlays)) {
    it(`${lang}: key set exactly equals en's leaf set (dense, no typo'd/extra keys)`, () => {
      expect(Object.keys(overlay).sort()).toEqual(enKeys);
    });

    it(`${lang}: every value is a non-empty string`, () => {
      const bad = Object.entries(overlay).filter(([, v]) => typeof v !== 'string' || v.length === 0);
      expect(bad.map(([k]) => k)).toEqual([]);
    });
  }
});
