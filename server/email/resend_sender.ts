// Resend (https://resend.com) delivery transport. The Resend HTTPS API is a
// plain JSON POST to https://api.resend.com/emails with a bearer key; the
// envelope shape ({from, to, subject, html, text}) matches the generic
// HttpSender almost exactly, so the provider-specific surface area collapses
// to one constant URL plus a bearer header. No SDK dependency: keeping the
// dependency set tiny is a board decision (PHAA-639 / PHAA-658), and the same
// raw `fetch` already used for Turnstile and the Solana RPC reader is plenty.

import type { EmailSender, OutboundEmail } from './sender';

export const RESEND_API_URL = 'https://api.resend.com/emails';

export interface ResendSenderConfig {
  apiKey: string;
  from: string;
}

export class ResendSender implements EmailSender {
  readonly name = 'resend';
  constructor(private readonly cfg: ResendSenderConfig) {}
  async send(msg: OutboundEmail): Promise<void> {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // The Resend dashboard shows the key with the `re_` prefix; the API
        // expects the same string verbatim in the bearer header.
        authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        from: this.cfg.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      // Resend returns a JSON error body; fall back to text if it ever doesn't,
      // and truncate so a giant stacktrace can't blow up the ops log.
      const raw = await res.text().catch(() => '');
      const detail = raw.slice(0, 200);
      throw new Error(`resend responded ${res.status}: ${detail}`);
    }
  }
}

// Pick a Resend transport from the environment. Both the API key and the
// from-address are required: a half-configured env must not silently send mail
// (callers of selectSender fall back to ConsoleSender so the miss is loud).
export function selectResendSender(env: NodeJS.ProcessEnv = process.env): ResendSender | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return new ResendSender({ apiKey, from });
}
