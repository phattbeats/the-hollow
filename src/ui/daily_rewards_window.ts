// Thin DOM consumer for the Daily Rewards window (PHAA-660).
//
// The consumer half of the pure-core + thin-consumer split (daily_rewards_view.ts
// is the pure core). A rebuild-on-open window like Vendor, not a per-frame hot
// painter, so it follows vendor_window.ts's plain-innerHTML-rebuild shape rather
// than the write-elision facet (that contract is for Hud.update()'s 60fps path).

import type { ItemDef } from '../sim/types';
import type { DailyRewardsWindowView } from './daily_rewards_view';
import { itemDisplayName } from './entity_i18n';
import { esc } from './esc';
import { t } from './i18n';
import type { PainterHostPresentation } from './painter_host';
import { svgIcon } from './ui_icons';

export interface DailyRewardsWindowDeps extends PainterHostPresentation {
  items: Record<string, ItemDef>;
  onClaim(): void;
  onClose(): void;
}

/** Paint the Daily Rewards panel from a prepared view. */
export function renderDailyRewardsWindow(
  el: HTMLElement,
  view: DailyRewardsWindowView,
  deps: DailyRewardsWindowDeps,
): void {
  el.innerHTML = `<div class="panel-title"><span>${esc(t('dailyRewardsUi.window.title'))}</span><button type="button" class="x-btn" data-close aria-label="${esc(t('dailyRewardsUi.window.close'))}">${svgIcon('close')}</button></div>`;

  const strip = document.createElement('div');
  strip.className = 'daily-rewards-strip';
  for (const cell of view.cells) {
    const cellEl = document.createElement('div');
    cellEl.className = `daily-rewards-cell${cell.isNext ? ' is-next' : ''}`;
    const item = cell.itemId ? deps.items[cell.itemId] : undefined;
    const iconHtml = item ? deps.itemIcon(item) : '';
    const label = cell.isNext
      ? `<span class="drc-today">${esc(t('dailyRewardsUi.cell.today'))}</span>`
      : '';
    cellEl.innerHTML = `${label}${iconHtml}<span class="drc-money">${deps.moneyHtml(cell.copper)}</span>`;
    if (item && cell.itemCount) {
      const itemLine = document.createElement('span');
      itemLine.className = 'drc-item';
      itemLine.textContent = t('dailyRewardsUi.cell.itemCount', {
        count: cell.itemCount,
        item: itemDisplayName(item),
      });
      cellEl.appendChild(itemLine);
      deps.attachTooltip(cellEl, () => deps.itemTooltip(item));
    }
    strip.appendChild(cellEl);
  }
  el.appendChild(strip);

  const status = document.createElement('div');
  status.className = 'daily-rewards-status';
  if (view.locked) {
    status.textContent = t('dailyRewardsUi.window.locked');
  } else if (!view.canClaim) {
    status.textContent = t('dailyRewardsUi.window.claimed');
  }
  if (status.textContent) el.appendChild(status);

  const claimBtn = document.createElement('button');
  claimBtn.type = 'button';
  claimBtn.className = 'btn btn-primary daily-rewards-claim';
  claimBtn.textContent = t('dailyRewardsUi.window.claim');
  claimBtn.setAttribute('aria-label', t('dailyRewardsUi.window.claimAria'));
  claimBtn.disabled = !view.canClaim;
  claimBtn.addEventListener('click', () => deps.onClaim());
  el.appendChild(claimBtn);

  const hint = document.createElement('div');
  hint.className = 'daily-rewards-hint';
  hint.textContent = t('dailyRewardsUi.window.hint');
  el.appendChild(hint);

  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
}
