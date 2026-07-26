import { SignalSchema, type Signal } from '@caliber/shared';
import { config } from '../config.js';
import { log } from '../logger.js';
import { readAccountCsprMotes } from '../casper/reader.js';
import type { SignalSource } from './index.js';

const MOTES_PER_CSPR = 1_000_000_000n;

/** Fetch the live CSPR/USD price from CoinGecko (overridable for tests/outages). */
async function fetchCsprUsd(timeoutMs: number): Promise<number> {
  const url =
    config.signals.priceApiUrl ||
    'https://api.coingecko.com/api/v3/simple/price?ids=casper-network&vs_currencies=usd';
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`price api ${res.status}`);
  const body = (await res.json()) as { 'casper-network'?: { usd?: number } };
  const usd = body['casper-network']?.usd;
  if (typeof usd !== 'number' || !(usd > 0)) throw new Error('price api returned no usd price');
  return usd;
}

/**
 * Live on-chain treasury signals: the configured treasury account's CSPR balance
 * valued at the live market price. Fails soft (returns []) — these signals are
 * additive; a price-API or node outage must not stop the deterministic loop.
 */
export class LiveChainSignalSource implements SignalSource {
  readonly name = 'live-chain';

  async collect(): Promise<Signal[]> {
    const account = config.casper.treasuryAccount;
    if (!account) return [];
    try {
      const [motes, csprUsd] = await Promise.all([
        readAccountCsprMotes(account),
        fetchCsprUsd(config.signals.timeoutMs),
      ]);
      const cspr = Number(motes) / Number(MOTES_PER_CSPR);
      const observedAt = new Date().toISOString();
      return [
        SignalSchema.parse({
          key: 'market.cspr.usd',
          label: 'CSPR/USD price',
          value: csprUsd,
          unit: 'usd',
          source: this.name,
          confidence: 0.95,
          observedAt,
        }),
        SignalSchema.parse({
          key: 'treasury.total.usd',
          label: 'Treasury value (on-chain CSPR × live price)',
          value: Number((cspr * csprUsd).toFixed(2)),
          unit: 'usd',
          source: this.name,
          confidence: 0.95,
          observedAt,
        }),
      ];
    } catch (err) {
      log.warn('live-chain signals unavailable; continuing without them', { err: String(err) });
      return [];
    }
  }
}
