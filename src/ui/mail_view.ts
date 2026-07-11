// Pure, host-agnostic view model for the Ravenpost mail window (PHAA-495).
//
// The pure-core half of the pure-core + thin-painter split (root CLAUDE.md
// Conventions; reference market_view.ts). Snapshot-driven like the market:
// the painter reads `IWorld.mailInfo` (a `MailInfo | null` mirrored
// identically by the offline Sim and the online ClientWorld). The
// data-absent case (`mailInfo === null`) is the "not at the Ravenpost" state;
// `empty` is an empty inbox at the Ravenpost.
//
// DOM-free and i18n-free so tests/mail_view.test.ts can drive it directly
// with both a Sim-shaped and a ClientWorld-mirror-shaped snapshot.

import type { ItemDef } from '../sim/types';
import type { MailInfo, MailMessageView } from '../world_api';

/** One resolved attachment row: the raw slot plus its item definition. */
export interface MailAttachmentRow {
  itemId: string;
  count: number;
  item: ItemDef | null;
}

/** One inbox row: the raw message plus its resolved attachments. */
export interface MailInboxRow {
  message: MailMessageView;
  attachments: MailAttachmentRow[];
}

export type MailInboxBody =
  | { state: 'no-data' }
  | { state: 'empty' }
  | { state: 'list'; rows: MailInboxRow[] };

export function buildMailInboxBody(
  info: MailInfo | null,
  resolveItem: (itemId: string) => ItemDef | undefined,
): MailInboxBody {
  if (!info) return { state: 'no-data' };
  if (info.messages.length === 0) return { state: 'empty' };
  return {
    state: 'list',
    rows: info.messages.map((message) => ({
      message,
      attachments: message.items.map((s) => ({
        itemId: s.itemId,
        count: s.count,
        item: resolveItem(s.itemId) ?? null,
      })),
    })),
  };
}

/** Whether a compose form (recipient/subject/body/coin/attachments) is sendable. */
export function canSendMail(to: string, subject: string, body: string): boolean {
  return to.trim().length > 0 && (subject.trim().length > 0 || body.trim().length > 0);
}
