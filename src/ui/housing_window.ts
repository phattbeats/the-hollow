// Thin DOM consumer for the homestead placement window (housing v0 interact
// flow, PHAA-405). Mirrors vendor_window.ts's pure-core + thin-consumer split:
// buildHousingWindowView (housing_view.ts) decides slot/kind structure; this
// paints #housing-window and wires place/clear/close.

import type { HouseObjectKind } from '../sim/content/hollow';
import { esc } from './esc';
import type { HousingWindowView } from './housing_view';
import { type TranslationKey, t } from './i18n';
import { svgIcon } from './ui_icons';

export interface HousingWindowDeps {
  onPlace(slot: number, kind: HouseObjectKind): void;
  onClear(slot: number): void;
  onClose(): void;
}

const DECOR_KEY: Record<HouseObjectKind, TranslationKey> = {
  planter: 'housingUi.decor.planter',
  lantern: 'housingUi.decor.lantern',
  crate: 'housingUi.decor.crate',
  bench: 'housingUi.decor.bench',
  stool: 'housingUi.decor.stool',
};

function decorName(kind: HouseObjectKind | null): string {
  return kind ? t(DECOR_KEY[kind]) : t('housingUi.window.slotEmpty');
}

/** Paint the homestead placement panel from a prepared view. */
export function renderHousingWindow(
  el: HTMLElement,
  view: HousingWindowView,
  deps: HousingWindowDeps,
): void {
  el.innerHTML = `<div class="panel-title"><span>${esc(t('housingUi.window.title'))}</span><button type="button" class="x-btn" data-close aria-label="${esc(t('housingUi.window.close'))}">${svgIcon('close')}</button></div>`;

  for (const row of view.slots) {
    const wrap = document.createElement('div');
    wrap.className = 'vendor-section-title';
    wrap.textContent = `${row.slot + 1}. ${decorName(row.kind)}`;
    el.appendChild(wrap);

    const kindRow = document.createElement('div');
    for (const kind of view.kinds) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vendor-item';
      btn.textContent = t(DECOR_KEY[kind]);
      btn.setAttribute(
        'aria-label',
        t('housingUi.window.placeAria', { decor: t(DECOR_KEY[kind]), slot: row.slot + 1 }),
      );
      btn.addEventListener('click', () => deps.onPlace(row.slot, kind));
      kindRow.appendChild(btn);
    }
    if (row.kind !== null) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'vendor-item';
      clear.textContent = t('housingUi.window.clear');
      clear.setAttribute('aria-label', t('housingUi.window.clearAria', { slot: row.slot + 1 }));
      clear.addEventListener('click', () => deps.onClear(row.slot));
      kindRow.appendChild(clear);
    }
    el.appendChild(kindRow);
  }

  const hint = document.createElement('div');
  hint.className = 'vendor-hint';
  hint.textContent = t('housingUi.window.hint');
  el.appendChild(hint);

  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
}
