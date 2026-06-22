import type { SignalSnapshot } from '@helm/shared';

/**
 * A source of signals (market data API, RWA issuer feed, on-chain reader).
 * Implement one per external feed.
 */
export interface SignalSource {
  readonly name: string;
  collect(): Promise<import('@helm/shared').Signal[]>;
}

/**
 * Collect signals from every configured source into a single snapshot.
 * TODO: implement source polling and assembly.
 */
export async function collectSignals(
  _sources: SignalSource[],
  _snapshotId: string,
): Promise<SignalSnapshot> {
  throw new Error('collectSignals not implemented');
}
