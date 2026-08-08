// Thin DOM consumer for the Book of Asphodelia window (PHAA-747).
//
// The consumer half of the pure-core + thin-painter split (book_view.ts is
// the pure core). A rebuild-on-open panel like Vendor/DailyRewards, not a
// per-frame hot painter, so it follows the plain-innerHTML-rebuild shape
// rather than the write-elision facet (that contract is for Hud.update()'s
// 60fps path; the book is a toggle window driven from a side-menu button).
//
// The painter owns NO state. The cross-window orchestration (which other
// windows to close, focus-return) stays in Hud because it needs Hud's
// private mutable state; this module only renders one panel and reports
// the title-pick + close actions back through injected callbacks. The
// painter also re-renders on demand when the player picks a title, so the
// active-state highlight flips without a full window close.

import type {
  BookCategorySection,
  BookDeedRow,
  BookObjectiveView,
  BookTitleRow,
  BookView,
} from './book_view';
import { bookCategorySummary } from './book_view';
import { tEntity } from './entity_i18n';
import { esc } from './esc';
import { formatNumber, t } from './i18n';
import { svgIcon } from './ui_icons';

export interface BookWindowDeps {
  /**
   * The player picks a title from the picker; the engine validates against
   * earnedTitles and either commits the swap or silently no-ops (deeds.ts
   * setActiveTitle). The painter re-renders so the active marker flips.
   */
  onSelectTitle(titleId: string | null): void;
  /** The window's close button / Esc / outside-click handler. */
  onClose(): void;
  /**
   * True iff the player has earned any title yet. The painter uses it to
   * swap the empty-state copy between "earn your first title" and "no
   * titles earned yet" without re-deriving the view.
   */
  hasAnyTitle: boolean;
}

/** Paint the Book of Asphodelia panel from a prepared view. */
export function renderBookWindow(el: HTMLElement, view: BookView, deps: BookWindowDeps): void {
  el.innerHTML = `<div class="panel-title"><span>${esc(t('hudChrome.book.title'))}</span><button type="button" class="x-btn" data-close aria-label="${esc(t('hudChrome.book.close'))}">${svgIcon('close')}</button></div>`;

  // Header summary line: "12 of 47 deeds complete" / "3 titles earned".
  const summary = document.createElement('div');
  summary.className = 'book-summary';
  summary.innerHTML =
    `<div class="book-summary-deeds">${esc(t('hudChrome.book.deedSummary', { done: formatInt(view.totalDone), total: formatInt(view.totalDeeds) }))}</div>` +
    `<div class="book-summary-titles">${esc(t('hudChrome.book.titleSummary', { count: formatInt(view.totalTitles) }))}</div>`;
  el.appendChild(summary);

  // Title picker.
  el.appendChild(renderTitlePicker(view.titles, deps));

  // Deeds: one section per category, in BOOK_CATEGORY_ORDER (buildBookView's
  // contract). Empty sections render the empty-state copy so the player
  // sees the category exists but has nothing in it yet (matters for "pvp"
  // or "hidden" categories the player hasn't reached).
  const deedsRoot = document.createElement('div');
  deedsRoot.className = 'book-deeds';
  for (const section of view.categories) {
    deedsRoot.appendChild(renderCategorySection(section));
  }
  el.appendChild(deedsRoot);

  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
}

function renderTitlePicker(titles: readonly BookTitleRow[], deps: BookWindowDeps): HTMLElement {
  const root = document.createElement('div');
  root.className = 'book-title-picker';

  const heading = document.createElement('div');
  heading.className = 'book-section-heading';
  heading.textContent = t('hudChrome.book.titlePickerHeading');
  root.appendChild(heading);

  if (titles.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'book-title-empty';
    empty.textContent = deps.hasAnyTitle
      ? t('hudChrome.book.titlePickerEmpty')
      : t('hudChrome.book.titlePickerEarnFirst');
    root.appendChild(empty);
    return root;
  }

  const list = document.createElement('div');
  list.className = 'book-title-list';
  for (const title of titles) {
    list.appendChild(renderTitleRow(title, deps));
  }
  root.appendChild(list);

  // A "No Title" option lets the player clear the active title. The engine
  // accepts null and treats it as a valid no-op; the picker mirrors the
  // nullable contract.
  if (titles.some((t2) => t2.active)) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'book-title-clear';
    clear.textContent = t('hudChrome.book.titleClear');
    clear.addEventListener('click', () => deps.onSelectTitle(null));
    root.appendChild(clear);
  }

  return root;
}

function renderTitleRow(title: BookTitleRow, deps: BookWindowDeps): HTMLElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = `book-title-row${title.active ? ' is-active' : ''}`;
  row.innerHTML =
    `<span class="book-title-display">${esc(t('hudChrome.book.titleDisplay', { display: title.display }))}</span>` +
    (title.active
      ? `<span class="book-title-active-tag">${esc(t('hudChrome.book.titleActiveTag'))}</span>`
      : '');
  row.setAttribute('aria-label', t('hudChrome.book.titlePickAria', { display: title.display }));
  row.setAttribute('aria-pressed', title.active ? 'true' : 'false');
  row.addEventListener('click', () => {
    if (title.active) return;
    deps.onSelectTitle(title.titleId);
  });
  return row;
}

function renderCategorySection(section: BookCategorySection): HTMLElement {
  const root = document.createElement('section');
  root.className = 'book-category';
  root.dataset.category = section.category;

  const summary = bookCategorySummary(section);
  const header = document.createElement('h3');
  header.className = 'book-category-header';
  if (summary === null) {
    // Empty category: show the heading, drop the count, append the empty
    // hint. Hidden-until-earned collapses to nothing when no deed has been
    // earned yet (buildBookView drops its deeds entirely).
    header.textContent = t(`hudChrome.book.category.${section.category}`);
  } else {
    header.innerHTML =
      `<span class="book-category-name">${esc(t(`hudChrome.book.category.${section.category}`))}</span>` +
      `<span class="book-category-count">${esc(summary)}</span>`;
  }
  root.appendChild(header);

  if (section.deeds.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'book-category-empty';
    empty.textContent = t('hudChrome.book.categoryEmpty');
    root.appendChild(empty);
    return root;
  }

  const list = document.createElement('ul');
  list.className = 'book-deed-list';
  for (const deed of section.deeds) {
    list.appendChild(renderDeedRow(deed));
  }
  root.appendChild(list);
  return root;
}

function renderDeedRow(deed: BookDeedRow): HTMLElement {
  const li = document.createElement('li');
  li.className = `book-deed${deed.done ? ' is-done' : ''}`;
  li.dataset.deedId = deed.deedId;

  const name = document.createElement('div');
  name.className = 'book-deed-name';
  name.textContent = tEntity({ kind: 'deed', id: deed.deedId, field: 'name' });
  li.appendChild(name);

  if (deed.text) {
    const text = document.createElement('div');
    text.className = 'book-deed-text';
    text.textContent = tEntity({ kind: 'deed', id: deed.deedId, field: 'text' });
    li.appendChild(text);
  }

  const objectives = document.createElement('ul');
  objectives.className = 'book-objectives';
  for (const obj of deed.objectives) {
    objectives.appendChild(renderObjectiveRow(obj));
  }
  li.appendChild(objectives);

  if (deed.titleRewardId) {
    const tag = document.createElement('div');
    tag.className = 'book-deed-title-reward';
    tag.textContent = t('hudChrome.book.titleRewardHint');
    li.appendChild(tag);
  }

  return li;
}

function renderObjectiveRow(obj: BookObjectiveView): HTMLElement {
  const li = document.createElement('li');
  li.className = `book-objective${obj.done ? ' is-done' : ''}`;

  const label = document.createElement('span');
  label.className = 'book-objective-label';
  label.textContent = obj.label;
  li.appendChild(label);

  const count = document.createElement('span');
  count.className = 'book-objective-count';
  // Bound-count vs unbounded: a count that already meets the target renders
  // as "X / X" (the player sees the cap), not as a literal "+Y" overflow.
  count.textContent = `${formatInt(obj.count)} / ${formatInt(obj.target)}`;
  li.appendChild(count);

  return li;
}

function formatInt(n: number): string {
  // Locale-aware integer formatting for the summary + objective counts.
  // Routes through formatNumber so the active player locale (set via
  // src/ui/i18n.ts) drives grouping rather than the host default; the engine
  // deed counts are integers today but the view stays defensive against
  // future collect-objective variants by flooring first.
  return formatNumber(Math.floor(n), { maximumFractionDigits: 0 });
}
