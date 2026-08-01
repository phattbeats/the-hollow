// Thin DOM consumer for the crafting/enchanting window (PHAA-818, adapts
// upstream #1708).
//
// The consumer half of the pure-core + thin-consumer split: it paints
// #crafting-window from the structured CraftingView (crafting_view.ts) and
// wires the craft / disenchant / apply-enchant / close actions. It owns no
// state; the cross-window orchestration (which windows to close, focus
// capture) stays in Hud because it needs Hud's private state. Reference:
// vendor_window.ts (same recipe: full innerHTML rebuild on open/refresh, no
// per-frame write-elision since this window is toggle-driven, not hot-path).

import type { CraftType, EquipSlot } from '../sim/types';
import type {
  CraftingDisenchantRow,
  CraftingEnchantRow,
  CraftingRecipeRow,
  CraftingView,
} from './crafting_view';
import { enchantDisplayName, itemDisplayName } from './entity_i18n';
import { esc } from './esc';
import { type TranslationKey, t } from './i18n';
import type { PainterHostPresentation } from './painter_host';
import { svgIcon } from './ui_icons';

/**
 * Hud-supplied glue. Composes the shared PainterHostPresentation bag
 * (icon/tooltip) and adds the crafting-specific dispatch: craft/disenchant/
 * apply-enchant actions, the close callback, and the slot-name resolver the
 * character window already owns (shared so both windows label slots
 * identically).
 */
export interface CraftingWindowDeps extends PainterHostPresentation {
  hideTooltip(): void;
  onCraft(recipeId: string): void;
  onDisenchant(itemId: string): void;
  onApplyEnchant(enchantId: string): void;
  onClose(): void;
  slotName(slot: EquipSlot): string;
}

function craftTypeLabel(craft: CraftType): string {
  return t(`hudChrome.crafting.craftType.${craft}` as TranslationKey);
}

function renderRecipeRow(row: CraftingRecipeRow, deps: CraftingWindowDeps): HTMLElement {
  const { recipe, resultItem, reagents, craftable } = row;
  const el = document.createElement('div');
  el.className = 'crafting-row';
  const reagentText = reagents
    .map((r) =>
      t('hudChrome.crafting.reagentLine', {
        item: itemDisplayName(r.item),
        have: String(r.have),
        need: String(r.need),
      }),
    )
    .join(', ');
  el.innerHTML = `${deps.itemIcon(resultItem)}<span class="crafting-name">${esc(
    itemDisplayName(resultItem),
  )}</span><span class="crafting-craft-type">${esc(craftTypeLabel(recipe.craft))}</span><span class="crafting-reagents">${esc(reagentText)}</span>`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'crafting-action-btn';
  button.textContent = t('hudChrome.crafting.craftButton');
  button.disabled = !craftable;
  button.setAttribute(
    'aria-label',
    t('hudChrome.crafting.craftAria', { item: itemDisplayName(resultItem) }),
  );
  button.addEventListener('click', () => deps.onCraft(recipe.id));
  el.appendChild(button);
  deps.attachTooltip(el, () => deps.itemTooltip(resultItem));
  return el;
}

function renderEnchantRow(row: CraftingEnchantRow, deps: CraftingWindowDeps): HTMLElement {
  const { enchant, scrollItem, haveScroll, active } = row;
  const el = document.createElement('div');
  el.className = 'crafting-row';
  const slotLabel = deps.slotName(enchant.slot);
  const activeTag = active
    ? `<span class="crafting-active-tag">${esc(t('hudChrome.crafting.activeTag'))}</span>`
    : '';
  el.innerHTML = `${deps.itemIcon(scrollItem)}<span class="crafting-name">${esc(
    enchantDisplayName(enchant),
  )}</span><span class="crafting-slot">${esc(slotLabel)}</span>${activeTag}<span class="crafting-reagents">${esc(
    t('hudChrome.crafting.needScroll', { scroll: itemDisplayName(scrollItem) }),
  )}</span>`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'crafting-action-btn';
  button.textContent = t('hudChrome.crafting.applyButton');
  button.disabled = !haveScroll;
  button.setAttribute(
    'aria-label',
    t('hudChrome.crafting.applyAria', { enchant: enchantDisplayName(enchant), slot: slotLabel }),
  );
  button.addEventListener('click', () => deps.onApplyEnchant(enchant.id));
  el.appendChild(button);
  deps.attachTooltip(el, () => deps.itemTooltip(scrollItem));
  return el;
}

function renderDisenchantRow(row: CraftingDisenchantRow, deps: CraftingWindowDeps): HTMLElement {
  const { itemId, item, count } = row;
  const el = document.createElement('div');
  el.className = 'crafting-row';
  el.innerHTML = `${deps.itemIcon(item)}<span class="crafting-name">${esc(itemDisplayName(item))}</span><span class="crafting-reagents">${esc(String(count))}</span>`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'crafting-action-btn';
  button.textContent = t('hudChrome.crafting.disenchantButton');
  button.setAttribute(
    'aria-label',
    t('hudChrome.crafting.disenchantAria', { item: itemDisplayName(item) }),
  );
  button.addEventListener('click', () => deps.onDisenchant(itemId));
  el.appendChild(button);
  deps.attachTooltip(el, () => deps.itemTooltip(item));
  return el;
}

/** Paint the crafting/enchanting panel from a prepared view. */
export function renderCraftingWindow(
  el: HTMLElement,
  view: CraftingView,
  deps: CraftingWindowDeps,
): void {
  deps.hideTooltip();
  const scrollTop = el.scrollTop;
  el.innerHTML = `<div class="panel-title"><span>${esc(t('hudChrome.crafting.title'))}</span><button type="button" class="x-btn" data-close aria-label="${esc(t('hudChrome.crafting.close'))}">${svgIcon('close')}</button></div>`;

  const proficiency = document.createElement('div');
  proficiency.className = 'crafting-proficiency';
  proficiency.innerHTML = view.proficiency
    .map((p) =>
      esc(
        t('hudChrome.crafting.proficiencyLine', {
          craft: craftTypeLabel(p.craft),
          value: String(p.value),
        }),
      ),
    )
    .map((line) => `<span>${line}</span>`)
    .join('');
  el.appendChild(proficiency);

  const recipesTitle = document.createElement('div');
  recipesTitle.className = 'crafting-section-title';
  recipesTitle.textContent = t('hudChrome.crafting.tabRecipes');
  el.appendChild(recipesTitle);
  for (const row of view.recipes) el.appendChild(renderRecipeRow(row, deps));

  const enchantsTitle = document.createElement('div');
  enchantsTitle.className = 'crafting-section-title';
  enchantsTitle.textContent = t('hudChrome.crafting.tabEnchants');
  el.appendChild(enchantsTitle);
  for (const row of view.enchants) el.appendChild(renderEnchantRow(row, deps));

  const disenchantTitle = document.createElement('div');
  disenchantTitle.className = 'crafting-section-title';
  disenchantTitle.textContent = t('hudChrome.crafting.disenchantSectionTitle');
  el.appendChild(disenchantTitle);
  if (view.disenchantable.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'crafting-empty';
    empty.textContent = t('hudChrome.crafting.disenchantEmpty');
    el.appendChild(empty);
  }
  for (const row of view.disenchantable) el.appendChild(renderDisenchantRow(row, deps));

  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
  el.scrollTop = scrollTop;
}
