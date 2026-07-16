import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/sim/data';
import { buildMailInboxBody, canSendMail, clampParcelQty } from '../src/ui/mail_view';
import type { MailInfo, MailMessageView } from '../src/world_api';

function message(over: Partial<MailMessageView> = {}): MailMessageView {
  return {
    id: 1,
    senderName: 'Sender',
    subject: 'Hello',
    body: 'body text',
    copper: 0,
    items: [],
    read: false,
    ...over,
  };
}

function info(over: Partial<MailInfo> = {}): MailInfo {
  return {
    messages: [],
    totalCount: 0,
    unread: 0,
    postage: 30,
    maxAttachments: 3,
    deliverySeconds: 45,
    ...over,
  };
}

describe('mail_view: buildMailInboxBody', () => {
  it('reports no-data when the snapshot has not arrived (not standing at the Ravenpost)', () => {
    expect(buildMailInboxBody(null, (id) => ITEMS[id])).toEqual({ state: 'no-data' });
  });

  it('reports empty when the mailbox has no delivered letters', () => {
    expect(buildMailInboxBody(info({ messages: [] }), (id) => ITEMS[id])).toEqual({
      state: 'empty',
    });
  });

  it('resolves each message and its attachments into a list row', () => {
    const msg = message({ items: [{ itemId: 'wolf_fang', count: 2 }], copper: 50 });
    const body = buildMailInboxBody(info({ messages: [msg] }), (id) => ITEMS[id]);
    expect(body.state).toBe('list');
    if (body.state !== 'list') throw new Error('unreachable');
    expect(body.rows.length).toBe(1);
    expect(body.rows[0].message).toBe(msg);
    expect(body.rows[0].attachments).toEqual([
      { itemId: 'wolf_fang', count: 2, item: ITEMS.wolf_fang },
    ]);
  });

  it('resolves an unknown itemId to a null item rather than throwing', () => {
    const msg = message({ items: [{ itemId: 'not_a_real_item', count: 1 }] });
    const body = buildMailInboxBody(info({ messages: [msg] }), (id) => ITEMS[id]);
    expect(body.state).toBe('list');
    if (body.state !== 'list') throw new Error('unreachable');
    expect(body.rows[0].attachments).toEqual([{ itemId: 'not_a_real_item', count: 1, item: null }]);
  });
});

describe('mail_view: canSendMail', () => {
  it('requires a recipient plus either a subject or a body', () => {
    expect(canSendMail('', '', '')).toBe(false);
    expect(canSendMail('Recipient', '', '')).toBe(false);
    expect(canSendMail('Recipient', 'Subject', '')).toBe(true);
    expect(canSendMail('Recipient', '', 'Body text')).toBe(true);
    expect(canSendMail('  ', 'Subject', '')).toBe(false);
  });
});

describe('mail_view: clampParcelQty', () => {
  it('increments and decrements by the delta within [1, owned]', () => {
    expect(clampParcelQty(3, 1, 5)).toBe(4);
    expect(clampParcelQty(3, -1, 5)).toBe(2);
  });

  it('never drops below 1 (the remove control drops a parcel entirely)', () => {
    expect(clampParcelQty(1, -1, 5)).toBe(1);
    expect(clampParcelQty(2, -5, 5)).toBe(1);
  });

  it('never rises above what the sender owns', () => {
    expect(clampParcelQty(5, 1, 5)).toBe(5);
    expect(clampParcelQty(4, 10, 5)).toBe(5);
  });

  it('floor wins over ceiling when the bags have emptied to 0', () => {
    expect(clampParcelQty(3, 1, 0)).toBe(1);
    expect(clampParcelQty(3, -1, 0)).toBe(1);
  });

  it('floors fractional inputs before clamping', () => {
    expect(clampParcelQty(2.9, 1, 5.9)).toBe(3);
  });
});
