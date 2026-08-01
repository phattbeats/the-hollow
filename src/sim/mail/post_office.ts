// The Ravenpost: in-game player-to-player mail. Ported from upstream (PHAA-495,
// v0.20 #1339/#1411/#1413) and built the way `market.ts` is: a self-contained
// module behind SimContext (the market.ts shape). This class OWNS the shared
// mail book and the mail-id counter; the inventory hub (addItem/removeItem/
// countItem) STAYS on Sim and is consumed through SimContext. Sim keeps thin
// same-named delegates so the server, the IWorld surface, and tests resolve
// unchanged.
//
// Mail is world-scoped and keyed by a stable recipient identity (character id
// string online, entity id offline; the market's sellerKey convention), so a
// letter reaches a character who is offline and waits across restarts via
// serializeMail/loadMail (a per-realm JSONB world_state row, like the market).
// Attachments (coin + item stacks) are escrowed out of the sender's bags at
// send time and only leave the book through mailTake.
//
// Divergence from upstream: upstream places one raven-pillar `kind:'object'`
// per town; this port anchors the Ravenpost at a stationary NPC (the
// `ravenpost` flag on NpcDef, mirroring the Merchant's `market` flag) so it
// reuses the existing NPC render/dialogue/interact pipeline instead of adding
// a new object-interact path. Authored system/NPC letters (upstream's welcome
// letter, quest letters) are deferred; this port carries player-sent mail only.
//
// `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no Math.random/
// Date.now (enforced by tests/architecture.test.ts). The post draws NO rng.

import { ITEMS } from '../data';
import { formatMoney } from '../format_money';
import type { PlayerMeta } from '../sim';
import type { SimContext } from '../sim_context';
import { dist2d, type Entity, INTERACT_RANGE, type InvSlot } from '../types';

const MAIL_RANGE = INTERACT_RANGE + 2; // you must stand at the Ravenpost to tend your post
export const MAIL_POSTAGE = 30; // copper per letter
export const MAIL_MAX_ATTACHMENTS = 3; // item stacks a letter can carry
export const MAIL_DELIVERY_SECONDS = 45; // the raven's flight time
const MAIL_EXPIRY_SECONDS = 14 * 24 * 3600; // sim-seconds a read/plain letter lingers
const MAIL_MAX_PER_RECIPIENT = 100; // stored letters per mailbox (full = refuse new)
const MAIL_WIRE_LIMIT = 50; // most letters shipped to one client at a time
export const MAIL_SUBJECT_MAX = 64;
export const MAIL_BODY_MAX = 600;

export interface MailMessage {
  id: number;
  recipientKey: string; // stable recipient identity (character id string); market sellerKey convention
  recipientName: string; // display name at send time (rekeyed on rename)
  senderName: string;
  subject: string;
  body: string;
  copper: number;
  items: InvSlot[];
  deliverAt: number; // sim.time seconds; delivered once time >= deliverAt
  expiresAt: number; // sim.time seconds; Infinity while attachments remain
  read: boolean;
}

// Persistable mail state. Durations are stored as seconds-left because sim.time
// resets to 0 each server boot (the market's secondsLeft pattern).
export interface MailSave {
  mail: {
    id: number;
    recipientKey: string;
    recipientName: string;
    senderName: string;
    subject: string;
    body: string;
    copper: number;
    items: InvSlot[];
    deliverIn: number; // seconds until delivery (0 = already delivered)
    secondsLeft: number; // seconds until expiry; -1 = never expires
    read: boolean;
  }[];
  nextMailId: number;
}

export class PostOffice {
  // One shared book of letters, keyed by stable recipient identity.
  mail: MailMessage[] = [];
  private nextMailId = 1;
  // assigned by the Sim ctor during NPC placement (the NPC loop stays on Sim).
  postOfficeId = -1;

  constructor(private readonly ctx: SimContext) {}

  // Public tick entry: the Sim tick calls this in the end-of-tick market phase
  // (right after market.update()). Once a second: land due letters, prune expired ones.
  update(): void {
    if (this.ctx.tickCount % 20 !== 0) return;
    const now = this.ctx.time;
    for (let i = this.mail.length - 1; i >= 0; i--) {
      const m = this.mail[i];
      if (now >= m.expiresAt && m.items.length === 0 && m.copper <= 0) {
        this.mail.splice(i, 1);
      }
    }
  }

  private postOfficeEntity(): Entity | null {
    const e = this.ctx.entities.get(this.postOfficeId);
    return e && e.kind === 'npc' ? e : null;
  }

  private nearPostOffice(e: Entity): boolean {
    const box = this.postOfficeEntity();
    return !!box && dist2d(e.pos, box.pos) <= MAIL_RANGE;
  }

  mailKeyFor(meta: PlayerMeta): string {
    return String(meta.characterId ?? meta.entityId);
  }

  private belongsTo(m: MailMessage, meta: PlayerMeta): boolean {
    return m.recipientKey === this.mailKeyFor(meta) || m.recipientKey === meta.name;
  }

  private storedCountFor(meta: PlayerMeta): number {
    return this.mail.reduce((n, m) => n + (this.belongsTo(m, meta) ? 1 : 0), 0);
  }

  private deliveredFor(meta: PlayerMeta): MailMessage[] {
    const now = this.ctx.time;
    return this.mail.filter((m) => this.belongsTo(m, meta) && now >= m.deliverAt);
  }

  mailUnreadFor(pid: number): number {
    const meta = this.ctx.players.get(pid);
    if (!meta) return 0;
    const now = this.ctx.time;
    let n = 0;
    for (const m of this.mail) {
      if (!m.read && now >= m.deliverAt && this.belongsTo(m, meta)) n++;
    }
    return n;
  }

  private metaByMailKey(key: string): PlayerMeta | null {
    if (!key) return null;
    for (const m of this.ctx.players.values()) {
      if (this.mailKeyFor(m) === key || m.name === key) return m;
    }
    return null;
  }

  // Send a letter. Resolves the recipient among live players (the offline
  // world has no directory beyond them; the server resolves against the
  // character database and calls mailSendResolved directly).
  mailSend(
    to: string,
    subject: string,
    body: string,
    copper: number,
    items: InvSlot[],
    pid?: number,
  ): void {
    const name = to.trim();
    if (!name) {
      const r = this.ctx.resolve(pid);
      if (r) this.ctx.error(r.meta.entityId, 'Name a recipient for your letter.');
      return;
    }
    let recipient: PlayerMeta | null = null;
    for (const m of this.ctx.players.values()) {
      if (m.name.toLowerCase() === name.toLowerCase()) {
        recipient = m;
        break;
      }
    }
    if (!recipient) {
      const r = this.ctx.resolve(pid);
      if (r) this.ctx.error(r.meta.entityId, 'No adventurer by that name is known.');
      return;
    }
    this.mailSendResolved(
      { key: this.mailKeyFor(recipient), name: recipient.name },
      subject,
      body,
      copper,
      items,
      pid,
    );
  }

  // Authoritative send: the recipient identity is already resolved (live
  // player offline, character row online). Validates proximity, escrow and
  // postage, then books the letter onto the raven.
  mailSendResolved(
    recipient: { key: string; name: string },
    subject: string,
    body: string,
    copper: number,
    items: InvSlot[],
    pid?: number,
  ): void {
    const r = this.ctx.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    if (p.dead) return;
    if (!this.nearPostOffice(p)) {
      this.ctx.error(meta.entityId, 'You must stand at the Ravenpost to send mail.');
      return;
    }
    if (recipient.key === this.mailKeyFor(meta)) {
      this.ctx.error(meta.entityId, 'You cannot mail yourself.');
      return;
    }
    const cleanSubject = subject.trim().slice(0, MAIL_SUBJECT_MAX);
    const cleanBody = body.trim().slice(0, MAIL_BODY_MAX);
    if (!cleanSubject && !cleanBody && copper <= 0 && items.length === 0) {
      this.ctx.error(meta.entityId, 'An empty letter carries nothing to send.');
      return;
    }
    if (items.length > MAIL_MAX_ATTACHMENTS) {
      this.ctx.error(meta.entityId, `A letter can carry at most ${MAIL_MAX_ATTACHMENTS} parcels.`);
      return;
    }
    const coin = Math.max(0, Math.floor(copper));
    if (meta.copper < coin + MAIL_POSTAGE) {
      this.ctx.error(meta.entityId, 'You cannot afford the postage and attached coin.');
      return;
    }
    // Multiple slots can name the same itemId (a client is free to split a
    // stack across parcels), so validate against the TOTAL requested per
    // itemId, not each slot against the sender's full balance in isolation.
    // Checking per-slot would let N slots of the same item each pass against
    // an unchanged balance and duplicate the surplus into escrow.
    const totalRequested = new Map<string, number>();
    for (const slot of items) {
      const def = ITEMS[slot.itemId];
      if (!def) {
        this.ctx.error(meta.entityId, 'One of those parcels is not a real item.');
        return;
      }
      if (def.kind === 'quest') {
        this.ctx.error(meta.entityId, 'The raven will not carry quest items.');
        return;
      }
      if (def.soulbound) {
        this.ctx.error(meta.entityId, 'That item is bound to you and cannot be mailed.');
        return;
      }
      totalRequested.set(slot.itemId, (totalRequested.get(slot.itemId) ?? 0) + slot.count);
    }
    for (const [itemId, count] of totalRequested) {
      if (this.ctx.countItem(itemId, meta.entityId) < count) {
        this.ctx.error(meta.entityId, 'You do not have that parcel to send.');
        return;
      }
    }
    const recipientMeta = this.metaByMailKey(recipient.key);
    if (recipientMeta && this.storedCountFor(recipientMeta) >= MAIL_MAX_PER_RECIPIENT) {
      this.ctx.error(meta.entityId, "That adventurer's mailbox is full.");
      return;
    }
    // Escrow: postage + attached coin leave the sender now; attached items
    // leave the sender's bags now. Nothing is returned if the letter later
    // expires unread with no attachments (the postage is a gold sink, same as
    // the Merchant's cut).
    meta.copper -= coin + MAIL_POSTAGE;
    for (const slot of items) this.ctx.removeItem(slot.itemId, slot.count, meta.entityId);
    const deliverAt = this.ctx.time + MAIL_DELIVERY_SECONDS;
    this.mail.push({
      id: this.nextMailId++,
      recipientKey: recipient.key,
      recipientName: recipient.name,
      senderName: meta.name,
      subject: cleanSubject,
      body: cleanBody,
      copper: coin,
      items: items.map((s) => ({ ...s })),
      deliverAt,
      expiresAt: Infinity,
      read: false,
    });
    this.ctx.emit({
      type: 'log',
      text: `Your letter to ${recipient.name} is on its way.`,
      color: '#caa472',
      pid: meta.entityId,
    });
  }

  // Take any coin/item attachments off a delivered letter, mark it read, and
  // let its expiry clock start. Returns whether an attachment was actually
  // claimed, so the caller (the server's 'mail_take' handler, PHAA-512) knows
  // when to flush an atomic character+mail save rather than doing so on every
  // no-op attempt (marking-read-only or an already-empty letter is not a claim).
  mailTake(mailId: number, pid?: number): boolean {
    const r = this.ctx.resolve(pid);
    if (!r) return false;
    const { meta, e: p } = r;
    if (!this.nearPostOffice(p)) {
      this.ctx.error(meta.entityId, 'You must stand at the Ravenpost to check your mail.');
      return false;
    }
    const now = this.ctx.time;
    const m = this.mail.find(
      (x) => x.id === mailId && this.belongsTo(x, meta) && now >= x.deliverAt,
    );
    if (!m) return false;
    if (m.copper <= 0 && m.items.length === 0) return false;
    if (m.copper > 0) {
      meta.copper += m.copper;
      this.ctx.emit({
        type: 'loot',
        text: `You collect ${formatMoney(m.copper)} from a letter.`,
        pid: meta.entityId,
      });
    }
    for (const s of m.items) this.ctx.addItem(s.itemId, s.count, meta.entityId);
    m.copper = 0;
    m.items = [];
    m.read = true;
    m.expiresAt = now + MAIL_EXPIRY_SECONDS;
    return true;
  }

  mailMarkRead(mailId: number, pid?: number): void {
    const r = this.ctx.resolve(pid);
    if (!r) return;
    const { meta } = r;
    const now = this.ctx.time;
    const m = this.mail.find(
      (x) => x.id === mailId && this.belongsTo(x, meta) && now >= x.deliverAt,
    );
    if (!m || m.read) return;
    m.read = true;
    if (m.items.length === 0 && m.copper <= 0) m.expiresAt = now + MAIL_EXPIRY_SECONDS;
  }

  // Delete a letter outright. Refuses if attachments remain unclaimed so coin
  // and items are never silently destroyed.
  mailDelete(mailId: number, pid?: number): void {
    const r = this.ctx.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    if (!this.nearPostOffice(p)) {
      this.ctx.error(meta.entityId, 'You must stand at the Ravenpost to manage your mail.');
      return;
    }
    const idx = this.mail.findIndex((x) => x.id === mailId && this.belongsTo(x, meta));
    if (idx < 0) return;
    const m = this.mail[idx];
    if (m.copper > 0 || m.items.length > 0) {
      this.ctx.error(meta.entityId, 'Collect the attachments before discarding that letter.');
      return;
    }
    this.mail.splice(idx, 1);
  }

  rekeyMailRecipient(characterId: number, oldName: string, newName: string): boolean {
    if (!Number.isFinite(characterId)) return false;
    const key = String(characterId);
    let changed = false;
    for (const m of this.mail) {
      if (m.recipientKey === key || m.recipientKey === oldName || m.recipientKey === newName) {
        if (m.recipientKey !== key || m.recipientName !== newName) changed = true;
        m.recipientKey = key;
        m.recipientName = newName;
      }
    }
    return changed;
  }

  mailInfoFor(pid: number): import('../../world_api').MailInfo | null {
    const meta = this.ctx.players.get(pid);
    const e = this.ctx.entities.get(pid);
    if (!meta || !e) return null;
    // The Ravenpost is a place you visit, only stream the letter contents
    // while standing there; the unread count (mailUnreadFor) is separate and
    // always available so the HUD envelope indicator works anywhere.
    if (!this.nearPostOffice(e)) return null;
    const delivered = this.deliveredFor(meta).sort((a, b) => b.deliverAt - a.deliverAt);
    const wired = delivered.slice(0, MAIL_WIRE_LIMIT);
    return {
      messages: wired.map((m) => ({
        id: m.id,
        senderName: m.senderName,
        subject: m.subject,
        body: m.body,
        copper: m.copper,
        items: m.items.map((s) => ({ ...s })),
        read: m.read,
      })),
      totalCount: delivered.length,
      unread: this.mailUnreadFor(pid),
      postage: MAIL_POSTAGE,
      maxAttachments: MAIL_MAX_ATTACHMENTS,
      deliverySeconds: MAIL_DELIVERY_SECONDS,
    };
  }

  serializeMail(): MailSave {
    const now = this.ctx.time;
    return {
      mail: this.mail.map((m) => ({
        id: m.id,
        recipientKey: m.recipientKey,
        recipientName: m.recipientName,
        senderName: m.senderName,
        subject: m.subject,
        body: m.body,
        copper: m.copper,
        items: m.items.map((s) => ({ ...s })),
        deliverIn: Math.max(0, Math.round(m.deliverAt - now)),
        secondsLeft: Number.isFinite(m.expiresAt) ? Math.max(0, Math.round(m.expiresAt - now)) : -1,
        read: m.read,
      })),
      nextMailId: this.nextMailId,
    };
  }

  loadMail(save: MailSave | null | undefined): void {
    if (!save) return;
    for (const m of save.mail ?? []) {
      if (!m || typeof m.recipientKey !== 'string') continue;
      this.mail.push({
        id: m.id,
        recipientKey: m.recipientKey,
        recipientName: String(m.recipientName ?? m.recipientKey),
        senderName: String(m.senderName ?? '?'),
        subject: String(m.subject ?? '').slice(0, MAIL_SUBJECT_MAX),
        body: String(m.body ?? '').slice(0, MAIL_BODY_MAX),
        copper: Math.max(0, Math.floor(m.copper) || 0),
        items: (m.items ?? [])
          .filter((s) => s && ITEMS[s.itemId])
          .map((s) => ({ itemId: s.itemId, count: Math.max(1, s.count | 0) })),
        deliverAt: this.ctx.time + (Number.isFinite(m.deliverIn) ? Math.max(0, m.deliverIn) : 0),
        expiresAt:
          Number.isFinite(m.secondsLeft) && (m.secondsLeft as number) >= 0
            ? this.ctx.time + (m.secondsLeft as number)
            : Infinity,
        read: !!m.read,
      });
    }
    const maxId = this.mail.reduce((n, m) => Math.max(n, m.id + 1), 1);
    this.nextMailId = Math.max(this.nextMailId, save.nextMailId ?? 1, maxId);
  }
}
