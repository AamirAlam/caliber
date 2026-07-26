import type { WalletSession } from './walletAuth';
import { walletApprovalMessage } from './walletMessages';

interface CasperWalletLike {
  requestConnection?: () => Promise<unknown>;
  connect?: () => Promise<unknown>;
  isConnected?: () => Promise<boolean> | boolean;
  getActivePublicKey?: () => Promise<unknown> | unknown;
  requestSwitchAccount?: () => Promise<unknown>;
  signMessage?: (publicKey: string, message: string) => Promise<unknown> | unknown;
  sign?: (message: string) => Promise<unknown> | unknown;
}

declare global {
  interface Window {
    casperlabsHelper?: CasperWalletLike;
    CasperWalletProvider?: ((options?: { timeout: number }) => CasperWalletLike) | CasperWalletLike;
  }
}

const walletRequestTimeoutMs = 30 * 60 * 1000;
let cachedProviders: CasperWalletLike[] | null = null;

export function hasWalletProvider(): boolean {
  return getProvider() !== null;
}

export function subscribeWalletPublicKey(onPublicKey: (publicKey: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const publicKey = normalizePublicKey((event as CustomEvent<unknown>).detail);
    if (publicKey) onPublicKey(publicKey);
  };
  addWalletEventListeners(handler);
  return () => removeWalletEventListeners(handler);
}

export async function connectWalletProvider(): Promise<string | null> {
  const providers = getProviders();
  if (providers.length === 0) throw new Error('Casper wallet extension was not found.');
  const eventPublicKey = waitForConnectedPublicKey();
  const provider = providers.find((item) => item.requestConnection || item.connect) ?? providers[0]!;
  const connection = await (provider.requestConnection?.() ?? provider.connect?.() ?? Promise.resolve(true));
  const publicKeyFromConnection = normalizePublicKey(connection);
  if (publicKeyFromConnection) return publicKeyFromConnection;
  const connected = await readConnected(provider, connection);
  if (!connected) throw new Error('Wallet connection was not approved.');
  const publicKeyFromRace = await firstPublicKey([
    pollActivePublicKey(providers, 6, 500),
    eventPublicKey ?? Promise.resolve(null),
  ]);
  if (publicKeyFromRace) return publicKeyFromRace;
  // getActivePublicKey fails when the wallet is locked or when the wallet's
  // active account is not the one approved for this site. requestSwitchAccount
  // opens the wallet UI so the user can activate an approved account; the
  // ActiveKeyChanged/Unlocked events then carry the key.
  const switcher = providers.find((item) => item.requestSwitchAccount);
  if (switcher?.requestSwitchAccount) {
    const eventAfterSwitch = waitForConnectedPublicKey();
    try {
      await switcher.requestSwitchAccount();
    } catch {
      // User dismissed the switch UI — fall through to the event/poll race.
    }
    return firstPublicKey([
      pollActivePublicKey(providers, 6, 500),
      eventAfterSwitch ?? Promise.resolve(null),
    ]);
  }
  return null;
}

/**
 * Race a wallet SDK promise against a timeout. Casper Wallet 2.x can leave
 * requests permanently pending (the content script throws internally instead of
 * rejecting), so no provider read may ever be awaited unguarded.
 */
function settleWithin<T>(promise: Promise<T> | T, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** Resolve with the first non-null key; null once every source has come up empty. */
function firstPublicKey(sources: Array<Promise<string | null>>): Promise<string | null> {
  return new Promise((resolve) => {
    let remaining = sources.length;
    for (const source of sources) {
      source
        .then((publicKey) => {
          if (publicKey) resolve(publicKey);
          else if (--remaining === 0) resolve(null);
        })
        .catch(() => {
          if (--remaining === 0) resolve(null);
        });
    }
  });
}

/** Poll each provider's getActivePublicKey until one yields a key or attempts run out. */
async function pollActivePublicKey(
  providers: CasperWalletLike[],
  attempts: number,
  delayMs: number,
): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    for (const provider of providers) {
      if (!provider.getActivePublicKey) continue;
      const result = await settleWithin(
        Promise.resolve(provider.getActivePublicKey()),
        1500,
        null as unknown,
      );
      const publicKey = normalizePublicKey(result);
      if (publicKey) return publicKey;
    }
  }
  return null;
}

export async function connectWallet(): Promise<WalletSession> {
  const publicKey = await connectWalletProvider();
  if (!publicKey) throw new Error('Wallet connected, but no public key was returned.');
  return authenticateWallet(publicKey);
}

export async function authenticateWallet(publicKey: string): Promise<WalletSession> {
  const trimmedPublicKey = normalizePublicKey(publicKey);
  if (!trimmedPublicKey) {
    throw new Error('Wallet public key is required before authentication.');
  }
  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error('Casper wallet extension is required to sign in.');
  }
  const challengeRes = await fetch('/api/wallet/session', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey: trimmedPublicKey }),
  });
  if (!challengeRes.ok) throw new Error('Wallet sign-in challenge could not be created.');
  const challenge = (await challengeRes.json()) as {
    message: string;
    nonce: string;
    issuedAt: string;
    mac: string;
  };
  const signature = await signWalletMessage(providers, challenge.message, trimmedPublicKey);
  const res = await fetch('/api/wallet/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      publicKey: trimmedPublicKey,
      nonce: challenge.nonce,
      issuedAt: challenge.issuedAt,
      mac: challenge.mac,
      signature,
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
  const providers = getProviders();
  if (providers.length === 0) throw new Error('Casper wallet extension was not found.');
  const message = walletApprovalMessage(runId, workspaceId, wallet.accountHash);
  const signature = await signWalletMessage(providers, message, wallet.publicKey ?? wallet.accountHash);
  return {
    accountHash: wallet.accountHash,
    publicKey: wallet.publicKey,
    signature,
    message,
    signedAt: new Date().toISOString(),
  };
}

function getProvider(): CasperWalletLike | null {
  return getProviders()[0] ?? null;
}

function getProviders(): CasperWalletLike[] {
  if (typeof window === 'undefined') return [];
  if (cachedProviders) return cachedProviders;
  const maybeProvider = window.CasperWalletProvider;
  const providers = [
    window.casperlabsHelper,
    typeof maybeProvider === 'function' ? maybeProvider({ timeout: walletRequestTimeoutMs }) : maybeProvider,
  ].filter((provider): provider is CasperWalletLike => Boolean(provider));
  cachedProviders = Array.from(new Set(providers));
  return cachedProviders;
}

function waitForConnectedPublicKey(): Promise<string | null> | null {
  if (typeof window === 'undefined') return null;
  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      removeWalletEventListeners(onWalletEvent);
      if (timeout) clearTimeout(timeout);
    };

    const finish = (publicKey: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(publicKey);
    };

    const onWalletEvent = (event: Event) => {
      const publicKey = normalizePublicKey((event as CustomEvent<unknown>).detail);
      if (publicKey) finish(publicKey);
    };

    addWalletEventListeners(onWalletEvent);
    // Generous window: wallet approval popups routinely take longer than 10s.
    timeout = setTimeout(() => finish(null), 60_000);
  });
}

function addWalletEventListeners(handler: EventListener): void {
  if (typeof window === 'undefined') return;
  walletEventTargets().forEach((target) => {
    walletEventNames.forEach((eventName) => target.addEventListener(eventName, handler));
  });
}

function removeWalletEventListeners(handler: EventListener): void {
  if (typeof window === 'undefined') return;
  walletEventTargets().forEach((target) => {
    walletEventNames.forEach((eventName) => target.removeEventListener(eventName, handler));
  });
}

function walletEventTargets(): EventTarget[] {
  return [window, document];
}

const walletEventNames = [
  'casper-wallet:connected',
  'casper-wallet:unlocked',
  'casper-wallet:tabChanged',
  'casper-wallet:activeKeyChanged',
  'casper-wallet:active-key-changed',
  'casper-wallet:accountChanged',
  'casper-wallet:account-changed',
  'signer:connected',
  'signer:activeKeyChanged',
  'signer:active-key-changed',
] as const;

async function readConnected(provider: CasperWalletLike, connection: unknown): Promise<boolean> {
  if (typeof connection === 'boolean') return connection;
  if (connection && typeof connection === 'object' && 'connected' in connection) {
    return Boolean((connection as { connected?: unknown }).connected);
  }
  if (provider.isConnected) {
    // isConnected can hang like the other reads; assume connected on timeout
    // since requestConnection already resolved without rejecting.
    return Boolean(await settleWithin(Promise.resolve(provider.isConnected()), 1500, true));
  }
  return true;
}

async function signWalletMessage(
  providers: CasperWalletLike[],
  message: string,
  publicKey?: string,
): Promise<string> {
  if (!publicKey) throw new Error('Wallet public key is required before signing.');
  let lastError: unknown = null;
  for (const provider of providers) {
    try {
      const result = provider.signMessage
        ? await provider.signMessage(publicKey, message)
        : await provider.sign?.(message);
      const signature = normalizeSignature(result);
      if (signature) return signature;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  throw new Error('Wallet did not sign the message.');
}

function normalizeSignature(result: unknown): string | null {
  if (typeof result === 'string') return result;
  if (!result || typeof result !== 'object') return null;
  const body = result as { cancelled?: unknown; signature?: unknown; signatureHex?: unknown; sig?: unknown };
  if (body.cancelled) return null;
  if (typeof body.signatureHex === 'string') return body.signatureHex;
  if (typeof body.signature === 'string') return body.signature;
  if (typeof body.sig === 'string') return body.sig;
  return null;
}

function normalizePublicKey(result: unknown): string | null {
  if (Array.isArray(result)) {
    for (const item of result) {
      const publicKey = normalizePublicKey(item);
      if (publicKey) return publicKey;
    }
    return null;
  }
  if (typeof result === 'string') {
    const trimmed = result.trim();
    if (!trimmed) return null;
    if (isCasperPublicKeyHex(trimmed)) return trimmed;
    if (trimmed.startsWith('{')) {
      try {
        return normalizePublicKey(JSON.parse(trimmed));
      } catch {
        return null;
      }
    }
    return null;
  }
  if (!result || typeof result !== 'object') return null;
  const body = result as {
    publicKey?: unknown;
    publicKeyHex?: unknown;
    activePublicKey?: unknown;
    activeKey?: unknown;
    signingPublicKey?: unknown;
    signingPublicKeyHex?: unknown;
    account?: unknown;
    accountHash?: unknown;
    detail?: unknown;
    data?: unknown;
    result?: unknown;
  };
  const publicKey =
    body.publicKey ??
    body.publicKeyHex ??
    body.activePublicKey ??
    body.activeKey ??
    body.signingPublicKey ??
    body.signingPublicKeyHex ??
    body.account ??
    body.accountHash ??
    body.detail ??
    body.data ??
    body.result;
  if (typeof publicKey === 'string') return normalizePublicKey(publicKey);
  if (publicKey && typeof publicKey === 'object') return normalizePublicKey(publicKey);
  return null;
}

function isCasperPublicKeyHex(value: string): boolean {
  return /^(01[0-9a-f]{64}|02[0-9a-f]{66})$/i.test(value);
}
