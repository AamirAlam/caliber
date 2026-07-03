import type { Signal, SignalSnapshot } from '@caliber/shared';
import type { AppState } from '../state.js';

/**
 * A source of signals (market data API, RWA issuer feed, on-chain reader).
 * Implement one per external feed.
 */
export interface SignalSource {
  readonly name: string;
  collect(): Promise<Signal[]>;
}

/**
 * Deterministic simulated source for the demo. Reads `AppState.scenarioStress`:
 * in calm mode the treasury is healthy; in stress mode liquidity collapses below
 * the policy floor and the redemption queue spikes, which pushes risk up and
 * forces a policy-compliant de-risking rebalance. A small seq-based jitter makes
 * the signals visibly "move" without changing the verdict. Replace with real
 * `SignalSource`s for production.
 */
export class SimulatedSignalSource implements SignalSource {
  readonly name = 'simulated';
  private tick = 0;

  constructor(private readonly state: AppState) {}

  async collect(): Promise<Signal[]> {
    const now = new Date().toISOString();
    const stress = this.state.scenarioStress;
    const jitter = Math.sin(this.tick++) * 0.5; // deterministic ±0.5

    const liquidity = stress ? 180_000 : 420_000 + jitter * 4_000;
    const queue = stress ? 40 : 3;
    const yield3m = stress ? 4.5 : 5.1 + jitter * 0.05;

    const mk = (
      key: string,
      label: string,
      value: number,
      unit: Signal['unit'],
      confidence = 1,
    ): Signal => ({ key, label, value, unit, source: this.name, confidence, observedAt: now });

    return [
      mk('tbill.yield.3m', '3M T-Bill yield', Number(yield3m.toFixed(2)), 'pct', 0.95),
      mk('vault.liquidity.usd', 'Vault stablecoin liquidity', Math.round(liquidity), 'usd'),
      mk('rwa.redemption.queue', 'RWA redemption queue depth', queue, 'count', 0.8),
    ];
  }
}

/** Collect from every configured source and assemble a snapshot. */
export async function collectSignals(
  sources: SignalSource[],
  snapshotId: string,
): Promise<SignalSnapshot> {
  const batches = await Promise.all(sources.map((s) => s.collect()));
  return { id: snapshotId, capturedAt: new Date().toISOString(), signals: batches.flat() };
}
