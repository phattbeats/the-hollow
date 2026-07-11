// i18n source catalog - the Ravenpost mail window (PHAA-495). English values
// only; the 20 locale translations live in src/ui/i18n.locales/<lang>.ts (the
// runtime-authoritative overlays), filled by the maintainer at release.
//
// Assembled into `en` by ./index.ts under the `mailUi` namespace. Kept as its
// own module (no per-locale blocks, following hud_chrome.ts) so a new mail key
// is an English-only add, and item-catalog domains (items.ts) stay untouched.

export const mailStrings = {
  title: 'The Ravenpost',
  subtitle: 'send and collect letters',
  close: 'Close mail',
  inbox: 'Inbox',
  compose: 'Compose',
  noPostOffice: 'Step up to the Ravenpost to tend your mail.',
  emptyInbox: 'No letters waiting. A raven will arrive when someone writes to you.',
  from: 'From {name}',
  noSubject: '(no subject)',
  take: 'Take',
  delete: 'Delete',
  postageNote: 'Sending a letter costs {money} postage.',
  recipient: 'Recipient',
  subjectLabel: 'Subject',
  bodyPlaceholder: 'Write your letter...',
  send: 'Send Letter',
  needRecipientOrText: 'Name a recipient and write something before sending.',
  openButton: 'Show me the Ravenpost.',
  openButtonAria: 'Open the Ravenpost mail window',
};
