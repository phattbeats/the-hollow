// Shared deny-by-default request guards, ported from upstream's BOLA-hardening
// primitive (server/http/middleware/require_owned.ts, require_account.ts,
// require_admin.ts, levy-street/world-of-claudecraft#1491, primitive 3/6 of the
// PHAA-519 REST decomposition). Upstream wires these into a middleware onion;
// we have no equivalent router, so every REST/admin handler that resolves a
// caller's account, a caller-owned character, or an admin caller imports the
// matching function from here instead of re-deriving the check inline.
import type http from 'node:http';
import {
  accountAndScopeForToken,
  accountForToken,
  type CharacterRow,
  getCharacter,
  isAdminAccount,
  moderationStatusForAccount,
  scopeAllowsMutation,
  type TokenScope,
} from './db';
import { json } from './http_util';

const BEARER_TOKEN = /^Bearer ([a-f0-9]{64})$/;

// Raw bearer token string (or null): needed when an account action must keep
// the caller's own session alive while revoking the rest (password change).
export function bearerToken(req: http.IncomingMessage): string | null {
  const m = BEARER_TOKEN.exec(req.headers.authorization ?? '');
  return m ? m[1] : null;
}

export async function bearerAccount(req: http.IncomingMessage): Promise<number | null> {
  const token = bearerToken(req);
  return token === null ? null : accountForToken(token);
}

// Account + token scope for the bearer (or null when unauthenticated). The scope
// is what lets read-only companion/OAuth tokens be accepted on read routes and
// rejected on mutating ones. Module-private: only bearerActiveAccount/bearerReadAccount
// below call it directly.
async function bearerScopeAccount(
  req: http.IncomingMessage,
): Promise<{ accountId: number; scope: TokenScope } | null> {
  const token = bearerToken(req);
  return token === null ? null : accountAndScopeForToken(token);
}

// Mutating + owner-scoped routes funnel through here. HARDENED: a read-only
// token (scope!=='full') is rejected with 403, so every existing mutating route
// (which already calls this) automatically refuses companion/OAuth read tokens,
// the single choke point that keeps read tokens harmless.
export async function bearerActiveAccount(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<number | null> {
  const info = await bearerScopeAccount(req);
  if (info === null) {
    json(res, 401, { error: 'not authenticated' });
    return null;
  }
  if (!scopeAllowsMutation(info.scope)) {
    json(res, 403, { error: 'this token is read-only' });
    return null;
  }
  const status = await moderationStatusForAccount(info.accountId);
  if (status.locked) {
    json(res, 403, { error: status.message });
    return null;
  }
  return info.accountId;
}

// Read routes (the owner character sheet) accept both 'read' and 'full' tokens.
// Moderation still applies: a banned account can't read through a read token.
export async function bearerReadAccount(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<number | null> {
  const info = await bearerScopeAccount(req);
  if (info === null) {
    json(res, 401, { error: 'not authenticated' });
    return null;
  }
  const status = await moderationStatusForAccount(info.accountId);
  if (status.locked) {
    json(res, 403, { error: status.message });
    return null;
  }
  return info.accountId;
}

// Admin-only routes funnel through here: resolves the bearer account, then
// denies (401, no distinct 403) unless it is flagged is_admin. The single
// choke point admin.ts's whole route table sits behind, mirroring upstream's
// require_admin.ts.
export async function requireAdminAccount(req: http.IncomingMessage): Promise<number | null> {
  const accountId = await bearerAccount(req);
  if (accountId === null) return null;
  return (await isAdminAccount(accountId)) ? accountId : null;
}

// The BOLA ownership loader: resolves the character ONLY if `accountId` (an
// already-authenticated caller, from bearerActiveAccount/bearerReadAccount above)
// owns it, else writes a 404 and returns null. A wrong owner and a nonexistent
// id both take this same path (db.getCharacter's WHERE clause never distinguishes
// them), so calling this never leaks whether a character id exists under someone
// else's account. `notFoundMessage` lets a caller keep its own existing wording
// (e.g. "reporting character not found"); every other 404 caller can just take
// the default.
export async function requireOwnedCharacter(
  res: http.ServerResponse,
  accountId: number,
  characterId: number,
  notFoundMessage = 'character not found',
): Promise<CharacterRow | null> {
  const character = await getCharacter(accountId, characterId);
  if (!character) {
    json(res, 404, { error: notFoundMessage });
    return null;
  }
  return character;
}
