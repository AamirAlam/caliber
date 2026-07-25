import { SignalSchema, type Signal, type SignalSnapshot } from '@caliber/shared';
import { config } from '../config.js';

export const REQUIRED_SIGNAL_KEYS = [
  'vault.liquidity.usd',
  'rwa.redemption.queue',
  'tbill.yield.3m',
] as const;

/**
 * A source of signals (market data API, RWA issuer feed, on-chain reader).
 * Implement one per external feed.
 */
export interface SignalSource {
  readonly name: string;
  collect(): Promise<Signal[]>;
}

/**
 * HTTP-backed signal source for deployed environments. The endpoint may return
 * either `Signal[]` or `{ signals: Signal[] }`; every item is validated against
 * the shared schema before it reaches risk scoring.
 */
export class HttpSignalSource implements SignalSource {
  readonly name = 'http-feed';

  constructor(
    private readonly url = config.signals.feedUrl,
    private readonly timeoutMs = config.signals.timeoutMs,
  ) {
    if (!url) throw new Error('CALIBER_SIGNAL_FEED_URL is required');
  }

  async collect(): Promise<Signal[]> {
    const res = await fetch(this.url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`signal feed ${res.status}`);
    const body = (await res.json()) as unknown;
    const raw = Array.isArray(body)
      ? body
      : typeof body === 'object' && body !== null && 'signals' in body
        ? (body as { signals: unknown }).signals
        : undefined;
    if (!Array.isArray(raw)) throw new Error('signal feed must return Signal[] or { signals: Signal[] }');
    return raw.map((item) => SignalSchema.parse(item));
  }
}

export function buildSignalSources(): SignalSource[] {
  return [new HttpSignalSource()];
}

/** Collect from every configured source and assemble a snapshot. */
export async function collectSignals(
  sources: SignalSource[],
  snapshotId: string,
): Promise<SignalSnapshot> {
  const batches = await Promise.all(sources.map((s) => s.collect()));
  const signals = batches.flat();
  validateSignalSet(signals);
  return { id: snapshotId, capturedAt: new Date().toISOString(), signals };
}

export function validateSignalSet(
  signals: Signal[],
  now = Date.now(),
  maxAgeMs = config.signals.maxAgeMs,
): void {
  const present = new Set(signals.map((s) => s.key));
  const missing = REQUIRED_SIGNAL_KEYS.filter((key) => !present.has(key));
  if (missing.length > 0) {
    throw new Error(`signal feed missing required keys: ${missing.join(', ')}`);
  }

  const stale = signals.filter((s) => {
    const observedAt = Date.parse(s.observedAt);
    return !Number.isFinite(observedAt) || observedAt > now + 1000 || now - observedAt > maxAgeMs;
  });
  if (stale.length > 0) {
    throw new Error(`signal feed has stale or invalid observations: ${stale.map((s) => s.key).join(', ')}`);
  }
}
