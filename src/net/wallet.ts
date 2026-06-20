// Non-custodial Solana wallet connection via an injected browser wallet
// provider. The account↔wallet *link* is performed by the server after the
// wallet signs a challenge (see src/net/online.ts + server/wallet.ts).
//
// Lives in src/net/ and is never imported by src/sim/: the deterministic core
// stays free of network/wallet dependencies.
import bs58 from 'bs58';

export interface WalletState {
  address: string | null;
  isConnected: boolean;
}

interface SolanaPublicKey {
  toString(): string;
}

interface SolanaProvider {
  publicKey?: SolanaPublicKey | null;
  isConnected?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey?: SolanaPublicKey } | void>;
  disconnect?(): Promise<void>;
  signMessage(message: Uint8Array, encoding?: 'utf8'): Promise<Uint8Array | { signature?: Uint8Array }>;
  on?(event: 'connect' | 'disconnect' | 'accountChanged', cb: (value?: SolanaPublicKey | null) => void): void;
  off?(event: 'connect' | 'disconnect' | 'accountChanged', cb: (value?: SolanaPublicKey | null) => void): void;
}

type WalletWindow = Window & {
  solana?: SolanaProvider;
  phantom?: { solana?: SolanaProvider };
};

const listeners = new Set<(state: WalletState) => void>();
let provider: SolanaProvider | null = null;
let initialized = false;
let connectedAddress: string | null = null;
let trustedReconnectAttempted = false;
let eventsAttached = false;

function walletWindow(): WalletWindow | null {
  return typeof window === 'undefined' ? null : window as WalletWindow;
}

function injectedProvider(): SolanaProvider | null {
  const w = walletWindow();
  return w?.phantom?.solana ?? w?.solana ?? null;
}

function addressFromProvider(p: SolanaProvider | null): string | null {
  const address = p?.publicKey?.toString() ?? null;
  return address && address.length > 0 ? address : null;
}

function emitWalletState(): void {
  const state = currentWallet();
  for (const cb of listeners) cb(state);
}

function setConnectedAddress(address: string | null): void {
  if (connectedAddress === address) return;
  connectedAddress = address;
  emitWalletState();
}

function attachProviderEvents(p: SolanaProvider): void {
  p.on?.('connect', () => setConnectedAddress(addressFromProvider(p)));
  p.on?.('disconnect', () => setConnectedAddress(null));
  p.on?.('accountChanged', (key) => {
    const address = key?.toString() ?? addressFromProvider(p);
    setConnectedAddress(address && address.length > 0 ? address : null);
  });
}

export function initWallet(): SolanaProvider | null {
  if (initialized && provider) return provider;
  initialized = true;
  provider = injectedProvider();
  if (!provider) {
    setConnectedAddress(null);
    return null;
  }
  if (!eventsAttached) {
    attachProviderEvents(provider);
    eventsAttached = true;
  }
  setConnectedAddress(addressFromProvider(provider));
  if (!connectedAddress && !trustedReconnectAttempted) {
    trustedReconnectAttempted = true;
    provider.connect({ onlyIfTrusted: true })
      .then((result) => {
        const address = result && 'publicKey' in result
          ? result.publicKey?.toString() ?? addressFromProvider(provider)
          : addressFromProvider(provider);
        setConnectedAddress(address && address.length > 0 ? address : null);
      })
      .catch(() => undefined);
  }
  return provider;
}

/** Subscribe to connection changes. Fires on connect/disconnect/account switch. */
export function onWalletChange(cb: (state: WalletState) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Injected wallets use their own browser popup; there is no app-owned modal. */
export function onWalletModalChange(cb: (open: boolean) => void): () => void {
  cb(false);
  return () => undefined;
}

export function isWalletModalOpen(): boolean {
  return false;
}

export function currentWallet(): WalletState {
  if (!initialized) provider = injectedProvider();
  const address = connectedAddress ?? addressFromProvider(provider);
  return { address, isConnected: address !== null };
}

/** Ask the injected wallet to connect. */
export async function openWalletModal(): Promise<void> {
  const p = initWallet();
  if (!p) throw new Error('connect a Solana browser wallet first');
  const result = await p.connect();
  const address = result && 'publicKey' in result
    ? result.publicKey?.toString() ?? addressFromProvider(p)
    : addressFromProvider(p);
  setConnectedAddress(address && address.length > 0 ? address : null);
}

export async function disconnectWallet(): Promise<void> {
  const p = initWallet();
  if (!p) return;
  await p.disconnect?.();
  setConnectedAddress(null);
}

/**
 * Ask the connected wallet to sign `message` and return the signature
 * base58-encoded (the encoding the server's verifier expects).
 */
export async function signMessageBase58(message: string): Promise<string> {
  const p = initWallet();
  if (!p || !currentWallet().address) throw new Error('connect a wallet first');
  const result = await p.signMessage(new TextEncoder().encode(message), 'utf8');
  const signature = result instanceof Uint8Array ? result : result.signature;
  if (!(signature instanceof Uint8Array)) throw new Error('wallet returned an invalid signature');
  return bs58.encode(signature);
}

// ── $WOC balance ────────────────────────────────────────────────────────────
// Read through the server proxy (GET /api/woc/balance). The Solana RPC endpoint
// and any API key embedded in it live ONLY on the server (see
// server/woc_balance.ts), so nothing secret is inlined into this bundle. The
// request is same-origin: the server that served this page holds the key.
export async function fetchWocBalance(owner: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/woc/balance?owner=${encodeURIComponent(owner)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { balance?: number | null };
    return typeof data.balance === 'number' ? data.balance : null;
  } catch (err) {
    console.error('[wallet] $WOC balance read failed', err);
    return null;
  }
}
