// Small shared building blocks for Guide article pages. Keeps page modules to content
// (which t() keys go where) rather than repeated markup. All text is a t() key via esc.

import { t, type TranslationKey } from '../../ui/i18n';
import { esc } from '../../ui/esc';

export function lead(key: TranslationKey): string {
  return `<p class="guide-lead">${esc(t(key))}</p>`;
}

export function section(headingKey: TranslationKey, bodyHtml: string): string {
  return `<section class="guide-block"><h2>${esc(t(headingKey))}</h2>${bodyHtml}</section>`;
}

export function p(key: TranslationKey): string {
  return `<p>${esc(t(key))}</p>`;
}

// An opt-in disclosure (theorycraft, spoilers, walkthroughs) with a neutral label.
export function reveal(summaryKey: TranslationKey, innerHtml: string): string {
  return `<details class="guide-reveal"><summary>${esc(t(summaryKey))}</summary><div class="guide-reveal-body">${innerHtml}</div></details>`;
}
