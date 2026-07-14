// Thin DOM painter for the Ravenpost mail window (PHAA-495).
//
// The consumer half of the pure-core + thin-painter split: it paints
// #mail-window from the structured MailInboxBody (mail_view.ts) and owns the
// window's view-state (tab, compose form fields, staged attachments) plus its
// lifecycle (open / close / refresh-on-snapshot). The pure core decides which
// state the snapshot is in; this module renders that and wires send / take /
// delete / mark-read dispatch back through IWorld. It holds no Sim reference
// and reaches into Hud only through its deps.
//
// Item attachments (PHAA-688): the Compose tab stages parcels from the bags
// window the same way the market's Sell tab stages a listing (bagItemAction's
// 'mailAttach' branch in bags_view.ts, wired through stageMailAttach below).
// The sim/server/wire layer already accepted an `items` array end to end
// since PHAA-495; this closes the gap on the compose UI. A staged parcel
// carries the sender's full current stack of that item (no partial-quantity
// picker yet -- that is PHAA-645's follow-on quantity stepper port, upstream
// #1695). Attachments render into their own #mail-attachments container so
// staging/removing a parcel never rebuilds (and loses focus/typed values in)
// the recipient/subject/body fields.

import { ITEMS } from '../sim/data';
import type { InvSlot } from '../sim/types';
import type { IWorld } from '../world_api';
import { markDialogRoot } from './dialog_root';
import { esc } from './esc';
import { formatMoney as formatLocalizedMoney, formatNumber, t } from './i18n';
import { buildMailInboxBody, canSendMail } from './mail_view';
import type { PainterHostPresentation } from './painter_host';
import { tSim } from './sim_i18n';
import { svgIcon } from './ui_icons';

const COPPER_PER_GOLD = 10000;
const COPPER_PER_SILVER = 100;

type MailTab = 'inbox' | 'compose';

export interface MailWindowDeps extends PainterHostPresentation {
  root(): HTMLElement;
  world(): IWorld;
  closeOthers(): void;
  hideTooltip(): void;
  captureFocus(): HTMLElement | null;
  restoreFocus(target: HTMLElement | null): void;
  showError(text: string): void;
  /** Render the bags window and, when `open`, reveal it alongside the compose form. */
  syncBags(open: boolean): void;
}

export class MailWindow {
  private opened = false;
  private tab: MailTab = 'inbox';
  private lastSig = '';
  private openerFocus: HTMLElement | null = null;
  private attachments: InvSlot[] = [];

  constructor(private readonly deps: MailWindowDeps) {}

  get isOpen(): boolean {
    return this.opened;
  }

  /** True while the Compose tab is showing a live form (the bags window stages
   *  parcels into it). False while at the empty "not at the Ravenpost" state,
   *  where there is nothing to attach to. */
  get isComposeTab(): boolean {
    return this.opened && this.tab === 'compose' && !!this.deps.world().mailInfo;
  }

  open(): void {
    this.deps.closeOthers();
    this.openerFocus = this.deps.captureFocus();
    this.opened = true;
    this.tab = 'inbox';
    this.lastSig = '';
    this.attachments = [];
    this.render();
    this.deps.root().style.display = 'flex';
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.attachments = [];
    this.deps.root().style.display = 'none';
    this.deps.hideTooltip();
    this.deps.syncBags(false);
    this.deps.restoreFocus(this.openerFocus);
    this.openerFocus = null;
  }

  /** Stage a bag item onto the Compose form as a parcel (called by the bags
   *  window on click). Attaches the sender's full current stack; a duplicate
   *  click on an already-staged item is a no-op, and staging beyond the
   *  letter's parcel cap shows the same error the server would send. */
  stageAttach(itemId: string): void {
    if (!this.isComposeTab) return;
    const info = this.deps.world().mailInfo;
    if (!info) return;
    if (this.attachments.some((a) => a.itemId === itemId)) return;
    if (this.attachments.length >= info.maxAttachments) {
      this.deps.showError(tSim('error.mailTooManyParcels', { count: String(info.maxAttachments) }));
      return;
    }
    const have = this.bagCount(itemId);
    if (have <= 0) return;
    this.attachments.push({ itemId, count: have });
    this.renderAttachmentChips();
  }

  private removeAttach(itemId: string): void {
    this.attachments = this.attachments.filter((a) => a.itemId !== itemId);
    this.renderAttachmentChips();
  }

  private bagCount(itemId: string): number {
    return this.deps
      .world()
      .inventory.filter((s) => s.itemId === itemId)
      .reduce((n, s) => n + s.count, 0);
  }

  // Per-frame (slow divider): refresh the inbox list when it changes. The
  // Compose tab holds typed inputs, so it is only rebuilt on tab switch.
  refreshIfChanged(): void {
    if (!this.opened || this.tab !== 'inbox') return;
    const info = this.deps.world().mailInfo;
    const sig = JSON.stringify([info?.messages, info?.totalCount]);
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.renderContent();
  }

  render(): void {
    const el = this.deps.root();
    this.deps.hideTooltip();
    markDialogRoot(el, { label: t('mailUi.title') });
    const tab = (id: MailTab, label: string) =>
      `<button type="button" class="mkt-tab${this.tab === id ? ' sel' : ''}" data-mail-tab="${id}" aria-pressed="${this.tab === id ? 'true' : 'false'}">${esc(label)}</button>`;
    el.innerHTML =
      `<div class="panel-title"><span>${esc(t('mailUi.title'))} <span class="panel-subtitle">${esc(t('mailUi.subtitle'))}</span></span><button type="button" class="x-btn" data-close aria-label="${esc(t('mailUi.close'))}">${svgIcon('close')}</button></div>` +
      `<div class="mkt-tabs">${tab('inbox', t('mailUi.inbox'))}${tab('compose', t('mailUi.compose'))}</div>` +
      `<div id="mail-body"></div>`;
    el.querySelector('[data-close]')?.addEventListener('click', () => this.close());
    el.querySelectorAll('[data-mail-tab]').forEach((node) => {
      node.addEventListener('click', () => {
        const next = (node as HTMLElement).dataset.mailTab as MailTab;
        if (next === this.tab) return;
        this.tab = next;
        this.lastSig = '';
        // Bags ride alongside the Compose tab (like the market's Sell tab) so you
        // can click bag items straight onto the letter; hide them again on the
        // Inbox tab, where there is nothing to stage.
        this.deps.syncBags(next === 'compose');
        this.render();
        (
          this.deps.root().querySelector(`[data-mail-tab="${next}"]`) as HTMLElement | null
        )?.focus();
      });
    });
    this.renderContent();
  }

  private renderContent(): void {
    const body = this.deps.root().querySelector<HTMLElement>('#mail-body');
    if (!body) return;
    if (this.tab === 'compose') {
      this.renderCompose(body);
      return;
    }
    this.renderInbox(body);
  }

  private renderInbox(body: HTMLElement): void {
    const view = buildMailInboxBody(this.deps.world().mailInfo, (itemId) => ITEMS[itemId]);
    if (view.state === 'no-data') {
      body.innerHTML = `<div class="mkt-empty">${esc(t('mailUi.noPostOffice'))}</div>`;
      return;
    }
    if (view.state === 'empty') {
      body.innerHTML = `<div class="mkt-empty">${esc(t('mailUi.emptyInbox'))}</div>`;
      return;
    }
    const list = document.createElement('div');
    list.className = 'mkt-list';
    for (const row of view.rows) {
      const m = row.message;
      const wrap = document.createElement('div');
      wrap.className = 'mail-row';
      const attachmentsHtml = row.attachments
        .map((a) =>
          a.item
            ? `<span class="mail-attach">${this.deps.itemIcon(a.item)}${esc(a.item.name)}${a.count > 1 ? ` x${a.count}` : ''}</span>`
            : '',
        )
        .join('');
      const hasAttachments = m.copper > 0 || row.attachments.length > 0;
      wrap.innerHTML =
        `<div class="mail-meta"><span class="mail-from">${esc(t('mailUi.from', { name: m.senderName }))}</span>${m.read ? '' : `<span class="mail-unread-dot" aria-hidden="true"></span>`}</div>` +
        `<div class="mail-subject">${esc(m.subject || t('mailUi.noSubject'))}</div>` +
        `<div class="mail-body">${esc(m.body)}</div>` +
        (m.copper > 0 ? `<div class="mail-copper">${this.deps.moneyHtml(m.copper)}</div>` : '') +
        attachmentsHtml;
      const actions = document.createElement('div');
      actions.className = 'mail-actions';
      if (hasAttachments) {
        const takeBtn = document.createElement('button');
        takeBtn.className = 'mkt-btn';
        takeBtn.textContent = t('mailUi.take');
        takeBtn.addEventListener('click', () => this.deps.world().mailTake(m.id));
        actions.appendChild(takeBtn);
      } else {
        const delBtn = document.createElement('button');
        delBtn.className = 'mkt-btn cancel';
        delBtn.textContent = t('mailUi.delete');
        delBtn.addEventListener('click', () => this.deps.world().mailDelete(m.id));
        actions.appendChild(delBtn);
      }
      wrap.appendChild(actions);
      if (!m.read) this.deps.world().mailMarkRead(m.id);
      list.appendChild(wrap);
    }
    body.innerHTML = '';
    body.appendChild(list);
  }

  private renderCompose(body: HTMLElement): void {
    const info = this.deps.world().mailInfo;
    if (!info) {
      body.innerHTML = `<div class="mkt-empty">${esc(t('mailUi.noPostOffice'))}</div>`;
      return;
    }
    body.innerHTML =
      `<div class="mkt-note">${esc(t('mailUi.postageNote', { money: formatLocalizedMoney(info.postage) }))}</div>` +
      `<div class="mkt-price-row"><label for="mail-to">${esc(t('mailUi.recipient'))}</label><input id="mail-to" type="text" maxlength="24"></div>` +
      `<div class="mkt-price-row"><label for="mail-subject">${esc(t('mailUi.subjectLabel'))}</label><input id="mail-subject" type="text" maxlength="64"></div>` +
      `<textarea id="mail-body-text" class="mail-body-input" maxlength="600" placeholder="${esc(t('mailUi.bodyPlaceholder'))}"></textarea>` +
      `<div class="mkt-price-row"><label>${esc(t('mailUi.attachments', { max: formatNumber(info.maxAttachments, { maximumFractionDigits: 0 }) }))}</label></div>` +
      `<div id="mail-attachments" class="mail-attach-row"></div>` +
      `<div class="mkt-price-row"><label>${esc(t('itemUi.market.priceEach'))}</label>` +
      `<input class="coininput" id="mail-g" type="number" min="0" value="0" aria-label="${esc(t('itemUi.money.gold'))}"><span class="coin g" aria-hidden="true"></span>` +
      `<input class="coininput" id="mail-s" type="number" min="0" max="99" value="0" aria-label="${esc(t('itemUi.money.silver'))}"><span class="coin s" aria-hidden="true"></span>` +
      `<input class="coininput" id="mail-c" type="number" min="0" max="99" value="0" aria-label="${esc(t('itemUi.money.copper'))}"><span class="coin c" aria-hidden="true"></span></div>` +
      `<button type="button" class="mkt-list-btn" id="mail-send-btn">${esc(t('mailUi.send'))}</button>`;
    this.renderAttachmentChips();
    body.querySelector('#mail-send-btn')?.addEventListener('click', () => {
      const to = (body.querySelector('#mail-to') as HTMLInputElement)?.value ?? '';
      const subject = (body.querySelector('#mail-subject') as HTMLInputElement)?.value ?? '';
      const text = (body.querySelector('#mail-body-text') as HTMLTextAreaElement)?.value ?? '';
      if (!canSendMail(to, subject, text)) {
        this.deps.showError(t('mailUi.needRecipientOrText'));
        return;
      }
      const gg = Math.max(
        0,
        parseInt((body.querySelector('#mail-g') as HTMLInputElement)?.value || '0', 10) || 0,
      );
      const ss = Math.max(
        0,
        parseInt((body.querySelector('#mail-s') as HTMLInputElement)?.value || '0', 10) || 0,
      );
      const cc = Math.max(
        0,
        parseInt((body.querySelector('#mail-c') as HTMLInputElement)?.value || '0', 10) || 0,
      );
      const copper = gg * COPPER_PER_GOLD + ss * COPPER_PER_SILVER + cc;
      this.deps.world().mailSend(
        to,
        subject,
        text,
        copper,
        this.attachments.map((a) => ({ ...a })),
      );
      this.attachments = [];
      this.tab = 'inbox';
      this.lastSig = '';
      this.deps.syncBags(false);
      this.render();
    });
  }

  // Split out from renderCompose so staging/removing a parcel only touches the
  // attachment chips, never the recipient/subject/body inputs (a full
  // renderCompose rebuild would clobber whatever the player has typed).
  private renderAttachmentChips(): void {
    const container = this.deps.root().querySelector<HTMLElement>('#mail-attachments');
    if (!container) return;
    container.innerHTML = '';
    for (const a of this.attachments) {
      const item = ITEMS[a.itemId];
      if (!item) continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'mail-attach removable';
      chip.innerHTML = `${this.deps.itemIcon(item)}${esc(item.name)}${a.count > 1 ? ` x${a.count}` : ''}`;
      chip.setAttribute('aria-label', t('mailUi.removeAttachment', { item: item.name }));
      chip.addEventListener('click', () => this.removeAttach(a.itemId));
      container.appendChild(chip);
    }
  }
}
