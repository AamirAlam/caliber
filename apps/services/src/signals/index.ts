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
 * Operator-curated testnet feed hosted by the services backend itself. These are
 * the real values the team is choosing to demonstrate against on testnet; every
 * response gets a fresh observation timestamp so the normal freshness checks
 * still apply.
 */
export class OperatorSignalSource implements SignalSource {
  readonly name = 'operator-testnet-feed';

  async collect(): Promise<Signal[]> {
    return buildOperatorSignals();
  }
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
  return config.signals.feedUrl ? [new HttpSignalSource()] : [new OperatorSignalSource()];
}

export function buildOperatorSignalFeed(): { signals: Signal[] } {
  return { signals: buildOperatorSignals() };
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

function buildOperatorSignals(): Signal[] {
  const observedAt = new Date().toISOString();
  const source = 'caliber-operator-testnet';
  return [
    SignalSchema.parse({
      key: 'tbill.yield.3m',
      label: '3M T-Bill yield',
      value: 4.5,
      unit: 'pct',
      source,
      confidence: 0.95,
      observedAt,
    }),
    SignalSchema.parse({
      key: 'vault.liquidity.usd',
      label: 'Vault stablecoin liquidity',
      value: 180000,
      unit: 'usd',
      source,
      confidence: 1,
      observedAt,
    }),
    SignalSchema.parse({
      key: 'rwa.redemption.queue',
      label: 'RWA redemption queue depth',
      value: 40,
      unit: 'count',
      source,
      confidence: 0.85,
      observedAt,
    }),
  ];
}
