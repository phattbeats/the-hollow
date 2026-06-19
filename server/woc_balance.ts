// Server-side $WOC balance reads — the ONLY place the Solana RPC endpoint is used.
//
// Both the in-world holder-tier flair (broadcast to nearby players) and the
// connected wallet's own balance (drawn on the player card / bag, via the
// /api/woc/balance proxy) are read here with a raw fetch — so the RPC URL, and any
// API key embedded in it, never ship in the client bundle. Cached per wallet, since
// balances move slowly and public RPCs are rate-limited.
//
// Reads SOLANA_RPC_URL + WOC_MINT from the SERVER environment. The VITE_* names are
// accepted only as a local-dev fallback (server/db.ts loads .env.local); no client
// code references them, so nothing secret is inlined at build time.
import type http from 'node:http';
import { json } from './http_util';
import { isSolanaAddress } from './wallet_link';
import { holderTierForBalance } from '../src/ui/holder_tier';

const WOC_MINT = (process.env.WOC_MINT ?? process.env.VITE_WOC_MINT ?? '3WjLscH2JsXLEFJZRA9z8ti8yRGxWGKbqymPd7UicRth').trim();
const SOLANA_RPC_URL = (process.env.SOLANA_RPC_URL ?? process.env.VITE_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com').trim();
// Balances move slowly relative to a play session; one RPC per wallet per this
// window is plenty and keeps us well under public-RPC rate limits.
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry { balance: number; at: number; }
const cache = new Map<string, CacheEntry>();

/**
 * The owner's total $WOC across all their token accounts for the mint, in
 * human-readable units (the RPC's uiAmount already applies decimals). Returns
 * null on any RPC/parse failure so callers can keep the last known value.
 */
export async function fetchWocBalance(pubkey: string): Promise<number | null> {
  try {
    const res = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [pubkey, { mint: WOC_MINT }, { encoding: 'jsonParsed' }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: { value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number } } } } } }> };
    };
    const accounts = data?.result?.value;
    if (!Array.isArray(accounts)) return null;
    let total = 0;
    for (const a of accounts) {
      const ui = a?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof ui === 'number') total += ui;
    }
    return total;
  } catch (err) {
    console.error('[woc] balance read failed for', pubkey, err);
    return null;
  }
}

/**
 * Cached $WOC balance (uiAmount) for a wallet. Re-fetches at most once per TTL;
 * on a failed refresh keeps the last known balance, or null when the wallet has
 * never been read successfully (so callers can omit the figure). One per-wallet
 * cache backs both the holder-tier broadcast and the client balance proxy.
 */
export async function cachedWocBalance(pubkey: string): Promise<number | null> {
  const now = Date.now();
  const hit = cache.get(pubkey);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.balance;
  const balance = await fetchWocBalance(pubkey);
  if (balance === null) return hit ? hit.balance : null; // keep last known, else null
  cache.set(pubkey, { balance, at: now });
  return balance;
}

/**
 * Cached holder tier + exact balance for a wallet. The tier is derived from the
 * (cached) balance; {0, 0} when the wallet has never been read successfully. This
 * backs the `ht`/`hb` holder-tier identity payload the server broadcasts.
 */
export async function holderInfoForPubkey(pubkey: string): Promise<{ tier: number; balance: number }> {
  const balance = await cachedWocBalance(pubkey);
  if (balance === null) return { tier: 0, balance: 0 };
  return { tier: holderTierForBalance(balance)?.index ?? 0, balance };
}

/**
 * GET /api/woc/balance?owner=<pubkey> → { balance: number | null }
 *
 * Public proxy that keeps the RPC endpoint server-side. On-chain balances are
 * public, and this is narrow (only the $WOC mint, for one owner) — the address is
 * validated before any RPC, the per-wallet cache plus the route's IP rate-limit
 * bound load, so it can't be abused as a general RPC passthrough.
 */
export async function handleWocBalance(res: http.ServerResponse, owner: string): Promise<void> {
  if (!isSolanaAddress(owner)) return json(res, 400, { error: 'invalid Solana wallet address' });
  const balance = await cachedWocBalance(owner);
  return json(res, 200, { balance });
}
