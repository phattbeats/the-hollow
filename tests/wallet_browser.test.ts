import { afterEach, describe, expect, it, vi } from 'vitest';

function setWindow(value: unknown): void {
  vi.stubGlobal('window', value);
}

async function freshWalletModule(): Promise<typeof import('../src/net/wallet')> {
  vi.resetModules();
  return import('../src/net/wallet');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browser Solana wallet adapter', () => {
  it('uses an injected Solana provider for the current wallet', async () => {
    setWindow({
      solana: {
        publicKey: { toString: () => 'WalletPubkey111111111111111111111111111111' },
        isConnected: true,
      },
    });

    const wallet = await freshWalletModule();

    expect(wallet.currentWallet()).toEqual({
      address: 'WalletPubkey111111111111111111111111111111',
      isConnected: true,
    });
  });

  it('base58-encodes signatures returned as provider objects', async () => {
    setWindow({
      solana: {
        publicKey: { toString: () => 'WalletPubkey111111111111111111111111111111' },
        isConnected: true,
        signMessage: vi.fn().mockResolvedValue({ signature: new Uint8Array([1, 2, 3, 4]) }),
      },
    });

    const wallet = await freshWalletModule();

    await expect(wallet.signMessageBase58('hello')).resolves.toBe('2VfUX');
  });

  it('picks up a provider injected after the first wallet check', async () => {
    const browserWindow: { solana?: unknown } = {};
    setWindow(browserWindow);
    const wallet = await freshWalletModule();

    expect(wallet.initWallet()).toBeNull();

    browserWindow.solana = {
      publicKey: { toString: () => 'LateWallet1111111111111111111111111111111' },
      isConnected: true,
    };

    expect(wallet.currentWallet()).toEqual({
      address: null,
      isConnected: false,
    });
    expect(wallet.initWallet()).not.toBeNull();
    expect(wallet.currentWallet()).toEqual({
      address: 'LateWallet1111111111111111111111111111111',
      isConnected: true,
    });
  });
});
