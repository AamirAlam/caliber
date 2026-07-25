import type { WalletSession } from './walletAuth';
import { walletApprovalMessage } from './walletMessages';

interface CasperWalletLike {
  requestConnection?: () => Promise<unknown>;
  connect?: () => Promise<unknown>;
  isConnected?: () => Promise<boolean> | boolean;
  signMessage?: (message: string, publicKey?: string) => Promise<unknown> | unknown;
  sign?: (message: string) => Promise<unknown> | unknown;
}

declare global {
  interface Window {
    casperlabsHelper?: CasperWalletLike;
    CasperWalletProvider?: (() => CasperWalletLike) | CasperWalletLike;
  }
}

export function hasWalletProvider(): boolean {
  return getProvider() !== null;
}

export async function connectWalletProvider(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) throw new Error('Casper wallet extension was not found.');
  const connection = await (provider.requestConnection?.() ?? provider.connect?.() ?? Promise.resolve(true));
  const publicKeyFromConnection = normalizePublicKey(connection);
  if (publicKeyFromConnection) return publicKeyFromConnection;
  const connected = await readConnected(provider, connection);
  if (!connected) throw new Error('Wallet connection was not approved.');
  return null;
}

export async function connectWallet(): Promise<WalletSession> {
  const publicKey = await connectWalletProvider();
  if (!publicKey) throw new Error('Wallet connected, but no public key was returned.');
  return authenticateWallet(publicKey);
}

export async function authenticateWallet(publicKey: string): Promise<WalletSession> {
  const provider = getProvider();
  if (!provider) throw new Error('Casper wallet extension was not found.');
  const challenge = await fetch('/api/wallet/session', { method: 'PUT' }).then((res) => res.json() as Promise<{ message: string }>);
  const signature = await signWalletMessage(provider, challenge.message, publicKey);
  const res = await fetch('/api/wallet/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountHash: publicKey,
      publicKey,
      signature,
      message: challenge.message,
    }),
  });
  if (!res.ok) throw new Error('Wallet session could not be created.');
  const body = (await res.json()) as { wallet: WalletSession };
  return body.wallet;
}

export async function disconnectWallet(): Promise<void> {
  await fetch('/api/wallet/session', { method: 'DELETE' }).catch(() => undefined);
}

export async function loadWalletSession(): Promise<WalletSession | null> {
  const res = await fetch('/api/wallet/session', { cache: 'no-store' });
  if (!res.ok) return null;
  const body = (await res.json()) as { wallet: WalletSession | null };
  return body.wallet;
}

export async function signApproval(runId: string, workspaceId: string, wallet: WalletSession) {
  const provider = getProvider();
  if (!provider) throw new Error('Casper wallet extension was not found.');
  const message = walletApprovalMessage(runId, workspaceId, wallet.accountHash);
  const signature = await signWalletMessage(provider, message, wallet.publicKey ?? wallet.accountHash);
  return {
    accountHash: wallet.accountHash,
    publicKey: wallet.publicKey,
    signature,
    message,
    signedAt: new Date().toISOString(),
  };
}

function getProvider(): CasperWalletLike | null {
  if (typeof window === 'undefined') return null;
  const maybeProvider = window.CasperWalletProvider;
  if (typeof maybeProvider === 'function') return maybeProvider();
  return window.casperlabsHelper ?? maybeProvider ?? null;
}

async function readConnected(provider: CasperWalletLike, connection: unknown): Promise<boolean> {
  if (typeof connection === 'boolean') return connection;
  if (connection && typeof connection === 'object' && 'connected' in connection) {
    return Boolean((connection as { connected?: unknown }).connected);
  }
  if (provider.isConnected) return Boolean(await provider.isConnected());
  return true;
}

async function signWalletMessage(
  provider: CasperWalletLike,
  message: string,
  publicKey?: string,
): Promise<string> {
  const result = await (provider.signMessage?.(message, publicKey) ?? provider.sign?.(message));
  const signature = normalizeSignature(result);
  if (!signature) throw new Error('Wallet did not sign the message.');
  return signature;
}

function normalizeSignature(result: unknown): string | null {
  if (typeof result === 'string') return result;
  if (!result || typeof result !== 'object') return null;
  const body = result as { signature?: unknown; signatureHex?: unknown; sig?: unknown };
  if (typeof body.signature === 'string') return body.signature;
  if (typeof body.signatureHex === 'string') return body.signatureHex;
  if (typeof body.sig === 'string') return body.sig;
  return null;
}

function normalizePublicKey(result: unknown): string | null {
  if (typeof result === 'string') return result;
  if (!result || typeof result !== 'object') return null;
  const body = result as {
    publicKey?: unknown;
    activePublicKey?: unknown;
    account?: unknown;
    accountHash?: unknown;
  };
  if (typeof body.publicKey === 'string') return body.publicKey;
  if (typeof body.activePublicKey === 'string') return body.activePublicKey;
  if (typeof body.account === 'string') return body.account;
  if (typeof body.accountHash === 'string') return body.accountHash;
  return null;
}
